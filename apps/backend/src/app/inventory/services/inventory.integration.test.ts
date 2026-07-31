import { randomUUID } from "node:crypto";
import { db } from "@vitastock/db";
import {
	inventoryAlertOutbox,
	inventoryAlerts,
	stockBatches,
	stockLogs,
	stockTransactions,
} from "@vitastock/db/schema/inventory";
import { addDays } from "date-fns";
import { and, asc, eq } from "drizzle-orm";
import { afterAll, expect, test } from "vitest";
import { AppError } from "@/lib/utils";
import { createInventoryFixture } from "@/test/inventoryFixture";
import { acknowledgeInventoryAlert, syncInventoryAlerts } from "./alertLifecycle";
import { getInventoryActivity } from "./data-access/activity";
import { createInventoryStockLog } from "./stock-log";
import { getDrugForStockMovement } from "./data-access/summary";

afterAll(async () => {
	await db.$client.end();
});

test("Stock transaction integration - records a repeated transaction only once", async () => {
	await using fixture = await createInventoryFixture();
	const idempotencyKey = randomUUID();
	const body = {
		batchNumber: "BATCH-IDEMPOTENT",
		drugId: fixture.drug.id,
		expiryDate: addDays(new Date(), 180),
		logType: "stock_in" as const,
		quantity: 20,
		unitCostKobo: 1500,
	};
	const options = {
		body,
		idempotencyKey,
		userId: fixture.user.id,
		workspaceId: fixture.workspace.id,
	};

	await createInventoryStockLog(options);
	await createInventoryStockLog(options);

	const batches = await db
		.select()
		.from(stockBatches)
		.where(eq(stockBatches.workspaceId, fixture.workspace.id));
	const logs = await db
		.select()
		.from(stockLogs)
		.innerJoin(stockTransactions, eq(stockLogs.stockTransactionId, stockTransactions.id))
		.where(
			and(
				eq(stockTransactions.workspaceId, fixture.workspace.id),
				eq(stockTransactions.idempotencyKey, idempotencyKey)
			)
		);

	expect(batches).toHaveLength(1);
	expect(batches[0]?.quantityAvailable).toBe(20);
	expect(logs).toHaveLength(1);
});

test("FEFO integration - deducts persisted batches from earliest expiry first", async () => {
	await using fixture = await createInventoryFixture();
	const firstExpiryDate = addDays(new Date(), 30);
	const secondExpiryDate = addDays(new Date(), 90);

	await createInventoryStockLog({
		body: {
			batchNumber: "BATCH-EARLY",
			drugId: fixture.drug.id,
			expiryDate: firstExpiryDate,
			logType: "stock_in",
			quantity: 4,
			unitCostKobo: 1000,
		},
		idempotencyKey: randomUUID(),
		userId: fixture.user.id,
		workspaceId: fixture.workspace.id,
	});
	await createInventoryStockLog({
		body: {
			batchNumber: "BATCH-LATER",
			drugId: fixture.drug.id,
			expiryDate: secondExpiryDate,
			logType: "stock_in",
			quantity: 10,
			unitCostKobo: 1200,
		},
		idempotencyKey: randomUUID(),
		userId: fixture.user.id,
		workspaceId: fixture.workspace.id,
	});

	const stockOutIdempotencyKey = randomUUID();

	await createInventoryStockLog({
		body: {
			drugId: fixture.drug.id,
			logType: "stock_out",
			quantity: 7,
			reason: "patient",
		},
		idempotencyKey: stockOutIdempotencyKey,
		userId: fixture.user.id,
		workspaceId: fixture.workspace.id,
	});

	const batches = await db
		.select({
			batchNumber: stockBatches.batchNumber,
			quantityAvailable: stockBatches.quantityAvailable,
		})
		.from(stockBatches)
		.where(eq(stockBatches.workspaceId, fixture.workspace.id))
		.orderBy(asc(stockBatches.expiryDate));
	const stockOutLogs = await db
		.select({ quantity: stockLogs.quantity })
		.from(stockLogs)
		.innerJoin(stockTransactions, eq(stockLogs.stockTransactionId, stockTransactions.id))
		.where(
			and(
				eq(stockTransactions.workspaceId, fixture.workspace.id),
				eq(stockTransactions.idempotencyKey, stockOutIdempotencyKey)
			)
		)
		.orderBy(asc(stockLogs.createdAt));

	expect(batches).toEqual([
		{ batchNumber: "BATCH-EARLY", quantityAvailable: 0 },
		{ batchNumber: "BATCH-LATER", quantityAvailable: 7 },
	]);
	expect(stockOutLogs.map((log) => log.quantity)).toEqual([4, 3]);
});

