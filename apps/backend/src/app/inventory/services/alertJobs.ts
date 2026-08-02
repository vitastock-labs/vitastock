import { db } from "@vitastock/db";
import {
	drugs,
	inventoryAlertOutbox,
	inventoryAlerts,
	type SelectInventoryAlertOutboxType,
} from "@vitastock/db/schema/inventory";
import { workspaces } from "@vitastock/db/schema/workspace";
import { subDays } from "date-fns";
import { and, asc, count, eq, isNull, lt } from "drizzle-orm";
import { addEmailToQueue } from "@/services/queues/emailQueue";
import { getAlertRecipients, syncInventoryAlerts } from "./alertLifecycle";

const alertOutboxBatchSize = 50;
const dispatchedOutboxRetentionDays = 7;
const resolvedAlertRetentionDays = 180;

const getWorkspaceDate = (date: Date, timeZone: string) => {
	const parts = new Intl.DateTimeFormat("en-CA", {
		day: "2-digit",
		hour: "2-digit",
		hourCycle: "h23",
		month: "2-digit",
		timeZone,
		year: "numeric",
	}).formatToParts(date);
	const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

	return { date: `${values.year}-${values.month}-${values.day}`, hour: values.hour ?? "00" };
};

const getAlertSummary = (alert: {
	drugName: string;
	quantityAffected: number | null;
	threshold: number | null;
	type: "expired" | "expiring_soon" | "low_stock";
}) => {
	if (alert.type === "low_stock") {
		return `${alert.drugName} has ${alert.quantityAffected ?? 0} units available, below its ${alert.threshold ?? 0}-unit threshold.`;
	}

	return `${alert.drugName} has ${alert.quantityAffected ?? 0} units ${alert.type === "expired" ? "that have expired" : "approaching expiry"}.`;
};

const syncAllWorkspaceInventoryAlerts = async () => {
	const workspaceRows = await db
		.select({
			id: workspaces.id,
			lowStockThreshold: workspaces.lowStockThreshold,
			nearExpiryDays: workspaces.nearExpiryDays,
		})
		.from(workspaces);

	await Promise.all(
		workspaceRows.map((workspace) =>
			syncInventoryAlerts({
				lowStockThreshold: workspace.lowStockThreshold,
				nearExpiryDays: workspace.nearExpiryDays,
				workspaceId: workspace.id,
			})
		)
	);
};

const cleanupInventoryAlertRecords = async () => {
	await Promise.all([
		db
			.delete(inventoryAlertOutbox)
			.where(lt(inventoryAlertOutbox.dispatchedAt, subDays(new Date(), dispatchedOutboxRetentionDays))),
		db
			.delete(inventoryAlerts)
			.where(
				and(
					eq(inventoryAlerts.status, "resolved"),
					lt(inventoryAlerts.resolvedAt, subDays(new Date(), resolvedAlertRetentionDays))
				)
			),
	]);
};

export const maintainInventoryAlerts = async () => {
	await syncAllWorkspaceInventoryAlerts();
	await cleanupInventoryAlertRecords();
};

const createWorkspaceDigestOutboxRecords = async (options: {
	now: Date;
	workspace: { id: string; timezone: string };
}) => {
	const { now, workspace } = options;
	const workspaceDate = getWorkspaceDate(now, workspace.timezone);

	if (workspaceDate.hour < "08") return;

	const [activeAlertCount] = await db
		.select({ total: count() })
		.from(inventoryAlerts)
		.where(and(eq(inventoryAlerts.workspaceId, workspace.id), eq(inventoryAlerts.status, "active")));

	if (!activeAlertCount || activeAlertCount.total === 0) return;

	const recipients = await getAlertRecipients(workspace.id);

	if (recipients.length === 0) return;

	await db
		.insert(inventoryAlertOutbox)
		.values(
			recipients.map((recipient) => ({
				dedupeKey: `daily_digest:${workspace.id}:${workspaceDate.date}:${recipient.email.toLowerCase()}`,
				recipientEmail: recipient.email,
				recipientName: recipient.name,
				type: "daily_digest" as const,
				workspaceId: workspace.id,
			}))
		)
		.onConflictDoNothing();
};

