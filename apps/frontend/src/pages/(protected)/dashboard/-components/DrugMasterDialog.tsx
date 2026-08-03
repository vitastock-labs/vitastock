"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { parseAsString, useQueryState } from "nuqs";
import { useMemo, useState } from "react";
import { useForm, type UseFormReturn } from "react-hook-form";
import type { z } from "zod";
import { useDialogContext } from "@/components/animated/primitives/dialog-radix";
import { DialogAnimated } from "@/components/animated/ui";
import { IconBox } from "@/components/common/IconBox";
import { Badge } from "@/components/ui";
import { Button } from "@/components/ui/button";
import {
	DataTable,
	DataTableColumnHeader,
	DataTableQueryToolbar,
	useDataTable,
	useDataTableQueryState,
	type DataTableQueryKeys,
} from "@/components/ui/data-table";
import { Form } from "@/components/ui/form";
import { callBackendApiForQuery } from "@/lib/api/callBackendApi";
import { backendApiSchemaRoutes } from "@/lib/api/callBackendApi/apiSchema";
import { handleInventoryDrugActionMutation } from "@/lib/react-query/mutationOptions";
import {
	dashboardOverviewQuery,
	inventoryAlertsQueryKey,
	inventoryAlertsUnreadCountQuery,
	inventoryDrugsListQuery,
	inventorySummaryQuery,
	type InventoryDrugsListQueryResultType,
} from "@/lib/react-query/queryOptions";
import { cnJoin } from "@/lib/utils/cn";

type Drug = InventoryDrugsListQueryResultType["drugs"][number];

const DrugCreateSchema = backendApiSchemaRoutes["@post/inventory/drugs"].body;
const DrugUpdateSchema = backendApiSchemaRoutes["@patch/inventory/drugs/:drugId"].body.required();
type DrugFormValues = z.input<typeof DrugCreateSchema>;

const drugFormInputClassName =
	"h-10 rounded-lg border border-shadcn-border bg-white px-4 focus:border-vitastock-primary-main";

const DRUG_TABLE_QUERY_KEYS = {
	page: "drugPage",
	perPage: "drugPageSize",
	search: "drugSearch",
} as const satisfies DataTableQueryKeys;

