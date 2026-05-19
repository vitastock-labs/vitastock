import { consola } from "consola";
import { Redis } from "ioredis";
import { ENVIRONMENT } from "@/config/env";

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
			consola.warn(`Redis error detected (${error.message}), triggering reconnect...`);
		}

		return shouldReconnect;
	},
	retryStrategy: (times: number) => {
		const delay = Math.min(times * 50, 2000);

		consola.warn(
			`Redis reconnecting... attempt ${times}, delay ${delay}ms, status: ${redisQueueClient.status}`
		);

		return delay;
	},
});

redisQueueClient.on("connect", () => {
	consola.info(`Connected to Redis Queue Client! Status: ${redisQueueClient.status}`);
});

redisQueueClient.on("ready", () => {
	consola.info(`Redis Queue Client is ready! Status: ${redisQueueClient.status}`);
});

redisQueueClient.on("error", (error: NodeJS.ErrnoException) => {
	// == Don't log ECONNRESET as error - it's handled by reconnect
	if (error.code === "ECONNRESET" || error.message.includes("ECONNRESET")) {
		consola.warn(
			`Redis Queue Client ECONNRESET - will auto-reconnect. Status: ${redisQueueClient.status}`
		);
		return;
	}

	consola.error(`Redis Queue Client Error: ${error.message}. Status: ${redisQueueClient.status}`, error);
});

redisQueueClient.on("close", () => {
	consola.warn("Redis Queue Client connection closed");
});

redisQueueClient.on("reconnecting", () => {
	consola.info("Redis Queue Client reconnecting...");
});

redisQueueClient.on("end", () => {
	consola.error("Redis Queue Client connection ended - no more reconnects");
});