test("Expired stock integration - removes only the targeted expired batch", async () => {
	await using fixture = await createInventoryFixture();

	await createInventoryStockLog({
		body: {
			batchNumber: "BATCH-EXPIRED",
			drugId: fixture.drug.id,
			expiryDate: addDays(new Date(), -30),
			logType: "stock_in",
			quantity: 5,
			unitCostKobo: 1000,
		},
		idempotencyKey: randomUUID(),
		userId: fixture.user.id,
		workspaceId: fixture.workspace.id,
	});
	await createInventoryStockLog({
		body: {
			batchNumber: "BATCH-VALID",
			drugId: fixture.drug.id,
			expiryDate: addDays(new Date(), 90),
			logType: "stock_in",
			quantity: 8,
			unitCostKobo: 1200,
		},
		idempotencyKey: randomUUID(),
		userId: fixture.user.id,
		workspaceId: fixture.workspace.id,
	});

	const [expiredBatch] = await db
		.select()
		.from(stockBatches)
		.where(
			and(
				eq(stockBatches.workspaceId, fixture.workspace.id),
				eq(stockBatches.batchNumber, "BATCH-EXPIRED")
			)
		);

	if (!expiredBatch) throw new Error("Expected an expired stock batch");

	await createInventoryStockLog({
		body: {
			batchId: expiredBatch.id,
			drugId: fixture.drug.id,
			logType: "stock_out",
			quantity: 5,
			reason: "expired",
		},
		idempotencyKey: randomUUID(),
		userId: fixture.user.id,
		workspaceId: fixture.workspace.id,
	});

	const batches = await db
		.select({
			batchNumber: stockBatches.batchNumber,
			quantityAvailable: stockBatches.quantityAvailable,
		})
		.from(stockBatches)
		.where(eq(stockBatches.workspaceId, fixture.workspace.id))
		.orderBy(asc(stockBatches.expiryDate));

	expect(batches).toEqual([
		{ batchNumber: "BATCH-EXPIRED", quantityAvailable: 0 },
		{ batchNumber: "BATCH-VALID", quantityAvailable: 8 },
	]);
});

test("Inventory reporting integration - calculates weekly movement and expiry loss totals", async () => {
	await using fixture = await createInventoryFixture();

	await createInventoryStockLog({
		body: {
			batchNumber: "BATCH-LOSS",
			drugId: fixture.drug.id,
			expiryDate: addDays(new Date(), -30),
			logType: "stock_in",
			quantity: 6,
			unitCostKobo: 200,
		},
		idempotencyKey: randomUUID(),
		userId: fixture.user.id,
		workspaceId: fixture.workspace.id,
	});

	const [expiredBatch] = await db
		.select()
		.from(stockBatches)
		.where(eq(stockBatches.workspaceId, fixture.workspace.id));

	if (!expiredBatch) throw new Error("Expected an expired stock batch");

	await createInventoryStockLog({
		body: {
			batchId: expiredBatch.id,
			drugId: fixture.drug.id,
			logType: "stock_out",
			quantity: 4,
			reason: "expired",
		},
		idempotencyKey: randomUUID(),
		userId: fixture.user.id,
		workspaceId: fixture.workspace.id,
	});

	const report = await getInventoryActivity({
		query: undefined,
		workspaceId: fixture.workspace.id,
	});

	expect(report.stats).toEqual({
		expiredLossQuantity: 4,
		expiredLossValueKobo: 800,
		weeklyMovementCount: 2,
		weeklyStockInQuantity: 6,
		weeklyStockOutQuantity: 4,
	});
});

test("Stock transaction integration - rolls back an insufficient stock-out transaction", async () => {
	await using fixture = await createInventoryFixture();

	await createInventoryStockLog({
		body: {
			batchNumber: "BATCH-LIMITED",
			drugId: fixture.drug.id,
			expiryDate: addDays(new Date(), 90),
			logType: "stock_in",
			quantity: 5,
		},
		idempotencyKey: randomUUID(),
		userId: fixture.user.id,
		workspaceId: fixture.workspace.id,
	});

	const stockOutIdempotencyKey = randomUUID();
	const stockOut = createInventoryStockLog({
		body: {
			drugId: fixture.drug.id,
			logType: "stock_out",
			quantity: 6,
			reason: "patient",
		},
		idempotencyKey: stockOutIdempotencyKey,
		userId: fixture.user.id,
		workspaceId: fixture.workspace.id,
	});

	await expect(stockOut).rejects.toEqual(
		expect.objectContaining<Partial<AppError>>({
			message: "Insufficient stock available",
			statusCode: 400,
		})
	);

	const [batch] = await db
		.select()
		.from(stockBatches)
		.where(eq(stockBatches.workspaceId, fixture.workspace.id));
	const transactions = await db
		.select()
		.from(stockTransactions)
		.where(
			and(
				eq(stockTransactions.workspaceId, fixture.workspace.id),
				eq(stockTransactions.idempotencyKey, stockOutIdempotencyKey)
			)
		);

	expect(batch?.quantityAvailable).toBe(5);
	expect(transactions).toHaveLength(0);
});

