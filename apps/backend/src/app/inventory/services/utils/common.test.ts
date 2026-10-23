import { expect, test } from "vitest";
import { getInventoryStatus, getInventorySummaryStats } from "./common";

test("getInventoryStatus - reports zero usable quantity as out of stock", () => {
	expect(getInventoryStatus({ lowStockThreshold: 10, totalAvailable: 0 })).toBe("out_of_stock");
});

test("getInventoryStatus - reports usable quantity at the threshold as low stock", () => {
	expect(getInventoryStatus({ lowStockThreshold: 10, totalAvailable: 10 })).toBe("low_stock");
});

test("getInventoryStatus - reports usable quantity above the threshold as normal", () => {
	expect(getInventoryStatus({ lowStockThreshold: 10, totalAvailable: 11 })).toBe("normal");
});

test("getInventorySummaryStats - inventory counts medicines with usable stock without summing different units", () => {
	const stats = getInventorySummaryStats([
		{ expiredBatchCount: 0, nearExpiryBatchCount: 0, stockStatus: "normal", totalAvailable: 500 },
		{ expiredBatchCount: 1, nearExpiryBatchCount: 1, stockStatus: "low_stock", totalAvailable: 2 },
		{ expiredBatchCount: 1, nearExpiryBatchCount: 0, stockStatus: "out_of_stock", totalAvailable: 0 },
	]);

	expect(stats).toEqual({
		criticalCount: 2,
		drugsInStockCount: 2,
		expiredCount: 2,
		expiringSoonCount: 1,
		lowStockCount: 2,
	});
});
