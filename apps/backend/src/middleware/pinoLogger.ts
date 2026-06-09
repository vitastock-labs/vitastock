import { pinoLogger as pinoLoggerPrimitive } from "hono-pino";
import { structuredLogger } from "@/lib/logger";

export const pinoLogger = structuredLogger;

export const pinoLoggerMiddleware = () => {
	return pinoLoggerPrimitive({
		http: {
			onReqBindings: (ctx) => ({
				req: {
					method: ctx.req.method,
					url: ctx.req.path,
				},
			}),
			onResBindings: (ctx) => ({
				res: {
					status: ctx.res.status,
				},
			}),
		},
		pino: pinoLogger,
	});
};
