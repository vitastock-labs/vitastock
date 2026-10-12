"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
	useFieldArray,
	useForm,
	useWatch,
	type Control,
	type FieldPath,
	type UseFormReturn,
} from "react-hook-form";
import type { z } from "zod";
import { useDialogContext } from "@/components/animated/primitives/dialog-radix";
import { DialogAnimated } from "@/components/animated/ui";
import { ForWithWrapper } from "@/components/common/for";
import { IconBox } from "@/components/common/IconBox";
import { Show } from "@/components/common/show";
import { Badge, Empty, ScrollArea } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { callBackendApiForQuery } from "@/lib/api/callBackendApi";
import { backendApiSchemaRoutes, PatientNameSchema } from "@/lib/api/callBackendApi/apiSchema";
import { posthog } from "@/lib/posthog";
import {
	inventoryDrugsQuery,
	inventorySummaryQuery,
	type InventorySummaryQueryResultType,
} from "@/lib/react-query/queryOptions";
import { cnJoin } from "@/lib/utils/cn";
import { formatDate, formatDrugLabel } from "@/lib/utils/formatters";
import {
	ComboboxField,
	FormField,
	InputField,
	SelectField,
} from "@/pages/(home)/-components/FormPartsShared";
import { EMPTY_DISPLAY_VALUE } from "@/pages/(protected)/dashboard/-components/constants";
import { invalidateStockMovementQueries } from "../-utils/invalidateStockMovementQueries";

const DispenseCartSchema = backendApiSchemaRoutes["@post/inventory/stock-log/dispense"].body;
const DispenseCartItemSchema = DispenseCartSchema.shape.items.element;
const DispenseReasonSchema = DispenseCartItemSchema.shape.reason;

type DispenseCartFormValues = z.input<typeof DispenseCartSchema>;
type DispenseCartFormItem = DispenseCartFormValues["items"][number];
type DispenseCartItem = z.output<typeof DispenseCartItemSchema>;
type DispenseCartForm = UseFormReturn<
	DispenseCartFormValues,
	unknown,
	z.output<typeof DispenseCartSchema>
>;

const dispenseReasonLabels = {
	[DispenseReasonSchema.enum.patient]: "Patient dispense",
	[DispenseReasonSchema.enum.ward]: "Ward dispense",
} satisfies Record<z.infer<typeof DispenseReasonSchema>, string>;

const dispenseReasonOptions = DispenseReasonSchema.options.map((reason) => ({
	label: dispenseReasonLabels[reason],
	value: reason,
}));

const getCartItemPatientName = (item: Pick<DispenseCartFormItem, "patientName" | "reason">) => {
	if (item.reason !== DispenseReasonSchema.enum.patient) {
		return null;
	}

	return PatientNameSchema.safeParse(item.patientName).data ?? null;
};

type CartPatientGroup = { indexes: number[]; patientName: string | null };
type PatientNameFieldValues = { patientName?: string | null };

const getCartPatientGroups = (items: DispenseCartFormItem[]) => {
	const groupsByName = new Map<string | null, CartPatientGroup>();

	for (const [index, item] of items.entries()) {
		const patientName = getCartItemPatientName(item);
		const group = groupsByName.get(patientName) ?? { indexes: [], patientName };

		group.indexes.push(index);
		groupsByName.set(patientName, group);
	}

	const namedGroups = groupsByName
		.values()
		.filter((group) => group.patientName !== null)
		.toArray();
	const unnamedGroup = groupsByName.get(null);

	return unnamedGroup ? [...namedGroups, unnamedGroup] : namedGroups;
};

export function DispenseCartDialog(props: {
	children: React.ReactNode;
	onOpenChange: (open: boolean) => void;
	open: boolean;
}) {
	const { children, onOpenChange, open } = props;

	// == Owned here rather than in the dialog content so the cart survives closing and reopening
	const cartForm = useForm({
		defaultValues: { items: [] },
		resolver: zodResolver(DispenseCartSchema),
	});
	const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

	return (
		<DialogAnimated.Root open={open} onOpenChange={onOpenChange}>
			<DialogAnimated.Trigger asChild={true}>{children}</DialogAnimated.Trigger>

			<DispenseCartDialogContent
				cartForm={cartForm}
				idempotencyKey={idempotencyKey}
				onDispensed={() => setIdempotencyKey(crypto.randomUUID())}
			/>
		</DialogAnimated.Root>
	);
}

