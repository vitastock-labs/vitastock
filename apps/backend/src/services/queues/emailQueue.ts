import type { EmailJobOptions } from "@vitastock/transactional/emails";
import { Queue, QueueEvents, Worker } from "bullmq";
import { emitAppEvent } from "@/lib/events";
import { appLogger } from "@/lib/logger";
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
	const { data, jobId, onError, onSuccess, type } = options;

	try {
		emitAppEvent("email.enqueueRequested", {
			emailType: type,
			recipient: data.to.email,
		});

		await emailQueue.add(type, options, {
			...(data.priority !== "high" && { priority: 2 }),
			...(jobId && { jobId }),
		});

		await onSuccess?.();
	} catch (error) {
		emitAppEvent("email.enqueueFailed", {
			emailType: type,
			error,
			recipient: data.to.email,
		});

		appLogger.pretty.error(
			new Error(`Failed to enqueue '${type}' email to '${data.to.email}'`, { cause: error })
		);

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
			const result = await sendEmail(job.data);

			emitAppEvent("email.sent", {
				emailType: job.data.type,
				recipient: job.data.data.to.email,
				...result,
			});
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
		appLogger.critical({
			error,
			message: `Error processing email job: ${error.message}. Redis Status: ${redisQueueClient.status}`,
		});
	});

	emailWorker.on("stalled", (jobId) => {
		appLogger.pretty.warn(`Job ''${jobId}'' stalled - will be retried by another worker`);
	});

	return emailWorker;
};

const getEmailQueueEvents = () => {
	emailQueueEvent ??= new QueueEvents(emailQueueKey, { connection });

	emailQueueEvent.on("failed", ({ failedReason, jobId }) => {
		appLogger.pretty.error(`Job '${jobId}' failed with error ${failedReason}`, { failedReason });
	});

	emailQueueEvent.on("waiting", ({ jobId }) => {
		appLogger.pretty.info(`Job '${jobId}' is waiting`);
	});

	emailQueueEvent.on("completed", ({ jobId, returnvalue }) => {
		appLogger.pretty.info(`Job '${jobId}' completed`, { returnvalue });
	});

	emailQueueEvent.on("retries-exhausted", ({ attemptsMade, jobId }) => {
		appLogger.pretty.error(`Job '${jobId}' failed after ${attemptsMade} attempts - no more retries`);
	});

	emailQueueEvent.on("progress", ({ data, jobId }) => {
		appLogger.pretty.debug(`Job '${jobId}' progress:`, { data });
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

	appLogger.pretty.info("Email queue and worker are ready!");
};

export const stopEmailQueueAndWorker = async () => {
	await Promise.all([emailWorker?.close(), emailQueueEvent?.close(), emailQueue.close()]);

	appLogger.pretty.info("Email queue and worker closed!");
};
