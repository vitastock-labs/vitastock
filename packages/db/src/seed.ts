/* eslint-disable unicorn/no-process-exit */
/* eslint-disable node/no-process-exit */

import { consola } from "consola";
import { seedUsers, seedWorkspaceInvitations, seedWorkspaces } from "./seeders";

const runSeeders = async () => {
	consola.info("Seeding started...");

	try {
		const seededWorkspaces = await seedWorkspaces();
		const seededUsers = await seedUsers(seededWorkspaces);
		await seedWorkspaceInvitations(seededUsers, seededWorkspaces);

		for (const workspace of seededWorkspaces) {
			const workspaceUsers = seededUsers.filter((u) => u.workspaceId === workspace.id);
			const owners = workspaceUsers.filter((u) => u.role === "owner");
			const admins = workspaceUsers.filter((u) => u.role === "admin");
			const pharmacists = workspaceUsers.filter((u) => u.role === "pharmacist");
			const suspended = workspaceUsers.filter((u) => u.suspendedAt);

			consola.info(
				`${workspace.name}: ${owners.length} owners, ${admins.length} admin, ${pharmacists.length} pharmacists, ${suspended.length} suspended`
			);
		}

		consola.success("Seeding completed!");
		process.exit(0);
	} catch (error) {
		consola.error("Seeding failed:", error);
		process.exit(1);
	}
};

await runSeeders();
