"use client";

import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui";
import { cnMerge } from "@/lib/utils/cn";
import { IconBox } from "../common/IconBox";

function DropdownMenuRoot(props: React.ComponentProps<typeof DropdownMenuPrimitive.Root>) {
	return <DropdownMenuPrimitive.Root data-slot="dropdown-menu" {...props} />;
}

function DropdownMenuPortal(props: React.ComponentProps<typeof DropdownMenuPrimitive.Portal>) {
	return <DropdownMenuPrimitive.Portal data-slot="dropdown-menu-portal" {...props} />;
}

function DropdownMenuTrigger(props: React.ComponentProps<typeof DropdownMenuPrimitive.Trigger>) {
	return <DropdownMenuPrimitive.Trigger data-slot="dropdown-menu-trigger" {...props} />;
}

function DropdownMenuContent(props: React.ComponentProps<typeof DropdownMenuPrimitive.Content>) {
	const { className, sideOffset = 4, ...restOfProps } = props;

	return (
		<DropdownMenuPortal>
			<DropdownMenuPrimitive.Content
				data-slot="dropdown-menu-content"
				sideOffset={sideOffset}
				className={cnMerge(
					`z-50 max-h-(--radix-dropdown-menu-content-available-height) min-w-32
					origin-(--radix-dropdown-menu-content-transform-origin) overflow-x-hidden overflow-y-auto
					rounded-md border bg-shadcn-popover p-1 text-shadcn-popover-foreground shadow-md
					data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2
					data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2
					data-[state=closed]:animate-out data-[state=closed]:fade-out-0
					data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0
					data-[state=open]:zoom-in-95`,
					className
				)}
				{...restOfProps}
			/>
		</DropdownMenuPortal>
	);
}

