import type { Context, Env, Input } from "hono";
import {
	RedisStore,
	type ConfigProps,
	type HonoConfigProps,
	type RateLimitInfo,
	type RedisClient,
} from "hono-rate-limiter";
import type { HonoAppBindings } from "@/lib/types/common";
import { AppError, getClientIp } from "@/lib/utils";
import { redisCacheClient } from "@/services/cache/cacheClient";

const redisRateLimitClient = {
	decr: (key) => redisCacheClient.decr(key),
	del: (key) => redisCacheClient.del(key),
	evalsha: (sha1, keys, args) => {
		return redisCacheClient.evalSha(sha1, { arguments: args.map(String), keys }) as never;
	},
	scriptLoad: (script) => redisCacheClient.scriptLoad(script),
} satisfies RedisClient;

// == Coarse flood guard. Staff share a pharmacy's IP, so per-person limits live in userRateLimiterOptions
const globalRateLimiterOptions: ConfigProps = {
	handler: () => {
		throw new AppError({
			code: 429,
			message: "Too many requests from this IP, please try again later.",
		});
	},
	keyGenerator: (ctx) => getClientIp(ctx) ?? "",
	limit: 1000,
	// == Without a proxy-provided IP every client would share one bucket, so leave them to the user limiter
	skip: (ctx) => getClientIp(ctx) === undefined,
	standardHeaders: "draft-7",
	store: new RedisStore({ client: redisRateLimitClient, prefix: "rate-limit:global:" }),
	windowMs: 15 * 60 * 1000,
};

// == Applied after authMiddleware, so each signed-in user gets their own budget regardless of shared IPs
const userRateLimiterOptions: ConfigProps<HonoAppBindings> = {
	handler: () => {
		throw new AppError({
			code: 429,
			message: "Too many requests, please slow down and try again shortly.",
		});
	},
	keyGenerator: (ctx) => ctx.get("currentUser").id,
	limit: 300,
	standardHeaders: "draft-7",
	store: new RedisStore({ client: redisRateLimitClient, prefix: "rate-limit:user:" }),
	windowMs: 60 * 1000,
};

const formatRetryDelay = (retryAfterMs: number) => {
	const minutes = Math.ceil(retryAfterMs / (60 * 1000));

	if (minutes <= 1) {
		return "about a minute";
	}

	if (minutes < 60) {
		return `about ${minutes} minutes`;
	}

	const hours = Math.round(minutes / 60);

	return hours === 1 ? "about an hour" : `about ${hours} hours`;
};

export const getRateLimitedMessage = (ctx: Context, windowMs: number) => {
	const { rateLimit } = ctx.var as { rateLimit?: RateLimitInfo };

	const retryAfterMs = rateLimit?.resetTime ? rateLimit.resetTime.getTime() - Date.now() : windowMs;

	return `Too many attempts. Please try again in ${formatRetryDelay(retryAfterMs)}.`;
};

type AuthRateLimitedRoute =
	| "change-password"
	| "forgot-password"
	| "resend-verification-email"
	| "reset-password"
	| "signin-ip"
	| "signin"
	| "signup"
	| "verify-email";

type AuthRateLimiterOverrides<TInput extends Input> = Pick<
	HonoConfigProps<Env, string, TInput>,
	"keyGenerator" | "limit" | "skipSuccessfulRequests" | "windowMs"
>;

export const createAuthRateLimiterOptions = <TInput extends Input = Input>(
	route: AuthRateLimitedRoute,
	overrides?: Partial<AuthRateLimiterOverrides<TInput>>
): HonoConfigProps<Env, string, TInput> => {
	const windowMs = overrides?.windowMs ?? 30 * 60 * 1000;

	return {
		handler: (ctx) => {
			throw new AppError({ code: 429, message: getRateLimitedMessage(ctx, windowMs) });
		},
		keyGenerator: (ctx) => getClientIp(ctx) ?? "unknown",
		limit: 10,
		standardHeaders: "draft-7",
		store: new RedisStore({ client: redisRateLimitClient, prefix: `rate-limit:auth:${route}:` }),
		...overrides,
		windowMs,
	};
};

const authRateLimiterOptions = {
	"change-password": createAuthRateLimiterOptions("change-password"),
	"forgot-password": createAuthRateLimiterOptions("forgot-password"),
	"resend-verification-email": createAuthRateLimiterOptions("resend-verification-email"),
	"reset-password": createAuthRateLimiterOptions("reset-password"),

	signin: createAuthRateLimiterOptions<{ out: { json: { email: string } } }>("signin", {
		keyGenerator: (ctx) => `${getClientIp(ctx) ?? "unknown"}:${ctx.req.valid("json").email}`,
		limit: 10,
		skipSuccessfulRequests: true,
		windowMs: 15 * 60 * 1000,
	}),

	"signin-ip": createAuthRateLimiterOptions("signin-ip", {
		limit: 50,
		skipSuccessfulRequests: true,
		windowMs: 60 * 60 * 1000,
	}),

	signup: createAuthRateLimiterOptions("signup"),
	"verify-email": createAuthRateLimiterOptions("verify-email"),
};

export { authRateLimiterOptions, globalRateLimiterOptions, userRateLimiterOptions };
