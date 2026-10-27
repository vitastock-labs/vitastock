import { defineEnum } from "@zayne-labs/toolkit-type-helpers";
import { sql } from "drizzle-orm";
import * as pg from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { users } from "./auth";
import { workspaces } from "./workspace";

export const INVENTORY_STOCK_STATUS = defineEnum(["low_stock", "normal", "out_of_stock"], {
	inferredUnionVariant: "values",
});

export const SALE_TYPES = defineEnum(["retail", "wholesale"]);
export const PAYMENT_METHODS = defineEnum(["cash", "transfer", "pos"]);

const priceColumn = () => pg.numeric({ mode: "number", precision: 12, scale: 2 });

export const drugs = pg.pgTable(
	"drugs",
	{
		createdAt: pg.timestamp({ withTimezone: true }).notNull().defaultNow(),
		form: pg.text(),
		genericName: pg.text().notNull(),
		id: pg.uuid().defaultRandom().primaryKey(),
		isActive: pg.boolean().notNull().default(true),
		lowStockThreshold: pg.integer(),
		name: pg.text().notNull(),
		priceUpdatedAt: pg.timestamp({ withTimezone: true }),
		priceUpdatedByUserId: pg.uuid().references(() => users.id, { onDelete: "set null" }),
		retailPrice: priceColumn(),
		strength: pg.text(),
		unit: pg.text(),
		updatedAt: pg
			.timestamp({ withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
		wholesalePrice: priceColumn(),
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
		pg.check("drug_low_stock_threshold_nonnegative_check", sql`${table.lowStockThreshold} >= 0`),
		pg.check("drug_retail_price_positive_check", sql`${table.retailPrice} > 0`),
		pg.check("drug_wholesale_price_positive_check", sql`${table.wholesalePrice} > 0`),
	]
);

export const stockBatches = pg.pgTable(
	"stock_batches",
	{
		batchNumber: pg.text(),
		costPrice: priceColumn(),
		createdAt: pg.timestamp({ withTimezone: true }).notNull().defaultNow(),
		drugId: pg
			.uuid()
			.notNull()
			.references(() => drugs.id, { onDelete: "cascade" }),
		expiryDate: pg.date().notNull(),
		id: pg.uuid().defaultRandom().primaryKey(),
		quantityAvailable: pg.integer().notNull(),
		quantityReceived: pg.integer().notNull(),
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
			.uniqueIndex("stock_batch_identity_index")
			// == Cost is part of a batch's identity: the same lot delivered at a new price stays a separate
			// == batch so each sale keeps its true cost. Prices are positive, so 0 stands in for "no cost".
			.on(
				table.workspaceId,
				table.drugId,
				sql`coalesce(lower(btrim(${table.batchNumber})), '')`,
				table.expiryDate,
				sql`coalesce(${table.costPrice}, 0)`
			),
		pg.check("stock_batch_quantity_available_check", sql`${table.quantityAvailable} >= 0`),
		pg.check("stock_batch_cost_price_positive_check", sql`${table.costPrice} > 0`),
		pg.check("stock_batch_quantity_received_check", sql`${table.quantityReceived} > 0`),
		pg.check(
			"stock_batch_available_lte_received_check",
			sql`${table.quantityAvailable} <= ${table.quantityReceived}`
		),
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

export const STOCK_OUT_REASONS = defineEnum([STOCK_LOG_TYPES[0], STOCK_LOG_TYPES[1], "patient"]);

export const STOCK_LOG_PATIENT_NAME_MAX_LENGTH = 120;

export const INVENTORY_ALERT_TYPES = defineEnum(["expired", "expiring_soon", "low_stock", "out_of_stock"]);
export const INVENTORY_ALERT_STATUSES = defineEnum(["active", "resolved"]);
export const STOCK_TRANSACTION_OPERATIONS = defineEnum(["bulk_import", "dispense_cart", "stock_log"]);

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
		removedAt: pg.timestamp({ withTimezone: true }),
		removedByUserId: pg.uuid().references(() => users.id, { onDelete: "restrict" }),
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
		patientName: pg.varchar({ length: STOCK_LOG_PATIENT_NAME_MAX_LENGTH }),
		paymentMethod: pg.text({ enum: PAYMENT_METHODS }),
		performedByUserId: pg
			.uuid()
			.notNull()
			.references(() => users.id, { onDelete: "restrict" }),
		quantity: pg.integer().notNull(),
		reason: pg.text({ enum: STOCK_OUT_REASONS }),
		saleType: pg.text({ enum: SALE_TYPES }).notNull().default("retail"),
		stockTransactionId: pg
			.uuid()
			.notNull()
			.references(() => stockTransactions.id, { onDelete: "restrict" }),
		undoneAt: pg.timestamp({ withTimezone: true }),
		undoneByUserId: pg.uuid().references(() => users.id, { onDelete: "restrict" }),
		unitCostPrice: priceColumn(),
		unitSellingPrice: priceColumn(),
		workspaceId: pg
			.uuid()
			.notNull()
			.references(() => workspaces.id, { onDelete: "cascade" }),
	},
	(table) => [
		pg.index("stock_log_drug_index").on(table.drugId),
		pg.index("stock_log_workspace_created_index").on(table.workspaceId, table.createdAt),
		pg.index("stock_log_transaction_index").on(table.stockTransactionId),
		pg.index("stock_log_workspace_patient_name_index").on(table.workspaceId, table.patientName),
		pg.check("stock_log_quantity_positive_check", sql`${table.quantity} > 0`),
		pg.check("stock_log_unit_cost_price_positive_check", sql`${table.unitCostPrice} > 0`),
		pg.check("stock_log_unit_selling_price_positive_check", sql`${table.unitSellingPrice} > 0`),
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
