"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { parseAsString, useQueryState } from "nuqs";
import { useMemo, useState } from "react";
import { useForm, useFormContext, type FieldValues, type UseFormReturn } from "react-hook-form";
import { useDialogContext } from "@/components/animated/primitives/dialog-radix";
import { DialogAnimated } from "@/components/animated/ui";
import { IconBox } from "@/components/common/IconBox";
import { Badge } from "@/components/ui";
import { Button } from "@/components/ui/button";
import {
	createDataTableColumnHelper,
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
	inventoryAlertsQuery,
	inventoryAlertsUnreadCountQuery,
	inventoryDrugsQuery,
	inventorySummaryQuery,
	type InventoryDrugsQueryResultType,
} from "@/lib/react-query/queryOptions";
import { cnJoin } from "@/lib/utils/cn";
import { formatDrugLabel } from "@/lib/utils/formatters";
import { InputField } from "@/pages/(home)/-components/FormPartsShared";
import { EMPTY_DISPLAY_VALUE } from "./constants";
import { DashboardDataTable } from "./DashboardDataTableShared";

type Drug = InventoryDrugsQueryResultType["drugs"][number];

const EMPTY_DRUGS: Drug[] = [];
const drugColumnHelper = createDataTableColumnHelper<Drug>();

const DrugCreateSchema = backendApiSchemaRoutes["@post/inventory/drugs"].body;
const DrugUpdateSchema = backendApiSchemaRoutes["@patch/inventory/drugs/:drugId"].body.required();
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
		inventoryDrugsQuery({
			page: pagination.pageIndex + 1,
			pageSize: pagination.pageSize,
			...(search && { search }),
		})
	);
	const result = inventoryDrugsQueryResult.data;
	const drugs = result?.drugs ?? EMPTY_DRUGS;

	const [drugToEdit, setDrugToEdit] = useState<Drug | null>(null);

	const columns = useMemo(
		() =>
			drugColumnHelper.columns([
				drugColumnHelper.accessor(
					(drug) => formatDrugLabel(drug, { includeGenericName: true }),
					{
						cell: ({ row }) => (
							<div>
								<p className="font-bold text-black">{row.original.name}</p>
								<p className="mt-0.5 text-[12px] text-vitastock-body-color">
									{row.original.genericName} / {row.original.strength ?? EMPTY_DISPLAY_VALUE}
								</p>
							</div>
						),
						enableSorting: false,
						header: ({ column }) => (
							<DataTableColumnHeader column={column}>Drug</DataTableColumnHeader>
						),
						id: "name",
					}
				),
				drugColumnHelper.accessor("form", {
					cell: ({ getValue }) => getValue() ?? EMPTY_DISPLAY_VALUE,
					enableSorting: false,
					header: ({ column }) => (
						<DataTableColumnHeader column={column}>Dosage Form</DataTableColumnHeader>
					),
				}),
				drugColumnHelper.accessor("unit", {
					cell: ({ getValue }) => getValue() ?? EMPTY_DISPLAY_VALUE,
					enableSorting: false,
					header: ({ column }) => <DataTableColumnHeader column={column}>Unit</DataTableColumnHeader>,
				}),
				drugColumnHelper.accessor("isActive", {
					cell: ({ getValue }) => (
						<Badge
							className={cnJoin(
								"border-none px-2 py-0.5 text-[11px] font-bold",
								getValue() && "bg-emerald-50 text-emerald-700",
								!getValue() && "bg-shadcn-muted text-vitastock-body-color"
							)}
						>
							{getValue() ? "Active" : "Inactive"}
						</Badge>
					),
					enableSorting: false,
					header: "Status",
				}),
				drugColumnHelper.display({
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
				}),
			]),
		[]
	);

	const table = useDataTable({
		columns,
		data: drugs,
		getRowId: (drug) => drug.id,
		manualPagination: true,
		meta: { queryKeys: DRUG_TABLE_QUERY_KEYS },
		onPaginationChange,
		rowCount: result?.pagination?.total ?? 0,
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

				<DashboardDataTable
					table={table}
					isError={inventoryDrugsQueryResult.isError}
					isLoading={inventoryDrugsQueryResult.isLoading}
					emptyMessage="No Drug Master records found."
					errorMessage="Failed to load Drug Master records."
					totalRows={result?.pagination?.total}
					classNames={{
						base: "min-h-0 grow overflow-auto",
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
				</DashboardDataTable>
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

export function CreateDrugDialog(props: { initialName?: string; onComplete?: (drug: Drug) => void }) {
	const { initialName = "", onComplete } = props;
	const dialogContext = useDialogContext();
	const queryClient = useQueryClient();
	const form = useForm({
		defaultValues: {
			form: "",
			genericName: "",
			name: initialName,
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
						queryKey: inventoryDrugsQuery().queryKey.slice(0, -1),
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
	const form = useForm({
		defaultValues: {
			form: drug.form ?? "",
			genericName: drug.genericName,
			name: drug.name,
			strength: drug.strength ?? "",
			unit: drug.unit ?? "",
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
						queryKey: inventoryDrugsQuery().queryKey.slice(0, -1),
					}),
					queryClient.invalidateQueries(inventorySummaryQuery()),
					queryClient.invalidateQueries(dashboardOverviewQuery()),
					queryClient.invalidateQueries({ queryKey: inventoryAlertsQuery().queryKey.slice(0, -1) }),
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

function DrugFormDialog<TFieldValues extends FieldValues, TTransformedValues extends FieldValues>(props: {
	description: string;
	form: UseFormReturn<TFieldValues, unknown, TTransformedValues>;
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
				<DrugFormFields />

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

function DrugFormFields() {
	const form = useFormContext();

	return (
		<div className="grid gap-4 p-5 sm:grid-cols-2">
			<InputField
				control={form.control}
				name="name"
				label="Drug Name"
				placeholder="e.g. Coartem"
				required={true}
			/>
			<InputField
				control={form.control}
				name="genericName"
				label="Generic Name"
				placeholder="e.g. Artemether/Lumefantrine"
				required={true}
			/>
			<InputField
				control={form.control}
				name="strength"
				label="Strength (Optional)"
				placeholder="e.g. 20mg/120mg"
			/>
			<InputField
				control={form.control}
				name="form"
				label="Dosage Form (Optional)"
				placeholder="e.g. Tablet"
			/>
			<InputField control={form.control} name="unit" label="Unit (Optional)" placeholder="e.g. Box" />
		</div>
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
							queryKey: inventoryDrugsQuery().queryKey.slice(0, -1),
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
