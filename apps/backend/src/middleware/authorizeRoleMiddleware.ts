import type { SelectUserType } from "@vitastock/db/schema/auth";
import { AUTH_ERRORS } from "@vitastock/shared/constants";
import { createMiddleware } from "hono/factory";
import type { HonoAppBindings } from "@/lib/types/common";
import { AppError } from "@/lib/utils";

const authorizeRoleMiddleware = (
	allowedRoles: Array<SelectUserType["role"]>,
	options?: { errorMessage?: string }
) => {
	const { errorMessage } = options ?? {};

	return createMiddleware<HonoAppBindings>(async (ctx, next) => {
		const currentUser = ctx.get("currentUser");

		if (!allowedRoles.includes(currentUser.role)) {
			throw new AppError({
				appCode: AUTH_ERRORS.INSUFFICIENT_PERMISSIONS.appCode,
				cause: `User role '${currentUser.role}' is not authorized. Required roles: ${allowedRoles.join(", ")}`,
				code: 403,
				message: errorMessage ?? AUTH_ERRORS.INSUFFICIENT_PERMISSIONS.message,
			});
		}

		await next();
	});
};

export { authorizeRoleMiddleware };
