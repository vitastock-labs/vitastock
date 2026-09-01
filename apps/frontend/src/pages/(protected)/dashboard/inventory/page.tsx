"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnFiltersState } from "@tanstack/react-table";
import { addYears, endOfYear, startOfYear } from "date-fns";
import { parseAsString, parseAsStringEnum, useQueryState, useQueryStates } from "nuqs";
import { useMemo, useState } from "react";
import { useForm, useFormContext } from "react-hook-form";
import type { z } from "zod";
import { DialogAnimated } from "@/components/animated/ui";
import { For } from "@/components/common/for";
import { IconBox } from "@/components/common/IconBox";
import { Show } from "@/components/common/show";
import { Switch } from "@/components/common/switch";
import { Badge, Card, Combobox, Select } from "@/components/ui";
import { Button } from "@/components/ui/button";
import {
	createDataTableColumnHelper,
	DataTableColumnHeader,
	useDataTable,
} from "@/components/ui/data-table";
import { DateTimePicker } from "@/components/ui/datetime-picker";
import { Form } from "@/components/ui/form";
import { callBackendApiForQuery } from "@/lib/api/callBackendApi";
import {
	backendApiSchemaRoutes,
	StockMovementLogTypeSchema,
	StockOutReasonSchema,
} from "@/lib/api/callBackendApi/apiSchema";
import {
	dashboardOverviewQuery,
	inventoryActivityQuery,
	inventoryAlertsQuery,
	inventoryAlertsUnreadCountQuery,
	inventoryDrugBatchesQuery,
	inventoryDrugsQuery,
	inventorySummaryQuery,
	sessionQuery,
	type InventorySummaryQueryResultType,
} from "@/lib/react-query/queryOptions";
import { cnJoin } from "@/lib/utils/cn";
import {
	formatDate,
	formatDrugLabel,
	formatEnumLabel,
	formatKoboAsNaira,
	formatUncostedBatchCount,
} from "@/lib/utils/formatters";
import { FormField, InputField, SelectField } from "@/pages/(home)/-components/FormPartsShared";
import { EMPTY_DISPLAY_VALUE } from "@/pages/(protected)/dashboard/-components/constants";
import { EmptyState } from "@/pages/(protected)/dashboard/-components/EmptyState";
import { DashboardDataTable } from "../-components/DashboardDataTableShared";
import { CreateDrugDialog, EditDrugDialog } from "../-components/DrugMasterDialog";
import { Main } from "../-components/Main";
import { BulkImportDialog } from "./-components/BulkImportDialog";

function InventoryPage() {
	const inventorySummaryQueryResult = useQuery(inventorySummaryQuery());
	const hasNoInventory =
		inventorySummaryQueryResult.isSuccess && inventorySummaryQueryResult.data.rows.length === 0;

	const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);

	return (
		<Main className="gap-8 px-5 pt-8 md:px-8 lg:px-12 lg:pt-12">
			<InventoryHeader />

			<Switch.Root>
				<Switch.Match when={hasNoInventory}>
					<EmptyState
						icon="lucide:package-x"
						title="No inventory yet"
						description="Add your first stock entry or import your inventory to get started."
						action={
							<DialogAnimated.Root open={isBulkImportOpen} onOpenChange={setIsBulkImportOpen}>
								<DialogAnimated.Trigger asChild={true}>
									<Button>
										<IconBox icon="lucide:plus" className="size-4" />
										Import Drugs
									</Button>
								</DialogAnimated.Trigger>
								<BulkImportDialog onImported={() => setIsBulkImportOpen(false)} />
							</DialogAnimated.Root>
						}
					/>
				</Switch.Match>

				<Switch.Default>
					<InventoryStats />
					<InventoryActions />

					<section className="flex flex-col gap-6 lg:flex-row">
						<InventoryTable />
						<ProjectedStockOut />
					</section>
				</Switch.Default>
			</Switch.Root>
		</Main>
	);
}
export default InventoryPage;

function InventoryHeader() {
	return (
		<header className="flex flex-col gap-1.5">
			<h1 className="text-[30px] font-extrabold tracking-tight text-shadcn-foreground">Inventory</h1>
			<p className="text-[15px] font-medium text-vitastock-body-color">
				Manage stock levels, expirations, and Drug Master records.
			</p>
		</header>
	);
}

