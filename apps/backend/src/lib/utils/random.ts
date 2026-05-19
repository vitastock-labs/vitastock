import crypto from "node:crypto";
import { promisify } from "node:util";

export const generateRandomBytesAsync = async (
	options: { encoding?: BufferEncoding; size?: number } = {}
) => {
	const { encoding = "hex", size = 32 } = options;

	const promisifiedRandomBytes = promisify(crypto.randomBytes);

	const buffer = await promisifiedRandomBytes(size);

	const randomString = buffer.toString(encoding);

	return randomString;
};

export const generateRandomBytes = (options: { encoding?: BufferEncoding; size?: number } = {}) => {
	const { encoding = "hex", size = 32 } = options;

	const randomString = crypto.randomBytes(size).toString(encoding);

	return randomString;
};

export const generateRandomUUID = (options: { size?: number } = {}) => {
	const { size } = options;

	const randomUUID = size ? crypto.randomUUID().slice(0, size) : crypto.randomUUID();

	return randomUUID;
};

export const generateRandomInteger = ({ max = 100, min = 0 } = {}) => {
	const randomInteger = crypto.randomInt(min, max);

	return randomInteger;
};

export const generateRandom6DigitCode = () => {
	const randomNum = crypto.randomInt(0, 1000000).toString().padStart(6, "0");

	return randomNum;
};
