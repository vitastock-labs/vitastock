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
import { createInventoryBulkImport, validateInventoryBulkImportRows } from "./services/bulk-import";
import { getInventoryActivity } from "./services/data-access/activity";
import { getWorkspaceDrugBatches } from "./services/data-access/batches";
import {
	createDrugForWorkspace,
	getWorkspaceDrugList,
	handleDrugAction,
	updateDrug,
} from "./services/data-access/drugs";
import { getInventorySummaryRows } from "./services/data-access/summary";
import { createInventoryStockLog } from "./services/stock-log";
import { getInventorySummaryStats } from "./services/utils/common";

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
		"/drugs/:drugId/batches",
		validateWithZodMiddleware(
			"param",
			backendApiSchemaRoutes["@get/inventory/drugs/:drugId/batches"].params
		),
		validateWithZodMiddleware(
			"query",
			backendApiSchemaRoutes["@get/inventory/drugs/:drugId/batches"].query
		),
		async (ctx) => {
			const { drugId } = ctx.req.valid("param");
			const { availability } = ctx.req.valid("query");
			const currentUser = ctx.get("currentUser");
			const currentWorkspace = ctx.get("currentWorkspace");
			const batches = await getWorkspaceDrugBatches({
				availability,
				drugId,
				timezone: currentWorkspace.timezone,
				workspaceId: currentUser.workspaceId,
			});

			return AppJsonResponse(ctx, {
				data: { batches },
				message: "Drug batches fetched successfully",
				schema: backendApiSchemaRoutes["@get/inventory/drugs/:drugId/batches"].data,
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

	.get(
		"/summary",
		validateWithZodMiddleware("query", backendApiSchemaRoutes["@get/inventory/summary"].query),
		async (ctx) => {
			const currentUser = ctx.get("currentUser");
			const currentWorkspace = ctx.get("currentWorkspace");
			const query = ctx.req.valid("query");

			const inventorySummaryRows = await getInventorySummaryRows({
				lowStockThreshold: currentWorkspace.lowStockThreshold,
				nearExpiryDays: currentWorkspace.nearExpiryDays,
				search: query?.search,
				timezone: currentWorkspace.timezone,
				workspaceId: currentUser.workspaceId,
			});

			const stats = getInventorySummaryStats(inventorySummaryRows);

			return AppJsonResponse(ctx, {
				data: {
					rows: inventorySummaryRows,
					stats: {
						criticalCount: stats.criticalCount,
						drugsInStockCount: stats.drugsInStockCount,
					},
				},
				message: "Inventory summary fetched successfully",
				schema: backendApiSchemaRoutes["@get/inventory/summary"].data,
			});
		}
	)

	.post(
		"/stock-log",
		validateWithZodMiddleware("header", backendApiSchemaRoutes["@post/inventory/stock-log"].headers),
		validateWithZodMiddleware("json", backendApiSchemaRoutes["@post/inventory/stock-log"].body),
		async (ctx) => {
			const body = ctx.req.valid("json");
			const { "x-idempotency-key": idempotencyKey } = ctx.req.valid("header");
			const currentUser = ctx.get("currentUser");
			const currentWorkspace = ctx.get("currentWorkspace");

			await createInventoryStockLog({
				body,
				idempotencyKey,
				timezone: currentWorkspace.timezone,
				userId: currentUser.id,
				workspaceId: currentUser.workspaceId,
			});

			await syncInventoryAlerts({
				lowStockThreshold: currentWorkspace.lowStockThreshold,
				nearExpiryDays: currentWorkspace.nearExpiryDays,
				timezone: currentWorkspace.timezone,
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
		"/bulk-import/validate",
		validateWithZodMiddleware(
			"json",
			backendApiSchemaRoutes["@post/inventory/bulk-import/validate"].body
		),
		async (ctx) => {
			const { rows } = ctx.req.valid("json");
			const currentUser = ctx.get("currentUser");
			const issues = await validateInventoryBulkImportRows({
				rows,
				workspaceId: currentUser.workspaceId,
			});

			return AppJsonResponse(ctx, {
				data: { issues },
				message: "Bulk import rows validated successfully",
				schema: backendApiSchemaRoutes["@post/inventory/bulk-import/validate"].data,
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
				timezone: currentWorkspace.timezone,
				userId: currentUser.id,
				workspaceId: currentUser.workspaceId,
			});

			await syncInventoryAlerts({
				lowStockThreshold: currentWorkspace.lowStockThreshold,
				nearExpiryDays: currentWorkspace.nearExpiryDays,
				timezone: currentWorkspace.timezone,
				workspaceId: currentUser.workspaceId,
			});

			return AppJsonResponse(ctx, {
				data: { importedCount },
				message: "Bulk import completed successfully",
				schema: backendApiSchemaRoutes["@post/inventory/bulk-import"].data,
			});
		}
	);
