import { registerEmailDeliveryEventSubscribers } from "@/services/queues/events";
import { startAllQueuesAndWorkers, stopAllQueuesAndWorkers } from "@/services/queues/utils/queues";

export const initializeBackgroundServices = async () => {
	registerEmailDeliveryEventSubscribers();
	await startAllQueuesAndWorkers();
};

export const stopBackgroundServices = async () => {
	await stopAllQueuesAndWorkers();
};
