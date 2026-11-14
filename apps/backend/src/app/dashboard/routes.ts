import { backendApiSchemaRoutes } from "@vitastock/shared/validation/backendApiSchema";
import { Hono } from "hono";
import { rateLimiter } from "hono-rate-limiter";
import { userRateLimiterOptions } from "@/config/rateLimiterOptions";
import { AppJsonResponse } from "@/lib/utils";
import { authMiddleware, authorizeRoleMiddleware } from "@/middleware";
import { validateWithZodMiddleware } from "@/middleware/validateWithZodMiddleware";
import { getRecentInventoryActivity } from "../inventory/services/data-access/activity";
import { getInventorySummaryRows } from "../inventory/services/data-access/summary";
import { getInventorySummaryStats } from "../inventory/services/utils/common";
import { getDashboardAnalytics } from "./services/analytics";

export const dashboardRoutes = new Hono()
	.basePath("/dashboard")
	.use(authMiddleware)
	.use(rateLimiter(userRateLimiterOptions))

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
					drugsInStockCount: stats.drugsInStockCount,
					expiredCount: stats.expiredCount,
					expiringSoonCount: stats.expiringSoonCount,
					lowStockCount: stats.lowStockCount,
				},
			},
			message: "Dashboard overview fetched successfully",
			schema: backendApiSchemaRoutes["@get/dashboard/overview"].data,
		});
	})

	.get(
		"/analytics",
		authorizeRoleMiddleware(["owner", "admin"]),
		validateWithZodMiddleware("query", backendApiSchemaRoutes["@get/dashboard/analytics"].query),
		async (ctx) => {
			const { from, to } = ctx.req.valid("query");
			const currentUser = ctx.get("currentUser");
			const currentWorkspace = ctx.get("currentWorkspace");

			const analytics = await getDashboardAnalytics({
				from,
				timezone: currentWorkspace.timezone,
				to,
				workspaceId: currentUser.workspaceId,
			});

			return AppJsonResponse(ctx, {
				data: analytics,
				message: "Dashboard analytics fetched successfully",
				schema: backendApiSchemaRoutes["@get/dashboard/analytics"].data,
			});
		}
	);
