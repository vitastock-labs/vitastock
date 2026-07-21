import { db } from "@vitastock/db";
import { STOCK_OUT_REASONS, stockBatches, stockLogs } from "@vitastock/db/schema/inventory";
import type { backendApiSchemaRoutes } from "@vitastock/shared/validation/backendApiSchema";
import { and, asc, eq, gt, gte } from "drizzle-orm";
import type { z } from "zod";
import { AppError } from "@/lib/utils";

type StockLogBody = z.infer<(typeof backendApiSchemaRoutes)["@post/inventory/stock-log"]["body"]>;

export const createInventoryStockLog = async (options: {
	body: StockLogBody;
	userId: string;
	workspaceId: string;
}) => {
	const { body, userId, workspaceId } = options;
	const { drugId, logType, notes, quantity } = body;

	if (logType === "stock_out") {
		await createStockOutLog({
			drugId,
			notes: notes ?? undefined,
			quantity,
			reason: body.reason,
			userId,
			workspaceId,
		});

		return;
	}

	const { batchNumber, expiryDate, unitCostKobo = 0 } = body;

	const [batch] = await db
		.insert(stockBatches)
		.values({
			batchNumber,
			drugId,
			expiryDate,
			quantityAvailable: quantity,
			quantityReceived: quantity,
			unitCostKobo,
			userId,
			workspaceId,
		})
		.returning();

	if (!batch) {
		throw new AppError({
			code: 500,
			message: "Failed to create stock batch",
		});
	}

	await db.insert(stockLogs).values({
		batchId: batch.id,
		drugId,
		logType,
		notes,
		performedByUserId: userId,
		quantity,
		unitCostKobo,
		workspaceId,
	});
};

const createStockOutLog = async (options: {
	drugId: string;
	notes?: string;
	quantity: number;
	reason: (typeof STOCK_OUT_REASONS)[number];
	userId: string;
	workspaceId: string;
}) => {
	const { drugId, notes, quantity, reason, userId, workspaceId } = options;

	await db.transaction(async (tx) => {
		const batches = await tx
			.select()
			.from(stockBatches)
			.where(
				and(
					eq(stockBatches.drugId, drugId),
					eq(stockBatches.workspaceId, workspaceId),
					gt(stockBatches.quantityAvailable, 0),
					gte(stockBatches.expiryDate, new Date())
				)
			)
			.orderBy(asc(stockBatches.expiryDate));

		const totalAvailable = batches.reduce((total, batch) => total + batch.quantityAvailable, 0);

		if (totalAvailable < quantity) {
			throw new AppError({ code: 400, message: "Insufficient stock available" });
		}

		let remainingQuantity = quantity;

		const movements = [];

		for (const batch of batches) {
			if (remainingQuantity <= 0) break;

			const deductedQuantity = Math.min(batch.quantityAvailable, remainingQuantity);
			remainingQuantity -= deductedQuantity;

			movements.push({
				batch,
				nextQuantityAvailable: batch.quantityAvailable - deductedQuantity,
				quantity: deductedQuantity,
			});
		}

		await Promise.all(
			movements.map((movement) =>
				tx
					.update(stockBatches)
					.set({ quantityAvailable: movement.nextQuantityAvailable })
					.where(eq(stockBatches.id, movement.batch.id))
			)
		);

		const stockTransactionId = crypto.randomUUID();

		await tx.insert(stockLogs).values(
			movements.map((movement) => ({
				batchId: movement.batch.id,
				drugId,
				logType: "stock_out" as const,
				notes,
				performedByUserId: userId,
				quantity: movement.quantity,
				reason,
				stockTransactionId,
				unitCostKobo: movement.batch.unitCostKobo,
				workspaceId,
			}))
		);
	});
};
