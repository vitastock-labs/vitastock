import { INVENTORY_STATUS } from "@vitastock/db/schema/inventory";

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

type InventoryStatus = (typeof INVENTORY_STATUS)[number];

export const getInventoryStatus = (options: {
	hasExpiredStock: boolean;
	lowStockThreshold: number;
	totalAvailable: number;
}): InventoryStatus => {
	const { hasExpiredStock, lowStockThreshold, totalAvailable } = options;

	if (totalAvailable <= 0) return hasExpiredStock ? "expired" : "out_of_stock";

	if (totalAvailable <= lowStockThreshold) return "low_stock";

	return "normal";
};

const alertOutboxMaxAttempts = 5;
const maximumAlertRetryDelayMs = 60 * 60 * 1000;

export const getAlertOutboxRetry = (attemptCount: number) => {
	const nextAttemptCount = attemptCount + 1;
	const hasExhaustedRetries = nextAttemptCount >= alertOutboxMaxAttempts;
	const retryDelayMs = Math.min(
		60_000 * 2 ** (nextAttemptCount - 1),
		maximumAlertRetryDelayMs
	);

	return { hasExhaustedRetries, nextAttemptCount, retryDelayMs };
};
