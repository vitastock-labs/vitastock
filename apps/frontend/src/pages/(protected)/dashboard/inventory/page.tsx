"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { DialogAnimated } from "@/components/animated/ui";
import * as DropZoneInput from "@/components/common/DropZoneInput";
import { For } from "@/components/common/for";
import { IconBox } from "@/components/common/IconBox";
import { Show } from "@/components/common/show";
import { Badge, Select, Table } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { DateTimePicker } from "@/components/ui/datetime-picker";
import { Form } from "@/components/ui/form";
import { callBackendApiForQuery } from "@/lib/api/callBackendApi";
import { backendApiSchemaRoutes } from "@/lib/api/callBackendApi/apiSchema";
import {
	inventorySummaryQuery,
	type InventorySummaryQueryResultType,
} from "@/lib/react-query/queryOptions";
import { cnJoin } from "@/lib/utils/cn";
import { Main } from "../-components/Main";

function InventoryPage() {
	return (
		<Main className="gap-10 px-12 pt-12">
			<InventoryHeader />
			<InventoryStats />
			<InventoryActions />

			<div className="flex flex-col gap-6 lg:flex-row">
				<InventoryTable />
				<ProjectedStockOut />
			</div>
		</Main>
	);
}

export default InventoryPage;

function InventoryHeader() {
	return (
		<header className="flex flex-col gap-1.5">
			<h1 className="text-[30px] font-extrabold tracking-tight text-black">Inventory</h1>
			<p className="text-[15px] font-medium text-vitastock-body-color">
				Manage stock levels, expirations, and suppliers.
			</p>
		</header>
	);
}

const nairaFormatter = new Intl.NumberFormat("en-NG", {
	currency: "NGN",
	style: "currency",
});

const dateFormatter = new Intl.DateTimeFormat("en", {
	day: "numeric",
	month: "short",
	year: "numeric",
});

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
						{nairaFormatter.format((summary?.stats.stockValueKobo ?? 0) / 100)}
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
	return (
		<section className="flex items-center justify-between">
			<div className="flex items-center gap-4">
				<DialogAnimated.Root>
					<DialogAnimated.Trigger asChild={true}>
						<Button theme="secondary-outline" className="px-5 text-vitastock-primary-main">
							<IconBox icon="lucide:file-down" className="size-4.5" />
							Bulk Import
						</Button>
					</DialogAnimated.Trigger>

					<BulkImportDialog />
				</DialogAnimated.Root>

				<DialogAnimated.Root>
					<DialogAnimated.Trigger asChild={true}>
						<Button theme="secondary-outline" className="px-5 text-vitastock-primary-main">
							<IconBox icon="lucide:zap" className="size-4.5" />
							Quick Dispense
						</Button>
					</DialogAnimated.Trigger>

					<StockMovementDialog defaultLogType="stock_out" />
				</DialogAnimated.Root>
			</div>

			<DialogAnimated.Root>
				<DialogAnimated.Trigger asChild={true}>
					<Button className="px-6">
						<IconBox icon="lucide:plus" className="size-4.5" />
						Add Stock
					</Button>
				</DialogAnimated.Trigger>

				<StockMovementDialog defaultLogType="stock_in" />
			</DialogAnimated.Root>
		</section>
	);
}

const columns = ["Drug Name", "Batch No.", "Expiry", "Available Stock", "Action"] as const;

