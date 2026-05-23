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

export const seedUsers = async (seededWorkspaces: SeededWorkspaces) => {
	if (seededWorkspaces.length === 0) return;

	const passwordHash = await hashPassword(ENVIRONMENT.SEED_PASSWORD);

	const allUsers: InsertUserType[] = [];

	for (const workspace of seededWorkspaces) {
		const slug = getWorkspaceSlug(workspace.name);

		const fixedOwner: InsertUserType = {
			email: `owner.${slug}@seeded.com`,
			emailVerifiedAt: new Date(),
			fullName: `Owner ${workspace.name}`,
			passwordHash,
			role: "owner",
			workspaceId: workspace.id,
		};

		const fixedPharmacist: InsertUserType = {
			email: `pharmacist.${slug}@seeded.com`,
			emailVerifiedAt: new Date(),
			fullName: `Pharmacist ${workspace.name}`,
			passwordHash,
			role: "pharmacist",
			workspaceId: workspace.id,
		};

		const extraPharmacists = [...Array(5).keys()].map((index): InsertUserType => {
			const pharmacistNumber = index + 1;

			return {
				email: `pharmacist.${pharmacistNumber}.${slug}@seeded.com`,
				emailVerifiedAt: new Date(),
				fullName: `Pharmacist ${pharmacistNumber} ${workspace.name}`,
				passwordHash,
				role: "pharmacist",
				workspaceId: workspace.id,
			};
		});

		allUsers.push(fixedOwner, fixedPharmacist, ...extraPharmacists);
	}

	consola.info(`Seeding ${allUsers.length} users across ${seededWorkspaces.length} workspaces...`);
	consola.info(`All users have password: "${ENVIRONMENT.SEED_PASSWORD}"`);

	await db.insert(users).values(allUsers).onConflictDoNothing();

	consola.success(`Seeded ${allUsers.length} users.`);

	for (const workspace of seededWorkspaces) {
		const workspaceUsers = allUsers.filter((u) => u.workspaceId === workspace.id);
		const owners = workspaceUsers.filter((u) => u.role === "owner");
		const pharmacists = workspaceUsers.filter((u) => u.role === "pharmacist");

		consola.info(`  ${workspace.name}: ${owners.length} owner, ${pharmacists.length} pharmacists`);
	}
};
