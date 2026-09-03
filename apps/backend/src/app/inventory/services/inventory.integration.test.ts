import { randomUUID } from "node:crypto";
import { db } from "@vitastock/db";
import {
	inventoryAlertOutbox,
	inventoryAlerts,
	stockBatches,
	stockLogs,
	stockTransactions,
} from "@vitastock/db/schema/inventory";
import { workspaces } from "@vitastock/db/schema/workspace";
import { addDays, format } from "date-fns";
import { and, asc, eq } from "drizzle-orm";
import { afterAll, expect, test } from "vitest";
import { AppError } from "@/lib/utils";
import { createInventoryFixture } from "@/test/inventoryFixture";
import { enqueuePendingInventoryAlertEmails } from "./alertJobs";
import { acknowledgeInventoryAlert, syncInventoryAlerts } from "./alertLifecycle";
import { getInventoryActivity } from "./data-access/activity";
import { handleDrugAction } from "./data-access/drugs";
import { getInventorySummaryRows } from "./data-access/summary";
import { createInventoryStockLog } from "./stock-log";

afterAll(async () => {
	await db.$client.end();
});

const getDateFromToday = (days: number) => format(addDays(new Date(), days), "yyyy-MM-dd");

test.each(["PANADOL", "paracetamol", "500mg", "tablet", "pack"])(
	"Inventory search integration - matches %s without leaking other workspaces",
	async (search) => {
		await using fixture = await createInventoryFixture();
		await using otherFixture = await createInventoryFixture();
		await db.insert(stockBatches).values({
			drugId: fixture.drug.id,
			expiryDate: getDateFromToday(180),
			quantityAvailable: 12,
			quantityReceived: 12,
			userId: fixture.user.id,
			workspaceId: fixture.workspace.id,
		});

		const rows = await getInventorySummaryRows({
			lowStockThreshold: fixture.workspace.lowStockThreshold,
			nearExpiryDays: fixture.workspace.nearExpiryDays,
			search,
			timezone: fixture.workspace.timezone,
			workspaceId: fixture.workspace.id,
		});

		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({
			drugId: fixture.drug.id,
			nearestBatch: { quantityAvailable: 12 },
			totalAvailable: 12,
		});
		expect(rows.some((row) => row.drugId === otherFixture.drug.id)).toBe(false);
	}
);

test("Inventory search integration - returns no rows for an unmatched search", async () => {
	await using fixture = await createInventoryFixture();
	const rows = await getInventorySummaryRows({
		lowStockThreshold: fixture.workspace.lowStockThreshold,
		nearExpiryDays: fixture.workspace.nearExpiryDays,
		search: "unmatched-inventory-search",
		timezone: fixture.workspace.timezone,
		workspaceId: fixture.workspace.id,
	});

	expect(rows).toEqual([]);
});

