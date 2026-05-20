import { consola } from "consola";
import { inArray } from "drizzle-orm";
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

	const workspaceNames = WORKSPACE_SEED_DATA.map((workspace) => workspace.name);

	const existingWorkspaces = await db
		.select()
		.from(workspaces)
		.where(inArray(workspaces.name, workspaceNames));

	const workspaceByName = new Map(existingWorkspaces.map((workspace) => [workspace.name, workspace]));

	const missingWorkspaces = WORKSPACE_SEED_DATA.filter((workspace) => {
		return !workspaceByName.has(workspace.name);
	});

	const insertedWorkspaces =
		missingWorkspaces.length > 0 ?
			await db.insert(workspaces).values(missingWorkspaces).returning()
		:	[];

	for (const workspace of insertedWorkspaces) {
		workspaceByName.set(workspace.name, workspace);
	}

	const seededWorkspaces = workspaceNames
		.map((name) => workspaceByName.get(name))
		.filter((workspace) => workspace !== undefined);

	if (insertedWorkspaces.length === 0) {
		consola.warn("Seed workspaces already exist, reusing them.");
	} else {
		consola.success(`Seeded ${insertedWorkspaces.length} new workspaces.`);
	}

	return seededWorkspaces;
};
