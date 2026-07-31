import { db } from "@vitastock/db";
import {
	drugs,
	inventoryAlertOutbox,
	inventoryAlerts,
	type SelectInventoryAlertOutboxType,
} from "@vitastock/db/schema/inventory";
import { workspaces } from "@vitastock/db/schema/workspace";
import { addMilliseconds, subMilliseconds } from "date-fns";
import { and, asc, count, eq, isNull, lt, lte, or } from "drizzle-orm";
import { appLogger } from "@/lib/logger";
import { addEmailToQueue } from "@/services/queues/emailQueue";
import { getAlertRecipients, syncInventoryAlerts } from "./alertLifecycle";
import { getAlertOutboxRetry } from "./utils/common";

const alertOutboxBatchSize = 50;
const alertOutboxLockTimeoutMs = 15 * 60 * 1000;

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

export const evaluateAllInventoryAlerts = async () => {
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

const queueWorkspaceInventoryAlertDigest = async (options: {
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

export const queueDailyInventoryAlertDigests = async () => {
	const now = new Date();
	const workspaceRows = await db
		.select({ id: workspaces.id, timezone: workspaces.timezone })
		.from(workspaces);

	await Promise.all(
		workspaceRows.map((workspace) => queueWorkspaceInventoryAlertDigest({ now, workspace }))
	);
};

const claimAlertOutboxRecords = async () => {
	const staleLockAt = subMilliseconds(new Date(), alertOutboxLockTimeoutMs);

	return db.transaction(async (tx) => {
		const now = new Date();
		const outboxRecords = await tx
			.select()
			.from(inventoryAlertOutbox)
			.where(
				and(
					isNull(inventoryAlertOutbox.dispatchedAt),
					isNull(inventoryAlertOutbox.failedAt),
					or(isNull(inventoryAlertOutbox.lockedAt), lt(inventoryAlertOutbox.lockedAt, staleLockAt)),
					or(isNull(inventoryAlertOutbox.nextAttemptAt), lte(inventoryAlertOutbox.nextAttemptAt, now))
				)
			)
			.orderBy(asc(inventoryAlertOutbox.createdAt))
			.limit(alertOutboxBatchSize)
			.for("update", { skipLocked: true });

		if (outboxRecords.length === 0) return [];

		await Promise.all(
			outboxRecords.map((outboxRecord) =>
				tx
					.update(inventoryAlertOutbox)
					.set({ lockedAt: new Date() })
					.where(eq(inventoryAlertOutbox.id, outboxRecord.id))
			)
		);

		return outboxRecords;
	});
};

const markOutboxRecordDispatched = async (outboxRecordId: string) => {
	await db
		.update(inventoryAlertOutbox)
		.set({ dispatchedAt: new Date(), lockedAt: null })
		.where(eq(inventoryAlertOutbox.id, outboxRecordId));
};

const enqueueInventoryAlertDigest = async (outboxRecord: SelectInventoryAlertOutboxType) => {
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

const enqueueImmediateInventoryAlert = async (outboxRecord: SelectInventoryAlertOutboxType) => {
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

const recordAlertOutboxFailure = async (outboxRecord: SelectInventoryAlertOutboxType, error: unknown) => {
	const { hasExhaustedRetries, nextAttemptCount, retryDelayMs } = getAlertOutboxRetry(
		outboxRecord.attemptCount
	);
	const lastError = error instanceof Error ? error.message : "Unknown alert dispatch error";

	await db
		.update(inventoryAlertOutbox)
		.set({
			attemptCount: nextAttemptCount,
			failedAt: hasExhaustedRetries ? new Date() : null,
			lastError,
			lockedAt: null,
			nextAttemptAt: hasExhaustedRetries ? null : addMilliseconds(new Date(), retryDelayMs),
		})
		.where(eq(inventoryAlertOutbox.id, outboxRecord.id));

	const message = `Failed to dispatch inventory alert outbox record ${outboxRecord.id}`;

	if (hasExhaustedRetries) {
		appLogger.critical({
			error,
			message,
			meta: { attemptCount: nextAttemptCount, outboxRecordId: outboxRecord.id },
		});
		return;
	}

	const logInfo = {
		attemptCount: nextAttemptCount,
		err: error,
		outboxRecordId: outboxRecord.id,
	};
	appLogger.structured.error(logInfo, message);
	appLogger.pretty.error(message, logInfo);
};

const dispatchInventoryAlertOutboxRecord = async (outboxRecord: SelectInventoryAlertOutboxType) => {
	try {
		switch (outboxRecord.type) {
			case "alert_raised": {
				await enqueueImmediateInventoryAlert(outboxRecord);
				break;
			}
			case "daily_digest": {
				await enqueueInventoryAlertDigest(outboxRecord);
				break;
			}
			default: {
				throw new Error("Unsupported inventory alert outbox type");
			}
		}

		await markOutboxRecordDispatched(outboxRecord.id);

		if (outboxRecord.alertId) {
			await db
				.update(inventoryAlerts)
				.set({ lastNotifiedAt: new Date() })
				.where(eq(inventoryAlerts.id, outboxRecord.alertId));
		}
	} catch (error) {
		await recordAlertOutboxFailure(outboxRecord, error);
	}
};

export const dispatchInventoryAlertOutbox = async () => {
	const outboxRecords = await claimAlertOutboxRecords();

	await Promise.all(
		outboxRecords.map((outboxRecord) => dispatchInventoryAlertOutboxRecord(outboxRecord))
	);
};
