import crypto from "node:crypto";
import { hash } from "@node-rs/argon2";
import { consola } from "consola";
import { and, inArray, isNull } from "drizzle-orm";
import { db } from "../db";
import { workspaceInvitations, type InsertWorkspaceInvitationType } from "../schema";
import { seedWorkspaceMemberships } from "./memberships";
import { seedUsers } from "./users";
import type { seedWorkspaces } from "./workspaces";

type SeededWorkspaces = Awaited<ReturnType<typeof seedWorkspaces>>;
type SeededMemberships = Awaited<ReturnType<typeof seedWorkspaceMemberships>>;

const hashPassword = (password: string) => {
	return hash(password, {
		memoryCost: 19456,
		outputLen: 32,
		parallelism: 1,
		timeCost: 2,
	});
};

const hashToken = (token: string) => {
	return crypto.createHash("sha256").update(token).digest("hex");
};

const getWorkspaceSlug = (workspaceName: string) => {
	return workspaceName.toLowerCase().replaceAll(/[^a-z0-9]+/g, "");
};

const getInvitationSeedData = (options: {
	defaultPasswordHash: string;
	invitedByUserId: string;
	workspaceId: string;
	workspaceName: string;
}) => {
	const { defaultPasswordHash, invitedByUserId, workspaceId, workspaceName } = options;
	const slug = getWorkspaceSlug(workspaceName);

	return [
		{
			defaultPasswordHash,
			expiresAt: new Date("2026-12-31T23:59:59.000Z"),
			invitedByUserId,
			inviteeEmail: `pending.pharmacist.${slug}@seeded.com`,
			inviteeName: `${workspaceName} Pending Pharmacist`,
			role: "pharmacist",
			tokenHash: hashToken(`pending-pharmacist-${slug}`),
			workspaceId,
		},
		{
			defaultPasswordHash,
			expiresAt: new Date("2026-12-31T23:59:59.000Z"),
			invitedByUserId,
			inviteeEmail: `pending.admin.${slug}@seeded.com`,
			inviteeName: `${workspaceName} Pending Admin`,
			role: "admin",
			tokenHash: hashToken(`pending-admin-${slug}`),
			workspaceId,
		},
		{
			defaultPasswordHash,
			expiresAt: new Date("2025-01-01T00:00:00.000Z"),
			invitedByUserId,
			inviteeEmail: `expired.pharmacist.${slug}@seeded.com`,
			inviteeName: `${workspaceName} Expired Pharmacist`,
			role: "pharmacist",
			tokenHash: hashToken(`expired-pharmacist-${slug}`),
			workspaceId,
		},
	] satisfies InsertWorkspaceInvitationType[];
};

type SeededUsers = Awaited<ReturnType<typeof seedUsers>>;

export const seedWorkspaceInvitations = async (
	seededUsers: SeededUsers,
	seededMemberships: SeededMemberships,
	seededWorkspaces: SeededWorkspaces
) => {
	if (seededWorkspaces.length === 0) return;

	const defaultPasswordHash = await hashPassword("VS-Invite-2026");

	consola.info(`Seeding workspace invitations for ${seededWorkspaces.length} workspaces...`);

	const allInvitations: InsertWorkspaceInvitationType[] = [];

	for (const workspace of seededWorkspaces) {
		const ownerMembership = seededMemberships.find(
			(membership) => membership.workspaceId === workspace.id && membership.role === "owner"
		);

		if (!ownerMembership) {
			throw new Error("No owner found for workspace");
		}

		const owner = seededUsers.find((user) => user.id === ownerMembership.userId);

		if (!owner) {
			throw new Error("No owner user found for workspace");
		}

		const invitationsPerWorkspace = getInvitationSeedData({
			defaultPasswordHash,
			invitedByUserId: owner.id,
			workspaceId: workspace.id,
			workspaceName: workspace.name,
		});

		allInvitations.push(...invitationsPerWorkspace);

		consola.info(`${workspace.name}: ${invitationsPerWorkspace.length} invitations`);
	}

	const seedInviteeEmails = allInvitations.map((invitation) => invitation.inviteeEmail);

	const insertedWorkspaceInvitations = await db.transaction(async (tx) => {
		await tx
			.delete(workspaceInvitations)
			.where(
				and(
					inArray(workspaceInvitations.inviteeEmail, seedInviteeEmails),
					isNull(workspaceInvitations.acceptedAt)
				)
			);

		return tx.insert(workspaceInvitations).values(allInvitations).onConflictDoNothing().returning();
	});

	consola.success(`Seeded ${insertedWorkspaceInvitations.length} workspace invitations.`);
};
