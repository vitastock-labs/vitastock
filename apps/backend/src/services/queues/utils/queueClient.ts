import { Redis } from "ioredis";
import { ENVIRONMENT } from "@/config/env";
import { appLogger } from "@/lib/logger";

const queueRedisURL =
	ENVIRONMENT.NODE_ENV === "development" ? ENVIRONMENT.REDIS_QUEUE_URL_DEV : ENVIRONMENT.REDIS_QUEUE_URL;

export const redisQueueClient = new Redis(queueRedisURL, {
	enableOfflineQueue: true,
	lazyConnect: true,
	maxRetriesPerRequest: null,
	reconnectOnError: (error: NodeJS.ErrnoException) => {
		const targetErrors = ["ECONNRESET", "ETIMEDOUT", "ECONNREFUSED", "EPIPE"];
		const shouldReconnect = targetErrors.some((err) => error.message.includes(err));

		if (shouldReconnect) {
			appLogger.pretty.warn(`Redis error detected (${error.message}), triggering reconnect...`);
		}

		return shouldReconnect;
	},
	retryStrategy: (times: number) => {
		const delay = Math.min(times * 50, 2000);

		appLogger.pretty.warn(
			`Redis reconnecting... attempt ${times}, delay ${delay}ms, status: ${redisQueueClient.status}`
		);

		return delay;
	},
});

redisQueueClient.on("connect", () => {
	appLogger.pretty.info(`Connected to Redis Queue Client! Status: ${redisQueueClient.status}`);
});

redisQueueClient.on("ready", () => {
	appLogger.pretty.info(`Redis Queue Client is ready! Status: ${redisQueueClient.status}`);
});

redisQueueClient.on("error", (error: NodeJS.ErrnoException) => {
	// == Don't log ECONNRESET as error - it's handled by reconnect
	if (error.code === "ECONNRESET" || error.message.includes("ECONNRESET")) {
		appLogger.pretty.warn(
			`Redis Queue Client ECONNRESET - will auto-reconnect. Status: ${redisQueueClient.status}`
		);
		return;
	}

	appLogger.pretty.error(
		`Redis Queue Client Error: ${error.message}. Status: ${redisQueueClient.status}`,
		error
	);
});

redisQueueClient.on("close", () => {
	appLogger.pretty.warn("Redis Queue Client connection closed");
});

redisQueueClient.on("reconnecting", () => {
	appLogger.pretty.info("Redis Queue Client reconnecting...");
});

redisQueueClient.on("end", () => {
	appLogger.pretty.error("Redis Queue Client connection ended - no more reconnects");
});
