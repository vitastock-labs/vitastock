"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef, ColumnFiltersState } from "@tanstack/react-table";
import { addYears, endOfYear, startOfYear } from "date-fns";
import { parseAsString, parseAsStringEnum, useQueryState, useQueryStates } from "nuqs";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { DialogAnimated } from "@/components/animated/ui";
import * as DropZoneInput from "@/components/common/DropZoneInput";
import { For } from "@/components/common/for";
import { IconBox } from "@/components/common/IconBox";
import { Show } from "@/components/common/show";
import { Switch } from "@/components/common/switch";
import { Badge, Select } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { DataTable, DataTableColumnHeader, useDataTable } from "@/components/ui/data-table";
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
	inventoryActivityQueryKey,
	inventoryAlertsQueryKey,
	inventoryAlertsUnreadCountQuery,
	inventoryAllDrugsQuery,
	inventorySummaryQuery,
	sessionQuery,
	type InventorySummaryQueryResultType,
} from "@/lib/react-query/queryOptions";
import { cnJoin } from "@/lib/utils/cn";
import { formatDate, formatEnumLabel, formatKoboAsNaira } from "@/lib/utils/formatters";
import { EmptyState } from "@/pages/(protected)/dashboard/-components/EmptyState";
import { CreateDrugDialog, EditDrugDialog } from "../-components/DrugMasterDialog";
import { Main } from "../-components/Main";

function InventoryPage() {
	const inventorySummaryQueryResult = useQuery(inventorySummaryQuery());
	const hasNoInventory =
		inventorySummaryQueryResult.isSuccess && inventorySummaryQueryResult.data.rows.length === 0;

	return (
		<Main className="gap-10 px-12 pt-12">
			<InventoryHeader />

			<Switch.Root>
				<Switch.Match when={hasNoInventory}>
					<EmptyState
						icon="lucide:package-x"
						title="No inventory yet"
						description="Add your first stock entry or import your inventory to get started."
						action={
							<DialogAnimated.Root>
								<DialogAnimated.Trigger asChild={true}>
									<Button>
										<IconBox icon="lucide:plus" className="size-4" />
										Import Drugs
									</Button>
								</DialogAnimated.Trigger>
								<BulkImportDialog />
							</DialogAnimated.Root>
						}
					/>
				</Switch.Match>

				<Switch.Default>
					<InventoryStats />
					<InventoryActions />

					<div className="flex flex-col gap-6 lg:flex-row">
						<InventoryTable />
						<ProjectedStockOut />
					</div>
				</Switch.Default>
			</Switch.Root>
		</Main>
	);
}

export default InventoryPage;