function InventoryTable() {
	const inventorySummaryQueryResult = useQuery(inventorySummaryQuery());
	const rows = inventorySummaryQueryResult.data?.rows ?? [];

	return (
		<section className="flex w-full flex-col rounded-2xl bg-white shadow-sm ring-1 ring-shadcn-border/60">
			<header className="flex items-center justify-between border-b border-shadcn-border/50 p-5">
				<h2 className="text-[16px] font-bold text-black">Current Stock</h2>
				<Button
					unstyled={true}
					className="text-vitastock-body-color transition-colors hover:text-vitastock-primary-main"
				>
					<IconBox icon="lucide:filter" className="size-5" />
				</Button>
			</header>

			<Table.Root>
				<Table.Header>
					<Table.Row className="border-b-shadcn-border/50 hover:bg-transparent">
						<For
							each={columns}
							renderItem={(column) => (
								<Table.Head
									key={column}
									className={cnJoin(
										`h-12 px-5 text-[12px] font-bold tracking-wider text-vitastock-body-color/70
										uppercase`,
										column === "Action" && "text-right"
									)}
								>
									{column}
								</Table.Head>
							)}
						/>
					</Table.Row>
				</Table.Header>

				<Table.Body>
					{inventorySummaryQueryResult.isLoading && (
						<Table.Row>
							<Table.Cell colSpan={columns.length} className="px-5 py-8 text-center">
								Loading inventory...
							</Table.Cell>
						</Table.Row>
					)}

					{inventorySummaryQueryResult.isError && (
						<Table.Row>
							<Table.Cell colSpan={columns.length} className="px-5 py-8 text-center">
								Failed to load inventory.
							</Table.Cell>
						</Table.Row>
					)}

					{!inventorySummaryQueryResult.isLoading && rows.length === 0 && (
						<Table.Row>
							<Table.Cell colSpan={columns.length} className="px-5 py-8 text-center">
								No inventory records found.
							</Table.Cell>
						</Table.Row>
					)}

					<For
						each={rows}
						renderItem={(item) => (
							<Table.Row
								key={item.drugId}
								className={cnJoin(
									"border-b-shadcn-border/30 last:border-0 hover:bg-shadcn-muted/20",
									item.status === "expired" && "bg-[#fee2e2]/30 hover:bg-[#fee2e2]/50",
									item.status === "low_stock" && "bg-[#ffedd5]/30 hover:bg-[#ffedd5]/50"
								)}
							>
								<Table.Cell className="px-5 py-4 text-[14px] font-medium text-black">
									{item.drug.name} {item.drug.strength}
								</Table.Cell>
								<Table.Cell className="px-5 py-4 text-[14px] text-vitastock-body-color">
									{item.nearestBatch?.batchNumber ?? "-"}
								</Table.Cell>
								<Table.Cell className="px-5 py-4">
									<div className="flex items-center gap-2.5">
										<span className="text-[14px] text-vitastock-body-color">
											{item.nearestExpiryDate ?
												dateFormatter.format(item.nearestExpiryDate)
											:	"-"}
										</span>
										<StatusBadge status={item.status} />
									</div>
								</Table.Cell>
								<Table.Cell className="px-5 py-4 text-[14px] font-bold text-black">
									{item.totalAvailable.toLocaleString()} {item.drug.unit}
								</Table.Cell>
								<Table.Cell className="px-5 py-4 text-right">
									<Button unstyled={true} className="text-vitastock-primary-main">
										<IconBox icon="lucide:pencil" className="size-4" />
									</Button>
								</Table.Cell>
							</Table.Row>
						)}
					/>
				</Table.Body>
			</Table.Root>
		</section>
	);
}

function StatusBadge(props: { status: InventorySummaryQueryResultType["rows"][number]["status"] }) {
	const { status } = props;

	if (status === "normal") {
		return null;
	}

	return (
		<Badge
			className={cnJoin(
				"border-none px-2 py-0.5 text-[11px] font-bold capitalize",
				status === "expired" && "bg-[#fee2e2] text-[#b91c1c]",
				status === "low_stock" && "bg-[#ffedd5] text-[#c2410c]",
				status === "out_of_stock" && "bg-shadcn-muted text-vitastock-body-color"
			)}
		>
			{status.replaceAll("_", " ")}
		</Badge>
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
								<p className="text-[12px] font-medium text-vitastock-body-color">
									{item.totalAvailable} {item.drug.unit} left
								</p>
							</div>
							<StatusBadge status={item.status} />
						</div>
					)}
				/>
			</div>
		</aside>
	);
}

const StockLogSchema = backendApiSchemaRoutes["@post/inventory/stock-log"].body;

