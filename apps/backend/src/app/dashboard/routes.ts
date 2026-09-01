import { backendApiSchemaRoutes } from "@vitastock/shared/validation/backendApiSchema";
import { Hono } from "hono";
import { AppJsonResponse } from "@/lib/utils";
import { authMiddleware } from "@/middleware";
import { getRecentInventoryActivity } from "../inventory/services/data-access/activity";
import { getInventorySummaryRows } from "../inventory/services/data-access/summary";
import { getInventorySummaryStats } from "../inventory/services/utils/common";

export const dashboardRoutes = new Hono()
	.basePath("/dashboard")
	.use(authMiddleware)

	.get("/overview", async (ctx) => {
		const currentUser = ctx.get("currentUser");
		const currentWorkspace = ctx.get("currentWorkspace");
		const [rows, recentActivity] = await Promise.all([
			getInventorySummaryRows({
				lowStockThreshold: currentWorkspace.lowStockThreshold,
				nearExpiryDays: currentWorkspace.nearExpiryDays,
				timezone: currentWorkspace.timezone,
				workspaceId: currentUser.workspaceId,
			}),
			getRecentInventoryActivity(currentUser.workspaceId),
		]);

		const stats = getInventorySummaryStats(rows);

		return AppJsonResponse(ctx, {
			data: {
				recentActivity,
				stats: {
					expiredCount: stats.expiredCount,
					expiringSoonCount: stats.expiringSoonCount,
					lowStockCount: stats.lowStockCount,
					stockValueKobo: stats.stockValueKobo,
					uncostedBatchCount: stats.uncostedBatchCount,
				},
			},
			message: "Dashboard overview fetched successfully",
			schema: backendApiSchemaRoutes["@get/dashboard/overview"].data,
		});
	});
