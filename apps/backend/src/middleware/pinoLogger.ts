import { pinoLogger as pinoLoggerPrimitive } from "hono-pino";
import { structuredLogger } from "@/lib/logger";
import type { HonoAppBindings } from "@/lib/types/common";
import { getClientIp } from "@/lib/utils";

export const pinoLogger = structuredLogger;

export const pinoLoggerMiddleware = () => {
	return pinoLoggerPrimitive({
		http: {
			onReqBindings: (ctx) => {
				const { requestId } = ctx.var as Partial<HonoAppBindings["Variables"]>;

				return {
					client: {
						ip: getClientIp(ctx),
						origin: ctx.req.header("origin"),
						referer: ctx.req.header("referer"),
						userAgent: ctx.req.header("user-agent"),
					},
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
