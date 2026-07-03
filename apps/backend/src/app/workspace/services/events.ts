import type { SessionUserType } from "@vitastock/db/schema/auth";
import { subscribeToAppEvent } from "@/lib/events";
import { removeFromCache } from "@/services/cache";

type WorkspaceEventUser = Pick<SessionUserType, "email" | "fullName" | "id" | "workspaceId">;

export const getWorkspaceEventPayload = (options: { requestId: string; user: WorkspaceEventUser }) => {
	const { requestId, user } = options;

	return {
		requestId,
		userEmail: user.email,
		userId: user.id,
		userName: user.fullName,
		workspaceId: user.workspaceId,
	};
};

const clearWorkspaceCache = async (workspaceId: string | undefined) => {
	if (!workspaceId) return;

	await removeFromCache(`workspace:${workspaceId}`);
};

let hasRegisteredWorkspaceEventSubscribers = false;

export const registerWorkspaceEventSubscribers = () => {
	if (hasRegisteredWorkspaceEventSubscribers) return;

	hasRegisteredWorkspaceEventSubscribers = true;

	subscribeToAppEvent("workspace.invitationCanceled", (payload) =>
		clearWorkspaceCache(payload.workspaceId)
	);
	subscribeToAppEvent("workspace.invitationResent", (payload) =>
		clearWorkspaceCache(payload.workspaceId)
	);
	subscribeToAppEvent("workspace.invitationSent", (payload) => clearWorkspaceCache(payload.workspaceId));
	subscribeToAppEvent("workspace.memberRemoved", (payload) => clearWorkspaceCache(payload.workspaceId));
	subscribeToAppEvent("workspace.memberRoleChanged", (payload) =>
		clearWorkspaceCache(payload.workspaceId)
	);
	subscribeToAppEvent("workspace.memberSuspensionChanged", (payload) =>
		clearWorkspaceCache(payload.workspaceId)
	);
};