function InventoryStats() {
	const inventorySummaryQueryResult = useQuery(inventorySummaryQuery());
	const summary = inventorySummaryQueryResult.data;

	return (
		<section className="grid gap-6 lg:grid-cols-2" aria-label="Inventory summary">
			<Card.Root
				className="flex min-w-0 flex-row items-center justify-between gap-6 rounded-lg
					border-shadcn-border bg-shadcn-background p-6"
			>
				<Card.Content className="flex min-w-0 flex-col gap-2">
					<Card.Title
						className="text-[13px] font-bold tracking-widest text-vitastock-body-color uppercase"
					>
						Recorded Inventory Value
					</Card.Title>
					<p
						className="max-w-full text-[34px] leading-none font-extrabold tracking-tight
							wrap-break-word text-shadcn-foreground"
					>
						{formatKoboAsNaira(summary?.stats.stockValueKobo ?? 0)}
					</p>
					<Card.Description className="text-[13px] text-vitastock-body-color/70">
						{formatUncostedBatchCount(summary?.stats.uncostedBatchCount ?? 0)}
					</Card.Description>
				</Card.Content>

				<span
					className="grid size-14 place-items-center rounded-lg bg-vitastock-primary-main/15
						text-vitastock-primary-main"
				>
					<IconBox icon="lucide:dollar-sign" className="size-6" />
				</span>
			</Card.Root>

			<Card.Root
				className="flex min-w-0 flex-row items-center justify-between gap-6 rounded-lg border-red-300
					bg-red-100 p-6"
			>
				<Card.Content className="flex min-w-0 flex-col gap-2">
					<Card.Title className="text-[13px] font-bold tracking-widest text-red-700 uppercase">
						Critical Supply Alerts
					</Card.Title>
					<p className="text-[34px] leading-none font-extrabold tracking-tight text-red-700">
						{summary?.stats.criticalCount ?? 0}
					</p>
					<Card.Description className="text-[13px] font-medium text-red-700/90">
						Requires immediate review
					</Card.Description>
				</Card.Content>

				<span className="grid size-14 place-items-center rounded-lg bg-red-700 text-white">
					<IconBox icon="lucide:triangle-alert" className="size-6" />
				</span>
			</Card.Root>
		</section>
	);
}

function InventoryActions() {
	const [stockMovementSearchParams, setStockMovementSearchParams] = useQueryStates({
		batchId: parseAsString,
		drugId: parseAsString,
		movement: parseAsStringEnum([...StockMovementLogTypeSchema.options]),
		reason: parseAsStringEnum([...StockOutReasonSchema.options]),
	});

	const closeAlertActionDialog = () => {
		void setStockMovementSearchParams(
			{ batchId: null, drugId: null, movement: null, reason: null },
			{ history: "replace" }
		);
	};

	const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);

	return (
		<section className="flex flex-col gap-4" aria-label="Inventory actions">
			<nav className="flex flex-wrap items-center justify-between gap-4">
				<div className="flex flex-wrap items-center gap-3">
					<DialogAnimated.Root>
						<DialogAnimated.Trigger asChild={true}>
							<Button className="px-6">
								<IconBox icon="lucide:minus" className="size-4.5" />
								Quick Dispense
							</Button>
						</DialogAnimated.Trigger>

						<StockMovementDialog defaultLogType="stock_out" />
					</DialogAnimated.Root>

					<DialogAnimated.Root>
						<DialogAnimated.Trigger asChild={true}>
							<Button className="px-6">
								<IconBox icon="lucide:plus" className="size-4.5" />
								Add Stock
							</Button>
						</DialogAnimated.Trigger>

						<StockMovementDialog defaultLogType="stock_in" />
					</DialogAnimated.Root>

					<DialogAnimated.Root>
						<DialogAnimated.Trigger asChild={true}>
							<Button className="px-6">
								<IconBox icon="lucide:plus" className="size-4.5" />
								Add New Drug
							</Button>
						</DialogAnimated.Trigger>

						<CreateDrugDialog />
					</DialogAnimated.Root>
				</div>

				<DialogAnimated.Root open={isBulkImportOpen} onOpenChange={setIsBulkImportOpen}>
					<DialogAnimated.Trigger asChild={true}>
						<Button theme="secondary-outline" className="px-5 text-vitastock-primary-main">
							<IconBox icon="lucide:file-down" className="size-4.5" />
							Bulk Import
						</Button>
					</DialogAnimated.Trigger>

					<BulkImportDialog onImported={() => setIsBulkImportOpen(false)} />
				</DialogAnimated.Root>
			</nav>

			<StockMovementQueryDialog
				batchId={stockMovementSearchParams.batchId}
				drugId={stockMovementSearchParams.drugId}
				movement={stockMovementSearchParams.movement}
				reason={stockMovementSearchParams.reason}
				onClose={closeAlertActionDialog}
			/>
		</section>
	);
}

function StockMovementQueryDialog(props: {
	batchId: string | null;
	drugId: string | null;
	movement: StockMovementType | null;
	onClose: () => void;
	reason: z.infer<typeof StockOutReasonSchema> | null;
}) {
	const { batchId, drugId, movement, onClose, reason } = props;

	if (!movement) {
		return null;
	}

	return (
		<DialogAnimated.Root
			defaultOpen={true}
			onOpenChange={(open) => {
				if (!open) {
					onClose();
				}
			}}
		>
			<StockMovementDialog
				defaultLogType={movement}
				initialBatchId={batchId ?? undefined}
				initialDrugId={drugId ?? undefined}
				initialReason={reason ?? undefined}
				onComplete={onClose}
			/>
		</DialogAnimated.Root>
	);
}

