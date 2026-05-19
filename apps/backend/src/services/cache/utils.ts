import { isObject, type Awaitable, type UnmaskType } from "@zayne-labs/toolkit-type-helpers";
import { consola } from "consola";
import { differenceInSeconds } from "date-fns";
import { initializeRedisCacheClient, redisCacheClient } from "./cacheClient";

type CacheKeyType = UnmaskType<
	| `doctor-vectors:${string}`
	| `health-tip:${string}`
	| `refresh-token:${string}:${string}`
	| `user:${string}`
>;

export const setCache = async (
	key: CacheKeyType,
	value: number | object | string | Buffer,
	options?: {
		/**
		 * Expiry in seconds or date
		 */
		expiry?: number | Date;
	}
) => {
	const { expiry } = options ?? {};

	if (!value) {
		throw new Error("Invalid value provided");
	}

	const resolvedValue = isObject(value) && !(value instanceof Buffer) ? JSON.stringify(value) : value;

	const ttl = expiry instanceof Date ? differenceInSeconds(expiry, new Date()) : expiry;

	if (!redisCacheClient.isOpen) {
		await initializeRedisCacheClient();
	}

	await redisCacheClient.set(key, resolvedValue, {
		...(ttl && { expiration: { type: "EX", value: ttl } }),
	});

	consola.info(`[CACHE SET] for key ${key}`);
};

export const getFromCache = async <TCacheResult>(
	key: CacheKeyType,
	options?: {
		onCacheMiss?: (key: CacheKeyType) => Awaitable<TCacheResult>;
		/**
		 * Expiry in seconds or date for cacheMiss setCache
		 */
		onCacheMissExpiry?: number | Date;
	}
): Promise<TCacheResult> => {
	const { onCacheMiss, onCacheMissExpiry } = options ?? {};

	if (!redisCacheClient.isOpen) {
		await initializeRedisCacheClient();
	}

	try {
		const rawCachedData = await redisCacheClient.get(key);

		if (rawCachedData) {
			const parsedCachedData = JSON.parse(rawCachedData);

			consola.info(`[CACHE HIT] for key ${key}`);

			return parsedCachedData as TCacheResult;
		}

		consola.info(`[CACHE MISS] for key ${key}`);

		const freshData = await onCacheMiss?.(key);

		if (!freshData) {
			return null as never;
		}

		await setCache(key, freshData, { expiry: onCacheMissExpiry });

		return freshData;
	} catch (error) {
		consola.error(
			`[CACHE ERROR] for key ${key}. Client Status: isOpen=${redisCacheClient.isOpen}, isReady=${redisCacheClient.isReady}`,
			error
		);
		throw error;
	}
};

export const removeFromCache = async (key: CacheKeyType) => {
	if (!redisCacheClient.isOpen) {
		await initializeRedisCacheClient();
	}

	const isDeleted = Boolean(await redisCacheClient.del(key));

	if (!isDeleted) {
		consola.info(`[CACHE FAILED TO REMOVE] for key ${key}`);
		return;
	}

	consola.info(`[CACHE REMOVED] for key ${key}`);
};
