import * as pg from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { workspaces } from "./workspaces";

export const users = pg.pgTable(
	"users",
	{
		createdAt: pg.timestamp({ withTimezone: true }).notNull().defaultNow(),
		email: pg.text().notNull().unique(),
		firstName: pg.text().notNull(),
		fullName: pg.text().notNull(),
		id: pg.uuid().defaultRandom().primaryKey(),
		lastLoginAt: pg.timestamp({ withTimezone: true }).notNull().defaultNow(),
		lastName: pg.text().notNull(),
		loginRetryCount: pg.integer().notNull().default(0),
		passwordChangedAt: pg.timestamp({ withTimezone: true }),
		passwordHash: pg.text().notNull(),
		passwordResetRetriedAt: pg.timestamp({ withTimezone: true }),
		passwordResetRetryCount: pg.integer().notNull().default(0),
		passwordResetToken: pg.text(),
		passwordResetTokenExpiresAt: pg.timestamp({ withTimezone: true }),
		refreshTokenArray: pg
			.jsonb()
			.notNull()
			.$type<Array<{ expiresAt: Date; issuedAt: Date; token: string }>>()
			.default([]),
		role: pg.text({ enum: ["pharmacist", "admin"] }).notNull(),
		suspendedAt: pg.timestamp({ withTimezone: true }),
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
		pg.uniqueIndex("user_email_index").on(table.email),
		pg.index("user_workspace_index").on(table.workspaceId),
	]
);

export const emailVerificationCodes = pg.pgTable("email_verification_codes", {
	code: pg.text().notNull().unique(),
	createdAt: pg.timestamp({ withTimezone: true }).notNull().defaultNow(),
	expiresAt: pg.timestamp({ withTimezone: true }).notNull(),
	id: pg.uuid().defaultRandom().primaryKey(),
	userId: pg
		.uuid()
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
});

export const passwordResetTokens = pg.pgTable("password_reset_tokens", {
	createdAt: pg.timestamp({ withTimezone: true }).notNull().defaultNow(),
	email: pg.text().unique().notNull(),
	expiresAt: pg.timestamp({ withTimezone: true }).notNull(),
	id: pg.uuid().defaultRandom().primaryKey(),
	token: pg.text().notNull().unique(),
	userId: pg
		.uuid()
		.unique()
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
});

export const InsertUserSchema = createInsertSchema(users);
export const SelectUserSchema = createSelectSchema(users);

export type InsertUserType = typeof users.$inferInsert;
export type SelectUserType = typeof users.$inferSelect;
