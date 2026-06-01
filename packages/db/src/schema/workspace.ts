import type { NonEmptyArray } from "@zayne-labs/toolkit-type-helpers";
import * as pg from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { ROLES } from "../constants";
import { users } from "./auth";

export const workspaces = pg.pgTable("workspaces", {
	alertEmail: pg.text(),
	createdAt: pg.timestamp({ withTimezone: true }).notNull().defaultNow(),
	emailAlertsEnabledAt: pg.timestamp({ withTimezone: true }),
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

const ROLES_WITHOUT_OWNER = ROLES.filter((role) => role !== "owner");

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
		role: pg
			.text({ enum: ROLES_WITHOUT_OWNER as NonEmptyArray<(typeof ROLES_WITHOUT_OWNER)[number]> })
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
	}
	// (table) => [pg.index("workspace_invitation_email_index").on(table.inviteeEmail)]
);

export const InsertWorkspaceInvitationSchema = createInsertSchema(workspaceInvitations);
export const SelectWorkspaceInvitationSchema = createSelectSchema(workspaceInvitations, {
	inviteeEmail: () => z.email("Please enter a valid email"),
	inviteeName: (schema) => schema.min(1, "Name is required"),
});

export type InsertWorkspaceInvitationType = typeof workspaceInvitations.$inferInsert;
export type SelectWorkspaceInvitationType = typeof workspaceInvitations.$inferSelect;