function DispenseCartDialogContent(props: {
	cartForm: DispenseCartForm;
	idempotencyKey: string;
	onDispensed: () => void;
}) {
	const { cartForm, idempotencyKey, onDispensed } = props;

	const dialogContext = useDialogContext();
	const queryClient = useQueryClient();
	const cartItems = useFieldArray({ control: cartForm.control, name: "items" });
	const watchedCartItems = useWatch({ control: cartForm.control, name: "items" });
	const cartPatientGroups = getCartPatientGroups(watchedCartItems);
	const cartPatientCount = cartPatientGroups.filter((group) => group.patientName !== null).length;
	const isGroupedByPatient = cartPatientCount > 1;

	const renderCartLine = (index: number) => {
		const cartItem = cartItems.fields[index];

		if (!cartItem) {
			return null;
		}

		return (
			<DispenseCartLine
				key={cartItem.id}
				control={cartForm.control}
				drugId={cartItem.drugId}
				index={index}
				onPatientNameChange={(patientName) => changeCartItemPatientName(index, patientName)}
				onRemove={() => cartItems.remove(index)}
			/>
		);
	};

	const addToCart = (item: DispenseCartItem) => {
		const matchingItemIndex = cartForm
			.getValues("items")
			.findIndex(
				(cartItem) =>
					cartItem.drugId === item.drugId
					&& cartItem.reason === item.reason
					&& getCartItemPatientName(cartItem) === getCartItemPatientName(item)
			);

		if (matchingItemIndex === -1) {
			cartItems.append(item, { shouldFocus: false });
			return;
		}

		const matchingQuantity = Number(cartForm.getValues(`items.${matchingItemIndex}.quantity`));

		cartForm.setValue(`items.${matchingItemIndex}.quantity`, matchingQuantity + item.quantity);
	};

	const changeCartItemPatientName = (index: number, patientName: string) => {
		const items = cartForm.getValues("items");
		const item = items[index];

		if (!item) return;

		const nextPatientName = getCartItemPatientName({ ...item, patientName });
		const matchingItemIndex = items.findIndex(
			(cartItem, cartItemIndex) =>
				cartItemIndex !== index
				&& cartItem.drugId === item.drugId
				&& cartItem.reason === item.reason
				&& getCartItemPatientName(cartItem) === nextPatientName
		);
		const matchingItem = items[matchingItemIndex];

		if (!matchingItem) {
			cartForm.setValue(`items.${index}.patientName`, patientName);
			return;
		}

		cartForm.setValue(
			`items.${matchingItemIndex}.quantity`,
			Number(matchingItem.quantity) + Number(item.quantity)
		);
		cartItems.remove(index);
	};

	const onDispenseAll = cartForm.handleSubmit(async (data) => {
		await callBackendApiForQuery("@post/inventory/stock-log/dispense", {
			body: data,
			headers: {
				"x-idempotency-key": idempotencyKey,
			},
			meta: { toast: { success: true } },
			onResponseError: (ctx) => {
				const itemErrors = Object.entries(ctx.error.errorData.errors ?? {});

				for (const [path, messages] of itemErrors) {
					cartForm.setError(path as FieldPath<DispenseCartFormValues>, { message: messages[0] });
				}
			},
			onSuccess: () => {
				posthog?.capture("inventory_dispense_cart_submitted", { item_count: data.items.length });

				void invalidateStockMovementQueries(queryClient);
				cartForm.reset();
				onDispensed();
				dialogContext.setIsOpen(false);
			},
		});
	});

	return (
		<DialogAnimated.Content
			withCloseButton={false}
			className="flex max-h-[calc(100svh-48px)] max-w-[480px] flex-col gap-0 overflow-hidden rounded-lg
				border-shadcn-border bg-shadcn-background p-0"
		>
			<header
				className="flex shrink-0 items-start justify-between gap-6 border-b border-shadcn-border/70
					px-5 py-4"
			>
				<div className="flex flex-col gap-1">
					<div className="flex items-center gap-2">
						<DialogAnimated.Title className="text-[17px] font-extrabold text-shadcn-foreground">
							Dispense Medication
						</DialogAnimated.Title>
						<Show.Root when={cartItems.fields.length > 0}>
							<Badge
								className="border-none bg-vitastock-primary-main/10 px-2 py-0.5 text-[11px]
									font-bold text-vitastock-primary-main"
							>
								{cartItems.fields.length} in queue
							</Badge>
						</Show.Root>
					</div>
					<DialogAnimated.Description className="text-[12px] font-medium text-vitastock-body-color/90">
						Record multiple medications at once.
					</DialogAnimated.Description>
				</div>

				<DialogAnimated.Close
					className="rounded-lg p-1 text-vitastock-body-color hover:bg-shadcn-muted"
				>
					<IconBox icon="lucide:x" className="size-6" />
					<span className="sr-only">Close</span>
				</DialogAnimated.Close>
			</header>

			<ScrollArea.Root
				type="auto"
				classNames={{ base: "grid min-h-0 flex-1", viewport: "h-auto min-h-0" }}
			>
				<div className="flex flex-col gap-5 p-5">
					<DispenseCartEntryForm cartControl={cartForm.control} onAddToCart={addToCart} />

					<article className="flex flex-col gap-3">
						<header className="flex items-center justify-between gap-4">
							<h3 className="flex items-center gap-2 text-[13px] font-bold text-shadcn-foreground">
								Selected medications
								<Badge className="border-none bg-shadcn-muted px-2 text-vitastock-body-color">
									{cartItems.fields.length}
								</Badge>
							</h3>
							<Show.Root when={cartItems.fields.length > 0}>
								<p className="text-right text-[12px] text-vitastock-body-color">
									{isGroupedByPatient && `${cartPatientCount} patients · `}
									Review before dispensing
								</p>
							</Show.Root>
						</header>

						<Show.Root when={cartItems.fields.length > 0}>
							<Form.Root
								form={cartForm}
								id="dispense-cart"
								onSubmit={(event) => void onDispenseAll(event)}
							>
								<Show.Root when={isGroupedByPatient}>
									<ForWithWrapper
										className="flex flex-col gap-3"
										each={cartPatientGroups}
										renderItem={(group) => (
											<li key={group.patientName ?? ""} className="flex flex-col gap-1.5">
												<CartPatientGroupHeader
													itemCount={group.indexes.length}
													patientName={group.patientName}
												/>
												<ForWithWrapper
													as="ul"
													className="flex flex-col gap-2"
													each={group.indexes}
													renderItem={renderCartLine}
												/>
											</li>
										)}
									/>

									<Show.Fallback>
										<ForWithWrapper
											as="ul"
											className="flex flex-col gap-2"
											each={cartItems.fields}
											renderItem={(_cartItem, index) => renderCartLine(index)}
										/>
									</Show.Fallback>
								</Show.Root>
							</Form.Root>

							<Show.Fallback>
								<Empty.Root
									className="gap-1 rounded-lg border border-dashed border-shadcn-border p-6"
								>
									<Empty.Header className="gap-1">
										<Empty.Media className="mb-1 text-vitastock-body-color/70">
											<IconBox icon="lucide:shopping-cart" className="size-5" />
										</Empty.Media>
										<Empty.Title className="text-[13px] font-medium text-shadcn-foreground">
											No medications added yet
										</Empty.Title>
										<Empty.Description className="text-[12px] text-vitastock-body-color">
											Enter medication details above to build your dispense cart.
										</Empty.Description>
									</Empty.Header>
								</Empty.Root>
							</Show.Fallback>
						</Show.Root>
					</article>
				</div>
			</ScrollArea.Root>

			<DialogAnimated.Footer
				className="shrink-0 flex-row justify-end gap-3 border-t border-shadcn-border/70
					bg-shadcn-muted/30 p-4 *:flex-1 md:*:flex-none"
			>
				<DialogAnimated.Close asChild={true}>
					<Button theme="primary-ghost" className="h-10 px-4">
						Cancel
					</Button>
				</DialogAnimated.Close>

				<Form.Submit asChild={true} control={cartForm.control}>
					{(formState) => (
						<Button
							form="dispense-cart"
							isDisabled={formState.isSubmitting || cartItems.fields.length === 0}
							isLoading={formState.isSubmitting}
							className="h-10 px-4"
						>
							<IconBox icon="lucide:clipboard-list" className="size-4" />
							Dispense All
							{cartItems.fields.length > 0 && ` · ${cartItems.fields.length}`}
						</Button>
					)}
				</Form.Submit>
			</DialogAnimated.Footer>
		</DialogAnimated.Content>
	);
}