test("Inventory workspace isolation - rejects a drug that belongs to another workspace", async () => {
	await using firstFixture = await createInventoryFixture();
	await using secondFixture = await createInventoryFixture();

	const result = getDrugForStockMovement({
		drugId: firstFixture.drug.id,
		workspaceId: secondFixture.workspace.id,
	});

	await expect(result).rejects.toEqual(
		expect.objectContaining<Partial<AppError>>({
			message: "Drug not found",
			statusCode: 404,
		})
	);
});

test("Alert lifecycle integration - deduplicates, resolves, and reactivates low-stock alerts", async () => {
	await using fixture = await createInventoryFixture({ lowStockThreshold: 10 });
	const syncAlerts = () =>
		syncInventoryAlerts({
			lowStockThreshold: fixture.workspace.lowStockThreshold,
			nearExpiryDays: fixture.workspace.nearExpiryDays,
			workspaceId: fixture.workspace.id,
		});

	await syncAlerts();
	await syncAlerts();

	let alerts = await db
		.select()
		.from(inventoryAlerts)
		.where(eq(inventoryAlerts.workspaceId, fixture.workspace.id));
	let outboxRecords = await db
		.select()
		.from(inventoryAlertOutbox)
		.where(eq(inventoryAlertOutbox.workspaceId, fixture.workspace.id));

	expect(alerts).toHaveLength(1);
	expect(alerts[0]?.status).toBe("active");
	expect(outboxRecords).toHaveLength(1);

	await createInventoryStockLog({
		body: {
			batchNumber: "BATCH-ALERT",
			drugId: fixture.drug.id,
			expiryDate: addDays(new Date(), 180),
			logType: "stock_in",
			quantity: 20,
		},
		idempotencyKey: randomUUID(),
		userId: fixture.user.id,
		workspaceId: fixture.workspace.id,
	});
	await syncAlerts();

	alerts = await db
		.select()
		.from(inventoryAlerts)
		.where(eq(inventoryAlerts.workspaceId, fixture.workspace.id));

	expect(alerts[0]?.status).toBe("resolved");
	expect(alerts[0]?.resolvedAt).toBeInstanceOf(Date);

	await createInventoryStockLog({
		body: {
			drugId: fixture.drug.id,
			logType: "stock_out",
			quantity: 15,
			reason: "patient",
		},
		idempotencyKey: randomUUID(),
		userId: fixture.user.id,
		workspaceId: fixture.workspace.id,
	});
	await new Promise((resolve) => setTimeout(resolve, 2));
	await syncAlerts();

	alerts = await db
		.select()
		.from(inventoryAlerts)
		.where(eq(inventoryAlerts.workspaceId, fixture.workspace.id));
	outboxRecords = await db
		.select()
		.from(inventoryAlertOutbox)
		.where(eq(inventoryAlertOutbox.workspaceId, fixture.workspace.id));

	expect(alerts).toHaveLength(1);
	expect(alerts[0]).toMatchObject({
		acknowledgedAt: null,
		quantityAffected: 5,
		resolvedAt: null,
		status: "active",
	});
	expect(outboxRecords).toHaveLength(2);
});

test("Alert acknowledgement integration - cannot acknowledge another workspace's alert", async () => {
	await using firstFixture = await createInventoryFixture();
	await using secondFixture = await createInventoryFixture();

	await syncInventoryAlerts({
		lowStockThreshold: firstFixture.workspace.lowStockThreshold,
		nearExpiryDays: firstFixture.workspace.nearExpiryDays,
		workspaceId: firstFixture.workspace.id,
	});

	const [alert] = await db
		.select()
		.from(inventoryAlerts)
		.where(eq(inventoryAlerts.workspaceId, firstFixture.workspace.id));

	if (!alert) {
		throw new Error("Expected the fixture to raise a low-stock alert");
	}

	await acknowledgeInventoryAlert({
		alertId: alert.id,
		userId: secondFixture.user.id,
		workspaceId: secondFixture.workspace.id,
	});

	const [unchangedAlert] = await db
		.select()
		.from(inventoryAlerts)
		.where(
			and(eq(inventoryAlerts.id, alert.id), eq(inventoryAlerts.workspaceId, firstFixture.workspace.id))
		);

	expect(unchangedAlert?.acknowledgedAt).toBeNull();
	expect(unchangedAlert?.acknowledgedByUserId).toBeNull();
});