export function DrugMasterDialog() {
	const { onPaginationChange, pagination } = useDataTableQueryState({
		queryKeys: DRUG_TABLE_QUERY_KEYS,
	});
	const [search] = useQueryState(DRUG_TABLE_QUERY_KEYS.search, parseAsString.withDefault(""));
	const inventoryDrugsQueryResult = useQuery(
		inventoryDrugsListQuery({
			page: pagination.pageIndex + 1,
			pageSize: pagination.pageSize,
			...(search && { search }),
		})
	);
	const result = inventoryDrugsQueryResult.data;
	const drugs = result?.drugs ?? [];

	const [drugToEdit, setDrugToEdit] = useState<Drug | null>(null);

	const columns = useMemo<Array<ColumnDef<Drug>>>(
		() => [
			{
				accessorFn: (drug) => `${drug.name} ${drug.genericName} ${drug.strength}`,
				cell: ({ row }) => (
					<div>
						<p className="font-bold text-black">{row.original.name}</p>
						<p className="mt-0.5 text-[12px] text-vitastock-body-color">
							{row.original.genericName} / {row.original.strength}
						</p>
					</div>
				),
				enableSorting: false,
				header: ({ column }) => <DataTableColumnHeader column={column}>Drug</DataTableColumnHeader>,
				id: "name",
			},
			{
				accessorKey: "form",
				enableSorting: false,
				header: ({ column }) => (
					<DataTableColumnHeader column={column}>Dosage Form</DataTableColumnHeader>
				),
			},
			{
				accessorKey: "unit",
				enableSorting: false,
				header: ({ column }) => <DataTableColumnHeader column={column}>Unit</DataTableColumnHeader>,
			},
			{
				accessorKey: "isActive",
				cell: ({ row }) => (
					<Badge
						className={cnJoin(
							"border-none px-2 py-0.5 text-[11px] font-bold",
							row.original.isActive && "bg-emerald-50 text-emerald-700",
							!row.original.isActive && "bg-shadcn-muted text-vitastock-body-color"
						)}
					>
						{row.original.isActive ? "Active" : "Inactive"}
					</Badge>
				),
				enableSorting: false,
				header: "Status",
			},
			{
				cell: ({ row }) => (
					<div className="flex justify-end gap-1">
						<Button
							unstyled={true}
							className="grid size-8 place-items-center rounded-lg text-vitastock-primary-main
								hover:bg-vitastock-primary-main/10"
							onClick={() => setDrugToEdit(row.original)}
						>
							<IconBox icon="lucide:pencil" className="size-4" />
							<span className="sr-only">Edit {row.original.name}</span>
						</Button>
						<DrugLifecycleButton drug={row.original} />
					</div>
				),
				enableSorting: false,
				header: () => <span className="block text-right">Actions</span>,
				id: "actions",
			},
		],
		[]
	);

	const table = useDataTable({
		columns,
		data: drugs,
		getRowId: (drug) => drug.id,
		manualPagination: true,
		meta: { queryKeys: DRUG_TABLE_QUERY_KEYS },
		onPaginationChange,
		pageCount: result?.pagination.pageCount ?? 0,
		state: { pagination },
	});

	return (
		<>
			<DialogAnimated.Content
				withCloseButton={false}
				className="flex max-h-[calc(100svh-100px)] max-w-[820px] flex-col gap-0 overflow-hidden
					rounded-xl border-shadcn-border bg-white p-0 shadow-2xl"
			>
				<header
					className="flex items-start justify-between gap-6 border-b border-shadcn-border/70 px-6
						py-5"
				>
					<div className="flex flex-col gap-1">
						<DialogAnimated.Title className="text-[20px] font-extrabold text-black">
							Drug Management
						</DialogAnimated.Title>
						<DialogAnimated.Description className="text-[13px] font-medium text-vitastock-body-color">
							Manage the Drug Master records used across inventory.
						</DialogAnimated.Description>
					</div>
					<DialogAnimated.Close
						className="rounded-lg p-1 text-vitastock-body-color hover:bg-shadcn-muted"
					>
						<IconBox icon="lucide:x" className="size-6" />
						<span className="sr-only">Close</span>
					</DialogAnimated.Close>
				</header>

				<DataTable
					table={table}
					isError={inventoryDrugsQueryResult.isError}
					isLoading={inventoryDrugsQueryResult.isLoading}
					emptyMessage="No Drug Master records found."
					errorMessage="Failed to load Drug Master records."
					totalRows={result?.pagination.total}
					classNames={{
						base: "min-h-0 grow overflow-auto",
						tableCell: "px-6 py-4",
						tableHead: `h-11 px-6 text-[12px] font-bold tracking-wider text-vitastock-body-color/70
						uppercase`,
						tableHeader: "bg-shadcn-muted",
						tableRow: "border-b border-shadcn-border",
					}}
				>
					<DataTableQueryToolbar
						table={table}
						searchPlaceholder="Search drugs..."
						actions={
							<DialogAnimated.Root>
								<DialogAnimated.Trigger asChild={true}>
									<Button className="h-10 rounded-lg px-4">
										<IconBox icon="lucide:plus" className="size-4" />
										Add Drug
									</Button>
								</DialogAnimated.Trigger>
								<CreateDrugDialog />
							</DialogAnimated.Root>
						}
					/>
				</DataTable>
			</DialogAnimated.Content>

			<DialogAnimated.Root
				open={drugToEdit !== null}
				onOpenChange={(isOpen) => !isOpen && setDrugToEdit(null)}
			>
				{drugToEdit && <EditDrugDialog drug={drugToEdit} onComplete={() => setDrugToEdit(null)} />}
			</DialogAnimated.Root>
		</>
	);
}

export function CreateDrugDialog(props: { onComplete?: (drug: Drug) => void }) {
	const { onComplete } = props;
	const dialogContext = useDialogContext();
	const queryClient = useQueryClient();
	const form = useForm<DrugFormValues>({
		defaultValues: {
			form: "",
			genericName: "",
			name: "",
			strength: "",
			unit: "",
		},
		resolver: zodResolver(DrugCreateSchema),
	});

	const onSubmit = form.handleSubmit(async (data) => {
		await callBackendApiForQuery("@post/inventory/drugs", {
			body: data,
			meta: { toast: { success: true } },
			onSuccess: (ctx) => {
				void Promise.all([
					queryClient.invalidateQueries({
						queryKey: inventoryDrugsListQuery().queryKey.slice(0, 2),
					}),
					queryClient.invalidateQueries(inventorySummaryQuery()),
					queryClient.invalidateQueries(dashboardOverviewQuery()),
				]);
				form.reset();
				onComplete?.(ctx.data.data.drug);
				dialogContext.setIsOpen(false);
			},
		});
	});

	return (
		<DrugFormDialog
			description="Create a Drug Master record for stock movements."
			form={form}
			submitLabel="Add Drug"
			title="Add New Drug"
			onSubmit={onSubmit}
		/>
	);
}

