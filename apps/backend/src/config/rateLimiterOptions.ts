import { RedisStore, type ConfigProps, type RedisClient } from "hono-rate-limiter";
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

const authRateLimiterOptions: ConfigProps = {
	handler: () => {
		throw new AppError({
			code: 429,
			message: "Too many auth attempts from this IP, please try again later.",
		});
	},
	// == Fail closed: an unidentifiable client still shares one strict bucket against credential stuffing
	keyGenerator: (ctx) => getClientIp(ctx) ?? "unknown",
	limit: 10,
	standardHeaders: "draft-7",
	store: new RedisStore({ client: redisRateLimitClient, prefix: "rate-limit:auth:" }),
	windowMs: 30 * 60 * 1000,
};

export { authRateLimiterOptions, globalRateLimiterOptions, userRateLimiterOptions };
