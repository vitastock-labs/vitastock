import { db } from "@vitastock/db";
import { users } from "@vitastock/db/schema/auth";
import { drugs, stockBatches, stockLogs } from "@vitastock/db/schema/inventory";
import { backendApiSchemaRoutes } from "@vitastock/shared/validation/backendApiSchema";
import { add, endOfDay, startOfDay } from "date-fns";
import { and, countDistinct, desc, eq, gt, gte, lt, lte } from "drizzle-orm";
import { Hono } from "hono";
import { AppJsonResponse } from "@/lib/utils";
import { authMiddleware } from "@/middleware";
import { getInventorySummaryRows } from "../inventory/services/data-access/summary";

export const dashboardRoutes = new Hono()
	.basePath("/dashboard")
	.use(authMiddleware)

	.get("/overview", async (ctx) => {
		const currentUser = ctx.get("currentUser");
		const currentWorkspace = ctx.get("currentWorkspace");
		const today = startOfDay(new Date());
		const nearExpiryDate = endOfDay(add(today, { days: currentWorkspace.nearExpiryDays }));

		const [rows, nearExpiryResult, expiredResult, recentActivity] = await Promise.all([
			getInventorySummaryRows({
				lowStockThreshold: currentWorkspace.lowStockThreshold,
				workspaceId: currentUser.workspaceId,
			}),
			db
				.select({ total: countDistinct(stockBatches.drugId) })
				.from(stockBatches)
				.where(
					and(
						eq(stockBatches.workspaceId, currentUser.workspaceId),
						gt(stockBatches.quantityAvailable, 0),
						gte(stockBatches.expiryDate, today),
						lte(stockBatches.expiryDate, nearExpiryDate)
					)
				),
			db
				.select({ total: countDistinct(stockBatches.drugId) })
				.from(stockBatches)
				.where(
					and(
						eq(stockBatches.workspaceId, currentUser.workspaceId),
						gt(stockBatches.quantityAvailable, 0),
						lt(stockBatches.expiryDate, today)
					)
				),
			db
				.select({
					createdAt: stockLogs.createdAt,
					drug: {
						id: drugs.id,
						name: drugs.name,
						strength: drugs.strength,
					},
					id: stockLogs.id,
					logType: stockLogs.logType,
					person: users.fullName,
					quantity: stockLogs.quantity,
				})
				.from(stockLogs)
				.innerJoin(drugs, eq(stockLogs.drugId, drugs.id))
				.innerJoin(users, eq(stockLogs.performedByUserId, users.id))
				.where(eq(stockLogs.workspaceId, currentUser.workspaceId))
				.orderBy(desc(stockLogs.createdAt))
				.limit(8),
		]);

		const lowStockRows = rows.filter(
			(row) => row.status === "low_stock" || row.status === "out_of_stock"
		);

		return AppJsonResponse(ctx, {
			data: {
				recentActivity,
				stats: {
					expiredCount: Number(expiredResult[0]?.total ?? 0),
					expiringSoonCount: Number(nearExpiryResult[0]?.total ?? 0),
					lowStockCount: lowStockRows.length,
					stockValueKobo: rows.reduce((total, row) => total + row.stockValueKobo, 0),
				},
			},
			message: "Dashboard overview fetched successfully",
			schema: backendApiSchemaRoutes["@get/dashboard/overview"].data,
		});
	});