export function EditDrugDialog(props: { drug: Drug; onComplete: () => void }) {
	const { drug, onComplete } = props;
	const queryClient = useQueryClient();
	const form = useForm<DrugFormValues>({
		defaultValues: {
			form: drug.form,
			genericName: drug.genericName,
			name: drug.name,
			strength: drug.strength,
			unit: drug.unit,
		},
		resolver: zodResolver(DrugUpdateSchema),
	});

	const onSubmit = form.handleSubmit(async (data) => {
		await callBackendApiForQuery("@patch/inventory/drugs/:drugId", {
			body: data,
			meta: { toast: { success: true } },
			onSuccess: () => {
				void Promise.all([
					queryClient.invalidateQueries({
						queryKey: inventoryDrugsListQuery().queryKey.slice(0, 2),
					}),
					queryClient.invalidateQueries(inventorySummaryQuery()),
					queryClient.invalidateQueries(dashboardOverviewQuery()),
					queryClient.invalidateQueries({ queryKey: inventoryAlertsQueryKey }),
					queryClient.invalidateQueries(inventoryAlertsUnreadCountQuery()),
				]);
				onComplete();
			},
			params: { drugId: drug.id },
		});
	});

	return (
		<DrugFormDialog
			description="Update the Drug Master record used by inventory movements."
			form={form}
			submitLabel="Save Changes"
			title="Edit Drug"
			onSubmit={onSubmit}
		/>
	);
}

function DrugFormDialog(props: {
	description: string;
	form: UseFormReturn<DrugFormValues>;
	onSubmit: (event?: React.BaseSyntheticEvent) => Promise<void>;
	submitLabel: string;
	title: string;
}) {
	const { description, form, onSubmit, submitLabel, title } = props;

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
						{title}
					</DialogAnimated.Title>
					<DialogAnimated.Description className="text-[12px] font-medium text-vitastock-body-color/90">
						{description}
					</DialogAnimated.Description>
				</div>
				<DialogAnimated.Close
					className="rounded-lg p-1 text-vitastock-body-color hover:bg-shadcn-muted"
				>
					<IconBox icon="lucide:x" className="size-6" />
					<span className="sr-only">Close</span>
				</DialogAnimated.Close>
			</header>

			<Form.Root form={form} onSubmit={(event) => void onSubmit(event)}>
				<div className="grid gap-4 p-5 sm:grid-cols-2">
					<Form.Field control={form.control} name="name">
						<Form.Label>Drug Name</Form.Label>
						<Form.Input placeholder="e.g. Coartem" className={drugFormInputClassName} />
					</Form.Field>
					<Form.Field control={form.control} name="genericName">
						<Form.Label>Generic Name</Form.Label>
						<Form.Input
							placeholder="e.g. Artemether/Lumefantrine"
							className={drugFormInputClassName}
						/>
					</Form.Field>
					<Form.Field control={form.control} name="strength">
						<Form.Label>Strength</Form.Label>
						<Form.Input placeholder="e.g. 20mg/120mg" className={drugFormInputClassName} />
					</Form.Field>
					<Form.Field control={form.control} name="form">
						<Form.Label>Dosage Form</Form.Label>
						<Form.Input placeholder="e.g. Tablet" className={drugFormInputClassName} />
					</Form.Field>
					<Form.Field control={form.control} name="unit">
						<Form.Label>Unit</Form.Label>
						<Form.Input placeholder="e.g. Box" className={drugFormInputClassName} />
					</Form.Field>
				</div>

				<DialogAnimated.Footer
					className="flex-row justify-end gap-3 border-t border-shadcn-border/70 bg-shadcn-muted/30
						p-4"
				>
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
								{submitLabel}
							</Button>
						)}
					</Form.Submit>
				</DialogAnimated.Footer>
			</Form.Root>
		</DialogAnimated.Content>
	);
}

function DrugLifecycleButton(props: { drug: Drug }) {
	const { drug } = props;
	const queryClient = useQueryClient();
	const handleInventoryDrugActionMutationResult = useMutation(
		handleInventoryDrugActionMutation({ drugId: drug.id })
	);
	const action = drug.isActive ? "deactivate" : "reactivate";

	const handleAction = () => {
		handleInventoryDrugActionMutationResult.mutate(
			{ action },
			{
				onSuccess: () => {
					void Promise.all([
						queryClient.invalidateQueries({
							queryKey: inventoryDrugsListQuery().queryKey.slice(0, 2),
						}),
						queryClient.invalidateQueries(inventorySummaryQuery()),
						queryClient.invalidateQueries(dashboardOverviewQuery()),
					]);
				},
			}
		);
	};

	return (
		<Button
			unstyled={true}
			isDisabled={handleInventoryDrugActionMutationResult.isPending}
			isLoading={handleInventoryDrugActionMutationResult.isPending}
			loadingStyle="side-by-side"
			className={cnJoin(
				"grid size-8 place-items-center rounded-lg hover:bg-shadcn-muted",
				drug.isActive && "text-shadcn-destructive",
				!drug.isActive && "text-emerald-700"
			)}
			onClick={handleAction}
		>
			<IconBox icon={drug.isActive ? "lucide:archive" : "lucide:refresh-cw"} className="size-4" />
			<span className="sr-only">
				{drug.isActive ? "Deactivate" : "Reactivate"} {drug.name}
			</span>
		</Button>
	);
}
