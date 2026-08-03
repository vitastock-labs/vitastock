import { basicAuth } from "hono/basic-auth";
import { ENVIRONMENT } from "@/config/env";
import { createHonoApp } from "@/lib/hono";
import { appLogger } from "@/lib/logger";
import { createBullBoardSetup } from "@/services/queues/utils/bullBoard";
import { authRoutes } from "./auth/routes";
import { dashboardRoutes } from "./dashboard/routes";
import { inventoryRoutes } from "./inventory/routes";
import { workspaceRoutes } from "./workspace/routes";

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
app.basePath("/api/v1")
	.route("", authRoutes)
	.route("", dashboardRoutes)
	.route("", inventoryRoutes)
	.route("", workspaceRoutes);

try {
	const bullBoardAuthMiddleware = basicAuth({
		password: ENVIRONMENT.BULL_BOARD_PASSWORD,
		realm: "VitaStock Queue Administration",
		username: ENVIRONMENT.BULL_BOARD_USERNAME,
	});

	const bullBoardSetup = await createBullBoardSetup();

	app.use(bullBoardSetup.baseQueuesPath, bullBoardAuthMiddleware);
	app.use(`${bullBoardSetup.baseQueuesPath}/*`, bullBoardAuthMiddleware);

	app.route(bullBoardSetup.baseQueuesPath, bullBoardSetup.queuesServerAdapter.registerPlugin());
} catch (error) {
	appLogger.pretty.error(new Error("Failed to load Bull Board", { cause: error }));
}

export { app };
