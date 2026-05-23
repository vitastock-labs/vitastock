import type { AuthErrorAppCodeType } from "@vitastock/shared/constants";
import type { ErrorCodesUnion } from "@/constants";

// import type { ContentfulStatusCode } from "hono/utils/http-status";

class AppError extends Error {
	appCode?: AuthErrorAppCodeType;
	errors?: unknown;
	errorStatus: string;
	realReason?: string;
	// statusCode: ContentfulStatusCode;

	statusCode: ErrorCodesUnion;

	constructor(
		options: ErrorOptions & {
			appCode?: AuthErrorAppCodeType;
			code: ErrorCodesUnion;
			errors?: unknown;
			message: string;
			realReason?: string;
		}
	) {
		const { appCode, cause, code: statusCode, errors, message, realReason } = options;

		super(message, { cause });

		this.appCode = appCode;
		this.statusCode = statusCode;
		this.errorStatus = String(statusCode).startsWith("5") ? "Failed" : "Error";
		this.errors = errors;
		this.realReason = realReason;
	}

	static override isError(error: unknown): error is AppError {
		return error instanceof AppError;
	}
}

export { AppError };
