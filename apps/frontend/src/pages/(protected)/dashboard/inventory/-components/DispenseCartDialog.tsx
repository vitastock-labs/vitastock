"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useConstant } from "@zayne-labs/toolkit-react";
import { differenceInMilliseconds } from "date-fns";
import { useEffect, useState } from "react";
import {
	useFieldArray,
	useForm,
	useWatch,
	type Control,
	type FieldPath,
	type UseFormReturn,
} from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { useDialogContext } from "@/components/animated/primitives/dialog-radix";
import { DialogAnimated } from "@/components/animated/ui";
import { For, ForWithWrapper } from "@/components/common/for";
import { IconBox } from "@/components/common/IconBox";
import { Show } from "@/components/common/show";
import { Badge, Empty, ScrollArea } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { callBackendApiForQuery } from "@/lib/api/callBackendApi";
import {
	backendApiSchemaRoutes,
	PatientNameSchema,
	PaymentMethodSchema,
	SaleTypeSchema,
} from "@/lib/api/callBackendApi/apiSchema";
import { posthog } from "@/lib/posthog";
import { undoInventoryDispenseMutation } from "@/lib/react-query/mutationOptions";
import {
	inventoryDrugsQuery,
	inventorySummaryQuery,
	type InventoryDrugsQueryResultType,
	type InventorySummaryQueryResultType,
} from "@/lib/react-query/queryOptions";
import { cnJoin } from "@/lib/utils/cn";
import { formatDate, formatDrugLabel, formatNaira } from "@/lib/utils/formatters";
import { ComboboxField, FormField, InputField } from "@/pages/(home)/-components/FormPartsShared";
import { EMPTY_DISPLAY_VALUE } from "@/pages/(protected)/dashboard/-components/constants";
import { invalidateStockMovementQueries } from "../../-utils/invalidateStockMovementQueries";

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

