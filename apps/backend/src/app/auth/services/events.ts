import type { SessionUserType } from "@vitastock/db/schema/auth";
import { subscribeToAppEvent } from "@/lib/events";
import { sendPasswordChangedEmail, sendResetPasswordCompleteEmail } from "./emails";

type AuthEventUser = Pick<SessionUserType, "email" | "fullName" | "id" | "workspaceId">;

export const getAuthEventPayload = (options: { requestId: string; user: AuthEventUser }) => {
	const { requestId, user } = options;

	return {
		requestId,
		userEmail: user.email,
		userId: user.id,
		userName: user.fullName,
		workspaceId: user.workspaceId,
	};
};

let hasRegisteredAuthEventSubscribers = false;

export const registerAuthEventSubscribers = () => {
	if (hasRegisteredAuthEventSubscribers) return;

	hasRegisteredAuthEventSubscribers = true;

	subscribeToAppEvent("auth.passwordChanged", async (payload) => {
		await sendPasswordChangedEmail({
			email: payload.userEmail,
			fullName: payload.userName,
		});
	});

	subscribeToAppEvent("auth.passwordResetCompleted", async (payload) => {
		await sendResetPasswordCompleteEmail({
			email: payload.userEmail,
			fullName: payload.userName,
		});
	});

	subscribeToAppEvent("auth.userSignedIn");

	subscribeToAppEvent("auth.userSignedOut");
};
