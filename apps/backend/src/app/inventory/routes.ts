import { backendApiSchemaRoutes } from "@vitastock/shared/validation/backendApiSchema";
import { Hono } from "hono";
import { rateLimiter } from "hono-rate-limiter";
import { userRateLimiterOptions } from "@/config/rateLimiterOptions";
import { AppJsonResponse } from "@/lib/utils";
import { authMiddleware, authorizeRoleMiddleware } from "@/middleware";
import { validateWithZodMiddleware } from "@/middleware/validateWithZodMiddleware";
import { createInventoryActivityCsv } from "./services/activity-export";
import {
	acknowledgeInventoryAlert,
	getPersistedInventoryAlerts,
	hasActiveInventoryAlerts,
	syncInventoryAlerts,
} from "./services/alertLifecycle";
import {
	createInventoryBulkImport,
	getInventoryBulkImports,
	removeInventoryBulkImport,
	validateInventoryBulkImportRows,
} from "./services/bulk-import";
import { getInventoryActivity } from "./services/data-access/activity";
import { getWorkspaceDrugBatches, updateWorkspaceBatch } from "./services/data-access/batches";
import {
	createDrugForWorkspace,
	getWorkspaceDrugList,
	getWorkspacePriceList,
	handleDrugAction,
	updateDrug,
} from "./services/data-access/drugs";
import { getInventorySummaryRows } from "./services/data-access/summary";
import {
	createInventoryDispenseCart,
	createInventoryStockLog,
	undoInventoryDispense,
} from "./services/stock-log";
import { assertCanRecordStockLog, getInventorySummaryStats } from "./services/utils/common";