const getCartItemPatientName = (item: Pick<DispenseCartFormItem, "patientName"> | undefined) => {
	return PatientNameSchema.safeParse(item?.patientName).data ?? null;
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

	const namedGroups = [...groupsByName.values()].filter((group) => group.patientName !== null);

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
		defaultValues: { items: [], saleType: SaleTypeSchema.enum.retail },
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
	// == Options-level onSuccess still runs after this content unmounts, unlike mutate() callbacks
	const undoDispenseMutationResult = useMutation({
		...undoInventoryDispenseMutation(),
		onSuccess: () => invalidateStockMovementQueries(queryClient),
	});

	const openedAt = useConstant(() => new Date());

	useEffect(() => {
		posthog?.capture("dispense_opened");
	}, []);
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
				isGroupedByPatient={isGroupedByPatient}
				onPatientNameChange={(patientName) => changeCartItemPatientName(index, patientName)}
				onRemove={() => cartItems.remove(index)}
			/>
		);
	};

	const addToCart = (item: DispenseCartItem, drug: CartDrug | undefined) => {
		if (
			drug?.wholesalePrice === null
			&& cartForm.getValues("saleType") === SaleTypeSchema.enum.wholesale
		) {
			cartForm.setValue("saleType", SaleTypeSchema.enum.retail);
		}

		const matchingItemIndex = cartForm
			.getValues("items")
			.findIndex(
				(cartItem) =>
					cartItem.drugId === item.drugId
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

	const onSubmit = cartForm.handleSubmit(async (data) => {
		await callBackendApiForQuery("@post/inventory/stock-log/dispense", {
			body: data,
			headers: {
				"x-idempotency-key": idempotencyKey,
			},
			onResponseError: (ctx) => {
				const itemErrors = Object.entries(ctx.error.errorData.errors ?? {});

				for (const [path, messages] of itemErrors) {
					cartForm.setError(path as FieldPath<DispenseCartFormValues>, { message: messages[0] });
				}
			},
			onSuccess: (ctx) => {
				const { stockTransactionId, undoExpiresAt } = ctx.data.data;
				const savedAt = new Date();

				posthog?.capture("inventory_dispense_cart_submitted", { item_count: data.items.length });
				posthog?.capture("dispense_saved", {
					duration_ms: differenceInMilliseconds(savedAt, openedAt),
					item_count: data.items.length,
				});

				const undoWindowMs = differenceInMilliseconds(undoExpiresAt, savedAt);

				if (undoWindowMs <= 0) {
					toast.success(ctx.data.message);
				} else {
					toast.success(ctx.data.message, {
						action: {
							label: "Undo",
							onClick: () => {
								undoDispenseMutationResult.mutate({ stockTransactionId });
							},
						},
						duration: undoWindowMs,
					});
				}

				void invalidateStockMovementQueries(queryClient);
				// == Clear through the field array: reset() lets the still-mounted lines re-register blank items
				cartItems.remove();
				cartForm.resetField("saleType");
				cartForm.resetField("paymentMethod");
				cartForm.resetField("notes");
				onDispensed();
				dialogContext.setIsOpen(false);
			},
		});
	});

	return (
		<DialogAnimated.Content
			withCloseButton={false}
			className="flex max-h-[calc(100svh-48px)] max-w-[480px] flex-col gap-0 overflow-hidden rounded-lg
				border-shadcn-border bg-shadcn-background p-0 lg:max-w-[960px]"
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
						{cartItems.fields.length > 0 && (
							<Badge
								className="border-none bg-vitastock-primary-main/10 px-2 py-0.5 text-[11px]
									font-bold text-vitastock-primary-main"
							>
								{cartItems.fields.length} in queue
							</Badge>
						)}
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
				<div className="grid grid-cols-1 gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
					<DispenseCartEntryForm cartControl={cartForm.control} onAddToCart={addToCart} />

					<Form.Root
						form={cartForm}
						id="dispense-cart"
						className="contents"
						onSubmit={(event) => void onSubmit(event)}
					>
						<article className="flex flex-col gap-3 lg:col-start-1">
							<header className="flex items-center justify-between gap-4">
								<h3
									className="flex items-center gap-2 text-[13px] font-bold text-shadcn-foreground"
								>
									Selected medications
									<Show.Root when={cartItems.fields.length > 0}>
										<Badge className="border-none bg-shadcn-muted px-2 text-vitastock-body-color">
											{cartItems.fields.length}
										</Badge>

										<Show.Fallback>
											<span className="text-[12px] font-medium text-vitastock-body-color/70">
												· 0 items
											</span>
										</Show.Fallback>
									</Show.Root>
								</h3>
								{cartItems.fields.length > 0 && (
									<p className="text-right text-[12px] text-vitastock-body-color">
										{isGroupedByPatient && `${cartPatientCount} patients · `}
										Review before dispensing
									</p>
								)}
							</header>

							<Show.Root when={cartItems.fields.length > 0}>
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

						<DispenseCartCheckout control={cartForm.control} />
					</Form.Root>
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
	onAddToCart: (item: DispenseCartItem, drug: CartDrug | undefined) => void;
}) {
	const { cartControl, onAddToCart } = props;

	const hasCartItems = useWatch({ control: cartControl, name: "items" }).length > 0;

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

		onAddToCart(
			{ ...item, patientName: getCartItemPatientName(item) },
			findCartDrug(inventoryDrugsQueryResult.data?.drugs, item.drugId)
		);

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
			<PatientNameField control={entryForm.control} onEnter={() => entryForm.setFocus("drugId")} />

			<ComboboxField
				control={entryForm.control}
				name="drugId"
				label={
					<>
						Drug / Medication
						<span className="text-shadcn-destructive" aria-hidden={true}>
							*
						</span>
						{hasCartItems && (
							<span
								className="ml-auto flex items-center gap-1.5 text-[11px] font-medium
									text-vitastock-primary-main"
							>
								<span className="size-1.5 rounded-full bg-emerald-500" />
								Ready for next item
							</span>
						)}
					</>
				}
				data={drugOptions}
				type="drug"
				disabled={inventoryDrugsQueryResult.isLoading}
				classNames={{ label: "w-full", list: "max-h-52" }}
			/>

			<InputField
				control={entryForm.control}
				name="quantity"
				type="number"
				label="Quantity"
				required={true}
				placeholder="e.g. 10"
			/>

			<Form.Watch control={entryForm.control} name={["drugId", "quantity"]}>
				{([drugId, quantity]) => (
					<DispenseEntryGuidance cartControl={cartControl} drugId={drugId} quantity={quantity} />
				)}
			</Form.Watch>

			<Button
				type="submit"
				theme="primary-outline"
				className={cnJoin(
					"h-10 w-full",
					hasCartItems
						&& "border-transparent bg-vitastock-primary-main/10 hover:bg-vitastock-primary-main/15"
				)}
			>
				<IconBox icon="lucide:plus" className="size-4" />
				{hasCartItems ? "Add Medication" : "Add to Dispense List"}
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
						{Boolean(field.value) && (
							<Button
								unstyled={true}
								className="grid size-5 shrink-0 place-items-center rounded-full bg-shadcn-muted
									text-vitastock-body-color/80 hover:text-shadcn-foreground"
								aria-label="Clear patient name"
								onClick={() => field.onChange("")}
							>
								<IconBox icon="lucide:x" className="size-3" />
							</Button>
						)}
					</div>
				)}
			/>
			<Form.Watch control={control} name="patientName">
				{(patientName) => (
					<p className="text-[11px] font-medium text-vitastock-body-color/70">
						{patientName ?
							"Stays filled for the next medication. Change it to start a new patient."
						:	"Leave blank if not needed. It stays filled as you add medications."}
					</p>
				)}
			</Form.Watch>
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
						{exceedsAvailableStock && (
							<p
								role="alert"
								className="rounded-lg border border-red-300 bg-red-100/60 p-3 text-[12px]
									font-medium text-red-700"
							>
								Only {inventoryRow.totalAvailable.toLocaleString()} {unit} available
								{quantityInCart > 0 && `, ${quantityInCart.toLocaleString()} already in the cart`}.
							</p>
						)}

						{inventoryRow.usableBatchCount > 1 && Boolean(inventoryRow.nearestBatch) && (
							<FefoBatchNotice inventoryRow={inventoryRow} quantity={Number(quantity)} />
						)}
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
	isGroupedByPatient: boolean;
	onPatientNameChange: (patientName: string) => void;
	onRemove: () => void;
}) {
	const { control, drugId, index, isGroupedByPatient, onPatientNameChange, onRemove } = props;

	const inventoryDrugsQueryResult = useQuery(inventoryDrugsQuery());
	const drug = inventoryDrugsQueryResult.data?.drugs.find((item) => item.id === drugId);

	return (
		<li className="flex flex-col gap-2 rounded-lg border border-shadcn-border p-3">
			<div className="flex items-start gap-3">
				<div className="flex min-w-0 flex-1 flex-col gap-1">
					<p className="flex min-w-0 items-baseline gap-1.5">
						<span className="truncate text-[14px] font-bold text-shadcn-foreground">
							{drug?.name ?? EMPTY_DISPLAY_VALUE}
						</span>
						{drug?.strength && (
							<span className="shrink-0 text-[11px] text-vitastock-body-color">
								{drug.strength}
							</span>
						)}
					</p>
					<div className="flex min-w-0 flex-wrap items-center gap-1.5">
						<span
							className="rounded-sm bg-shadcn-muted px-1.5 py-px text-[11px] font-medium
								text-vitastock-body-color"
						>
							Patient
						</span>
						{!isGroupedByPatient && (
							<CartLinePatientName
								control={control}
								index={index}
								onPatientNameChange={onPatientNameChange}
							/>
						)}
					</div>
				</div>

				<FormField
					control={control}
					name={`items.${index}.quantity`}
					classNames={{ base: "w-[84px] shrink-0" }}
				>
					<div
						className="flex h-8 items-center gap-1.5 rounded-md border border-shadcn-border/70
							bg-shadcn-muted/40 px-2 focus-within:border-vitastock-primary-main"
					>
						<span className="text-[11px] text-vitastock-body-color" aria-hidden={true}>
							Qty
						</span>
						<Form.Input
							type="number"
							min={1}
							aria-label={`Quantity of ${drug?.name ?? "this medication"}`}
							classNames={{
								input: `min-w-0 flex-1 bg-transparent text-[16px] font-bold text-shadcn-foreground
								outline-none md:text-[14px]`,
							}}
						/>
					</div>
				</FormField>

				<Button
					unstyled={true}
					className="grid size-8 shrink-0 place-items-center rounded-md text-vitastock-body-color/70
						hover:bg-shadcn-muted hover:text-shadcn-destructive"
					aria-label={`Remove ${drug?.name ?? "medication"} from the cart`}
					onClick={onRemove}
				>
					<IconBox icon="lucide:x" className="size-4" />
				</Button>
			</div>

			<Form.Watch control={control} name={[`items.${index}.quantity`, "saleType"]}>
				{([quantity, saleType]) => (
					<CartLinePrice
						quantity={Number(quantity)}
						unitPrice={drug ? getSellingPrice(drug, saleType) : null}
						unit={drug?.unit ?? null}
					/>
				)}
			</Form.Watch>
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
			<Form.InputPrimitive
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

type CartDrug = NonNullable<ReturnType<typeof findCartDrug>>;

const findCartDrug = (drugs: InventoryDrugsQueryResultType["drugs"] | undefined, drugId: string) =>
	drugs?.find((drug) => drug.id === drugId);

const getSellingPrice = (
	drug: Pick<CartDrug, "retailPrice" | "wholesalePrice">,
	saleType: DispenseCartFormValues["saleType"]
) => (saleType === SaleTypeSchema.enum.wholesale ? drug.wholesalePrice : drug.retailPrice);

function CartLinePrice(props: { quantity: number; unit: string | null; unitPrice: number | null }) {
	const { quantity, unit, unitPrice } = props;

	if (unitPrice === null) {
		return <p className="text-[12px] font-medium text-amber-700">No price set</p>;
	}

	return (
		<p className="text-[12px] text-vitastock-body-color">
			{formatNaira(unitPrice)} per {unit ?? "unit"}
			{quantity > 0 && (
				<>
					{" · "}
					<span className="font-bold text-shadcn-foreground">
						{formatNaira(unitPrice * quantity)}
					</span>
				</>
			)}
		</p>
	);
}

const saleTypeLabels = {
	[SaleTypeSchema.enum.retail]: "Retail",
	[SaleTypeSchema.enum.wholesale]: "Wholesale",
} satisfies Record<z.infer<typeof SaleTypeSchema>, string>;

const paymentMethodLabels = {
	[PaymentMethodSchema.enum.cash]: "Cash",
	[PaymentMethodSchema.enum.pos]: "POS",
	[PaymentMethodSchema.enum.transfer]: "Transfer",
} satisfies Record<z.infer<typeof PaymentMethodSchema>, string>;

function DispenseCartCheckout(props: { control: Control<DispenseCartFormValues> }) {
	const { control } = props;

	const inventoryDrugsQueryResult = useQuery(inventoryDrugsQuery());
	const [items, saleType] = useWatch({ control, name: ["items", "saleType"] });

	const cartDrugs = items.map((item) => findCartDrug(inventoryDrugsQueryResult.data?.drugs, item.drugId));
	const drugsWithoutWholesalePrice = cartDrugs.filter((drug) => drug?.wholesalePrice === null);
	const canSellWholesale = drugsWithoutWholesalePrice.length === 0;

	const pricedTotal = items.reduce((total, item, index) => {
		const drug = cartDrugs[index];
		const unitPrice = drug ? getSellingPrice(drug, saleType) : null;

		return unitPrice === null ? total : total + unitPrice * Number(item.quantity || 0);
	}, 0);
	const unpricedLineCount = cartDrugs.filter(
		(drug) => !drug || getSellingPrice(drug, saleType) === null
	).length;

	return (
		<div
			className="flex flex-col gap-4 rounded-lg border border-shadcn-border/70 bg-shadcn-muted/30 p-4
				lg:sticky lg:top-0 lg:col-start-2 lg:row-span-2 lg:row-start-1"
		>
			<FormField control={control} name="saleType" label="Sale type">
				<Form.FieldBoundController<Pick<DispenseCartFormValues, "saleType">>
					render={({ field }) => (
						<div
							role="radiogroup"
							aria-label="Sale type"
							className="grid grid-cols-2 gap-1 rounded-lg bg-shadcn-muted p-1"
						>
							<For
								each={SaleTypeSchema.options}
								renderItem={(option) => (
									<Button
										key={option}
										unstyled={true}
										role="radio"
										aria-checked={field.value === option}
										isDisabled={option === SaleTypeSchema.enum.wholesale && !canSellWholesale}
										className={cnJoin(
											"h-9 rounded-md text-[13px] font-semibold",
											field.value === option ?
												"bg-white text-vitastock-primary-main shadow-sm"
											:	"text-vitastock-body-color",
											option === SaleTypeSchema.enum.wholesale
												&& !canSellWholesale
												&& "cursor-not-allowed opacity-50"
										)}
										onClick={() => field.onChange(option)}
									>
										{saleTypeLabels[option]}
									</Button>
								)}
							/>
						</div>
					)}
				/>
			</FormField>

			{!canSellWholesale && (
				<p className="-mt-2 text-[12px] text-vitastock-body-color">
					Wholesale needs a wholesale price on every medication in the cart.
				</p>
			)}

			<div className="flex items-baseline justify-between gap-4">
				<p className="text-[13px] font-semibold text-shadcn-foreground">Total</p>
				<div className="flex flex-col items-end gap-0.5">
					<p className="text-[20px] font-extrabold text-shadcn-foreground">
						{formatNaira(pricedTotal)}
					</p>
					{unpricedLineCount > 0 && (
						<p className="text-[12px] font-medium text-amber-700">
							{unpricedLineCount} {unpricedLineCount === 1 ? "medication has" : "medications have"}{" "}
							no price and {unpricedLineCount === 1 ? "is" : "are"} not in this total
						</p>
					)}
				</div>
			</div>

			<FormField control={control} name="paymentMethod" label="Payment (optional)">
				<Form.FieldBoundController<Pick<DispenseCartFormValues, "paymentMethod">>
					render={({ field }) => (
						<div className="grid grid-cols-3 gap-2">
							<For
								each={PaymentMethodSchema.options}
								renderItem={(option) => (
									<Button
										key={option}
										type="button"
										theme={field.value === option ? "primary" : "secondary-outline"}
										aria-pressed={field.value === option}
										className="h-10 text-[13px]"
										onClick={() => field.onChange(field.value === option ? undefined : option)}
									>
										{paymentMethodLabels[option]}
									</Button>
								)}
							/>
						</div>
					)}
				/>
			</FormField>

			<InputField
				control={control}
				name="notes"
				label="Note (optional)"
				placeholder="e.g. Paid half, balance tomorrow"
				autoComplete="off"
			/>
		</div>
	);
}
