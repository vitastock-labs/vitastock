import { randomUUID } from "node:crypto";
import { db } from "@vitastock/db";
import { inventoryAlertOutbox, inventoryAlerts } from "@vitastock/db/schema/inventory";
import { and, asc, eq } from "drizzle-orm";
import { expect, test } from "vitest";
import { createInventoryFixture, getDateFromToday, receiveTestStock } from "@/test/inventoryFixture";
import { acknowledgeInventoryAlert, syncInventoryAlerts } from "./alertLifecycle";
import { createInventoryStockLog } from "./stock-log";

test("Alert lifecycle - replaces low stock with out of stock at zero units", async () => {
	await using fixture = await createInventoryFixture({
		emailAlertsEnabled: false,
		lowStockThreshold: 10,
	});
	const syncAlerts = () =>
		syncInventoryAlerts({
			lowStockThreshold: fixture.workspace.lowStockThreshold,
			nearExpiryDays: fixture.workspace.nearExpiryDays,
			timezone: fixture.workspace.timezone,
			workspaceId: fixture.workspace.id,
		});
	const getAlerts = () =>
		db
			.select()
			.from(inventoryAlerts)
			.where(eq(inventoryAlerts.workspaceId, fixture.workspace.id))
			.orderBy(asc(inventoryAlerts.createdAt));

	await receiveTestStock({ drugId: fixture.drug.id, expiresInDays: 180, fixture, quantity: 5 });
	await syncAlerts();

	expect(await getAlerts()).toEqual([
		expect.objectContaining({ quantityAffected: 5, status: "active", type: "low_stock" }),
	]);

	await createInventoryStockLog({
		body: { drugId: fixture.drug.id, logType: "stock_out", quantity: 5, reason: "patient" },
		idempotencyKey: randomUUID(),
		timezone: fixture.workspace.timezone,
		userId: fixture.user.id,
		workspaceId: fixture.workspace.id,
	});
	await syncAlerts();

	expect(await getAlerts()).toEqual([
		expect.objectContaining({ status: "resolved", type: "low_stock" }),
		expect.objectContaining({
			quantityAffected: 0,
			status: "active",
			threshold: 10,
			type: "out_of_stock",
		}),
	]);
});

test("Alert lifecycle - deduplicates, resolves, and reactivates low-stock alerts", async () => {
	await using fixture = await createInventoryFixture({ lowStockThreshold: 10 });
	const syncAlerts = () =>
		syncInventoryAlerts({
			lowStockThreshold: fixture.workspace.lowStockThreshold,
			nearExpiryDays: fixture.workspace.nearExpiryDays,
			timezone: fixture.workspace.timezone,
			workspaceId: fixture.workspace.id,
		});

	await receiveTestStock({ drugId: fixture.drug.id, expiresInDays: 180, fixture, quantity: 5 });
	await Promise.all([syncAlerts(), syncAlerts()]);

	let alerts = await db
		.select()
		.from(inventoryAlerts)
		.where(eq(inventoryAlerts.workspaceId, fixture.workspace.id));
	let outboxRecords = await db
		.select()
		.from(inventoryAlertOutbox)
		.where(eq(inventoryAlertOutbox.workspaceId, fixture.workspace.id));

	expect(alerts).toHaveLength(1);
	expect(alerts[0]?.status).toBe("active");
	expect(outboxRecords).toHaveLength(1);

	await createInventoryStockLog({
		body: {
			batchNumber: "BATCH-ALERT",
			drugId: fixture.drug.id,
			expiryDate: getDateFromToday(180),
			logType: "stock_in",
			quantity: 20,
		},
		idempotencyKey: randomUUID(),
		timezone: fixture.workspace.timezone,
		userId: fixture.user.id,
		workspaceId: fixture.workspace.id,
	});
	await syncAlerts();

	alerts = await db
		.select()
		.from(inventoryAlerts)
		.where(eq(inventoryAlerts.workspaceId, fixture.workspace.id));

	expect(alerts[0]?.status).toBe("resolved");
	expect(alerts[0]?.resolvedAt).toBeInstanceOf(Date);

	await createInventoryStockLog({
		body: {
			drugId: fixture.drug.id,
			logType: "stock_out",
			quantity: 20,
			reason: "patient",
		},
		idempotencyKey: randomUUID(),
		timezone: fixture.workspace.timezone,
		userId: fixture.user.id,
		workspaceId: fixture.workspace.id,
	});
	await new Promise((resolve) => setTimeout(resolve, 2));
	await syncAlerts();

	alerts = await db
		.select()
		.from(inventoryAlerts)
		.where(eq(inventoryAlerts.workspaceId, fixture.workspace.id));
	outboxRecords = await db
		.select()
		.from(inventoryAlertOutbox)
		.where(eq(inventoryAlertOutbox.workspaceId, fixture.workspace.id));

	expect(alerts).toHaveLength(1);
	expect(alerts[0]).toMatchObject({
		acknowledgedAt: null,
		quantityAffected: 5,
		resolvedAt: null,
		status: "active",
	});
	expect(outboxRecords).toHaveLength(2);
});

