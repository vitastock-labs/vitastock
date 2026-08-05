import {
	columnFilteringFeature,
	columnVisibilityFeature,
	createFilteredRowModel,
	createPaginatedRowModel,
	createSortedRowModel,
	filterFn_equalsString,
	metaHelper,
	rowPaginationFeature,
	rowSelectionFeature,
	rowSortingFeature,
	sortFn_alphanumeric,
	sortFn_text,
	tableFeatures,
	type Column,
	type ReactTable,
	type Row,
	type RowData,
} from "@tanstack/react-table";

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

type DataTableColumnMeta = {
	label?: string;
	options?: readonly DataTableFilterOption[];
	placeholder?: string;
	variant?: DataTableFilterVariant;
};

type DataTableMeta = {
	queryKeys?: DataTableQueryKeys;
};

export const dataTableFeatures = tableFeatures({
	columnFilteringFeature,
	columnMeta: metaHelper<DataTableColumnMeta>(),
	columnVisibilityFeature,
	filteredRowModel: createFilteredRowModel(),
	filterFns: {
		equalsString: filterFn_equalsString,
	},
	paginatedRowModel: createPaginatedRowModel(),
	rowPaginationFeature,
	rowSelectionFeature,
	rowSortingFeature,
	sortedRowModel: createSortedRowModel(),
	sortFns: {
		alphanumeric: sortFn_alphanumeric,
		text: sortFn_text,
	},
	tableMeta: metaHelper<DataTableMeta>(),
});

export type DataTableColumn<TData extends RowData, TValue = unknown> = Column<
	typeof dataTableFeatures,
	TData,
	TValue
>;

export type DataTableInstance<TData extends RowData> = ReactTable<typeof dataTableFeatures, TData>;

export type DataTableRow<TData extends RowData> = Row<typeof dataTableFeatures, TData>;
