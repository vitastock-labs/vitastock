import { randomUUID } from "node:crypto";
import { expect, test } from "vitest";
import { AppError } from "@/lib/utils";
import { assertCanRecordStockLog, getInventoryStatus, getInventorySummaryStats } from "./common";

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

const drugId = randomUUID();

test("Stock-log permissions - pharmacists can dispense to a patient", () => {
	expect(() =>
		assertCanRecordStockLog({
			body: { drugId, logType: "stock_out", quantity: 2, reason: "patient" },
			role: "pharmacist",
		})
	).not.toThrow();
});

test.each([
	{ batchNumber: "B-1", drugId, expiryDate: "2030-12-31", logType: "stock_in" as const, quantity: 5 },
	{
		batchNumber: "B-1",
		drugId,
		expiryDate: "2030-12-31",
		logType: "opening_stock" as const,
		quantity: 5,
	},
	{
		batchId: randomUUID(),
		drugId,
		logType: "stock_out" as const,
		quantity: 2,
		reason: "damaged" as const,
	},
	{
		batchId: randomUUID(),
		drugId,
		logType: "stock_out" as const,
		quantity: 2,
		reason: "expired" as const,
	},
])("Stock-log permissions - pharmacists cannot record $logType $reason", (body) => {
	expect(() => assertCanRecordStockLog({ body, role: "pharmacist" })).toThrow(
		expect.objectContaining<Partial<AppError>>({ statusCode: 403 })
	);
});

test.each(["owner", "admin"] as const)("Stock-log permissions - %s can stock in", (role) => {
	expect(() =>
		assertCanRecordStockLog({
			body: { drugId, expiryDate: "2030-12-31", logType: "stock_in", quantity: 5 },
			role,
		})
	).not.toThrow();
});
