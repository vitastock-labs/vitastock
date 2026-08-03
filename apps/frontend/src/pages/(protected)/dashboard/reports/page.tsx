"use client";

import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { createSearchParams } from "@zayne-labs/toolkit-core";
import { ForWithWrapper } from "@zayne-labs/ui-react/common/for";
import { parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";
import { useMemo } from "react";
import { IconBox } from "@/components/common/IconBox";
import { NavLinkEphemeral } from "@/components/common/NavLink";
import { Switch } from "@/components/common/switch";
import { Badge } from "@/components/ui";
import { Button } from "@/components/ui/button";
import {
	DataTable,
	DataTableQueryToolbar,
	useDataTable,
	useDataTableQueryState,
	type DataTableQueryKeys,
} from "@/components/ui/data-table";
import {
	StockAdditionLogTypeSchema,
	StockLogTypeSchema,
	StockMovementLogTypeSchema,
} from "@/lib/api/callBackendApi/apiSchema";
import {
	inventoryActivityQuery,
	type InventoryActivityQueryResultType,
} from "@/lib/react-query/queryOptions";
import { cnJoin } from "@/lib/utils/cn";
import { formatDateTime, formatEnumLabel, formatKoboAsNaira } from "@/lib/utils/formatters";
import { EmptyState } from "@/pages/(protected)/dashboard/-components/EmptyState";
import { Main } from "../-components/Main";

type ActivityRow = InventoryActivityQueryResultType["rows"][number];

const ACTIVITY_TABLE_QUERY_KEYS = {
	page: "page",
	perPage: "pageSize",
	search: "search",
	select: "logType",
} as const satisfies DataTableQueryKeys;

const STOCK_LOG_TYPE_FILTER_OPTIONS = StockLogTypeSchema.options.map((logType) => ({
	label: formatEnumLabel(logType),
	value: logType,
}));
const stockAdditionLogTypes = new Set<string>(StockAdditionLogTypeSchema.options);

function ReportsPage() {
	const { onPaginationChange, pagination } = useDataTableQueryState({
		initialPageSize: 20,
		queryKeys: ACTIVITY_TABLE_QUERY_KEYS,
	});

	const [search] = useQueryState(ACTIVITY_TABLE_QUERY_KEYS.search, parseAsString.withDefault(""));

	const [logType] = useQueryState(
		ACTIVITY_TABLE_QUERY_KEYS.select,
		parseAsStringLiteral(StockLogTypeSchema.options)
	);

	const inventoryActivityQueryResult = useQuery(
		inventoryActivityQuery({
			...(logType && { logType }),
			page: pagination.pageIndex + 1,
			pageSize: pagination.pageSize,
			...(search && { search }),
		})
	);

	const activity = inventoryActivityQueryResult.data;
	const hasNoActivity =
		inventoryActivityQueryResult.isSuccess && activity?.pagination.total === 0 && !search && !logType;

	const columns = useMemo<Array<ColumnDef<ActivityRow>>>(
		() => [
			{
				accessorKey: "createdAt",
				cell: ({ row }) => (
					<span className="whitespace-nowrap text-vitastock-body-color">
						{formatDateTime(row.original.createdAt)}
					</span>
				),
				enableSorting: false,
				header: "Timestamp",
			},
			{
				accessorFn: (row) => `${row.drug.name} ${row.drug.genericName} ${row.drug.strength}`,
				cell: ({ row }) => (
					<div>
						<p className="font-bold text-black">
							{row.original.drug.name} {row.original.drug.strength}
						</p>
						<p className="mt-0.5 text-[12px] text-vitastock-body-color">
							{row.original.drug.genericName} / {row.original.drug.unit}
						</p>
					</div>
				),
				enableSorting: false,
				header: "Drug",
				id: "drug",
			},
			{
				accessorKey: "logType",
				cell: ({ row }) => (
					<Badge
						className={cnJoin(
							"border-none px-2.5 py-1 text-[11px] font-bold capitalize",
							stockAdditionLogTypes.has(row.original.logType)
								&& "bg-vitastock-primary-subtle text-vitastock-primary-dark",
							row.original.logType === "stock_out" && "bg-shadcn-muted text-vitastock-body-color",
							!stockAdditionLogTypes.has(row.original.logType)
								&& row.original.logType !== "stock_out"
								&& "bg-shadcn-destructive/10 text-shadcn-destructive"
						)}
					>
						{formatEnumLabel(row.original.logType)}
					</Badge>
				),
				enableSorting: false,
				header: "Movement",
			},
			{
				accessorKey: "quantity",
				cell: ({ row }) => (
					<span className="font-bold text-black">
						{row.original.quantity.toLocaleString()} {row.original.drug.unit}
					</span>
				),
				enableSorting: false,
				header: "Quantity",
			},
			{
				accessorKey: "person",
				cell: ({ row }) => <span className="text-vitastock-body-color">{row.original.person}</span>,
				enableSorting: false,
				header: "Performed By",
			},
			{
				accessorKey: "notes",
				cell: ({ row }) => (
					<span className="block max-w-64 truncate text-vitastock-body-color">
						{row.original.notes ?? "-"}
					</span>
				),
				enableSorting: false,
				header: "Notes",
			},
		],
		[]
	);

	const table = useDataTable({
		columns,
		data: activity?.rows ?? [],
		getRowId: (row) => row.id,
		manualPagination: true,
		meta: { queryKeys: ACTIVITY_TABLE_QUERY_KEYS },
		onPaginationChange,
		pageCount: activity?.pagination.pageCount ?? 0,
		state: { pagination },
	});

	return (
		<Main className="gap-10 px-12 pt-12">
			<header className="flex flex-col gap-1.5">
				<h1 className="text-[30px] font-extrabold tracking-tight text-black">Reports</h1>
				<p className="text-[15px] font-medium text-vitastock-body-color/80">
					Review stock movement and inventory activity.
				</p>
			</header>

			<Switch.Root>
				<Switch.Match when={hasNoActivity}>
					<EmptyState
						icon="lucide:clipboard-list"
						title="No activity yet"
						description="Stock activity will appear here once you start adding or dispensing inventory."
						action={
							<NavLinkEphemeral
								to={{
									pathname: "/dashboard/inventory",
									search: createSearchParams({
										movement: StockMovementLogTypeSchema.enum.stock_in,
									}).toString(),
								}}
							>
								<Button>
									<IconBox icon="lucide:plus" className="size-4" />
									Add Inventory
								</Button>
							</NavLinkEphemeral>
						}
					/>
				</Switch.Match>

				<Switch.Default>
					<ReportsStats isLoading={inventoryActivityQueryResult.isLoading} stats={activity?.stats} />

					<section
						className="flex flex-col rounded-2xl bg-white shadow-sm ring-1 ring-shadcn-border/60"
					>
						<header className="flex flex-col gap-1 border-b border-shadcn-border/50 p-6">
							<div className="flex flex-col gap-1">
								<h2 className="text-[18px] font-bold text-black">Stock Movement Log</h2>
								<p className="text-[14px] text-vitastock-body-color">
									Latest inventory changes recorded in this workspace.
								</p>
							</div>
						</header>

						<DataTable
							table={table}
							isError={inventoryActivityQueryResult.isError}
							isLoading={inventoryActivityQueryResult.isLoading}
							emptyMessage="No stock movements match these filters."
							errorMessage="Failed to load stock movements."
							totalRows={activity?.pagination.total}
							classNames={{
								tableCell: "px-6 py-4",
								tableHead: `h-12 px-6 text-[12px] font-bold tracking-wider
								text-vitastock-body-color/80 uppercase`,
								tableHeader: "bg-shadcn-muted",
								tableRow: "border-b border-shadcn-border",
							}}
						>
							<DataTableQueryToolbar
								table={table}
								searchPlaceholder="Search drug or person..."
								selectLabel="All movements"
								selectOptions={STOCK_LOG_TYPE_FILTER_OPTIONS}
							/>
						</DataTable>
					</section>
				</Switch.Default>
			</Switch.Root>
		</Main>
	);
}

export default ReportsPage;

function ReportsStats(props: {
	isLoading: boolean;
	stats: InventoryActivityQueryResultType["stats"] | undefined;
}) {
	const { isLoading, stats } = props;
	const statItems = [
		{
			description: "Received during the last 7 days",
			icon: "lucide:plus",
			label: "Stock Added",
			value: (stats?.weeklyStockInQuantity ?? 0).toLocaleString(),
		},
		{
			description: "Dispensed or removed during the last 7 days",
			icon: "lucide:minus",
			label: "Stock Removed",
			value: (stats?.weeklyStockOutQuantity ?? 0).toLocaleString(),
		},
		{
			description: "All movements recorded during the last 7 days",
			icon: "lucide:clipboard-list",
			label: "Movement Records",
			value: (stats?.weeklyMovementCount ?? 0).toLocaleString(),
		},
		{
			description: "Expired units removed during the last 30 days",
			icon: "lucide:package-x",
			label: "Expiry Loss",
			value: (stats?.expiredLossQuantity ?? 0).toLocaleString(),
		},
		{
			description: "Cost value of expired stock removed in 30 days",
			icon: "lucide:circle-dollar-sign",
			label: "Expiry Loss Value",
			value: formatKoboAsNaira(stats?.expiredLossValueKobo ?? 0),
		},
	] as const;

	return (
		<section className="flex flex-col gap-4">
			<header className="flex flex-col gap-1">
				<h2 className="text-[18px] font-bold text-black">Weekly Summary and Expiry Loss</h2>
				<p className="text-[14px] text-vitastock-body-color">
					Seven-day stock movement totals with expired-stock losses from the last 30 days.
				</p>
			</header>

			<ForWithWrapper
				each={statItems}
				className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3"
				renderItem={(item) => (
					<li
						key={item.label}
						className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm ring-1
							ring-shadcn-border/60"
					>
						<div className="flex items-center justify-between">
							<h3 className="text-[14px] font-medium text-vitastock-body-color">{item.label}</h3>
							<IconBox icon={item.icon} className="size-5 text-vitastock-primary-main" />
						</div>
						<div>
							<p className="text-[34px] leading-none font-extrabold tracking-tight text-black">
								{isLoading ? "..." : item.value}
							</p>
							<p className="mt-2 text-[13px] font-medium text-vitastock-body-color">
								{item.description}
							</p>
						</div>
					</li>
				)}
			/>
		</section>
	);
}
