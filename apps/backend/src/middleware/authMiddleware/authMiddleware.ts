import { db } from "@vitastock/db";
import { workspaces } from "@vitastock/db/schema/workspaces";
import { eq } from "drizzle-orm";
import { createMiddleware } from "hono/factory";
import { getCookie, setCookie } from "@/app/auth/services/cookie";
import type { HonoAppBindings } from "@/lib/types/common";
import { AppError } from "@/lib/utils";
import { getFromCache } from "@/services/cache";
import { requestContext } from "./requestContext";
import { validateUserSession } from "./validateUserSession";

const authMiddleware = createMiddleware<HonoAppBindings>(async (ctx, next) => {
	await requestContext.run({ path: ctx.req.path, userAgent: ctx.req.header("user-agent") }, async () => {
		const { currentUser, newZayneAccessTokenResult } = await validateUserSession({
			zayneAccessToken: getCookie(ctx, "zayneVitaStockAccessToken"),
			zayneRefreshToken: getCookie(ctx, "zayneVitaStockRefreshToken"),
		});

		if (newZayneAccessTokenResult) {
			setCookie(ctx, {
				expires: newZayneAccessTokenResult.expiresAt,
				name: "zayneVitaStockAccessToken",
				value: newZayneAccessTokenResult.token,
			});
		}

		ctx.set("currentUser", currentUser);

		const currentWorkspace = await getFromCache(`workspace:${currentUser.workspaceId}`, {
			onCacheMiss: async () => {
				const [workspace] = await db
					.select()
					.from(workspaces)
					.where(eq(workspaces.id, currentUser.workspaceId))
					.limit(1);

				return workspace;
			},
		});

		if (!currentWorkspace) {
			throw new AppError({
				code: 500,
				message: "User workspace not found",
			});
		}

		ctx.set("currentWorkspace", currentWorkspace);

		await next();
	});
});

export { authMiddleware };
