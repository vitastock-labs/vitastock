import { db } from "@vitastock/db";
import { users } from "@vitastock/db/schema/auth";
import { drugs, stockLogs } from "@vitastock/db/schema/inventory";
import type { backendApiSchemaRoutes } from "@vitastock/shared/validation/backendApiSchema";
import { subDays } from "date-fns";
import { and, count, desc, eq, gte, ilike, lt, or, sql, type SQL } from "drizzle-orm";
import type { z } from "zod";
import { AppError } from "@/lib/utils";
import { getWorkspaceDateRange } from "../utils/date";

type InventoryActivityFilters = z.infer<
	NonNullable<(typeof backendApiSchemaRoutes)["@get/inventory/activity/export"]["query"]>
>;
type InventoryActivityQuery = z.infer<
	NonNullable<(typeof backendApiSchemaRoutes)["@get/inventory/activity"]["query"]>
>;

export const INVENTORY_ACTIVITY_EXPORT_MAX_ROWS = 10_000;

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
				form: drugs.form,
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
		.orderBy(desc(sql`min(${stockLogs.createdAt})`), desc(stockLogs.stockTransactionId))
		.limit(limit)
		.offset(offset);
};

const getInventoryActivityWhereConditions = (options: {
	query: InventoryActivityFilters | undefined;
	timezone: string;
	workspaceId: string;
}) => {
	const { query, timezone, workspaceId } = options;
	const dateRange = getWorkspaceDateRange({
		from: query?.from,
		timezone,
		to: query?.to,
	});
	const whereConditions: Array<SQL | undefined> = [eq(stockLogs.workspaceId, workspaceId)];

	if (query?.drugId) {
		whereConditions.push(eq(stockLogs.drugId, query.drugId));
	}

	if (query?.logType) {
		whereConditions.push(eq(stockLogs.logType, query.logType));
	}

	if (query?.search) {
		whereConditions.push(
			or(
				ilike(drugs.genericName, `%${query.search}%`),
				ilike(drugs.name, `%${query.search}%`),
				ilike(drugs.strength, `%${query.search}%`),
				ilike(users.fullName, `%${query.search}%`)
			)
		);
	}

	if (dateRange.from) {
		whereConditions.push(gte(stockLogs.createdAt, dateRange.from));
	}

	if (dateRange.toExclusive) {
		whereConditions.push(lt(stockLogs.createdAt, dateRange.toExclusive));
	}

	return whereConditions;
};

export const getRecentInventoryActivity = (workspaceId: string, limit = 8) => {
	return getLogicalActivityRows({
		limit,
		whereConditions: [eq(stockLogs.workspaceId, workspaceId)],
	});
};

export const getInventoryActivity = async (options: {
	query: InventoryActivityQuery | undefined;
	timezone: string;
	workspaceId: string;
}) => {
	const { query, timezone, workspaceId } = options;
	const page = query?.page ?? 1;
	const pageSize = query?.pageSize ?? 20;
	const whereConditions = getInventoryActivityWhereConditions({ query, timezone, workspaceId });
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

export const getInventoryActivityExportRows = async (options: {
	query: InventoryActivityFilters | undefined;
	timezone: string;
	workspaceId: string;
}) => {
	const { query, timezone, workspaceId } = options;
	const rows = await getLogicalActivityRows({
		limit: INVENTORY_ACTIVITY_EXPORT_MAX_ROWS + 1,
		whereConditions: getInventoryActivityWhereConditions({ query, timezone, workspaceId }),
	});

	if (rows.length > INVENTORY_ACTIVITY_EXPORT_MAX_ROWS) {
		throw new AppError({
			code: 422,
			message:
				"This report contains more than 10,000 movements. Narrow the report filters and try again.",
		});
	}

	return rows;
};
