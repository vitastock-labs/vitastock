import { getDatabaseSeedEnv } from "@vitastock/env/backend";
import { consola } from "consola";
import { closeDatabaseConnection } from "./db";
import {
	seedInventory,
	seedUsers,
	seedWorkspaceInvitations,
	seedWorkspaceMemberships,
	seedWorkspaces,
} from "./seeders";

const ENVIRONMENT = getDatabaseSeedEnv();

const runSeeders = async () => {
	try {
		if (ENVIRONMENT.NODE_ENV === "production") {
			throw new Error("Demo seed data cannot be inserted into the production database");
		}

		consola.info("Seeding started...");

		const seededWorkspaces = await seedWorkspaces();
		const seededUsers = await seedUsers(seededWorkspaces);
		const seededMemberships = await seedWorkspaceMemberships(seededUsers, seededWorkspaces);
		await Promise.all([
			seedWorkspaceInvitations(seededUsers, seededMemberships, seededWorkspaces),
			seedInventory(seededUsers, seededMemberships, seededWorkspaces),
		]);

		for (const workspace of seededWorkspaces) {
			const workspaceMembershipRows = seededMemberships.filter(
				(membership) => membership.workspaceId === workspace.id
			);
			const owners = workspaceMembershipRows.filter((membership) => membership.role === "owner");
			const admins = workspaceMembershipRows.filter((membership) => membership.role === "admin");
			const pharmacists = workspaceMembershipRows.filter(
				(membership) => membership.role === "pharmacist"
			);
			const suspended = workspaceMembershipRows.filter((membership) => membership.suspendedAt);

			consola.info(
				`${workspace.name}: ${owners.length} owners, ${admins.length} admin, ${pharmacists.length} pharmacists, ${suspended.length} suspended`
			);
		}

		consola.success("Seeding completed!");
	} catch (error) {
		consola.error("Seeding failed:", error);
		process.exitCode = 1;
	} finally {
		await closeDatabaseConnection();
	}
};

await runSeeders();
