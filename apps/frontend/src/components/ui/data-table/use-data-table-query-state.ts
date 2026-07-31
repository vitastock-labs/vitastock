import type { PaginationState, Updater } from "@tanstack/react-table";
import { parseAsInteger, useQueryState } from "nuqs";
import { useCallback, useMemo } from "react";
import type { DataTableQueryKeys } from "./data-table-types";

export function useDataTableQueryState(options: {
	initialPageSize?: number;
	queryKeys: Pick<DataTableQueryKeys, "page" | "perPage">;
}) {
	const { initialPageSize = 10, queryKeys } = options;
	const [page, setPage] = useQueryState(queryKeys.page, parseAsInteger.withDefault(1));
	const [pageSize, setPageSize] = useQueryState(
		queryKeys.perPage,
		parseAsInteger.withDefault(initialPageSize)
	);
	const pagination = useMemo<PaginationState>(
		() => ({ pageIndex: page - 1, pageSize }),
		[page, pageSize]
	);
	const onPaginationChange = useCallback(
		(updater: Updater<PaginationState>) => {
			const nextPagination = typeof updater === "function" ? updater(pagination) : updater;

			void setPage(nextPagination.pageIndex + 1);
			void setPageSize(nextPagination.pageSize);
		},
		[pagination, setPage, setPageSize]
	);

	return { onPaginationChange, pagination };
}
