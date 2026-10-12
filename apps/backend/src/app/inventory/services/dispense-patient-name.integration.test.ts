import { randomUUID } from "node:crypto";
import { db } from "@vitastock/db";
import { drugs, stockBatches, stockLogs } from "@vitastock/db/schema/inventory";
import { backendApiSchemaRoutes } from "@vitastock/shared/validation/backendApiSchema";
import { addDays, format } from "date-fns";
import { and, asc, eq } from "drizzle-orm";
import { afterAll, expect, test } from "vitest";
import { createInventoryFixture } from "@/test/inventoryFixture";
import { createInventoryActivityCsv } from "./activity-export";
import { getInventoryActivity, getRecentInventoryActivity } from "./data-access/activity";
import { createInventoryDispenseCart, createInventoryStockLog } from "./stock-log";

afterAll(async () => {
	await db.$client.end();
});

type InventoryFixture = Awaited<ReturnType<typeof createInventoryFixture>>;

const getDateFromToday = (days: number) => format(addDays(new Date(), days), "yyyy-MM-dd");

const receiveTestStock = (options: {
	drugId: string;
	expiresInDays: number;
	fixture: InventoryFixture;
	quantity: number;
}) => {
	const { drugId, expiresInDays, fixture, quantity } = options;

	return createInventoryStockLog({
		body: {
			batchNumber: `BATCH-${expiresInDays}`,
			drugId,
			expiryDate: getDateFromToday(expiresInDays),
			logType: "stock_in",
			quantity,
		},
		idempotencyKey: randomUUID(),
		timezone: fixture.workspace.timezone,
		userId: fixture.user.id,
		workspaceId: fixture.workspace.id,
	});
};

const createSecondTestDrug = async (fixture: InventoryFixture) => {
	const [drug] = await db
		.insert(drugs)
		.values({ genericName: "Amoxicillin", name: "Amoxil", workspaceId: fixture.workspace.id })
		.returning();

	if (!drug) {
		throw new Error("Failed to create second test drug");
	}

	return drug;
};

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

test("Dispense patient name integration - FEFO split writes the same name and transaction on every row", async () => {
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

test("Dispense patient name integration - a multi-patient cart keeps each line's name in one transaction", async () => {
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

test("Dispense patient name integration - reports and exports show a Patient column", async () => {
	await using fixture = await createInventoryFixture();

	await receiveTestStock({ drugId: fixture.drug.id, expiresInDays: 90, fixture, quantity: 20 });
	await createInventoryDispenseCart({
		body: {
			items: [{ drugId: fixture.drug.id, patientName: "Mr. Okon", quantity: 2, reason: "patient" }],
		},
		idempotencyKey: randomUUID(),
		timezone: fixture.workspace.timezone,
		userId: fixture.user.id,
		workspaceId: fixture.workspace.id,
	});

	const searchReport = await getInventoryActivity({
		query: { search: "okon" },
		timezone: fixture.workspace.timezone,
		workspaceId: fixture.workspace.id,
	});
	const activityExport = await createInventoryActivityCsv({
		query: undefined,
		timezone: fixture.workspace.timezone,
		workspaceId: fixture.workspace.id,
	});
	const [header, ...lines] = activityExport.content.replace("\u{FEFF}", "").split("\r\n");
	const patientColumnIndex = header?.split(",").indexOf("Patient") ?? -1;
	const patientCells = lines.map((line) => line.split(",")[patientColumnIndex]);

	expect(searchReport.rows).toEqual([expect.objectContaining({ patientName: "Mr. Okon" })]);
	expect(patientColumnIndex).toBe(6);
	expect(patientCells.toSorted()).toEqual(["Mr. Okon", "—"]);
});

test.each(["damaged", "expired"] as const)(
	"Dispense patient name integration - %s removals never save a patient name",
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

test("Dispense patient name integration - ward dispenses never save a patient name", async () => {
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

test("Dispense patient name integration - the single stock-out endpoint saves a patient name", async () => {
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
