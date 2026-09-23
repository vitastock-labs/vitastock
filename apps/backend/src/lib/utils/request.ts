import type { Context } from "hono";

export const getClientIp = (ctx: Context) => {
	const forwardedFor = ctx.req.header("x-forwarded-for")?.split(",", 1)[0]?.trim();

	return forwardedFor ?? ctx.req.header("x-real-ip");
};
