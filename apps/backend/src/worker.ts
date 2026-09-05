import "@colors/colors";
import { closeDatabaseConnection, initializeDatabaseConnection } from "@vitastock/db";
import { appLogger } from "./lib/logger";
import { initializeBackgroundServices, stopBackgroundServices } from "./services/background";

try {
	await initializeDatabaseConnection();
	await initializeBackgroundServices();
} catch (error) {
	appLogger.critical({ error, message: "Failed to start background workers" });
	await Promise.allSettled([closeDatabaseConnection(), stopBackgroundServices()]);
	process.exitCode = 1;
}

const shutdown = async (signal: string) => {
	appLogger.pretty.info(`Received ${signal}; stopping background workers...`);

	await Promise.all([closeDatabaseConnection(), stopBackgroundServices()]);
	process.exitCode = 0;
};

process.on("SIGINT", (signal) => void shutdown(signal));
process.on("SIGTERM", (signal) => void shutdown(signal));
