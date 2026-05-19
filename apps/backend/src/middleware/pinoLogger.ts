import { pinoLogger as pinoLoggerPrimitive } from "hono-pino";
import { pino } from "pino";
import pretty from "pino-pretty";
import { ENVIRONMENT } from "@/config/env";

export const pinoLogger = pino(
	{
		level: ENVIRONMENT.LOG_LEVEL,
		timestamp: pino.stdTimeFunctions.unixTime,
	},
	pretty({
		colorize: true,
		// eslint-disable-next-line ts-eslint/no-explicit-any
		messageFormat: (log: any) => {
			// eslint-disable-next-line ts-eslint/restrict-template-expressions, ts-eslint/no-unsafe-member-access
			return `'${log.req.method}' request to url:'${log.req.url}' completed in ${log.responseTime}ms with message:'${log.msg}'`;
		},
		singleLine: true,
	})
);

export const pinoLoggerMiddleware = () => {
	return pinoLoggerPrimitive({
		pino: pinoLogger,
	});
};
