"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { createSearchParamsString, tw } from "@zayne-labs/toolkit-core";
import { For, ForWithWrapper } from "@zayne-labs/ui-react/common/for";
import { parseISO } from "date-fns";
import { parseAsString, parseAsStringLiteral, useQueryState, useQueryStates } from "nuqs";
import { useDeferredValue, useState } from "react";
import { IconBox } from "@/components/common/IconBox";
import { NavLinkEphemeral } from "@/components/common/NavLink";
import { Switch } from "@/components/common/switch";
import { Badge, Combobox } from "@/components/ui";
import { Button } from "@/components/ui/button";
import {
	createDataTableColumnHelper,
	DataTableQueryToolbar,
	useDataTable,
	useDataTableQueryState,
	type DataTableQueryKeys,
} from "@/components/ui/data-table";
import { DateTimePicker } from "@/components/ui/datetime-picker";
import {
	backendApiSchemaRoutes,
	StockAdditionLogTypeSchema,
	StockLogTypeSchema,
	StockMovementLogTypeSchema,
} from "@/lib/api/callBackendApi/apiSchema";
import { inventoryActivityExportMutation } from "@/lib/react-query/mutationOptions";
import {
	inventoryActivityQuery,
	inventoryDrugsQuery,
	type InventoryActivityQueryResultType,
} from "@/lib/react-query/queryOptions";
import { cnJoin } from "@/lib/utils/cn";
import { formatDateTime, formatDrugLabel, formatEnumLabel } from "@/lib/utils/formatters";
import {
	EMPTY_DISPLAY_VALUE,
	LOADING_DISPLAY_VALUE,
} from "@/pages/(protected)/dashboard/-components/constants";
import { EmptyState } from "@/pages/(protected)/dashboard/-components/EmptyState";
import { DashboardDataTable } from "../-components/DashboardDataTableShared";
import { Main } from "../-components/Main";

type ActivityRow = InventoryActivityQueryResultType["rows"][number];

const EMPTY_ACTIVITY_ROWS: ActivityRow[] = [];
const activityColumnHelper = createDataTableColumnHelper<ActivityRow>();

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

