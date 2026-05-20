import * as pg from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { workspaces } from "./workspaces";

export const users = pg.pgTable(
	"users",
	{
		createdAt: pg.timestamp({ withTimezone: true }).notNull().defaultNow(),
		email: pg.text().notNull().unique(),
		emailVerifiedAt: pg.timestamp({ withTimezone: true }),
		id: pg.uuid().defaultRandom().primaryKey(),
		lastLoginAt: pg.timestamp({ withTimezone: true }).notNull().defaultNow(),
		loginRetryCount: pg.integer().notNull().default(0),
		mustChangePassword: pg.boolean().notNull().default(false),
		name: pg.text().notNull(),
		passwordChangedAt: pg.timestamp({ withTimezone: true }),
		passwordHash: pg.text().notNull(),
		refreshTokenArray: pg
			.jsonb()
			.notNull()
			.$type<Array<{ expiresAt: Date; issuedAt: Date; tokenHash: string }>>()
			.default([]),
		role: pg.text({ enum: ["pharmacist", "owner"] }).notNull(),
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

export const InsertUserSchema = createInsertSchema(users);
export const SelectUserSchema = createSelectSchema(users);

export type InsertUserType = typeof users.$inferInsert;
export type SelectUserType = typeof users.$inferSelect;

export const workspaceInvitations = pg.pgTable(
	"workspace_invitations",
	{
		acceptedAt: pg.timestamp({ withTimezone: true }),
		createdAt: pg.timestamp({ withTimezone: true }).notNull().defaultNow(),
		email: pg.text().notNull(),
		expiresAt: pg.timestamp({ withTimezone: true }).notNull(),
		id: pg.uuid().defaultRandom().primaryKey(),
		invitedByUserId: pg
			.uuid()
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		name: pg.text().notNull(),
		passwordHash: pg.text().notNull(),
		role: pg
			.text({ enum: ["pharmacist", "owner"] })
			.notNull()
			.default("pharmacist"),
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
		pg.index("workspace_invitation_email_index").on(table.email),
		pg.index("workspace_invitation_workspace_index").on(table.workspaceId),
	]
);

export const InsertWorkspaceInvitationSchema = createInsertSchema(workspaceInvitations);
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
