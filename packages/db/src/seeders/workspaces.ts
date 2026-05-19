import { consola } from "consola";
import { db } from "../db";
import { workspaces, type InsertWorkspaceType } from "../schema";

const WORKSPACE_SEED_DATA: InsertWorkspaceType[] = [
	{
		alertEmail: "alerts@greenleaf.seeded.com",
		name: "Greenleaf Pharmacy",
	},
	{
		alertEmail: "alerts@citycare.seeded.com",
		lowStockThreshold: 20,
		name: "CityCare Pharmacy",
		nearExpiryDays: 60,
	},
];

export const seedWorkspaces = async () => {
	consola.info(`Seeding ${WORKSPACE_SEED_DATA.length} workspaces...`);

	const inserted = await db
		.insert(workspaces)
		.values(WORKSPACE_SEED_DATA)
		.onConflictDoNothing()
		.returning();

	if (inserted.length === 0) {
		consola.warn("Workspaces already seeded, skipping.");
		return [];
	}

	consola.success(`Seeded ${inserted.length} workspaces.`);

	return inserted;
};