test("Stock transaction integration - records a repeated transaction only once", async () => {
	await using fixture = await createInventoryFixture();
	const idempotencyKey = randomUUID();
	const body = {
		batchNumber: "BATCH-IDEMPOTENT",
		drugId: fixture.drug.id,
		expiryDate: getDateFromToday(180),
		logType: "stock_in" as const,
		quantity: 20,
	};
	const options = {
		body,
		idempotencyKey,
		timezone: fixture.workspace.timezone,
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

test("Stock transaction integration - records stock quantities without pricing", async () => {
	await using fixture = await createInventoryFixture();

	await createInventoryStockLog({
		body: {
			drugId: fixture.drug.id,
			expiryDate: getDateFromToday(180),
			logType: "stock_in",
			quantity: 20,
		},
		idempotencyKey: randomUUID(),
		timezone: fixture.workspace.timezone,
		userId: fixture.user.id,
		workspaceId: fixture.workspace.id,
	});

	const [batch] = await db
		.select()
		.from(stockBatches)
		.where(eq(stockBatches.workspaceId, fixture.workspace.id));
	const [log] = await db.select().from(stockLogs).where(eq(stockLogs.workspaceId, fixture.workspace.id));
	const [summary] = await getInventorySummaryRows({
		lowStockThreshold: fixture.workspace.lowStockThreshold,
		nearExpiryDays: fixture.workspace.nearExpiryDays,
		timezone: fixture.workspace.timezone,
		workspaceId: fixture.workspace.id,
	});

	expect(batch?.quantityAvailable).toBe(20);
	expect(log?.quantity).toBe(20);
	expect(summary?.totalAvailable).toBe(20);
	expect(summary?.usableBatchCount).toBe(1);
});

test("Stock receipt integration - merges receipts with the same batch attributes", async () => {
	await using fixture = await createInventoryFixture();
	const expiryDate = getDateFromToday(180);
	const createReceipt = (quantity: number) =>
		createInventoryStockLog({
			body: {
				batchNumber: "BATCH-SAME",
				drugId: fixture.drug.id,
				expiryDate,
				logType: "stock_in",
				quantity,
			},
			idempotencyKey: randomUUID(),
			timezone: fixture.workspace.timezone,
			userId: fixture.user.id,
			workspaceId: fixture.workspace.id,
		});

	await createReceipt(10);
	await createReceipt(5);

	const batches = await db.select().from(stockBatches).where(eq(stockBatches.drugId, fixture.drug.id));

	expect(batches).toHaveLength(1);
	expect(batches[0]).toMatchObject({ quantityAvailable: 15, quantityReceived: 15 });
});

test("Stock receipt integration - separates receipts with different expiry dates", async () => {
	await using fixture = await createInventoryFixture();
	const createReceipt = (days: number) =>
		createInventoryStockLog({
			body: {
				batchNumber: "BATCH-DIFFERENT-EXPIRY",
				drugId: fixture.drug.id,
				expiryDate: getDateFromToday(days),
				logType: "stock_in",
				quantity: 5,
			},
			idempotencyKey: randomUUID(),
			timezone: fixture.workspace.timezone,
			userId: fixture.user.id,
			workspaceId: fixture.workspace.id,
		});

	await createReceipt(10);
	await createReceipt(12);
	await createReceipt(14);

	const batches = await db
		.select()
		.from(stockBatches)
		.where(eq(stockBatches.drugId, fixture.drug.id))
		.orderBy(asc(stockBatches.expiryDate));

	expect(batches).toHaveLength(3);
	expect(batches.map((batch) => batch.expiryDate)).toEqual(
		[10, 12, 14].map((days) => getDateFromToday(days))
	);
});

test("FEFO integration - deducts persisted batches from earliest expiry first", async () => {
	await using fixture = await createInventoryFixture();
	const firstExpiryDate = getDateFromToday(30);
	const secondExpiryDate = getDateFromToday(90);

	await createInventoryStockLog({
		body: {
			batchNumber: "BATCH-EARLY",
			drugId: fixture.drug.id,
			expiryDate: firstExpiryDate,
			logType: "stock_in",
			quantity: 4,
		},
		idempotencyKey: randomUUID(),
		timezone: fixture.workspace.timezone,
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
		},
		idempotencyKey: randomUUID(),
		timezone: fixture.workspace.timezone,
		userId: fixture.user.id,
		workspaceId: fixture.workspace.id,
	});

	const [summaryBeforeDispense] = await getInventorySummaryRows({
		lowStockThreshold: fixture.workspace.lowStockThreshold,
		nearExpiryDays: fixture.workspace.nearExpiryDays,
		timezone: fixture.workspace.timezone,
		workspaceId: fixture.workspace.id,
	});

	expect(summaryBeforeDispense).toMatchObject({
		nearestBatch: {
			batchNumber: "BATCH-EARLY",
			expiryDate: firstExpiryDate,
			quantityAvailable: 4,
		},
		usableBatchCount: 2,
		usableExpiryDateCount: 2,
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
		timezone: fixture.workspace.timezone,
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
		.select({ quantity: stockLogs.quantity, stockTransactionId: stockLogs.stockTransactionId })
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

	const activity = await getInventoryActivity({
		query: undefined,
		workspaceId: fixture.workspace.id,
	});
	const stockOutActivity = activity.rows.find(
		(row) => row.stockTransactionId === stockOutLogs[0]?.stockTransactionId
	);

	expect(stockOutActivity).toMatchObject({ batchCount: 2, quantity: 7 });
});

test("Inventory state integration - reports overlapping stock and expiry conditions", async () => {
	await using fixture = await createInventoryFixture({ lowStockThreshold: 10, nearExpiryDays: 30 });

	await createInventoryStockLog({
		body: {
			batchNumber: "BATCH-NEAR",
			drugId: fixture.drug.id,
			expiryDate: getDateFromToday(10),
			logType: "stock_in",
			quantity: 5,
		},
		idempotencyKey: randomUUID(),
		timezone: fixture.workspace.timezone,
		userId: fixture.user.id,
		workspaceId: fixture.workspace.id,
	});
	await createInventoryStockLog({
		body: {
			batchNumber: "BATCH-AGED",
			drugId: fixture.drug.id,
			expiryDate: getDateFromToday(0),
			logType: "stock_in",
			quantity: 6,
		},
		idempotencyKey: randomUUID(),
		timezone: fixture.workspace.timezone,
		userId: fixture.user.id,
		workspaceId: fixture.workspace.id,
	});
	await db
		.update(stockBatches)
		.set({ expiryDate: getDateFromToday(-1) })
		.where(
			and(
				eq(stockBatches.workspaceId, fixture.workspace.id),
				eq(stockBatches.batchNumber, "BATCH-AGED")
			)
		);

	const [summary] = await getInventorySummaryRows({
		lowStockThreshold: fixture.workspace.lowStockThreshold,
		nearExpiryDays: fixture.workspace.nearExpiryDays,
		timezone: fixture.workspace.timezone,
		workspaceId: fixture.workspace.id,
	});

	expect(summary).toMatchObject({
		expiredBatchCount: 1,
		nearExpiryBatchCount: 1,
		stockStatus: "low_stock",
		totalAvailable: 5,
		usableBatchCount: 1,
		usableExpiryDateCount: 1,
	});
});

test("Expired stock integration - removes only the targeted expired batch", async () => {
	await using fixture = await createInventoryFixture();

	await createInventoryStockLog({
		body: {
			batchNumber: "BATCH-EXPIRED",
			drugId: fixture.drug.id,
			expiryDate: getDateFromToday(0),
			logType: "stock_in",
			quantity: 5,
		},
		idempotencyKey: randomUUID(),
		timezone: fixture.workspace.timezone,
		userId: fixture.user.id,
		workspaceId: fixture.workspace.id,
	});
	await createInventoryStockLog({
		body: {
			batchNumber: "BATCH-VALID",
			drugId: fixture.drug.id,
			expiryDate: getDateFromToday(90),
			logType: "stock_in",
			quantity: 8,
		},
		idempotencyKey: randomUUID(),
		timezone: fixture.workspace.timezone,
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

	if (!expiredBatch) {
		throw new Error("Expected an expired stock batch");
	}

	await db
		.update(stockBatches)
		.set({ expiryDate: getDateFromToday(-30) })
		.where(eq(stockBatches.id, expiredBatch.id));

	await createInventoryStockLog({
		body: {
			batchId: expiredBatch.id,
			drugId: fixture.drug.id,
			logType: "stock_out",
			quantity: 5,
			reason: "expired",
		},
		idempotencyKey: randomUUID(),
		timezone: fixture.workspace.timezone,
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
			expiryDate: getDateFromToday(0),
			logType: "stock_in",
			quantity: 6,
		},
		idempotencyKey: randomUUID(),
		timezone: fixture.workspace.timezone,
		userId: fixture.user.id,
		workspaceId: fixture.workspace.id,
	});

	const [expiredBatch] = await db
		.select()
		.from(stockBatches)
		.where(eq(stockBatches.workspaceId, fixture.workspace.id));

	if (!expiredBatch) {
		throw new Error("Expected an expired stock batch");
	}

	await db
		.update(stockBatches)
		.set({ expiryDate: getDateFromToday(-30) })
		.where(eq(stockBatches.id, expiredBatch.id));

	await createInventoryStockLog({
		body: {
			batchId: expiredBatch.id,
			drugId: fixture.drug.id,
			logType: "stock_out",
			quantity: 4,
			reason: "expired",
		},
		idempotencyKey: randomUUID(),
		timezone: fixture.workspace.timezone,
		userId: fixture.user.id,
		workspaceId: fixture.workspace.id,
	});

	const report = await getInventoryActivity({
		query: undefined,
		workspaceId: fixture.workspace.id,
	});

	expect(report.stats).toEqual({
		expiredLossQuantity: 4,
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
			expiryDate: getDateFromToday(90),
			logType: "stock_in",
			quantity: 5,
		},
		idempotencyKey: randomUUID(),
		timezone: fixture.workspace.timezone,
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
		timezone: fixture.workspace.timezone,
		userId: fixture.user.id,
		workspaceId: fixture.workspace.id,
	});

	await expect(stockOut).rejects.toEqual(
		expect.objectContaining<Partial<AppError>>({
			message: "Only 5 units are available",
			statusCode: 409,
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

	const result = createInventoryStockLog({
		body: {
			drugId: firstFixture.drug.id,
			expiryDate: getDateFromToday(90),
			logType: "stock_in",
			quantity: 1,
		},
		idempotencyKey: randomUUID(),
		timezone: secondFixture.workspace.timezone,
		userId: secondFixture.user.id,
		workspaceId: secondFixture.workspace.id,
	});

	await expect(result).rejects.toEqual(
		expect.objectContaining<Partial<AppError>>({
			message: "Drug not found",
			statusCode: 404,
		})
	);
});

test("Drug lifecycle integration - blocks deactivation until all stock is removed", async () => {
	await using fixture = await createInventoryFixture();

	await createInventoryStockLog({
		body: {
			batchNumber: "BATCH-DEACTIVATION",
			drugId: fixture.drug.id,
			expiryDate: getDateFromToday(90),
			logType: "stock_in",
			quantity: 2,
		},
		idempotencyKey: randomUUID(),
		timezone: fixture.workspace.timezone,
		userId: fixture.user.id,
		workspaceId: fixture.workspace.id,
	});

	await expect(
		handleDrugAction({
			action: "deactivate",
			drugId: fixture.drug.id,
			workspaceId: fixture.workspace.id,
		})
	).rejects.toEqual(expect.objectContaining<Partial<AppError>>({ statusCode: 409 }));

	await createInventoryStockLog({
		body: {
			drugId: fixture.drug.id,
			logType: "stock_out",
			quantity: 2,
			reason: "patient",
		},
		idempotencyKey: randomUUID(),
		timezone: fixture.workspace.timezone,
		userId: fixture.user.id,
		workspaceId: fixture.workspace.id,
	});

	const deactivatedDrug = await handleDrugAction({
		action: "deactivate",
		drugId: fixture.drug.id,
		workspaceId: fixture.workspace.id,
	});

	expect(deactivatedDrug.isActive).toBe(false);
});

test("Alert lifecycle integration - deduplicates, resolves, and reactivates low-stock alerts", async () => {
	await using fixture = await createInventoryFixture({ lowStockThreshold: 10 });
	const syncAlerts = () =>
		syncInventoryAlerts({
			lowStockThreshold: fixture.workspace.lowStockThreshold,
			nearExpiryDays: fixture.workspace.nearExpiryDays,
			timezone: fixture.workspace.timezone,
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
			expiryDate: getDateFromToday(180),
			logType: "stock_in",
			quantity: 20,
		},
		idempotencyKey: randomUUID(),
		timezone: fixture.workspace.timezone,
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
		timezone: fixture.workspace.timezone,
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

test.each([
	{ emailAlertsEnabled: false, expectedOutboxCount: 0, policy: "critical_immediate" as const },
	{ emailAlertsEnabled: true, expectedOutboxCount: 0, policy: "digest_only" as const },
	{ emailAlertsEnabled: true, expectedOutboxCount: 1, policy: "critical_immediate" as const },
	{ emailAlertsEnabled: true, expectedOutboxCount: 1, policy: "all_immediate" as const },
])(
	"Alert delivery integration - persists low-stock alerts with $policy policy",
	async ({ emailAlertsEnabled, expectedOutboxCount, policy }) => {
		await using fixture = await createInventoryFixture({
			emailAlertDeliveryPolicy: policy,
			emailAlertsEnabled,
		});

		await syncInventoryAlerts({
			lowStockThreshold: fixture.workspace.lowStockThreshold,
			nearExpiryDays: fixture.workspace.nearExpiryDays,
			timezone: fixture.workspace.timezone,
			workspaceId: fixture.workspace.id,
		});

		const [alerts, outboxRecords] = await Promise.all([
			db.select().from(inventoryAlerts).where(eq(inventoryAlerts.workspaceId, fixture.workspace.id)),
			db
				.select()
				.from(inventoryAlertOutbox)
				.where(eq(inventoryAlertOutbox.workspaceId, fixture.workspace.id)),
		]);

		expect(alerts).toHaveLength(1);
		expect(alerts[0]?.type).toBe("low_stock");
		expect(outboxRecords).toHaveLength(expectedOutboxCount);
	}
);

test.each([
	{ expectedOutboxCount: 0, policy: "critical_immediate" as const },
	{ expectedOutboxCount: 1, policy: "all_immediate" as const },
])(
	"Alert delivery integration - handles near-expiry alerts with $policy policy",
	async ({ expectedOutboxCount, policy }) => {
		await using fixture = await createInventoryFixture({ emailAlertDeliveryPolicy: policy });

		await createInventoryStockLog({
			body: {
				batchNumber: "BATCH-NEAR-EXPIRY",
				drugId: fixture.drug.id,
				expiryDate: getDateFromToday(30),
				logType: "stock_in",
				quantity: 20,
			},
			idempotencyKey: randomUUID(),
			timezone: fixture.workspace.timezone,
			userId: fixture.user.id,
			workspaceId: fixture.workspace.id,
		});
		await syncInventoryAlerts({
			lowStockThreshold: fixture.workspace.lowStockThreshold,
			nearExpiryDays: fixture.workspace.nearExpiryDays,
			timezone: fixture.workspace.timezone,
			workspaceId: fixture.workspace.id,
		});

		const [alerts, outboxRecords] = await Promise.all([
			db.select().from(inventoryAlerts).where(eq(inventoryAlerts.workspaceId, fixture.workspace.id)),
			db
				.select()
				.from(inventoryAlertOutbox)
				.where(eq(inventoryAlertOutbox.workspaceId, fixture.workspace.id)),
		]);

		expect(alerts).toHaveLength(1);
		expect(alerts[0]?.type).toBe("expiring_soon");
		expect(outboxRecords).toHaveLength(expectedOutboxCount);
	}
);

test("Alert delivery integration - skips pending email after delivery is disabled", async () => {
	await using fixture = await createInventoryFixture();

	await syncInventoryAlerts({
		lowStockThreshold: fixture.workspace.lowStockThreshold,
		nearExpiryDays: fixture.workspace.nearExpiryDays,
		timezone: fixture.workspace.timezone,
		workspaceId: fixture.workspace.id,
	});
	await db
		.update(workspaces)
		.set({ alertEmail: null, emailAlertsEnabledAt: null })
		.where(eq(workspaces.id, fixture.workspace.id));

	await enqueuePendingInventoryAlertEmails();

	const [[alert], [outboxRecord]] = await Promise.all([
		db.select().from(inventoryAlerts).where(eq(inventoryAlerts.workspaceId, fixture.workspace.id)),
		db
			.select()
			.from(inventoryAlertOutbox)
			.where(eq(inventoryAlertOutbox.workspaceId, fixture.workspace.id)),
	]);

	expect(alert?.lastNotifiedAt).toBeNull();
	expect(outboxRecord?.dispatchedAt).toBeInstanceOf(Date);
});

test("Alert delivery integration - skips a pending near-expiry email after policy downgrade", async () => {
	await using fixture = await createInventoryFixture({
		emailAlertDeliveryPolicy: "all_immediate",
	});

	await createInventoryStockLog({
		body: {
			batchNumber: "BATCH-POLICY-DOWNGRADE",
			drugId: fixture.drug.id,
			expiryDate: getDateFromToday(30),
			logType: "stock_in",
			quantity: 20,
		},
		idempotencyKey: randomUUID(),
		timezone: fixture.workspace.timezone,
		userId: fixture.user.id,
		workspaceId: fixture.workspace.id,
	});
	await syncInventoryAlerts({
		lowStockThreshold: fixture.workspace.lowStockThreshold,
		nearExpiryDays: fixture.workspace.nearExpiryDays,
		timezone: fixture.workspace.timezone,
		workspaceId: fixture.workspace.id,
	});
	await db
		.update(workspaces)
		.set({ emailAlertDeliveryPolicy: "critical_immediate" })
		.where(eq(workspaces.id, fixture.workspace.id));

	await enqueuePendingInventoryAlertEmails();

	const [[alert], [outboxRecord]] = await Promise.all([
		db.select().from(inventoryAlerts).where(eq(inventoryAlerts.workspaceId, fixture.workspace.id)),
		db
			.select()
			.from(inventoryAlertOutbox)
			.where(eq(inventoryAlertOutbox.workspaceId, fixture.workspace.id)),
	]);

	expect(alert?.lastNotifiedAt).toBeNull();
	expect(outboxRecord?.dispatchedAt).toBeInstanceOf(Date);
});

test("Alert acknowledgement integration - cannot acknowledge another workspace's alert", async () => {
	await using firstFixture = await createInventoryFixture();
	await using secondFixture = await createInventoryFixture();

	await syncInventoryAlerts({
		lowStockThreshold: firstFixture.workspace.lowStockThreshold,
		nearExpiryDays: firstFixture.workspace.nearExpiryDays,
		timezone: firstFixture.workspace.timezone,
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
