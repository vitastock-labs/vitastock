import { createHonoApp } from "@/lib/hono";
import { authRoutes } from "./auth/routes";
import { dashboardRoutes } from "./dashboard/routes";
import { inventoryRoutes } from "./inventory/routes";
import { workspaceRoutes } from "./workspace/routes";

const app = await createHonoApp();

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

export { app };
