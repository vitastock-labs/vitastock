import type { SessionUserType } from "@vitastock/db/schema/auth";
import { subscribeToAppEvent } from "@/lib/events";

type InventoryEventUser = Pick<SessionUserType, "email" | "fullName" | "id" | "workspaceId">;

export const getInventoryEventPayload = (options: {
	requestId: string;
	user: InventoryEventUser;
}) => {
	const { requestId, user } = options;

	return {
		requestId,
		userEmail: user.email,
		userId: user.id,
		userName: user.fullName,
		workspaceId: user.workspaceId,
	};
};

let hasRegisteredInventoryEventSubscribers = false;

export const registerInventoryEventSubscribers = () => {
	if (hasRegisteredInventoryEventSubscribers) return;

	hasRegisteredInventoryEventSubscribers = true;

	subscribeToAppEvent("inventory.stockLogged");
};
