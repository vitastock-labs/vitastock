import { consola } from "consola";
import { inArray, sql } from "drizzle-orm";
import { db } from "../db";
import {
	drugs,
	stockBatches,
	stockLogs,
	stockTransactions,
	type InsertDrugType,
	type InsertStockBatchType,
	type InsertStockLogType,
} from "../schema";
import type { seedWorkspaceMemberships } from "./memberships";
import type { seedUsers } from "./users";
import type { seedWorkspaces } from "./workspaces";

type SeededUsers = Awaited<ReturnType<typeof seedUsers>>;
type SeededMemberships = Awaited<ReturnType<typeof seedWorkspaceMemberships>>;
type SeededWorkspaces = Awaited<ReturnType<typeof seedWorkspaces>>;

const getDrugSeedData = (workspaceId: string) => {
	return [
		{
			form: "Capsule",
			genericName: "Amoxicillin",
			name: "Amoxil",
			strength: "500mg",
			unit: "Pack",
			workspaceId,
		},
		{
			form: "Tablet",
			genericName: "Lisinopril",
			name: "Zestril",
			strength: "10mg",
			unit: "Box",
			workspaceId,
		},
		{
			form: "Tablet",
			genericName: "Metformin",
			name: "Glucophage",
			strength: "1000mg",
			unit: "Pack",
			workspaceId,
		},
		{
			form: "Tablet",
			genericName: "Atorvastatin",
			name: "Lipitor",
			strength: "20mg",
			unit: "Box",
			workspaceId,
		},
		{
			form: "Tablet",
			genericName: "Levothyroxine",
			name: "Synthroid",
			strength: "50mcg",
			unit: "Bottle",
			workspaceId,
		},
	] satisfies InsertDrugType[];
};

const getBatchSeedData = (options: {
	drugByName: Map<string, InsertDrugType & { id: string }>;
	userId: string;
	workspaceId: string;
}) => {
	const { drugByName, userId, workspaceId } = options;
	const nearExpiryDate = new Date();
	nearExpiryDate.setUTCDate(nearExpiryDate.getUTCDate() + 14);
	nearExpiryDate.setUTCHours(0, 0, 0, 0);

	const getDrugId = (name: string) => {
		const drug = drugByName.get(name);

		if (!drug) throw new Error(`Missing seeded drug: ${name}`);

		return drug.id;
	};

	return [
		{
			batchNumber: `AMX-${workspaceId.slice(0, 8)}`,
			drugId: getDrugId("Amoxil"),
			expiryDate: new Date("2027-02-28T00:00:00.000Z"),
			quantityAvailable: 1_090,
			quantityReceived: 1_200,
			unitCostKobo: 12_500,
			userId,
			workspaceId,
		},
		{
			batchNumber: `LIS-${workspaceId.slice(0, 8)}`,
			drugId: getDrugId("Zestril"),
			expiryDate: new Date("2026-07-20T00:00:00.000Z"),
			quantityAvailable: 440,
			quantityReceived: 500,
			unitCostKobo: 8_000,
			userId,
			workspaceId,
		},
		{
			batchNumber: `MET-${workspaceId.slice(0, 8)}`,
			drugId: getDrugId("Glucophage"),
			expiryDate: new Date("2027-01-31T00:00:00.000Z"),
			quantityAvailable: 8,
			quantityReceived: 120,
			unitCostKobo: 10_000,
			userId,
			workspaceId,
		},
		{
			batchNumber: `ATO-${workspaceId.slice(0, 8)}`,
			drugId: getDrugId("Lipitor"),
			expiryDate: new Date("2026-05-01T00:00:00.000Z"),
			quantityAvailable: 35,
			quantityReceived: 80,
			unitCostKobo: 15_000,
			userId,
			workspaceId,
		},
		{
			batchNumber: `LEV-${workspaceId.slice(0, 8)}`,
			drugId: getDrugId("Synthroid"),
			expiryDate: nearExpiryDate,
			quantityAvailable: 0,
			quantityReceived: 60,
			unitCostKobo: 18_000,
			userId,
			workspaceId,
		},
	] satisfies InsertStockBatchType[];
};

const getWorkspaceOwnerUser = (options: {
	seededMemberships: SeededMemberships;
	seededUsers: SeededUsers;
	workspaceId: string;
	workspaceName: string;
}) => {
	const { seededMemberships, seededUsers, workspaceId, workspaceName } = options;

	const ownerMembership = seededMemberships.find(
		(membership) => membership.workspaceId === workspaceId && membership.role === "owner"
	);

	if (!ownerMembership) {
		throw new Error(`Missing seeded owner membership for ${workspaceName}`);
	}

	const ownerUser = seededUsers.find((user) => user.id === ownerMembership.userId);

	if (!ownerUser) {
		throw new Error(`Missing seeded owner user for ${workspaceName}`);
	}

	return ownerUser;
};

