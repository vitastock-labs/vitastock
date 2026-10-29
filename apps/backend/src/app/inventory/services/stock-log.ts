import { db } from "@vitastock/db";
import {
	drugs,
	PAYMENT_METHODS,
	SALE_TYPES,
	STOCK_LOG_TYPES,
	STOCK_OUT_REASONS,
	stockBatches,
	stockLogs,
	stockTransactions,
} from "@vitastock/db/schema/inventory";
import { STOCK_DISPENSE_UNDO_WINDOW_MS } from "@vitastock/shared/constants";
import type { backendApiSchemaRoutes } from "@vitastock/shared/validation/backendApiSchema";
import { addMilliseconds } from "date-fns";
import { and, asc, eq, gt, gte, inArray, isNull, lt, sql } from "drizzle-orm";
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

type SaleSnapshot = {
	paymentMethod?: (typeof PAYMENT_METHODS)[number];
	saleType: (typeof SALE_TYPES)[number];
	unitSellingPrice: number | null;
};
type InventoryTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

const getActiveDrugForUpdate = async (options: {
	drugId: string;
	tx: InventoryTransaction;
	workspaceId: string;
}) => {
	const { drugId, tx, workspaceId } = options;
	const [drug] = await tx
		.select({ id: drugs.id, isActive: drugs.isActive, retailPrice: drugs.retailPrice })
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

	return drug;
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
			patientName: body.reason === STOCK_OUT_REASONS[2] ? body.patientName : undefined,
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
			costPrice: body.costPrice,
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
	patientName?: string | null;
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

		const drug = await getActiveDrugForUpdate({ drugId, tx, workspaceId });

		await deductStockOut({
			...options,
			sale: { saleType: SALE_TYPES[0], unitSellingPrice: drug.retailPrice },
			stockTransactionId: stockTransaction.id,
			tx,
		});
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

	return db.transaction(async (tx) => {
		const stockTransaction = await claimStockTransaction({
			idempotencyKey,
			operation: "dispense_cart",
			requestHash,
			tx,
			userId,
			workspaceId,
		});

		const dispenseResult = {
			stockTransactionId: stockTransaction.id,
			undoExpiresAt: addMilliseconds(stockTransaction.createdAt, STOCK_DISPENSE_UNDO_WINDOW_MS),
		};

		if (stockTransaction.isReplay) {
			return dispenseResult;
		}

		const drugIds = [...new Set(body.items.map((item) => item.drugId))].toSorted();

		// == Lock every cart drug in one sorted query so concurrent carts cannot deadlock
		const activeDrugs = await tx
			.select({ id: drugs.id, retailPrice: drugs.retailPrice, wholesalePrice: drugs.wholesalePrice })
			.from(drugs)
			.where(
				and(eq(drugs.workspaceId, workspaceId), eq(drugs.isActive, true), inArray(drugs.id, drugIds))
			)
			.orderBy(asc(drugs.id))
			.for("update");

		const activeDrugById = new Map(activeDrugs.map((drug) => [drug.id, drug]));
		const unavailableItemIndex = body.items.findIndex((item) => !activeDrugById.has(item.drugId));

		if (unavailableItemIndex !== -1) {
			const message = "This medication is inactive or no longer exists";

			throw new AppError({
				code: 409,
				errors: { [`items.${unavailableItemIndex}.drugId`]: [message] },
				message,
			});
		}

		const isWholesale = body.saleType === SALE_TYPES[1];
		const unpricedWholesaleItemIndex = body.items.findIndex(
			(item) => isWholesale && activeDrugById.get(item.drugId)?.wholesalePrice === null
		);

		if (unpricedWholesaleItemIndex !== -1) {
			const message = "This medication has no wholesale price. Ask an Owner or Admin to set one.";

			throw new AppError({
				code: 409,
				errors: { [`items.${unpricedWholesaleItemIndex}.drugId`]: [message] },
				message,
			});
		}

		for (const [itemIndex, item] of body.items.entries()) {
			const drug = activeDrugById.get(item.drugId);

			// eslint-disable-next-line no-await-in-loop -- FEFO deductions for a drug must see earlier cart deductions
			await deductStockOut({
				...item,
				errorPath: `items.${itemIndex}.quantity`,
				notes: body.notes,
				sale: {
					paymentMethod: body.paymentMethod,
					saleType: body.saleType,
					unitSellingPrice: (isWholesale ? drug?.wholesalePrice : drug?.retailPrice) ?? null,
				},
				stockTransactionId: stockTransaction.id,
				timezone,
				tx,
				userId,
				workspaceId,
			});
		}

		return dispenseResult;
	});
};

