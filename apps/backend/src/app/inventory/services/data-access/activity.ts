import { db } from "@vitastock/db";
import { users } from "@vitastock/db/schema/auth";
import { drugs, stockLogs } from "@vitastock/db/schema/inventory";
import type { backendApiSchemaRoutes } from "@vitastock/shared/validation/backendApiSchema";
import { subDays } from "date-fns";
import { and, count, desc, eq, gte, ilike, or, sql } from "drizzle-orm";
import type { z } from "zod";

type InventoryActivityQuery = z.infer<
	NonNullable<(typeof backendApiSchemaRoutes)["@get/inventory/activity"]["query"]>
>;

export const getInventoryActivity = async (options: {
	query: InventoryActivityQuery | undefined;
	workspaceId: string;
}) => {
	const { query, workspaceId } = options;
	const page = query?.page ?? 1;
	const pageSize = query?.pageSize ?? 20;
	const search = query?.search;
	const whereConditions = [
		eq(stockLogs.workspaceId, workspaceId),
		...(query?.logType ? [eq(stockLogs.logType, query.logType)] : []),
		...(search ?
			[
				or(
					ilike(drugs.genericName, `%${search}%`),
					ilike(drugs.name, `%${search}%`),
					ilike(drugs.strength, `%${search}%`),
					ilike(users.fullName, `%${search}%`)
				),
			]
		:	[]),
	];
	const now = new Date();
	const sevenDaysAgo = subDays(now, 7);
	const thirtyDaysAgo = subDays(now, 30);

	const [rows, totalResult, weeklyStatsResult, expiryLossResult] = await Promise.all([
		db
			.select({
				createdAt: stockLogs.createdAt,
				drug: {
					genericName: drugs.genericName,
					id: drugs.id,
					name: drugs.name,
					strength: drugs.strength,
					unit: drugs.unit,
				},
				id: stockLogs.id,
				logType: stockLogs.logType,
				notes: stockLogs.notes,
				person: users.fullName,
				quantity: stockLogs.quantity,
				reason: stockLogs.reason,
				unitCostKobo: stockLogs.unitCostKobo,
			})
			.from(stockLogs)
			.innerJoin(drugs, eq(stockLogs.drugId, drugs.id))
			.innerJoin(users, eq(stockLogs.performedByUserId, users.id))
			.where(and(...whereConditions))
			.orderBy(desc(stockLogs.createdAt))
			.limit(pageSize)
			.offset((page - 1) * pageSize),
		db
			.select({ total: count() })
			.from(stockLogs)
			.innerJoin(drugs, eq(stockLogs.drugId, drugs.id))
			.innerJoin(users, eq(stockLogs.performedByUserId, users.id))
			.where(and(...whereConditions)),
		db
			.select({
				weeklyMovementCount: count(),
				weeklyStockInQuantity: sql<number>`
					coalesce(
						sum(
							case when ${stockLogs.logType} in ('opening_stock', 'stock_in')
							then ${stockLogs.quantity}
							else 0 end
						),
						0
					)
				`.mapWith(Number),
				weeklyStockOutQuantity: sql<number>`
					coalesce(
						sum(
							case when ${stockLogs.logType} = 'stock_out'
							then ${stockLogs.quantity}
							else 0 end
						),
						0
					)
				`.mapWith(Number),
			})
			.from(stockLogs)
			.where(and(eq(stockLogs.workspaceId, workspaceId), gte(stockLogs.createdAt, sevenDaysAgo))),
		db
			.select({
				expiredLossQuantity: sql<number>`coalesce(sum(${stockLogs.quantity}), 0)`.mapWith(Number),
				expiredLossValueKobo: sql<number>`
					coalesce(sum(${stockLogs.quantity} * ${stockLogs.unitCostKobo}), 0)
				`.mapWith(Number),
			})
			.from(stockLogs)
			.where(
				and(
					eq(stockLogs.workspaceId, workspaceId),
					gte(stockLogs.createdAt, thirtyDaysAgo),
					or(eq(stockLogs.logType, "expired"), eq(stockLogs.reason, "expired"))
				)
			),
	]);
	const total = totalResult[0]?.total ?? 0;
	const weeklyStats = weeklyStatsResult[0];
	const expiryLoss = expiryLossResult[0];

	return {
		pagination: {
			page,
			pageCount: Math.ceil(total / pageSize),
			pageSize,
			total,
		},
		rows,
		stats: {
			expiredLossQuantity: expiryLoss?.expiredLossQuantity ?? 0,
			expiredLossValueKobo: expiryLoss?.expiredLossValueKobo ?? 0,
			weeklyMovementCount: weeklyStats?.weeklyMovementCount ?? 0,
			weeklyStockInQuantity: weeklyStats?.weeklyStockInQuantity ?? 0,
			weeklyStockOutQuantity: weeklyStats?.weeklyStockOutQuantity ?? 0,
		},
	};
};