const INVENTORY_FILTER_OPTIONS = [
	{ label: "All stock", value: "all" },
	{ label: "Needs attention", value: "attention" },
	{ label: "In stock", value: "in_stock" },
	{ label: "Low stock", value: "low_stock" },
	{ label: "Out of stock", value: "out_of_stock" },
	{ label: "Expired batches", value: "expired" },
	{ label: "Expiring soon", value: "expiring_soon" },
] as const;

type InventoryFilter = (typeof INVENTORY_FILTER_OPTIONS)[number]["value"];
type InventoryRow = InventorySummaryQueryResultType["rows"][number];

const inventoryColumnHelper = createDataTableColumnHelper<InventoryRow>();

const EMPTY_INVENTORY_ROWS: InventoryRow[] = [];

const inventoryColumnFilters = {
	all: [],
	attention: [{ id: "stockState", value: "attention" }],
	expired: [{ id: "stockState", value: "expired" }],
	expiring_soon: [{ id: "stockState", value: "expiring_soon" }],
	in_stock: [{ id: "stockState", value: "in_stock" }],
	low_stock: [{ id: "stockState", value: "low_stock" }],
	out_of_stock: [{ id: "stockState", value: "out_of_stock" }],
} satisfies Record<InventoryFilter, ColumnFiltersState>;

function InventoryTable() {
	const inventorySummaryQueryResult = useQuery(inventorySummaryQuery());
	const sessionQueryResult = useQuery(sessionQuery());
	const currentUserRole = sessionQueryResult.data?.user.role;
	const canManageDrugs = currentUserRole === "owner" || currentUserRole === "admin";

	const [activeFilter, setActiveFilter] = useQueryState(
		"stock",
		parseAsStringEnum(INVENTORY_FILTER_OPTIONS.map((option) => option.value)).withDefault("all")
	);
	const [drugToEdit, setDrugToEdit] = useState<InventoryRow["drug"] | null>(null);

	const columns = useMemo(
		() =>
			inventoryColumnHelper.columns([
				inventoryColumnHelper.accessor((row) => row.stockStatus, {
					enableSorting: false,
					filterFn: (row, _columnId, filterValue: InventoryFilter) => {
						if (filterValue === "attention") {
							return (
								row.original.stockStatus !== "normal"
								|| row.original.expiredBatchCount > 0
								|| row.original.nearExpiryBatchCount > 0
							);
						}

						if (filterValue === "in_stock") {
							return row.original.totalAvailable > 0;
						}

						if (filterValue === "expired") {
							return row.original.expiredBatchCount > 0;
						}

						if (filterValue === "expiring_soon") {
							return row.original.nearExpiryBatchCount > 0;
						}

						if (filterValue === "low_stock" || filterValue === "out_of_stock") {
							return row.original.stockStatus === filterValue;
						}

						return true;
					},
					id: "stockState",
				}),
				inventoryColumnHelper.accessor(
					(row) => formatDrugLabel(row.drug, { includeGenericName: true }),
					{
						cell: ({ row }) => (
							<div>
								<p className="font-medium text-shadcn-foreground">
									{formatDrugLabel(row.original.drug)}
								</p>
								<p className="mt-0.5 text-[12px] text-vitastock-body-color">
									{row.original.drug.genericName}
								</p>
							</div>
						),
						header: ({ column }) => (
							<DataTableColumnHeader column={column}>Drug Name</DataTableColumnHeader>
						),
						id: "drugName",
					}
				),
				inventoryColumnHelper.accessor((row) => row.nearestBatch?.batchNumber ?? "", {
					cell: ({ row }) => (
						<span className="text-vitastock-body-color">
							{row.original.nearestBatch?.batchNumber ?? EMPTY_DISPLAY_VALUE}
						</span>
					),
					header: ({ column }) => (
						<DataTableColumnHeader column={column}>Batch No.</DataTableColumnHeader>
					),
					id: "batchNumber",
				}),
				inventoryColumnHelper.accessor((row) => row.nearestExpiryDate ?? "", {
					cell: ({ row }) => (
						<span className="text-vitastock-body-color">
							{row.original.nearestExpiryDate ?
								formatDate(row.original.nearestExpiryDate)
							:	EMPTY_DISPLAY_VALUE}
						</span>
					),
					header: ({ column }) => (
						<DataTableColumnHeader column={column}>Expiry</DataTableColumnHeader>
					),
					id: "nearestExpiryDate",
				}),
				inventoryColumnHelper.accessor("totalAvailable", {
					cell: ({ row }) => (
						<div className="flex flex-col items-start gap-1.5">
							<span className="font-bold text-shadcn-foreground">
								{row.original.totalAvailable.toLocaleString()}{" "}
								{row.original.drug.unit ?? EMPTY_DISPLAY_VALUE}
							</span>
							<InventoryConditionBadges row={row.original} />
						</div>
					),
					header: ({ column }) => (
						<DataTableColumnHeader column={column}>Available Stock</DataTableColumnHeader>
					),
				}),
				inventoryColumnHelper.display({
					cell: ({ row }) => (
						<div className="flex justify-end">
							<Button
								unstyled={true}
								className="text-vitastock-primary-main"
								onClick={() => setDrugToEdit(row.original.drug)}
							>
								<IconBox icon="lucide:pencil" className="size-4" />
								<span className="sr-only">Edit {row.original.drug.name}</span>
							</Button>
						</div>
					),
					enableSorting: false,
					header: () => <span className="block text-right">Action</span>,
					id: "actions",
				}),
			]),
		[]
	);

	const table = useDataTable({
		columns,
		data: inventorySummaryQueryResult.data?.rows ?? EMPTY_INVENTORY_ROWS,
		getRowId: (row) => row.drugId,
		initialState: {
			columnVisibility: {
				stockState: false,
			},
			pagination: {
				pageIndex: 0,
				pageSize: 10,
			},
			sorting: [{ desc: false, id: "drugName" }],
		},
		state: {
			columnFilters: inventoryColumnFilters[activeFilter],
			columnVisibility: {
				actions: canManageDrugs,
				stockState: false,
			},
		},
	});

	return (
		<>
			<Card.Root
				className="flex w-full min-w-0 flex-col overflow-hidden rounded-lg border-shadcn-border
					bg-shadcn-background"
			>
				<header className="flex items-center justify-between border-b border-shadcn-border/50 p-5">
					<Card.Title className="text-[16px] font-bold text-shadcn-foreground">
						Current Stock
					</Card.Title>
					<Select.Root
						value={activeFilter}
						onValueChange={(value) => {
							void setActiveFilter(value as InventoryFilter);
						}}
					>
						<Select.Trigger className="h-9 w-36 rounded-lg border-shadcn-border px-3 text-[13px]">
							<IconBox icon="lucide:filter" className="size-4" />
							<Select.Value />
						</Select.Trigger>
						<Select.Content>
							<For
								each={INVENTORY_FILTER_OPTIONS}
								renderItem={(option) => (
									<Select.Item key={option.value} value={option.value}>
										{option.label}
									</Select.Item>
								)}
							/>
						</Select.Content>
					</Select.Root>
				</header>

				<DashboardDataTable
					table={table}
					isError={inventorySummaryQueryResult.isError}
					isLoading={inventorySummaryQueryResult.isLoading}
					emptyMessage="No inventory records match this filter."
					errorMessage="Failed to load inventory."
					classNames={{
						tableCell: "px-5",
						tableHead: "px-5",
						tableRow: ({ row }) =>
							cnJoin(
								"border-b border-shadcn-border hover:bg-shadcn-muted/20",
								row.original.expiredBatchCount > 0 && "bg-red-100/30 hover:bg-red-100/50",
								row.original.expiredBatchCount === 0
									&& row.original.nearExpiryBatchCount > 0
									&& "bg-amber-100/30 hover:bg-amber-100/50",
								row.original.expiredBatchCount === 0
									&& row.original.nearExpiryBatchCount === 0
									&& row.original.stockStatus === "low_stock"
									&& "bg-orange-100/30 hover:bg-orange-100/50"
							),
					}}
				/>
			</Card.Root>

			<InventoryEditDrugDialog drug={drugToEdit} onClose={() => setDrugToEdit(null)} />
		</>
	);
}

