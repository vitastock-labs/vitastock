import "@colors/colors";
import { serve } from "@hono/node-server";
import { app } from "./app";
import { registerAuthEventSubscribers } from "./app/auth/services/events";
import { registerInventoryEventSubscribers } from "./app/inventory/services/events";
import { registerWorkspaceEventSubscribers } from "./app/workspace/services/events";
import { ENVIRONMENT } from "./config/env";
import { appLogger } from "./lib/logger";
import { initializeRedisCacheClient } from "./services/cache";
import { registerQueueEventSubscribers } from "./services/queues/events";
import { startAllQueuesAndWorkers, stopAllQueuesAndWorkers } from "./services/queues/utils/queues";

const server = serve(
	{
		fetch: app.fetch,
		port: ENVIRONMENT.PORT,
	},
	(info) => {
		const message =
			ENVIRONMENT.NODE_ENV === "development" ? `http://localhost:${info.port}` : `PORT=${info.port}`;

		appLogger.pretty.info(`Server is running on ${message}`.yellow.italic);

		registerAuthEventSubscribers();
		registerInventoryEventSubscribers();
		registerWorkspaceEventSubscribers();
		registerQueueEventSubscribers();

		void Promise.all([initializeRedisCacheClient(), startAllQueuesAndWorkers()])
			.then(() => {
				appLogger.pretty.success("All services initialized successfully!".green.italic);
			})
			.catch((error) => {
				appLogger.critical({
					error,
					message: "Failed to start server due to service initialization failure",
				});
				server.close(() => {
					// eslint-disable-next-line node/no-process-exit, unicorn/no-process-exit
					process.exit(1);
				});
			});
	}
);

/**
 *  == UncaughtException handler
 */
process.on("uncaughtException", (error) => {
	const dateISO = new Date().toLocaleString("en-Nigeria", {
		dateStyle: "full",
		timeStyle: "medium",
		timeZone: "Africa/Lagos",
	});

	const message = `UNCAUGHT EXCEPTION! 💥 Server Shutting down on ${dateISO}...`;

	appLogger.critical({ error, message });

	void stopAllQueuesAndWorkers();

	// eslint-disable-next-line node/no-process-exit
	process.exit(1);
});

/**
 *  == UnhandledRejection handler
 */
process.on("unhandledRejection", (error) => {
	const dateISO = new Date().toLocaleString("en-Nigeria", {
		dateStyle: "full",
		timeStyle: "medium",
		timeZone: "Africa/Lagos",
	});

	const message = `UNHANDLED REJECTION! 💥 Server Shutting down on ${dateISO}...`;

	appLogger.critical({ error, message });

	void stopAllQueuesAndWorkers();

	server.close(() => {
		// eslint-disable-next-line node/no-process-exit
		process.exit(1);
	});
});

// eslint-disable-next-line unicorn/prefer-export-from
export default app;
