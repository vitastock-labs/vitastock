/* eslint-disable import/no-named-as-default-member */

/* eslint-disable import/default */
import jwt from "jsonwebtoken";
/* eslint-enable import/default */
import { expect, test } from "vitest";
import { AppError } from "@/lib/utils";
import { transformError } from "./transformError";

test("Error transformation - preserves intentional application errors", () => {
	const error = new AppError({
		code: 409,
		message: "Workspace already exists",
	});

	expect(transformError(error)).toBe(error);
});

test("Error transformation - hides PostgreSQL details from the client-facing message", () => {
	const error = new Error('duplicate key value violates unique constraint "users_email_unique"');
	error.name = "PostgresError";

	const transformedError = transformError(error);

	expect(transformedError).toMatchObject({
		message: "A database error occurred",
		realReason: error.message,
		statusCode: 500,
	});
	expect(transformedError.cause).toBe(error);
});

test("Error transformation - hides unexpected internal error details", () => {
	const error = new Error("Cannot read properties of undefined");

	const transformedError = transformError(error);

	expect(transformedError).toMatchObject({
		message: "Something went wrong",
		realReason: error.message,
		statusCode: 500,
	});
	expect(transformedError.cause).toBe(error);
});

test("Error transformation - returns an unauthorized application error for invalid JWTs", () => {
	const error = new jwt.JsonWebTokenError("invalid signature");

	const transformedError = transformError(error);

	expect(transformedError).toMatchObject({
		message: "Invalid token!",
		statusCode: 401,
	});
	expect(transformedError.cause).toBe(error);
});

test("Error transformation - returns an unauthorized application error for expired JWTs", () => {
	const error = new jwt.TokenExpiredError("jwt expired", new Date());

	const transformedError = transformError(error);

	expect(transformedError).toMatchObject({
		message: "Your token has expired!",
		statusCode: 401,
	});
	expect(transformedError.cause).toBe(error);
});