function DropdownMenuGroup({ ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Group>) {
	return <DropdownMenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />;
}

function DropdownMenuItem(
	props: React.ComponentProps<typeof DropdownMenuPrimitive.Item> & {
		inset?: boolean;
		variant?: "default" | "destructive";
	}
) {
	const { className, inset, variant, ...restOfProps } = props;

	return (
		<DropdownMenuPrimitive.Item
			data-slot="dropdown-menu-item"
			data-variant={variant}
			className={cnMerge(
				`relative flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none
				focus:bg-shadcn-accent focus:text-shadcn-accent-foreground
				data-[variant=destructive]:text-shadcn-destructive
				data-[variant=destructive]:focus:bg-shadcn-destructive/10
				data-[variant=destructive]:focus:text-shadcn-destructive
				dark:data-[variant=destructive]:focus:bg-shadcn-destructive/20
				data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none
				[&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4
				[&_svg:not([class*='text-'])]:text-shadcn-muted-foreground
				data-[variant=destructive]:*:[svg]:text-shadcn-destructive!`,
				inset && "pl-8",
				className
			)}
			{...restOfProps}
		/>
	);
}

function DropdownMenuCheckboxItem(
	props: React.ComponentProps<typeof DropdownMenuPrimitive.CheckboxItem> & { withIndicator?: boolean }
) {
	const { checked, children, className, withIndicator = true, ...restOfProps } = props;

	return (
		<DropdownMenuPrimitive.CheckboxItem
			data-slot="dropdown-menu-checkbox-item"
			className={cnMerge(
				`relative flex items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden
				select-none focus:bg-shadcn-accent focus:text-shadcn-accent-foreground
				data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none
				[&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4`,
				className
			)}
			checked={checked}
			{...restOfProps}
		>
			{withIndicator && (
				<span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
					<DropdownMenuPrimitive.ItemIndicator>
						<IconBox icon="radix-icons:check" className="size-4" />
					</DropdownMenuPrimitive.ItemIndicator>
				</span>
			)}
			{children}
		</DropdownMenuPrimitive.CheckboxItem>
	);
}

function DropdownMenuRadioGroup(props: React.ComponentProps<typeof DropdownMenuPrimitive.RadioGroup>) {
	return <DropdownMenuPrimitive.RadioGroup data-slot="dropdown-menu-radio-group" {...props} />;
}

function DropdownMenuRadioItem(
	props: React.ComponentProps<typeof DropdownMenuPrimitive.RadioItem> & { withIndicator?: boolean }
) {
	const { children, className, withIndicator = true, ...restOfProps } = props;

	return (
		<DropdownMenuPrimitive.RadioItem
			className={cnMerge(
				`relative flex items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden
				select-none focus:bg-shadcn-accent focus:text-shadcn-accent-foreground
				data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none
				[&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4`,
				className
			)}
			{...restOfProps}
		>
			{withIndicator && (
				<span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
					<DropdownMenuPrimitive.ItemIndicator>
						<IconBox icon="radix-icons:dot-filled" className="size-4 fill-current" />
					</DropdownMenuPrimitive.ItemIndicator>
				</span>
			)}

			{children}
		</DropdownMenuPrimitive.RadioItem>
	);
}

function DropdownMenuLabel(
	props: React.ComponentProps<typeof DropdownMenuPrimitive.Label> & { inset?: boolean }
) {
	const { className, inset, ...restOfProps } = props;

	return (
		<DropdownMenuPrimitive.Label
			data-slot="dropdown-menu-label"
			className={cnMerge("px-2 py-1.5 text-sm font-medium", inset && "pl-8", className)}
			{...restOfProps}
		/>
	);
}

function DropdownMenuSeparator(props: React.ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
	const { className, ...restOfProps } = props;

	return (
		<DropdownMenuPrimitive.Separator
			data-slot="dropdown-menu-separator"
			className={cnMerge("-mx-1 my-1 h-px bg-shadcn-border", className)}
			{...restOfProps}
		/>
	);
}

function DropdownMenuShortcut({ className, ...restOfProps }: React.HTMLAttributes<HTMLSpanElement>) {
	return (
		<span
			data-slot="dropdown-menu-shortcut"
			className={cnMerge("ml-auto text-xs tracking-widest text-shadcn-muted-foreground", className)}
			{...restOfProps}
		/>
	);
}

function DropdownMenuSubRoot(props: React.ComponentProps<typeof DropdownMenuPrimitive.Sub>) {
	return <DropdownMenuPrimitive.Sub data-slot="dropdown-menu-sub-root" {...props} />;
}

function DropdownMenuSubTrigger(
	props: React.ComponentProps<typeof DropdownMenuPrimitive.SubTrigger> & { inset?: boolean }
) {
	const { children, className, inset, ...restOfProps } = props;

	return (
		<DropdownMenuPrimitive.SubTrigger
			data-slot="dropdown-menu-sub-trigger"
			className={cnMerge(
				`flex items-center rounded-sm px-2 py-1.5 text-sm outline-hidden select-none
				focus:bg-shadcn-accent focus:text-shadcn-accent-foreground data-[state=open]:bg-shadcn-accent
				data-[state=open]:text-shadcn-accent-foreground`,
				inset && "pl-8",
				className
			)}
			{...restOfProps}
		>
			{children}
			<IconBox icon="radix-icons:chevron-right" className="ml-auto size-4" />
		</DropdownMenuPrimitive.SubTrigger>
	);
}

function DropdownMenuSubContent(props: React.ComponentProps<typeof DropdownMenuPrimitive.SubContent>) {
	const { className, ...restOfProps } = props;

	return (
		<DropdownMenuPrimitive.SubContent
			data-slot="dropdown-menu-sub-content"
			className={cnMerge(
				`z-50 min-w-32 origin-(--radix-dropdown-menu-content-transform-origin) overflow-hidden
				rounded-md border bg-shadcn-popover p-1 text-shadcn-popover-foreground shadow-lg
				data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2
				data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2
				data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95
				data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95`,
				className
			)}
			{...restOfProps}
		/>
	);
}

export {
	DropdownMenuCheckboxItem as CheckboxItem,
	DropdownMenuContent as Content,
	DropdownMenuGroup as Group,
	DropdownMenuItem as Item,
	DropdownMenuLabel as Label,
	DropdownMenuPortal as Portal,
	DropdownMenuRadioGroup as RadioGroup,
	DropdownMenuRadioItem as RadioItem,
	DropdownMenuRoot as Root,
	DropdownMenuSeparator as Separator,
	DropdownMenuShortcut as Shortcut,
	DropdownMenuSubRoot as SubRoot,
	DropdownMenuSubContent as SubContent,
	DropdownMenuSubTrigger as SubTrigger,
	DropdownMenuTrigger as Trigger,
};
