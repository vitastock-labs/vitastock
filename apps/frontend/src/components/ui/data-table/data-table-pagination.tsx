"use client";

import type { RowData } from "@tanstack/react-table";
import { IconBox } from "@/components/common/IconBox";
import { Select } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { cnMerge } from "@/lib/utils/cn";
import type { DataTableInstance } from "./data-table-types";

const pageSizeOptions = [10, 20, 50] as const;

export function DataTablePagination<TData extends RowData>(
	props: React.ComponentProps<"div"> & {
		table: DataTableInstance<TData>;
		totalRows?: number;
	}
) {
	const { className, table, totalRows, ...restOfProps } = props;
	const pagination = table.state.pagination;
	const rowCount = totalRows ?? table.getFilteredRowModel().rows.length;
	const firstVisibleRow = rowCount === 0 ? 0 : pagination.pageIndex * pagination.pageSize + 1;
	const lastVisibleRow = Math.min((pagination.pageIndex + 1) * pagination.pageSize, rowCount);

	return (
		<div
			className={cnMerge(
				"flex flex-wrap items-center justify-between gap-3 border-t border-shadcn-border/60 px-5 py-3",
				className
			)}
			{...restOfProps}
		>
			<p className="text-[12px] font-medium text-vitastock-body-color">
				Showing {firstVisibleRow}-{lastVisibleRow} of {rowCount}
			</p>

			<div className="flex items-center gap-3">
				<Select.Root
					value={String(pagination.pageSize)}
					onValueChange={(value) => table.setPageSize(Number(value))}
				>
					<Select.Trigger className="h-8 w-20 rounded-lg px-2 text-[12px]">
						<Select.Value />
					</Select.Trigger>
					<Select.Content>
						{pageSizeOptions.map((pageSize) => (
							<Select.Item key={pageSize} value={String(pageSize)}>
								{pageSize}
							</Select.Item>
						))}
					</Select.Content>
				</Select.Root>

				<div className="flex items-center gap-1">
					<Button
						unstyled={true}
						isDisabled={!table.getCanPreviousPage()}
						className="grid size-8 place-items-center rounded-lg text-vitastock-body-color
							hover:bg-shadcn-muted disabled:opacity-40"
						onClick={() => table.previousPage()}
					>
						<IconBox icon="lucide:chevron-left" className="size-4" />
						<span className="sr-only">Previous page</span>
					</Button>

					<span className="min-w-20 text-center text-[12px] font-medium text-vitastock-body-color">
						Page {pagination.pageIndex + 1} of {Math.max(table.getPageCount(), 1)}
					</span>

					<Button
						unstyled={true}
						isDisabled={!table.getCanNextPage()}
						className="grid size-8 place-items-center rounded-lg text-vitastock-body-color
							hover:bg-shadcn-muted disabled:opacity-40"
						onClick={() => table.nextPage()}
					>
						<IconBox icon="lucide:chevron-right" className="size-4" />
						<span className="sr-only">Next page</span>
					</Button>
				</div>
			</div>
		</div>
	);
}