function InventoryHeader() {
	return (
		<header className="flex flex-col gap-1.5">
			<h1 className="text-[30px] font-extrabold tracking-tight text-black">Inventory</h1>
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
		<section className="flex flex-col gap-6 lg:flex-row">
			<div
				className="flex w-full items-center justify-between rounded-2xl bg-[#fafafa] p-6 shadow-sm
					ring-1 ring-shadcn-border/60"
			>
				<div className="flex flex-col gap-2">
					<h3 className="text-[13px] font-bold tracking-widest text-vitastock-body-color uppercase">
						Total Inventory Value
					</h3>
					<p className="text-[34px] leading-none font-extrabold tracking-tight text-black">
						{formatKoboAsNaira(summary?.stats.stockValueKobo ?? 0)}
					</p>
				</div>

				<span
					className="grid size-14 place-items-center rounded-xl bg-vitastock-primary-main/15
						text-vitastock-primary-main"
				>
					<IconBox icon="lucide:dollar-sign" className="size-6" />
				</span>
			</div>

			<div
				className="flex w-full items-center justify-between rounded-2xl bg-[#fee2e2] p-6 shadow-sm
					ring-1 ring-[#fca5a5]"
			>
				<div className="flex flex-col gap-2">
					<h3 className="text-[13px] font-bold tracking-widest text-[#b91c1c] uppercase">
						Critical Supply Alerts
					</h3>
					<p className="text-[34px] leading-none font-extrabold tracking-tight text-[#b91c1c]">
						{summary?.stats.criticalCount ?? 0}
					</p>
					<p className="text-[13px] font-medium text-[#b91c1c]/90">Requires immediate review</p>
				</div>

				<span className="grid size-14 place-items-center rounded-xl bg-[#b91c1c] text-white">
					<IconBox icon="lucide:triangle-alert" className="size-6" />
				</span>
			</div>
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

	return (
		<>
			<section className="flex flex-wrap items-center justify-between gap-4">
				<div className="flex flex-wrap items-center gap-4">
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

				<DialogAnimated.Root>
					<DialogAnimated.Trigger asChild={true}>
						<Button theme="secondary-outline" className="px-5 text-vitastock-primary-main">
							<IconBox icon="lucide:file-down" className="size-4.5" />
							Bulk Import
						</Button>
					</DialogAnimated.Trigger>

					<BulkImportDialog />
				</DialogAnimated.Root>
			</section>

			{stockMovementSearchParams.movement && (
				<DialogAnimated.Root
					defaultOpen={true}
					onOpenChange={(open) => !open && closeAlertActionDialog()}
				>
					<StockMovementDialog
						defaultLogType={stockMovementSearchParams.movement}
						initialBatchId={stockMovementSearchParams.batchId ?? undefined}
						initialDrugId={stockMovementSearchParams.drugId ?? undefined}
						initialReason={stockMovementSearchParams.reason ?? undefined}
						onComplete={closeAlertActionDialog}
					/>
				</DialogAnimated.Root>
			)}
		</>
	);
}

const INVENTORY_FILTER_OPTIONS = [
	{ label: "All stock", value: "all" },
	{ label: "Needs attention", value: "attention" },
	{ label: "In stock", value: "in_stock" },
] as const;

type InventoryFilter = (typeof INVENTORY_FILTER_OPTIONS)[number]["value"];
type InventoryRow = InventorySummaryQueryResultType["rows"][number];

const EMPTY_INVENTORY_ROWS: InventoryRow[] = [];

const inventoryColumnFilters = {
	all: [],
	attention: [{ id: "stockState", value: "attention" }],
	in_stock: [{ id: "stockState", value: "in_stock" }],
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

	const columns = useMemo<Array<ColumnDef<InventoryRow>>>(
		() => [
			{
				accessorFn: (row) => row.status,
				enableGlobalFilter: false,
				enableSorting: false,
				filterFn: (row, _columnId, filterValue: InventoryFilter) => {
					if (filterValue === "attention") {
						return row.original.hasExpiredStock || row.original.status !== "normal";
					}

					if (filterValue === "in_stock") {
						return row.original.totalAvailable > 0;
					}

					return true;
				},
				id: "stockState",
			},
			{
				accessorFn: (row) => `${row.drug.name} ${row.drug.genericName} ${row.drug.strength}`,
				cell: ({ row }) => (
					<div>
						<p className="font-medium text-black">
							{row.original.drug.name} {row.original.drug.strength}
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
			},
			{
				accessorFn: (row) => row.nearestBatch?.batchNumber ?? "",
				cell: ({ row }) => (
					<span className="text-vitastock-body-color">
						{row.original.nearestBatch?.batchNumber ?? "-"}
					</span>
				),
				header: ({ column }) => (
					<DataTableColumnHeader column={column}>Batch No.</DataTableColumnHeader>
				),
				id: "batchNumber",
			},
			{
				accessorFn: (row) => row.nearestExpiryDate?.getTime() ?? 0,
				cell: ({ row }) => (
					<div className="flex items-center gap-2.5">
						<span className="text-vitastock-body-color">
							{row.original.nearestExpiryDate ? formatDate(row.original.nearestExpiryDate) : "-"}
						</span>
						<StatusBadge
							hasExpiredStock={row.original.hasExpiredStock}
							status={row.original.status}
						/>
					</div>
				),
				header: ({ column }) => <DataTableColumnHeader column={column}>Expiry</DataTableColumnHeader>,
				id: "nearestExpiryDate",
			},
			{
				accessorKey: "totalAvailable",
				cell: ({ row }) => (
					<span className="font-bold text-black">
						{row.original.totalAvailable.toLocaleString()} {row.original.drug.unit}
					</span>
				),
				header: ({ column }) => (
					<DataTableColumnHeader column={column}>Available Stock</DataTableColumnHeader>
				),
			},
			{
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
			},
		],
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
			<section
				className="flex w-full flex-col rounded-2xl bg-white shadow-sm ring-1 ring-shadcn-border/60"
			>
				<header className="flex items-center justify-between border-b border-shadcn-border/50 p-5">
					<h2 className="text-[16px] font-bold text-black">Current Stock</h2>
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

				<DataTable
					table={table}
					isError={inventorySummaryQueryResult.isError}
					isLoading={inventorySummaryQueryResult.isLoading}
					emptyMessage="No inventory records match this filter."
					errorMessage="Failed to load inventory."
					getRowClassName={(row) =>
						cnJoin(
							"hover:bg-shadcn-muted/20",
							row.original.hasExpiredStock && "bg-[#fee2e2]/30 hover:bg-[#fee2e2]/50",
							row.original.status === "low_stock" && "bg-[#ffedd5]/30 hover:bg-[#ffedd5]/50"
						)
					}
					classNames={{
						tableCell: "px-5 py-4",
						tableHead: `h-12 px-5 text-[12px] font-bold tracking-wider text-vitastock-body-color/70
						uppercase`,
						tableHeader: "bg-shadcn-muted",
						tableRow: "border-b border-shadcn-border",
					}}
				/>
			</section>

			{drugToEdit && (
				<DialogAnimated.Root open={true} onOpenChange={(open) => !open && setDrugToEdit(null)}>
					<EditDrugDialog drug={drugToEdit} onComplete={() => setDrugToEdit(null)} />
				</DialogAnimated.Root>
			)}
		</>
	);
}

function StatusBadge(props: {
	hasExpiredStock: boolean;
	status: InventorySummaryQueryResultType["rows"][number]["status"];
}) {
	const { hasExpiredStock, status } = props;

	if (status === "normal" && !hasExpiredStock) {
		return null;
	}

	return (
		<>
			{status !== "normal" && (
				<Badge
					className={cnJoin(
						"border-none px-2 py-0.5 text-[11px] font-bold capitalize",
						status === "expired" && "bg-[#fee2e2] text-[#b91c1c]",
						status === "low_stock" && "bg-[#ffedd5] text-[#c2410c]",
						status === "out_of_stock" && "bg-shadcn-muted text-vitastock-body-color"
					)}
				>
					{formatEnumLabel(status)}
				</Badge>
			)}

			{hasExpiredStock && status !== "expired" && (
				<Badge className="border-none bg-[#fee2e2] px-2 py-0.5 text-[11px] font-bold text-[#b91c1c]">
					Expired batch
				</Badge>
			)}
		</>
	);
}

function ProjectedStockOut() {
	const inventorySummaryQueryResult = useQuery(inventorySummaryQuery());
	const rows = inventorySummaryQueryResult.data?.rows ?? [];
	const lowRows = rows.filter((row) => row.status === "low_stock" || row.status === "out_of_stock");

	return (
		<aside
			className="flex w-full max-w-90 flex-col rounded-2xl bg-white p-5 shadow-sm ring-1
				ring-shadcn-border/60"
		>
			<h2 className="text-[16px] font-bold text-black">Needs Attention</h2>

			<div className="mt-5 flex flex-col gap-3">
				{lowRows.length === 0 && (
					<p className="text-[14px] font-medium text-vitastock-body-color">
						No critical stock items.
					</p>
				)}

				<For
					each={lowRows}
					renderItem={(item) => (
						<div
							key={item.drugId}
							className="flex items-center justify-between rounded-lg bg-shadcn-muted/40 p-3"
						>
							<div className="min-w-0">
								<p className="truncate text-[14px] font-bold text-black">
									{item.drug.name} {item.drug.strength}
								</p>
								<p className="truncate text-[12px] text-vitastock-body-color">
									{item.drug.genericName}
								</p>
								<p className="text-[12px] font-medium text-vitastock-body-color">
									{item.totalAvailable} {item.drug.unit} left
								</p>
							</div>
							<StatusBadge hasExpiredStock={item.hasExpiredStock} status={item.status} />
						</div>
					)}
				/>
			</div>
		</aside>
	);
}

const StockLogSchema = backendApiSchemaRoutes["@post/inventory/stock-log"].body;

type StockMovementType = z.infer<typeof StockMovementLogTypeSchema>;

const stockOutReasonLabels = {
	[StockOutReasonSchema.enum.damaged]: "Damaged stock",
	[StockOutReasonSchema.enum.expired]: "Expired stock",
	[StockOutReasonSchema.enum.patient]: "Patient dispense",
	[StockOutReasonSchema.enum.ward]: "Ward dispense",
} satisfies Record<z.infer<typeof StockOutReasonSchema>, string>;

function StockMovementDialog(props: {
	defaultLogType: StockMovementType;
	initialBatchId?: string;
	initialDrugId?: string;
	initialReason?: z.infer<typeof StockOutReasonSchema>;
	onComplete?: () => void;
}) {
	const { defaultLogType, initialBatchId, initialDrugId, initialReason, onComplete } = props;
	const isDispense = defaultLogType === "stock_out";

	const inventoryDrugsQueryResult = useQuery(inventoryAllDrugsQuery());
	const drugs = inventoryDrugsQueryResult.data?.drugs ?? [];
	const queryClient = useQueryClient();
	const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

	const form = useForm({
		defaultValues: {
			batchId: initialBatchId,
			batchNumber: "",
			drugId: initialDrugId ?? "",
			expiryDate: "",
			logType: defaultLogType,
			notes: "",
			quantity: "",
			reason: initialReason ?? StockOutReasonSchema.enum.patient,
			unitCostNaira: "0",
		},
		resolver: zodResolver(StockLogSchema),
	});

	const onSubmit = form.handleSubmit(async (data) => {
		await callBackendApiForQuery("@post/inventory/stock-log", {
			body: data,
			headers: { "idempotency-key": idempotencyKey },
			meta: { toast: { success: true } },
			onSuccess: () => {
				void queryClient.invalidateQueries(inventorySummaryQuery());
				void queryClient.invalidateQueries(dashboardOverviewQuery());
				void queryClient.invalidateQueries({ queryKey: inventoryAlertsQueryKey });
				void queryClient.invalidateQueries(inventoryAlertsUnreadCountQuery());
				void queryClient.invalidateQueries({ queryKey: inventoryActivityQueryKey });
				form.reset();
				setIdempotencyKey(crypto.randomUUID());
				onComplete?.();
			},
		});
	});

	return (
		<DialogAnimated.Content
			withCloseButton={false}
			className="max-w-[430px] gap-0 overflow-hidden rounded-xl border-shadcn-border bg-white p-0
				shadow-2xl"
		>
			<header
				className="flex items-start justify-between gap-6 border-b border-shadcn-border/70 px-5 py-4"
			>
				<div className="flex flex-col gap-1">
					<DialogAnimated.Title className="text-[17px] font-extrabold text-black">
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

			{inventoryDrugsQueryResult.isLoading && (
				<div className="px-6 py-8 text-center text-[14px] text-vitastock-body-color">
					Loading drugs...
				</div>
			)}

			{inventoryDrugsQueryResult.isError && (
				<div className="px-6 py-8 text-center text-[14px] text-shadcn-destructive">
					Failed to load drugs.
				</div>
			)}

			{!inventoryDrugsQueryResult.isLoading
				&& !inventoryDrugsQueryResult.isError
				&& drugs.length === 0 && (
					<NoDrugsFound onDrugCreated={(drug) => form.setValue("drugId", drug.id)} />
				)}

			{drugs.length > 0 && (
				<Form.Root form={form} onSubmit={(event) => void onSubmit(event)}>
					<div className="flex flex-col gap-4 border-y border-shadcn-border/70 p-5">
						<Form.Field control={form.control} name="drugId">
							<Form.Label>Drug Name</Form.Label>
							<Form.FieldBoundController
								render={({ field }) => (
									<Select.Root value={field.value} onValueChange={field.onChange}>
										<Select.Trigger
											className="h-10 rounded-lg border border-shadcn-border bg-white px-4"
										>
											<Select.Value placeholder="Select drug" />
										</Select.Trigger>
										<Select.Content>
											<For
												each={drugs}
												renderItem={(drug) => (
											<Select.Item key={drug.id} value={drug.id}>
												{drug.name} ({drug.genericName}) {drug.strength}
											</Select.Item>
												)}
											/>
										</Select.Content>
									</Select.Root>
								)}
							/>
						</Form.Field>

						<div className={cnJoin("grid gap-4", !isDispense && "grid-cols-2")}>
							<Form.Field control={form.control} name="quantity">
								<Form.Label>Quantity</Form.Label>
								<Form.Input
									type="number"
									placeholder={isDispense ? "e.g. 10" : "e.g. 100"}
									className="h-10 rounded-lg border border-shadcn-border bg-white px-4"
								/>
							</Form.Field>

							{!isDispense && (
								<Form.Field control={form.control} name="expiryDate">
									<Form.Label>Expiry Date</Form.Label>
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
												className="h-10 rounded-lg border border-shadcn-border bg-white px-4"
												onDateStringChange={field.onChange}
											/>
										)}
									/>
								</Form.Field>
							)}
						</div>

						<Show.Root when={isDispense}>
							<Show.Content>
								<Form.Field control={form.control} name="reason">
									<Form.Label>Reason</Form.Label>
									<Form.FieldBoundController
										render={({ field }) => (
											<Select.Root value={field.value} onValueChange={field.onChange}>
												<Select.Trigger
													className="h-10 rounded-lg border border-shadcn-border bg-white
														px-4"
												>
													<Select.Value placeholder="Select reason" />
												</Select.Trigger>
												<Select.Content>
													<For
														each={StockOutReasonSchema.options}
														renderItem={(reason) => (
															<Select.Item key={reason} value={reason}>
																{stockOutReasonLabels[reason]}
															</Select.Item>
														)}
													/>
												</Select.Content>
											</Select.Root>
										)}
									/>
								</Form.Field>
							</Show.Content>

							<Show.Fallback>
								<Form.Field control={form.control} name="batchNumber">
									<Form.Label>Batch Number</Form.Label>
									<Form.Input
										placeholder="Optional batch number"
										className="h-10 rounded-lg border border-shadcn-border bg-white px-4"
									/>
								</Form.Field>

								<Form.Field control={form.control} name="unitCostNaira">
									<Form.Label>Unit Cost</Form.Label>
									<Form.InputGroup
										className="h-10 rounded-lg border border-shadcn-border bg-white px-4"
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
								</Form.Field>
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
									<IconBox icon={isDispense ? "lucide:zap" : "lucide:plus"} className="size-4" />
									{isDispense ? "Dispense" : "Add Stock"}
								</Button>
							)}
						</Form.Submit>
					</DialogAnimated.Footer>
				</Form.Root>
			)}
		</DialogAnimated.Content>
	);
}

