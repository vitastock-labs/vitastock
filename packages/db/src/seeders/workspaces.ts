import { consola } from "consola";
import { db } from "../db";
import { workspaces, type InsertWorkspaceType } from "../schema";

const WORKSPACE_SEED_DATA: InsertWorkspaceType[] = [
	{
		alertEmail: "alerts@greenleaf.seeded.com",
		emailAlertsEnabledAt: new Date("2026-01-01T08:00:00.000Z"),
		lowStockThreshold: 15,
		name: "Greenleaf Pharmacy",
		nearExpiryDays: 75,
		timezone: "Africa/Lagos",
	},
	{
		alertEmail: "alerts@citycare.seeded.com",
		emailAlertsEnabledAt: new Date("2026-01-02T08:00:00.000Z"),
		lowStockThreshold: 20,
		name: "CityCare Pharmacy",
		nearExpiryDays: 60,
		timezone: "Africa/Lagos",
	},
];

export const seedWorkspaces = async () => {
	consola.info(`Seeding ${WORKSPACE_SEED_DATA.length} workspaces...`);

	const insertedWorkspaces = await db
		.insert(workspaces)
		.values(WORKSPACE_SEED_DATA)
		.onConflictDoNothing()
		.returning();

	consola.success(`Seeded ${insertedWorkspaces.length} new workspaces.`);

	return insertedWorkspaces;
};
