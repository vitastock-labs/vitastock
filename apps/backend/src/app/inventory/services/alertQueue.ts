import { Queue, Worker } from "bullmq";
import { appLogger } from "@/lib/logger";
import { redisQueueClient } from "@/services/queues/utils/queueClient";
import {
	dispatchInventoryAlertOutbox,
	queueDailyInventoryAlertDigests,
	runDailyInventoryAlertMaintenance,
} from "./alertWorker";

const inventoryAlertQueueKey = "inventoryAlertQueue";
const connection = redisQueueClient;

const inventoryAlertJobs = [
	{
		every: 5 * 60 * 1000,
		name: "dispatch-alert-outbox",
		run: dispatchInventoryAlertOutbox,
	},
	{
		every: 24 * 60 * 60 * 1000,
		name: "evaluate-inventory-alerts",
		run: runDailyInventoryAlertMaintenance,
	},
	{
		every: 60 * 60 * 1000,
		name: "queue-alert-digests",
		run: queueDailyInventoryAlertDigests,
	},
] as const;

const inventoryAlertQueue = new Queue<Record<string, never>>(inventoryAlertQueueKey, {
	connection,
	defaultJobOptions: {
		attempts: 3,
		backoff: {
			delay: 5000,
			type: "exponential",
		},
		removeOnComplete: {
			count: 100,
		},
		removeOnFail: {
			age: 24 * 60 * 60,
		},
	},
});

let inventoryAlertWorker: Worker<Record<string, never>> | null = null;

const getInventoryAlertWorker = () => {
	inventoryAlertWorker ??= new Worker<Record<string, never>>(
		inventoryAlertQueueKey,
		async (job) => {
			const scheduledJob = inventoryAlertJobs.find(({ name }) => name === job.name);

			if (!scheduledJob) {
				throw new Error(`Unsupported inventory alert job: ${job.name}`);
			}

			await scheduledJob.run();
		},
		{
			concurrency: 1,
			connection,
		}
	);

	inventoryAlertWorker.on("error", (error) => {
		appLogger.critical({
			error,
			message: `Inventory alert worker error: ${error.message}`,
		});
	});

	inventoryAlertWorker.on("failed", (job, error) => {
		const message = `Inventory alert job '${job?.name ?? "unknown"}' failed`;
		const logInfo = {
			attemptsMade: job?.attemptsMade,
			err: error,
			jobId: job?.id,
		};

		appLogger.structured.error(logInfo, message);
		appLogger.pretty.error(message, logInfo);
	});

	return inventoryAlertWorker;
};

export const startInventoryAlertQueueAndWorker = async () => {
	if (redisQueueClient.status === "wait") {
		await redisQueueClient.connect();
	}

	const worker = getInventoryAlertWorker();

	await Promise.all([inventoryAlertQueue.waitUntilReady(), worker.waitUntilReady()]);
	await Promise.all(
		inventoryAlertJobs.map((job) =>
			inventoryAlertQueue.upsertJobScheduler(
				job.name,
				{ every: job.every },
				{
					data: {},
					name: job.name,
				}
			)
		)
	);

	appLogger.pretty.info("Inventory alert queue and worker are ready!");
};

export const stopInventoryAlertQueueAndWorker = async () => {
	await Promise.all([inventoryAlertWorker?.close(), inventoryAlertQueue.close()]);

	appLogger.pretty.info("Inventory alert queue and worker closed!");
};
