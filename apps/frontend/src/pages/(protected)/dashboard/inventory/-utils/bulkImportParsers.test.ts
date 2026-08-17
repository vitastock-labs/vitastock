import { readFile } from "node:fs/promises";
import path from "node:path";
import { INVENTORY_BULK_IMPORT_MAX_ROWS } from "@vitastock/shared/validation/backendApiSchema";
import { addDays, format, subDays } from "date-fns";
import { expect, test } from "vitest";
import { parseCsvFile, parseXlsxFile, validateBulkImportSheet } from "./bulkImportParsers";

const HEADER_ROW = [
	"Drug Name",
	"Generic Name",
	"Strength",
	"Dosage Form",
	"Unit",
	"Quantity",
	"Unit Cost (₦)",
	"Expiry Date",
];

const futureDate = format(addDays(new Date(), 180), "yyyy-MM-dd");
const pastDate = format(subDays(new Date(), 10), "yyyy-MM-dd");

const validRow = (overrides: Partial<Record<string, unknown>> = {}) => {
	const base: Record<string, unknown> = {
		"Dosage Form": "Tablet",
		"Drug Name": "Paracetamol",
		"Expiry Date": futureDate,
		"Generic Name": "Paracetamol",
		Quantity: "100",
		Strength: "500mg",
		Unit: "Tablets",
		"Unit Cost (₦)": "12.50",
	};

	return HEADER_ROW.map((column) => overrides[column] ?? base[column]);
};

test("accepts columns regardless of order", () => {
	const reorderedHeader = HEADER_ROW.toReversed();
	const reorderedRow = validRow().toReversed();

	const result = validateBulkImportSheet([reorderedHeader, reorderedRow]);

	expect(result.status).toBe("parsed");
	if (result.status !== "parsed") return;
	expect(result.validRows).toHaveLength(1);
});

test("rejects a missing required column", () => {
	const headerWithoutQuantity = HEADER_ROW.filter((column) => column !== "Quantity");

	const result = validateBulkImportSheet([headerWithoutQuantity, validRow()]);

	expect(result.status).toBe("header-error");
	if (result.status !== "header-error") return;
	expect(result.issues).toContain("Missing required columns: Quantity");
});

test("rejects an unknown column", () => {
	const headerWithUnknown = [...HEADER_ROW, "Supplier ID"];

	const result = validateBulkImportSheet([headerWithUnknown, [...validRow(), "SUP-1"]]);

	expect(result.status).toBe("header-error");
	if (result.status !== "header-error") return;
	expect(result.issues).toContain("Unknown columns: Supplier ID");
});

test("rejects a duplicated column", () => {
	const headerWithDuplicate = [...HEADER_ROW, "Drug Name"];

	const result = validateBulkImportSheet([headerWithDuplicate, [...validRow(), "Paracetamol"]]);

	expect(result.status).toBe("header-error");
	if (result.status !== "header-error") return;
	expect(result.issues).toContain("Duplicate columns: Drug Name");
});

test("rejects an empty unit cost", () => {
	const result = validateBulkImportSheet([HEADER_ROW, validRow({ "Unit Cost (₦)": "" })]);

	expect(result.status).toBe("parsed");
	if (result.status !== "parsed") return;
	expect(result.invalidRows).toHaveLength(1);
	expect(result.validRows).toHaveLength(0);
});

test("ignores completely empty rows", () => {
	const emptyRow = HEADER_ROW.map(() => "");

	const result = validateBulkImportSheet([HEADER_ROW, validRow(), emptyRow]);

	expect(result.status).toBe("parsed");
	if (result.status !== "parsed") return;
	expect(result.totalRows).toBe(1);
	expect(result.validRows).toHaveLength(1);
});

test("rejects an invalid (non-date) expiry date", () => {
	const result = validateBulkImportSheet([HEADER_ROW, validRow({ "Expiry Date": "not-a-date" })]);

	expect(result.status).toBe("parsed");
	if (result.status !== "parsed") return;
	expect(result.invalidRows).toHaveLength(1);
	expect(result.validRows).toHaveLength(0);
});

test("rejects an expired expiry date", () => {
	const result = validateBulkImportSheet([HEADER_ROW, validRow({ "Expiry Date": pastDate })]);

	expect(result.status).toBe("parsed");
	if (result.status !== "parsed") return;
	expect(result.invalidRows).toHaveLength(1);
});

test("rejects a non-positive quantity", () => {
	const result = validateBulkImportSheet([HEADER_ROW, validRow({ Quantity: "0" })]);

	expect(result.status).toBe("parsed");
	if (result.status !== "parsed") return;
	expect(result.invalidRows).toHaveLength(1);
});

