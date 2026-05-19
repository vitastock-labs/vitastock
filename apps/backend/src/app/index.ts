import { consola } from "consola";
import { ENVIRONMENT } from "@/config/env";
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

if (ENVIRONMENT.NODE_ENV === "development") {
	try {
		const bullBoardSetup = await createBullBoardSetup();

		app.route(bullBoardSetup.baseQueuesPath, bullBoardSetup.queuesServerAdapter.registerPlugin());
	} catch (error) {
		consola.error(new Error(`Failed to load bullboard`, { cause: error }));
	}
}
export { app };
