"use client";

import type { RowData } from "@tanstack/react-table";
import * as Table from "@/components/ui/table";
import { cnMerge } from "@/lib/utils/cn";
import { DataTablePagination, type DataTablePaginationVariant } from "./data-table-pagination";
import type { DataTableInstance, DataTableRow } from "./data-table-types";

type DataTableClassNames<TData extends RowData = RowData> = {
	base?: string;
	pagination?: string;
	paginationBase?: string;
	paginationCountLabel?: string;
	paginationEllipsis?: string;
	paginationItem?: string;
	paginationNextTrigger?: string;
	paginationPreviousTrigger?: string;
	paginationRoot?: string;
	tableBody?: string;
	tableCell?: string;
	tableContainer?: string;
	tableHead?: string;
	tableHeader?: string;
	tableRoot?: string;
	tableRow?: string | ((props: { index: number; row: DataTableRow<TData> }) => string | undefined);
};

export function DataTable<TData extends RowData>(
	props: React.ComponentProps<"div"> & {
		classNames?: DataTableClassNames<TData>;
		countLabelVariant?: "count" | "range";
		emptyMessage?: string;
		errorMessage?: string;
		isError?: boolean;
		isLoading?: boolean;
		paginationVariant?: DataTablePaginationVariant;
		showPagination?: boolean;
		table: DataTableInstance<TData>;
		totalRows?: number;
	}
) {
	const {
		children,
		className,
		classNames,
		countLabelVariant,
		emptyMessage = "No results found.",
		errorMessage = "Failed to load data.",
		isError = false,
		isLoading = false,
		paginationVariant,
		showPagination = true,
		table,
		totalRows,
		...restOfProps
	} = props;
	const rows = table.getRowModel().rows;
	const visibleColumnCount = table.getVisibleLeafColumns().length;

	const renderTableBody = () => {
		if (isLoading) {
			return (
				<Table.Row>
					<Table.Cell colSpan={visibleColumnCount} className="h-28 text-center">
						Loading...
					</Table.Cell>
				</Table.Row>
			);
		}

		if (isError) {
			return (
				<Table.Row>
					<Table.Cell
						colSpan={visibleColumnCount}
						className="h-28 text-center text-shadcn-destructive"
					>
						{errorMessage}
					</Table.Cell>
				</Table.Row>
			);
		}

		if (rows.length === 0) {
			return (
				<Table.Row>
					<Table.Cell colSpan={visibleColumnCount} className="h-28 text-center">
						{emptyMessage}
					</Table.Cell>
				</Table.Row>
			);
		}

		return rows.map((row, index) => (
			<Table.Row
				key={row.id}
				data-state={row.getIsSelected() ? "selected" : undefined}
				className={
					typeof classNames?.tableRow === "function" ?
						classNames.tableRow({ index, row })
					:	classNames?.tableRow
				}
			>
				{row.getVisibleCells().map((cell) => (
					<Table.Cell
						key={cell.id}
						className={cnMerge(
							classNames?.tableCell,
							cell.column.columnDef.meta?.classNames?.column
						)}
					>
						<table.FlexRender cell={cell} />
					</Table.Cell>
				))}
			</Table.Row>
		));
	};

	return (
		<div className={cnMerge("flex min-w-0 flex-col", className, classNames?.base)} {...restOfProps}>
			{children}

			<Table.Root
				classNames={{
					container: classNames?.tableContainer,
					table: classNames?.tableRoot,
				}}
			>
				<Table.Header className={classNames?.tableHeader}>
					{table.getHeaderGroups().map((headerGroup) => (
						<Table.Row
							key={headerGroup.id}
							className={cnMerge(
								"hover:bg-transparent",
								typeof classNames?.tableRow === "string" && classNames.tableRow
							)}
						>
							{headerGroup.headers.map((header) => (
								<Table.Head
									key={header.id}
									colSpan={header.colSpan}
									className={cnMerge(
										classNames?.tableHead,
										header.column.columnDef.meta?.classNames?.column
									)}
								>
									{header.isPlaceholder ? null : <table.FlexRender header={header} />}
								</Table.Head>
							))}
						</Table.Row>
					))}
				</Table.Header>

				<Table.Body className={classNames?.tableBody}>{renderTableBody()}</Table.Body>
			</Table.Root>

			{showPagination && !isLoading && !isError && (
				<DataTablePagination
					table={table}
					totalRows={totalRows}
					countLabelVariant={countLabelVariant}
					paginationVariant={paginationVariant}
					classNames={{
						base: classNames?.paginationBase,
						countLabel: classNames?.paginationCountLabel,
						ellipsis: classNames?.paginationEllipsis,
						item: classNames?.paginationItem,
						nextTrigger: classNames?.paginationNextTrigger,
						previousTrigger: classNames?.paginationPreviousTrigger,
						root: classNames?.paginationRoot,
					}}
					className={classNames?.pagination}
				/>
			)}
		</div>
	);
}

export type { DataTableClassNames };