export const seedInventory = async (
	seededUsers: SeededUsers,
	seededMemberships: SeededMemberships,
	seededWorkspaces: SeededWorkspaces
) => {
	consola.info(`Seeding inventory for ${seededWorkspaces.length} workspaces...`);

	const allDrugSeeds = seededWorkspaces.flatMap((workspace) => getDrugSeedData(workspace.id));

	const seededDrugs = await db
		.insert(drugs)
		.values(allDrugSeeds)
		.onConflictDoUpdate({
			set: {
				isActive: sql`excluded.is_active`,
			},
			target: [
				drugs.workspaceId,
				drugs.name,
				drugs.genericName,
				drugs.strength,
				drugs.form,
				drugs.unit,
			],
		})
		.returning();

	const allBatchSeeds = seededWorkspaces.flatMap((workspace) => {
		const actor = getWorkspaceOwnerUser({
			seededMemberships,
			seededUsers,
			workspaceId: workspace.id,
			workspaceName: workspace.name,
		});

		const workspaceDrugs = new Map(
			seededDrugs.filter((drug) => drug.workspaceId === workspace.id).map((drug) => [drug.name, drug])
		);

		return getBatchSeedData({
			drugByName: workspaceDrugs,
			userId: actor.id,
			workspaceId: workspace.id,
		});
	});

	const seededBatches = await db
		.insert(stockBatches)
		.values(allBatchSeeds)
		.onConflictDoUpdate({
			set: {
				drugId: sql`excluded.drug_id`,
				expiryDate: sql`excluded.expiry_date`,
				quantityAvailable: sql`excluded.quantity_available`,
				quantityReceived: sql`excluded.quantity_received`,
				unitCostKobo: sql`excluded.unit_cost_kobo`,
			},
			target: [stockBatches.workspaceId, stockBatches.drugId, stockBatches.batchNumber],
		})
		.returning();

	const seededDrugIds = seededDrugs.map((drug) => drug.id);
	const seededWorkspaceIds = seededWorkspaces.map((workspace) => workspace.id);

	await db.delete(stockLogs).where(inArray(stockLogs.drugId, seededDrugIds));
	await db.delete(stockTransactions).where(inArray(stockTransactions.workspaceId, seededWorkspaceIds));

	const allLogSeeds = seededWorkspaces.flatMap((workspace) => {
		const actor = getWorkspaceOwnerUser({
			seededMemberships,
			seededUsers,
			workspaceId: workspace.id,
			workspaceName: workspace.name,
		});

		const workspaceBatches = seededBatches.filter((batch) => batch.workspaceId === workspace.id);

		return workspaceBatches.flatMap((batch): InsertStockLogType[] => {
			const batchLogs: InsertStockLogType[] = [
				{
					batchId: batch.id,
					drugId: batch.drugId,
					logType: "opening_stock",
					notes: "Seed opening stock",
					performedByUserId: actor.id,
					quantity: batch.quantityReceived,
					stockTransactionId: crypto.randomUUID(),
					unitCostKobo: batch.unitCostKobo,
					workspaceId: workspace.id,
				},
			];

			if (batch.quantityReceived > batch.quantityAvailable) {
				batchLogs.push({
					batchId: batch.id,
					drugId: batch.drugId,
					logType: "stock_out" as const,
					notes: "Seed stock-out activity",
					performedByUserId: actor.id,
					quantity: batch.quantityReceived - batch.quantityAvailable,
					reason: "patient",
					stockTransactionId: crypto.randomUUID(),
					unitCostKobo: batch.unitCostKobo,
					workspaceId: workspace.id,
				});
			}

			return batchLogs;
		});
	});

	await db.insert(stockTransactions).values(
		allLogSeeds.map((stockLog) => ({
			id: stockLog.stockTransactionId,
			idempotencyKey: stockLog.stockTransactionId,
			performedByUserId: stockLog.performedByUserId,
			workspaceId: stockLog.workspaceId,
		}))
	);
	await db.insert(stockLogs).values(allLogSeeds);

	consola.success(
		`Seeded ${seededDrugs.length} drugs, ${seededBatches.length} batches, and ${allLogSeeds.length} logs.`
	);
};
