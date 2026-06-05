import { createClient } from "redis";
import { ENVIRONMENT } from "@/config/env";
import { appLogger } from "@/lib/logger";

export const redisCacheClient = createClient({
	url:
		ENVIRONMENT.NODE_ENV === "development" ?
			ENVIRONMENT.REDIS_CACHE_URL_DEV
		:	ENVIRONMENT.REDIS_CACHE_URL,
});

redisCacheClient.on("error", (error: Error) => {
	appLogger.pretty.error(`[Redis Cache Client] Error: ${error.message}`, error);
});

redisCacheClient.on("connect", () => {
	appLogger.pretty.info("[Redis Cache Client] Status: connect");
});

redisCacheClient.on("ready", () => {
	appLogger.pretty.success("[Redis Cache Client] Status: ready");
});

redisCacheClient.on("end", () => {
	appLogger.pretty.warn("[Redis Cache Client] Status: end (Disconnected)");
});

redisCacheClient.on("reconnecting", () => {
	appLogger.pretty.info("[Redis Cache Client] Status: reconnecting...");
});

export const initializeRedisCacheClient = async () => {
	appLogger.pretty.info(
		`[Redis Cache Client] Initializing... Current state: isOpen=${redisCacheClient.isOpen}`
	);
	if (redisCacheClient.isOpen) {
		appLogger.pretty.info("[Redis Cache Client] Already open, skipping initialization.");
		return;
	}

	try {
		await redisCacheClient.connect();
		appLogger.pretty.info("[Redis Cache Client] .connect() called successfully.");
	} catch (error) {
		appLogger.pretty.error("[Redis Cache Client] Failed to connect during initialization", error);
	}
};
