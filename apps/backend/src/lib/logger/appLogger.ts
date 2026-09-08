import { isFunction, isString } from "@zayne-labs/toolkit-type-helpers";
import { consola } from "consola";
import { pino, type Logger as PinoLogger } from "pino";
import pretty from "pino-pretty";
import { ENVIRONMENT } from "@/config/env";
import { requestContext } from "@/middleware/authMiddleware/requestContext";

type PrettyLogPayload = {
	method?: unknown;
	msg?: unknown;
	req?: {
		method?: unknown;
		url?: unknown;
	};
	responseTime?: unknown;
	route?: unknown;
};

const getStringValue = (value: unknown) => {
	return isString(value) ? value : undefined;
};

const getLogMessageValue = (value: unknown) => {
	return typeof value === "number" || typeof value === "string" ? String(value) : undefined;
};

const prettyStream = pretty({
	colorize: true,
	messageFormat: (log: PrettyLogPayload) => {
		const method = getStringValue(log.req?.method) ?? getStringValue(log.method);
		const url = getStringValue(log.req?.url) ?? getStringValue(log.route);
		const responseTime = getLogMessageValue(log.responseTime);
		const message = getStringValue(log.msg) ?? "backend log";

		if (method && url && responseTime) {
			return `'${method}' request to url:'${url}' completed in ${responseTime}ms with message:'${message}'`;
		}

		return message;
	},
	singleLine: true,
});

const loggerOptions = {
	base: {
		env: ENVIRONMENT.NODE_ENV,
		service: ENVIRONMENT.PROCESS_TYPE,
	},
	level: ENVIRONMENT.LOG_LEVEL,
	redact: {
		censor: "[REDACTED]",
		paths: [
			"authorization",
			"cookie",
			"req.headers.authorization",
			"req.headers.cookie",
			"*.accessToken",
			"*.defaultPassword",
			"*.password",
			"*.refreshToken",
			"*.resetToken",
			"*.token",
			"*.tokenHash",
			"*.verificationCode",
		],
	},
	timestamp: pino.stdTimeFunctions.isoTime,
} satisfies Parameters<typeof pino>[0];

export const structuredLogger =
	ENVIRONMENT.NODE_ENV === "development" ? pino(loggerOptions, prettyStream) : pino(loggerOptions);

const getContextualLogger = (): typeof structuredLogger => {
	try {
		const ctx = requestContext.get();
		const requestLogger = ctx.honoCtx.get("logger");
		return (requestLogger ?? structuredLogger) as typeof structuredLogger;
	} catch {
		return structuredLogger;
	}
};

type CriticalLogOptions = {
	error?: unknown;
	message: string;
	meta?: Record<string, unknown>;
};

/**
 * Unified application logger with automatic request-scoped context.
 *
 * Uses request-scoped logger (includes requestId, userId, workspaceId) in HTTP contexts,
 * falls back to root logger otherwise.
 */
export const appLogger = {
	child: (bindings: Record<string, unknown>) => {
		return getContextualLogger().child(bindings);
	},

	critical: (options: CriticalLogOptions) => {
		const { error, message, meta } = options;

		getContextualLogger().fatal({ err: error, ...meta }, message);
		consola.error(error instanceof Error ? new Error(message, { cause: error }) : message, meta);
	},

	pretty: consola,

	structured: new Proxy(structuredLogger, {
		get: (_target, prop: string) => {
			const logger = getContextualLogger();
			const value = logger[prop as keyof typeof logger];
			return isFunction(value) ? value.bind(logger) : value;
		},
	}),
};

export type RequestLogger = PinoLogger;
