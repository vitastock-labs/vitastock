import { backendApiSchemaRoutes } from "@vitastock/shared/validation/backendApiSchema";
import { expect, test } from "vitest";

test("Request email normalisation - invitation send trims and lowercases inviteeEmail", () => {
	const result = backendApiSchemaRoutes["@post/workspace/invitation/send"].body.parse({
		defaultPassword: "password123",
		inviteeEmail: "  Jane.Doe@Pharmacy.COM ",
		inviteeName: "Jane",
		role: "pharmacist",
	});

	expect(result.inviteeEmail).toBe("jane.doe@pharmacy.com");
});
