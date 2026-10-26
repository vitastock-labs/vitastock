import { db } from "@vitastock/db";
import {
	drugs,
	INVENTORY_ALERT_STATUSES,
	inventoryAlerts,
	stockBatches,
	type SelectInventoryAlertType,
} from "@vitastock/db/schema/inventory";
import { workspaces } from "@vitastock/db/schema/workspace";
import { and, asc, desc, eq, gt, gte, isNull, lt, lte, notInArray, sql } from "drizzle-orm";
import { getInventoryStatus } from "./utils/common";
import { getWorkspaceInventoryDates } from "./utils/date";

type AlertCondition = {
	batchId?: string;
	dedupeKey: string;
	drugId: string;
	expiryDate?: string;
	quantityAffected?: number;
	threshold?: number;
	type: SelectInventoryAlertType["type"];
};
type InventoryTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

const getAlertConditions = async (
	options: {
		lowStockThreshold: number;
		nearExpiryDays: number;
		timezone: string;
		workspaceId: string;
	},
	dbClient: typeof db = db
) => {
	const { lowStockThreshold, nearExpiryDays, timezone, workspaceId } = options;
	const { nearExpiryDate, today } = getWorkspaceInventoryDates({ nearExpiryDays, timezone });
	const lowStockDrugs = await dbClient
		.select({
			drugId: drugs.id,
			lowStockThreshold: drugs.lowStockThreshold,
			totalAvailable: sql<number>`
				coalesce(sum(case when ${stockBatches.expiryDate} >= ${today} then ${stockBatches.quantityAvailable} else 0 end), 0)
			`.mapWith(Number),
		})
		.from(drugs)
		.leftJoin(
			stockBatches,
			and(eq(stockBatches.drugId, drugs.id), eq(stockBatches.workspaceId, workspaceId))
		)
		.where(and(eq(drugs.workspaceId, workspaceId), eq(drugs.isActive, true)))
		.groupBy(drugs.id);

	const expiredBatches = await dbClient
		.select({
			drugId: stockBatches.drugId,
			expiryDate: stockBatches.expiryDate,
			id: stockBatches.id,
			quantityAvailable: stockBatches.quantityAvailable,
		})
		.from(stockBatches)
		.where(
			and(
				eq(stockBatches.workspaceId, workspaceId),
				gt(stockBatches.quantityAvailable, 0),
				lt(stockBatches.expiryDate, today)
			)
		)
		.orderBy(asc(stockBatches.expiryDate));

	const nearExpiryBatches = await dbClient
		.select({
			drugId: stockBatches.drugId,
			expiryDate: stockBatches.expiryDate,
			id: stockBatches.id,
			quantityAvailable: stockBatches.quantityAvailable,
		})
		.from(stockBatches)
		.where(
			and(
				eq(stockBatches.workspaceId, workspaceId),
				gt(stockBatches.quantityAvailable, 0),
				gte(stockBatches.expiryDate, today),
				lte(stockBatches.expiryDate, nearExpiryDate)
			)
		)
		.orderBy(asc(stockBatches.expiryDate));

	return [
		// == Same stock-status rule as the inventory summary, so alerts and the table never disagree
		...lowStockDrugs.flatMap((drug) => {
			const effectiveLowStockThreshold = drug.lowStockThreshold ?? lowStockThreshold;
			const stockStatus = getInventoryStatus({
				lowStockThreshold: effectiveLowStockThreshold,
				totalAvailable: drug.totalAvailable,
			});

			if (stockStatus === "normal") {
				return [];
			}

			return [
				{
					dedupeKey: `${stockStatus}:${drug.drugId}`,
					drugId: drug.drugId,
					quantityAffected: drug.totalAvailable,
					threshold: effectiveLowStockThreshold,
					type: stockStatus,
				},
			];
		}),
		...expiredBatches.map((batch) => ({
			batchId: batch.id,
			dedupeKey: `expired:${batch.id}`,
			drugId: batch.drugId,
			expiryDate: batch.expiryDate,
			quantityAffected: batch.quantityAvailable,
			type: "expired" as const,
		})),
		...nearExpiryBatches.map((batch) => ({
			batchId: batch.id,
			dedupeKey: `expiring_soon:${batch.id}`,
			drugId: batch.drugId,
			expiryDate: batch.expiryDate,
			quantityAffected: batch.quantityAvailable,
			type: "expiring_soon" as const,
		})),
	];
};