function InventoryEditDrugDialog(props: { drug: InventoryRow["drug"] | null; onClose: () => void }) {
	const { drug, onClose } = props;

	if (!drug) {
		return null;
	}

	return (
		<DialogAnimated.Root
			open={true}
			onOpenChange={(open) => {
				if (!open) {
					onClose();
				}
			}}
		>
			<EditDrugDialog drug={drug} onComplete={onClose} />
		</DialogAnimated.Root>
	);
}

function StockStatusBadge(props: {
	status: InventorySummaryQueryResultType["rows"][number]["stockStatus"];
}) {
	const { status } = props;

	return (
		<Badge
			className={cnJoin(
				"border-none px-2 py-0.5 text-[11px] font-bold capitalize",
				status === "normal" && "bg-green-100 text-green-700",
				status === "low_stock" && "bg-orange-100 text-orange-700",
				status === "out_of_stock" && "bg-shadcn-muted text-vitastock-body-color"
			)}
		>
			{status === "normal" ? "In stock" : formatEnumLabel(status)}
		</Badge>
	);
}

function InventoryConditionBadges(props: { row: InventoryRow }) {
	const { row } = props;

	return (
		<div className="flex flex-wrap gap-1.5">
			<StockStatusBadge status={row.stockStatus} />
			{row.expiredBatchCount > 0 && (
				<Badge className="border-none bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-700">
					Expired ({row.expiredBatchCount})
				</Badge>
			)}
			{row.nearExpiryBatchCount > 0 && (
				<Badge className="border-none bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">
					Expiring soon ({row.nearExpiryBatchCount})
				</Badge>
			)}
		</div>
	);
}