const activityColumns = activityColumnHelper.columns([
	activityColumnHelper.accessor("createdAt", {
		cell: ({ getValue }) => (
			<span className="whitespace-nowrap text-vitastock-body-color">{formatDateTime(getValue())}</span>
		),
		enableSorting: false,
		header: "Timestamp",
	}),
	activityColumnHelper.accessor((row) => formatDrugLabel(row.drug, { includeGenericName: true }), {
		cell: ({ row }) => (
			<div>
				<p className="font-bold text-black">{formatDrugLabel(row.original.drug)}</p>
				<p className="mt-0.5 text-[12px] text-vitastock-body-color">
					{row.original.drug.genericName} / {row.original.drug.unit ?? EMPTY_DISPLAY_VALUE}
				</p>
			</div>
		),
		enableSorting: false,
		header: "Drug",
		id: "drug",
	}),
	activityColumnHelper.accessor("logType", {
		cell: ({ getValue }) => {
			const logType = getValue();

			return (
				<Badge
					className={cnJoin(
						"border-none px-2.5 py-1 text-[11px] font-bold capitalize",
						stockAdditionLogTypes.has(logType)
							&& "bg-vitastock-primary-subtle text-vitastock-primary-dark",
						logType === "stock_out" && "bg-shadcn-muted text-vitastock-body-color",
						!stockAdditionLogTypes.has(logType)
							&& logType !== "stock_out"
							&& "bg-shadcn-destructive/10 text-shadcn-destructive"
					)}
				>
					{formatEnumLabel(logType)}
				</Badge>
			);
		},
		enableSorting: false,
		header: "Movement",
	}),
	activityColumnHelper.accessor("quantity", {
		cell: ({ getValue, row }) => (
			<span className="font-bold text-black">
				{getValue().toLocaleString()} {row.original.drug.unit ?? EMPTY_DISPLAY_VALUE}
			</span>
		),
		enableSorting: false,
		header: "Quantity",
	}),
	activityColumnHelper.accessor("person", {
		cell: ({ getValue }) => <span className="text-vitastock-body-color">{getValue()}</span>,
		enableSorting: false,
		header: "Performed By",
	}),
	activityColumnHelper.accessor("notes", {
		cell: ({ getValue }) => (
			<span className="block max-w-64 truncate text-vitastock-body-color">
				{getValue() ?? EMPTY_DISPLAY_VALUE}
			</span>
		),
		enableSorting: false,
		header: "Notes",
	}),
]);

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
	const [{ drugId, from, to }, setReportFilters] = useQueryStates({
		drugId: parseAsString,
		from: parseAsString,
		to: parseAsString,
	});
	const activityFilters = {
		...(drugId && { drugId }),
		...(from && { from }),
		...(logType && { logType }),
		...(search && { search }),
		...(to && { to }),
	};
	const activityFiltersResult =
		backendApiSchemaRoutes["@get/inventory/activity/export"].query.safeParse(activityFilters);
	const filtersAreValid = activityFiltersResult.success;
	const filterError = activityFiltersResult.error?.issues[0]?.message;

	const inventoryActivityQueryResult = useQuery({
		...inventoryActivityQuery({
			...activityFilters,
			page: pagination.pageIndex + 1,
			pageSize: pagination.pageSize,
		}),
		enabled: filtersAreValid,
	});
	const inventoryActivityExportMutationResult = useMutation(inventoryActivityExportMutation());

	const handleExport = () => {
		inventoryActivityExportMutationResult.mutate(activityFilters);
	};

	const activity = inventoryActivityQueryResult.data;
	const hasNoActivity =
		inventoryActivityQueryResult.isSuccess
		&& activity?.pagination.total === 0
		&& !search
		&& !logType
		&& !drugId
		&& !from
		&& !to;

	const table = useDataTable({
		columns: activityColumns,
		data: activity?.rows ?? EMPTY_ACTIVITY_ROWS,
		getRowId: (row) => row.id,
		manualPagination: true,
		meta: { queryKeys: ACTIVITY_TABLE_QUERY_KEYS },
		onPaginationChange,
		rowCount: activity?.pagination.total ?? 0,
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
									search: createSearchParamsString({
										movement: StockMovementLogTypeSchema.enum.stock_in,
									}),
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
						className="flex min-w-0 flex-col rounded-2xl bg-white shadow-sm ring-1
							ring-shadcn-border/60"
					>
						<header className="flex flex-col gap-1 border-b border-shadcn-border/50 p-6">
							<div className="flex flex-col gap-1">
								<h2 className="text-[18px] font-bold text-black">Stock Movement Log</h2>
								<p className="text-[14px] text-vitastock-body-color">
									Latest inventory changes recorded in this workspace.
								</p>
							</div>
						</header>

						<DashboardDataTable
							table={table}
							isError={inventoryActivityQueryResult.isError}
							isLoading={inventoryActivityQueryResult.isLoading}
							emptyMessage="No stock movements match these filters."
							errorMessage="Failed to load stock movements."
							totalRows={activity?.pagination.total}
						>
							<DataTableQueryToolbar
								table={table}
								actions={
									<Button
										size="medium"
										type="button"
										isLoading={inventoryActivityExportMutationResult.isPending}
										className="h-10 rounded-lg px-4"
										disabled={
											!filtersAreValid
											|| !inventoryActivityQueryResult.isSuccess
											|| activity?.pagination.total === 0
										}
										onClick={handleExport}
									>
										<IconBox icon="lucide:download" className="size-4" />
										Export CSV
									</Button>
								}
								hasCustomFilters={[drugId, from, to].some(Boolean)}
								isSearching={inventoryActivityQueryResult.isFetching && Boolean(search)}
								onReset={() => void setReportFilters(null)}
								searchPlaceholder="Search drug or person..."
								selectLabel="All movements"
								selectOptions={STOCK_LOG_TYPE_FILTER_OPTIONS}
							>
								<ReportDrugFilter
									drugId={drugId}
									onChange={(value) => {
										void setReportFilters({ drugId: value === "" ? null : value });
										table.setPageIndex(0);
									}}
								/>
								<ReportDateFilter
									availableDateRange={activity?.availableDateRange}
									from={from}
									to={to}
									onChange={(dates) => {
										void setReportFilters(dates);
										table.setPageIndex(0);
									}}
								/>
							</DataTableQueryToolbar>
							{filterError && (
								<p className="px-6 pb-4 text-[13px] font-medium text-shadcn-destructive">
									{filterError}
								</p>
							)}
						</DashboardDataTable>
					</section>
				</Switch.Default>
			</Switch.Root>
		</Main>
	);
}

