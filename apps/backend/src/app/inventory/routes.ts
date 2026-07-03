import { backendApiSchemaRoutes } from "@vitastock/shared/validation/backendApiSchema";
import { Hono } from "hono";
import { AppJsonResponse } from "@/lib/utils";
import { authMiddleware } from "@/middleware";
import { getInventorySummaryRows } from "./services/summary";

export const inventoryRoutes = new Hono()
	.basePath("/inventory")
	.use(authMiddleware)

	.get("/summary", async (ctx) => {
		const currentUser = ctx.get("currentUser");
		const currentWorkspace = ctx.get("currentWorkspace");

		const rows = await getInventorySummaryRows({
			lowStockThreshold: currentWorkspace.lowStockThreshold,
			workspaceId: currentUser.workspaceId,
		});

		return AppJsonResponse(ctx, {
			data: {
				rows,
				stats: {
					criticalCount: rows.filter(
						(row) =>
							row.status === "expired"
							|| row.status === "low_stock"
							|| row.status === "out_of_stock"
					).length,
					stockValueKobo: rows.reduce((total, row) => total + row.stockValueKobo, 0),
				},
			},
			message: "Inventory summary fetched successfully",
			schema: backendApiSchemaRoutes["@get/inventory/summary"].data,
		});
	});
