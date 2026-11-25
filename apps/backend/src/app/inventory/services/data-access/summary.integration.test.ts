import { randomUUID } from "node:crypto";
import { db } from "@vitastock/db";
import { stockBatches } from "@vitastock/db/schema/inventory";
import { and, eq } from "drizzle-orm";
import { expect, test } from "vitest";
import { createInventoryFixture, getDateFromToday } from "@/test/inventoryFixture";
import { createInventoryStockLog } from "../stock-log";
import { getInventorySummaryRows } from "./summary";

test.each(["PANADOL", "paracetamol", "500mg", "tablet", "pack"])(
	"Search - matches %s without leaking other workspaces",
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

test("Search - returns no rows for an unmatched search", async () => {
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

test("Stock status - reports overlapping stock and expiry conditions", async () => {
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
