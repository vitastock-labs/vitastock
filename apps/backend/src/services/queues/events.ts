import { logAppEvent, subscribeToAppEvent } from "@/lib/events";

let hasRegisteredQueueEventSubscribers = false;

export const registerQueueEventSubscribers = () => {
	if (hasRegisteredQueueEventSubscribers) return;

	hasRegisteredQueueEventSubscribers = true;

	subscribeToAppEvent("email.enqueueRequested");

	subscribeToAppEvent("email.enqueueFailed", (payload) => {
		logAppEvent("email.enqueueFailed", { isCritical: true, payload });
	});

	subscribeToAppEvent("email.sent");
};
