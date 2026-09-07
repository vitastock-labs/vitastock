import { tz } from "@date-fns/tz";
import type { backendApiSchemaRoutes } from "@vitastock/shared/validation/backendApiSchema";
import { format } from "date-fns";
/* eslint-disable import/default */
import PapaParse from "papaparse";
/* eslint-enable import/default */
import type { z } from "zod";
import { getInventoryActivityExportRows } from "./data-access/activity";
import { getWorkspaceToday } from "./utils/date";

type InventoryActivityExportQuery = z.infer<
	NonNullable<(typeof backendApiSchemaRoutes)["@get/inventory/activity/export"]["query"]>
>;

const CSV_FIELDS = [
	"Timestamp",
	"Drug Name",
	"Generic Name",
	"Strength",
	"Dosage Form",
	"Unit",
	"Movement",
	"Reason",
	"Quantity",
	"Batches Used",
	"Performed By",
	"Notes",
	"Transaction ID",
] as const;

const formatEnumLabel = (value: string) => {
	return value
		.split("_")
		.map((word) => `${word[0]?.toUpperCase() ?? ""}${word.slice(1)}`)
		.join(" ");
};

const getExportFilename = (query: InventoryActivityExportQuery | undefined, timezone: string) => {
	let dateRange = getWorkspaceToday(timezone);

	if (query?.from && query.to) {
		dateRange = `${query.from}-to-${query.to}`;
	} else if (query?.from) {
		dateRange = `from-${query.from}`;
	} else if (query?.to) {
		dateRange = `through-${query.to}`;
	}

	return `vitastock-stock-movements-${dateRange}.csv`;
};

export const createInventoryActivityCsv = async (options: {
	query: InventoryActivityExportQuery | undefined;
	timezone: string;
	workspaceId: string;
}) => {
	const { query, timezone, workspaceId } = options;
	const rows = await getInventoryActivityExportRows({ query, timezone, workspaceId });

	// eslint-disable-next-line import/no-named-as-default-member
	const csv = PapaParse.unparse(
		{
			data: rows.map((row) => [
				format(row.createdAt, "yyyy-MM-dd HH:mm:ss XXX", { in: tz(timezone) }),
				row.drug.name,
				row.drug.genericName,
				row.drug.strength ?? "",
				row.drug.form ?? "",
				row.drug.unit ?? "",
				formatEnumLabel(row.logType),
				row.reason ? formatEnumLabel(row.reason) : "",
				row.quantity,
				row.batchCount,
				row.person,
				row.notes ?? "",
				row.stockTransactionId,
			]),
			fields: [...CSV_FIELDS],
		},
		{ escapeFormulae: true }
	);

	return {
		content: `\uFEFF${csv}`,
		filename: getExportFilename(query, timezone),
	};
};