export default ReportsPage;

function ReportDrugFilter(props: { drugId: string | null; onChange: (value: string) => void }) {
	const { drugId, onChange } = props;
	const [search, setSearch] = useState("");
	const deferredSearch = useDeferredValue(search.trim());
	const drugsQueryResult = useQuery(
		inventoryDrugsQuery({
			...(drugId && !deferredSearch && { drugId }),
			page: 1,
			pageSize: 20,
			...(deferredSearch && { search: deferredSearch }),
		})
	);
	const drugs = drugsQueryResult.data?.drugs ?? [];
	const options = drugs.map((drug) => ({
		label: formatDrugLabel(drug, { includeGenericName: true }),
		value: drug.id,
	}));

	return (
		<Combobox.Root data={options} type="drug" value={drugId ?? ""} onValueChange={onChange}>
			<Combobox.Trigger
				classNames={{
					base: `h-10 w-60 justify-between rounded-lg border-none bg-white px-3 text-[13px]
					font-normal shadow-[0_2px_8px_hsl(220,15%,15%,0.12)] hover:bg-white`,
					icon: "text-vitastock-body-color/70",
				}}
			/>
			<Combobox.Content popoverOptions={{ align: "start", sideOffset: 6 }}>
				<Combobox.Input className="h-10 text-[14px]" onValueChange={setSearch} />
				<Combobox.Empty className="p-4 text-center text-[13px] text-vitastock-body-color">
					{drugsQueryResult.isFetching ? "Searching drugs..." : "No drugs found."}
				</Combobox.Empty>
				<Combobox.List className="max-h-64 p-1.5">
					<Combobox.Group className="p-0">
						<For
							each={options}
							renderItem={(option) => (
								<Combobox.Item
									key={option.value}
									value={option.value}
									keywords={[option.label]}
									className="min-h-9 rounded-md px-3 text-[13px]
										data-[selected=true]:bg-vitastock-primary-main/10
										data-[selected=true]:text-vitastock-primary-dark"
								>
									{option.label}
								</Combobox.Item>
							)}
						/>
					</Combobox.Group>
				</Combobox.List>
			</Combobox.Content>
		</Combobox.Root>
	);
}

function ReportDateFilter(props: {
	availableDateRange: InventoryActivityQueryResultType["availableDateRange"] | undefined;
	from: string | null;
	onChange: (dates: { from?: string | null; to?: string | null }) => void;
	to: string | null;
}) {
	const { availableDateRange, from, onChange, to } = props;
	const pickerClassName = tw`h-10 w-full min-w-0 rounded-lg border-none bg-white px-3 text-[13px]
	shadow-[0_2px_8px_hsl(220,15%,15%,0.12)] sm:w-40`;
	const earliestActivityDate = availableDateRange ? parseISO(availableDateRange.from) : undefined;
	const latestActivityDate = availableDateRange ? parseISO(availableDateRange.to) : undefined;
	const latestFromDate = to ? parseISO(to) : latestActivityDate;
	const earliestToDate = from ? parseISO(from) : earliestActivityDate;

	return (
		<div className="flex w-full min-w-0 shrink-0 flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap">
			<DateTimePicker
				variant="date"
				dateString={from ?? ""}
				placeholder="From"
				datePickerProps={{
					disabled: [
						...(earliestActivityDate ? [{ before: earliestActivityDate }] : []),
						...(latestFromDate ? [{ after: latestFromDate }] : []),
					],
				}}
				dateFormats={{ onChangeDate: "yyyy-MM-dd", visibleDate: "dd MMM yyyy" }}
				className={pickerClassName}
				onDateStringChange={(value) => onChange({ from: value ?? null })}
			/>
			<DateTimePicker
				variant="date"
				dateString={to ?? ""}
				placeholder="To"
				datePickerProps={{
					disabled: [
						...(earliestToDate ? [{ before: earliestToDate }] : []),
						...(latestActivityDate ? [{ after: latestActivityDate }] : []),
					],
				}}
				dateFormats={{ onChangeDate: "yyyy-MM-dd", visibleDate: "dd MMM yyyy" }}
				className={pickerClassName}
				onDateStringChange={(value) => onChange({ to: value ?? null })}
			/>
		</div>
	);
}

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
				className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4"
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
								{isLoading ? LOADING_DISPLAY_VALUE : item.value}
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
