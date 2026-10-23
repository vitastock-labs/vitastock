import { randomUUID } from "node:crypto";
import { db } from "@vitastock/db";
import { stockBatches, stockLogs, stockTransactions } from "@vitastock/db/schema/inventory";
import { backendApiSchemaRoutes } from "@vitastock/shared/validation/backendApiSchema";
import { and, asc, eq } from "drizzle-orm";
import { expect, test } from "vitest";
import { AppError } from "@/lib/utils";
import {
	createInventoryFixture,
	createSecondTestDrug,
	getDateFromToday,
	receiveTestStock,
	type InventoryFixture,
} from "@/test/inventoryFixture";
import { createInventoryActivityCsv } from "./activity-export";
import { getInventoryActivity, getRecentInventoryActivity } from "./data-access/activity";
import { getInventorySummaryRows } from "./data-access/summary";
import { createInventoryDispenseCart, createInventoryStockLog } from "./stock-log";
import { getWorkspaceToday } from "./utils/date";

const getStockOutLogs = (fixture: InventoryFixture) => {
	return db
		.select({
			batchId: stockLogs.batchId,
			drugId: stockLogs.drugId,
			patientName: stockLogs.patientName,
			quantity: stockLogs.quantity,
			reason: stockLogs.reason,
			stockTransactionId: stockLogs.stockTransactionId,
		})
		.from(stockLogs)
		.where(and(eq(stockLogs.workspaceId, fixture.workspace.id), eq(stockLogs.logType, "stock_out")))
		.orderBy(asc(stockLogs.createdAt), asc(stockLogs.quantity));
};

