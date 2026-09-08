"use client";

import { Pagination } from "@ark-ui/react/pagination";
import type { RowData } from "@tanstack/react-table";
import { IconBox } from "@/components/common/IconBox";
import { Select } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { cnMerge } from "@/lib/utils/cn";
import type { DataTableInstance } from "./data-table-types";

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 12, 20, 25, 50] as const;

export type DataTablePaginationVariant = "default" | "numbered";

export function DataTablePagination<TData extends RowData>(
	props: React.ComponentProps<"div"> & {
		classNames?: {
			base?: string;
			countLabel?: string;
			ellipsis?: string;
			item?: string;
			nextTrigger?: string;
			previousTrigger?: string;
			root?: string;
		};
		countLabelVariant?: "count" | "range";
		pageSizeOptions?: readonly number[];
		paginationVariant?: DataTablePaginationVariant;
		table: DataTableInstance<TData>;
		totalRows?: number;
	}
) {
	const {
		className,
		classNames,
		countLabelVariant = "range",
		pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
		paginationVariant = "default",
		table,
		totalRows,
		...restOfProps
	} = props;
	const pagination = table.state.pagination;
	const resolvedPageSizeOptions = [...new Set([...pageSizeOptions, pagination.pageSize])].sort(
		(firstPageSize, secondPageSize) => firstPageSize - secondPageSize
	);
	const rowCount = totalRows ?? table.getFilteredRowModel().rows.length;
	const firstVisibleRow = rowCount === 0 ? 0 : pagination.pageIndex * pagination.pageSize + 1;
	const lastVisibleRow = Math.min((pagination.pageIndex + 1) * pagination.pageSize, rowCount);
	const currentPageRowCount = table.getRowModel().rows.length;
	const countLabel = (
		<p
			className={cnMerge(
				"text-[12px] font-medium text-shadcn-muted-foreground",
				classNames?.countLabel
			)}
		>
			{countLabelVariant === "count" ?
				<>
					Showing {currentPageRowCount} out of {rowCount.toLocaleString()} result
					{rowCount === 1 ? "" : "s"}
				</>
			:	<>
					Showing {firstVisibleRow}-{lastVisibleRow} of {rowCount.toLocaleString()}
				</>
			}
		</p>
	);

	if (paginationVariant === "numbered") {
		return (
			<div
				className={cnMerge(
					`flex flex-col gap-4 border-t border-shadcn-border/60 px-5 py-3 sm:grid
					sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center`,
					className
				)}
				{...restOfProps}
			>
				<div className="flex flex-wrap items-center justify-between gap-3">
					{countLabel}
					<PageSizeSelect options={resolvedPageSizeOptions} table={table} />
				</div>

				<Pagination.Root
					count={rowCount}
					page={pagination.pageIndex + 1}
					pageSize={pagination.pageSize}
					boundaryCount={1}
					siblingCount={0}
					onPageChange={(details) => table.setPageIndex(details.page - 1)}
					className={cnMerge("max-w-full self-center sm:self-auto", classNames?.root)}
				>
					<div className={cnMerge("flex items-center gap-2 sm:gap-3", classNames?.base)}>
						<Pagination.PrevTrigger
							className={cnMerge(
								`inline-flex size-8 items-center justify-center gap-2 text-[13px] font-semibold
								text-shadcn-foreground sm:w-auto sm:px-1 data-disabled:pointer-events-none
								data-disabled:opacity-35`,
								classNames?.previousTrigger
							)}
						>
							<IconBox icon="lucide:arrow-left" className="size-4" />
							<span className="hidden sm:inline">Previous</span>
						</Pagination.PrevTrigger>

						<Pagination.Context>
							{(paginationContext) =>
								paginationContext.pages.map((page, index) =>
									page.type === "page" ?
										<Pagination.Item
											key={page.value}
											{...page}
											className={cnMerge(
												`grid size-8 place-items-center rounded-[8px] text-[13px] font-medium
													text-shadcn-muted-foreground transition-colors
													hover:text-shadcn-foreground data-selected:bg-shadcn-primary
													data-selected:text-shadcn-primary-foreground`,
												page.value !== pagination.pageIndex + 1 && "max-sm:hidden",
												classNames?.item
											)}
										>
											{page.value}
										</Pagination.Item>
									:	<Pagination.Ellipsis
											key={`ellipsis-${paginationContext.pages.indexOf(page)}`}
											index={index}
											className={cnMerge(
												`grid size-8 place-items-center text-[13px] font-semibold
													text-shadcn-muted-foreground max-sm:hidden`,
												classNames?.ellipsis
											)}
										>
											...
										</Pagination.Ellipsis>
								)
							}
						</Pagination.Context>

						<Pagination.NextTrigger
							className={cnMerge(
								`inline-flex size-8 items-center justify-center gap-2 text-[13px] font-semibold
								text-shadcn-foreground sm:w-auto sm:px-1 data-disabled:pointer-events-none
								data-disabled:opacity-35`,
								classNames?.nextTrigger
							)}
						>
							<span className="hidden sm:inline">Next</span>
							<IconBox icon="lucide:arrow-right" className="size-4" />
						</Pagination.NextTrigger>
					</div>
				</Pagination.Root>
			</div>
		);
	}

	return (
		<div
			className={cnMerge(
				"flex flex-wrap items-center justify-between gap-3 border-t border-shadcn-border/60 px-5 py-3",
				className
			)}
			{...restOfProps}
		>
			{countLabel}

			<div className="flex items-center gap-3">
				<PageSizeSelect options={resolvedPageSizeOptions} table={table} />

				<div className="flex items-center gap-1">
					<Button
						unstyled={true}
						isDisabled={!table.getCanPreviousPage()}
						className="grid size-8 place-items-center rounded-lg text-shadcn-muted-foreground
							hover:bg-shadcn-muted disabled:opacity-40"
						onClick={() => table.previousPage()}
					>
						<IconBox icon="lucide:chevron-left" className="size-4" />
						<span className="sr-only">Previous page</span>
					</Button>

					<span className="min-w-20 text-center text-[12px] font-medium text-shadcn-muted-foreground">
						Page {pagination.pageIndex + 1} of {Math.max(table.getPageCount(), 1)}
					</span>

					<Button
						unstyled={true}
						isDisabled={!table.getCanNextPage()}
						className="grid size-8 place-items-center rounded-lg text-shadcn-muted-foreground
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

function PageSizeSelect<TData extends RowData>(props: {
	options: readonly number[];
	table: DataTableInstance<TData>;
}) {
	const { options, table } = props;

	return (
		<label className="flex items-center gap-2 text-[12px] font-medium text-shadcn-muted-foreground">
			Rows per page
			<Select.Root
				value={String(table.state.pagination.pageSize)}
				onValueChange={(value) => table.setPageSize(Number(value))}
			>
				<Select.Trigger className="h-8 w-18 rounded-lg px-2 text-[12px]">
					<Select.Value />
				</Select.Trigger>
				<Select.Content>
					{options.map((pageSize) => (
						<Select.Item key={pageSize} value={String(pageSize)}>
							{pageSize}
						</Select.Item>
					))}
				</Select.Content>
			</Select.Root>
		</label>
	);
}
