import { defineEnum, type NonEmptyArray } from "@zayne-labs/toolkit-type-helpers";
import { sql } from "drizzle-orm";
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
	name: pg.text().notNull().unique(),
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
export const WORKSPACE_MEMBERSHIP_STATUSES = defineEnum(["active", "suspended"]);

export const workspaceMemberships = pg.pgTable(
	"workspace_memberships",
	{
		createdAt: pg.timestamp({ withTimezone: true }).notNull().defaultNow(),
		id: pg.uuid().defaultRandom().primaryKey(),
		role: pg.text({ enum: ROLES }).notNull(),
		status: pg
			.text({
				enum: WORKSPACE_MEMBERSHIP_STATUSES as NonEmptyArray<
					(typeof WORKSPACE_MEMBERSHIP_STATUSES)[number]
				>,
			})
			.notNull()
			.default("active"),
		suspendedAt: pg.timestamp({ withTimezone: true }),
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
		pg.uniqueIndex("workspace_membership_user_workspace_index").on(table.userId, table.workspaceId),
		pg
			.uniqueIndex("workspace_membership_single_owner_index")
			.on(table.workspaceId)
			.where(sql`${table.role} = 'owner'`),
		pg.index("workspace_membership_workspace_index").on(table.workspaceId),
	]
);

export const workspaceInvitations = pg.pgTable("workspace_invitations", {
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
});

export const InsertWorkspaceInvitationSchema = createInsertSchema(workspaceInvitations);
export const InsertWorkspaceMembershipSchema = createInsertSchema(workspaceMemberships);
export const SelectWorkspaceInvitationSchema = createSelectSchema(workspaceInvitations, {
	inviteeEmail: () => z.email("Please enter a valid email"),
	inviteeName: (schema) => schema.min(1, "Name is required"),
});
export const SelectWorkspaceMembershipSchema = createSelectSchema(workspaceMemberships);

export type InsertWorkspaceInvitationType = typeof workspaceInvitations.$inferInsert;
export type InsertWorkspaceMembershipType = typeof workspaceMemberships.$inferInsert;
export type SelectWorkspaceInvitationType = typeof workspaceInvitations.$inferSelect;
export type SelectWorkspaceMembershipType = typeof workspaceMemberships.$inferSelect;
