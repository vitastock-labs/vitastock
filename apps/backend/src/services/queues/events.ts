import { logAppEvent, subscribeToAppEvent } from "@/lib/events";

let hasRegisteredEmailEnqueueEventSubscribers = false;
let hasRegisteredEmailDeliveryEventSubscribers = false;

export const registerEmailEnqueueEventSubscribers = () => {
	if (hasRegisteredEmailEnqueueEventSubscribers) return;

	hasRegisteredEmailEnqueueEventSubscribers = true;

	subscribeToAppEvent("email.enqueueRequested");

	subscribeToAppEvent("email.enqueueFailed", (payload) => {
		logAppEvent("email.enqueueFailed", { isCritical: true, payload });
	});
};

export const registerEmailDeliveryEventSubscribers = () => {
	if (hasRegisteredEmailDeliveryEventSubscribers) return;

	hasRegisteredEmailDeliveryEventSubscribers = true;

	subscribeToAppEvent("email.sent");
};
