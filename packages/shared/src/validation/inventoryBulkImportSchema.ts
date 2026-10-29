import { defineEnum } from "@zayne-labs/toolkit-type-helpers";
import { z } from "zod";

export const INVENTORY_BULK_IMPORT_MAX_ROWS = 2000;

export const INVENTORY_BULK_IMPORT_COLUMNS = defineEnum({
	"Cost Price ₦ (per unit)": "costPrice",
	"Dosage Form": "form",
	"Drug Name": "name",
	"Expiry Date": "expiryDate",
	"Generic Name": "genericName",
	"Low Stock Threshold": "lowStockThreshold",
	Quantity: "quantity",
	"Retail Price ₦ (per unit)": "retailPrice",
	Strength: "strength",
	Unit: "unit",
	// == Older templates called the cost column this; keep importing those files
	"Unit Cost ₦": "costPrice",
	"Wholesale Price ₦ (per unit)": "wholesalePrice",
});

export const INVENTORY_BULK_IMPORT_REQUIRED_HEADERS = defineEnum([
	"Drug Name",
	"Expiry Date",
	"Generic Name",
	"Quantity",
]);

export const InventoryBulkImportHeadersSchema = z.array(z.string()).superRefine((headers, ctx) => {
	const seenHeaders = new Set<string>();
	const duplicateHeaders = new Set<string>();

	for (const header of headers) {
		if (!header) continue;

		seenHeaders.has(header) && duplicateHeaders.add(header);

		seenHeaders.add(header);
	}

	const costHeaders = headers.filter(
		(header) =>
			INVENTORY_BULK_IMPORT_COLUMNS[header as never] === INVENTORY_BULK_IMPORT_COLUMNS["Unit Cost ₦"]
	);

	if (costHeaders.length > 1) {
		duplicateHeaders.add(costHeaders.join(" and "));
	}

	if (duplicateHeaders.size > 0) {
		ctx.addIssue({
			code: "custom",
			message: `Duplicate columns: ${[...duplicateHeaders].join(", ")}`,
		});
	}

	const unknownHeaders = headers.filter(
		(header) => header.length > 0 && !Object.hasOwn(INVENTORY_BULK_IMPORT_COLUMNS, header)
	);

	if (unknownHeaders.length > 0) {
		ctx.addIssue({
			code: "custom",
			message: `Unknown columns: ${unknownHeaders.join(", ")}`,
		});
	}

	const missingHeaders = INVENTORY_BULK_IMPORT_REQUIRED_HEADERS.filter(
		(header) => !seenHeaders.has(header)
	);

	if (missingHeaders.length > 0) {
		ctx.addIssue({
			code: "custom",
			message: `Missing required columns: ${missingHeaders.join(", ")}`,
		});
	}
});

export const cleanNairaAmount = (value: unknown) => {
	if (typeof value !== "string") {
		return value;
	}

	return value.replaceAll(/ngn|[\s,₦]/giu, "");
};

export const createInventoryBulkImportRowKey = (row: {
	costPrice?: number;
	expiryDate: string;
	form?: string;
	genericName: string;
	lowStockThreshold?: number;
	name: string;
	quantity: number;
	strength?: string;
	unit?: string;
}) => {
	const drugIdentity = [row.name, row.genericName, row.strength, row.form, row.unit]
		.map((value) => value?.trim().toLowerCase() ?? "")
		.join("|");

	return `${drugIdentity}|${row.expiryDate}|${row.quantity}|${row.costPrice ?? ""}`;
};