const persistInventoryAlertChanges = async (options: {
	currentConditions: AlertCondition[];
	tx: InventoryTransaction;
	workspaceId: string;
}) => {
	const { currentConditions, tx, workspaceId } = options;
	const now = new Date();

	const storedAlerts = await tx
		.select()
		.from(inventoryAlerts)
		.where(eq(inventoryAlerts.workspaceId, workspaceId))
		.for("update");
	const storedAlertsByDedupeKey = new Map(storedAlerts.map((alert) => [alert.dedupeKey, alert]));

	for (const condition of currentConditions) {
		const storedAlert = storedAlertsByDedupeKey.get(condition.dedupeKey);

		if (storedAlert) {
			const isNewOccurrence = storedAlert.status === "resolved";

			// eslint-disable-next-line no-await-in-loop -- queries on one transaction share a single connection and run sequentially
			await tx
				.update(inventoryAlerts)
				.set({
					...condition,
					acknowledgedAt: isNewOccurrence ? null : storedAlert.acknowledgedAt,
					acknowledgedByUserId: isNewOccurrence ? null : storedAlert.acknowledgedByUserId,
					resolvedAt: null,
					status: "active",
				})
				.where(eq(inventoryAlerts.id, storedAlert.id));

			continue;
		}

		// eslint-disable-next-line no-await-in-loop -- queries on one transaction share a single connection and run sequentially
		await tx.insert(inventoryAlerts).values({ ...condition, status: "active", workspaceId });
	}

	const currentDedupeKeys = currentConditions.map((condition) => condition.dedupeKey);
	const alertsToResolveWhere =
		currentDedupeKeys.length > 0 ?
			and(
				eq(inventoryAlerts.workspaceId, workspaceId),
				eq(inventoryAlerts.status, "active"),
				notInArray(inventoryAlerts.dedupeKey, currentDedupeKeys)
			)
		:	and(eq(inventoryAlerts.workspaceId, workspaceId), eq(inventoryAlerts.status, "active"));

	await tx
		.update(inventoryAlerts)
		.set({ resolvedAt: now, status: "resolved" })
		.where(alertsToResolveWhere);
};

export const syncInventoryAlerts = async (options: {
	lowStockThreshold: number;
	nearExpiryDays: number;
	timezone: string;
	workspaceId: string;
}) => {
	const { lowStockThreshold, nearExpiryDays, timezone, workspaceId } = options;

	await db.transaction(async (tx) => {
		await tx
			.select({ id: workspaces.id })
			.from(workspaces)
			.where(eq(workspaces.id, workspaceId))
			.for("update");

		const dbClient = tx as unknown as typeof db;
		const currentConditions = await getAlertConditions(
			{ lowStockThreshold, nearExpiryDays, timezone, workspaceId },
			dbClient
		);
		await persistInventoryAlertChanges({ currentConditions, tx, workspaceId });
	});
};

const getInventoryAlertAction = (type: AlertCondition["type"]) => {
	if (type === "expired") {
		return "remove" as const;
	}

	if (type === "low_stock" || type === "out_of_stock") {
		return "restock" as const;
	}

	return "review" as const;
};

export const getPersistedInventoryAlerts = async (options: {
	status?: (typeof INVENTORY_ALERT_STATUSES)[number];
	workspaceId: string;
}) => {
	const { status = "active", workspaceId } = options;

	const rows = await db
		.select({
			acknowledgedAt: inventoryAlerts.acknowledgedAt,
			batchId: inventoryAlerts.batchId,
			batchNumber: stockBatches.batchNumber,
			drug: {
				form: drugs.form,
				genericName: drugs.genericName,
				id: drugs.id,
				isActive: drugs.isActive,
				lowStockThreshold: drugs.lowStockThreshold,
				name: drugs.name,
				retailPrice: drugs.retailPrice,
				strength: drugs.strength,
				unit: drugs.unit,
				wholesalePrice: drugs.wholesalePrice,
			},
			expiryDate: inventoryAlerts.expiryDate,
			id: inventoryAlerts.id,
			quantityAffected: inventoryAlerts.quantityAffected,
			status: inventoryAlerts.status,
			threshold: inventoryAlerts.threshold,
			type: inventoryAlerts.type,
		})
		.from(inventoryAlerts)
		.innerJoin(drugs, eq(inventoryAlerts.drugId, drugs.id))
		.leftJoin(stockBatches, eq(inventoryAlerts.batchId, stockBatches.id))
		.where(and(eq(inventoryAlerts.workspaceId, workspaceId), eq(inventoryAlerts.status, status)))
		.orderBy(desc(inventoryAlerts.createdAt));

	return rows.map((row) => ({
		...row,
		action: getInventoryAlertAction(row.type),
	}));
};

export const hasActiveInventoryAlerts = async (workspaceId: string) => {
	const [activeAlert] = await db
		.select({ id: inventoryAlerts.id })
		.from(inventoryAlerts)
		.where(and(eq(inventoryAlerts.workspaceId, workspaceId), eq(inventoryAlerts.status, "active")))
		.limit(1);

	return Boolean(activeAlert);
};

export const acknowledgeInventoryAlert = async (options: {
	alertId: string;
	userId: string;
	workspaceId: string;
}) => {
	const { alertId, userId, workspaceId } = options;

	await db
		.update(inventoryAlerts)
		.set({ acknowledgedAt: new Date(), acknowledgedByUserId: userId })
		.where(
			and(
				eq(inventoryAlerts.id, alertId),
				eq(inventoryAlerts.workspaceId, workspaceId),
				eq(inventoryAlerts.status, "active"),
				isNull(inventoryAlerts.acknowledgedAt)
			)
		);
};
