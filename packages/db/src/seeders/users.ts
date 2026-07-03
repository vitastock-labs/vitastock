import { hash } from "@node-rs/argon2";
import { consola } from "consola";
import { sql } from "drizzle-orm";
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
	workspaceName: string;
}) => {
	const { passwordHash, workspaceName } = options;

	const slug = getWorkspaceSlug(workspaceName);

	const fixedOwner: InsertUserType = {
		email: `owner.${slug}@seeded.com`,
		emailVerifiedAt: new Date(),
		fullName: `${workspaceName} Owner`,
		passwordHash,
	};

	const fixedAdmin: InsertUserType = {
		email: `admin.${slug}@seeded.com`,
		emailVerifiedAt: new Date(),
		fullName: `${workspaceName} Admin`,
		passwordHash,
	};

	const leadPharmacist: InsertUserType = {
		email: `pharmacist.${slug}@seeded.com`,
		emailVerifiedAt: new Date(),
		fullName: `${workspaceName} Lead Pharmacist`,
		passwordHash,
	};

	const extraPharmacists = [...Array(5).keys()].map((index): InsertUserType => {
		const pharmacistNumber = index + 1;

		return {
			email: `pharmacist.${pharmacistNumber}.${slug}@seeded.com`,
			emailVerifiedAt: new Date(),
			fullName: `${workspaceName} Pharmacist ${pharmacistNumber}`,
			passwordHash,
		};
	});

	const suspendedPharmacist: InsertUserType = {
		email: `suspended.${slug}@seeded.com`,
		emailVerifiedAt: new Date(),
		fullName: `${workspaceName} Suspended Pharmacist`,
		passwordHash,
	};

	return [fixedOwner, fixedAdmin, leadPharmacist, ...extraPharmacists, suspendedPharmacist];
};

export const seedUsers = async (seededWorkspaces: SeededWorkspaces) => {
	const passwordHash = await hashPassword(ENVIRONMENT.SEED_PASSWORD);

	const allUsers: InsertUserType[] = [];

	for (const workspace of seededWorkspaces) {
		const usersPerWorkspace = getUsersSeedData({
			passwordHash,
			workspaceName: workspace.name,
		});

		allUsers.push(...usersPerWorkspace);
	}

	consola.info(`Seeding ${allUsers.length} users across ${seededWorkspaces.length} workspaces...`);
	consola.info(`All users have password: "${ENVIRONMENT.SEED_PASSWORD}"`);

	const seededUsers = await db
		.insert(users)
		.values(allUsers)
		.onConflictDoUpdate({
			set: {
				emailVerifiedAt: sql`excluded.email_verified_at`,
				fullName: sql`excluded.full_name`,
				passwordHash: sql`excluded.password_hash`,
			},
			target: users.email,
		})
		.returning();

	consola.success(`Seeded ${seededUsers.length} users.`);

	return seededUsers;
};
