import { consola } from "consola";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { workspaceMemberships, type InsertWorkspaceMembershipType } from "../schema";
import type { seedUsers } from "./users";
import type { seedWorkspaces } from "./workspaces";

type SeededUsers = Awaited<ReturnType<typeof seedUsers>>;
type SeededWorkspaces = Awaited<ReturnType<typeof seedWorkspaces>>;

const getWorkspaceSlug = (workspaceName: string) => {
	return workspaceName.toLowerCase().replaceAll(/[^a-z0-9]+/g, "");
};

const getMembershipSeedData = (options: {
	seededUsers: SeededUsers;
	workspaceId: string;
	workspaceName: string;
}) => {
	const { seededUsers, workspaceId, workspaceName } = options;
	const slug = getWorkspaceSlug(workspaceName);

	const findUserId = (email: string) => {
		const user = seededUsers.find((seededUser) => seededUser.email === email);

		if (!user) {
			throw new Error(`Missing seeded user: ${email}`);
		}

		return user.id;
	};

	return [
		{
			role: "owner",
			status: "active",
			userId: findUserId(`owner.${slug}@seeded.com`),
			workspaceId,
		},
		{
			role: "admin",
			status: "active",
			userId: findUserId(`admin.${slug}@seeded.com`),
			workspaceId,
		},
		{
			role: "pharmacist",
			status: "active",
			userId: findUserId(`pharmacist.${slug}@seeded.com`),
			workspaceId,
		},
		...[...Array(5).keys()].map((index): InsertWorkspaceMembershipType => ({
			role: "pharmacist",
			status: "active",
			userId: findUserId(`pharmacist.${index + 1}.${slug}@seeded.com`),
			workspaceId,
		})),
		{
			role: "pharmacist",
			status: "suspended",
			suspendedAt: new Date("2026-01-15T09:00:00.000Z"),
			userId: findUserId(`suspended.${slug}@seeded.com`),
			workspaceId,
		},
	] satisfies InsertWorkspaceMembershipType[];
};

export const seedWorkspaceMemberships = async (
	seededUsers: SeededUsers,
	seededWorkspaces: SeededWorkspaces
) => {
	const allMemberships = seededWorkspaces.flatMap((workspace) =>
		getMembershipSeedData({
			seededUsers,
			workspaceId: workspace.id,
			workspaceName: workspace.name,
		})
	);

	consola.info(`Seeding ${allMemberships.length} workspace memberships...`);

	const seededMemberships = await db
		.insert(workspaceMemberships)
		.values(allMemberships)
		.onConflictDoUpdate({
			set: {
				role: sql`excluded.role`,
				status: sql`excluded.status`,
				suspendedAt: sql`excluded.suspended_at`,
				workspaceId: sql`excluded.workspace_id`,
			},
			target: [workspaceMemberships.userId, workspaceMemberships.workspaceId],
		})
		.returning();

	consola.success(`Seeded ${seededMemberships.length} workspace memberships.`);

	return seededMemberships;
};
