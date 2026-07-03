import * as pg from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import type { SelectWorkspaceMembershipType, SelectWorkspaceType } from "./workspace";

export const users = pg.pgTable("users", {
	createdAt: pg.timestamp({ withTimezone: true }).notNull().defaultNow(),
	email: pg.text().notNull().unique(),
	emailVerifiedAt: pg.timestamp({ withTimezone: true }),
	fullName: pg.text().notNull(),
	id: pg.uuid().defaultRandom().primaryKey(),
	lastLoginAt: pg.timestamp({ withTimezone: true }).notNull().defaultNow(),
	loginRetryCount: pg.integer().notNull().default(0),
	mustChangePassword: pg.boolean().notNull().default(false),
	passwordChangedAt: pg.timestamp({ withTimezone: true }),
	passwordHash: pg.text().notNull(),
	refreshTokenArray: pg
		.jsonb()
		.notNull()
		.$type<Array<{ expiresAt: Date; issuedAt: Date; tokenHash: string }>>()
		.default([]),
	temporaryPasswordIssuedAt: pg.timestamp({ withTimezone: true }),
	updatedAt: pg
		.timestamp({ withTimezone: true })
		.notNull()
		.defaultNow()
		.$onUpdate(() => new Date()),
});

export const InsertUserSchema = createInsertSchema(users, {
	email: () => z.email("Please enter a valid email"),
	fullName: (schema) => schema.min(1, "Name is required"),
});
export const SelectUserSchema = createSelectSchema(users);

export type InsertUserType = typeof users.$inferInsert;
export type SelectUserType = typeof users.$inferSelect;

export type SessionMembershipType = Pick<
	SelectWorkspaceMembershipType,
	"id" | "role" | "status" | "suspendedAt" | "workspaceId"
>;

export type SessionWorkspaceType = Pick<
	SelectWorkspaceType,
	"alertEmail" | "id" | "lowStockThreshold" | "name" | "nearExpiryDays" | "timezone"
>;

export type SessionUserType = SelectUserType & {
	membershipId: SessionMembershipType["id"];
	role: SessionMembershipType["role"];
	status: SessionMembershipType["status"];
	suspendedAt: SessionMembershipType["suspendedAt"];
	workspaceId: SessionMembershipType["workspaceId"];
};

export const emailVerificationCodes = pg.pgTable("email_verification_codes", {
	code: pg.text().notNull().unique(),
	createdAt: pg.timestamp({ withTimezone: true }).notNull().defaultNow(),
	expiresAt: pg.timestamp({ withTimezone: true }).notNull(),
	id: pg.uuid().defaultRandom().primaryKey(),
	userId: pg
		.uuid()
		.unique()
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
});

export const passwordResetTokens = pg.pgTable("password_reset_tokens", {
	createdAt: pg.timestamp({ withTimezone: true }).defaultNow().notNull(),
	email: pg.text().unique().notNull(),
	expiresAt: pg.timestamp({ withTimezone: true }).notNull(),
	id: pg.uuid().defaultRandom().primaryKey(),
	retriedAt: pg.timestamp({ withTimezone: true }).defaultNow().notNull(),
	retryCount: pg.integer().notNull().default(1),
	tokenHash: pg.text().notNull().unique(),
	userId: pg
		.uuid()
		.unique()
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
});
