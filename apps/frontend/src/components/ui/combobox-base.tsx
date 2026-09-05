"use client";

import { Combobox as ComboboxPrimitive } from "@base-ui/react";
import { useRef } from "react";
import { cnMerge } from "@/lib/utils/cn";
import { IconBox } from "../common/IconBox";
import { shadcnButtonVariants } from "./constants";
import { Form } from "./form";

function ComboboxRoot<Value, Multiple extends boolean | undefined = false>(
	props: React.ComponentProps<typeof ComboboxPrimitive.Root<Value, Multiple>>
) {
	return <ComboboxPrimitive.Root data-slot="combobox-root" {...props} />;
}

function ComboboxValue(props: React.ComponentProps<typeof ComboboxPrimitive.Value>) {
	return <ComboboxPrimitive.Value data-slot="combobox-value" {...props} />;
}

function ComboboxTrigger(props: React.ComponentProps<typeof ComboboxPrimitive.Trigger>) {
	const { children, className, ...restOfProps } = props;

	return (
		<ComboboxPrimitive.Trigger
			data-slot="combobox-trigger"
			className={cnMerge("[&_svg:not([class*='size-'])]:size-4", className as string)}
			{...restOfProps}
		>
			{children}
			<IconBox
				icon="lucide:chevron-down"
				className="pointer-events-none size-4 text-shadcn-muted-foreground"
			/>
		</ComboboxPrimitive.Trigger>
	);
}

function ComboboxClear(props: React.ComponentProps<typeof ComboboxPrimitive.Clear>) {
	const { className, ...restOfProps } = props;

	return (
		<ComboboxPrimitive.Clear
			data-slot="combobox-clear"
			render={
				<button
					type="button"
					className={shadcnButtonVariants({ size: "icon-xs", variant: "ghost" })}
				/>
			}
			className={className}
			{...restOfProps}
		>
			<IconBox icon="lucide:x" className="pointer-events-none" />
		</ComboboxPrimitive.Clear>
	);
}

function ComboboxInput(
	props: React.ComponentProps<typeof ComboboxPrimitive.Input> & {
		withClear?: boolean;
		withTrigger?: boolean;
	}
) {
	const {
		children,
		className,
		disabled = false,
		withClear = false,
		withTrigger = true,
		...restOfProps
	} = props;

	return (
		<Form.InputGroup
			className={cnMerge(
				`h-9 w-auto rounded-md border border-shadcn-input bg-transparent px-3
				transition-[color,box-shadow] focus-within:border-shadcn-ring focus-within:ring-[3px]
				focus-within:ring-shadcn-ring/50 has-aria-invalid:border-shadcn-destructive
				has-aria-invalid:ring-[3px] has-aria-invalid:ring-shadcn-destructive/20`,
				className as string
			)}
		>
			<ComboboxPrimitive.Input render={<Form.InputPrimitive disabled={disabled} />} {...restOfProps} />
			<Form.InputGroupAddon>
				{withTrigger && (
					<ComboboxTrigger
						data-slot="input-group-button"
						className="group-has-data-[slot=combobox-clear]/input-group:hidden
							data-pressed:bg-transparent"
						disabled={disabled}
						render={
							<button
								type="button"
								className={shadcnButtonVariants({ size: "icon-xs", variant: "ghost" })}
							/>
						}
					/>
				)}
				{withClear && <ComboboxClear disabled={disabled} />}
			</Form.InputGroupAddon>
			{children}
		</Form.InputGroup>
	);
}

