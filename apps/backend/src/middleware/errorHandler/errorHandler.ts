import { pickKeys } from "@zayne-labs/toolkit-core";
import type { ErrorHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { errorCodes } from "@/constants";
import { appLogger } from "@/lib/logger";
import type { HonoAppBindings } from "@/lib/types/common";
import { AppError } from "@/lib/utils";
import { transformError } from "./transformError";

const errorHandler: ErrorHandler<HonoAppBindings> = (error: AppError | Error | HTTPException, ctx) => {
	if (error instanceof HTTPException) {
		return error.getResponse();
	}

	const modifiedError = transformError(error);
	const { currentUser, currentWorkspace, logger, requestId, requestStartedAt } = ctx.var as Partial<
		HonoAppBindings["Variables"]
	>;

	/* eslint-disable perfectionist/sort-objects */
	const errorInfo = {
		status: "error",
		message: modifiedError.message,
		...(modifiedError.appCode && { appCode: modifiedError.appCode }),
		...(Boolean(modifiedError.errors) && { errors: modifiedError.errors }),
	};

	const errorLogInfo = {
		...errorInfo,
		...(requestStartedAt !== undefined && {
			durationMs: Math.round((performance.now() - requestStartedAt) * 100) / 100,
		}),
		method: ctx.req.method,
		path: ctx.req.path,
		requestId,
		userId: currentUser?.id,
		...(Boolean(modifiedError.realReason) && pickKeys(modifiedError, ["realReason"])),
		...(Boolean(modifiedError.cause) && pickKeys(modifiedError, ["cause"])),
		statusCode: modifiedError.statusCode,
		workspaceId: currentWorkspace?.id,
	};

	appLogger.pretty.error(`${error.name}: ${errorLogInfo.message}\n`, error, errorLogInfo);

	(logger ?? appLogger.structured).error({ err: modifiedError, ...errorLogInfo }, modifiedError.message);

	/* eslint-enable perfectionist/sort-objects */
	const ERROR_LOOKUP = new Map<ContentfulStatusCode, () => unknown>([
		[errorCodes.BAD_REQUEST, () => ctx.json(errorInfo, 400)],

		[errorCodes.CONFLICT, () => ctx.json(errorInfo, 409)],

		[errorCodes.FORBIDDEN, () => ctx.json(errorInfo, 403)],

		[errorCodes.NOT_FOUND, () => ctx.json(errorInfo, 404)],

		[errorCodes.PAYMENT_REQUIRED, () => ctx.json(errorInfo, 402)],

		[errorCodes.REQUEST_TIMEOUT, () => ctx.json(errorInfo, 408)],

		[errorCodes.SERVER_ERROR, () => ctx.json(errorInfo, 500)],

		[errorCodes.TOO_MANY_REQUESTS, () => ctx.json(errorInfo, 429)],

		[errorCodes.UNAUTHORIZED, () => ctx.json(errorInfo, 401)],

		[errorCodes.VALIDATION_ERROR, () => ctx.json(errorInfo, 422)],
	]);

	const statusCodeHandler =
		ERROR_LOOKUP.get(modifiedError.statusCode) ?? ERROR_LOOKUP.get(errorCodes.SERVER_ERROR);

	return statusCodeHandler?.() as never;
};

export { errorHandler };
