import { startEmailQueueAndWorker, stopEmailQueueAndWorker } from "../emailQueue";
import {
	startInventoryAlertQueueAndWorker,
	stopInventoryAlertQueueAndWorker,
} from "../inventoryAlertQueue";

export const startAllQueuesAndWorkers = async () => {
	await startEmailQueueAndWorker();
	await startInventoryAlertQueueAndWorker();
};

export const stopAllQueuesAndWorkers = async () => {
	await Promise.all([stopInventoryAlertQueueAndWorker(), stopEmailQueueAndWorker()]);
};
