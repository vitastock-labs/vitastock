import { randomUUID } from "node:crypto";
import { backendApiSchemaRoutes } from "@vitastock/shared/validation/backendApiSchema";
import { expect, test } from "vitest";

const schema = backendApiSchemaRoutes["@post/inventory/stock-log"].body;

test.each(["expired", "damaged"])(
	"Stock validation - %s removal reports only the missing batch",
	(reason) => {
		const result = schema.safeParse({
			drugId: randomUUID(),
			logType: "stock_out",
			quantity: 23,
			reason,
		});

		expect(result.success).toBe(false);
		expect(result.error?.issues).toEqual([
			expect.objectContaining({ message: "Select a batch to remove stock from.", path: ["batchId"] }),
		]);
	}
);

test.each(["expired", "damaged"])(
	"Stock validation - accepts %s removal with a selected batch",
	(reason) => {
		const result = schema.safeParse({
			batchId: randomUUID(),
			drugId: randomUUID(),
			logType: "stock_out",
			quantity: 23,
			reason,
		});

		expect(result.success).toBe(true);
	}
);

test.each(["patient", "ward"])("Stock validation - %s dispensing remains automatic FEFO", (reason) => {
	const body = { drugId: randomUUID(), logType: "stock_out", quantity: 23, reason };

	expect(schema.safeParse(body).success).toBe(true);
	expect(schema.safeParse({ ...body, batchId: randomUUID() }).success).toBe(false);
});

test("Stock validation - stock-in uses its own branch", () => {
	const result = schema.safeParse({
		drugId: randomUUID(),
		expiryDate: "2030-12-31",
		logType: "stock_in",
		quantity: 23,
	});

	expect(result.success).toBe(true);
});
