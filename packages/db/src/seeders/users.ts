import { hash } from "@node-rs/argon2";
import { consola } from "consola";
import { ENVIRONMENT } from "@/config/env";
import { db } from "../db";
import { users, type InsertUserType } from "../schema";
import type { seedWorkspaces } from "./workspaces";

type SeededWorkspaces = Awaited<ReturnType<typeof seedWorkspaces>>;

const hashPassword = (password: string) => {
	return hash(password, {
		memoryCost: 19456,
		outputLen: 32,
		parallelism: 1,
		timeCost: 2,
	});
};

const getWorkspaceSlug = (workspaceName: string) => {
	return workspaceName.toLowerCase().replaceAll(/[^a-z0-9]+/g, "");
};

const getUsersSeedData = (options: {
	passwordHash: string;
	workspaceId: string;
	workspaceName: string;
}) => {
	const { passwordHash, workspaceId, workspaceName } = options;

	const slug = getWorkspaceSlug(workspaceName);

	const fixedOwner: InsertUserType = {
		email: `owner.${slug}@seeded.com`,
		emailVerifiedAt: new Date(),
		fullName: `${workspaceName} Owner`,
		passwordHash,
		role: "owner",
		workspaceId,
	};

	const backupOwner: InsertUserType = {
		email: `backup-owner.${slug}@seeded.com`,
		emailVerifiedAt: new Date(),
		fullName: `${workspaceName} Backup Owner`,
		passwordHash,
		role: "owner",
		workspaceId,
	};

	const fixedAdmin: InsertUserType = {
		email: `admin.${slug}@seeded.com`,
		emailVerifiedAt: new Date(),
		fullName: `${workspaceName} Admin`,
		passwordHash,
		role: "admin",
		workspaceId,
	};

	const leadPharmacist: InsertUserType = {
		email: `pharmacist.${slug}@seeded.com`,
		emailVerifiedAt: new Date(),
		fullName: `${workspaceName} Lead Pharmacist`,
		passwordHash,
		role: "pharmacist",
		workspaceId,
	};

	const extraPharmacists = [...Array(5).keys()].map((index): InsertUserType => {
		const pharmacistNumber = index + 1;

		return {
			email: `pharmacist.${pharmacistNumber}.${slug}@seeded.com`,
			emailVerifiedAt: new Date(),
			fullName: `${workspaceName} Pharmacist ${pharmacistNumber}`,
			passwordHash,
			role: "pharmacist",
			workspaceId,
		};
	});

	const suspendedPharmacist: InsertUserType = {
		email: `suspended.${slug}@seeded.com`,
		emailVerifiedAt: new Date(),
		fullName: `${workspaceName} Suspended Pharmacist`,
		passwordHash,
		role: "pharmacist",
		suspendedAt: new Date("2026-01-15T09:00:00.000Z"),
		workspaceId,
	};

	return [fixedOwner, backupOwner, fixedAdmin, leadPharmacist, ...extraPharmacists, suspendedPharmacist];
};

export const seedUsers = async (seededWorkspaces: SeededWorkspaces) => {
	const passwordHash = await hashPassword(ENVIRONMENT.SEED_PASSWORD);

	const allUsers: InsertUserType[] = [];

	for (const workspace of seededWorkspaces) {
		const usersPerWorkspace = getUsersSeedData({
			passwordHash,
			workspaceId: workspace.id,
			workspaceName: workspace.name,
		});

		allUsers.push(...usersPerWorkspace);
	}

	consola.info(`Seeding ${allUsers.length} users across ${seededWorkspaces.length} workspaces...`);
	consola.info(`All users have password: "${ENVIRONMENT.SEED_PASSWORD}"`);

	const insertedUsers = await db.insert(users).values(allUsers).onConflictDoNothing().returning();

	consola.success(`Seeded ${insertedUsers.length} users.`);

	return insertedUsers;
};
