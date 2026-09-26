import type { Context } from "hono";

// == DigitalOcean App Platform puts the real client IP in do-connecting-ip; its x-forwarded-for holds the ingress server
export const getClientIp = (ctx: Context) => {
	const forwardedFor = ctx.req.header("x-forwarded-for")?.split(",", 1)[0]?.trim();

	return ctx.req.header("do-connecting-ip") ?? forwardedFor ?? ctx.req.header("x-real-ip");
};
