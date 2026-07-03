import { EventEmitter } from "node:events";
import type { Awaitable } from "@zayne-labs/toolkit-type-helpers";
import { appLogger } from "../logger";

type AppEventBase = {
	requestId: string;
	userEmail: string;
	userId: string;
	userName: string;
	workspaceId: string;
};

export type AppEventMap = {
	"auth.passwordChanged": AppEventBase;
	"auth.passwordResetCompleted": AppEventBase;
	"auth.userSignedIn": AppEventBase;
	"auth.userSignedOut": AppEventBase;
	"email.enqueueFailed": AppEventMap["email.enqueueRequested"] & {
		error: unknown;
	};
	"email.enqueueRequested": Partial<AppEventBase> & {
		emailType: string;
		recipient: string;
	};
	"email.sent": AppEventMap["email.enqueueRequested"];
	"inventory.stockLogged": AppEventBase & {
		drugId: string;
		quantity: number;
	};
	"workspace.invitationCanceled": AppEventMap["workspace.invitationSent"];
	"workspace.invitationResent": AppEventMap["workspace.invitationSent"];
	"workspace.invitationSent": AppEventBase & {
		invitationId: string;
		recipient: string;
	};
	"workspace.memberRemoved": AppEventBase & {
		targetUserId: string;
	};
	"workspace.memberRoleChanged": AppEventBase & {
		newRole: string;
		targetUserId: string;
	};
	"workspace.memberSuspensionChanged": AppEventBase & {
		action: "suspend" | "unsuspend";
		targetUserId: string;
	};
};

type AppEventName = keyof AppEventMap;

type AppEventHandler<TEventName extends AppEventName, TResult = void> = (
	payload: AppEventMap[TEventName]
) => TResult;

// eslint-disable-next-line unicorn/prefer-event-target
const appEventEmitter = new EventEmitter();

export const emitAppEvent = <TEventName extends AppEventName>(
	eventName: TEventName,
	payload: AppEventMap[TEventName]
) => {
	return appEventEmitter.emit(eventName, payload);
};

export const subscribeToAppEvent = <TEventName extends AppEventName>(
	eventName: TEventName,
	handler?: AppEventHandler<TEventName, Awaitable<void>>
) => {
	const safeHandler: typeof handler = async (payload) => {
		try {
			await handler?.(payload);
			logAppEvent(eventName, { payload });
		} catch (error) {
			appLogger.critical({
				error,
				message: `Failed to handle app event: ${eventName}`,
				meta: { eventName, ...payload },
			});
		}
	};

	appEventEmitter.on(eventName, safeHandler as AppEventHandler<AppEventName>);

	return () => {
		appEventEmitter.off(eventName, safeHandler as AppEventHandler<AppEventName>);
	};
};

export const logAppEvent = <TEventName extends keyof AppEventMap>(
	eventName: TEventName,
	options: { isCritical?: boolean; payload: AppEventMap[TEventName] }
) => {
	const { isCritical, payload } = options;

	if (isCritical) {
		appLogger.critical({
			error: "error" in payload ? payload.error : undefined,
			message: `Critical App Event: ${eventName}`,
			meta: payload,
		});

		return;
	}

	appLogger.structured.info(payload as Record<string, unknown>, `App Event: ${eventName}`);
};