export const createDueInventoryAlertDigests = async () => {
	const now = new Date();
	const workspaceRows = await db
		.select({ id: workspaces.id, timezone: workspaces.timezone })
		.from(workspaces);

	await Promise.all(
		workspaceRows.map((workspace) => createWorkspaceDigestOutboxRecords({ now, workspace }))
	);
};

const enqueueDigestEmail = async (outboxRecord: SelectInventoryAlertOutboxType) => {
	const [workspace] = await db
		.select({ name: workspaces.name })
		.from(workspaces)
		.where(eq(workspaces.id, outboxRecord.workspaceId))
		.limit(1);
	const activeAlerts = await db
		.select({
			drugName: drugs.name,
			quantityAffected: inventoryAlerts.quantityAffected,
			threshold: inventoryAlerts.threshold,
			type: inventoryAlerts.type,
		})
		.from(inventoryAlerts)
		.innerJoin(drugs, eq(inventoryAlerts.drugId, drugs.id))
		.where(
			and(
				eq(inventoryAlerts.workspaceId, outboxRecord.workspaceId),
				eq(inventoryAlerts.status, "active")
			)
		);

	if (!workspace || activeAlerts.length === 0) return;

	await addEmailToQueue({
		data: {
			alertCount: activeAlerts.length,
			alertSummaries: activeAlerts.map((alert) => getAlertSummary(alert)),
			name: outboxRecord.recipientName,
			to: { email: outboxRecord.recipientEmail, name: outboxRecord.recipientName },
			workspaceName: workspace.name,
		},
		jobId: outboxRecord.id,
		type: "inventoryAlertDigest",
	});
};

const enqueueImmediateAlertEmail = async (outboxRecord: SelectInventoryAlertOutboxType) => {
	if (!outboxRecord.alertId) return;

	const [alert] = await db
		.select({
			drugName: drugs.name,
			quantityAffected: inventoryAlerts.quantityAffected,
			threshold: inventoryAlerts.threshold,
			type: inventoryAlerts.type,
			workspaceName: workspaces.name,
		})
		.from(inventoryAlerts)
		.innerJoin(drugs, eq(inventoryAlerts.drugId, drugs.id))
		.innerJoin(workspaces, eq(inventoryAlerts.workspaceId, workspaces.id))
		.where(eq(inventoryAlerts.id, outboxRecord.alertId))
		.limit(1);

	if (!alert) return;

	await addEmailToQueue({
		data: {
			alertType: alert.type.replaceAll("_", " "),
			name: outboxRecord.recipientName,
			summary: getAlertSummary(alert),
			to: { email: outboxRecord.recipientEmail, name: outboxRecord.recipientName },
			workspaceName: alert.workspaceName,
		},
		jobId: outboxRecord.id,
		type: "inventoryAlert",
	});
};

const enqueueInventoryAlertEmail = async (outboxRecord: SelectInventoryAlertOutboxType) => {
	await (outboxRecord.type === "alert_raised" ?
		enqueueImmediateAlertEmail(outboxRecord)
	:	enqueueDigestEmail(outboxRecord));

	await db
		.update(inventoryAlertOutbox)
		.set({ dispatchedAt: new Date() })
		.where(eq(inventoryAlertOutbox.id, outboxRecord.id));

	if (!outboxRecord.alertId) return;

	await db
		.update(inventoryAlerts)
		.set({ lastNotifiedAt: new Date() })
		.where(eq(inventoryAlerts.id, outboxRecord.alertId));
};

export const enqueuePendingInventoryAlertEmails = async () => {
	const outboxRecords = await db
		.select()
		.from(inventoryAlertOutbox)
		.where(isNull(inventoryAlertOutbox.dispatchedAt))
		.orderBy(asc(inventoryAlertOutbox.createdAt))
		.limit(alertOutboxBatchSize);

	await Promise.all(
		outboxRecords.map((outboxRecord) => enqueueInventoryAlertEmail(outboxRecord))
	);
};
