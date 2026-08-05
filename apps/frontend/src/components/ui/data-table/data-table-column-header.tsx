"use client";

import type { CellData, RowData } from "@tanstack/react-table";
import { IconBox } from "@/components/common/IconBox";
import { Button } from "@/components/ui/button";
import { cnMerge } from "@/lib/utils/cn";
import type { DataTableColumn } from "./data-table-types";

export function DataTableColumnHeader<TData extends RowData, TValue extends CellData>(
	props: React.ComponentProps<typeof Button> & {
		column: DataTableColumn<TData, TValue>;
	}
) {
	const { children, className, column, ...restOfProps } = props;

	if (!column.getCanSort()) {
		return <span className={className}>{children}</span>;
	}

	const sortingDirection = column.getIsSorted();

	return (
		<Button
			unstyled={true}
			className={cnMerge("group inline-flex items-center gap-1.5", className)}
			onClick={column.getToggleSortingHandler()}
			{...restOfProps}
		>
			{children}
			<IconBox
				icon={sortingDirection === "asc" ? "lucide:chevron-up" : "lucide:chevron-down"}
				className={cnMerge(
					"size-3.5 opacity-45 group-hover:opacity-80",
					sortingDirection && "opacity-90"
				)}
			/>
		</Button>
	);
}
