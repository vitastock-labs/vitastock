import { expect, test } from "vitest";
import { getInventoryStatus } from "./common";

test("Inventory status - reports zero usable quantity as out of stock", () => {
	expect(getInventoryStatus({ lowStockThreshold: 10, totalAvailable: 0 })).toBe("out_of_stock");
});

test("Inventory status - reports usable quantity at the threshold as low stock", () => {
	expect(getInventoryStatus({ lowStockThreshold: 10, totalAvailable: 10 })).toBe("low_stock");
});

test("Inventory status - reports usable quantity above the threshold as normal", () => {
	expect(getInventoryStatus({ lowStockThreshold: 10, totalAvailable: 11 })).toBe("normal");
});
