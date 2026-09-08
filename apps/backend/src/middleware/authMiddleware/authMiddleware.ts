import { createMiddleware } from "hono/factory";
import type { HonoAppBindings } from "@/lib/types/common";
import { getCookie, setCookie } from "@/lib/utils/cookie";
import { requestContext } from "./requestContext";
import { validateUserSession } from "./validateUserSession";

const authMiddleware = createMiddleware<HonoAppBindings>(async (ctx, next) => {
	await requestContext.run({ honoCtx: ctx }, async () => {
		const { currentMembership, currentUser, currentWorkspace, newZayneAccessTokenResult } =
			await validateUserSession({
				existingAccessToken: getCookie(ctx, "vitastockAccessToken"),
				existingRefreshToken: getCookie(ctx, "vitastockRefreshToken"),
			});

		if (newZayneAccessTokenResult) {
			setCookie(ctx, {
				expires: newZayneAccessTokenResult.expiresAt,
				name: "vitastockAccessToken",
				value: newZayneAccessTokenResult.token,
			});
		}

		ctx.set("currentUser", currentUser);
		ctx.set("currentMembership", currentMembership);

		ctx.set("currentWorkspace", currentWorkspace);

		ctx.get("logger")?.assign({ userId: currentUser.id, workspaceId: currentWorkspace.id });

		await next();
	});
});

export { authMiddleware };
