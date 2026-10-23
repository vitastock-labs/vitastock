import { INVENTORY_STOCK_STATUS } from "@vitastock/db/schema/inventory";

type FefoBatch = {
	id: string;
	quantityAvailable: number;
};

export const getFefoStockMovements = <Batch extends FefoBatch>(batches: Batch[], quantity: number) => {
	let remainingQuantity = quantity;
	const movements = [];

	for (const batch of batches) {
		if (remainingQuantity <= 0) break;

		const deductedQuantity = Math.min(batch.quantityAvailable, remainingQuantity);
		remainingQuantity -= deductedQuantity;

		movements.push({
			batch,
			nextQuantityAvailable: batch.quantityAvailable - deductedQuantity,
			quantity: deductedQuantity,
		});
	}

	return movements;
};

type InventoryStatus = (typeof INVENTORY_STOCK_STATUS)[number];

export const getInventoryStatus = (options: {
	lowStockThreshold: number;
	totalAvailable: number;
}): InventoryStatus => {
	const { lowStockThreshold, totalAvailable } = options;

	if (totalAvailable <= 0) {
		return "out_of_stock";
	}

	if (totalAvailable <= lowStockThreshold) {
		return "low_stock";
	}

	return "normal";
};

type InventorySummaryStatsRow = {
	expiredBatchCount: number;
	nearExpiryBatchCount: number;
	stockStatus: InventoryStatus;
	totalAvailable: number;
};

export const getInventorySummaryStats = (rows: InventorySummaryStatsRow[]) => {
	const stats = {
		criticalCount: 0,
		drugsInStockCount: 0,
		expiredCount: 0,
		expiringSoonCount: 0,
		lowStockCount: 0,
	};

	for (const row of rows) {
		const hasExpiredStock = row.expiredBatchCount > 0;
		const hasExpiringStock = row.nearExpiryBatchCount > 0;
		const hasLowStock = row.stockStatus !== "normal";

		stats.drugsInStockCount += Number(row.totalAvailable > 0);
		stats.expiredCount += Number(hasExpiredStock);
		stats.expiringSoonCount += Number(hasExpiringStock);
		stats.lowStockCount += Number(hasLowStock);
		stats.criticalCount += Number(hasLowStock || hasExpiredStock || hasExpiringStock);
	}

	return stats;
};
