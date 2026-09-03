import { db } from "@vitastock/db";
import { users } from "@vitastock/db/schema/auth";
import { drugs, stockLogs } from "@vitastock/db/schema/inventory";
import type { backendApiSchemaRoutes } from "@vitastock/shared/validation/backendApiSchema";
import { subDays } from "date-fns";
import { and, count, desc, eq, gte, ilike, or, sql, type SQL } from "drizzle-orm";
import type { z } from "zod";

type InventoryActivityQuery = z.infer<
	NonNullable<(typeof backendApiSchemaRoutes)["@get/inventory/activity"]["query"]>
>;

const activityId = sql<string>`
  concat(
    ${stockLogs.stockTransactionId}::text,
    ':',
    ${stockLogs.drugId}::text,
    ':',
    ${stockLogs.logType},
    ':',
    coalesce(${stockLogs.reason}, '')
  )
`;

const logicalMovementCount = sql<number>`
  count(distinct (
    ${stockLogs.stockTransactionId},
    ${stockLogs.drugId},
    ${stockLogs.logType},
    ${stockLogs.reason}
  ))
`.mapWith(Number);

const getLogicalActivityRows = (options: {
	limit: number;
	offset?: number;
	whereConditions: Array<SQL | undefined>;
}) => {
	const { limit, offset = 0, whereConditions } = options;

	return db
		.select({
			batchCount: count(),
			createdAt: sql<Date>`min(${stockLogs.createdAt})`.mapWith(stockLogs.createdAt),
			drug: {
				genericName: drugs.genericName,
				id: drugs.id,
				name: drugs.name,
				strength: drugs.strength,
				unit: drugs.unit,
			},
			id: activityId,
			logType: stockLogs.logType,
			notes: stockLogs.notes,
			person: users.fullName,
			quantity: sql<number>`sum(${stockLogs.quantity})`.mapWith(Number),
			reason: stockLogs.reason,
			stockTransactionId: stockLogs.stockTransactionId,
		})
		.from(stockLogs)
		.innerJoin(drugs, eq(stockLogs.drugId, drugs.id))
		.innerJoin(users, eq(stockLogs.performedByUserId, users.id))
		.where(and(...whereConditions))
		.groupBy(
			stockLogs.stockTransactionId,
			stockLogs.drugId,
			stockLogs.logType,
			stockLogs.reason,
			stockLogs.notes,
			drugs.id,
			users.id
		)
		.orderBy(desc(sql`min(${stockLogs.createdAt})`))
		.limit(limit)
		.offset(offset);
};

export const getRecentInventoryActivity = (workspaceId: string, limit = 8) => {
	return getLogicalActivityRows({
		limit,
		whereConditions: [eq(stockLogs.workspaceId, workspaceId)],
	});
};

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
		getLogicalActivityRows({
			limit: pageSize,
			offset: (page - 1) * pageSize,
			whereConditions,
		}),
		db
			.select({ total: logicalMovementCount })
			.from(stockLogs)
			.innerJoin(drugs, eq(stockLogs.drugId, drugs.id))
			.innerJoin(users, eq(stockLogs.performedByUserId, users.id))
			.where(and(...whereConditions)),
		db
			.select({
				weeklyMovementCount: logicalMovementCount,
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
			weeklyMovementCount: weeklyStats?.weeklyMovementCount ?? 0,
			weeklyStockInQuantity: weeklyStats?.weeklyStockInQuantity ?? 0,
			weeklyStockOutQuantity: weeklyStats?.weeklyStockOutQuantity ?? 0,
		},
	};
};
