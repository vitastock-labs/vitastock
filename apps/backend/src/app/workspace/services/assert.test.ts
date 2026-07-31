import { expect, test } from "vitest";
import { AppError } from "@/lib/utils";
import {
	assertAdminCanOnlyManagePharmacist,
	assertNotCurrentUser,
	assertWhoCanManageWhichMember,
	type WorkspaceMemberForAction,
} from "./assert";

const createWorkspaceMember = (
	overrides: Partial<WorkspaceMemberForAction> = {}
): WorkspaceMemberForAction => ({
	email: "member@vitastock.test",
	fullName: "Test Member",
	id: "member-id",
	membershipId: "membership-id",
	role: "pharmacist",
	suspendedAt: null,
	workspaceId: "workspace-id",
	...overrides,
});

test("Workspace member authorization - allows an admin to manage a pharmacist", () => {
	const targetMember = createWorkspaceMember();

	expect(() => {
		assertWhoCanManageWhichMember({ actorRole: "admin", targetMember });
	}).not.toThrow();
});

test("Workspace member authorization - prevents an admin from managing another admin", () => {
	const targetMember = createWorkspaceMember({ role: "admin" });

	expect(() => {
		assertWhoCanManageWhichMember({ actorRole: "admin", targetMember });
	}).toThrow(
		expect.objectContaining<Partial<AppError>>({
			message: "Admins can only manage pharmacists",
			statusCode: 403,
		})
	);
});

test("Workspace member authorization - prevents any manager from modifying the owner", () => {
	const targetMember = createWorkspaceMember({ role: "owner" });

	expect(() => {
		assertWhoCanManageWhichMember({ actorRole: "owner", targetMember });
	}).toThrow(
		expect.objectContaining<Partial<AppError>>({
			message: "Workspace owners cannot be modified",
			statusCode: 400,
		})
	);
});

test("Workspace invitation authorization - allows an admin to handle a pharmacist invitation", () => {
	expect(() => {
		assertAdminCanOnlyManagePharmacist({
			actorRole: "admin",
			targetRole: "pharmacist",
		});
	}).not.toThrow();
});

test("Workspace invitation authorization - prevents an admin from handling an admin invitation", () => {
	expect(() => {
		assertAdminCanOnlyManagePharmacist({
			actorRole: "admin",
			targetRole: "admin",
		});
	}).toThrow(
		expect.objectContaining<Partial<AppError>>({
			message: "Admins can only perform this action on pharmacists",
			statusCode: 403,
		})
	);
});

test("Workspace self-management - prevents a member action from targeting the current user", () => {
	const targetMember = createWorkspaceMember({ id: "current-user-id" });

	expect(() => {
		assertNotCurrentUser({ actorId: "current-user-id", targetMember });
	}).toThrow(
		expect.objectContaining<Partial<AppError>>({
			message: "You cannot perform this action on your own account",
			statusCode: 400,
		})
	);
});

test("Workspace self-management - allows a member action to target another user", () => {
	const targetMember = createWorkspaceMember({ id: "another-user-id" });

	expect(() => {
		assertNotCurrentUser({ actorId: "current-user-id", targetMember });
	}).not.toThrow();
});