test.each([
	{ emailAlertsEnabled: false, expectedOutboxCount: 0, policy: "critical_immediate" as const },
	{ emailAlertsEnabled: true, expectedOutboxCount: 0, policy: "digest_only" as const },
	{ emailAlertsEnabled: true, expectedOutboxCount: 1, policy: "critical_immediate" as const },
	{ emailAlertsEnabled: true, expectedOutboxCount: 1, policy: "all_immediate" as const },
])(
	"Alert outbox - persists out-of-stock alerts with $policy policy",
	async ({ emailAlertsEnabled, expectedOutboxCount, policy }) => {
		await using fixture = await createInventoryFixture({
			emailAlertDeliveryPolicy: policy,
			emailAlertsEnabled,
		});

		await syncInventoryAlerts({
			lowStockThreshold: fixture.workspace.lowStockThreshold,
			nearExpiryDays: fixture.workspace.nearExpiryDays,
			timezone: fixture.workspace.timezone,
			workspaceId: fixture.workspace.id,
		});

		const [alerts, outboxRecords] = await Promise.all([
			db.select().from(inventoryAlerts).where(eq(inventoryAlerts.workspaceId, fixture.workspace.id)),
			db
				.select()
				.from(inventoryAlertOutbox)
				.where(eq(inventoryAlertOutbox.workspaceId, fixture.workspace.id)),
		]);

		expect(alerts).toHaveLength(1);
		expect(alerts[0]?.type).toBe("out_of_stock");
		expect(outboxRecords).toHaveLength(expectedOutboxCount);
	}
);

test.each([
	{ expectedOutboxCount: 0, policy: "critical_immediate" as const },
	{ expectedOutboxCount: 1, policy: "all_immediate" as const },
])(
	"Alert outbox - handles near-expiry alerts with $policy policy",
	async ({ expectedOutboxCount, policy }) => {
		await using fixture = await createInventoryFixture({ emailAlertDeliveryPolicy: policy });

		await createInventoryStockLog({
			body: {
				batchNumber: "BATCH-NEAR-EXPIRY",
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

		const [alerts, outboxRecords] = await Promise.all([
			db.select().from(inventoryAlerts).where(eq(inventoryAlerts.workspaceId, fixture.workspace.id)),
			db
				.select()
				.from(inventoryAlertOutbox)
				.where(eq(inventoryAlertOutbox.workspaceId, fixture.workspace.id)),
		]);

		expect(alerts).toHaveLength(1);
		expect(alerts[0]?.type).toBe("expiring_soon");
		expect(outboxRecords).toHaveLength(expectedOutboxCount);
	}
);

test("Alert acknowledgement - cannot acknowledge another workspace's alert", async () => {
	await using firstFixture = await createInventoryFixture();
	await using secondFixture = await createInventoryFixture();

	await syncInventoryAlerts({
		lowStockThreshold: firstFixture.workspace.lowStockThreshold,
		nearExpiryDays: firstFixture.workspace.nearExpiryDays,
		timezone: firstFixture.workspace.timezone,
		workspaceId: firstFixture.workspace.id,
	});

	const [alert] = await db
		.select()
		.from(inventoryAlerts)
		.where(eq(inventoryAlerts.workspaceId, firstFixture.workspace.id));

	if (!alert) {
		throw new Error("Expected the fixture to raise a low-stock alert");
	}

	await acknowledgeInventoryAlert({
		alertId: alert.id,
		userId: secondFixture.user.id,
		workspaceId: secondFixture.workspace.id,
	});

	const [unchangedAlert] = await db
		.select()
		.from(inventoryAlerts)
		.where(
			and(eq(inventoryAlerts.id, alert.id), eq(inventoryAlerts.workspaceId, firstFixture.workspace.id))
		);

	expect(unchangedAlert?.acknowledgedAt).toBeNull();
	expect(unchangedAlert?.acknowledgedByUserId).toBeNull();
});
