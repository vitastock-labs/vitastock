import { consola } from "consola";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { workspaces, type InsertWorkspaceType } from "../schema";

const WORKSPACE_SEED_DATA: InsertWorkspaceType[] = [
	{
		alertEmail: null,
		emailAlertDeliveryPolicy: "critical_immediate",
		emailAlertsEnabledAt: null,
		lowStockThreshold: 15,
		name: "Greenleaf Pharmacy",
		nearExpiryDays: 75,
		timezone: "Africa/Lagos",
	},
	{
		alertEmail: null,
		emailAlertDeliveryPolicy: "critical_immediate",
		emailAlertsEnabledAt: null,
		lowStockThreshold: 20,
		name: "CityCare Pharmacy",
		nearExpiryDays: 60,
		timezone: "Africa/Lagos",
	},
];

export const seedWorkspaces = async () => {
	consola.info(`Seeding ${WORKSPACE_SEED_DATA.length} workspaces...`);

	const seededWorkspaces = await db
		.insert(workspaces)
		.values(WORKSPACE_SEED_DATA)
		.onConflictDoUpdate({
			set: {
				alertEmail: sql`excluded.alert_email`,
				emailAlertDeliveryPolicy: sql`excluded.email_alert_delivery_policy`,
				emailAlertsEnabledAt: sql`excluded.email_alerts_enabled_at`,
				lowStockThreshold: sql`excluded.low_stock_threshold`,
				nearExpiryDays: sql`excluded.near_expiry_days`,
				timezone: sql`excluded.timezone`,
			},
			target: workspaces.name,
		})
		.returning();

	consola.success(`Seeded ${seededWorkspaces.length} workspaces.`);

	return seededWorkspaces;
};
