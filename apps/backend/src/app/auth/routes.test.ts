import { backendApiSchemaRoutes } from "@vitastock/shared/validation/backendApiSchema";
import { expect, test } from "vitest";

const MIXED_CASE_EMAIL = "  Jane.Doe@Pharmacy.COM ";
const NORMALISED_EMAIL = "jane.doe@pharmacy.com";

test.each([
	["@post/auth/signup", { fullName: "Jane", password: "password123", pharmacyName: "Jane's" }],
	["@post/auth/signin", { password: "password123" }],
	["@post/auth/verify-email", { code: "123456" }],
	["@post/auth/resend-verification-email", {}],
	["@post/auth/forgot-password", {}],
] as const)("Request email normalisation - %s trims and lowercases the email", (route, rest) => {
	const result = backendApiSchemaRoutes[route].body.parse({ ...rest, email: MIXED_CASE_EMAIL });

	expect(result.email).toBe(NORMALISED_EMAIL);
});

test("Request email normalisation - invalid emails are still rejected after normalisation", () => {
	const result = backendApiSchemaRoutes["@post/auth/signin"].body.safeParse({
		email: "  not-an-email ",
		password: "password123",
	});

	expect(result.success).toBe(false);
});
