import { db } from "@vitastock/db";
import { users } from "@vitastock/db/schema/auth";
import {
	drugs,
	INVENTORY_ALERT_STATUSES,
	inventoryAlertOutbox,
	inventoryAlerts,
	stockBatches,
	type SelectInventoryAlertType,
} from "@vitastock/db/schema/inventory";
import {
	EMAIL_ALERT_DELIVERY_POLICIES,
	workspaceMemberships,
	workspaces,
} from "@vitastock/db/schema/workspace";
import {
	and,
	asc,
	count,
	desc,
	eq,
	gt,
	gte,
	inArray,
	isNull,
	lt,
	lte,
	notInArray,
	sql,
} from "drizzle-orm";
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

type AlertEmailConfiguration = {
	deliveryPolicy: typeof EMAIL_ALERT_DELIVERY_POLICIES.$inferUnion;
	recipients: Array<{ email: string; name: string }>;
};

export const canSendImmediateInventoryAlertEmail = (options: {
	deliveryPolicy: AlertEmailConfiguration["deliveryPolicy"];
	type: AlertCondition["type"];
}) => {
	const { deliveryPolicy, type } = options;

	if (deliveryPolicy === "all_immediate") {
		return true;
	}

	return deliveryPolicy === "critical_immediate" && (type === "expired" || type === "low_stock");
};

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
	const [lowStockDrugs, expiredBatches, nearExpiryBatches] = await Promise.all([
		dbClient
			.select({
				drugId: drugs.id,
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
			.groupBy(drugs.id),
		dbClient
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
			.orderBy(asc(stockBatches.expiryDate)),
		dbClient
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
			.orderBy(asc(stockBatches.expiryDate)),
	]);

	return [
		...lowStockDrugs
			.filter((drug) => drug.totalAvailable <= lowStockThreshold)
			.map((drug) => ({
				dedupeKey: `low_stock:${drug.drugId}`,
				drugId: drug.drugId,
				quantityAffected: drug.totalAvailable,
				threshold: lowStockThreshold,
				type: "low_stock" as const,
			})),
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

export const getAlertEmailConfiguration = async (
	workspaceId: string,
	dbClient: typeof db = db
): Promise<AlertEmailConfiguration | null> => {
	const [[workspace], memberships] = await Promise.all([
		dbClient
			.select({
				alertEmail: workspaces.alertEmail,
				deliveryPolicy: workspaces.emailAlertDeliveryPolicy,
				emailAlertsEnabledAt: workspaces.emailAlertsEnabledAt,
				name: workspaces.name,
			})
			.from(workspaces)
			.where(eq(workspaces.id, workspaceId))
			.limit(1),
		dbClient
			.select({ email: users.email, fullName: users.fullName })
			.from(workspaceMemberships)
			.innerJoin(users, eq(workspaceMemberships.userId, users.id))
			.where(
				and(
					eq(workspaceMemberships.workspaceId, workspaceId),
					isNull(workspaceMemberships.suspendedAt),
					inArray(workspaceMemberships.role, ["owner", "admin"])
				)
			),
	]);

	if (!workspace?.emailAlertsEnabledAt || !workspace.alertEmail) {
		return null;
	}

	const recipients = new Map<string, { email: string; name: string }>([
		[
			workspace.alertEmail.toLowerCase(),
			{
				email: workspace.alertEmail,
				name: workspace.name,
			},
		],
	]);

	for (const membership of memberships) {
		recipients.set(membership.email.toLowerCase(), {
			email: membership.email,
			name: membership.fullName,
		});
	}

	return {
		deliveryPolicy: workspace.deliveryPolicy,
		recipients: [...recipients.values()],
	};
};

const persistInventoryAlertChanges = async (options: {
	currentConditions: AlertCondition[];
	emailConfiguration: AlertEmailConfiguration | null;
	tx: InventoryTransaction;
	workspaceId: string;
}) => {
	const { currentConditions, emailConfiguration, tx, workspaceId } = options;
	const now = new Date();

	const storedAlerts = await tx
		.select()
		.from(inventoryAlerts)
		.where(eq(inventoryAlerts.workspaceId, workspaceId))
		.for("update");
	const storedAlertsByDedupeKey = new Map(storedAlerts.map((alert) => [alert.dedupeKey, alert]));

	const reconciledAlerts = await Promise.all(
		currentConditions.map(async (condition) => {
			const storedAlert = storedAlertsByDedupeKey.get(condition.dedupeKey);
			const isNewOccurrence = !storedAlert || storedAlert.status === "resolved";

			if (storedAlert) {
				const [alert] = await tx
					.update(inventoryAlerts)
					.set({
						...condition,
						acknowledgedAt: isNewOccurrence ? null : storedAlert.acknowledgedAt,
						acknowledgedByUserId: isNewOccurrence ? null : storedAlert.acknowledgedByUserId,
						lastNotifiedAt: isNewOccurrence ? null : storedAlert.lastNotifiedAt,
						resolvedAt: null,
						status: "active",
					})
					.where(eq(inventoryAlerts.id, storedAlert.id))
					.returning();

				return { alert, isNewOccurrence };
			}

			const [alert] = await tx
				.insert(inventoryAlerts)
				.values({ ...condition, status: "active", workspaceId })
				.returning();

			return { alert, isNewOccurrence };
		})
	);

	const newlyRaisedAlerts = reconciledAlerts.flatMap(({ alert, isNewOccurrence }) => {
		if (!alert || !isNewOccurrence) {
			return [];
		}

		return [alert];
	});
	const immediateAlerts = newlyRaisedAlerts.filter((alert) => {
		if (!emailConfiguration) {
			return false;
		}

		return canSendImmediateInventoryAlertEmail({
			deliveryPolicy: emailConfiguration.deliveryPolicy,
			type: alert.type,
		});
	});
	const outboxRecords =
		emailConfiguration ?
			immediateAlerts.flatMap((alert) =>
				emailConfiguration.recipients.map((recipient) => ({
					alertId: alert.id,
					dedupeKey: `alert_raised:${alert.id}:${now.toISOString()}:${recipient.email.toLowerCase()}`,
					recipientEmail: recipient.email,
					recipientName: recipient.name,
					type: "alert_raised" as const,
					workspaceId,
				}))
			)
		:	[];

	if (outboxRecords.length > 0) {
		await tx.insert(inventoryAlertOutbox).values(outboxRecords).onConflictDoNothing();
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
		const [currentConditions, emailConfiguration] = await Promise.all([
			getAlertConditions({ lowStockThreshold, nearExpiryDays, timezone, workspaceId }, dbClient),
			getAlertEmailConfiguration(workspaceId, dbClient),
		]);

		await persistInventoryAlertChanges({ currentConditions, emailConfiguration, tx, workspaceId });
	});
};

const getInventoryAlertAction = (type: AlertCondition["type"]) => {
	if (type === "expired") {
		return "remove" as const;
	}

	if (type === "low_stock") {
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
				name: drugs.name,
				strength: drugs.strength,
				unit: drugs.unit,
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

export const getUnreadInventoryAlertCount = async (workspaceId: string) => {
	const [result] = await db
		.select({ total: count() })
		.from(inventoryAlerts)
		.where(
			and(
				eq(inventoryAlerts.workspaceId, workspaceId),
				eq(inventoryAlerts.status, "active"),
				isNull(inventoryAlerts.acknowledgedAt)
			)
		);

	return result?.total ?? 0;
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