function ComboboxContent(
	props: Pick<
		React.ComponentProps<typeof ComboboxPrimitive.Positioner>,
		"align" | "alignOffset" | "anchor" | "side" | "sideOffset"
	>
		& React.ComponentProps<typeof ComboboxPrimitive.Popup>
) {
	const {
		align = "start",
		alignOffset = 0,
		anchor,
		className,
		side = "bottom",
		sideOffset = 6,
		...restOfProps
	} = props;

	return (
		<ComboboxPrimitive.Portal>
			<ComboboxPrimitive.Positioner
				side={side}
				sideOffset={sideOffset}
				align={align}
				alignOffset={alignOffset}
				anchor={anchor}
				className="isolate z-50"
			>
				<ComboboxPrimitive.Popup
					data-slot="combobox-content"
					data-chips={Boolean(anchor)}
					className={cnMerge(
						`group/combobox-content relative max-h-(--available-height) w-(--anchor-width)
						max-w-(--available-width) min-w-[calc(var(--anchor-width)+(--spacing(7)))]
						origin-(--transform-origin) overflow-hidden rounded-lg bg-shadcn-popover
						text-shadcn-popover-foreground shadow-md ring-1 ring-shadcn-foreground/10 duration-100
						data-[chips=true]:min-w-(--anchor-width) data-[side=bottom]:slide-in-from-top-2
						data-[side=inline-end]:slide-in-from-left-2
						data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2
						data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2
						*:data-[slot=input-group]:m-1 *:data-[slot=input-group]:mb-0
						*:data-[slot=input-group]:h-8 *:data-[slot=input-group]:border-shadcn-input/30
						*:data-[slot=input-group]:bg-shadcn-input/30 *:data-[slot=input-group]:shadow-none
						data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out
						data-closed:fade-out-0 data-closed:zoom-out-95`,
						className as string
					)}
					{...restOfProps}
				/>
			</ComboboxPrimitive.Positioner>
		</ComboboxPrimitive.Portal>
	);
}

function ComboboxList(props: React.ComponentProps<typeof ComboboxPrimitive.List>) {
	const { className, ...restOfProps } = props;

	return (
		<ComboboxPrimitive.List
			data-slot="combobox-list"
			className={cnMerge(
				`no-scrollbar
				max-h-[min(calc(--spacing(72)-(--spacing(9))),calc(var(--available-height)-(--spacing(9))))]
				scroll-py-1 overflow-y-auto overscroll-contain p-1 data-empty:p-0`,
				className as string
			)}
			{...restOfProps}
		/>
	);
}

function ComboboxItem(
	props: React.ComponentProps<typeof ComboboxPrimitive.Item> & { withIndicator?: boolean }
) {
	const { children, className, withIndicator = true, ...restOfProps } = props;

	return (
		<ComboboxPrimitive.Item
			data-slot="combobox-item"
			className={cnMerge(
				`relative flex w-full cursor-default items-center gap-2 rounded-md py-1 pr-8 pl-1.5 text-sm
				outline-hidden select-none data-highlighted:bg-shadcn-accent
				data-highlighted:text-shadcn-accent-foreground
				not-data-[variant=destructive]:data-highlighted:**:text-shadcn-accent-foreground
				data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none
				[&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4`,
				className as string
			)}
			{...restOfProps}
		>
			{children}
			{withIndicator && (
				<ComboboxPrimitive.ItemIndicator
					render={
						<span
							className="pointer-events-none absolute right-2 flex size-4 items-center
								justify-center"
						/>
					}
				>
					<IconBox
						icon="lucide:chevron-down"
						className="pointer-events-none size-4 text-shadcn-muted-foreground"
					/>
				</ComboboxPrimitive.ItemIndicator>
			)}
		</ComboboxPrimitive.Item>
	);
}

function ComboboxGroup(props: React.ComponentProps<typeof ComboboxPrimitive.Group>) {
	const { className, ...restOfProps } = props;

	return <ComboboxPrimitive.Group data-slot="combobox-group" className={className} {...restOfProps} />;
}

function ComboboxLabel(props: React.ComponentProps<typeof ComboboxPrimitive.GroupLabel>) {
	const { className, ...restOfProps } = props;

	return (
		<ComboboxPrimitive.GroupLabel
			data-slot="combobox-label"
			className={cnMerge("px-2 py-1.5 text-xs text-shadcn-muted-foreground", className as string)}
			{...restOfProps}
		/>
	);
}

function ComboboxCollection(props: React.ComponentProps<typeof ComboboxPrimitive.Collection>) {
	return <ComboboxPrimitive.Collection data-slot="combobox-collection" {...props} />;
}

