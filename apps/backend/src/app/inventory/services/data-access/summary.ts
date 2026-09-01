import { db } from "@vitastock/db";
import { drugs, stockBatches } from "@vitastock/db/schema/inventory";
import { and, asc, eq, gt, gte, sql } from "drizzle-orm";
import { getInventoryStatus } from "../utils/common";
import { getWorkspaceInventoryDates } from "../utils/date";

export const getInventorySummaryRows = async (options: {
	lowStockThreshold: number;
	nearExpiryDays: number;
	timezone: string;
	workspaceId: string;
}) => {
	const { lowStockThreshold, nearExpiryDays, timezone, workspaceId } = options;
	const { nearExpiryDate, today } = getWorkspaceInventoryDates({ nearExpiryDays, timezone });

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
				expiredBatchCount: sql<number>`
					count(${stockBatches.id}) filter (
						where ${stockBatches.quantityAvailable} > 0
						and ${stockBatches.expiryDate} < ${today}
					)
				`.mapWith(Number),
				nearestExpiryDate: sql<string | null>`
					min(
						case
							when ${stockBatches.quantityAvailable} > 0
							and ${stockBatches.expiryDate} >= ${today}
							then ${stockBatches.expiryDate}
						end
					)
				`,
				nearExpiryBatchCount: sql<number>`
					count(${stockBatches.id}) filter (
						where ${stockBatches.quantityAvailable} > 0
						and ${stockBatches.expiryDate} >= ${today}
						and ${stockBatches.expiryDate} <= ${nearExpiryDate}
					)
				`.mapWith(Number),
				stockValueKobo: sql<number>`
					coalesce(
						sum(${stockBatches.quantityAvailable} * ${stockBatches.unitCostKobo}) filter (
							where ${stockBatches.quantityAvailable} > 0
							and ${stockBatches.expiryDate} >= ${today}
							and ${stockBatches.unitCostKobo} is not null
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
				uncostedBatchCount: sql<number>`
					count(${stockBatches.id}) filter (
						where ${stockBatches.quantityAvailable} > 0
						and ${stockBatches.expiryDate} >= ${today}
						and ${stockBatches.unitCostKobo} is null
					)
				`.mapWith(Number),
				usableBatchCount: sql<number>`
					count(${stockBatches.id}) filter (
						where ${stockBatches.quantityAvailable} > 0
						and ${stockBatches.expiryDate} >= ${today}
					)
				`.mapWith(Number),
				usableExpiryDateCount: sql<number>`
					count(distinct ${stockBatches.expiryDate}) filter (
						where ${stockBatches.quantityAvailable} > 0
						and ${stockBatches.expiryDate} >= ${today}
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
			.orderBy(
				asc(stockBatches.drugId),
				asc(stockBatches.expiryDate),
				asc(stockBatches.createdAt),
				asc(stockBatches.id)
			),
	]);

	const nearestBatchByDrugId = new Map<string, (typeof nearestBatchRows)[number]>();

	for (const batch of nearestBatchRows) {
		!nearestBatchByDrugId.has(batch.drugId) && nearestBatchByDrugId.set(batch.drugId, batch);
	}

	return aggregatedRows.map((row) => ({
		drug: row.drug,
		drugId: row.drugId,
		expiredBatchCount: row.expiredBatchCount,
		nearestBatch: nearestBatchByDrugId.get(row.drugId),
		nearestExpiryDate: row.nearestExpiryDate ?? undefined,
		nearExpiryBatchCount: row.nearExpiryBatchCount,
		stockStatus: getInventoryStatus({
			lowStockThreshold,
			totalAvailable: row.totalAvailable,
		}),
		stockValueKobo: row.stockValueKobo,
		totalAvailable: row.totalAvailable,
		uncostedBatchCount: row.uncostedBatchCount,
		usableBatchCount: row.usableBatchCount,
		usableExpiryDateCount: row.usableExpiryDateCount,
	}));
};
