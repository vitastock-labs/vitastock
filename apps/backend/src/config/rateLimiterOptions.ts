import type { ConfigProps } from "hono-rate-limiter";
import { AppError } from "@/lib/utils";

const globalRateLimiterOptions: ConfigProps = {
	handler: () => {
		throw new AppError({
			code: 429,
			message: "Too many requests from this IP, please try again later.",
		});
	},
	keyGenerator: (ctx) => ctx.req.header("x-forwarded-for") ?? "unknown",
	limit: 100,
	standardHeaders: "draft-7",
	windowMs: 15 * 60 * 1000,
};

const authRateLimiterOptions: ConfigProps = {
	handler: () => {
		throw new AppError({
			code: 429,
			message: "Too many auth attempts from this IP, please try again later.",
		});
	},
	keyGenerator: (ctx) => ctx.req.header("x-forwarded-for") ?? "unknown",
	limit: 10,
	standardHeaders: "draft-7",
	windowMs: 30 * 60 * 1000,
};

export { authRateLimiterOptions, globalRateLimiterOptions };
