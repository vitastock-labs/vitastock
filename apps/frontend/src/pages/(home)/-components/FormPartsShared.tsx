"use client";

import { tw } from "@zayne-labs/toolkit-core";
import type { InferProps } from "@zayne-labs/toolkit-react/utils";
import { isString, type DistributivePick } from "@zayne-labs/toolkit-type-helpers";
import { defaultFilter } from "cmdk";
import { useRef, useState } from "react";
import type { FieldValues } from "react-hook-form";
import { For } from "@/components/common/for";
import { ComboboxBase, Select } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { cnMerge } from "@/lib/utils/cn";

type SharedFieldProps<
	TFieldValues extends FieldValues,
	TTransformedValues = TFieldValues,
> = DistributivePick<
	InferProps<typeof Form.Field<unknown, TFieldValues, TTransformedValues>>,
	"control" | "name"
>;

type SharedFieldClassNames = {
	base?: string;
	description?: string;
	label?: string;
};

type SharedFieldOption = string | { label: string; value: string };

type SharedComboboxOption = {
	keywords?: string[];
	label: string;
	value: string;
};

const getSharedFieldOption = (option: SharedFieldOption) => {
	return isString(option) ? { label: option, value: option } : option;
};

const rankComboboxOptions = (options: SharedComboboxOption[], query: string) => {
	if (!query) {
		return options;
	}

	return options
		.map((option) => ({
			option,
			score: defaultFilter(option.value, query, option.keywords ?? [option.label]),
		}))
		.filter((rankedOption) => rankedOption.score > 0)
		.sort((rankedOptionA, rankedOptionB) => rankedOptionB.score - rankedOptionA.score)
		.map((rankedOption) => rankedOption.option);
};

function RequiredIndicator(props: { required: boolean | undefined }) {
	const { required } = props;

	return (
		required && (
			<span className="text-shadcn-destructive" aria-hidden={true}>
				*
			</span>
		)
	);
}

export function FormField<TFieldValues extends FieldValues, TTransformedValues = TFieldValues>(
	props: SharedFieldProps<TFieldValues, TTransformedValues> & {
		children: React.ReactNode;
		classNames?: SharedFieldClassNames;
		description?: React.ReactNode;
		label?: React.ReactNode;
		required?: boolean;
	}
) {
	const { children, classNames, control, description, label, name, required } = props;

	return (
		<Form.Field control={control} name={name} className={classNames?.base}>
			{Boolean(label) && (
				<Form.Label className={cnMerge("flex items-baseline gap-1", classNames?.label)}>
					{label}
					<RequiredIndicator required={required} />
				</Form.Label>
			)}

			{Boolean(description) && (
				<Form.Description className={classNames?.description}>{description}</Form.Description>
			)}

			{children}
			<Form.ErrorMessage />
		</Form.Field>
	);
}

export function InputField<TFieldValues extends FieldValues, TTransformedValues = TFieldValues>(
	props: Pick<
		InferProps<typeof Form.InputPrimitive>,
		"disabled" | "inputMode" | "max" | "min" | "placeholder" | "step" | "type"
	>
		& SharedFieldProps<TFieldValues, TTransformedValues> & {
			classNames?: SharedFieldClassNames & { input?: string; inputGroup?: string };
			description?: React.ReactNode;
			label?: React.ReactNode;
			required?: boolean;
		}
) {
	const {
		classNames,
		control,
		description,
		disabled,
		inputMode,
		label,
		max,
		min,
		name,
		placeholder,
		required,
		step,
		type,
	} = props;
	const inputClassName = tw`h-10 rounded-lg border border-shadcn-border bg-shadcn-background px-4
	text-[14px] text-shadcn-foreground outline-none placeholder:text-vitastock-body-color/60
	focus-within:border-vitastock-primary-main focus-within:ring-1 focus-within:ring-vitastock-primary-main`;

	return (
		<FormField
			control={control}
			name={name}
			label={label}
			description={description}
			required={required}
			classNames={classNames}
		>
			<Form.Input
				disabled={disabled}
				inputMode={inputMode}
				max={max}
				min={min}
				step={step}
				type={type}
				placeholder={placeholder}
				classNames={{
					input: cnMerge(type !== "password" && inputClassName, classNames?.input),
					inputGroup: cnMerge(type === "password" && inputClassName, classNames?.inputGroup),
				}}
			/>
		</FormField>
	);
}

