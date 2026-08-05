"use client";

import { createTableHook } from "@tanstack/react-table";
import { dataTableFeatures } from "./data-table-types";

const { createAppColumnHelper, useAppTable } = createTableHook({
	features: dataTableFeatures,
});

export { createAppColumnHelper as createDataTableColumnHelper, useAppTable as useDataTable };
