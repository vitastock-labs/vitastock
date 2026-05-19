import { consola } from "consola";
import { createClient } from "redis";
import { ENVIRONMENT } from "@/config/env";

export const redisCacheClient = createClient({
	url:
		ENVIRONMENT.NODE_ENV === "development" ?
			ENVIRONMENT.REDIS_CACHE_URL_DEV
		:	ENVIRONMENT.REDIS_CACHE_URL,
});

redisCacheClient.on("error", (error: Error) => {
	consola.error(`[Redis Cache Client] Error: ${error.message}`, error);
});

redisCacheClient.on("connect", () => {
	consola.info("[Redis Cache Client] Status: connect");
});

redisCacheClient.on("ready", () => {
	consola.success("[Redis Cache Client] Status: ready");
});

redisCacheClient.on("end", () => {
	consola.warn("[Redis Cache Client] Status: end (Disconnected)");
});

redisCacheClient.on("reconnecting", () => {
	consola.info("[Redis Cache Client] Status: reconnecting...");
});

export const initializeRedisCacheClient = async () => {
	consola.info(`[Redis Cache Client] Initializing... Current state: isOpen=${redisCacheClient.isOpen}`);
	if (redisCacheClient.isOpen) {
		consola.info("[Redis Cache Client] Already open, skipping initialization.");
		return;
	}

	try {
		await redisCacheClient.connect();
		consola.info("[Redis Cache Client] .connect() called successfully.");
	} catch (error) {
		consola.error("[Redis Cache Client] Failed to connect during initialization", error);
	}
};
