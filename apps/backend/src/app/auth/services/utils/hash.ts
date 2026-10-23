import crypto from "node:crypto";
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

export const hashToken = (token: string) => {
	return crypto.createHash("sha256").update(token).digest("hex");
};

export const compareHashToken = (token: string, hashedToken: string) => {
	return hashToken(token) === hashedToken;
};