function DispenseCartEntryForm(props: {
	cartControl: Control<DispenseCartFormValues>;
	onAddToCart: (item: DispenseCartItem) => void;
}) {
	const { cartControl, onAddToCart } = props;

	const inventoryDrugsQueryResult = useQuery(inventoryDrugsQuery());
	const drugOptions = (inventoryDrugsQueryResult.data?.drugs ?? [])
		.filter((drug) => drug.isActive)
		.map((drug) => ({
			label: formatDrugLabel(drug, { includeGenericName: true }),
			value: drug.id,
		}));

	const entryForm = useForm({
		defaultValues: {
			drugId: "",
			patientName: "",
			quantity: "",
			reason: DispenseReasonSchema.enum.patient,
		},
		resolver: zodResolver(DispenseCartItemSchema),
	});

	const onSubmit = entryForm.handleSubmit((item) => {
		const patientNameInput = entryForm.getValues("patientName");

		onAddToCart({ ...item, patientName: getCartItemPatientName(item) });

		// == Focus before resetting, since reset() re-registers fields and drops the refs setFocus relies on
		entryForm.setFocus("drugId");
		entryForm.reset({
			drugId: "",
			patientName: patientNameInput,
			quantity: "",
			reason: DispenseReasonSchema.enum.patient,
		});
	});

	return (
		<Form.Root
			form={entryForm}
			className="flex flex-col gap-4 rounded-lg border border-shadcn-border/70 bg-shadcn-muted/30 p-4"
			onSubmit={(event) => void onSubmit(event)}
		>
			<Form.Watch control={entryForm.control} name="reason">
				{(reason) => (
					<Show.Root when={reason === DispenseReasonSchema.enum.patient}>
						<PatientNameField
							control={entryForm.control}
							onEnter={() => entryForm.setFocus("drugId")}
						/>
					</Show.Root>
				)}
			</Form.Watch>

			<ComboboxField
				control={entryForm.control}
				name="drugId"
				label="Drug / Medication"
				required={true}
				data={drugOptions}
				type="drug"
				disabled={inventoryDrugsQueryResult.isLoading}
				classNames={{ list: "max-h-52" }}
			/>

			<div className="grid gap-4 sm:grid-cols-2">
				<InputField
					control={entryForm.control}
					name="quantity"
					type="number"
					label="Quantity"
					required={true}
					placeholder="e.g. 10"
				/>

				<SelectField
					control={entryForm.control}
					name="reason"
					label="Reason"
					options={dispenseReasonOptions}
				/>
			</div>

			<Form.Watch control={entryForm.control} name={["drugId", "quantity"]}>
				{([drugId, quantity]) => (
					<DispenseEntryGuidance cartControl={cartControl} drugId={drugId} quantity={quantity} />
				)}
			</Form.Watch>

			<Button type="submit" theme="primary-outline" className="h-10 w-full">
				<IconBox icon="lucide:plus" className="size-4" />
				Add Medication
			</Button>
		</Form.Root>
	);
}