export function ComboboxField<TFieldValues extends FieldValues, TTransformedValues = TFieldValues>(
	props: SharedFieldProps<TFieldValues, TTransformedValues> & {
		classNames?: SharedFieldClassNames & {
			content?: string;
			empty?: string;
			input?: string;
			item?: string;
			list?: string;
			trigger?: string;
		};
		data: SharedComboboxOption[];
		description?: React.ReactNode;
		disabled?: boolean;
		emptyContent?: React.ReactNode;
		label?: React.ReactNode;
		onInputValueChange?: (value: string) => void;
		onValueChange?: (value: string) => void;
		required?: boolean;
		type: string;
	}
) {
	const {
		classNames,
		control,
		data,
		description,
		disabled,
		emptyContent,
		label,
		name,
		onInputValueChange,
		onValueChange,
		required,
		type,
	} = props;

	const [inputValue, setInputValue] = useState("");

	// == Keeps the popup inside the field's DOM so modal dialogs don't trap focus or pointer events away from it
	const popupContainerRef = useRef<HTMLDivElement>(null);

	return (
		<FormField
			control={control}
			name={name}
			label={label}
			description={description}
			required={required}
			classNames={classNames}
		>
			<Form.FieldBoundController
				render={({ field, fieldState }) => (
					<ComboboxBase.Root
						items={data}
						filteredItems={rankComboboxOptions(data, inputValue)}
						disabled={disabled}
						autoHighlight={true}
						value={data.find((option) => option.value === field.value) ?? null}
						inputValue={inputValue}
						onInputValueChange={(value) => {
							setInputValue(value);
							onInputValueChange?.(value);
						}}
						onValueChange={(option) => {
							if (!option) return;

							field.onChange(option.value);
							onValueChange?.(option.value);
						}}
					>
						<ComboboxBase.Trigger
							ref={field.ref}
							aria-invalid={fieldState.invalid}
							render={<Button theme="none" size="none" />}
							className={cnMerge(
								`h-10 w-full justify-between rounded-lg border border-shadcn-border
								bg-shadcn-background px-4 text-left text-[14px] font-normal text-shadcn-foreground
								aria-invalid:border-shadcn-destructive aria-invalid:ring-[3px]
								aria-invalid:ring-shadcn-destructive/20
								*:data-[slot=combobox-icon]:text-vitastock-body-color/70`,
								classNames?.trigger
							)}
						>
							<ComboboxBase.Value placeholder={`Select ${type}...`} />
						</ComboboxBase.Trigger>

						<ComboboxBase.Content
							container={popupContainerRef}
							className={cnMerge(
								"min-w-(--anchor-width) rounded-lg bg-shadcn-background",
								classNames?.content
							)}
						>
							<ComboboxBase.Input
								withTrigger={false}
								placeholder={`Search ${type}...`}
								className={cnMerge("h-10 text-[14px]", classNames?.input)}
							/>
							<ComboboxBase.Empty className={cnMerge("p-3 text-[13px]", classNames?.empty)}>
								{emptyContent ?? `No ${type} found.`}
							</ComboboxBase.Empty>
							<ComboboxBase.List className={cnMerge("max-h-64 p-1.5", classNames?.list)}>
								{(option: SharedComboboxOption) => (
									<ComboboxBase.Item
										key={option.value}
										value={option}
										className={cnMerge(
											`min-h-9 rounded-md pl-3 text-[14px]
											data-highlighted:bg-vitastock-primary-main/10
											data-highlighted:text-vitastock-primary-dark`,
											classNames?.item
										)}
									>
										{option.label}
									</ComboboxBase.Item>
								)}
							</ComboboxBase.List>
						</ComboboxBase.Content>
					</ComboboxBase.Root>
				)}
			/>

			<div ref={popupContainerRef} className="contents" />
		</FormField>
	);
}

export function SelectField<TFieldValues extends FieldValues, TTransformedValues = TFieldValues>(
	props: SharedFieldProps<TFieldValues, TTransformedValues> & {
		classNames?: SharedFieldClassNames & {
			content?: string;
			item?: string;
			trigger?: string;
			viewport?: string;
		};
		description?: React.ReactNode;
		disabled?: boolean;
		label?: React.ReactNode;
		onValueChange?: (value: string) => void;
		options: readonly SharedFieldOption[];
		placeholder?: string;
		required?: boolean;
	}
) {
	const {
		classNames,
		control,
		description,
		disabled,
		label,
		name,
		onValueChange,
		options,
		placeholder = "Select",
		required,
	} = props;

	return (
		<FormField
			control={control}
			name={name}
			label={label}
			description={description}
			required={required}
			classNames={classNames}
		>
			<Form.FieldBoundController
				render={({ field, fieldState }) => (
					<Select.Root
						disabled={disabled}
						value={field.value}
						onValueChange={(value) => {
							field.onChange(value);
							onValueChange?.(value);
						}}
					>
						<Select.Trigger
							aria-invalid={fieldState.invalid}
							className={cnMerge(
								`h-10 rounded-lg px-4 text-[14px] text-shadcn-foreground
								aria-invalid:border-shadcn-destructive aria-invalid:ring-[3px]
								aria-invalid:ring-shadcn-destructive/20`,
								classNames?.trigger
							)}
						>
							<Select.Value placeholder={placeholder} />
						</Select.Trigger>

						<Select.Content
							classNames={{ base: classNames?.content, viewport: classNames?.viewport }}
						>
							<For
								each={options}
								renderItem={(option) => {
									const item = getSharedFieldOption(option);

									return (
										<Select.Item
											key={item.value}
											value={item.value}
											className={classNames?.item}
										>
											{item.label}
										</Select.Item>
									);
								}}
							/>
						</Select.Content>
					</Select.Root>
				)}
			/>
		</FormField>
	);
}
