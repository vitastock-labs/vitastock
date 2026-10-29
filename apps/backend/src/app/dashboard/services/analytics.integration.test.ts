import { randomUUID } from "node:crypto";
import { expect, test } from "vitest";
import { getWorkspaceDrugBatches } from "@/app/inventory/services/data-access/batches";
import { updateDrug } from "@/app/inventory/services/data-access/drugs";
import {
	createInventoryDispenseCart,
	createInventoryStockLog,
	undoInventoryDispense,
} from "@/app/inventory/services/stock-log";
import { getWorkspaceToday } from "@/app/inventory/services/utils/date";
import { createInventoryFixture, getDateFromToday, type InventoryFixture } from "@/test/inventoryFixture";
import { getDashboardAnalytics } from "./analytics";

const receiveStock = (
	fixture: InventoryFixture,
	options: { costPrice?: number; expiresInDays: number; quantity: number }
) => {
	return createInventoryStockLog({
		body: {
			batchNumber: `BATCH-${options.expiresInDays}-${options.costPrice ?? "none"}`,
			costPrice: options.costPrice,
			drugId: fixture.drug.id,
			expiryDate: getDateFromToday(options.expiresInDays),
			logType: "stock_in",
			quantity: options.quantity,
		},
		idempotencyKey: randomUUID(),
		timezone: fixture.workspace.timezone,
		userId: fixture.user.id,
		workspaceId: fixture.workspace.id,
	});
};

const dispense = (
	fixture: InventoryFixture,
	body: Omit<Parameters<typeof createInventoryDispenseCart>[0]["body"], "items"> & { quantity: number }
) => {
	const { quantity, ...sale } = body;

	return createInventoryDispenseCart({
		body: { items: [{ drugId: fixture.drug.id, quantity, reason: "patient" }], ...sale },
		idempotencyKey: randomUUID(),
		timezone: fixture.workspace.timezone,
		userId: fixture.user.id,
		workspaceId: fixture.workspace.id,
	});
};

const getTodaysOverview = (fixture: InventoryFixture) => {
	const today = getWorkspaceToday(fixture.workspace.timezone);

	return getDashboardAnalytics({
		from: today,
		timezone: fixture.workspace.timezone,
		to: today,
		workspaceId: fixture.workspace.id,
	});
};

const getOnlyBatchId = async (fixture: InventoryFixture) => {
	const [batch] = await getWorkspaceDrugBatches({
		availability: "all",
		drugId: fixture.drug.id,
		timezone: fixture.workspace.timezone,
		workspaceId: fixture.workspace.id,
	});

	if (!batch) {
		throw new Error("Expected a received batch");
	}

	return batch.id;
};

test("Analytics - works out sales, cost and profit from the prices saved on each sale", async () => {
	await using fixture = await createInventoryFixture();

	await receiveStock(fixture, { costPrice: 100, expiresInDays: 30, quantity: 10 });
	await receiveStock(fixture, { costPrice: 120, expiresInDays: 90, quantity: 10 });
	await updateDrug({
		drugId: fixture.drug.id,
		retailPrice: 200,
		userId: fixture.user.id,
		wholesalePrice: 150,
		workspaceId: fixture.workspace.id,
	});

	// == 12 retail: 10 from the ₦100 batch and 2 from the ₦120 batch, sold at ₦200
	await dispense(fixture, { paymentMethod: "cash", quantity: 12, saleType: "retail" });
	// == 4 wholesale from the ₦120 batch, sold at ₦150
	await dispense(fixture, { paymentMethod: "transfer", quantity: 4, saleType: "wholesale" });
	const undone = await dispense(fixture, { quantity: 1, saleType: "retail" });

	await undoInventoryDispense({
		stockTransactionId: undone.stockTransactionId,
		userId: fixture.user.id,
		workspaceId: fixture.workspace.id,
	});

	const overview = await getTodaysOverview(fixture);

	// == Sales 12×200 + 4×150 = 3000; cost 10×100 + 2×120 + 4×120 = 1720; profit 1280
	expect(overview.totals.current).toMatchObject({
		costOfSales: 1720,
		profit: 1280,
		saleCount: 2,
		sales: 3000,
		uncostedSaleLineCount: 0,
		unpricedSaleLineCount: 0,
	});
	expect(overview.totals.current.profitPercent).toBeCloseTo(42.67, 2);
	expect(overview.salesBySaleType).toEqual(
		expect.arrayContaining([
			{ sales: 2400, saleType: "retail" },
			{ sales: 600, saleType: "wholesale" },
		])
	);
	expect(overview.salesByPaymentMethod).toEqual(
		expect.arrayContaining([
			{ paymentMethod: "cash", sales: 2400 },
			{ paymentMethod: "transfer", sales: 600 },
		])
	);
	expect(overview.staffActivity).toEqual([
		expect.objectContaining({ dispenseCount: 2, removalCount: 0, sales: 3000, undoCount: 1 }),
	]);
	// == 4 units left in the ₦120 batch
	expect(overview.moneyInStock.total).toBe(480);
});

test("Analytics - sales without a cost count in sales but not in profit", async () => {
	await using fixture = await createInventoryFixture();

	await receiveStock(fixture, { expiresInDays: 90, quantity: 10 });
	await updateDrug({
		drugId: fixture.drug.id,
		retailPrice: 200,
		userId: fixture.user.id,
		workspaceId: fixture.workspace.id,
	});
	await dispense(fixture, { quantity: 3, saleType: "retail" });

	const overview = await getTodaysOverview(fixture);

	expect(overview.totals.current).toMatchObject({
		costOfSales: 0,
		profit: 0,
		profitPercent: null,
		sales: 600,
		uncostedSaleLineCount: 1,
	});
	expect(overview.moneyInStock.uncostedBatchCount).toBe(1);
});

test("Analytics - damaged and expired removals are losses, never sales", async () => {
	await using fixture = await createInventoryFixture();

	await receiveStock(fixture, { costPrice: 100, expiresInDays: 90, quantity: 10 });

	await createInventoryStockLog({
		body: {
			batchId: await getOnlyBatchId(fixture),
			drugId: fixture.drug.id,
			logType: "stock_out",
			quantity: 2,
			reason: "damaged",
		},
		idempotencyKey: randomUUID(),
		timezone: fixture.workspace.timezone,
		userId: fixture.user.id,
		workspaceId: fixture.workspace.id,
	});

	const overview = await getTodaysOverview(fixture);

	expect(overview.totals.current.sales).toBe(0);
	expect(overview.losses).toEqual([
		expect.objectContaining({ quantity: 2, reason: "damaged", value: 200 }),
	]);
	expect(overview.staffActivity).toEqual([
		expect.objectContaining({ dispenseCount: 0, removalCount: 1 }),
	]);
});

test("Analytics - drugs without a retail price are counted as prices missing", async () => {
	await using fixture = await createInventoryFixture();

	const overview = await getTodaysOverview(fixture);

	expect(overview.pricesMissingDrugCount).toBe(1);
	expect(overview.previousPeriod).toEqual({
		from: getDateFromToday(-1),
		to: getDateFromToday(-1),
	});
});