type StockLogBody = z.infer<typeof StockLogSchema>;

type StockMovementType = Extract<StockLogBody["logType"], "stock_in" | "stock_out">;

function StockMovementDialog(props: { defaultLogType: StockMovementType }) {
	const { defaultLogType } = props;
	const isDispense = defaultLogType === "stock_out";

	const inventorySummaryQueryResult = useQuery(inventorySummaryQuery());
	const rows = inventorySummaryQueryResult.data?.rows ?? [];
	const queryClient = useQueryClient();

	const form = useForm({
		defaultValues: {
			batchNumber: "",
			drugId: rows[0]?.drugId ?? "",
			expiryDate: "",
			logType: defaultLogType,
			notes: "",
			quantity: "",
			unitCostKobo: "0",
		},
		resolver: zodResolver(StockLogSchema),
	});

	const onSubmit = form.handleSubmit(async (data) => {
		await callBackendApiForQuery("@post/inventory/stock-log", {
			body: {
				...data,
				...(isDispense && {
					expiryDate: undefined,
					unitCostKobo: undefined,
				}),
			},
			meta: { toast: { success: true } },
			onSuccess: () => {
				void queryClient.invalidateQueries(inventorySummaryQuery());
				form.reset();
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

			{rows.length === 0 && <NoDrugsFound />}

			{rows.length > 0 && (
				<Form.Root form={form} onSubmit={(event) => void onSubmit(event)}>
					<div className="flex flex-col gap-4 border-y border-shadcn-border/70 p-5">
						<Form.Field control={form.control} name="drugId">
							<Form.Label>Drug Name</Form.Label>
							<Form.FieldBoundController
								render={({ field }) => (
									<Select.Root value={field.value} onValueChange={field.onChange}>
										<Select.Trigger className="h-10 rounded-lg border-shadcn-border px-4">
											<Select.Value placeholder="Select drug" />
										</Select.Trigger>
										<Select.Content>
											<For
												each={rows}
												renderItem={(row) => (
													<Select.Item key={row.drugId} value={row.drugId}>
														{row.drug.name} {row.drug.strength}
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
								<Form.Input type="number" placeholder={isDispense ? "e.g. 10" : "e.g. 100"} />
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
												dateFormats={{
													onChangeDate: "yyyy-MM-dd",
													visibleDate: "MMM d, yyyy",
												}}
												className="h-10 rounded-lg px-4"
												onDateStringChange={field.onChange}
											/>
										)}
									/>
								</Form.Field>
							)}
						</div>

						<Show.Root when={isDispense}>
							<Show.Content>
								<Form.Field control={form.control} name="notes">
									<Form.Label>Reason</Form.Label>
									<Form.FieldBoundController
										render={({ field }) => (
											<Select.Root value={field.value} onValueChange={field.onChange}>
												<Select.Trigger className="h-10 rounded-lg border-shadcn-border px-4">
													<Select.Value placeholder="Select reason" />
												</Select.Trigger>
												<Select.Content>
													<Select.Item value="Patient Dispense">Patient Dispense</Select.Item>
													<Select.Item value="Damaged Stock">Damaged Stock</Select.Item>
													<Select.Item value="Inventory Correction">
														Inventory Correction
													</Select.Item>
												</Select.Content>
											</Select.Root>
										)}
									/>
								</Form.Field>
							</Show.Content>

							<Show.Fallback>
								<Form.Field control={form.control} name="batchNumber">
									<Form.Label>Batch Number</Form.Label>
									<Form.Input placeholder="Optional batch number" />
								</Form.Field>

								<Form.Field control={form.control} name="unitCostKobo">
									<Form.Label>Unit Cost (kobo)</Form.Label>
									<Form.Input type="number" placeholder="0" />
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

function NoDrugsFound() {
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
				Drug creation is not available in this phase.
			</p>

			<Button isDisabled={true} className="mt-6 w-full">
				<IconBox icon="lucide:plus" className="size-4" />
				Add New Drug
			</Button>
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
									Unit Cost (kobo)
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