function ProjectedStockOut() {
	const inventorySummaryQueryResult = useQuery(inventorySummaryQuery());
	const rows = inventorySummaryQueryResult.data?.rows ?? [];
	const attentionRows = rows.filter(
		(row) => row.stockStatus !== "normal" || row.expiredBatchCount > 0 || row.nearExpiryBatchCount > 0
	);

	return (
		<Card.Root
			className="flex w-full max-w-90 flex-col gap-5 rounded-lg border-shadcn-border
				bg-shadcn-background p-5"
		>
			<Card.Title className="text-[16px] font-bold text-shadcn-foreground">Needs Attention</Card.Title>

			<Card.Content className="flex flex-col gap-3">
				{attentionRows.length === 0 && (
					<p className="text-[14px] font-medium text-vitastock-body-color">
						No critical stock items.
					</p>
				)}

				<For
					each={attentionRows}
					renderItem={(item) => (
						<article
							key={item.drugId}
							className="flex items-center justify-between rounded-lg bg-shadcn-muted/40 p-3"
						>
							<div className="min-w-0">
								<p className="truncate text-[14px] font-bold text-shadcn-foreground">
									{formatDrugLabel(item.drug)}
								</p>
								<p className="truncate text-[12px] text-vitastock-body-color">
									{item.drug.genericName}
								</p>
								<p className="text-[12px] font-medium text-vitastock-body-color">
									{item.totalAvailable} {item.drug.unit ?? EMPTY_DISPLAY_VALUE} left
								</p>
							</div>
							<InventoryConditionBadges row={item} />
						</article>
					)}
				/>
			</Card.Content>
		</Card.Root>
	);
}

const StockLogSchema = backendApiSchemaRoutes["@post/inventory/stock-log"].body;

type StockMovementType = z.infer<typeof StockMovementLogTypeSchema>;
type StockOutReason = z.infer<typeof StockOutReasonSchema>;
type StockLogFormValues = z.input<typeof StockLogSchema>;

const stockOutReasonLabels = {
	[StockOutReasonSchema.enum.damaged]: "Damaged stock",
	[StockOutReasonSchema.enum.expired]: "Expired stock",
	[StockOutReasonSchema.enum.patient]: "Patient dispense",
	[StockOutReasonSchema.enum.ward]: "Ward dispense",
} satisfies Record<StockOutReason, string>;

const stockOutReasonOptions = StockOutReasonSchema.options.map((reason) => ({
	label: stockOutReasonLabels[reason],
	value: reason,
}));

