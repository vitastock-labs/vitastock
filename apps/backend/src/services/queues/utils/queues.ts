import { startEmailQueueAndWorker, stopEmailQueueAndWorker } from "../emailQueue";

export const startAllQueuesAndWorkers = () => startEmailQueueAndWorker();

export const stopAllQueuesAndWorkers = () => stopEmailQueueAndWorker();
