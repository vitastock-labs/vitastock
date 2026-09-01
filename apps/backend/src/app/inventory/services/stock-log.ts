import { db } from "@vitastock/db";
import {
	drugs,
	STOCK_LOG_TYPES,
	STOCK_OUT_REASONS,
	stockBatches,
	stockLogs,
} from "@vitastock/db/schema/inventory";
import type { backendApiSchemaRoutes } from "@vitastock/shared/validation/backendApiSchema";
import { and, asc, eq, gt, gte, isNull, lt, sql } from "drizzle-orm";
import type { z } from "zod";
import { AppError } from "@/lib/utils";
import {
	claimStockTransaction,
	createStockTransactionRequestHash,
} from "./data-access/stock-transactions";
import { convertNairaToKobo, getFefoStockMovements } from "./utils/common";
import { getWorkspaceToday } from "./utils/date";

type StockLogBody = z.infer<(typeof backendApiSchemaRoutes)["@post/inventory/stock-log"]["body"]>;
type InventoryTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

const getActiveDrugForUpdate = async (options: {
	drugId: string;
	tx: InventoryTransaction;
	workspaceId: string;
}) => {
	const { drugId, tx, workspaceId } = options;
	const [drug] = await tx
		.select({ id: drugs.id, isActive: drugs.isActive })
		.from(drugs)
		.where(and(eq(drugs.id, drugId), eq(drugs.workspaceId, workspaceId)))
		.limit(1)
		.for("update");

	if (!drug) {
		throw new AppError({ code: 404, message: "Drug not found" });
	}

	if (!drug.isActive) {
		throw new AppError({ code: 400, message: "Inactive drugs cannot be used for stock movements" });
	}
};

export const createInventoryStockLog = async (options: {
	body: StockLogBody;
	idempotencyKey: string;
	timezone: string;
	userId: string;
	workspaceId: string;
}) => {
	const { body, idempotencyKey, timezone, userId, workspaceId } = options;
	const requestHash = createStockTransactionRequestHash(body);

	const { drugId, notes, quantity } = body;

	if (body.logType === STOCK_LOG_TYPES[5]) {
		await createStockOutLog({
			batchId: body.batchId,
			drugId,
			idempotencyKey,
			notes: notes ?? undefined,
			quantity,
			reason: body.reason,
			requestHash,
			timezone,
			userId,
			workspaceId,
		});

		return;
	}

	await db.transaction(async (tx) => {
		const { batchNumber, expiryDate, unitCostNaira } = body;
		const normalizedBatchNumber = (() => {
			const value = batchNumber?.trim();

			if (!value) {
				return null;
			}

			return value;
		})();
		const unitCostKobo = convertNairaToKobo(unitCostNaira);
		const today = getWorkspaceToday(timezone);

		await getActiveDrugForUpdate({ drugId, tx, workspaceId });

		if (expiryDate < today) {
			throw new AppError({ code: 400, message: "Expiry date cannot be before today" });
		}

		const stockTransaction = await claimStockTransaction({
			idempotencyKey,
			operation: "stock_log",
			requestHash,
			tx,
			userId,
			workspaceId,
		});

		if (stockTransaction.isReplay) return;

		const batchNumberCondition = normalizedBatchNumber
			? sql`lower(btrim(${stockBatches.batchNumber})) = ${normalizedBatchNumber.toLowerCase()}`
			: isNull(stockBatches.batchNumber);
		const unitCostCondition =
			unitCostKobo === null ? isNull(stockBatches.unitCostKobo) : eq(stockBatches.unitCostKobo, unitCostKobo);
		const [existingBatch] = await tx
			.select()
			.from(stockBatches)
			.where(
				and(
					eq(stockBatches.workspaceId, workspaceId),
					eq(stockBatches.drugId, drugId),
					batchNumberCondition,
					eq(stockBatches.expiryDate, expiryDate),
					unitCostCondition
				)
			)
			.limit(1)
			.for("update");

		const [batch] = await (async () => {
			if (existingBatch) {
				return tx
					.update(stockBatches)
					.set({
						quantityAvailable: existingBatch.quantityAvailable + quantity,
						quantityReceived: existingBatch.quantityReceived + quantity,
					})
					.where(eq(stockBatches.id, existingBatch.id))
					.returning();
			}

			return tx
				.insert(stockBatches)
				.values({
					batchNumber: normalizedBatchNumber,
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
			stockTransactionId: stockTransaction.id,
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
	requestHash: string;
	timezone: string;
	userId: string;
	workspaceId: string;
}) => {
	const {
		batchId,
		drugId,
		idempotencyKey,
		notes,
		quantity,
		reason,
		requestHash,
		timezone,
		userId,
		workspaceId,
	} = options;

	await db.transaction(async (tx) => {
		await getActiveDrugForUpdate({ drugId, tx, workspaceId });

		const stockTransaction = await claimStockTransaction({
			idempotencyKey,
			operation: "stock_log",
			requestHash,
			tx,
			userId,
			workspaceId,
		});

		if (stockTransaction.isReplay) return;

		const isExpiredStockRemoval = reason === STOCK_OUT_REASONS[1];
		const today = getWorkspaceToday(timezone);
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
			.orderBy(asc(stockBatches.expiryDate), asc(stockBatches.createdAt), asc(stockBatches.id))
			.for("update");

		const totalAvailable = batches.reduce((total, batch) => total + batch.quantityAvailable, 0);

		if (batchId && batches.length === 0) {
			throw new AppError({ code: 404, message: "Eligible stock batch not found" });
		}

		if (totalAvailable < quantity) {
			throw new AppError({
				code: 409,
				message: `Only ${totalAvailable} units are available`,
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
				stockTransactionId: stockTransaction.id,
				unitCostKobo: movement.batch.unitCostKobo,
				workspaceId,
			}))
		);
	});
};