function ComboboxEmpty(props: React.ComponentProps<typeof ComboboxPrimitive.Empty>) {
	const { className, ...restOfProps } = props;

	return (
		<ComboboxPrimitive.Empty
			data-slot="combobox-empty"
			className={cnMerge(
				`hidden w-full justify-center py-2 text-center text-sm text-shadcn-muted-foreground
				group-data-empty/combobox-content:flex`,
				className as string
			)}
			{...restOfProps}
		/>
	);
}

function ComboboxSeparator(props: React.ComponentProps<typeof ComboboxPrimitive.Separator>) {
	const { className, ...restOfProps } = props;

	return (
		<ComboboxPrimitive.Separator
			data-slot="combobox-separator"
			className={cnMerge("-mx-1 my-1 h-px bg-shadcn-border", className as string)}
			{...restOfProps}
		/>
	);
}

function ComboboxChips(props: React.ComponentProps<typeof ComboboxPrimitive.Chips>) {
	const { className, ...restOfProps } = props;

	return (
		<ComboboxPrimitive.Chips
			data-slot="combobox-chips"
			className={cnMerge(
				`flex min-h-8 flex-wrap items-center gap-1 rounded-lg border border-shadcn-input bg-transparent
				bg-clip-padding px-2.5 py-1 text-sm transition-colors focus-within:border-shadcn-ring
				focus-within:ring-3 focus-within:ring-shadcn-ring/50 has-aria-invalid:border-shadcn-destructive
				has-aria-invalid:ring-3 has-aria-invalid:ring-shadcn-destructive/20
				has-data-[slot=combobox-chip]:px-1 dark:bg-shadcn-input/30
				dark:has-aria-invalid:border-shadcn-destructive/50
				dark:has-aria-invalid:ring-shadcn-destructive/40`,
				className as string
			)}
			{...restOfProps}
		/>
	);
}

function ComboboxChip(
	props: React.ComponentProps<typeof ComboboxPrimitive.Chip> & {
		withRemove?: boolean;
	}
) {
	const { children, className, withRemove = true, ...restOfProps } = props;

	return (
		<ComboboxPrimitive.Chip
			data-slot="combobox-chip"
			className={cnMerge(
				`flex h-[calc(--spacing(5.25))] w-fit items-center justify-center gap-1 rounded-sm
				bg-shadcn-muted px-1.5 text-xs font-medium whitespace-nowrap text-shadcn-foreground
				has-disabled:pointer-events-none has-disabled:cursor-not-allowed has-disabled:opacity-50
				has-data-[slot=combobox-chip-remove]:pr-0`,
				className as string
			)}
			{...restOfProps}
		>
			{children}
			{withRemove && (
				<ComboboxPrimitive.ChipRemove
					render={
						<button
							type="button"
							className={shadcnButtonVariants({ size: "icon-xs", variant: "ghost" })}
						/>
					}
					className="-ml-1 opacity-50 hover:opacity-100"
					data-slot="combobox-chip-remove"
				>
					<IconBox icon="lucide:x" className="pointer-events-none" />
				</ComboboxPrimitive.ChipRemove>
			)}
		</ComboboxPrimitive.Chip>
	);
}

function ComboboxChipsInput(props: React.ComponentProps<typeof ComboboxPrimitive.Input>) {
	const { className, ...restOfProps } = props;

	return (
		<ComboboxPrimitive.Input
			data-slot="combobox-chip-input"
			className={cnMerge("min-w-16 flex-1 outline-none", className as string)}
			{...restOfProps}
		/>
	);
}

function useComboboxAnchor() {
	return useRef<HTMLDivElement | null>(null);
}

export {
	ComboboxChip as Chip,
	ComboboxChips as Chips,
	ComboboxChipsInput as ChipsInput,
	ComboboxClear as Clear,
	ComboboxCollection as Collection,
	ComboboxContent as Content,
	ComboboxEmpty as Empty,
	ComboboxGroup as Group,
	ComboboxInput as Input,
	ComboboxItem as Item,
	ComboboxLabel as Label,
	ComboboxList as List,
	ComboboxRoot as Root,
	ComboboxSeparator as Separator,
	ComboboxTrigger as Trigger,
	ComboboxValue as Value,
	// eslint-disable-next-line react-refresh/only-export-components
	useComboboxAnchor,
};
