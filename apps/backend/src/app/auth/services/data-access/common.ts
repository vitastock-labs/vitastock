import { db } from "@vitastock/db";
import type {
	SelectUserType,
	SessionMembershipType,
	SessionUserType,
	SessionWorkspaceType,
} from "@vitastock/db/schema/auth";
import {
	workspaceMemberships,
	workspaces,
	type SelectWorkspaceType,
} from "@vitastock/db/schema/workspace";
import { pickKeys } from "@zayne-labs/toolkit-core";
import { defineEnum } from "@zayne-labs/toolkit-type-helpers";
import { eq } from "drizzle-orm";
import { AppError } from "@/lib/utils";
import { getFromCache } from "@/services/cache";

export const necessaryUserDetails = defineEnum([
	"id",
	"fullName",
	"email",
	"emailVerifiedAt",
	"mustChangePassword",
] as const satisfies Array<keyof SelectUserType>);

export const necessaryMembershipDetails = defineEnum([
	"id",
	"role",
	"suspendedAt",
	"workspaceId",
] as const satisfies Array<keyof SessionMembershipType>);

export const necessaryWorkspaceDetails = defineEnum([
	"id",
	"name",
	"alertEmail",
	"emailAlertDeliveryPolicy",
	"lowStockThreshold",
	"nearExpiryDays",
	"timezone",
] as const satisfies Array<keyof SelectWorkspaceType>);

export const getNecessaryUserDetails = <const TKeys extends Array<keyof SelectUserType> = []>(
	user: SelectUserType,
	keys: TKeys = [] as never
) => {
	return pickKeys(user, [...necessaryUserDetails, ...keys] as const);
};

export const getCurrentMembership = async (userId: string) => {
	const membership = await getFromCache(`workspace-membership:${userId}`, {
		onCacheMiss: async () => {
			const [membershipResult] = await db
				.select(pickKeys(workspaceMemberships, necessaryMembershipDetails))
				.from(workspaceMemberships)
				.where(eq(workspaceMemberships.userId, userId))
				.limit(1);

			return membershipResult;
		},
	});

	if (!membership) {
		throw new AppError({
			code: 500,
			message: "User workspace membership not found",
		});
	}

	return membership;
};

export const getCurrentWorkspace = async (workspaceId: string) => {
	const workspace = await getFromCache(`workspace:${workspaceId}`, {
		onCacheMiss: async () => {
			const [workspaceResult] = await db
				.select(pickKeys(workspaces, necessaryWorkspaceDetails))
				.from(workspaces)
				.where(eq(workspaces.id, workspaceId))
				.limit(1);

			return workspaceResult;
		},
	});

	if (!workspace) {
		throw new AppError({
			code: 500,
			message: "User workspace not found",
		});
	}

	return workspace;
};

export const getCurrentSessionState = async (options: {
	existingMembership?: SessionMembershipType;
	existingWorkspace?: SessionWorkspaceType;
	user: SelectUserType;
}) => {
	const { existingMembership, existingWorkspace, user } = options;

	const currentMembership = existingMembership ?? (await getCurrentMembership(user.id));
	const currentWorkspace =
		existingWorkspace ?? (await getCurrentWorkspace(currentMembership.workspaceId));

	const currentUser = {
		...user,
		membershipId: currentMembership.id,
		role: currentMembership.role,
		suspendedAt: currentMembership.suspendedAt,
		workspaceId: currentMembership.workspaceId,
	} satisfies SessionUserType;

	return {
		currentMembership,
		currentUser,
		currentWorkspace,
	};
};

export const getAuthResponseData = async (
	user: SessionUserType,
	existingWorkspace?: SessionWorkspaceType
) => {
	const workspace = existingWorkspace ?? (await getCurrentWorkspace(user.workspaceId));

	return {
		user: {
			...getNecessaryUserDetails(user),
			role: user.role,
			workspaceId: user.workspaceId,
		},
		workspace,
	};
};