function PatientNameField(props: {
	control: Control<z.input<typeof DispenseCartItemSchema>>;
	onEnter: () => void;
}) {
	const { control, onEnter } = props;

	return (
		<FormField
			control={control}
			name="patientName"
			label={
				<>
					Patient Name
					<span className="font-normal text-vitastock-body-color/70">(optional)</span>
				</>
			}
		>
			<Form.FieldBoundController<PatientNameFieldValues>
				render={({ field }) => (
					<div
						className="flex h-10 items-center gap-2 rounded-lg border border-shadcn-border
							bg-shadcn-background px-3 focus-within:border-vitastock-primary-main
							focus-within:ring-1 focus-within:ring-vitastock-primary-main"
					>
						<IconBox icon="lucide:user" className="size-3.5 shrink-0 text-vitastock-body-color" />
						<input
							ref={field.ref}
							name={field.name}
							value={field.value ?? ""}
							placeholder="e.g. Mrs. Adebayo"
							maxLength={120}
							autoComplete="off"
							className="min-w-0 flex-1 bg-transparent text-[16px] font-medium
								text-shadcn-foreground outline-none placeholder:font-normal
								placeholder:text-vitastock-body-color/60 md:text-[14px]"
							onBlur={field.onBlur}
							onChange={field.onChange}
							onKeyDown={(event) => {
								if (event.key !== "Enter") return;

								event.preventDefault();
								onEnter();
							}}
						/>
						<Show.Root when={Boolean(field.value)}>
							<Button
								unstyled={true}
								className="grid size-5 shrink-0 place-items-center rounded-full bg-shadcn-muted
									text-vitastock-body-color/80 hover:text-shadcn-foreground"
								aria-label="Clear patient name"
								onClick={() => field.onChange("")}
							>
								<IconBox icon="lucide:x" className="size-3" />
							</Button>
						</Show.Root>
					</div>
				)}
			/>
			<p className="text-[11px] font-medium text-vitastock-body-color/70">
				Stays filled for the next medication. Change it to start a new patient.
			</p>
		</FormField>
	);
}

