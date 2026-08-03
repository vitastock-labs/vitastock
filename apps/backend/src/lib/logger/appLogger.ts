import { isString } from "@zayne-labs/toolkit-type-helpers";
import { consola } from "consola";
import { pino } from "pino";
import pretty from "pino-pretty";
import { ENVIRONMENT } from "@/config/env";

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

type CriticalLogOptions = {
	error?: unknown;
	message: string;
	meta?: Record<string, unknown>;
};

export const appLogger = {
	critical: (options: CriticalLogOptions) => {
		const { error, message, meta } = options;

		structuredLogger.fatal({ err: error, ...meta }, message);
		consola.error(error instanceof Error ? new Error(message, { cause: error }) : message, meta);
	},
	pretty: consola,
	structured: structuredLogger,
};
