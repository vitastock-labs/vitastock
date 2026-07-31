"use client";

import {
	getCoreRowModel,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	useReactTable,
	type ColumnFiltersState,
	type PaginationState,
	type SortingState,
	type TableOptions,
	type TableState,
	type VisibilityState,
} from "@tanstack/react-table";
import { useState } from "react";

type UseDataTableOptions<TData> = Omit<
	TableOptions<TData>,
	"getCoreRowModel" | "getFilteredRowModel" | "getPaginationRowModel" | "getSortedRowModel" | "state"
> & {
	state?: Partial<TableState>;
};

export const useDataTable = <TData>(options: UseDataTableOptions<TData>) => {
	const {
		initialState,
		onColumnFiltersChange,
		onColumnVisibilityChange,
		onPaginationChange,
		onSortingChange,
		state,
		...tableOptions
	} = options;
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(
		initialState?.columnFilters ?? []
	);
	const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(
		initialState?.columnVisibility ?? {}
	);
	const [pagination, setPagination] = useState<PaginationState>({
		pageIndex: initialState?.pagination?.pageIndex ?? 0,
		pageSize: initialState?.pagination?.pageSize ?? 10,
	});
	const [sorting, setSorting] = useState<SortingState>(initialState?.sorting ?? []);

	// eslint-disable-next-line react-hooks/incompatible-library
	return useReactTable({
		...tableOptions,
		getCoreRowModel: getCoreRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		getSortedRowModel: getSortedRowModel(),
		initialState,
		onColumnFiltersChange: onColumnFiltersChange ?? setColumnFilters,
		onColumnVisibilityChange: onColumnVisibilityChange ?? setColumnVisibility,
		onPaginationChange: onPaginationChange ?? setPagination,
		onSortingChange: onSortingChange ?? setSorting,
		state: {
			columnFilters,
			columnVisibility,
			pagination,
			sorting,
			...state,
		},
	});
};