function DispenseEntryGuidance(props: {
	cartControl: Control<DispenseCartFormValues>;
	drugId: string;
	quantity: unknown;
}) {
	const { cartControl, drugId, quantity } = props;

	const inventorySummaryQueryResult = useQuery(inventorySummaryQuery());
	const inventoryRow = inventorySummaryQueryResult.data?.rows.find((row) => row.drugId === drugId);

	if (!inventoryRow) {
		return null;
	}

	const unit = inventoryRow.drug.unit ?? EMPTY_DISPLAY_VALUE;

	return (
		<Form.Watch control={cartControl} name="items">
			{(cartItems) => {
				const quantityInCart = cartItems
					.filter((cartItem) => cartItem.drugId === drugId)
					.reduce((total, cartItem) => total + Number(cartItem.quantity), 0);
				const exceedsAvailableStock = quantityInCart + Number(quantity) > inventoryRow.totalAvailable;

				return (
					<>
						<Show.Root when={exceedsAvailableStock}>
							<p
								role="alert"
								className="rounded-lg border border-red-300 bg-red-100/60 p-3 text-[12px]
									font-medium text-red-700"
							>
								Only {inventoryRow.totalAvailable.toLocaleString()} {unit} available
								{quantityInCart > 0 && `, ${quantityInCart.toLocaleString()} already in the cart`}.
							</p>
						</Show.Root>

						<Show.Root
							when={inventoryRow.usableBatchCount > 1 && Boolean(inventoryRow.nearestBatch)}
						>
							<FefoBatchNotice inventoryRow={inventoryRow} quantity={Number(quantity)} />
						</Show.Root>
					</>
				);
			}}
		</Form.Watch>
	);
}

function FefoBatchNotice(props: {
	inventoryRow: InventorySummaryQueryResultType["rows"][number];
	quantity: number;
}) {
	const { inventoryRow, quantity } = props;
	const { nearestBatch } = inventoryRow;

	if (!nearestBatch) {
		return null;
	}

	const hasDifferentExpiryDates = inventoryRow.usableExpiryDateCount > 1;

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
					Use {nearestBatch.batchNumber ?? "the unnumbered batch"} first. It expires on{" "}
					{formatDate(nearestBatch.expiryDate)} and contains {nearestBatch.quantityAvailable}{" "}
					{inventoryRow.drug.unit ?? EMPTY_DISPLAY_VALUE}.
				</p>
				<p>VitaStock will deduct from the earliest-expiring batches automatically.</p>
				{quantity > nearestBatch.quantityAvailable && (
					<p className="font-semibold text-shadcn-foreground">
						The entered quantity exceeds this batch, so the remaining quantity will continue from the
						next eligible batch.
					</p>
				)}
			</div>
		</aside>
	);
}

