import { db } from "@vitastock/db";
import { inventoryAlerts } from "@vitastock/db/schema/inventory";
import { workspaces } from "@vitastock/db/schema/workspace";
import { subDays } from "date-fns";
import { and, eq, lt } from "drizzle-orm";
import { syncInventoryAlerts } from "./alertLifecycle";

const resolvedAlertRetentionDays = 180;

const syncAllWorkspaceInventoryAlerts = async () => {
	const workspaceRows = await db
		.select({
			id: workspaces.id,
			lowStockThreshold: workspaces.lowStockThreshold,
			nearExpiryDays: workspaces.nearExpiryDays,
			timezone: workspaces.timezone,
		})
		.from(workspaces);

	await Promise.all(
		workspaceRows.map((workspace) =>
			syncInventoryAlerts({
				lowStockThreshold: workspace.lowStockThreshold,
				nearExpiryDays: workspace.nearExpiryDays,
				timezone: workspace.timezone,
				workspaceId: workspace.id,
			})
		)
	);
};

const cleanupResolvedInventoryAlerts = async () => {
	await db
		.delete(inventoryAlerts)
		.where(
			and(
				eq(inventoryAlerts.status, "resolved"),
				lt(inventoryAlerts.resolvedAt, subDays(new Date(), resolvedAlertRetentionDays))
			)
		);
};

export const maintainInventoryAlerts = async () => {
	await syncAllWorkspaceInventoryAlerts();
	await cleanupResolvedInventoryAlerts();
};
