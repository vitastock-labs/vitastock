/* eslint-disable ts-eslint/consistent-type-definitions */
/* eslint-disable ts-eslint/no-unused-vars */

import type { RowData } from "@tanstack/react-table";

declare module "@tanstack/react-table" {
	interface TableMeta<TData extends RowData> {
		queryKeys?: DataTableQueryKeys;
	}

	interface ColumnMeta<TData extends RowData, TValue> {
		label?: string;
		options?: readonly DataTableFilterOption[];
		placeholder?: string;
		variant?: DataTableFilterVariant;
	}
}

export type DataTableFilterOption = {
	label: string;
	value: string;
};

export type DataTableFilterVariant = "select" | "text";

export type DataTableQueryKeys = {
	page: string;
	perPage: string;
	search?: string;
	select?: string;
};
