import * as pg from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

export const workspaces = pg.pgTable("workspaces", {
	alertEmail: pg.text(),
	createdAt: pg.timestamp({ withTimezone: true }).notNull().defaultNow(),
	id: pg.uuid().defaultRandom().primaryKey(),
	lowStockThreshold: pg.integer().notNull().default(10),
	name: pg.text().notNull(),
	nearExpiryDays: pg.integer().notNull().default(90),
	timezone: pg.text().notNull().default("Africa/Lagos"),
	updatedAt: pg
		.timestamp({ withTimezone: true })
		.notNull()
		.defaultNow()
		.$onUpdate(() => new Date()),
});

export const InsertWorkspaceSchema = createInsertSchema(workspaces, {
	name: (schema) => schema.min(1, "Pharmacy name is required"),
});
export const SelectWorkspaceSchema = createSelectSchema(workspaces);

export type InsertWorkspaceType = typeof workspaces.$inferInsert;
export type SelectWorkspaceType = typeof workspaces.$inferSelect;
