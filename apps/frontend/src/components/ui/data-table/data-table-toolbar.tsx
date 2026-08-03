"use client";

import type { Column, Table as TanstackTable } from "@tanstack/react-table";
import { useDebouncedFn } from "@zayne-labs/toolkit-react";
import { parseAsString, useQueryState } from "nuqs";
import { IconBox } from "@/components/common/IconBox";
import { Select } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { cnMerge } from "@/lib/utils/cn";

function DataTableToolbar<TData>(
	props: React.ComponentProps<"div"> & {
		actions?: React.ReactNode;
		table: TanstackTable<TData>;
	}
) {
	const { actions, children, className, table, ...restOfProps } = props;
	const filterableColumns = table.getAllColumns().filter((column) => column.getCanFilter());
	const isFiltered = table.getState().columnFilters.length > 0;

	return (
		<div
			role="toolbar"
			aria-orientation="horizontal"
			className={cnMerge(
				"flex shrink-0 items-center justify-between gap-3 border-b border-shadcn-border/70 px-6 py-4",
				className
			)}
			{...restOfProps}
		>
			<div className="flex min-w-0 grow flex-wrap items-center gap-3">
				{filterableColumns.map((column) => (
					<DataTableToolbarFilter key={column.id} column={column} table={table} />
				))}

				{isFiltered && (
					<Button
						theme="secondary-outline"
						size="medium"
						type="button"
						className="h-10 rounded-lg border-shadcn-border px-3.5 text-[13px]"
						onClick={() => {
							table.resetColumnFilters();
							table.setPageIndex(0);
						}}
					>
						<IconBox icon="lucide:x" className="size-4" />
						Reset
					</Button>
				)}

				{children}
			</div>
			{actions}
		</div>
	);
}

function DataTableToolbarFilter<TData>(props: { column: Column<TData>; table: TanstackTable<TData> }) {
	const { column, table } = props;
	const columnMeta = column.columnDef.meta;

	if (columnMeta?.variant === "text") {
		return (
			<DataTableToolbarSearch
				column={column}
				placeholder={columnMeta.placeholder ?? columnMeta.label}
				table={table}
			/>
		);
	}

	if (columnMeta?.variant === "select") {
		return (
			<DataTableToolbarSelectFilter
				column={column}
				allLabel={columnMeta.label}
				options={columnMeta.options ?? []}
				table={table}
			/>
		);
	}

	return null;
}

function DataTableToolbarSearch<TData>(props: {
	className?: string;
	column: Column<TData>;
	placeholder?: string;
	table: TanstackTable<TData>;
}) {
	const { className, column, placeholder = "Search...", table } = props;
	const value = (column.getFilterValue() as string | undefined) ?? "";

	return (
		<Form.InputGroup
			className={cnMerge(
				`h-10 w-full max-w-[256px] items-center gap-2.5 rounded-lg border border-shadcn-border
				bg-shadcn-muted/50 px-3.5 text-vitastock-body-color`,
				className
			)}
		>
			<Form.InputGroupAddon>
				<IconBox icon="lucide:search" className="size-4 text-vitastock-body-color/70" />
			</Form.InputGroupAddon>
			<Form.InputPrimitive
				type="search"
				placeholder={placeholder}
				value={value}
				className="h-full min-w-0 grow bg-transparent text-[14px] font-medium outline-none
					placeholder:text-vitastock-body-color/60"
				onChange={(event) => {
					column.setFilterValue(event.target.value || undefined);
					table.setPageIndex(0);
				}}
			/>
		</Form.InputGroup>
	);
}