function NoDrugsFound(props: { onDrugCreated: Parameters<typeof CreateDrugDialog>[0]["onComplete"] }) {
	const { onDrugCreated } = props;

	return (
		<div className="flex flex-col items-center px-6 py-8 text-center">
			<div
				className="grid size-16 place-items-center rounded-xl bg-shadcn-muted
					text-vitastock-body-color"
			>
				<IconBox icon="lucide:search-x" className="size-7" />
			</div>

			<h3 className="mt-6 text-[20px] font-extrabold text-black">No matching drug found</h3>
			<p className="mt-2 text-[14px] font-medium text-vitastock-body-color">
				Create a drug in Drug Management before recording stock movements.
			</p>

			<DialogAnimated.Root>
				<DialogAnimated.Trigger asChild={true}>
					<Button className="mt-6 h-10 px-5">
						<IconBox icon="lucide:plus" className="size-4" />
						Add New Drug
					</Button>
				</DialogAnimated.Trigger>
				<CreateDrugDialog onComplete={onDrugCreated} />
			</DialogAnimated.Root>
		</div>
	);
}

function BulkImportDialog() {
	return (
		<DialogAnimated.Content
			withCloseButton={false}
			className="max-w-[700px] gap-0 overflow-hidden rounded-xl border-shadcn-border bg-white p-0
				shadow-2xl"
		>
			<header
				className="flex items-start justify-between gap-6 border-b border-shadcn-border/70 px-7 py-5"
			>
				<div className="flex flex-col gap-1">
					<DialogAnimated.Title className="text-[22px] font-extrabold text-black">
						Bulk Import Stock
					</DialogAnimated.Title>
					<DialogAnimated.Description className="text-[13px] font-medium text-vitastock-body-color/90">
						Step 1: Upload a csv/excel file containing your drug stock to add your stock in bulk
					</DialogAnimated.Description>
				</div>

				<DialogAnimated.Close
					className="rounded-lg p-1 text-vitastock-body-color hover:bg-shadcn-muted"
				>
					<IconBox icon="lucide:x" className="size-6" />
					<span className="sr-only">Close</span>
				</DialogAnimated.Close>
			</header>

			<div className="flex flex-col gap-6 p-7">
				<DropZoneInput.Root
					allowedFileTypes={[".csv", ".xls", ".xlsx"]}
					maxFileCount={1}
					maxFileSize={{ mb: 10 }}
				>
					<DropZoneInput.Area
						classNames={{
							container: `grid min-h-54 cursor-pointer place-items-center rounded-lg border
							border-dashed border-vitastock-primary-light bg-shadcn-muted/40 transition-colors
							hover:border-vitastock-primary-main
							data-[drag-over=true]:border-vitastock-primary-main
							data-[drag-over=true]:bg-vitastock-primary-main/5`,
						}}
						unstyled={true}
					>
						<div className="flex flex-col items-center text-center">
							<span
								className="grid size-14 place-items-center rounded-xl bg-vitastock-primary-main/15
									text-vitastock-primary-main"
							>
								<IconBox icon="lucide:file-down" className="size-7" />
							</span>

							<p className="mt-5 text-[16px] font-bold text-black">
								Drag and drop your file here or click to browse
							</p>
							<p className="mt-1 text-[13px] font-medium text-vitastock-body-color">
								CSV or Excel files only (max 10MB)
							</p>

							<Button className="mt-5 h-9 px-4 shadow-sm" type="button">
								Browse Files
							</Button>

							<DropZoneInput.ImagePreview />
						</div>
					</DropZoneInput.Area>
				</DropZoneInput.Root>

				<article className="rounded-lg bg-shadcn-muted/70 p-5">
					<div className="flex items-center justify-between gap-4">
						<h4 className="flex items-center gap-2 text-[14px] font-bold text-black">
							<IconBox
								icon="lucide:circle"
								className="size-4 rounded-full text-vitastock-primary-main"
							/>
							File Requirements
						</h4>

						<Button
							unstyled={true}
							isDisabled={true}
							className="flex items-center gap-1.5 text-[13px] font-bold text-vitastock-primary-main
								disabled:opacity-60"
						>
							<IconBox icon="lucide:download" className="size-4" />
							Download Sample Template
						</Button>
					</div>

					<div className="mt-5 grid gap-6 md:grid-cols-2">
						<div>
							<p
								className="text-[11px] font-bold tracking-wider text-vitastock-body-color
									uppercase"
							>
								Required Fields
							</p>
							<ul className="mt-2 space-y-1.5 text-[13px] font-medium text-vitastock-body-color">
								<li className="flex items-center gap-2">
									<span className="size-1.5 rounded-full bg-shadcn-destructive" />
									Drug Name
								</li>
								<li className="flex items-center gap-2">
									<span className="size-1.5 rounded-full bg-shadcn-destructive" />
									Quantity
								</li>
								<li className="flex items-center gap-2">
									<span className="size-1.5 rounded-full bg-shadcn-destructive" />
									Expiry Date (YYYY-MM-DD)
								</li>
							</ul>
						</div>

						<div>
							<p
								className="text-[11px] font-bold tracking-wider text-vitastock-body-color
									uppercase"
							>
								Optional Fields
							</p>
							<ul className="mt-2 space-y-1.5 text-[13px] font-medium text-vitastock-body-color">
								<li className="flex items-center gap-2">
									<span className="size-1.5 rounded-full bg-shadcn-border" />
									Unit
								</li>
								<li className="flex items-center gap-2">
									<span className="size-1.5 rounded-full bg-shadcn-border" />
									Unit Cost (Naira)
								</li>
								<li className="flex items-center gap-2">
									<span className="size-1.5 rounded-full bg-shadcn-border" />
									Supplier ID
								</li>
							</ul>
						</div>
					</div>
				</article>
			</div>

			<DialogAnimated.Footer
				className="flex-row justify-end gap-5 border-t border-shadcn-border/70 bg-shadcn-muted/30 p-5"
			>
				<DialogAnimated.Close asChild={true}>
					<Button theme="primary-ghost">Cancel</Button>
				</DialogAnimated.Close>

				<Button isDisabled={true} className="h-12 min-w-38 gap-2 rounded-lg px-6 text-[15px]">
					Continue
					<IconBox icon="lucide:arrow-right" className="size-4" />
				</Button>
			</DialogAnimated.Footer>
		</DialogAnimated.Content>
	);
}
