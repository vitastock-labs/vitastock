import { backendApiSchemaRoutes } from "@vitastock/shared/validation/backendApiSchema";
import { Hono } from "hono";
import { AppJsonResponse } from "@/lib/utils";
import { authMiddleware } from "@/middleware";
import { validateWithZodMiddleware } from "@/middleware/validateWithZodMiddleware";
import { createInventoryStockLog } from "./services/stock-log";
import { getDrugForWorkspace, getInventorySummaryRows } from "./services/summary";

export const inventoryRoutes = new Hono()
	.basePath("/inventory")
	.use(authMiddleware)

	.get("/summary", async (ctx) => {
		const currentUser = ctx.get("currentUser");
		const currentWorkspace = ctx.get("currentWorkspace");

		const inventorySummaryRows = await getInventorySummaryRows({
			lowStockThreshold: currentWorkspace.lowStockThreshold,
			workspaceId: currentUser.workspaceId,
		});

		const criticalCount = inventorySummaryRows.filter(
			(row) => row.status === "expired" || row.status === "low_stock" || row.status === "out_of_stock"
		).length;

		return AppJsonResponse(ctx, {
			data: {
				rows: inventorySummaryRows,
				stats: {
					criticalCount,
					stockValueKobo: inventorySummaryRows.reduce((total, row) => total + row.stockValueKobo, 0),
				},
			},
			message: "Inventory summary fetched successfully",
			schema: backendApiSchemaRoutes["@get/inventory/summary"].data,
		});
	})

	.post(
		"/stock-log",
		validateWithZodMiddleware("json", backendApiSchemaRoutes["@post/inventory/stock-log"].body),
		async (ctx) => {
			const body = ctx.req.valid("json");
			const currentUser = ctx.get("currentUser");

			void (await getDrugForWorkspace({
				drugId: body.drugId,
				workspaceId: currentUser.workspaceId,
			}));

			await createInventoryStockLog({
				body,
				userId: currentUser.id,
				workspaceId: currentUser.workspaceId,
			});

			return AppJsonResponse(ctx, {
				data: null,
				message: "Stock movement recorded successfully",
				schema: backendApiSchemaRoutes["@post/inventory/stock-log"].data,
			});
		}
	);
