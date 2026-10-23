import type { IncomingMessage } from "node:http";
import type { Context } from "hono";

type NodeBindings = { incoming?: IncomingMessage } | undefined;

const getSocketAddress = (ctx: Context) => {
	const env = ctx.env as (NodeBindings & { server?: NodeBindings }) | undefined;

	return (env?.server ?? env)?.incoming?.socket.remoteAddress;
};

// == DigitalOcean App Platform puts the real client IP in do-connecting-ip; its x-forwarded-for holds the ingress server
export const getClientIp = (ctx: Context) => {
	const forwardedFor = ctx.req.header("x-forwarded-for")?.split(",", 1)[0]?.trim();

	return (
		ctx.req.header("do-connecting-ip")
		?? forwardedFor
		?? ctx.req.header("x-real-ip")
		?? getSocketAddress(ctx)
	);
};
