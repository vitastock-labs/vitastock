import { Queue, Worker } from "bullmq";
import { appLogger } from "@/lib/logger";
import { redisQueueClient } from "@/services/queues/utils/queueClient";
import {
	createDueInventoryAlertDigests,
	enqueuePendingInventoryAlertEmails,
	maintainInventoryAlerts,
} from "./alertJobs";

const inventoryAlertQueueName = "inventoryAlertQueue";

const inventoryAlertJobDefinitions = [
	{
		every: 5 * 60 * 1000,
		name: "dispatch-alert-outbox",
		run: enqueuePendingInventoryAlertEmails,
	},
	{
		every: 24 * 60 * 60 * 1000,
		name: "evaluate-inventory-alerts",
		run: maintainInventoryAlerts,
	},
	{
		every: 60 * 60 * 1000,
		name: "queue-alert-digests",
		run: createDueInventoryAlertDigests,
	},
] as const;

export const inventoryAlertQueue = new Queue<Record<string, never>>(inventoryAlertQueueName, {
	connection: redisQueueClient,
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

const createInventoryAlertWorker = () => {
	const worker = new Worker<Record<string, never>>(
		inventoryAlertQueueName,
		async (job) => {
			const jobDefinition = inventoryAlertJobDefinitions.find(({ name }) => name === job.name);

			if (!jobDefinition) {
				throw new Error(`Unsupported inventory alert job: ${job.name}`);
			}

			await jobDefinition.run();
		},
		{
			concurrency: 1,
			connection: redisQueueClient,
		}
	);

	worker.on("error", (error) => {
		appLogger.critical({
			error,
			message: `Inventory alert worker error: ${error.message}`,
		});
	});

	worker.on("failed", (job, error) => {
		const message = `Inventory alert job '${job?.name ?? "unknown"}' failed`;
		const logInfo = {
			attemptsMade: job?.attemptsMade,
			err: error,
			jobId: job?.id,
		};

		appLogger.structured.error(logInfo, message);
		appLogger.pretty.error(message, logInfo);
	});

	return worker;
};

let inventoryAlertWorker: Worker<Record<string, never>> | null = null;

export const startInventoryAlertQueueAndWorker = async () => {
	if (redisQueueClient.status === "wait") {
		await redisQueueClient.connect();
	}

	inventoryAlertWorker ??= createInventoryAlertWorker();

	await Promise.all([inventoryAlertQueue.waitUntilReady(), inventoryAlertWorker.waitUntilReady()]);
	await Promise.all(
		inventoryAlertJobDefinitions.map((jobDefinition) =>
			inventoryAlertQueue.upsertJobScheduler(
				jobDefinition.name,
				{ every: jobDefinition.every },
				{
					data: {},
					name: jobDefinition.name,
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
