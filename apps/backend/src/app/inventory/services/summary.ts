import { db } from "@vitastock/db";
import { drugs, INVENTORY_STATUS, stockBatches } from "@vitastock/db/schema/inventory";
import { and, asc, eq, gt, gte, sql } from "drizzle-orm";
import { AppError } from "@/lib/utils";

type InventoryStatus = (typeof INVENTORY_STATUS)[number];

export const getDrugForWorkspace = async (options: { drugId: string; workspaceId: string }) => {
	const { drugId, workspaceId } = options;

	const [drug] = await db
		.select()
		.from(drugs)
		.where(and(eq(drugs.id, drugId), eq(drugs.workspaceId, workspaceId)))
		.limit(1);

	if (!drug) {
		throw new AppError({
			code: 404,
			message: "Drug not found",
		});
	}

	return drug;
};

export const getInventoryStatus = (options: {
	hasExpiredStock: boolean;
	lowStockThreshold: number;
	totalAvailable: number;
}): InventoryStatus => {
	const { hasExpiredStock, lowStockThreshold, totalAvailable } = options;

	if (hasExpiredStock) return "expired";

	if (totalAvailable <= 0) return "out_of_stock";

	if (totalAvailable <= lowStockThreshold) return "low_stock";

	return "normal";
};

export const getInventorySummaryRows = async (options: {
	lowStockThreshold: number;
	workspaceId: string;
}) => {
	const { lowStockThreshold, workspaceId } = options;
	const now = new Date();

	const [aggregatedRows, nearestBatchRows] = await Promise.all([
		db
			.select({
				drug: {
					form: drugs.form,
					id: drugs.id,
					name: drugs.name,
					strength: drugs.strength,
					unit: drugs.unit,
				},
				drugId: drugs.id,
				hasExpiredStock: sql<boolean>`
					coalesce(
						bool_or(
							${stockBatches.quantityAvailable} > 0
							and ${stockBatches.expiryDate} <= ${now}
						),
						false
					)
				`,
				nearestExpiryDate: sql<Date | null>`
					min(
						case
							when ${stockBatches.quantityAvailable} > 0
							and ${stockBatches.expiryDate} >= ${now}
							then ${stockBatches.expiryDate}
						end
					)
				`,
				stockValueKobo: sql<number>`
					coalesce(
						sum(${stockBatches.quantityAvailable} * ${stockBatches.unitCostKobo}),
						0
					)
				`,
				totalAvailable: sql<number>`
					coalesce(sum(${stockBatches.quantityAvailable}), 0)
				`,
			})
			.from(drugs)
			.leftJoin(
				stockBatches,
				and(eq(stockBatches.drugId, drugs.id), eq(stockBatches.workspaceId, workspaceId))
			)
			.where(eq(drugs.workspaceId, workspaceId))
			.groupBy(drugs.id)
			.orderBy(asc(drugs.name), asc(drugs.strength)),
		db
			.select({
				batchNumber: stockBatches.batchNumber,
				drugId: stockBatches.drugId,
				expiryDate: stockBatches.expiryDate,
				id: stockBatches.id,
				quantityAvailable: stockBatches.quantityAvailable,
				unitCostKobo: stockBatches.unitCostKobo,
			})
			.from(stockBatches)
			.where(
				and(
					eq(stockBatches.workspaceId, workspaceId),
					gt(stockBatches.quantityAvailable, 0),
					gte(stockBatches.expiryDate, now)
				)
			)
			.orderBy(asc(stockBatches.drugId), asc(stockBatches.expiryDate)),
	]);

	const nearestBatchByDrugId = new Map<string, (typeof nearestBatchRows)[number]>();

	for (const batch of nearestBatchRows) {
		if (!nearestBatchByDrugId.has(batch.drugId)) {
			nearestBatchByDrugId.set(batch.drugId, batch);
		}
	}

	return aggregatedRows.map((row) => ({
		drug: row.drug,
		drugId: row.drugId,
		nearestBatch: nearestBatchByDrugId.get(row.drugId),
		nearestExpiryDate: row.nearestExpiryDate ?? undefined,
		status: getInventoryStatus({
			hasExpiredStock: row.hasExpiredStock,
			lowStockThreshold,
			totalAvailable: row.totalAvailable,
		}),
		stockValueKobo: row.stockValueKobo,
		totalAvailable: row.totalAvailable,
	}));
};