function DispenseCartLine(props: {
	control: Control<DispenseCartFormValues>;
	drugId: string;
	index: number;
	onPatientNameChange: (patientName: string) => void;
	onRemove: () => void;
}) {
	const { control, drugId, index, onPatientNameChange, onRemove } = props;

	const inventoryDrugsQueryResult = useQuery(inventoryDrugsQuery());
	const drug = inventoryDrugsQueryResult.data?.drugs.find((item) => item.id === drugId);

	return (
		<li className="flex items-start gap-3 rounded-lg border border-shadcn-border p-3">
			<div className="flex min-w-0 flex-1 flex-col gap-2">
				<div className="min-w-0">
					<p className="truncate text-[14px] font-bold text-shadcn-foreground">
						{drug ? formatDrugLabel(drug) : EMPTY_DISPLAY_VALUE}
					</p>
					<div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
						<p className="truncate text-[12px] text-vitastock-body-color">
							{drug?.genericName ?? EMPTY_DISPLAY_VALUE}
						</p>
						<CartLinePatientName
							control={control}
							index={index}
							onPatientNameChange={onPatientNameChange}
						/>
					</div>
				</div>

				<div className="grid grid-cols-[96px_minmax(0,1fr)] items-start gap-2">
					<InputField
						control={control}
						name={`items.${index}.quantity`}
						type="number"
						placeholder="Qty"
						classNames={{ input: "h-9 px-3" }}
					/>
					<SelectField
						control={control}
						name={`items.${index}.reason`}
						options={dispenseReasonOptions}
						classNames={{ trigger: "h-9 px-3 text-[13px]" }}
					/>
				</div>
			</div>

			<Button
				unstyled={true}
				className="grid size-8 shrink-0 place-items-center rounded-md text-vitastock-body-color
					hover:bg-shadcn-muted hover:text-shadcn-destructive"
				aria-label={`Remove ${drug?.name ?? "medication"} from the cart`}
				onClick={onRemove}
			>
				<IconBox icon="lucide:x" className="size-4" />
			</Button>
		</li>
	);
}

function CartPatientGroupHeader(props: { itemCount: number; patientName: string | null }) {
	const { itemCount, patientName } = props;

	return (
		<h4 className="flex min-w-0 items-center gap-1.5 pt-1 pl-0.5">
			<IconBox
				icon={patientName ? "lucide:user" : "lucide:user-round-x"}
				className={cnJoin(
					"size-3.5 shrink-0",
					patientName ? "text-vitastock-primary-main" : "text-vitastock-body-color"
				)}
			/>
			<span className="truncate text-[12px] font-bold text-shadcn-foreground">
				{patientName ?? "No patient name"}
			</span>
			<span className="shrink-0 text-[11px] font-medium text-vitastock-body-color">
				· {itemCount} {itemCount === 1 ? "item" : "items"}
			</span>
		</h4>
	);
}

function CartLinePatientName(props: {
	control: Control<DispenseCartFormValues>;
	index: number;
	onPatientNameChange: (patientName: string) => void;
}) {
	const { control, index, onPatientNameChange } = props;

	const [draftPatientName, setDraftPatientName] = useState<string | null>(null);
	const cartItem = useWatch({ control, name: `items.${index}` });

	const commitDraftPatientName = () => {
		if (draftPatientName === null) return;

		setDraftPatientName(null);
		onPatientNameChange(draftPatientName);
	};

	if (draftPatientName !== null) {
		return (
			<input
				ref={(node) => node?.focus()}
				value={draftPatientName}
				aria-label="Patient name for this medication"
				placeholder="Patient name"
				maxLength={120}
				autoComplete="off"
				className="h-6 w-40 rounded-md border border-vitastock-primary-main bg-shadcn-background px-2
					text-[16px] font-semibold text-vitastock-primary-main outline-none md:text-[12px]"
				onChange={(event) => setDraftPatientName(event.target.value)}
				onBlur={commitDraftPatientName}
				onKeyDown={(event) => {
					if (event.key !== "Enter") return;

					event.preventDefault();
					commitDraftPatientName();
				}}
			/>
		);
	}

	const patientName = getCartItemPatientName(cartItem);

	if (!patientName) {
		return null;
	}

	return (
		<Button
			unstyled={true}
			className="inline-flex max-w-full min-w-0 items-center gap-1 rounded-sm border
				border-vitastock-primary-main/15 bg-vitastock-primary-main/10 px-1.5 py-px text-[11px]
				font-semibold text-vitastock-primary-main hover:bg-vitastock-primary-main/15"
			aria-label={`Edit patient name ${patientName}`}
			onClick={() => setDraftPatientName(patientName)}
		>
			<IconBox icon="lucide:user" className="size-2.5 shrink-0" />
			<span className="truncate">{patientName}</span>
		</Button>
	);
}
