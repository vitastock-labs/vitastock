import { db } from "@vitastock/db";
import { drugs, stockBatches } from "@vitastock/db/schema/inventory";
import { startOfDay } from "date-fns";
import { and, asc, eq, gt, gte, sql } from "drizzle-orm";
import { AppError } from "@/lib/utils";
import { getInventoryStatus } from "../utils/common";

export const getDrugForStockMovement = async (options: { drugId: string; workspaceId: string }) => {
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

	if (!drug.isActive) {
		throw new AppError({
			code: 400,
			message: "Inactive drugs cannot be used for stock movements",
		});
	}

	return drug;
};

export const getInventorySummaryRows = async (options: {
	lowStockThreshold: number;
	workspaceId: string;
}) => {
	const { lowStockThreshold, workspaceId } = options;
	const today = startOfDay(new Date());

	const [aggregatedRows, nearestBatchRows] = await Promise.all([
		db
			.select({
				drug: {
					form: drugs.form,
					genericName: drugs.genericName,
					id: drugs.id,
					isActive: drugs.isActive,
					name: drugs.name,
					strength: drugs.strength,
					unit: drugs.unit,
				},
				drugId: drugs.id,
				hasExpiredStock: sql<boolean>`
					coalesce(
						bool_or(
							${stockBatches.quantityAvailable} > 0
							and ${stockBatches.expiryDate} < ${today}
						),
						false
					)
				`,
				nearestExpiryDate: sql<Date | null>`
					min(
						case
							when ${stockBatches.quantityAvailable} > 0
							and ${stockBatches.expiryDate} >= ${today}
							then ${stockBatches.expiryDate}
						end
					)
				`,
				stockValueKobo: sql<number>`
					coalesce(
						sum(
							case when ${stockBatches.expiryDate} >= ${today}
							then ${stockBatches.quantityAvailable} * ${stockBatches.unitCostKobo}
							else 0 end
						),
						0
					)
				`.mapWith(Number),
				totalAvailable: sql<number>`
					coalesce(
						sum(
							case when ${stockBatches.expiryDate} >= ${today}
							then ${stockBatches.quantityAvailable}
							else 0 end
						),
						0
					)
				`.mapWith(Number),
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
					gte(stockBatches.expiryDate, today)
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
		hasExpiredStock: row.hasExpiredStock,
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
