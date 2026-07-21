import { defineEnum } from "@zayne-labs/toolkit-type-helpers";
import { sql } from "drizzle-orm";
import * as pg from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { users } from "./auth";
import { workspaces } from "./workspace";

export const INVENTORY_STATUS = defineEnum(["expired", "low_stock", "normal", "out_of_stock"], {
	inferredUnionVariant: "values",
});

export const drugs = pg.pgTable(
	"drugs",
	{
		createdAt: pg.timestamp({ withTimezone: true }).notNull().defaultNow(),
		form: pg.text().notNull(),
		id: pg.uuid().defaultRandom().primaryKey(),
		isActive: pg.boolean().notNull().default(true),
		name: pg.text().notNull(),
		strength: pg.text().notNull(),
		unit: pg.text().notNull(),
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
		pg
			.uniqueIndex("drug_workspace_name_strength_form_index")
			.on(table.workspaceId, table.name, table.strength, table.form),
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
		expiryDate: pg.timestamp({ withTimezone: true }).notNull(),
		id: pg.uuid().defaultRandom().primaryKey(),
		quantityAvailable: pg.integer().notNull(),
		quantityReceived: pg.integer().notNull(),
		unitCostKobo: pg.integer().notNull().default(0),
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
			.uniqueIndex("stock_batch_workspace_drug_batch_number_index")
			.on(table.workspaceId, table.drugId, table.batchNumber),
		pg.check("stock_batch_quantity_available_check", sql`${table.quantityAvailable} >= 0`),
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

export const STOCK_OUT_REASONS = defineEnum([STOCK_LOG_TYPES[0], STOCK_LOG_TYPES[1], "patient", "ward"]);

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
		stockTransactionId: pg.uuid(),
		unitCostKobo: pg.integer().notNull().default(0),
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
	]
);

export const InsertDrugSchema = createInsertSchema(drugs);
export const SelectDrugSchema = createSelectSchema(drugs);
export const InsertStockBatchSchema = createInsertSchema(stockBatches);
export const SelectStockBatchSchema = createSelectSchema(stockBatches);
export const InsertStockLogSchema = createInsertSchema(stockLogs);
export const SelectStockLogSchema = createSelectSchema(stockLogs);

export type InsertDrugType = typeof drugs.$inferInsert;
export type SelectDrugType = typeof drugs.$inferSelect;
export type InsertStockBatchType = typeof stockBatches.$inferInsert;
export type SelectStockBatchType = typeof stockBatches.$inferSelect;
export type InsertStockLogType = typeof stockLogs.$inferInsert;
export type SelectStockLogType = typeof stockLogs.$inferSelect;
