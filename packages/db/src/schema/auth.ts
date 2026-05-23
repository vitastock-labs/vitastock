import { defineEnum } from "@zayne-labs/toolkit-type-helpers";
import * as pg from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { workspaces } from "./workspaces";

const ROLES = defineEnum(["owner", "admin", "pharmacist"]);

export const users = pg.pgTable(
	"users",
	{
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
		role: pg.text({ enum: ROLES }).notNull(),
		suspendedAt: pg.timestamp({ withTimezone: true }),
		temporaryPasswordIssuedAt: pg.timestamp({ withTimezone: true }),
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

export const InsertUserSchema = createInsertSchema(users, {
	email: () => z.email("Please enter a valid email"),
	fullName: (schema) => schema.min(1, "Name is required"),
});
export const SelectUserSchema = createSelectSchema(users);

export type InsertUserType = typeof users.$inferInsert;
export type SelectUserType = typeof users.$inferSelect;

export const workspaceInvitations = pg.pgTable(
	"workspace_invitations",
	{
		acceptedAt: pg.timestamp({ withTimezone: true }),
		createdAt: pg.timestamp({ withTimezone: true }).notNull().defaultNow(),
		defaultPasswordHash: pg.text().notNull(),
		expiresAt: pg.timestamp({ withTimezone: true }).notNull(),
		id: pg.uuid().defaultRandom().primaryKey(),
		invitedByUserId: pg
			.uuid()
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		inviteeEmail: pg.text().notNull(),
		inviteeName: pg.text().notNull(),
		role: pg.text({ enum: ROLES }).notNull().default("pharmacist"),
		tokenHash: pg.text().notNull().unique(),
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
		pg.index("workspace_invitation_email_index").on(table.inviteeEmail),
		pg.index("workspace_invitation_workspace_index").on(table.workspaceId),
	]
);

export const InsertWorkspaceInvitationSchema = createInsertSchema(workspaceInvitations, {
	inviteeEmail: () => z.email("Please enter a valid email"),
	inviteeName: (schema) => schema.min(1, "Name is required"),
});
export const SelectWorkspaceInvitationSchema = createSelectSchema(workspaceInvitations);

export type InsertWorkspaceInvitationType = typeof workspaceInvitations.$inferInsert;
export type SelectWorkspaceInvitationType = typeof workspaceInvitations.$inferSelect;

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
