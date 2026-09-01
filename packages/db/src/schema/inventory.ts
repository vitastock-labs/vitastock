import { defineEnum } from "@zayne-labs/toolkit-type-helpers";
import { sql } from "drizzle-orm";
import * as pg from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { users } from "./auth";
import { workspaces } from "./workspace";

export const INVENTORY_STOCK_STATUS = defineEnum(["low_stock", "normal", "out_of_stock"], {
	inferredUnionVariant: "values",
});

export const drugs = pg.pgTable(
	"drugs",
	{
		createdAt: pg.timestamp({ withTimezone: true }).notNull().defaultNow(),
		form: pg.text(),
		genericName: pg.text().notNull(),
		id: pg.uuid().defaultRandom().primaryKey(),
		isActive: pg.boolean().notNull().default(true),
		name: pg.text().notNull(),
		strength: pg.text(),
		unit: pg.text(),
		updatedAt: pg
			.timestamp({ withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
		workspaceId: pg
			.uuid()
			.notNull()
			.references(() => workspaces.id, { onDelete: "cascade" }),
	},
	(table) => [
		// TODO: Add a pg_trgm GIN index for brand/generic/strength/form/unit search when catalogue size warrants it.
		pg
			.uniqueIndex("drug_workspace_identity_index")
			.on(
				table.workspaceId,
				sql`lower(btrim(${table.name}))`,
				sql`lower(btrim(${table.genericName}))`,
				sql`coalesce(lower(btrim(${table.strength})), '')`,
				sql`coalesce(lower(btrim(${table.form})), '')`,
				sql`coalesce(lower(btrim(${table.unit})), '')`
			),
	]
);

export const stockBatches = pg.pgTable(
	"stock_batches",
	{
		batchNumber: pg.text(),
		createdAt: pg.timestamp({ withTimezone: true }).notNull().defaultNow(),
		drugId: pg
			.uuid()
			.notNull()
			.references(() => drugs.id, { onDelete: "cascade" }),
		expiryDate: pg.date().notNull(),
		id: pg.uuid().defaultRandom().primaryKey(),
		quantityAvailable: pg.integer().notNull(),
		quantityReceived: pg.integer().notNull(),
		unitCostKobo: pg.integer(),
		updatedAt: pg
			.timestamp({ withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
		userId: pg
			.uuid()
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		workspaceId: pg
			.uuid()
			.notNull()
			.references(() => workspaces.id, { onDelete: "cascade" }),
	},
	(table) => [
		pg.index("stock_batch_drug_index").on(table.drugId),
		pg.index("stock_batch_workspace_expiry_index").on(table.workspaceId, table.expiryDate),
		pg
			.uniqueIndex("stock_batch_receipt_layer_index")
			.on(
				table.workspaceId,
				table.drugId,
				sql`coalesce(lower(btrim(${table.batchNumber})), '')`,
				table.expiryDate,
				sql`coalesce(${table.unitCostKobo}, -1)`
			),
		pg.check("stock_batch_quantity_available_check", sql`${table.quantityAvailable} >= 0`),
		pg.check("stock_batch_quantity_received_check", sql`${table.quantityReceived} > 0`),
		pg.check(
			"stock_batch_available_lte_received_check",
			sql`${table.quantityAvailable} <= ${table.quantityReceived}`
		),
		pg.check("stock_batch_unit_cost_non_negative_check", sql`${table.unitCostKobo} >= 0`),
	]
);

export const STOCK_LOG_TYPES = defineEnum([
	"damaged",
	"expired",
	"opening_stock",
	"reconciliation",
	"stock_in",
	"stock_out",
]);

export const STOCK_OUT_REASONS = defineEnum([STOCK_LOG_TYPES[0], STOCK_LOG_TYPES[1], "patient", "ward"]);

export const INVENTORY_ALERT_TYPES = defineEnum(["expired", "expiring_soon", "low_stock"]);
export const INVENTORY_ALERT_STATUSES = defineEnum(["active", "resolved"]);
export const INVENTORY_ALERT_OUTBOX_TYPES = defineEnum(["alert_raised", "daily_digest"]);
export const STOCK_TRANSACTION_OPERATIONS = defineEnum(["bulk_import", "stock_log"]);

export const stockTransactions = pg.pgTable(
	"stock_transactions",
	{
		createdAt: pg.timestamp({ withTimezone: true }).notNull().defaultNow(),
		id: pg.uuid().defaultRandom().primaryKey(),
		idempotencyKey: pg.uuid().notNull(),
		operation: pg.text({ enum: STOCK_TRANSACTION_OPERATIONS }).notNull(),
		performedByUserId: pg
			.uuid()
			.notNull()
			.references(() => users.id, { onDelete: "restrict" }),
		requestHash: pg.text().notNull(),
		workspaceId: pg
			.uuid()
			.notNull()
			.references(() => workspaces.id, { onDelete: "cascade" }),
	},
	(table) => [
		pg
			.uniqueIndex("stock_transaction_workspace_idempotency_key_index")
			.on(table.workspaceId, table.idempotencyKey),
		pg.index("stock_transaction_workspace_created_index").on(table.workspaceId, table.createdAt),
	]
);

export const stockLogs = pg.pgTable(
	"stock_logs",
	{
		batchId: pg.uuid().references(() => stockBatches.id, { onDelete: "set null" }),
		createdAt: pg.timestamp({ withTimezone: true }).notNull().defaultNow(),
		drugId: pg
			.uuid()
			.notNull()
			.references(() => drugs.id, { onDelete: "cascade" }),
		id: pg.uuid().defaultRandom().primaryKey(),
		logType: pg.text({ enum: STOCK_LOG_TYPES }).notNull(),
		notes: pg.text(),
		performedByUserId: pg
			.uuid()
			.notNull()
			.references(() => users.id, { onDelete: "restrict" }),
		quantity: pg.integer().notNull(),
		reason: pg.text({ enum: STOCK_OUT_REASONS }),
		stockTransactionId: pg
			.uuid()
			.notNull()
			.references(() => stockTransactions.id, { onDelete: "restrict" }),
		unitCostKobo: pg.integer(),
		workspaceId: pg
			.uuid()
			.notNull()
			.references(() => workspaces.id, { onDelete: "cascade" }),
	},
	(table) => [
		pg.index("stock_log_drug_index").on(table.drugId),
		pg.index("stock_log_workspace_created_index").on(table.workspaceId, table.createdAt),
		pg.index("stock_log_transaction_index").on(table.stockTransactionId),
		pg.check("stock_log_quantity_positive_check", sql`${table.quantity} > 0`),
		pg.check("stock_log_unit_cost_non_negative_check", sql`${table.unitCostKobo} >= 0`),
	]
);

export const inventoryAlerts = pg.pgTable(
	"inventory_alerts",
	{
		acknowledgedAt: pg.timestamp({ withTimezone: true }),
		acknowledgedByUserId: pg.uuid().references(() => users.id, { onDelete: "set null" }),
		batchId: pg.uuid().references(() => stockBatches.id, { onDelete: "set null" }),
		createdAt: pg.timestamp({ withTimezone: true }).notNull().defaultNow(),
		dedupeKey: pg.text().notNull(),
		drugId: pg
			.uuid()
			.notNull()
			.references(() => drugs.id, { onDelete: "cascade" }),
		expiryDate: pg.date(),
		id: pg.uuid().defaultRandom().primaryKey(),
		lastNotifiedAt: pg.timestamp({ withTimezone: true }),
		quantityAffected: pg.integer(),
		resolvedAt: pg.timestamp({ withTimezone: true }),
		status: pg.text({ enum: INVENTORY_ALERT_STATUSES }).notNull().default("active"),
		threshold: pg.integer(),
		type: pg.text({ enum: INVENTORY_ALERT_TYPES }).notNull(),
		updatedAt: pg
			.timestamp({ withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
		workspaceId: pg
			.uuid()
			.notNull()
			.references(() => workspaces.id, { onDelete: "cascade" }),
	},
	(table) => [
		pg.uniqueIndex("inventory_alert_workspace_dedupe_key_index").on(table.workspaceId, table.dedupeKey),
		pg
			.index("inventory_alert_workspace_status_created_index")
			.on(table.workspaceId, table.status, table.createdAt),
		pg.index("inventory_alert_workspace_acknowledged_index").on(table.workspaceId, table.acknowledgedAt),
	]
);

export const inventoryAlertOutbox = pg.pgTable(
	"inventory_alert_outbox",
	{
		alertId: pg.uuid().references(() => inventoryAlerts.id, { onDelete: "cascade" }),
		createdAt: pg.timestamp({ withTimezone: true }).notNull().defaultNow(),
		dedupeKey: pg.text().notNull(),
		dispatchedAt: pg.timestamp({ withTimezone: true }),
		id: pg.uuid().defaultRandom().primaryKey(),
		recipientEmail: pg.text().notNull(),
		recipientName: pg.text().notNull(),
		type: pg.text({ enum: INVENTORY_ALERT_OUTBOX_TYPES }).notNull(),
		workspaceId: pg
			.uuid()
			.notNull()
			.references(() => workspaces.id, { onDelete: "cascade" }),
	},
	(table) => [
		pg.uniqueIndex("inventory_alert_outbox_dedupe_key_index").on(table.dedupeKey),
		pg.index("inventory_alert_outbox_dispatched_at_index").on(table.dispatchedAt),
	]
);

export const InsertDrugSchema = createInsertSchema(drugs);
export const SelectDrugSchema = createSelectSchema(drugs);
export const InsertStockBatchSchema = createInsertSchema(stockBatches);
export const SelectStockBatchSchema = createSelectSchema(stockBatches);
export const InsertStockTransactionSchema = createInsertSchema(stockTransactions);
export const SelectStockTransactionSchema = createSelectSchema(stockTransactions);
export const InsertStockLogSchema = createInsertSchema(stockLogs);
export const SelectStockLogSchema = createSelectSchema(stockLogs);
export const InsertInventoryAlertSchema = createInsertSchema(inventoryAlerts);
export const SelectInventoryAlertSchema = createSelectSchema(inventoryAlerts);
export const InsertInventoryAlertOutboxSchema = createInsertSchema(inventoryAlertOutbox);
export const SelectInventoryAlertOutboxSchema = createSelectSchema(inventoryAlertOutbox);

export type InsertDrugType = typeof drugs.$inferInsert;
export type SelectDrugType = typeof drugs.$inferSelect;
export type InsertStockBatchType = typeof stockBatches.$inferInsert;
export type SelectStockBatchType = typeof stockBatches.$inferSelect;
export type InsertStockTransactionType = typeof stockTransactions.$inferInsert;
export type SelectStockTransactionType = typeof stockTransactions.$inferSelect;
export type InsertStockLogType = typeof stockLogs.$inferInsert;
export type SelectStockLogType = typeof stockLogs.$inferSelect;
export type InsertInventoryAlertType = typeof inventoryAlerts.$inferInsert;
export type SelectInventoryAlertType = typeof inventoryAlerts.$inferSelect;
export type InsertInventoryAlertOutboxType = typeof inventoryAlertOutbox.$inferInsert;
export type SelectInventoryAlertOutboxType = typeof inventoryAlertOutbox.$inferSelect;
