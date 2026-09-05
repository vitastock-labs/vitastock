import type { ColumnFiltersState, PaginationState, Updater } from "@tanstack/react-table";
import { parseAsInteger, useQueryStates, type ParserMap, type UrlKeys, type Values } from "nuqs";
import { useCallback, useMemo } from "react";
import type { DataTableQueryKeys } from "./data-table-types";

const useDataTableQueryState = <TFilters extends ParserMap>(options: {
	filterParsers?: TFilters;
	filterUrlKeys?: UrlKeys<TFilters>;
	initialPageSize?: number;
	queryKeys: Pick<DataTableQueryKeys, "page" | "perPage">;
}) => {
	const { filterParsers, filterUrlKeys, initialPageSize = 10, queryKeys } = options;

	const [{ page, pageSize }, setPagination] = useQueryStates(
		{
			page: parseAsInteger.withDefault(1),
			pageSize: parseAsInteger.withDefault(initialPageSize),
		},
		{
			urlKeys: {
				page: queryKeys.page,
				pageSize: queryKeys.perPage,
			},
		}
	);

	const pagination = useMemo<PaginationState>(
		() => ({ pageIndex: page - 1, pageSize }),
		[page, pageSize]
	);

	const onPaginationChange = useCallback(
		(updater: Updater<PaginationState>) => {
			const nextPagination = typeof updater === "function" ? updater(pagination) : updater;

			void setPagination({
				page: nextPagination.pageIndex + 1,
				pageSize: nextPagination.pageSize,
			});
		},
		[pagination, setPagination]
	);

	const [filterValues, setFilterValues] = useQueryStates(filterParsers ?? ({} as TFilters), {
		urlKeys: filterUrlKeys,
	});

	const columnFilters = useMemo<ColumnFiltersState>(
		() =>
			(Object.entries(filterValues) as Array<[string, unknown]>).flatMap(([id, value]) =>
				value === null || value === "" ? [] : [{ id, value }]
			),
		[filterValues]
	);

	const onColumnFiltersChange = useCallback(
		(updater: Updater<ColumnFiltersState>) => {
			const nextFilters = typeof updater === "function" ? updater(columnFilters) : updater;
			const nextFilterValues = Object.fromEntries(
				Object.keys(filterValues).map((id) => [
					id,
					nextFilters.find((filter) => filter.id === id)?.value ?? null,
				])
			) as Partial<Values<TFilters>>;

			void setFilterValues(nextFilterValues);
			void setPagination({ page: 1 });
		},
		[columnFilters, filterValues, setFilterValues, setPagination]
	);

	const resetFilters = useCallback(() => {
		void setFilterValues(null);
		void setPagination({ page: 1 });
	}, [setFilterValues, setPagination]);

	return {
		columnFilters,
		filterValues,
		onColumnFiltersChange,
		onPaginationChange,
		pagination,
		resetFilters,
		setFilterValues,
	};
};

export { useDataTableQueryState };
