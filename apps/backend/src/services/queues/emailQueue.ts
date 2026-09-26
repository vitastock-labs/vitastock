import type { EmailJobOptions } from "@vitastock/transactional/emails";
import { Queue, QueueEvents, Worker } from "bullmq";
import { emitAppEvent } from "@/lib/events";
import { appLogger } from "@/lib/logger";
import { sendEmail } from "../email/send";
import { redisQueueClient } from "./utils/queueClient";

const emailQueueName = "emailQueue";

export const emailQueue = new Queue<EmailJobOptions>(emailQueueName, {
	connection: redisQueueClient,
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

let emailWorker: Worker<EmailJobOptions> | null = null;
let emailQueueEvents: QueueEvents | null = null;

const createEmailWorker = () => {
	const worker = new Worker<EmailJobOptions>(
		emailQueueName,
		async (job) => {
			const jobLogger = appLogger.child({ jobId: job.id, jobType: job.name, queue: emailQueueName });

			jobLogger.info(
				{ emailType: job.data.type, recipient: job.data.data.to.email },
				`Processing ${job.data.type} email to ${job.data.data.to.email}`
			);

			const result = await sendEmail(job.data);

			emitAppEvent("email.sent", {
				emailType: job.data.type,
				recipient: job.data.data.to.email,
				...result,
			});

			jobLogger.info(
				{ messageId: result.messageId, recipient: job.data.data.to.email },
				`Successfully sent ${job.data.type} email to ${job.data.data.to.email}`
			);
		},
		{
			connection: redisQueueClient,
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

	worker.on("error", (error) => {
		appLogger.critical({
			error,
			message: `Error processing email job: ${error.message}. Redis Status: ${redisQueueClient.status}`,
		});
	});

	worker.on("stalled", (jobId) => {
		const jobLogger = appLogger.child({ jobId, queue: emailQueueName });
		jobLogger.warn("Email job stalled - another worker will retry");
	});

	return worker;
};

const createEmailQueueEvents = () => {
	const queueEvents = new QueueEvents<unknown>(emailQueueName, { connection: redisQueueClient });

	queueEvents.on("failed", ({ failedReason, jobId }) => {
		const jobLogger = appLogger.child({ jobId, queue: emailQueueName });
		jobLogger.error({ failedReason }, `Email job failed: ${failedReason}`);
	});

	queueEvents.on("waiting", ({ jobId }) => {
		const jobLogger = appLogger.child({ jobId, queue: emailQueueName });
		jobLogger.info("Email job waiting in queue");
	});

	queueEvents.on("completed", ({ jobId, returnvalue }) => {
		const jobLogger = appLogger.child({ jobId, queue: emailQueueName });
		jobLogger.info({ returnvalue }, "Email job completed successfully");
	});

	queueEvents.on("retries-exhausted", ({ attemptsMade, jobId }) => {
		appLogger.pretty.error(`Job '${jobId}' failed after ${attemptsMade} attempts - no more retries`);
	});

	queueEvents.on("progress", ({ data, jobId }) => {
		appLogger.pretty.debug(`Job '${jobId}' progress:`, { data });
	});

	return queueEvents;
};

export const startEmailQueueAndWorker = async () => {
	if (redisQueueClient.status === "wait") {
		await redisQueueClient.connect();
	}

	emailWorker ??= createEmailWorker();
	emailQueueEvents ??= createEmailQueueEvents();

	await Promise.all([
		emailQueue.waitUntilReady(),
		emailQueueEvents.waitUntilReady(),
		emailWorker.waitUntilReady(),
	]);

	appLogger.pretty.info("Email queue and worker are ready!");
};

export const stopEmailQueueAndWorker = async () => {
	await Promise.all([emailWorker?.close(), emailQueueEvents?.close(), emailQueue.close()]);

	appLogger.pretty.info("Email queue and worker closed!");
};
