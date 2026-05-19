import { hash, verify } from "@node-rs/argon2";

export const hashValue: typeof hash = (value, options) => {
	return hash(value, {
		memoryCost: 19456,
		outputLen: 32,
		parallelism: 1,
		timeCost: 2,
		...options,
	});
};

export const verifyHashedValue: typeof verify = (...args) => verify(...args);
