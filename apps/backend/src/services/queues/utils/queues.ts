import {
	startInventoryAlertQueueAndWorker,
	stopInventoryAlertQueueAndWorker,
} from "../../../app/inventory/services/alertQueue";
import { startEmailQueueAndWorker, stopEmailQueueAndWorker } from "../emailQueue";

export const startAllQueuesAndWorkers = async () => {
	await startEmailQueueAndWorker();
	await startInventoryAlertQueueAndWorker();
};

export const stopAllQueuesAndWorkers = async () => {
	await Promise.all([stopInventoryAlertQueueAndWorker(), stopEmailQueueAndWorker()]);
};
