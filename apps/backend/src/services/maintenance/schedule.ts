import { Cron } from "croner";
import { ENVIRONMENT } from "@/config/env";
import { appLogger } from "@/lib/logger";
import { redisCacheClient } from "@/services/cache/cacheClient";
import { redisQueueClient } from "@/services/queues/utils/queueClient";
import { keepServicesAlive } from "./keepAlive";

let serviceKeepAliveJob: Cron | null = null;

export const startServiceKeepAliveSchedule = () => {
	serviceKeepAliveJob ??= new Cron(
		"0 0 9 1 * *",
		{
			catch: (error) => {
				appLogger.critical({ error, message: "Service keepalive job failed" });
			},
			name: "service-keepalive",
			protect: true,
			timezone: "Africa/Lagos",
		},
		async () => {
			await keepServicesAlive({
				brevoApiKey: ENVIRONMENT.BREVO_API_KEY,
				redisClients: [redisCacheClient, redisQueueClient],
			});

			appLogger.pretty.success("Brevo and Redis keepalive completed successfully!");
		}
	);
};

export const stopServiceKeepAliveSchedule = () => {
	serviceKeepAliveJob?.stop();
	serviceKeepAliveJob = null;
};