function StockOutDetails(props: {
	drugId: string;
	quantity: StockLogFormValues["quantity"];
	reason: StockOutReason;
}) {
	const { drugId, quantity, reason } = props;
	const form = useFormContext<StockLogFormValues>();
	const inventorySummaryQueryResult = useQuery(inventorySummaryQuery());
	const inventoryRow = inventorySummaryQueryResult.data?.rows.find((row) => row.drugId === drugId);
	const isDisposal =
		reason === StockOutReasonSchema.enum.damaged || reason === StockOutReasonSchema.enum.expired;
	const availability = reason === StockOutReasonSchema.enum.expired ? "expired" : "usable";
	const batchesQueryResult = useQuery({
		...inventoryDrugBatchesQuery({ drugId }, { availability }),
		enabled: isDisposal && drugId.length > 0,
	});
	const batches = batchesQueryResult.data?.batches ?? [];
	const batchOptions = batches.map((batch) => ({
		label: `${batch.batchNumber ?? "Unnumbered batch"} - ${formatDate(batch.expiryDate)} - ${batch.quantityAvailable} available`,
		value: batch.id,
	}));

	if (!isDisposal) {
		if (!inventoryRow || inventoryRow.usableBatchCount <= 1 || !inventoryRow.nearestBatch) {
			return null;
		}

		const hasDifferentExpiryDates = inventoryRow.usableExpiryDateCount > 1;
		const spansMultipleBatches = Number(quantity) > inventoryRow.nearestBatch.quantityAvailable;

		return (
			<aside
				className={cnJoin(
					"flex gap-3 rounded-lg border p-3",
					hasDifferentExpiryDates ?
						"border-vitastock-primary-main/25 bg-vitastock-primary-main/5"
					:	"border-shadcn-border bg-shadcn-muted/40"
				)}
			>
				<IconBox
					icon={hasDifferentExpiryDates ? "lucide:triangle-alert" : "lucide:archive"}
					className={cnJoin(
						"mt-0.5 size-4 shrink-0",
						hasDifferentExpiryDates ? "text-vitastock-primary-main" : "text-vitastock-body-color"
					)}
				/>
				<div className="flex flex-col gap-1 text-[12px] text-vitastock-body-color">
					<p className="font-bold text-shadcn-foreground">
						{hasDifferentExpiryDates ? "Use this batch first" : "Multiple batches available"}
					</p>
					<p>
						{inventoryRow.usableBatchCount} usable batches are available
						{hasDifferentExpiryDates ?
							` across ${inventoryRow.usableExpiryDateCount} expiry dates.`
						:	" with the same expiry date."}
					</p>
					<p>
						Select {inventoryRow.nearestBatch.batchNumber ?? "Unnumbered batch"} physically first. It
						expires {formatDate(inventoryRow.nearestBatch.expiryDate)} and contains{" "}
						{inventoryRow.nearestBatch.quantityAvailable}{" "}
						{inventoryRow.drug.unit ?? EMPTY_DISPLAY_VALUE}.
					</p>
					<p>VitaStock will deduct from the earliest-expiring batches automatically.</p>
					{spansMultipleBatches && (
						<p className="font-semibold text-shadcn-foreground">
							The entered quantity exceeds this batch, so the remaining quantity will continue from
							the next eligible batch.
						</p>
					)}
				</div>
			</aside>
		);
	}

	return (
		<FormField
			control={form.control}
			name="batchId"
			label={reason === StockOutReasonSchema.enum.expired ? "Expired Batch" : "Damaged Batch"}
		>
			<Switch.Root>
				<Switch.Match when={drugId.length === 0}>
					<p className="text-[12px] text-vitastock-body-color">Select a drug first.</p>
				</Switch.Match>

				<Switch.Match when={batchesQueryResult.isLoading}>
					<p className="text-[12px] text-vitastock-body-color">Loading eligible batches...</p>
				</Switch.Match>

				<Switch.Match when={batchesQueryResult.isError}>
					<p className="text-[12px] text-shadcn-destructive">Failed to load eligible batches.</p>
				</Switch.Match>

				<Switch.Match when={batchesQueryResult.isSuccess && batches.length === 0}>
					<p
						className="rounded-lg border border-shadcn-border bg-shadcn-muted/40 p-3 text-[12px]
							text-vitastock-body-color"
					>
						No eligible {availability} batch is available for this drug.
					</p>
				</Switch.Match>

				<Switch.Default>
					<Form.FieldBoundController
						render={({ field, fieldState }) => (
							<Combobox.Root
								data={batchOptions}
								type="batch"
								value={field.value}
								onValueChange={field.onChange}
							>
								<Combobox.Trigger
									aria-invalid={fieldState.invalid}
									className="h-10 w-full justify-between rounded-lg border-shadcn-border
										bg-shadcn-background px-4 text-left text-[14px] font-normal shadow-none
										hover:bg-shadcn-background aria-invalid:border-shadcn-destructive
										aria-invalid:ring-[3px] aria-invalid:ring-shadcn-destructive/20"
								/>
								<Combobox.Content
									className="rounded-lg border-shadcn-border bg-shadcn-background shadow-md"
									popoverOptions={{ align: "start", sideOffset: 6 }}
								>
									<Combobox.Input className="h-10 text-[14px]" />
									<Combobox.Empty className="p-3 text-[13px]">
										No matching batch found.
									</Combobox.Empty>
									<Combobox.List className="max-h-52 p-1.5">
										<Combobox.Group className="p-0">
											<For
												each={batches}
												renderItem={(batch) => (
													<Combobox.Item
														key={batch.id}
														value={batch.id}
														keywords={[
															batch.batchNumber ?? "Unnumbered batch",
															batch.expiryDate,
														]}
														className="min-h-9 rounded-md px-3 text-[14px]
															data-[selected=true]:bg-vitastock-primary-main/10
															data-[selected=true]:text-vitastock-primary-dark"
													>
														{batch.batchNumber ?? "Unnumbered batch"} -{" "}
														{formatDate(batch.expiryDate)} - {batch.quantityAvailable}{" "}
														available
													</Combobox.Item>
												)}
											/>
										</Combobox.Group>
									</Combobox.List>
								</Combobox.Content>
							</Combobox.Root>
						)}
					/>
				</Switch.Default>
			</Switch.Root>
		</FormField>
	);
}

