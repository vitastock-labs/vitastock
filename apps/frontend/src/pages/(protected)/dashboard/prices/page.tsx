"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";
import { useForm } from "react-hook-form";
import { IconBox } from "@/components/common/IconBox";
import { Button } from "@/components/ui/button";
import {
	createDataTableColumnHelper,
	DataTableQueryToolbar,
	useDataTable,
	useDataTableQueryState,
	type DataTableQueryKeys,
} from "@/components/ui/data-table";
import { Form } from "@/components/ui/form";
import { callBackendApiForQuery } from "@/lib/api/callBackendApi";
import { backendApiSchemaRoutes } from "@/lib/api/callBackendApi/apiSchema";
import { posthog } from "@/lib/posthog";
import {
	inventoryDrugsQuery,
	inventoryPriceListQuery,
	inventorySummaryQuery,
	sessionQuery,
	type InventoryPriceListQueryResultType,
} from "@/lib/react-query/queryOptions";
import { formatDrugLabel, formatNaira } from "@/lib/utils/formatters";
import { InputField } from "@/pages/(home)/-components/FormPartsShared";
import { DashboardDataTable } from "../-components/DashboardDataTableShared";
import { Main } from "../-components/Main";

function PricesPage() {
	return (
		<Main className="gap-8">
			<header className="flex flex-col gap-1.5">
				<h1 className="text-[24px] font-extrabold tracking-tight text-black md:text-[30px]">
					Price List
				</h1>
				<p className="text-[15px] font-medium text-vitastock-body-color">
					Cost and selling prices for every drug, each per one of its counting unit.
				</p>
			</header>

			<PriceListTable />
		</Main>
	);
}
export default PricesPage;

const PRICE_LIST_QUERY_KEYS = {
	page: "page",
	perPage: "pageSize",
	search: "search",
	select: "prices",
} as const satisfies DataTableQueryKeys;

const PRICE_FILTER_OPTIONS = [{ label: "Prices missing", value: "missing" }] as const;

function PriceListTable() {
	const { onPaginationChange, pagination } = useDataTableQueryState({
		initialPageSize: 20,
		queryKeys: PRICE_LIST_QUERY_KEYS,
	});
	const [search] = useQueryState(PRICE_LIST_QUERY_KEYS.search, parseAsString.withDefault(""));
	const [priceFilter] = useQueryState(
		PRICE_LIST_QUERY_KEYS.select,
		parseAsStringLiteral(PRICE_FILTER_OPTIONS.map((option) => option.value))
	);

	const priceListQueryResult = useQuery(
		inventoryPriceListQuery({
			page: pagination.pageIndex + 1,
			pageSize: pagination.pageSize,
			...(priceFilter === "missing" && { pricesMissing: true }),
			...(search && { search }),
		})
	);
	const priceList = priceListQueryResult.data;

	const table = useDataTable({
		columns: priceListColumns,
		data: priceList?.rows ?? EMPTY_PRICE_LIST_ROWS,
		getRowId: (row) => row.drug.id,
		manualPagination: true,
		meta: { queryKeys: PRICE_LIST_QUERY_KEYS },
		onPaginationChange,
		rowCount: priceList?.pagination.total ?? 0,
		state: { pagination },
	});

	return (
		<section
			className="flex min-w-0 flex-col rounded-2xl bg-white shadow-sm ring-1 ring-shadcn-border/60"
		>
			<DashboardDataTable
				table={table}
				isError={priceListQueryResult.isError}
				isLoading={priceListQueryResult.isLoading}
				emptyMessage="No drugs match these filters."
				errorMessage="Failed to load the price list."
				totalRows={priceList?.pagination.total}
				classNames={{ tableCell: "align-top", tableRoot: "min-w-[760px]" }}
			>
				<DataTableQueryToolbar
					table={table}
					isSearching={priceListQueryResult.isFetching && Boolean(search)}
					searchPlaceholder="Search drugs..."
					selectLabel="All drugs"
					selectOptions={PRICE_FILTER_OPTIONS}
				/>
			</DashboardDataTable>
		</section>
	);
}

type PriceListRow = InventoryPriceListQueryResultType["rows"][number];

const EMPTY_PRICE_LIST_ROWS: PriceListRow[] = [];

const priceListColumnHelper = createDataTableColumnHelper<PriceListRow>();

const priceListColumns = priceListColumnHelper.columns([
	priceListColumnHelper.accessor((row) => formatDrugLabel(row.drug, { includeGenericName: true }), {
		cell: ({ row }) => (
			<div className="flex flex-col gap-0.5">
				<p className="font-bold text-black">{formatDrugLabel(row.original.drug)}</p>
				<p className="text-[12px] text-vitastock-body-color">{row.original.drug.genericName}</p>
				<p className="text-[12px] text-vitastock-body-color">
					Counted in {getUnitLabel(row.original.drug.unit)}
				</p>
			</div>
		),
		enableSorting: false,
		header: "Drug",
		id: "drug",
	}),
	priceListColumnHelper.accessor("costRange", {
		cell: ({ row }) => <CostRangeCell row={row.original} />,
		enableSorting: false,
		header: "Cost on hand",
	}),
	priceListColumnHelper.display({
		cell: ({ row }) => <SellingPricesCell drug={row.original.drug} />,
		header: "Selling prices",
		id: "sellingPrices",
	}),
]);

