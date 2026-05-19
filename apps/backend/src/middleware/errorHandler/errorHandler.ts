import { consola } from "consola";
import type { ErrorHandler } from "hono";
import type { HTTPException } from "hono/http-exception";
import type { BlankEnv } from "hono/types";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { errorCodes } from "../../constants";
import { AppError } from "../../lib/utils";
import { transformError } from "./transformError";

const errorHandler: ErrorHandler<BlankEnv> = (error: AppError | Error | HTTPException, ctx) => {
	const modifiedError = transformError(error);

	/* eslint-disable perfectionist/sort-objects */
	const errorInfo = {
		status: "error",
		message: modifiedError.message,
		...(Boolean(modifiedError.errors) && { errors: modifiedError.errors }),
	};

	consola.error(`${error.name}:`, {
		...errorInfo,
		...(Boolean(modifiedError.cause) && { cause: modifiedError.cause }),
		stack: modifiedError.stack,
	});

	/* eslint-enable perfectionist/sort-objects */
	const ERROR_LOOKUP = new Map<ContentfulStatusCode, () => unknown>([
		[errorCodes.BAD_REQUEST, () => ctx.json(errorInfo, 400)],

		[errorCodes.CONFLICT, () => ctx.json(errorInfo, 409)],

		[errorCodes.FORBIDDEN, () => ctx.json(errorInfo, 403)],

		[errorCodes.NOT_FOUND, () => ctx.json(errorInfo, 404)],

		[errorCodes.PAYMENT_REQUIRED, () => ctx.json(errorInfo, 402)],

		[errorCodes.REQUEST_TIMEOUT, () => ctx.json(errorInfo, 408)],

		[errorCodes.SERVER_ERROR, () => ctx.json(errorInfo, 500)],

		[errorCodes.UNAUTHORIZED, () => ctx.json(errorInfo, 401)],

		[errorCodes.VALIDATION_ERROR, () => ctx.json(errorInfo, 422)],
	]);

	const statusCodeHandler =
		ERROR_LOOKUP.get(modifiedError.statusCode) ?? ERROR_LOOKUP.get(errorCodes.SERVER_ERROR);

	return statusCodeHandler?.() as never;
};

export { errorHandler };
