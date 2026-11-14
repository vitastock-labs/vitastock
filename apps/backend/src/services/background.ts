import { registerEmailDeliveryEventSubscribers } from "@/services/queues/events";
import { startAllQueuesAndWorkers, stopAllQueuesAndWorkers } from "@/services/queues/utils/queues";
import { startServiceKeepAliveSchedule, stopServiceKeepAliveSchedule } from "./maintenance/schedule";

export const initializeBackgroundServices = async () => {
	registerEmailDeliveryEventSubscribers();
	await startAllQueuesAndWorkers();
	startServiceKeepAliveSchedule();
};

export const stopBackgroundServices = async () => {
	stopServiceKeepAliveSchedule();
	await stopAllQueuesAndWorkers();
};
