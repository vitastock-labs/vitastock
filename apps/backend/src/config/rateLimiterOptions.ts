import { RedisStore, type ConfigProps, type RedisClient } from "hono-rate-limiter";
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

const globalRateLimiterOptions: ConfigProps = {
	handler: () => {
		throw new AppError({
			code: 429,
			message: "Too many requests from this IP, please try again later.",
		});
	},
	keyGenerator: (ctx) => getClientIp(ctx),
	limit: 100,
	standardHeaders: "draft-7",
	store: new RedisStore({ client: redisRateLimitClient, prefix: "rate-limit:global:" }),
	windowMs: 15 * 60 * 1000,
};

const authRateLimiterOptions: ConfigProps = {
	handler: () => {
		throw new AppError({
			code: 429,
			message: "Too many auth attempts from this IP, please try again later.",
		});
	},
	keyGenerator: (ctx) => getClientIp(ctx),
	limit: 10,
	standardHeaders: "draft-7",
	store: new RedisStore({ client: redisRateLimitClient, prefix: "rate-limit:auth:" }),
	windowMs: 30 * 60 * 1000,
};

export { authRateLimiterOptions, globalRateLimiterOptions };
