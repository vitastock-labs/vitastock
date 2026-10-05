/* eslint-disable import/no-named-as-default-member */
import type { HTTPException } from "hono/http-exception";
// eslint-disable-next-line import/default
import jwt from "jsonwebtoken";
import { AppError } from "@/lib/utils";

const handleTimeoutError = (error: Error) => {
	return new AppError({ cause: error, code: 408, message: "Request timeout" });
};

const handleJWTError = (error: jwt.JsonWebTokenError) => {
	return new AppError({ cause: error, code: 401, message: "Invalid token!" });
};

const handleJWTExpiredError = (error: jwt.TokenExpiredError) => {
	return new AppError({ cause: error, code: 401, message: "Your token has expired!" });
};

const isDatabaseError = (error: Error) => {
	return error.name === "PostgresError" || error.name === "DatabaseError";
};

const handleDatabaseError = (error: Error) => {
	return new AppError({
		cause: error,
		code: 500,
		message: "A database error occurred",
		realReason: error.message,
	});
};

const handleUnknownError = (error: Error) => {
	return new AppError({
		cause: error,
		code: 500,
		message: "Something went wrong",
		realReason: error.message,
	});
};

export const transformError = (error: AppError | Error | HTTPException) => {
	let modifiedError = error;

	switch (true) {
		case error instanceof AppError: {
			break;
		}

		case "timeout" in error && error.timeout: {
			modifiedError = handleTimeoutError(error);
			break;
		}

		case error instanceof jwt.TokenExpiredError: {
			modifiedError = handleJWTExpiredError(error);
			break;
		}

		case error instanceof jwt.JsonWebTokenError: {
			modifiedError = handleJWTError(error);
			break;
		}

		case error instanceof Error && isDatabaseError(error): {
			modifiedError = handleDatabaseError(error);
			break;
		}

		case error instanceof Error: {
			modifiedError = handleUnknownError(error);
			break;
		}

		default: {
			break;
		}
	}

	return modifiedError as AppError;
};
