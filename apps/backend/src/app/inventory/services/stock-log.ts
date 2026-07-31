import { db } from "@vitastock/db";
import {
	STOCK_LOG_TYPES,
	STOCK_OUT_REASONS,
	stockBatches,
	stockLogs,
	stockTransactions,
} from "@vitastock/db/schema/inventory";
import type { backendApiSchemaRoutes } from "@vitastock/shared/validation/backendApiSchema";
import { isEqual, startOfDay } from "date-fns";
import { and, asc, eq, gt, gte, lt } from "drizzle-orm";
import type { z } from "zod";
import { AppError } from "@/lib/utils";
import { getFefoStockMovements } from "./utils/common";

type StockLogBody = z.infer<(typeof backendApiSchemaRoutes)["@post/inventory/stock-log"]["body"]>;

export const createInventoryStockLog = async (options: {
	body: StockLogBody;
	idempotencyKey: string;
	userId: string;
	workspaceId: string;
}) => {
	const { body, idempotencyKey, userId, workspaceId } = options;

	const { drugId, notes, quantity } = body;

	if (body.logType === STOCK_LOG_TYPES[5]) {
		await createStockOutLog({
			batchId: body.batchId,
			drugId,
			idempotencyKey,
			notes: notes ?? undefined,
			quantity,
			reason: body.reason,
			userId,
			workspaceId,
		});

		return;
	}

	await db.transaction(async (tx) => {
		const { batchNumber, expiryDate, unitCostKobo = 0 } = body;

		const [createdTransaction] = await tx
			.insert(stockTransactions)
			.values({ idempotencyKey, performedByUserId: userId, workspaceId })
			.onConflictDoNothing({
				target: [stockTransactions.workspaceId, stockTransactions.idempotencyKey],
			})
			.returning({ id: stockTransactions.id });

		if (!createdTransaction) return;

		const [existingBatch] = await (async () => {
			if (!batchNumber) return [];

			return tx
				.select()
				.from(stockBatches)
				.where(
					and(
						eq(stockBatches.workspaceId, workspaceId),
						eq(stockBatches.drugId, drugId),
						eq(stockBatches.batchNumber, batchNumber)
					)
				)
				.limit(1)
				.for("update");
		})();

		if (existingBatch && !isEqual(existingBatch.expiryDate, expiryDate)) {
			throw new AppError({
				code: 400,
				message: "An existing batch number must keep its original expiry date",
			});
		}

		const [batch] = await (async () => {
			if (existingBatch) {
				return tx
					.update(stockBatches)
					.set({
						quantityAvailable: existingBatch.quantityAvailable + quantity,
						quantityReceived: existingBatch.quantityReceived + quantity,
						...(unitCostKobo > 0 && { unitCostKobo }),
					})
					.where(eq(stockBatches.id, existingBatch.id))
					.returning();
			}

			return tx
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
		})();

		if (!batch) {
			throw new AppError({
				code: 500,
				message: "Failed to create or update stock batch",
			});
		}

		await tx.insert(stockLogs).values({
			batchId: batch.id,
			drugId,
			logType: body.logType,
			notes,
			performedByUserId: userId,
			quantity,
			stockTransactionId: createdTransaction.id,
			unitCostKobo,
			workspaceId,
		});
	});
};

const createStockOutLog = async (options: {
	batchId?: string;
	drugId: string;
	idempotencyKey: string;
	notes?: string;
	quantity: number;
	reason: (typeof STOCK_OUT_REASONS)[number];
	userId: string;
	workspaceId: string;
}) => {
	const { batchId, drugId, idempotencyKey, notes, quantity, reason, userId, workspaceId } = options;

	await db.transaction(async (tx) => {
		const [createdTransaction] = await tx
			.insert(stockTransactions)
			.values({ idempotencyKey, performedByUserId: userId, workspaceId })
			.onConflictDoNothing({
				target: [stockTransactions.workspaceId, stockTransactions.idempotencyKey],
			})
			.returning({ id: stockTransactions.id });

		if (!createdTransaction) return;

		const isExpiredStockRemoval = reason === STOCK_OUT_REASONS[1];
		const today = startOfDay(new Date());
		const expiryCondition =
			isExpiredStockRemoval ? lt(stockBatches.expiryDate, today) : gte(stockBatches.expiryDate, today);

		const batches = await tx
			.select()
			.from(stockBatches)
			.where(
				and(
					eq(stockBatches.drugId, drugId),
					eq(stockBatches.workspaceId, workspaceId),
					gt(stockBatches.quantityAvailable, 0),
					expiryCondition,
					...(batchId ? [eq(stockBatches.id, batchId)] : [])
				)
			)
			.orderBy(asc(stockBatches.expiryDate))
			.for("update");

		const totalAvailable = batches.reduce((total, batch) => total + batch.quantityAvailable, 0);

		if (totalAvailable < quantity) {
			throw new AppError({
				code: 400,
				message:
					isExpiredStockRemoval ?
						"Insufficient expired stock available"
					:	"Insufficient stock available",
			});
		}

		const movements = getFefoStockMovements(batches, quantity);

		await Promise.all(
			movements.map((movement) =>
				tx
					.update(stockBatches)
					.set({ quantityAvailable: movement.nextQuantityAvailable })
					.where(eq(stockBatches.id, movement.batch.id))
			)
		);

		await tx.insert(stockLogs).values(
			movements.map((movement) => ({
				batchId: movement.batch.id,
				drugId,
				logType: "stock_out" as const,
				notes,
				performedByUserId: userId,
				quantity: movement.quantity,
				reason,
				stockTransactionId: createdTransaction.id,
				unitCostKobo: movement.batch.unitCostKobo,
				workspaceId,
			}))
		);
	});
};
