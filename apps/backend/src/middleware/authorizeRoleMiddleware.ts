import type { SelectUserType } from "@vitastock/db/schema/auth";
import { createMiddleware } from "hono/factory";
import type { HonoAppBindings } from "@/lib/types/common";
import { AppError } from "@/lib/utils";

const authorizeRoleMiddleware = (
	allowedRoles: Array<SelectUserType["role"]>,
	options?: { errorMessage?: string }
) => {
	const { errorMessage = "Access Denied" } = options ?? {};

	const allowedRolesSet = new Set(allowedRoles);

	return createMiddleware<HonoAppBindings>(async (ctx, next) => {
		const currentUser = ctx.get("currentUser");

		if (!allowedRolesSet.has(currentUser.role)) {
			throw new AppError({
				cause: `User role '${currentUser.role}' is not authorized. Required roles: ${allowedRoles.join(", ")}`,
				code: 403,
				message: errorMessage,
			});
		}

		await next();
	});
};

export { authorizeRoleMiddleware };
