"use client";

import type { RowData } from "@tanstack/react-table";
import { isFunction } from "@zayne-labs/toolkit-type-helpers";
import { DataTable } from "@/components/ui/data-table";
import { cnMerge } from "@/lib/utils/cn";

type DashboardDataTableProps<TData extends RowData> = Omit<
	React.ComponentProps<typeof DataTable<TData>>,
	"paginationVariant"
>;

function DashboardDataTable<TData extends RowData>(props: DashboardDataTableProps<TData>) {
	const { classNames, ...restOfProps } = props;

	return (
		<DataTable
			{...restOfProps}
			paginationVariant="numbered"
			classNames={{
				...classNames,
				pagination: cnMerge("border-t border-shadcn-border/70 px-5 py-4", classNames?.pagination),
				paginationBase: cnMerge("gap-3 sm:gap-4", classNames?.paginationBase),
				paginationCountLabel: cnMerge(
					"text-[12px] font-medium text-vitastock-body-color/70",
					classNames?.paginationCountLabel
				),
				paginationEllipsis: cnMerge("text-vitastock-body-color/60", classNames?.paginationEllipsis),
				paginationItem: cnMerge(
					`size-8 rounded-lg text-vitastock-body-color/70 hover:text-vitastock-primary-main
					data-selected:bg-vitastock-primary-main data-selected:text-white
					data-selected:hover:text-white`,
					classNames?.paginationItem
				),
				paginationNextTrigger: cnMerge(
					`text-vitastock-primary-main data-disabled:text-vitastock-body-color/40
					data-disabled:opacity-100`,
					classNames?.paginationNextTrigger
				),
				paginationPreviousTrigger: cnMerge(
					`text-vitastock-body-color data-disabled:text-vitastock-body-color/40
					data-disabled:opacity-100`,
					classNames?.paginationPreviousTrigger
				),
				tableCell: cnMerge("px-6 py-4 text-[14px]", classNames?.tableCell),
				tableContainer: cnMerge("overflow-x-auto", classNames?.tableContainer),
				tableHead: cnMerge(
					`h-12 bg-shadcn-muted px-6 text-[12px] font-bold tracking-wider text-vitastock-body-color/75
					uppercase`,
					classNames?.tableHead
				),
				tableHeader: cnMerge("bg-shadcn-muted", classNames?.tableHeader),
				tableRow: (rowProps) => {
					return cnMerge(
						"border-b border-shadcn-border/70 hover:bg-shadcn-muted/25",
						isFunction(classNames?.tableRow) ? classNames.tableRow(rowProps) : classNames?.tableRow
					);
				},
			}}
		/>
	);
}

export { DashboardDataTable };
