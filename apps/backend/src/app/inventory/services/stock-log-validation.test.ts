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

const dispenseSchema = backendApiSchemaRoutes["@post/inventory/stock-log/dispense"].body;

test.each([
	["  Mrs.   Adebayo  ", "Mrs. Adebayo"],
	["Mr.\tOkon", "Mr. Okon"],
	[" ".repeat(3), null],
	["", null],
	[null, null],
])("Patient name validation - normalises %j to %j", (patientName, expected) => {
	const result = dispenseSchema.parse({
		items: [{ drugId: randomUUID(), patientName, quantity: 2, reason: "patient" }],
	});

	expect(result.items[0]?.patientName).toBe(expected);
});

test("Patient name validation - accepts 120 characters and rejects 121", () => {
	const item = { drugId: randomUUID(), quantity: 2, reason: "patient" };

	expect(dispenseSchema.safeParse({ items: [{ ...item, patientName: "a".repeat(120) }] }).success).toBe(
		true
	);
	expect(
		dispenseSchema.safeParse({ items: [{ ...item, patientName: "a".repeat(121) }] }).error?.issues
	).toEqual([
		expect.objectContaining({
			message: "Patient name must be 120 characters or fewer.",
			path: ["items", 0, "patientName"],
		}),
	]);
});

test("Patient name validation - allows the same drug for different patients in one cart", () => {
	const drugId = randomUUID();
	const result = dispenseSchema.safeParse({
		items: [
			{ drugId, patientName: "Mrs. Adebayo", quantity: 2, reason: "patient" },
			{ drugId, patientName: "Mr. Okon", quantity: 2, reason: "patient" },
			{ drugId, quantity: 2, reason: "patient" },
		],
	});

	expect(result.success).toBe(true);
});

test("Patient name validation - flags the same drug twice for the same patient", () => {
	const drugId = randomUUID();
	const result = dispenseSchema.safeParse({
		items: [
			{ drugId, patientName: "Mrs. Adebayo", quantity: 2, reason: "patient" },
			{ drugId, patientName: " Mrs.  Adebayo ", quantity: 2, reason: "patient" },
		],
	});

	expect(result.error?.issues).toEqual([
		expect.objectContaining({ message: "Duplicate of item 1", path: ["items", 1] }),
	]);
});

test("Patient name validation - removal reasons drop any patient name", () => {
	const result = schema.parse({
		batchId: randomUUID(),
		drugId: randomUUID(),
		logType: "stock_out",
		patientName: "Mrs. Adebayo",
		quantity: 2,
		reason: "damaged",
	});

	expect(result).not.toHaveProperty("patientName");
});
