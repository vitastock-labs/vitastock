"use client";

import { flexRender, type Row, type Table as TanstackTable } from "@tanstack/react-table";
import * as Table from "@/components/ui/table";
import { cnMerge } from "@/lib/utils/cn";
import { DataTablePagination } from "./data-table-pagination";

type DataTableClassNames = {
	base?: string;
	pagination?: string;
	tableBody?: string;
	tableCell?: string;
	tableContainer?: string;
	tableHead?: string;
	tableHeader?: string;
	tableRoot?: string;
	tableRow?: string;
};

export function DataTable<TData>(
	props: React.ComponentProps<"div"> & {
		classNames?: DataTableClassNames;
		emptyMessage?: string;
		errorMessage?: string;
		getRowClassName?: (row: Row<TData>) => string | undefined;
		isError?: boolean;
		isLoading?: boolean;
		showPagination?: boolean;
		table: TanstackTable<TData>;
		totalRows?: number;
	}
) {
	const {
		children,
		className,
		classNames,
		emptyMessage = "No results found.",
		errorMessage = "Failed to load data.",
		getRowClassName,
		isError = false,
		isLoading = false,
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

		return rows.map((row) => (
			<Table.Row
				key={row.id}
				data-state={row.getIsSelected() ? "selected" : undefined}
				className={cnMerge(classNames?.tableRow, getRowClassName?.(row))}
			>
				{row.getVisibleCells().map((cell) => (
					<Table.Cell key={cell.id} className={classNames?.tableCell}>
						{flexRender(cell.column.columnDef.cell, cell.getContext())}
					</Table.Cell>
				))}
			</Table.Row>
		));
	};

	return (
		<div className={cnMerge("flex min-w-0 flex-col", className, classNames?.base)} {...restOfProps}>
			{children}

			<Table.Root
				className={classNames?.tableRoot}
				classNames={{ container: classNames?.tableContainer }}
			>
				<Table.Header className={classNames?.tableHeader}>
					{table.getHeaderGroups().map((headerGroup) => (
						<Table.Row
							key={headerGroup.id}
							className={cnMerge("hover:bg-transparent", classNames?.tableRow)}
						>
							{headerGroup.headers.map((header) => (
								<Table.Head
									key={header.id}
									colSpan={header.colSpan}
									className={classNames?.tableHead}
								>
									{header.isPlaceholder ? null : (
										flexRender(header.column.columnDef.header, header.getContext())
									)}
								</Table.Head>
							))}
						</Table.Row>
					))}
				</Table.Header>

				<Table.Body className={classNames?.tableBody}>{renderTableBody()}</Table.Body>
			</Table.Root>

			{showPagination && !isLoading && !isError && (
				<DataTablePagination table={table} totalRows={totalRows} className={classNames?.pagination} />
			)}
		</div>
	);
}

export type { DataTableClassNames };
