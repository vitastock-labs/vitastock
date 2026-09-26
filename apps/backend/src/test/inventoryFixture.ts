import { randomUUID } from "node:crypto";
import { db } from "@vitastock/db";
import { users } from "@vitastock/db/schema/auth";
import { drugs } from "@vitastock/db/schema/inventory";
import {
	workspaceMemberships,
	workspaces,
	type SelectWorkspaceType,
} from "@vitastock/db/schema/workspace";
import { eq } from "drizzle-orm";

type InventoryFixtureOptions = {
	emailAlertDeliveryPolicy?: SelectWorkspaceType["emailAlertDeliveryPolicy"];
	emailAlertsEnabled?: boolean;
	lowStockThreshold?: number;
	nearExpiryDays?: number;
};

export const createInventoryFixture = async (options: InventoryFixtureOptions = {}) => {
	const {
		emailAlertDeliveryPolicy = "critical_immediate",
		emailAlertsEnabled = true,
		lowStockThreshold = 10,
		nearExpiryDays = 90,
	} = options;
	const fixtureId = randomUUID();
	const email = `inventory-${fixtureId}@vitastock.test`;

	const fixture = await db.transaction(async (tx) => {
		const [workspace] = await tx
			.insert(workspaces)
			.values({
				alertEmail: emailAlertsEnabled ? email : null,
				emailAlertDeliveryPolicy,
				emailAlertsEnabledAt: emailAlertsEnabled ? new Date() : null,
				lowStockThreshold,
				name: `Inventory Test ${fixtureId}`,
				nearExpiryDays,
			})
			.returning();
		const [user] = await tx
			.insert(users)
			.values({
				email,
				emailVerifiedAt: new Date(),
				fullName: "Inventory Test Owner",
				passwordHash: "integration-test-password-hash",
			})
			.returning();

		if (!workspace || !user) {
			throw new Error("Failed to create inventory test fixture");
		}

		const [membership] = await tx
			.insert(workspaceMemberships)
			.values({
				role: "owner",
				userId: user.id,
				workspaceId: workspace.id,
			})
			.returning();
		const [drug] = await tx
			.insert(drugs)
			.values({
				form: "Tablet",
				genericName: "Paracetamol",
				name: `Panadol ${fixtureId}`,
				strength: "500mg",
				unit: "Pack",
				workspaceId: workspace.id,
			})
			.returning();

		if (!membership || !drug) {
			throw new Error("Failed to complete inventory test fixture");
		}

		return { drug, membership, user, workspace };
	});

	return {
		...fixture,
		async [Symbol.asyncDispose]() {
			await db.transaction(async (tx) => {
				await tx.delete(workspaces).where(eq(workspaces.id, fixture.workspace.id));
				await tx.delete(users).where(eq(users.id, fixture.user.id));
			});
		},
	};
};
