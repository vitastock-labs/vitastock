import { db } from "@vitastock/db";
import {
	drugs,
	STOCK_LOG_TYPES,
	STOCK_OUT_REASONS,
	stockBatches,
	stockLogs,
} from "@vitastock/db/schema/inventory";
import type { backendApiSchemaRoutes } from "@vitastock/shared/validation/backendApiSchema";
import { and, asc, eq, gt, gte, inArray, lt } from "drizzle-orm";
import type { z } from "zod";
import { AppError } from "@/lib/utils";
import { receiveStockBatch } from "./data-access/stock-batches";
import {
	claimStockTransaction,
	createStockTransactionRequestHash,
} from "./data-access/stock-transactions";
import { getFefoStockMovements } from "./utils/common";
import { getWorkspaceToday } from "./utils/date";

type StockLogBody = z.infer<(typeof backendApiSchemaRoutes)["@post/inventory/stock-log"]["body"]>;
type DispenseCartBody = z.infer<
	(typeof backendApiSchemaRoutes)["@post/inventory/stock-log/dispense"]["body"]
>;
type StockOutReason = (typeof STOCK_OUT_REASONS)[number];
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
		const { batchNumber, expiryDate } = body;
		const today = getWorkspaceToday(timezone);

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

		await getActiveDrugForUpdate({ drugId, tx, workspaceId });

		const batch = await receiveStockBatch({
			batchNumber,
			drugId,
			expiryDate,
			quantity,
			tx,
			userId,
			workspaceId,
		});

		await tx.insert(stockLogs).values({
			batchId: batch.id,
			drugId,
			logType: body.logType,
			notes,
			performedByUserId: userId,
			quantity,
			stockTransactionId: stockTransaction.id,
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
	reason: StockOutReason;
	requestHash: string;
	timezone: string;
	userId: string;
	workspaceId: string;
}) => {
	const { drugId, idempotencyKey, requestHash, userId, workspaceId } = options;

	await db.transaction(async (tx) => {
		const stockTransaction = await claimStockTransaction({
			idempotencyKey,
			operation: "stock_log",
			requestHash,
			tx,
			userId,
			workspaceId,
		});

		if (stockTransaction.isReplay) return;

		await getActiveDrugForUpdate({ drugId, tx, workspaceId });

		await deductStockOut({ ...options, stockTransactionId: stockTransaction.id, tx });
	});
};

export const createInventoryDispenseCart = async (options: {
	body: DispenseCartBody;
	idempotencyKey: string;
	timezone: string;
	userId: string;
	workspaceId: string;
}) => {
	const { body, idempotencyKey, timezone, userId, workspaceId } = options;
	const requestHash = createStockTransactionRequestHash(body);

	await db.transaction(async (tx) => {
		const stockTransaction = await claimStockTransaction({
			idempotencyKey,
			operation: "dispense_cart",
			requestHash,
			tx,
			userId,
			workspaceId,
		});

		if (stockTransaction.isReplay) return;

		const drugIds = [...new Set(body.items.map((item) => item.drugId))].toSorted();

		// == Lock every cart drug in one sorted query so concurrent carts cannot deadlock
		const activeDrugs = await tx
			.select({ id: drugs.id })
			.from(drugs)
			.where(
				and(eq(drugs.workspaceId, workspaceId), eq(drugs.isActive, true), inArray(drugs.id, drugIds))
			)
			.orderBy(asc(drugs.id))
			.for("update");

		const activeDrugIds = new Set(activeDrugs.map((drug) => drug.id));
		const unavailableItemIndex = body.items.findIndex((item) => !activeDrugIds.has(item.drugId));

		if (unavailableItemIndex !== -1) {
			const message = "This medication is inactive or no longer exists";

			throw new AppError({
				code: 409,
				errors: { [`items.${unavailableItemIndex}.drugId`]: [message] },
				message,
			});
		}

		for (const [itemIndex, item] of body.items.entries()) {
			// eslint-disable-next-line no-await-in-loop -- FEFO deductions for a drug must see earlier cart deductions
			await deductStockOut({
				...item,
				errorPath: `items.${itemIndex}.quantity`,
				stockTransactionId: stockTransaction.id,
				timezone,
				tx,
				userId,
				workspaceId,
			});
		}
	});
};

const deductStockOut = async (options: {
	batchId?: string;
	drugId: string;
	errorPath?: string;
	notes?: string;
	quantity: number;
	reason: StockOutReason;
	stockTransactionId: string;
	timezone: string;
	tx: InventoryTransaction;
	userId: string;
	workspaceId: string;
}) => {
	const {
		batchId,
		drugId,
		errorPath,
		notes,
		quantity,
		reason,
		stockTransactionId,
		timezone,
		tx,
		userId,
		workspaceId,
	} = options;

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
		const message = `Only ${totalAvailable} units are available`;

		throw new AppError({
			code: 409,
			...(errorPath && { errors: { [errorPath]: [message] } }),
			message,
		});
	}

	const movements = getFefoStockMovements(batches, quantity);

	for (const movement of movements) {
		// eslint-disable-next-line no-await-in-loop -- queries on one transaction share a single connection and run sequentially
		await tx
			.update(stockBatches)
			.set({ quantityAvailable: movement.nextQuantityAvailable })
			.where(eq(stockBatches.id, movement.batch.id));
	}

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
			workspaceId,
		}))
	);
};