function StockMovementDialog(props: {
	defaultLogType: StockMovementType;
	initialBatchId?: string;
	initialDrugId?: string;
	initialReason?: StockOutReason;
	onComplete?: () => void;
}) {
	const { defaultLogType, initialBatchId, initialDrugId, initialReason, onComplete } = props;

	const isDispense = defaultLogType === "stock_out";

	const inventoryDrugsQueryResult = useQuery(inventoryDrugsQuery());
	const drugs = inventoryDrugsQueryResult.data?.drugs ?? [];
	const drugOptions = drugs.map((drug) => ({
		label: formatDrugLabel(drug, { includeGenericName: true }),
		value: drug.id,
	}));
	const queryClient = useQueryClient();
	const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
	const [drugSearch, setDrugSearch] = useState("");
	const [isCreateDrugOpen, setIsCreateDrugOpen] = useState(false);

	const form = useForm({
		defaultValues: (() => {
			if (defaultLogType !== StockMovementLogTypeSchema.enum.stock_out) {
				return {
					batchNumber: "",
					drugId: initialDrugId ?? "",
					expiryDate: "",
					logType: defaultLogType,
					notes: "",
					quantity: "",
					unitCostNaira: "",
				};
			}

			const reason = initialReason ?? StockOutReasonSchema.enum.patient;

			if (
				reason === StockOutReasonSchema.enum.damaged
				|| reason === StockOutReasonSchema.enum.expired
			) {
				return {
					batchId: initialBatchId ?? "",
					drugId: initialDrugId ?? "",
					logType: StockMovementLogTypeSchema.enum.stock_out,
					notes: "",
					quantity: "",
					reason,
				};
			}

			return {
				drugId: initialDrugId ?? "",
				logType: StockMovementLogTypeSchema.enum.stock_out,
				notes: "",
				quantity: "",
				reason,
			};
		})() satisfies StockLogFormValues as never,
		resolver: zodResolver(StockLogSchema),
	});

	const onSubmit = form.handleSubmit(async (data) => {
		await callBackendApiForQuery("@post/inventory/stock-log", {
			body: data,
			headers: {
				"x-idempotency-key": idempotencyKey,
			},
			meta: { toast: { success: true } },
			onSuccess: () => {
				void queryClient.invalidateQueries(inventorySummaryQuery());
				void queryClient.invalidateQueries(dashboardOverviewQuery());
				void queryClient.invalidateQueries({ queryKey: inventoryAlertsQuery().queryKey.slice(0, -1) });
				void queryClient.invalidateQueries(inventoryAlertsUnreadCountQuery());
				void queryClient.invalidateQueries({
					queryKey: inventoryActivityQuery().queryKey.slice(0, -1),
				});
				form.reset();
				setIdempotencyKey(crypto.randomUUID());
				onComplete?.();
			},
		});
	});

	return (
		<DialogAnimated.Content
			withCloseButton={false}
			className="max-w-[430px] gap-0 overflow-hidden rounded-lg border-shadcn-border
				bg-shadcn-background p-0"
		>
			<header
				className="flex items-start justify-between gap-6 border-b border-shadcn-border/70 px-5 py-4"
			>
				<div className="flex flex-col gap-1">
					<DialogAnimated.Title className="text-[17px] font-extrabold text-shadcn-foreground">
						{isDispense ? "Dispense Medication" : "Add New Stock"}
					</DialogAnimated.Title>
					<DialogAnimated.Description className="text-[12px] font-medium text-vitastock-body-color/90">
						{isDispense ?
							"Record a stock-out transaction."
						:	"Enter details for the incoming medication."}
					</DialogAnimated.Description>
				</div>

				<DialogAnimated.Close
					className="rounded-lg p-1 text-vitastock-body-color hover:bg-shadcn-muted"
				>
					<IconBox icon="lucide:x" className="size-6" />
					<span className="sr-only">Close</span>
				</DialogAnimated.Close>
			</header>

			<Switch.Root>
				<Switch.Match when={inventoryDrugsQueryResult.isLoading}>
					<p className="px-6 py-8 text-center text-[14px] text-vitastock-body-color">
						Loading drugs...
					</p>
				</Switch.Match>

				<Switch.Match when={inventoryDrugsQueryResult.isError}>
					<p className="px-6 py-8 text-center text-[14px] text-shadcn-destructive">
						Failed to load drugs.
					</p>
				</Switch.Match>

				<Switch.Match when={drugs.length === 0}>
					<NoDrugsFound onDrugCreated={(drug) => form.setValue("drugId", drug.id)} />
				</Switch.Match>

				<Switch.Default>
					<Form.Root form={form} onSubmit={(event) => void onSubmit(event)}>
						<div className="flex flex-col gap-4 border-y border-shadcn-border/70 p-5">
							<FormField control={form.control} name="drugId" label="Drug Name">
								<Form.FieldBoundController
									render={({ field, fieldState }) => (
										<Combobox.Root
											data={drugOptions}
											type="drug"
											value={field.value}
											onValueChange={(value) => {
												field.onChange(value);
												form.setValue("batchId", undefined);
											}}
										>
											<Combobox.Trigger
												aria-invalid={fieldState.invalid}
												classNames={{
													base: `h-10 w-full justify-between rounded-lg border-shadcn-border
													bg-shadcn-background px-4 text-left text-[14px] font-normal
													shadow-none hover:bg-shadcn-background
													aria-invalid:border-shadcn-destructive aria-invalid:ring-[3px]
													aria-invalid:ring-shadcn-destructive/20`,
													icon: "text-vitastock-body-color/70",
												}}
											/>
											<Combobox.Content
												className="rounded-lg border-shadcn-border bg-shadcn-background
													shadow-md"
												popoverOptions={{ align: "start", sideOffset: 6 }}
											>
												<Combobox.Input
													className="h-10 text-[14px]"
													onValueChange={setDrugSearch}
												/>
												<Combobox.Empty className="p-2">
													{drugSearch.trim() && (
														<Button
															type="button"
															className="h-9 w-full justify-start px-3"
															onClick={() => setIsCreateDrugOpen(true)}
														>
															<IconBox icon="lucide:plus" className="size-4" />
															Add "{drugSearch.trim()}" as a new drug
														</Button>
													)}
												</Combobox.Empty>
												<Combobox.List className="max-h-64 p-1.5">
													<Combobox.Group className="p-0">
														<For
															each={drugs}
															renderItem={(drug) => (
																<Combobox.Item
																	key={drug.id}
																	value={drug.id}
																	keywords={[
																		formatDrugLabel(drug, { includeGenericName: true }),
																	]}
																	className="min-h-9 rounded-md px-3 text-[14px]
																		data-[selected=true]:bg-vitastock-primary-main/10
																		data-[selected=true]:text-vitastock-primary-dark"
																>
																	{formatDrugLabel(drug, { includeGenericName: true })}
																</Combobox.Item>
															)}
														/>
													</Combobox.Group>
												</Combobox.List>
											</Combobox.Content>
										</Combobox.Root>
									)}
								/>
							</FormField>

							<div className={cnJoin("grid gap-4", !isDispense && "grid-cols-2")}>
								<InputField
									control={form.control}
									name="quantity"
									type="number"
									label="Quantity"
									placeholder={isDispense ? "e.g. 10" : "e.g. 100"}
								/>

								{!isDispense && (
									<FormField control={form.control} name="expiryDate" label="Expiry Date">
										<Form.FieldBoundController
											render={({ field }) => (
												<DateTimePicker
													variant="date"
													dateString={field.value}
													placeholder="Select expiry date"
													datePickerProps={{
														disabled: { before: new Date() },
														endMonth: endOfYear(addYears(new Date(), 10)),
														startMonth: startOfYear(new Date()),
													}}
													dateFormats={{
														onChangeDate: "yyyy-MM-dd",
														visibleDate: "MMM d, yyyy",
													}}
													className="h-10 rounded-lg border border-shadcn-border
														bg-shadcn-background px-4"
													onDateStringChange={field.onChange}
												/>
											)}
										/>
									</FormField>
								)}
							</div>

							<Show.Root when={isDispense}>
								<SelectField
									control={form.control}
									name="reason"
									label="Reason"
									placeholder="Select reason"
									options={stockOutReasonOptions}
									onValueChange={() => form.setValue("batchId", undefined)}
								/>

								<Form.Watch control={form.control} name={["drugId", "quantity", "reason"]}>
									{([drugId, quantity, reason]) => (
										<StockOutDetails
											drugId={drugId}
											quantity={quantity}
											reason={StockOutReasonSchema.parse(reason)}
										/>
									)}
								</Form.Watch>

								<Show.Fallback>
									<InputField
										control={form.control}
										name="batchNumber"
										label="Batch Number"
										placeholder="Optional batch number"
									/>

									<FormField
										control={form.control}
										name="unitCostNaira"
										label="Unit Cost (Optional)"
									>
										<Form.InputGroup
											className="h-10 rounded-lg border border-shadcn-border
												bg-shadcn-background px-4"
										>
											<Form.InputGroupAddon>
												<IconBox icon="tabler:currency-naira" className="size-4" />
											</Form.InputGroupAddon>
											<Form.Input
												type="number"
												min={0}
												step="0.01"
												placeholder="0.00"
												className="h-full"
											/>
										</Form.InputGroup>
									</FormField>
								</Show.Fallback>
							</Show.Root>
						</div>

						<DialogAnimated.Footer className="flex-row justify-end gap-3 bg-shadcn-muted/30 p-4">
							<DialogAnimated.Close asChild={true}>
								<Button theme="primary-ghost" className="h-10 px-4">
									Cancel
								</Button>
							</DialogAnimated.Close>

							<Form.Submit asChild={true}>
								{(formState) => (
									<Button
										isDisabled={formState.isSubmitting}
										isLoading={formState.isSubmitting}
										className="h-10 px-4"
									>
										<IconBox
											icon={isDispense ? "lucide:minus" : "lucide:plus"}
											className="size-4"
										/>
										{isDispense ? "Dispense" : "Add Stock"}
									</Button>
								)}
							</Form.Submit>
						</DialogAnimated.Footer>
					</Form.Root>
				</Switch.Default>
			</Switch.Root>

			<DialogAnimated.Root open={isCreateDrugOpen} onOpenChange={setIsCreateDrugOpen}>
				{isCreateDrugOpen && (
					<CreateDrugDialog
						initialName={drugSearch.trim()}
						onComplete={(drug) => {
							form.setValue("drugId", drug.id, { shouldValidate: true });
							setIsCreateDrugOpen(false);
						}}
					/>
				)}
			</DialogAnimated.Root>
		</DialogAnimated.Content>
	);
}

function NoDrugsFound(props: { onDrugCreated: Parameters<typeof CreateDrugDialog>[0]["onComplete"] }) {
	const { onDrugCreated } = props;

	return (
		<div className="flex flex-col items-center gap-2 px-6 py-8 text-center">
			<span
				className="grid size-16 place-items-center rounded-lg bg-shadcn-muted
					text-vitastock-body-color"
			>
				<IconBox icon="lucide:search-x" className="size-7" />
			</span>

			<h3 className="mt-4 text-[20px] font-extrabold text-shadcn-foreground">No matching drug found</h3>
			<p className="text-[14px] font-medium text-vitastock-body-color">
				Create a drug in Drug Management before recording stock movements.
			</p>

			<DialogAnimated.Root>
				<DialogAnimated.Trigger asChild={true}>
					<Button className="mt-4 h-10 px-5">
						<IconBox icon="lucide:plus" className="size-4" />
						Add New Drug
					</Button>
				</DialogAnimated.Trigger>

				<CreateDrugDialog onComplete={onDrugCreated} />
			</DialogAnimated.Root>
		</div>
	);
}
