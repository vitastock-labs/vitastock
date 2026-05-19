import { faker } from "@faker-js/faker";
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

const generateFakeUser = (
	role: InsertUserType["role"],
	workspaceId: string,
	passwordHash: string
): InsertUserType => {
	const firstName = faker.person.firstName();
	const lastName = faker.person.lastName();

	return {
		email: faker.internet.email({ firstName, lastName, provider: "seeded.com" }).toLowerCase(),
		firstName,
		fullName: `${firstName} ${lastName}`,
		lastName,
		passwordHash,
		role,
		workspaceId,
	};
};

export const seedUsers = async (seededWorkspaces: SeededWorkspaces) => {
	if (seededWorkspaces.length === 0) return;

	const passwordHash = await hashPassword(ENVIRONMENT.SEED_PASSWORD);

	const allUsers: InsertUserType[] = [];

	for (const workspace of seededWorkspaces) {
		const slug = workspace.name.toLowerCase().replaceAll(/\s+/g, "");

		const fixedAdmin: InsertUserType = {
			email: `admin.${slug}@seeded.com`,
			firstName: "Admin",
			fullName: `Admin ${workspace.name}`,
			lastName: workspace.name,
			passwordHash,
			role: "admin",
			workspaceId: workspace.id,
		};

		const fixedPharmacist: InsertUserType = {
			email: `pharmacist.${slug}@seeded.com`,
			firstName: "Sarutobi",
			fullName: `Sarutobi ${workspace.name}`,
			lastName: workspace.name,
			passwordHash,
			role: "pharmacist",
			workspaceId: workspace.id,
		};

		const extraPharmacists = [...Array(5).keys()].map(() => {
			return generateFakeUser("pharmacist", workspace.id, passwordHash);
		});

		allUsers.push(fixedAdmin, fixedPharmacist, ...extraPharmacists);
	}

	consola.info(`Seeding ${allUsers.length} users across ${seededWorkspaces.length} workspaces...`);
	consola.info(`All users have password: "${ENVIRONMENT.SEED_PASSWORD}"`);

	await db.insert(users).values(allUsers).onConflictDoNothing();

	consola.success(`Seeded ${allUsers.length} users.`);

	for (const workspace of seededWorkspaces) {
		const workspaceUsers = allUsers.filter((u) => u.workspaceId === workspace.id);
		const admins = workspaceUsers.filter((u) => u.role === "admin");
		const pharmacists = workspaceUsers.filter((u) => u.role === "pharmacist");

		consola.info(`  ${workspace.name}: ${admins.length} admin, ${pharmacists.length} pharmacists`);
	}
};
