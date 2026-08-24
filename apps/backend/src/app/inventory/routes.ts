import { backendApiSchemaRoutes } from "@vitastock/shared/validation/backendApiSchema";
import { Hono } from "hono";
import { AppJsonResponse } from "@/lib/utils";
import { authMiddleware, authorizeRoleMiddleware } from "@/middleware";
import { validateWithZodMiddleware } from "@/middleware/validateWithZodMiddleware";
import {
	acknowledgeInventoryAlert,
	getPersistedInventoryAlerts,
	getUnreadInventoryAlertCount,
	syncInventoryAlerts,
} from "./services/alertLifecycle";
import { createInventoryBulkImport } from "./services/bulk-import";
import { getInventoryActivity } from "./services/data-access/activity";
import {
	createDrugForWorkspace,
	getWorkspaceDrugList,
	handleDrugAction,
	updateDrug,
} from "./services/data-access/drugs";
import { getDrugForStockMovement, getInventorySummaryRows } from "./services/data-access/summary";
import { createInventoryStockLog } from "./services/stock-log";

export const inventoryRoutes = new Hono()
	.basePath("/inventory")
	.use(authMiddleware)

	.get(
		"/drugs",
		validateWithZodMiddleware("query", backendApiSchemaRoutes["@get/inventory/drugs"].query),
		async (ctx) => {
			const currentUser = ctx.get("currentUser");
			const query = ctx.req.valid("query");

			const result = await getWorkspaceDrugList({
				query,
				workspaceId: currentUser.workspaceId,
			});

			return AppJsonResponse(ctx, {
				data: result,
				message: "Drugs fetched successfully",
				schema: backendApiSchemaRoutes["@get/inventory/drugs"].data,
			});
		}
	)

	.post(
		"/drugs",
		validateWithZodMiddleware("json", backendApiSchemaRoutes["@post/inventory/drugs"].body),
		async (ctx) => {
			const body = ctx.req.valid("json");
			const currentUser = ctx.get("currentUser");

			const drug = await createDrugForWorkspace({
				...body,
				workspaceId: currentUser.workspaceId,
			});

			return AppJsonResponse(ctx, {
				data: { drug },
				message: "Drug created successfully",
				schema: backendApiSchemaRoutes["@post/inventory/drugs"].data,
			});
		}
	)

	.patch(
		"/drugs/:drugId",
		authorizeRoleMiddleware(["owner", "admin"]),
		validateWithZodMiddleware("json", backendApiSchemaRoutes["@patch/inventory/drugs/:drugId"].body),
		validateWithZodMiddleware("param", backendApiSchemaRoutes["@patch/inventory/drugs/:drugId"].params),
		async (ctx) => {
			const body = ctx.req.valid("json");
			const param = ctx.req.valid("param");
			const currentUser = ctx.get("currentUser");

			const drug = await updateDrug({
				...body,
				drugId: param.drugId,
				workspaceId: currentUser.workspaceId,
			});

			return AppJsonResponse(ctx, {
				data: { drug },
				message: "Drug updated successfully",
				schema: backendApiSchemaRoutes["@patch/inventory/drugs/:drugId"].data,
			});
		}
	)

	.post(
		"/drugs/:drugId/action",
		authorizeRoleMiddleware(["owner", "admin"]),
		validateWithZodMiddleware(
			"param",
			backendApiSchemaRoutes["@post/inventory/drugs/:drugId/action"].params
		),
		validateWithZodMiddleware(
			"json",
			backendApiSchemaRoutes["@post/inventory/drugs/:drugId/action"].body
		),
		async (ctx) => {
			const { action } = ctx.req.valid("json");
			const param = ctx.req.valid("param");
			const currentUser = ctx.get("currentUser");

			const drug = await handleDrugAction({
				action,
				drugId: param.drugId,
				workspaceId: currentUser.workspaceId,
			});

			return AppJsonResponse(ctx, {
				data: { drug },
				message: `Drug ${action}d successfully`,
				schema: backendApiSchemaRoutes["@post/inventory/drugs/:drugId/action"].data,
			});
		}
	)

	.get(
		"/alerts",
		validateWithZodMiddleware("query", backendApiSchemaRoutes["@get/inventory/alerts"].query),
		async (ctx) => {
			const currentUser = ctx.get("currentUser");

			const alerts = await getPersistedInventoryAlerts({
				status: ctx.req.valid("query")?.status,
				workspaceId: currentUser.workspaceId,
			});

			return AppJsonResponse(ctx, {
				data: { alerts },
				message: "Alerts fetched successfully",
				schema: backendApiSchemaRoutes["@get/inventory/alerts"].data,
			});
		}
	)

	.get("/alerts/unread-count", async (ctx) => {
		const currentUser = ctx.get("currentUser");

		const count = await getUnreadInventoryAlertCount(currentUser.workspaceId);

		return AppJsonResponse(ctx, {
			data: { count },
			message: "Unread alert count fetched successfully",
			schema: backendApiSchemaRoutes["@get/inventory/alerts/unread-count"].data,
		});
	})

	.get(
		"/activity",
		validateWithZodMiddleware("query", backendApiSchemaRoutes["@get/inventory/activity"].query),
		async (ctx) => {
			const currentUser = ctx.get("currentUser");

			const activity = await getInventoryActivity({
				query: ctx.req.valid("query"),
				workspaceId: currentUser.workspaceId,
			});

			return AppJsonResponse(ctx, {
				data: activity,
				message: "Inventory activity fetched successfully",
				schema: backendApiSchemaRoutes["@get/inventory/activity"].data,
			});
		}
	)

	.post(
		"/alerts/acknowledge",
		validateWithZodMiddleware("json", backendApiSchemaRoutes["@post/inventory/alerts/acknowledge"].body),
		async (ctx) => {
			const { alertId } = ctx.req.valid("json");
			const currentUser = ctx.get("currentUser");

			await acknowledgeInventoryAlert({
				alertId,
				userId: currentUser.id,
				workspaceId: currentUser.workspaceId,
			});

			return AppJsonResponse(ctx, {
				data: null,
				message: "Alert acknowledged successfully",
				schema: backendApiSchemaRoutes["@post/inventory/alerts/acknowledge"].data,
			});
		}
	)

	.get("/summary", async (ctx) => {
		const currentUser = ctx.get("currentUser");
		const currentWorkspace = ctx.get("currentWorkspace");

		const inventorySummaryRows = await getInventorySummaryRows({
			lowStockThreshold: currentWorkspace.lowStockThreshold,
			workspaceId: currentUser.workspaceId,
		});

		const criticalCount = inventorySummaryRows.filter(
			(row) => row.status === "low_stock" || row.status === "out_of_stock" || row.hasExpiredStock
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
		validateWithZodMiddleware("header", backendApiSchemaRoutes["@post/inventory/stock-log"].headers),
		validateWithZodMiddleware("json", backendApiSchemaRoutes["@post/inventory/stock-log"].body),
		async (ctx) => {
			const body = ctx.req.valid("json");
			const { "x-idempotency-key": idempotencyKey } = ctx.req.valid("header");
			const currentUser = ctx.get("currentUser");
			const currentWorkspace = ctx.get("currentWorkspace");

			await getDrugForStockMovement({
				drugId: body.drugId,
				workspaceId: currentUser.workspaceId,
			});

			await createInventoryStockLog({
				body,
				idempotencyKey,
				userId: currentUser.id,
				workspaceId: currentUser.workspaceId,
			});

			await syncInventoryAlerts({
				lowStockThreshold: currentWorkspace.lowStockThreshold,
				nearExpiryDays: currentWorkspace.nearExpiryDays,
				workspaceId: currentUser.workspaceId,
			});

			return AppJsonResponse(ctx, {
				data: null,
				message: "Stock movement recorded successfully",
				schema: backendApiSchemaRoutes["@post/inventory/stock-log"].data,
			});
		}
	)

	.post(
		"/bulk-import",
		validateWithZodMiddleware("header", backendApiSchemaRoutes["@post/inventory/bulk-import"].headers),
		validateWithZodMiddleware("json", backendApiSchemaRoutes["@post/inventory/bulk-import"].body),
		async (ctx) => {
			const { rows } = ctx.req.valid("json");
			const { "x-idempotency-key": idempotencyKey } = ctx.req.valid("header");
			const currentUser = ctx.get("currentUser");
			const currentWorkspace = ctx.get("currentWorkspace");

			const { importedCount } = await createInventoryBulkImport({
				idempotencyKey,
				rows,
				userId: currentUser.id,
				workspaceId: currentUser.workspaceId,
			});

			await syncInventoryAlerts({
				lowStockThreshold: currentWorkspace.lowStockThreshold,
				nearExpiryDays: currentWorkspace.nearExpiryDays,
				workspaceId: currentUser.workspaceId,
			});

			return AppJsonResponse(ctx, {
				data: { importedCount },
				message: "Bulk import completed successfully",
				schema: backendApiSchemaRoutes["@post/inventory/bulk-import"].data,
			});
		}
	);
