"use client";

import { tw } from "@zayne-labs/toolkit-core";
import type { InferProps } from "@zayne-labs/toolkit-react/utils";
import { isString, type DistributivePick } from "@zayne-labs/toolkit-type-helpers";
import type { FieldValues } from "react-hook-form";
import { For } from "@/components/common/for";
import { Combobox, Select } from "@/components/ui";
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
			group?: string;
			input?: string;
			item?: string;
			list?: string;
			trigger?: string;
			triggerIcon?: string;
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
					<Combobox.Root
						data={data}
						type={type}
						value={field.value}
						onValueChange={(value) => {
							field.onChange(value);
							onValueChange?.(value);
						}}
					>
						<Combobox.Trigger
							aria-invalid={fieldState.invalid}
							disabled={disabled}
							classNames={{
								base: cnMerge(
									`h-10 w-full justify-between rounded-lg border-shadcn-border
									bg-shadcn-background px-4 text-left text-[14px] font-normal shadow-none
									hover:bg-shadcn-background aria-invalid:border-shadcn-destructive
									aria-invalid:ring-[3px] aria-invalid:ring-shadcn-destructive/20`,
									classNames?.trigger
								),
								icon: cnMerge("text-vitastock-body-color/70", classNames?.triggerIcon),
							}}
						/>

						<Combobox.Content
							className={cnMerge("rounded-lg bg-shadcn-background", classNames?.content)}
							popoverOptions={{ align: "start", sideOffset: 6 }}
						>
							<Combobox.Input
								className={cnMerge("h-10 text-[14px]", classNames?.input)}
								onValueChange={onInputValueChange}
							/>
							<Combobox.Empty className={cnMerge("p-3 text-[13px]", classNames?.empty)}>
								{emptyContent}
							</Combobox.Empty>
							<Combobox.List className={cnMerge("max-h-64 p-1.5", classNames?.list)}>
								<Combobox.Group className={cnMerge("p-0", classNames?.group)}>
									<For
										each={data}
										renderItem={(option) => (
											<Combobox.Item
												key={option.value}
												value={option.value}
												keywords={option.keywords ?? [option.label]}
												className={cnMerge(
													`min-h-9 rounded-md px-3 text-[14px]
													data-[selected=true]:bg-vitastock-primary-main/10
													data-[selected=true]:text-vitastock-primary-dark`,
													classNames?.item
												)}
											>
												{option.label}
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
