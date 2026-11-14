import { randomUUID } from "node:crypto";
import { backendApiSchemaRoutes } from "@vitastock/shared/validation/backendApiSchema";
import { expect, test } from "vitest";

const schema = backendApiSchemaRoutes["@post/inventory/stock-log"].body;
const dispenseSchema = backendApiSchemaRoutes["@post/inventory/stock-log/dispense"].body;

test.each(["expired", "damaged"])(
	"Stock-log request - %s removal reports only the missing batch",
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
	"Stock-log request - accepts %s removal with a selected batch",
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

test("Stock-log request - patient dispensing remains automatic FEFO", () => {
	const body = { drugId: randomUUID(), logType: "stock_out", quantity: 23, reason: "patient" };

	expect(schema.safeParse(body).success).toBe(true);
	expect(schema.safeParse({ ...body, batchId: randomUUID() }).success).toBe(false);
});

test("Stock-log request - ward is no longer a dispense reason", () => {
	const stockLogResult = schema.safeParse({
		drugId: randomUUID(),
		logType: "stock_out",
		quantity: 23,
		reason: "ward",
	});
	const dispenseResult = dispenseSchema.safeParse({
		items: [{ drugId: randomUUID(), quantity: 23, reason: "ward" }],
	});

	expect(stockLogResult.success).toBe(false);
	expect(dispenseResult.success).toBe(false);
});

test("Stock-log request - stock-in uses its own branch", () => {
	const result = schema.safeParse({
		drugId: randomUUID(),
		expiryDate: "2030-12-31",
		logType: "stock_in",
		quantity: 23,
	});

	expect(result.success).toBe(true);
});

test.each([
	["  Mrs.   Adebayo  ", "Mrs. Adebayo"],
	["Mr.\tOkon", "Mr. Okon"],
	[" ".repeat(3), null],
	["", null],
	[null, null],
])("Patient name - normalises %j to %j", (patientName, expected) => {
	const result = dispenseSchema.parse({
		items: [{ drugId: randomUUID(), patientName, quantity: 2, reason: "patient" }],
	});

	expect(result.items[0]?.patientName).toBe(expected);
});

test("Patient name - accepts 120 characters and rejects 121", () => {
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

test("Patient name - allows the same drug for different patients in one cart", () => {
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

test("Patient name - flags the same drug twice for the same patient", () => {
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

test("Patient name - removal reasons drop any patient name", () => {
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

const drugUpdateSchema = backendApiSchemaRoutes["@patch/inventory/drugs/:drugId"].body;

test.each([
	["1500", 1500],
	["99.99", 99.99],
	["", null],
	[null, null],
])("Drug prices - parses %j as %j", (retailPrice, expected) => {
	expect(drugUpdateSchema.parse({ retailPrice }).retailPrice).toBe(expected);
});

test.each(["0", "-5", "12.345", "1,500"])("Drug prices - rejects %s", (retailPrice) => {
	expect(drugUpdateSchema.safeParse({ retailPrice }).success).toBe(false);
});

test("Stock-in request - cost price is optional", () => {
	const body = { drugId: randomUUID(), expiryDate: "2030-12-31", logType: "stock_in", quantity: 5 };

	expect(schema.parse(body)).not.toHaveProperty("costPrice");
	expect(schema.parse({ ...body, costPrice: "" })).toMatchObject({ costPrice: undefined });
	expect(schema.parse({ ...body, costPrice: "1250.50" })).toMatchObject({ costPrice: 1250.5 });
});

test("Dispense request - a cart is a retail sale unless wholesale is chosen", () => {
	const items = [{ drugId: randomUUID(), quantity: 2, reason: "patient" }];

	expect(dispenseSchema.parse({ items })).toMatchObject({ saleType: "retail" });
	expect(dispenseSchema.parse({ items, paymentMethod: "pos", saleType: "wholesale" })).toMatchObject({
		paymentMethod: "pos",
		saleType: "wholesale",
	});
	expect(dispenseSchema.safeParse({ items, paymentMethod: "card" }).success).toBe(false);
});
