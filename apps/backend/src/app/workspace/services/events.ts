import type { SelectUserType } from "@vitastock/db/schema/auth";
import { subscribeToAppEvent } from "@/lib/events";
import { removeFromCache } from "@/services/cache";

type WorkspaceEventUser = Pick<SelectUserType, "email" | "fullName" | "id" | "workspaceId">;

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

export const getWorkspaceInvitationSentEventPayload = (options: {
	invitationId: string;
	recipient: string;
	requestId: string;
	user: WorkspaceEventUser;
}) => {
	const { invitationId, recipient, requestId, user } = options;

	return {
		...getWorkspaceEventPayload({ requestId, user }),
		invitationId,
		recipient,
	};
};

let hasRegisteredWorkspaceEventSubscribers = false;

export const registerWorkspaceEventSubscribers = () => {
	if (hasRegisteredWorkspaceEventSubscribers) return;

	hasRegisteredWorkspaceEventSubscribers = true;

	subscribeToAppEvent("workspace.invitationSent");

	subscribeToAppEvent("workspace.invitationSent", async (payload) => {
		if (!payload.workspaceId) return;

		await removeFromCache(`workspace:${payload.workspaceId}`);
	});
};
