import { consola } from "consola";
import { createHonoApp } from "@/lib/hono";
import { createBullBoardSetup } from "@/services/queues/utils/bullBoard";
import { authRoutes } from "./auth/routes";

const app = createHonoApp();

/**
 *  == Health Check Route
 */
app.on("GET", ["/", "/health"], (c) => {
	/* eslint-disable perfectionist/sort-objects */
	return c.json({
		status: "success",
		message: "Server is up and running!",
	});
	/* eslint-enable perfectionist/sort-objects */
});

/**
 *  == Routes - v1
 */
app.basePath("/api/v1").route("", authRoutes);

// TODO - Protect this route with basic hono login or hosted on a diff platform
try {
	const bullBoardSetup = await createBullBoardSetup();

	app.route(bullBoardSetup.baseQueuesPath, bullBoardSetup.queuesServerAdapter.registerPlugin());
} catch (error) {
	consola.error(new Error(`Failed to load bullboard`, { cause: error }));
}

export { app };
