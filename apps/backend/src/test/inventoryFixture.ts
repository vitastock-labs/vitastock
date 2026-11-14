import { randomUUID } from "node:crypto";
import { db } from "@vitastock/db";
import { users } from "@vitastock/db/schema/auth";
import { drugs } from "@vitastock/db/schema/inventory";
import { workspaceMemberships, workspaces } from "@vitastock/db/schema/workspace";
import { addDays, format } from "date-fns";
import { eq } from "drizzle-orm";
import { createInventoryDispenseCart, createInventoryStockLog } from "@/app/inventory/services/stock-log";

type InventoryFixtureOptions = {
	lowStockThreshold?: number;
	nearExpiryDays?: number;
};

export const createInventoryFixture = async (options: InventoryFixtureOptions = {}) => {
	const { lowStockThreshold = 10, nearExpiryDays = 90 } = options;
	const fixtureId = randomUUID();
	const email = `inventory-${fixtureId}@vitastock.test`;

	const fixture = await db.transaction(async (tx) => {
		const [workspace] = await tx
			.insert(workspaces)
			.values({
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

export type InventoryFixture = Awaited<ReturnType<typeof createInventoryFixture>>;

export const getDateFromToday = (days: number) => format(addDays(new Date(), days), "yyyy-MM-dd");

export const receiveTestStock = (options: {
	drugId: string;
	expiresInDays: number;
	fixture: InventoryFixture;
	quantity: number;
}) => {
	const { drugId, expiresInDays, fixture, quantity } = options;

	return createInventoryStockLog({
		body: {
			batchNumber: `BATCH-${expiresInDays}`,
			drugId,
			expiryDate: getDateFromToday(expiresInDays),
			logType: "stock_in",
			quantity,
		},
		idempotencyKey: randomUUID(),
		timezone: fixture.workspace.timezone,
		userId: fixture.user.id,
		workspaceId: fixture.workspace.id,
	});
};

export const createSecondTestDrug = async (fixture: InventoryFixture) => {
	const [drug] = await db
		.insert(drugs)
		.values({ genericName: "Amoxicillin", name: "Amoxil", workspaceId: fixture.workspace.id })
		.returning();

	if (!drug) {
		throw new Error("Failed to create second test drug");
	}

	return drug;
};

export const dispenseTestStock = (fixture: InventoryFixture, quantity: number) => {
	return createInventoryDispenseCart({
		body: { items: [{ drugId: fixture.drug.id, quantity, reason: "patient" }], saleType: "retail" },
		idempotencyKey: randomUUID(),
		timezone: fixture.workspace.timezone,
		userId: fixture.user.id,
		workspaceId: fixture.workspace.id,
	});
};
