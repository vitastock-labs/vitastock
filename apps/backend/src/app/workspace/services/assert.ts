import type { SelectWorkspaceMembershipType } from "@vitastock/db/schema/workspace";
import { AppError } from "@/lib/utils";

export type WorkspaceMemberRole = SelectWorkspaceMembershipType["role"];

export type WorkspaceMemberForAction = {
	email: string;
	fullName: string;
	id: string;
	membershipId: string;
	role: WorkspaceMemberRole;
	suspendedAt: SelectWorkspaceMembershipType["suspendedAt"];
	workspaceId: string;
};

export const assertWhoCanManageWhichMember = (options: {
	actorRole: WorkspaceMemberRole;
	targetMember: WorkspaceMemberForAction;
}) => {
	const { actorRole, targetMember } = options;

	if (targetMember.role === "owner") {
		throw new AppError({
			code: 400,
			message: "Workspace owners cannot be modified",
		});
	}

	if (actorRole === "admin" && targetMember.role !== "pharmacist") {
		throw new AppError({
			code: 403,
			message: "Admins can only manage pharmacists",
		});
	}
};

export const assertAdminCanOnlyManagePharmacist = (options: {
	actorRole: WorkspaceMemberRole;
	targetRole: WorkspaceMemberRole;
}) => {
	const { actorRole, targetRole } = options;

	if (actorRole === "admin" && targetRole !== "pharmacist") {
		throw new AppError({
			code: 403,
			message: `Admins can only perform this action on pharmacists`,
		});
	}
};

export const assertNotCurrentUser = (options: {
	actorId: string;
	targetMember: WorkspaceMemberForAction;
}) => {
	const { actorId, targetMember } = options;

	if (actorId === targetMember.id) {
		throw new AppError({
			code: 400,
			message: "You cannot perform this action on your own account",
		});
	}
};