const deductStockOut = async (options: {
	batchId?: string;
	drugId: string;
	errorPath?: string;
	notes?: string;
	patientName?: string | null;
	quantity: number;
	reason: StockOutReason;
	sale?: SaleSnapshot;
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
		patientName,
		quantity,
		reason,
		sale,
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
			patientName: reason === STOCK_OUT_REASONS[2] ? (patientName ?? null) : null,
			paymentMethod: sale?.paymentMethod ?? null,
			performedByUserId: userId,
			quantity: movement.quantity,
			reason,
			...(sale && { saleType: sale.saleType }),
			stockTransactionId,
			unitCostPrice: movement.batch.costPrice,
			unitSellingPrice: sale?.unitSellingPrice ?? null,
			workspaceId,
		}))
	);
};

export const undoInventoryDispense = async (options: {
	stockTransactionId: string;
	userId: string;
	workspaceId: string;
}) => {
	const { stockTransactionId, userId, workspaceId } = options;

	await db.transaction(async (tx) => {
		const [stockTransaction] = await tx
			.select({
				createdAt: stockTransactions.createdAt,
				performedByUserId: stockTransactions.performedByUserId,
			})
			.from(stockTransactions)
			.where(
				and(
					eq(stockTransactions.id, stockTransactionId),
					eq(stockTransactions.workspaceId, workspaceId)
				)
			)
			.limit(1)
			.for("update");

		if (!stockTransaction) {
			throw new AppError({ code: 404, message: "Dispense not found" });
		}

		if (stockTransaction.performedByUserId !== userId) {
			throw new AppError({ code: 403, message: "You can only undo your own dispense." });
		}

		const transactionLogs = await tx
			.select({ logType: stockLogs.logType, reason: stockLogs.reason })
			.from(stockLogs)
			.where(eq(stockLogs.stockTransactionId, stockTransactionId));

		const isDispense =
			transactionLogs.length > 0
			&& transactionLogs.every(
				(log) => log.logType === STOCK_LOG_TYPES[5] && log.reason === STOCK_OUT_REASONS[2]
			);

		if (!isDispense) {
			throw new AppError({ code: 400, message: "Only a dispense can be undone." });
		}

		if (Date.now() - stockTransaction.createdAt.getTime() > STOCK_DISPENSE_UNDO_WINDOW_MS) {
			throw new AppError({
				code: 409,
				message: "This dispense can no longer be undone. Undo is only available for 2 minutes.",
			});
		}

		// == The undone_at guard makes concurrent or repeated undo requests restore stock only once
		const undoneLogs = await tx
			.update(stockLogs)
			.set({ undoneAt: sql`now()`, undoneByUserId: userId })
			.where(and(eq(stockLogs.stockTransactionId, stockTransactionId), isNull(stockLogs.undoneAt)))
			.returning({ batchId: stockLogs.batchId, quantity: stockLogs.quantity });

		if (undoneLogs.length === 0) {
			throw new AppError({ code: 409, message: "This dispense has already been undone." });
		}

		for (const log of undoneLogs) {
			if (!log.batchId) {
				throw new AppError({
					code: 409,
					message: "This dispense can no longer be undone because its stock batch was removed.",
				});
			}

			// eslint-disable-next-line no-await-in-loop -- queries on one transaction share a single connection and run sequentially
			await tx
				.update(stockBatches)
				.set({ quantityAvailable: sql`${stockBatches.quantityAvailable} + ${log.quantity}` })
				.where(eq(stockBatches.id, log.batchId));
		}
	});
};
