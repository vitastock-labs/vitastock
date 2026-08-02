import "@colors/colors";
import { getServiceKeepAliveEnv } from "@vitastock/env/backend";
import { consola } from "consola";
import { createClient } from "redis";
import { keepServicesAlive } from "../src/services/maintenance/keepAlive";

const environment = getServiceKeepAliveEnv();
const redisCacheClient = createClient({ url: environment.REDIS_CACHE_URL });
const redisQueueClient = createClient({ url: environment.REDIS_QUEUE_URL });
const redisClients = [redisCacheClient, redisQueueClient];

redisCacheClient.on("error", (error) => consola.error("Redis cache keepalive error", error));
redisQueueClient.on("error", (error) => consola.error("Redis queue keepalive error", error));

try {
	await Promise.all(redisClients.map((redisClient) => redisClient.connect()));

	await keepServicesAlive({
		brevoApiKey: environment.BREVO_API_KEY,
		redisClients,
	});

	consola.success("Brevo and Redis keepalive completed successfully!".green.italic);
} catch (error) {
	consola.error(new Error("Brevo or Redis keepalive failed", { cause: error }));
	process.exitCode = 1;
} finally {
	await Promise.all(
		redisClients.map(async (redisClient) => {
			redisClient.isOpen && (await redisClient.close());
		})
	);
}
