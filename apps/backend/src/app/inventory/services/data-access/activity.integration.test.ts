import { randomUUID } from "node:crypto";
import { db } from "@vitastock/db";
import { stockBatches } from "@vitastock/db/schema/inventory";
import { eq } from "drizzle-orm";
import { expect, test } from "vitest";
import { createInventoryFixture, getDateFromToday, receiveTestStock } from "@/test/inventoryFixture";
import { createInventoryActivityCsv } from "../activity-export";
import { createInventoryDispenseCart, createInventoryStockLog } from "../stock-log";
import { getInventoryActivity } from "./activity";

test("Reports - calculates weekly movement and expiry loss totals", async () => {
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
		timezone: fixture.workspace.timezone,
		workspaceId: fixture.workspace.id,
	});

	expect(report.stats).toEqual({
		expiredLossQuantity: 4,
		weeklyMovementCount: 2,
		weeklyStockInQuantity: 6,
		weeklyStockOutQuantity: 4,
	});
});

test("Reports - reports and exports show a Patient column", async () => {
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
