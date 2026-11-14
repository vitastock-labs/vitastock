import { Hono } from "hono";
import { rateLimiter } from "hono-rate-limiter";
import { cors } from "hono/cors";
import { csrf } from "hono/csrf";
import { requestId } from "hono/request-id";
import { secureHeaders } from "hono/secure-headers";
import { allowedOrigins, corsOptions } from "@/config/corsOptions";
import { globalRateLimiterOptions } from "@/config/rateLimiterOptions";
import { secureHeadersOptions } from "@/config/secureHeadersOptions";
import { appLogger } from "@/lib/logger";
import type { HonoAppBindings } from "@/lib/types/common";
import { errorHandler, notFoundHandler } from "@/middleware";
import { pinoLoggerMiddleware } from "@/middleware/pinoLogger";
import { mountBullBoard } from "@/services/queues/utils/bullBoard";

const createHonoApp = async () => {
	const app = new Hono<HonoAppBindings>({ strict: false });

	/**
	 *  == Middleware - Request context and logger
	 */
	app.use(requestId());
	app.use(async (ctx, next) => {
		ctx.set("requestStartedAt", performance.now());
		await next();
	});
	app.use(pinoLoggerMiddleware());

	/**
	 *  == Infrastructure Routes
	 */
	try {
		await mountBullBoard(app);
	} catch (error) {
		appLogger.pretty.error(new Error("Failed to load Bull Board", { cause: error }));
	}

	/**
	 *  == Middleware - App Security
	 */
	app.use(secureHeaders(secureHeadersOptions));
	app.use(cors(corsOptions));
	app.use(csrf({ origin: allowedOrigins, secFetchSite: ["same-origin", "same-site", "none"] }));
	app.use("/api/*", rateLimiter(globalRateLimiterOptions));

	/**
	 *  == Notfound Route handler
	 */
	app.notFound(notFoundHandler);

	/**
	 *  == Central error handler
	 */
	app.onError(errorHandler);

	return app;
};

export { createHonoApp };