const getUnitLabel = (unit: string | null) => unit ?? "units";

const formatCostRange = (range: NonNullable<PriceListRow["costRange"]>) => {
	if (range.lowest === range.highest) {
		return formatNaira(range.lowest);
	}

	return `${formatNaira(range.lowest)} – ${formatNaira(range.highest)}`;
};

function CostRangeCell(props: { row: PriceListRow }) {
	const { row } = props;
	const { costRange, drug, uncostedBatchCount } = row;

	return (
		<div className="flex flex-col gap-1">
			{costRange ?
				<p className="font-semibold text-black">
					{formatCostRange(costRange)}
					<span className="font-normal text-vitastock-body-color">
						{" "}
						per {getUnitLabel(drug.unit)}
					</span>
				</p>
			:	<p className="text-vitastock-body-color">Not set</p>}

			{uncostedBatchCount > 0 && (
				<p className="text-[12px] font-medium text-amber-700">
					{uncostedBatchCount} {uncostedBatchCount === 1 ? "batch has" : "batches have"} no cost
				</p>
			)}
		</div>
	);
}

const DrugPricesSchema = backendApiSchemaRoutes["@patch/inventory/drugs/:drugId"].body.pick({
	retailPrice: true,
	wholesalePrice: true,
});

function SellingPricesCell(props: { drug: PriceListRow["drug"] }) {
	const { drug } = props;

	const sessionQueryResult = useQuery(sessionQuery());
	const currentUserRole = sessionQueryResult.data?.user.role;
	const canEditPrices = currentUserRole === "owner" || currentUserRole === "admin";
	const unitLabel = getUnitLabel(drug.unit);

	if (!canEditPrices) {
		return (
			<dl className="grid grid-cols-2 gap-4">
				<div className="flex flex-col gap-0.5">
					<dt className="text-[12px] text-vitastock-body-color">Retail</dt>
					<dd className="font-semibold text-black">
						{drug.retailPrice === null ?
							"Not set"
						:	`${formatNaira(drug.retailPrice)} / ${unitLabel}`}
					</dd>
				</div>
				<div className="flex flex-col gap-0.5">
					<dt className="text-[12px] text-vitastock-body-color">Wholesale</dt>
					<dd className="font-semibold text-black">
						{drug.wholesalePrice === null ?
							"Not set"
						:	`${formatNaira(drug.wholesalePrice)} / ${unitLabel}`}
					</dd>
				</div>
			</dl>
		);
	}

	return <SellingPricesForm drug={drug} />;
}

function SellingPricesForm(props: { drug: PriceListRow["drug"] }) {
	const { drug } = props;

	const queryClient = useQueryClient();
	const unitLabel = getUnitLabel(drug.unit);

	const form = useForm({
		defaultValues: {
			retailPrice: drug.retailPrice ?? "",
			wholesalePrice: drug.wholesalePrice ?? "",
		},
		resolver: zodResolver(DrugPricesSchema),
	});

	const onSubmit = form.handleSubmit(async (prices) => {
		await callBackendApiForQuery("@patch/inventory/drugs/:drugId", {
			body: prices,
			meta: { toast: { success: true } },
			onSuccess: () => {
				posthog?.capture("inventory_drug_prices_updated");

				form.reset({
					retailPrice: prices.retailPrice ?? "",
					wholesalePrice: prices.wholesalePrice ?? "",
				});

				void Promise.all([
					queryClient.invalidateQueries({
						queryKey: inventoryPriceListQuery().queryKey.slice(0, -1),
					}),
					queryClient.invalidateQueries({ queryKey: inventoryDrugsQuery().queryKey.slice(0, -1) }),
					queryClient.invalidateQueries(inventorySummaryQuery()),
				]);
			},
			params: { drugId: drug.id },
		});
	});

	return (
		<Form.Root
			form={form}
			className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-start gap-3"
			onSubmit={(event) => void onSubmit(event)}
		>
			<InputField
				control={form.control}
				name="retailPrice"
				type="number"
				inputMode="decimal"
				min={0}
				step={0.01}
				label={`Retail ₦ per ${unitLabel}`}
				placeholder="Not set"
				classNames={{ input: "h-9 px-3", label: "text-[12px] font-medium text-vitastock-body-color" }}
			/>
			<InputField
				control={form.control}
				name="wholesalePrice"
				type="number"
				inputMode="decimal"
				min={0}
				step={0.01}
				label={`Wholesale ₦ per ${unitLabel}`}
				placeholder="Not set"
				classNames={{ input: "h-9 px-3", label: "text-[12px] font-medium text-vitastock-body-color" }}
			/>

			<Form.Submit asChild={true}>
				{(formState) => (
					<Button
						className="mt-6 h-9 px-4"
						isDisabled={!formState.isDirty || formState.isSubmitting}
						isLoading={formState.isSubmitting}
					>
						<IconBox icon="lucide:check" className="size-4" />
						Save
					</Button>
				)}
			</Form.Submit>
		</Form.Root>
	);
}