export const inventoryRoutes = new Hono()
	.basePath("/inventory")
	.use(authMiddleware)
	.use(rateLimiter(userRateLimiterOptions))

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

	.get(
		"/price-list",
		validateWithZodMiddleware("query", backendApiSchemaRoutes["@get/inventory/price-list"].query),
		async (ctx) => {
			const currentUser = ctx.get("currentUser");
			const currentWorkspace = ctx.get("currentWorkspace");
			const query = ctx.req.valid("query");

			const result = await getWorkspacePriceList({
				query,
				timezone: currentWorkspace.timezone,
				workspaceId: currentUser.workspaceId,
			});

			return AppJsonResponse(ctx, {
				data: result,
				message: "Price list retrieved successfully",
				schema: backendApiSchemaRoutes["@get/inventory/price-list"].data,
			});
		}
	)

	.patch(
		"/batches/:batchId",
		authorizeRoleMiddleware(["owner", "admin"]),
		validateWithZodMiddleware(
			"param",
			backendApiSchemaRoutes["@patch/inventory/batches/:batchId"].params
		),
		validateWithZodMiddleware("json", backendApiSchemaRoutes["@patch/inventory/batches/:batchId"].body),
		async (ctx) => {
			const { batchId } = ctx.req.valid("param");
			const body = ctx.req.valid("json");
			const currentUser = ctx.get("currentUser");
			const currentWorkspace = ctx.get("currentWorkspace");

			const batch = await updateWorkspaceBatch({
				...body,
				batchId,
				workspaceId: currentUser.workspaceId,
			});

			if (body.expiryDate !== undefined) {
				await syncInventoryAlerts({
					lowStockThreshold: currentWorkspace.lowStockThreshold,
					nearExpiryDays: currentWorkspace.nearExpiryDays,
					timezone: currentWorkspace.timezone,
					workspaceId: currentUser.workspaceId,
				});
			}

			return AppJsonResponse(ctx, {
				data: { batch },
				message: "Batch updated successfully",
				schema: backendApiSchemaRoutes["@patch/inventory/batches/:batchId"].data,
			});
		}
	)

	.post(
		"/drugs",
		authorizeRoleMiddleware(["owner", "admin"]),
		validateWithZodMiddleware("json", backendApiSchemaRoutes["@post/inventory/drugs"].body),
		async (ctx) => {
			const body = ctx.req.valid("json");
			const currentUser = ctx.get("currentUser");
			const currentWorkspace = ctx.get("currentWorkspace");

			const drug = await createDrugForWorkspace({
				...body,
				workspaceId: currentUser.workspaceId,
			});

			await syncInventoryAlerts({
				lowStockThreshold: currentWorkspace.lowStockThreshold,
				nearExpiryDays: currentWorkspace.nearExpiryDays,
				timezone: currentWorkspace.timezone,
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
			const currentWorkspace = ctx.get("currentWorkspace");

			const drug = await updateDrug({
				...body,
				drugId: param.drugId,
				userId: currentUser.id,
				workspaceId: currentUser.workspaceId,
			});

			if (Object.hasOwn(body, "lowStockThreshold")) {
				await syncInventoryAlerts({
					lowStockThreshold: currentWorkspace.lowStockThreshold,
					nearExpiryDays: currentWorkspace.nearExpiryDays,
					timezone: currentWorkspace.timezone,
					workspaceId: currentUser.workspaceId,
				});
			}

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

	.get("/alerts/status", async (ctx) => {
		const currentUser = ctx.get("currentUser");

		const hasActiveAlerts = await hasActiveInventoryAlerts(currentUser.workspaceId);

		return AppJsonResponse(ctx, {
			data: { hasActiveAlerts },
			message: "Alert status fetched successfully",
			schema: backendApiSchemaRoutes["@get/inventory/alerts/status"].data,
		});
	})

	.get(
		"/activity/export",
		validateWithZodMiddleware("query", backendApiSchemaRoutes["@get/inventory/activity/export"].query),
		async (ctx) => {
			const currentUser = ctx.get("currentUser");
			const currentWorkspace = ctx.get("currentWorkspace");
			const activityExport = await createInventoryActivityCsv({
				query: ctx.req.valid("query"),
				timezone: currentWorkspace.timezone,
				workspaceId: currentUser.workspaceId,
			});

			ctx.header("Content-Disposition", `attachment; filename="${activityExport.filename}"`);
			ctx.header("Content-Type", "text/csv; charset=utf-8");

			return ctx.body(activityExport.content);
		}
	)

	.get(
		"/activity",
		validateWithZodMiddleware("query", backendApiSchemaRoutes["@get/inventory/activity"].query),
		async (ctx) => {
			const currentUser = ctx.get("currentUser");
			const currentWorkspace = ctx.get("currentWorkspace");

			const activity = await getInventoryActivity({
				query: ctx.req.valid("query"),
				timezone: currentWorkspace.timezone,
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

			assertCanRecordStockLog({ body, role: currentUser.role });

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
		"/stock-log/dispense",
		validateWithZodMiddleware(
			"header",
			backendApiSchemaRoutes["@post/inventory/stock-log/dispense"].headers
		),
		validateWithZodMiddleware("json", backendApiSchemaRoutes["@post/inventory/stock-log/dispense"].body),
		async (ctx) => {
			const body = ctx.req.valid("json");
			const { "x-idempotency-key": idempotencyKey } = ctx.req.valid("header");
			const currentUser = ctx.get("currentUser");
			const currentWorkspace = ctx.get("currentWorkspace");

			const dispenseResult = await createInventoryDispenseCart({
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
				data: dispenseResult,
				message: "Medications dispensed successfully",
				schema: backendApiSchemaRoutes["@post/inventory/stock-log/dispense"].data,
			});
		}
	)

	.post(
		"/stock-transactions/:stockTransactionId/undo",
		validateWithZodMiddleware(
			"param",
			backendApiSchemaRoutes["@post/inventory/stock-transactions/:stockTransactionId/undo"].params
		),
		async (ctx) => {
			const { stockTransactionId } = ctx.req.valid("param");
			const currentUser = ctx.get("currentUser");
			const currentWorkspace = ctx.get("currentWorkspace");

			await undoInventoryDispense({
				stockTransactionId,
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
				message: "Dispense undone. The stock is back on the shelf.",
				schema:
					backendApiSchemaRoutes["@post/inventory/stock-transactions/:stockTransactionId/undo"].data,
			});
		}
	)

	.post(
		"/bulk-import/validate",
		authorizeRoleMiddleware(["owner", "admin"]),
		validateWithZodMiddleware(
			"json",
			backendApiSchemaRoutes["@post/inventory/bulk-import/validate"].body
		),
		async (ctx) => {
			const { rows } = ctx.req.valid("json");
			const currentUser = ctx.get("currentUser");
			const validation = await validateInventoryBulkImportRows({
				rows,
				workspaceId: currentUser.workspaceId,
			});

			return AppJsonResponse(ctx, {
				data: validation,
				message: "Bulk import rows validated successfully",
				schema: backendApiSchemaRoutes["@post/inventory/bulk-import/validate"].data,
			});
		}
	)

	.post(
		"/bulk-import",
		authorizeRoleMiddleware(["owner", "admin"]),
		validateWithZodMiddleware("header", backendApiSchemaRoutes["@post/inventory/bulk-import"].headers),
		validateWithZodMiddleware("json", backendApiSchemaRoutes["@post/inventory/bulk-import"].body),
		async (ctx) => {
			const { rows } = ctx.req.valid("json");
			const { "x-idempotency-key": idempotencyKey } = ctx.req.valid("header");
			const currentUser = ctx.get("currentUser");
			const currentWorkspace = ctx.get("currentWorkspace");

			const result = await createInventoryBulkImport({
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
				data: result,
				message: "Bulk import completed successfully",
				schema: backendApiSchemaRoutes["@post/inventory/bulk-import"].data,
			});
		}
	)

	.get("/bulk-imports", authorizeRoleMiddleware(["owner", "admin"]), async (ctx) => {
		const currentUser = ctx.get("currentUser");
		const imports = await getInventoryBulkImports(currentUser.workspaceId);

		return AppJsonResponse(ctx, {
			data: { imports },
			message: "Bulk imports retrieved successfully",
			schema: backendApiSchemaRoutes["@get/inventory/bulk-imports"].data,
		});
	})

	.post(
		"/bulk-imports/:stockTransactionId/remove",
		authorizeRoleMiddleware(["owner"], {
			errorMessage: "Only the pharmacy owner can remove an import.",
		}),
		validateWithZodMiddleware(
			"param",
			backendApiSchemaRoutes["@post/inventory/bulk-imports/:stockTransactionId/remove"].params
		),
		async (ctx) => {
			const { stockTransactionId } = ctx.req.valid("param");
			const currentUser = ctx.get("currentUser");
			const currentWorkspace = ctx.get("currentWorkspace");

			await removeInventoryBulkImport({
				stockTransactionId,
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
				message: "Import removed. Its stock is no longer on the shelf.",
				schema: backendApiSchemaRoutes["@post/inventory/bulk-imports/:stockTransactionId/remove"].data,
			});
		}
	);
