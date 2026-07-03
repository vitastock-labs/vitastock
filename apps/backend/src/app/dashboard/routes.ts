import { db } from "@vitastock/db";
import { users } from "@vitastock/db/schema/auth";
import { drugs, stockBatches, stockLogs } from "@vitastock/db/schema/inventory";
import { backendApiSchemaRoutes } from "@vitastock/shared/validation/backendApiSchema";
import { add } from "date-fns";
import { and, countDistinct, desc, eq, gt, gte, lte } from "drizzle-orm";
import { Hono } from "hono";
import { AppJsonResponse } from "@/lib/utils";
import { authMiddleware } from "@/middleware";
import { getInventorySummaryRows } from "../inventory/services/summary";

export const dashboardRoutes = new Hono()
	.basePath("/dashboard")
	.use(authMiddleware)

	.get("/overview", async (ctx) => {
		const currentUser = ctx.get("currentUser");
		const currentWorkspace = ctx.get("currentWorkspace");
		const now = new Date();
		const nearExpiryDate = add(now, { days: currentWorkspace.nearExpiryDays });

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
						gte(stockBatches.expiryDate, now),
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
						lte(stockBatches.expiryDate, now)
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

		return AppJsonResponse(ctx, {
			data: {
				recentActivity,
				stats: {
					expiredCount: expiredResult[0]?.total ?? 0,
					expiringSoonCount: nearExpiryResult[0]?.total ?? 0,
					lowStockCount: rows.filter(
						(row) => row.status === "low_stock" || row.status === "out_of_stock"
					).length,
					stockValueKobo: rows.reduce((total, row) => total + row.stockValueKobo, 0),
				},
			},
			message: "Dashboard overview fetched successfully",
			schema: backendApiSchemaRoutes["@get/dashboard/overview"].data,
		});
	});
