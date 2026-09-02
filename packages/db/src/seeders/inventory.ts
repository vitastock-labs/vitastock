import { consola } from "consola";
import { addDays, format } from "date-fns";
import { and, eq, inArray, notExists, sql } from "drizzle-orm";
import { db } from "../db";
import {
	drugs,
	inventoryAlertOutbox,
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

const BATCH_SEED_IDS_BY_WORKSPACE = {
	"CityCare Pharmacy": {
		Amoxil: "20000000-0000-4000-8000-000000000001",
		Glucophage: "20000000-0000-4000-8000-000000000003",
		Lipitor: "20000000-0000-4000-8000-000000000004",
		Synthroid: "20000000-0000-4000-8000-000000000005",
		Zestril: "20000000-0000-4000-8000-000000000002",
	},
	"Greenleaf Pharmacy": {
		Amoxil: "10000000-0000-4000-8000-000000000001",
		Glucophage: "10000000-0000-4000-8000-000000000003",
		Lipitor: "10000000-0000-4000-8000-000000000004",
		Synthroid: "10000000-0000-4000-8000-000000000005",
		Zestril: "10000000-0000-4000-8000-000000000002",
	},
} as const;

const isSeedWorkspaceName = (
	workspaceName: string
): workspaceName is keyof typeof BATCH_SEED_IDS_BY_WORKSPACE => {
	return workspaceName in BATCH_SEED_IDS_BY_WORKSPACE;
};

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

const getDrugIdentityKey = (drug: InsertDrugType) => {
	return [drug.workspaceId, drug.name, drug.genericName, drug.strength, drug.form, drug.unit]
		.map((value) => value?.trim().toLowerCase() ?? "")
		.join("|");
};

const getSeedExpiryDate = (daysFromToday: number) => {
	return format(addDays(new Date(), daysFromToday), "yyyy-MM-dd");
};

const getBatchSeedData = (options: {
	drugByName: Map<string, InsertDrugType & { id: string }>;
	userId: string;
	workspaceId: string;
	workspaceName: keyof typeof BATCH_SEED_IDS_BY_WORKSPACE;
}) => {
	const { drugByName, userId, workspaceId, workspaceName } = options;
	const batchIds = BATCH_SEED_IDS_BY_WORKSPACE[workspaceName];

	const getDrugId = (name: string) => {
		const drug = drugByName.get(name);

		if (!drug) {
			throw new Error(`Missing seeded drug: ${name}`);
		}

		return drug.id;
	};

	return [
		{
			batchNumber: `AMX-${workspaceId.slice(0, 8)}`,
			drugId: getDrugId("Amoxil"),
			expiryDate: getSeedExpiryDate(180),
			id: batchIds.Amoxil,
			quantityAvailable: 1_090,
			quantityReceived: 1_200,
			unitCostKobo: 12_500,
			userId,
			workspaceId,
		},
		{
			batchNumber: `LIS-${workspaceId.slice(0, 8)}`,
			drugId: getDrugId("Zestril"),
			expiryDate: getSeedExpiryDate(30),
			id: batchIds.Zestril,
			quantityAvailable: 440,
			quantityReceived: 500,
			unitCostKobo: 8_000,
			userId,
			workspaceId,
		},
		{
			batchNumber: `MET-${workspaceId.slice(0, 8)}`,
			drugId: getDrugId("Glucophage"),
			expiryDate: getSeedExpiryDate(365),
			id: batchIds.Glucophage,
			quantityAvailable: 8,
			quantityReceived: 120,
			unitCostKobo: 10_000,
			userId,
			workspaceId,
		},
		{
			batchNumber: `ATO-${workspaceId.slice(0, 8)}`,
			drugId: getDrugId("Lipitor"),
			expiryDate: getSeedExpiryDate(-30),
			id: batchIds.Lipitor,
			quantityAvailable: 35,
			quantityReceived: 80,
			unitCostKobo: 15_000,
			userId,
			workspaceId,
		},
		{
			batchNumber: `LEV-${workspaceId.slice(0, 8)}`,
			drugId: getDrugId("Synthroid"),
			expiryDate: getSeedExpiryDate(14),
			id: batchIds.Synthroid,
			quantityAvailable: 35,
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
	const seededDrugIdentityKeys = new Set(allDrugSeeds.map((drug) => getDrugIdentityKey(drug)));
	const seededWorkspaceIds = seededWorkspaces.map((workspace) => workspace.id);

	await db
		.delete(inventoryAlertOutbox)
		.where(inArray(inventoryAlertOutbox.workspaceId, seededWorkspaceIds));

	await db.insert(drugs).values(allDrugSeeds).onConflictDoNothing();

	const persistedWorkspaceDrugs = await db
		.select()
		.from(drugs)
		.where(inArray(drugs.workspaceId, seededWorkspaceIds));
	const seededDrugIds = persistedWorkspaceDrugs
		.filter((drug) => seededDrugIdentityKeys.has(getDrugIdentityKey(drug)))
		.map((drug) => drug.id);
	const seededDrugs = await db
		.update(drugs)
		.set({ isActive: true })
		.where(inArray(drugs.id, seededDrugIds))
		.returning();

	const allBatchSeeds = seededWorkspaces.flatMap((workspace) => {
		if (!isSeedWorkspaceName(workspace.name)) {
			throw new Error(`Missing batch seed IDs for ${workspace.name}`);
		}

		const actor = getWorkspaceOwnerUser({
			seededMemberships,
			seededUsers,
			workspaceId: workspace.id,
			workspaceName: workspace.name,
		});

		const workspaceDrugByName = new Map(
			seededDrugs.filter((drug) => drug.workspaceId === workspace.id).map((drug) => [drug.name, drug])
		);

		return getBatchSeedData({
			drugByName: workspaceDrugByName,
			userId: actor.id,
			workspaceId: workspace.id,
			workspaceName: workspace.name,
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
			target: stockBatches.id,
		})
		.returning();

	await db
		.delete(stockLogs)
		.where(
			and(
				inArray(stockLogs.workspaceId, seededWorkspaceIds),
				inArray(stockLogs.notes, ["Seed opening stock", "Seed stock-out activity"])
			)
		);
	await db
		.delete(stockTransactions)
		.where(
			and(
				inArray(stockTransactions.workspaceId, seededWorkspaceIds),
				notExists(
					db
						.select({ id: stockLogs.id })
						.from(stockLogs)
						.where(eq(stockLogs.stockTransactionId, stockTransactions.id))
				)
			)
		);

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
			operation: "stock_log" as const,
			performedByUserId: stockLog.performedByUserId,
			requestHash: stockLog.stockTransactionId,
			workspaceId: stockLog.workspaceId,
		}))
	);
	await db.insert(stockLogs).values(allLogSeeds);

	consola.success(
		`Seeded ${seededDrugs.length} drugs, ${seededBatches.length} batches, and ${allLogSeeds.length} logs.`
	);
};
