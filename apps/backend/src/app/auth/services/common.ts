import { db } from "@vitastock/db";
import type { SelectUserType } from "@vitastock/db/schema/auth";
import { workspaces, type SelectWorkspaceType } from "@vitastock/db/schema/workspaces";
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
	"role",
	"workspaceId",
] satisfies Array<keyof SelectUserType>);

export const necessaryWorkspaceDetails = defineEnum([
	"id",
	"name",
	"alertEmail",
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

export const getAuthResponseData = async (
	user: SelectUserType,
	existingWorkspace?: SelectWorkspaceType
) => {
	const workspace =
		existingWorkspace
		?? (await getFromCache(`workspace:${user.workspaceId}`, {
			onCacheMiss: async () => {
				const [workspaceResult] = await db
					.select(pickKeys(workspaces, necessaryWorkspaceDetails))
					.from(workspaces)
					.where(eq(workspaces.id, user.workspaceId))
					.limit(1);

				return workspaceResult;
			},
		}));

	if (!workspace) {
		throw new AppError({
			code: 500,
			message: "User workspace not found",
		});
	}

	return {
		user: getNecessaryUserDetails(user),
		workspace,
	};
};
