import { expect, test } from "vitest";
import { getInventorySummaryStats } from "./utils/common";

test("inventory counts medicines with usable stock without summing different units", () => {
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
