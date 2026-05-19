import type { EmailJobOptions } from "@vitastock/transactional/emails";
import { Queue, QueueEvents, Worker } from "bullmq";
import { consola } from "consola";
import { sendEmail } from "../email/send";
import { redisQueueClient } from "./utils/queueClient";

const emailQueueKey = "emailQueue";

const connection = redisQueueClient as never;

export const emailQueue = new Queue<EmailJobOptions>(emailQueueKey, {
	connection,
	defaultJobOptions: {
		attempts: 3,
		backoff: {
			delay: 1000,
			type: "exponential",
		},
	},
});

export const addEmailToQueue = async (options: EmailJobOptions) => {
	const { data, onError, onSuccess, type } = options;

	try {
		await emailQueue.add(type, options, {
			...(data.priority !== "high" && { priority: 2 }),
		});

		await onSuccess?.();
	} catch (error) {
		consola.error(new Error(`Failed to enqueue '${type}' email to '${data.to}'`, { cause: error }));

		await onError?.();

		throw error;
	}
};

// == Lazy initialization - only create when Redis is connected
let emailWorker: Worker<EmailJobOptions> | null = null;
let emailQueueEvent: QueueEvents | null = null;

const getEmailWorker = () => {
	emailWorker ??= new Worker<EmailJobOptions>(
		emailQueueKey,
		async (job) => {
			await sendEmail(job.data);
		},
		{
			connection,
			limiter: {
				duration: 1000,
				max: 1,
			},
			lockDuration: 5000,
			removeOnComplete: {
				age: 1 * 60 * 60,
				count: 1000,
			},
			removeOnFail: {
				age: 24 * 60 * 60,
			},
		}
	);

	emailWorker.on("error", (error) => {
		consola.error(
			new Error(
				`Error processing email job: ${error.message}. Redis Status: ${redisQueueClient.status}`,
				{ cause: error }
			)
		);
	});

	emailWorker.on("stalled", (jobId) => {
		consola.warn(`Job ''${jobId}'' stalled - will be retried by another worker`);
	});

	return emailWorker;
};

const getEmailQueueEvents = () => {
	emailQueueEvent ??= new QueueEvents(emailQueueKey, { connection });

	emailQueueEvent.on("failed", ({ failedReason, jobId }) => {
		consola.error(`Job '${jobId}' failed with error ${failedReason}`, { failedReason });
	});

	emailQueueEvent.on("waiting", ({ jobId }) => {
		consola.info(`Job '${jobId}' is waiting`);
	});

	emailQueueEvent.on("completed", ({ jobId, returnvalue }) => {
		consola.info(`Job '${jobId}' completed`, { returnvalue });
	});

	emailQueueEvent.on("retries-exhausted", ({ attemptsMade, jobId }) => {
		consola.error(`Job '${jobId}' failed after ${attemptsMade} attempts - no more retries`);
	});

	emailQueueEvent.on("progress", ({ data, jobId }) => {
		consola.debug(`Job '${jobId}' progress:`, { data });
	});

	return emailQueueEvent;
};

export const startEmailQueueAndWorker = async () => {
	// == Ensure Redis is connected before creating Worker/QueueEvents
	if (redisQueueClient.status === "wait") {
		await redisQueueClient.connect();
	}

	// == Now create Worker and QueueEvents (Redis is ready)
	const worker = getEmailWorker();
	const queueEvents = getEmailQueueEvents();

	await Promise.all([emailQueue.waitUntilReady(), queueEvents.waitUntilReady(), worker.waitUntilReady()]);

	consola.info("Email queue and worker are ready!");
};

export const stopEmailQueueAndWorker = async () => {
	await Promise.all([emailWorker?.close(), emailQueueEvent?.close(), emailQueue.close()]);

	consola.info("Email queue and worker closed!");
};