function DataTableToolbarSelectFilter<TData>(props: {
	allLabel?: string;
	className?: string;
	column: Column<TData>;
	options: ReadonlyArray<{ label: string; value: string }>;
	table: TanstackTable<TData>;
}) {
	const { allLabel = "All", className, column, options, table } = props;
	const value = (column.getFilterValue() as string | undefined) ?? "all";

	return (
		<Select.Root
			value={value}
			onValueChange={(nextValue) => {
				column.setFilterValue(nextValue === "all" ? undefined : nextValue);
				table.setPageIndex(0);
			}}
		>
			<Select.Trigger
				className={cnMerge(
					`h-10 w-[140px] rounded-lg border-shadcn-border bg-shadcn-muted/50 px-3.5 text-[14px]
					font-medium text-black`,
					className
				)}
			>
				<Select.Value placeholder={allLabel} />
			</Select.Trigger>
			<Select.Content
				className="rounded-xl border border-shadcn-border/80 bg-white p-1.5 shadow-xl shadow-black/10"
			>
				<Select.Item value="all">{allLabel}</Select.Item>
				{options.map((option) => (
					<Select.Item key={option.value} value={option.value}>
						{option.label}
					</Select.Item>
				))}
			</Select.Content>
		</Select.Root>
	);
}

function DataTableQueryToolbar<TData>(
	props: React.ComponentProps<"div"> & {
		actions?: React.ReactNode;
		searchPlaceholder?: string;
		selectLabel?: string;
		selectOptions?: ReadonlyArray<{ label: string; value: string }>;
		table: TanstackTable<TData>;
	}
) {
	const {
		actions,
		className,
		searchPlaceholder = "Search...",
		selectLabel = "All",
		selectOptions,
		table,
		...restOfProps
	} = props;
	const queryKeys = table.options.meta?.queryKeys;
	const searchQueryKey = queryKeys?.search ?? "search";
	const selectQueryKey = queryKeys?.select ?? "filter";
	const pageQueryKey = queryKeys?.page ?? "page";
	const [search, setSearch] = useQueryState(searchQueryKey, parseAsString.withDefault(""));
	const [selectedValue, setSelectedValue] = useQueryState(selectQueryKey, parseAsString);
	const [, setPage] = useQueryState(pageQueryKey);
	const setSearchDebounced = useDebouncedFn((value: string) => {
		void setSearch(value || null);
		void setPage(null);
	}, 300);

	return (
		<div
			role="toolbar"
			aria-orientation="horizontal"
			className={cnMerge(
				`flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-shadcn-border/70
				px-6 py-4`,
				className
			)}
			{...restOfProps}
		>
			<div className="flex flex-wrap items-center gap-3">
				<Form.InputGroup
					className="h-10 w-full max-w-80 gap-2 rounded-lg border-none bg-shadcn-muted/40 px-3
						text-[14px] ring-1 ring-transparent focus-within:bg-white
						focus-within:ring-vitastock-primary-main/50"
				>
					<Form.InputGroupAddon>
						<IconBox icon="lucide:search" className="size-4.5" />
					</Form.InputGroupAddon>
					<Form.InputPrimitive
						key={search}
						type="search"
						defaultValue={search}
						placeholder={searchPlaceholder}
						className="h-full placeholder:text-[14px]"
						onChange={(event) => setSearchDebounced(event.target.value)}
					/>
				</Form.InputGroup>

				{selectOptions && (
					<Select.Root
						value={selectedValue ?? "all"}
						onValueChange={(value) => {
							void setSelectedValue(value === "all" ? null : value);
							void setPage(null);
						}}
					>
						<Select.Trigger className="h-10 w-44 rounded-lg px-3 text-[13px]">
							<IconBox icon="lucide:list-filter" className="size-4" />
							<Select.Value placeholder={selectLabel} />
						</Select.Trigger>
						<Select.Content>
							<Select.Item value="all">{selectLabel}</Select.Item>
							{selectOptions.map((option) => (
								<Select.Item key={option.value} value={option.value}>
									{option.label}
								</Select.Item>
							))}
						</Select.Content>
					</Select.Root>
				)}

				{(search || selectedValue) && (
					<Button
						theme="secondary-outline"
						size="medium"
						type="button"
						className="h-10 rounded-lg border-shadcn-border px-3.5 text-[13px]"
						onClick={() => {
							void setSearch(null);
							void setSelectedValue(null);
							void setPage(null);
						}}
					>
						<IconBox icon="lucide:x" className="size-4" />
						Reset
					</Button>
				)}
			</div>

			{actions}
		</div>
	);
}

export { DataTableQueryToolbar, DataTableToolbar };
