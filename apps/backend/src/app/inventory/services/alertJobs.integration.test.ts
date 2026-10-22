import { randomUUID } from "node:crypto";
import { db } from "@vitastock/db";
import { inventoryAlertOutbox, inventoryAlerts } from "@vitastock/db/schema/inventory";
import { workspaces } from "@vitastock/db/schema/workspace";
import { eq } from "drizzle-orm";
import { expect, test } from "vitest";
import { createInventoryFixture, getDateFromToday } from "@/test/inventoryFixture";
import { enqueuePendingInventoryAlertEmails } from "./alertJobs";
import { syncInventoryAlerts } from "./alertLifecycle";
import { createInventoryStockLog } from "./stock-log";

test("Alert delivery - skips pending email after delivery is disabled", async () => {
	await using fixture = await createInventoryFixture();

	await syncInventoryAlerts({
		lowStockThreshold: fixture.workspace.lowStockThreshold,
		nearExpiryDays: fixture.workspace.nearExpiryDays,
		timezone: fixture.workspace.timezone,
		workspaceId: fixture.workspace.id,
	});
	await db
		.update(workspaces)
		.set({ alertEmail: null, emailAlertsEnabledAt: null })
		.where(eq(workspaces.id, fixture.workspace.id));

	await enqueuePendingInventoryAlertEmails();

	const [[alert], [outboxRecord]] = await Promise.all([
		db.select().from(inventoryAlerts).where(eq(inventoryAlerts.workspaceId, fixture.workspace.id)),
		db
			.select()
			.from(inventoryAlertOutbox)
			.where(eq(inventoryAlertOutbox.workspaceId, fixture.workspace.id)),
	]);

	expect(alert?.lastNotifiedAt).toBeNull();
	expect(outboxRecord?.dispatchedAt).toBeInstanceOf(Date);
});

test("Alert delivery - skips a pending near-expiry email after policy downgrade", async () => {
	await using fixture = await createInventoryFixture({
		emailAlertDeliveryPolicy: "all_immediate",
	});

	await createInventoryStockLog({
		body: {
			batchNumber: "BATCH-POLICY-DOWNGRADE",
			drugId: fixture.drug.id,
			expiryDate: getDateFromToday(30),
			logType: "stock_in",
			quantity: 20,
		},
		idempotencyKey: randomUUID(),
		timezone: fixture.workspace.timezone,
		userId: fixture.user.id,
		workspaceId: fixture.workspace.id,
	});
	await syncInventoryAlerts({
		lowStockThreshold: fixture.workspace.lowStockThreshold,
		nearExpiryDays: fixture.workspace.nearExpiryDays,
		timezone: fixture.workspace.timezone,
		workspaceId: fixture.workspace.id,
	});
	await db
		.update(workspaces)
		.set({ emailAlertDeliveryPolicy: "critical_immediate" })
		.where(eq(workspaces.id, fixture.workspace.id));

	await enqueuePendingInventoryAlertEmails();

	const [[alert], [outboxRecord]] = await Promise.all([
		db.select().from(inventoryAlerts).where(eq(inventoryAlerts.workspaceId, fixture.workspace.id)),
		db
			.select()
			.from(inventoryAlertOutbox)
			.where(eq(inventoryAlertOutbox.workspaceId, fixture.workspace.id)),
	]);

	expect(alert?.lastNotifiedAt).toBeNull();
	expect(outboxRecord?.dispatchedAt).toBeInstanceOf(Date);
});
