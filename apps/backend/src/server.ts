import "@colors/colors";
import { serve } from "@hono/node-server";
import { app } from "./app";
import { registerAuthEventSubscribers } from "./app/auth/services/events";
import { registerWorkspaceEventSubscribers } from "./app/workspace/services/events";
import { ENVIRONMENT } from "./config/env";
import { appLogger } from "./lib/logger";
import { initializeBackgroundServices, stopBackgroundServices } from "./services/background";
import { closeRedisCacheClient, initializeRedisCacheClient } from "./services/cache";
import { registerEmailEnqueueEventSubscribers } from "./services/queues/events";

registerAuthEventSubscribers();
registerWorkspaceEventSubscribers();
registerEmailEnqueueEventSubscribers();

try {
	await Promise.all([initializeRedisCacheClient(), initializeBackgroundServices()]);

	appLogger.pretty.success("API and background services initialized successfully!".green.italic);
} catch (error) {
	appLogger.critical({
		error,
		message: "Failed to initialize API or background services",
	});

	await Promise.allSettled([closeRedisCacheClient(), stopBackgroundServices()]);

	// eslint-disable-next-line node/no-process-exit, unicorn/no-process-exit
	process.exit(1);
}

const server = serve(
	{
		fetch: app.fetch,
		port: ENVIRONMENT.PORT,
	},
	(info) => {
		const message =
			ENVIRONMENT.NODE_ENV === "development" ? `http://localhost:${info.port}` : `PORT=${info.port}`;

		appLogger.pretty.info(`Server is running on ${message}`.yellow.italic);
	}
);

let isShuttingDown = false;

const shutdown = (signal: string) => {
	if (isShuttingDown) return;

	isShuttingDown = true;

	appLogger.pretty.info(`Received ${signal}; stopping API services...`);

	server.close(() => {
		void Promise.all([closeRedisCacheClient(), stopBackgroundServices()]).finally(() => {
			process.exitCode = 0;
		});
	});
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

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

	server.close(() => {
		void Promise.all([closeRedisCacheClient(), stopBackgroundServices()]).finally(() => {
			// eslint-disable-next-line node/no-process-exit
			process.exit(1);
		});
	});
});

// eslint-disable-next-line unicorn/prefer-export-from
export default app;
