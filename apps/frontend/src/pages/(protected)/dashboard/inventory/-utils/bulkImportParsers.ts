import {
	createInventoryBulkImportRowKey,
	INVENTORY_BULK_IMPORT_COLUMNS,
	INVENTORY_BULK_IMPORT_MAX_ROWS,
	InventoryBulkImportHeadersSchema,
} from "@vitastock/shared/validation/backendApiSchema";
import { format } from "date-fns";
import type { z } from "zod";
import { backendApiSchemaRoutes } from "@/lib/api/callBackendApi/apiSchema";

export const InventoryBulkImportRowSchema =
	backendApiSchemaRoutes["@post/inventory/bulk-import"].body.shape.rows.element;

export type InventoryBulkImportRowType = z.infer<typeof InventoryBulkImportRowSchema>;

export const MAX_BULK_IMPORT_FILE_SIZE_BYTES = 10 * 1024 * 1024;

const cellToString = (cell: unknown): string => {
	if (cell === null || cell === undefined) {
		return "";
	}

	if (cell instanceof Date) {
		return format(cell, "yyyy-MM-dd");
	}

	if (typeof cell === "string" || typeof cell === "number" || typeof cell === "boolean") {
		return String(cell);
	}

	return "";
};

const mapSpreadsheetRowToInventoryFields = (headerRow: string[], row: unknown[]) => {
	const inventoryFields: Record<string, unknown> = {};

	for (const [columnIndex, header] of headerRow.entries()) {
		const inventoryField = INVENTORY_BULK_IMPORT_COLUMNS[header as never] as string | undefined;

		if (!inventoryField) continue;

		inventoryFields[inventoryField] = row[columnIndex];
	}

	return inventoryFields;
};

export type BulkImportFieldError = {
	field: "root" | keyof InventoryBulkImportRowType;
	message: string;
};

export type BulkImportRowResult =
	| {
			data: InventoryBulkImportRowType;
			rowNumber: number;
			status: "valid";
	  }
	| {
			duplicateOfRowNumber: number;
			rawRow: Record<string, unknown>;
			rowNumber: number;
			status: "duplicate";
	  }
	| {
			errors: BulkImportFieldError[];
			rawRow: Record<string, unknown>;
			rowNumber: number;
			status: "invalid";
	  };

export type BulkImportParseResult =
	| {
			duplicateRows: Array<Extract<BulkImportRowResult, { status: "duplicate" }>>;
			invalidRows: Array<Extract<BulkImportRowResult, { status: "invalid" }>>;
			status: "parsed";
			totalRows: number;
			validRows: Array<Extract<BulkImportRowResult, { status: "valid" }>>;
	  }
	| {
			issues: string[];
			status: "header-error";
	  }
	| {
			rowCount: number;
			status: "too-many-rows";
	  };

const isRowEmpty = (row: unknown[]) => {
	return row.every((cell) => cellToString(cell).trim() === "");
};

export const validateBulkImportSheet = (
	sheetRows: unknown[][],
	minimumExpiryDate = format(new Date(), "yyyy-MM-dd")
): BulkImportParseResult => {
	const [headerRow, ...dataRows] = sheetRows;

	if (!headerRow) {
		return {
			issues: ["The spreadsheet must include a header row"],
			status: "header-error",
		};
	}

	const normalizedHeaderRow = headerRow.map((cell) => cellToString(cell).trim());
	const parsedHeaders = InventoryBulkImportHeadersSchema.safeParse(normalizedHeaderRow);

	if (!parsedHeaders.success) {
		return {
			issues: parsedHeaders.error.issues.map((issue) => issue.message),
			status: "header-error",
		};
	}

	const nonEmptyRows = dataRows
		.map((row, index) => ({ row, rowNumber: index + 1 }))
		.filter(({ row }) => !isRowEmpty(row));

	if (nonEmptyRows.length > INVENTORY_BULK_IMPORT_MAX_ROWS) {
		return {
			rowCount: nonEmptyRows.length,
			status: "too-many-rows",
		};
	}

	const validRows: Array<Extract<BulkImportRowResult, { status: "valid" }>> = [];
	const invalidRows: Array<Extract<BulkImportRowResult, { status: "invalid" }>> = [];
	const duplicateRows: Array<Extract<BulkImportRowResult, { status: "duplicate" }>> = [];
	const seenDedupeKeys = new Map<string, number>();
	const rowSchema = InventoryBulkImportRowSchema.extend({
		expiryDate: InventoryBulkImportRowSchema.shape.expiryDate.refine(
			(expiryDate) => expiryDate >= minimumExpiryDate,
			"Expiry date cannot be before today"
		),
	});

	for (const { row, rowNumber } of nonEmptyRows) {
		const rawRow = mapSpreadsheetRowToInventoryFields(normalizedHeaderRow, row);
		const parsedRows = rowSchema.safeParse(rawRow);

		if (!parsedRows.success) {
			invalidRows.push({
				errors: parsedRows.error.issues.map((issue) => ({
					field: (issue.path[0] as keyof InventoryBulkImportRowType | undefined) ?? "root",
					message: issue.message,
				})),
				rawRow,
				rowNumber,
				status: "invalid",
			});

			continue;
		}

		const dedupeKey = createInventoryBulkImportRowKey(parsedRows.data);
		const firstSeenRowNumber = seenDedupeKeys.get(dedupeKey);

		if (firstSeenRowNumber !== undefined) {
			duplicateRows.push({
				duplicateOfRowNumber: firstSeenRowNumber,
				rawRow,
				rowNumber,
				status: "duplicate",
			});

			continue;
		}

		seenDedupeKeys.set(dedupeKey, rowNumber);

		validRows.push({
			data: parsedRows.data,
			rowNumber,
			status: "valid",
		});
	}

	return { duplicateRows, invalidRows, status: "parsed", totalRows: nonEmptyRows.length, validRows };
};

export const parseXlsxFile = async (file: File): Promise<unknown[][]> => {
	const { readSheet } = await import("read-excel-file/browser");
	const buffer = await file.arrayBuffer();

	return readSheet(buffer);
};

export const parseCsvFile = async (file: File): Promise<unknown[][]> => {
	const { parse } = await import("papaparse");

	const text = await file.text();

	const result = parse<string[]>(text, { skipEmptyLines: false });

	if (result.errors.length > 0) {
		throw new Error(result.errors[0]?.message ?? "Failed to parse CSV file");
	}

	return result.data;
};
