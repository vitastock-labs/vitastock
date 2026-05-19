import "@colors/colors";
import { serve } from "@hono/node-server";
import { consola } from "consola";
import { app } from "./app";
import { ENVIRONMENT } from "./config/env";
import { initializeRedisCacheClient } from "./services/cache";
import { startAllQueuesAndWorkers, stopAllQueuesAndWorkers } from "./services/queues/utils/queues";

const server = serve(
	{
		fetch: app.fetch,
		port: ENVIRONMENT.PORT,
	},
	(info) => {
		const message =
			ENVIRONMENT.NODE_ENV === "development" ? `http://localhost:${info.port}` : `PORT=${info.port}`;

		consola.info(`Server is running on ${message}`.yellow.italic);

		void Promise.all([initializeRedisCacheClient(), startAllQueuesAndWorkers()])
			.then(() => {
				consola.success("All services initialized successfully!".green.italic);
			})
			.catch((error) => {
				consola.error("Failed to start server due to service initialization failure", error);
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

	consola.error(new Error(message, { cause: error }));

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

	consola.error(new Error(message, { cause: error }));

	void stopAllQueuesAndWorkers();

	server.close(() => {
		// eslint-disable-next-line node/no-process-exit
		process.exit(1);
	});
});

// eslint-disable-next-line unicorn/prefer-export-from
export default app;
