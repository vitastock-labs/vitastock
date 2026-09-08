import { pinoLogger as pinoLoggerPrimitive } from "hono-pino";
import { structuredLogger } from "@/lib/logger";
import type { HonoAppBindings } from "@/lib/types/common";

export const pinoLogger = structuredLogger;

export const pinoLoggerMiddleware = () => {
	return pinoLoggerPrimitive({
		http: {
			onReqBindings: (ctx) => {
				const { requestId } = ctx.var as Partial<HonoAppBindings["Variables"]>;

				return {
					req: {
						headers: ctx.req.header(),
						method: ctx.req.method,
						query: ctx.req.query(),
						url: ctx.req.path,
					},
					requestId,
				};
			},
			onResBindings: (ctx) => ({
				res: {
					status: ctx.res.status,
				},
			}),
		},
		pino: pinoLogger,
	});
};