test("rejects a non-integer quantity", () => {
	const result = validateBulkImportSheet([HEADER_ROW, validRow({ Quantity: "10.5" })]);

	expect(result.status).toBe("parsed");
	if (result.status !== "parsed") return;
	expect(result.invalidRows).toHaveLength(1);
});

test("rejects a negative unit cost", () => {
	const result = validateBulkImportSheet([HEADER_ROW, validRow({ "Unit Cost (₦)": "-5" })]);

	expect(result.status).toBe("parsed");
	if (result.status !== "parsed") return;
	expect(result.invalidRows).toHaveLength(1);
});

test("rejects a unit cost with more than two decimal places", () => {
	const result = validateBulkImportSheet([HEADER_ROW, validRow({ "Unit Cost (₦)": "12.345" })]);

	expect(result.status).toBe("parsed");
	if (result.status !== "parsed") return;
	expect(result.invalidRows).toHaveLength(1);
});

test("flags a later exact duplicate row", () => {
	const result = validateBulkImportSheet([HEADER_ROW, validRow(), validRow()]);

	expect(result.status).toBe("parsed");
	if (result.status !== "parsed") return;
	expect(result.validRows).toHaveLength(1);
	expect(result.duplicateRows).toHaveLength(1);
	expect(result.duplicateRows[0]?.duplicateOfRowNumber).toBe(1);
});

test("allows the same drug with a different expiry date as a separate batch", () => {
	const result = validateBulkImportSheet([
		HEADER_ROW,
		validRow(),
		validRow({ "Expiry Date": format(addDays(new Date(), 365), "yyyy-MM-dd") }),
	]);

	expect(result.status).toBe("parsed");
	if (result.status !== "parsed") return;
	expect(result.validRows).toHaveLength(2);
	expect(result.duplicateRows).toHaveLength(0);
});

test("allows the same drug with a different quantity as a separate batch", () => {
	const result = validateBulkImportSheet([HEADER_ROW, validRow(), validRow({ Quantity: "50" })]);

	expect(result.status).toBe("parsed");
	if (result.status !== "parsed") return;
	expect(result.validRows).toHaveLength(2);
	expect(result.duplicateRows).toHaveLength(0);
});

test("accepts exactly the maximum allowed row count", () => {
	const rows = Array.from({ length: INVENTORY_BULK_IMPORT_MAX_ROWS }, (_unused, index) =>
		validRow({ Quantity: String(index + 1) })
	);

	const result = validateBulkImportSheet([HEADER_ROW, ...rows]);

	expect(result.status).toBe("parsed");
	if (result.status !== "parsed") return;
	expect(result.totalRows).toBe(INVENTORY_BULK_IMPORT_MAX_ROWS);
});

test("rejects one row over the maximum allowed row count", () => {
	const rows = Array.from({ length: INVENTORY_BULK_IMPORT_MAX_ROWS + 1 }, (_unused, index) =>
		validRow({ Quantity: String(index + 1) })
	);

	const result = validateBulkImportSheet([HEADER_ROW, ...rows]);

	expect(result.status).toBe("too-many-rows");
	if (result.status !== "too-many-rows") return;
	expect(result.rowCount).toBe(INVENTORY_BULK_IMPORT_MAX_ROWS + 1);
});

test("parses a csv file into a valid, ready-to-import row", async () => {
	const csvText = [
		HEADER_ROW.join(","),
		["Paracetamol", "Paracetamol", "500mg", "Tablet", "Tablets", "100", "12.50", futureDate].join(","),
	].join("\n");

	const file = new File([csvText], "import.csv", { type: "text/csv" });
	const rows = await parseCsvFile(file);
	const result = validateBulkImportSheet(rows);

	expect(result.status).toBe("parsed");
	if (result.status !== "parsed") return;
	expect(result.validRows).toHaveLength(1);
	expect(result.validRows[0]?.data.name).toBe("Paracetamol");
});

test("Bulk import template - parses the shipped xlsx Data sheet with the expected headers", async () => {
	const template = await readFile(
		path.resolve(process.cwd(), "public/templates/bulk-import-template.xlsx")
	);
	const file = new File([new Uint8Array(template)], "bulk-import-template.xlsx");
	const rows = await parseXlsxFile(file);

	expect(rows[0]).toEqual(HEADER_ROW);

	const result = validateBulkImportSheet(rows);

	expect(result).toEqual({
		duplicateRows: [],
		invalidRows: [],
		status: "parsed",
		totalRows: 0,
		validRows: [],
	});
});