test("Stock transactions - records a repeated transaction only once", async () => {
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

test("Stock transactions - records stock quantities without pricing", async () => {
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

test("Stock transactions - rolls back an insufficient stock-out transaction", async () => {
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

test("Stock receipts - merges receipts with the same batch attributes", async () => {
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

test("Stock receipts - separates receipts with different expiry dates", async () => {
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

test("FEFO deduction - deducts persisted batches from earliest expiry first", async () => {
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
		timezone: fixture.workspace.timezone,
		workspaceId: fixture.workspace.id,
	});
	const stockOutActivity = activity.rows.find(
		(row) => row.stockTransactionId === stockOutLogs[0]?.stockTransactionId
	);
	const activityExport = await createInventoryActivityCsv({
		query: {
			drugId: fixture.drug.id,
			from: getWorkspaceToday(fixture.workspace.timezone),
			logType: "stock_out",
			to: getWorkspaceToday(fixture.workspace.timezone),
		},
		timezone: fixture.workspace.timezone,
		workspaceId: fixture.workspace.id,
	});

	expect(stockOutActivity).toMatchObject({ batchCount: 2, quantity: 7 });
	expect(activityExport.filename).toBe(
		`vitastock-stock-movements-${getWorkspaceToday(fixture.workspace.timezone)}-to-${getWorkspaceToday(fixture.workspace.timezone)}.csv`
	);
	expect(activityExport.content).toContain("Timestamp,Drug Name,Generic Name,Strength,Dosage Form");
	expect(activityExport.content).toContain(",Stock Out,Patient,7,2,");
	expect(activityExport.content).toContain(stockOutLogs[0]?.stockTransactionId);
});

test("Stock removal - removes only the targeted expired batch", async () => {
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

test("Dispense cart - deducts every item with FEFO in one transaction", async () => {
	await using fixture = await createInventoryFixture();
	const secondDrug = await createSecondTestDrug(fixture);

	await receiveTestStock({ drugId: fixture.drug.id, expiresInDays: 30, fixture, quantity: 5 });
	await receiveTestStock({ drugId: fixture.drug.id, expiresInDays: 90, fixture, quantity: 10 });
	await receiveTestStock({ drugId: secondDrug.id, expiresInDays: 60, fixture, quantity: 10 });

	await createInventoryDispenseCart({
		body: {
			items: [
				{ drugId: fixture.drug.id, quantity: 8, reason: "patient" },
				{ drugId: secondDrug.id, quantity: 3, reason: "ward" },
			],
		},
		idempotencyKey: randomUUID(),
		timezone: fixture.workspace.timezone,
		userId: fixture.user.id,
		workspaceId: fixture.workspace.id,
	});

	const batches = await db
		.select()
		.from(stockBatches)
		.where(eq(stockBatches.workspaceId, fixture.workspace.id))
		.orderBy(asc(stockBatches.expiryDate));
	const transactions = await db
		.select()
		.from(stockTransactions)
		.where(
			and(
				eq(stockTransactions.workspaceId, fixture.workspace.id),
				eq(stockTransactions.operation, "dispense_cart")
			)
		);
	const report = await getInventoryActivity({
		query: { logType: "stock_out" },
		timezone: fixture.workspace.timezone,
		workspaceId: fixture.workspace.id,
	});

	expect(batches.map((batch) => batch.quantityAvailable)).toEqual([0, 7, 7]);
	expect(transactions).toHaveLength(1);
	expect(report.rows).toHaveLength(2);
	expect(report.rows).toEqual(
		expect.arrayContaining([
			expect.objectContaining({ batchCount: 2, quantity: 8, reason: "patient" }),
			expect.objectContaining({ batchCount: 1, quantity: 3, reason: "ward" }),
		])
	);
});

test("Dispense cart - rolls back every item when one item is short", async () => {
	await using fixture = await createInventoryFixture();
	const secondDrug = await createSecondTestDrug(fixture);

	await receiveTestStock({ drugId: fixture.drug.id, expiresInDays: 90, fixture, quantity: 5 });
	await receiveTestStock({ drugId: secondDrug.id, expiresInDays: 90, fixture, quantity: 10 });

	const idempotencyKey = randomUUID();
	const dispense = createInventoryDispenseCart({
		body: {
			items: [
				{ drugId: secondDrug.id, quantity: 3, reason: "patient" },
				{ drugId: fixture.drug.id, quantity: 6, reason: "patient" },
			],
		},
		idempotencyKey,
		timezone: fixture.workspace.timezone,
		userId: fixture.user.id,
		workspaceId: fixture.workspace.id,
	});

	await expect(dispense).rejects.toEqual(
		expect.objectContaining<Partial<AppError>>({
			errors: { "items.1.quantity": ["Only 5 units are available"] },
			statusCode: 409,
		})
	);

	const batches = await db
		.select()
		.from(stockBatches)
		.where(eq(stockBatches.workspaceId, fixture.workspace.id));
	const transactions = await db
		.select()
		.from(stockTransactions)
		.where(
			and(
				eq(stockTransactions.workspaceId, fixture.workspace.id),
				eq(stockTransactions.idempotencyKey, idempotencyKey)
			)
		);

	expect(batches.map((batch) => batch.quantityAvailable).toSorted()).toEqual([10, 5]);
	expect(transactions).toHaveLength(0);
});

test("Dispense cart - replays a repeated cart only once", async () => {
	await using fixture = await createInventoryFixture();

	await receiveTestStock({ drugId: fixture.drug.id, expiresInDays: 90, fixture, quantity: 10 });

	const options = {
		body: { items: [{ drugId: fixture.drug.id, quantity: 4, reason: "patient" as const }] },
		idempotencyKey: randomUUID(),
		timezone: fixture.workspace.timezone,
		userId: fixture.user.id,
		workspaceId: fixture.workspace.id,
	};

	await createInventoryDispenseCart(options);
	await createInventoryDispenseCart(options);

	await expect(
		createInventoryDispenseCart({
			...options,
			body: { items: [{ drugId: fixture.drug.id, quantity: 5, reason: "patient" }] },
		})
	).rejects.toEqual(expect.objectContaining<Partial<AppError>>({ statusCode: 409 }));

	const [batch] = await db
		.select()
		.from(stockBatches)
		.where(eq(stockBatches.workspaceId, fixture.workspace.id));

	expect(batch?.quantityAvailable).toBe(6);
});

test("Dispense cart - rejects a drug that belongs to another workspace", async () => {
	await using firstFixture = await createInventoryFixture();
	await using secondFixture = await createInventoryFixture();

	const result = createInventoryDispenseCart({
		body: { items: [{ drugId: firstFixture.drug.id, quantity: 1, reason: "patient" }] },
		idempotencyKey: randomUUID(),
		timezone: secondFixture.workspace.timezone,
		userId: secondFixture.user.id,
		workspaceId: secondFixture.workspace.id,
	});

	await expect(result).rejects.toEqual(
		expect.objectContaining<Partial<AppError>>({
			errors: { "items.0.drugId": ["This medication is inactive or no longer exists"] },
			statusCode: 409,
		})
	);
});

test("Workspace isolation - rejects a drug that belongs to another workspace", async () => {
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

test("Patient names - FEFO split writes the same name and transaction on every row", async () => {
	await using fixture = await createInventoryFixture();

	await receiveTestStock({ drugId: fixture.drug.id, expiresInDays: 30, fixture, quantity: 4 });
	await receiveTestStock({ drugId: fixture.drug.id, expiresInDays: 60, fixture, quantity: 3 });
	await receiveTestStock({ drugId: fixture.drug.id, expiresInDays: 90, fixture, quantity: 10 });

	await createInventoryDispenseCart({
		body: {
			items: [{ drugId: fixture.drug.id, patientName: "Mrs. Adebayo", quantity: 9, reason: "patient" }],
		},
		idempotencyKey: randomUUID(),
		timezone: fixture.workspace.timezone,
		userId: fixture.user.id,
		workspaceId: fixture.workspace.id,
	});

	const logs = await getStockOutLogs(fixture);
	const batchIds = new Set(logs.map((log) => log.batchId));
	const transactionIds = new Set(logs.map((log) => log.stockTransactionId));

	expect(logs).toHaveLength(3);
	expect(batchIds.size).toBe(3);
	expect(transactionIds.size).toBe(1);
	expect(logs.every((log) => log.patientName === "Mrs. Adebayo")).toBe(true);
	expect(logs.reduce((total, log) => total + log.quantity, 0)).toBe(9);
});

test("Patient names - a multi-patient cart keeps each line's name in one transaction", async () => {
	await using fixture = await createInventoryFixture();
	const secondDrug = await createSecondTestDrug(fixture);

	await receiveTestStock({ drugId: fixture.drug.id, expiresInDays: 30, fixture, quantity: 15 });
	await receiveTestStock({ drugId: fixture.drug.id, expiresInDays: 90, fixture, quantity: 30 });
	await receiveTestStock({ drugId: secondDrug.id, expiresInDays: 60, fixture, quantity: 30 });

	await createInventoryDispenseCart({
		body: {
			items: [
				{ drugId: fixture.drug.id, patientName: "Mrs. Adebayo", quantity: 10, reason: "patient" },
				{ drugId: secondDrug.id, patientName: "Mrs. Adebayo", quantity: 4, reason: "patient" },
				{ drugId: fixture.drug.id, patientName: "Mr. Okon", quantity: 10, reason: "patient" },
				{ drugId: secondDrug.id, patientName: null, quantity: 6, reason: "patient" },
			],
		},
		idempotencyKey: randomUUID(),
		timezone: fixture.workspace.timezone,
		userId: fixture.user.id,
		workspaceId: fixture.workspace.id,
	});

	const logs = await getStockOutLogs(fixture);
	const report = await getInventoryActivity({
		query: { logType: "stock_out" },
		timezone: fixture.workspace.timezone,
		workspaceId: fixture.workspace.id,
	});
	const recentActivity = await getRecentInventoryActivity(fixture.workspace.id);
	const summarizeRows = (rows: typeof report.rows) => {
		return rows
			.filter((row) => row.logType === "stock_out")
			.map((row) => ({
				batchCount: row.batchCount,
				drugId: row.drug.id,
				patientName: row.patientName,
				quantity: row.quantity,
			}));
	};
	const expectedRows = [
		{ batchCount: 1, drugId: fixture.drug.id, patientName: "Mrs. Adebayo", quantity: 10 },
		{ batchCount: 1, drugId: secondDrug.id, patientName: "Mrs. Adebayo", quantity: 4 },
		{ batchCount: 2, drugId: fixture.drug.id, patientName: "Mr. Okon", quantity: 10 },
		{ batchCount: 1, drugId: secondDrug.id, patientName: null, quantity: 6 },
	];

	expect(new Set(logs.map((log) => log.stockTransactionId)).size).toBe(1);
	expect(report.rows).toHaveLength(4);
	expect(summarizeRows(report.rows)).toEqual(expect.arrayContaining(expectedRows));
	expect(summarizeRows(recentActivity)).toEqual(expect.arrayContaining(expectedRows));
});

test.each(["damaged", "expired"] as const)(
	"Patient names - %s removals never save a patient name",
	async (reason) => {
		await using fixture = await createInventoryFixture();

		await receiveTestStock({ drugId: fixture.drug.id, expiresInDays: 90, fixture, quantity: 10 });

		const [batch] = await db
			.select()
			.from(stockBatches)
			.where(eq(stockBatches.workspaceId, fixture.workspace.id));

		if (!batch) {
			throw new Error("Expected a stock batch");
		}

		if (reason === "expired") {
			await db
				.update(stockBatches)
				.set({ expiryDate: getDateFromToday(-1) })
				.where(eq(stockBatches.id, batch.id));
		}

		const body = backendApiSchemaRoutes["@post/inventory/stock-log"].body.parse({
			batchId: batch.id,
			drugId: fixture.drug.id,
			logType: "stock_out",
			patientName: "Mrs. Adebayo",
			quantity: 3,
			reason,
		});

		await createInventoryStockLog({
			body: { ...body, patientName: "Mrs. Adebayo" } as typeof body,
			idempotencyKey: randomUUID(),
			timezone: fixture.workspace.timezone,
			userId: fixture.user.id,
			workspaceId: fixture.workspace.id,
		});

		const logs = await getStockOutLogs(fixture);

		expect(body).not.toHaveProperty("patientName");
		expect(logs).toEqual([expect.objectContaining({ patientName: null, quantity: 3, reason })]);
	}
);

test("Patient names - ward dispenses never save a patient name", async () => {
	await using fixture = await createInventoryFixture();

	await receiveTestStock({ drugId: fixture.drug.id, expiresInDays: 90, fixture, quantity: 10 });
	await createInventoryDispenseCart({
		body: {
			items: [{ drugId: fixture.drug.id, patientName: "Mrs. Adebayo", quantity: 2, reason: "ward" }],
		},
		idempotencyKey: randomUUID(),
		timezone: fixture.workspace.timezone,
		userId: fixture.user.id,
		workspaceId: fixture.workspace.id,
	});

	const logs = await getStockOutLogs(fixture);

	expect(logs).toEqual([expect.objectContaining({ patientName: null, reason: "ward" })]);
});

test("Patient names - the single stock-out endpoint saves a patient name", async () => {
	await using fixture = await createInventoryFixture();

	await receiveTestStock({ drugId: fixture.drug.id, expiresInDays: 30, fixture, quantity: 2 });
	await receiveTestStock({ drugId: fixture.drug.id, expiresInDays: 90, fixture, quantity: 10 });
	await createInventoryStockLog({
		body: {
			drugId: fixture.drug.id,
			logType: "stock_out",
			patientName: "Mr. Okon",
			quantity: 5,
			reason: "patient",
		},
		idempotencyKey: randomUUID(),
		timezone: fixture.workspace.timezone,
		userId: fixture.user.id,
		workspaceId: fixture.workspace.id,
	});

	const logs = await getStockOutLogs(fixture);

	expect(logs).toHaveLength(2);
	expect(new Set(logs.map((log) => log.stockTransactionId)).size).toBe(1);
	expect(logs.every((log) => log.patientName === "Mr. Okon")).toBe(true);
});
