import { db } from "@vitastock/db";
import { drugs, stockBatches } from "@vitastock/db/schema/inventory";
import { and, asc, eq, gt, gte, ilike, or, sql } from "drizzle-orm";
import { getInventoryStatus } from "../utils/common";
import { getWorkspaceInventoryDates } from "../utils/date";

export const getInventorySummaryRows = async (options: {
	lowStockThreshold: number;
	nearExpiryDays: number;
	search?: string;
	timezone: string;
	workspaceId: string;
}) => {
	const { lowStockThreshold, nearExpiryDays, search, timezone, workspaceId } = options;
	const { nearExpiryDate, today } = getWorkspaceInventoryDates({ nearExpiryDays, timezone });
	const drugFilter = and(
		eq(drugs.workspaceId, workspaceId),
		search ?
			or(
				ilike(drugs.name, `%${search}%`),
				ilike(drugs.genericName, `%${search}%`),
				ilike(drugs.strength, `%${search}%`),
				ilike(drugs.form, `%${search}%`),
				ilike(drugs.unit, `%${search}%`)
			)
		:	undefined
	);

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
				nearExpiryBatchCount: sql<number>`
					count(${stockBatches.id}) filter (
						where ${stockBatches.quantityAvailable} > 0
						and ${stockBatches.expiryDate} >= ${today}
						and ${stockBatches.expiryDate} <= ${nearExpiryDate}
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
			.where(drugFilter)
			.groupBy(drugs.id)
			.orderBy(asc(drugs.name), asc(drugs.strength)),
		db
			.selectDistinctOn([stockBatches.drugId], {
				batchNumber: stockBatches.batchNumber,
				drugId: stockBatches.drugId,
				expiryDate: stockBatches.expiryDate,
				id: stockBatches.id,
				quantityAvailable: stockBatches.quantityAvailable,
			})
			.from(stockBatches)
			.innerJoin(drugs, eq(drugs.id, stockBatches.drugId))
			.where(
				and(
					drugFilter,
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

	const nearestBatchByDrugId = new Map(nearestBatchRows.map((batch) => [batch.drugId, batch]));

	return aggregatedRows.map((row) => ({
		drug: row.drug,
		drugId: row.drugId,
		expiredBatchCount: row.expiredBatchCount,
		nearestBatch: nearestBatchByDrugId.get(row.drugId),
		nearestExpiryDate: nearestBatchByDrugId.get(row.drugId)?.expiryDate,
		nearExpiryBatchCount: row.nearExpiryBatchCount,
		stockStatus: getInventoryStatus({
			lowStockThreshold,
			totalAvailable: row.totalAvailable,
		}),
		totalAvailable: row.totalAvailable,
		usableBatchCount: row.usableBatchCount,
		usableExpiryDateCount: row.usableExpiryDateCount,
	}));
};
