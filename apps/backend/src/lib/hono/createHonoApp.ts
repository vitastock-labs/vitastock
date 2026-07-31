import { Hono } from "hono";
import { rateLimiter } from "hono-rate-limiter";
import { cors } from "hono/cors";
import { csrf } from "hono/csrf";
import { requestId } from "hono/request-id";
import { secureHeaders } from "hono/secure-headers";
import { allowedOrigins, corsOptions } from "@/config/corsOptions";
import { globalRateLimiterOptions } from "@/config/rateLimiterOptions";
import { secureHeadersOptions } from "@/config/secureHeadersOptions";
import type { HonoAppBindings } from "@/lib/types/common";
import { errorHandler, notFoundHandler } from "@/middleware";
import { pinoLoggerMiddleware } from "@/middleware/pinoLogger";

const createHonoApp = () => {
	const app = new Hono<HonoAppBindings>({ strict: false });

	/**
	 *  == Middleware - App Security
	 */
	app.use(rateLimiter(globalRateLimiterOptions));
	app.use(secureHeaders(secureHeadersOptions));
	app.use(cors(corsOptions));
	app.use(csrf({ origin: allowedOrigins, secFetchSite: ["same-origin", "same-site", "none"] }));

	/**
	 *  == Middleware - Request ID
	 */
	app.use(requestId());
	app.use(async (ctx, next) => {
		ctx.set("requestStartedAt", performance.now());
		await next();
	});

	/**
	 *  == Middleware - Logger
	 */
	app.use(
		// structuredLogger({
		// 	createLogger: (c) => pinoLogger.child({ requestId: c.var.requestId }),
		// })
		pinoLoggerMiddleware()
	);

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
