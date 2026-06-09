import { db } from "@vitastock/db";
import { users } from "@vitastock/db/schema/auth";
import { workspaceInvitations } from "@vitastock/db/schema/workspace";
import { pickKeys } from "@zayne-labs/toolkit-core";
import { and, eq, isNull } from "drizzle-orm";
import { AppError } from "@/lib/utils";

export const getWorkspaceMemberForAction = async (options: { memberId: string; workspaceId: string }) => {
	const { memberId, workspaceId } = options;

	const [member] = await db
		.select(pickKeys(users, ["email", "fullName", "id", "role", "suspendedAt", "workspaceId"]))
		.from(users)
		.where(and(eq(users.id, memberId), eq(users.workspaceId, workspaceId)))
		.limit(1);

	if (!member) {
		throw new AppError({
			code: 404,
			message: "Workspace member not found",
		});
	}

	return member;
};

export const getPendingInvitationForAction = async (options: {
	invitationId: string;
	workspaceId: string;
}) => {
	const { invitationId, workspaceId } = options;

	const [invitation] = await db
		.select(
			pickKeys(workspaceInvitations, [
				"expiresAt",
				"id",
				"inviteeEmail",
				"inviteeName",
				"role",
				"workspaceId",
			])
		)
		.from(workspaceInvitations)
		.where(
			and(
				eq(workspaceInvitations.id, invitationId),
				eq(workspaceInvitations.workspaceId, workspaceId),
				isNull(workspaceInvitations.acceptedAt)
			)
		)
		.limit(1);

	if (!invitation) {
		throw new AppError({
			code: 404,
			message: "Pending invitation not found",
		});
	}

	return invitation;
};
