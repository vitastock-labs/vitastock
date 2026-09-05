"use client";

import { Dialog as SheetPrimitive } from "radix-ui";
import { cnMerge } from "@/lib/utils/cn";
import { IconBox } from "../common/IconBox";
import { shadcnButtonVariants } from "./constants";

function SheetRoot(props: React.ComponentProps<typeof SheetPrimitive.Root>) {
	return <SheetPrimitive.Root data-slot="sheet-root" {...props} />;
}

function SheetTrigger(props: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
	return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetClose(props: React.ComponentProps<typeof SheetPrimitive.Close>) {
	return <SheetPrimitive.Close data-slot="sheet-close" {...props} />;
}

function SheetPortal(props: React.ComponentProps<typeof SheetPrimitive.Portal>) {
	return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />;
}

function SheetOverlay(props: React.ComponentProps<typeof SheetPrimitive.Overlay>) {
	const { className, ...restOfProps } = props;

	return (
		<SheetPrimitive.Overlay
			data-slot="sheet-overlay"
			className={cnMerge(
				`fixed inset-0 z-50 bg-black/10 duration-100 supports-backdrop-filter:backdrop-blur-xs
				data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0`,
				className
			)}
			{...restOfProps}
		/>
	);
}

function SheetContent(
	props: React.ComponentProps<typeof SheetPrimitive.Content> & {
		side?: "bottom" | "left" | "right" | "top";
		withCloseButton?: boolean;
	}
) {
	const { children, className, side = "right", withCloseButton = true, ...restOfProps } = props;

	return (
		<SheetPortal>
			<SheetOverlay />

			<SheetPrimitive.Content
				data-slot="sheet-content"
				data-side={side}
				className={cnMerge(
					`fixed z-50 flex flex-col gap-4 bg-shadcn-popover bg-clip-padding text-sm
					text-shadcn-popover-foreground shadow-lg transition duration-200 ease-in-out
					data-[side=bottom]:inset-x-0 data-[side=bottom]:bottom-0 data-[side=bottom]:h-auto
					data-[side=bottom]:border-t data-[side=left]:inset-y-0 data-[side=left]:left-0
					data-[side=left]:h-full data-[side=left]:w-3/4 data-[side=left]:border-r
					data-[side=right]:inset-y-0 data-[side=right]:right-0 data-[side=right]:h-full
					data-[side=right]:w-3/4 data-[side=right]:border-l data-[side=top]:inset-x-0
					data-[side=top]:top-0 data-[side=top]:h-auto data-[side=top]:border-b
					data-[side=left]:sm:max-w-sm data-[side=right]:sm:max-w-sm data-open:animate-in
					data-open:fade-in-0 data-[side=bottom]:data-open:slide-in-from-bottom-10
					data-[side=left]:data-open:slide-in-from-left-10
					data-[side=right]:data-open:slide-in-from-right-10
					data-[side=top]:data-open:slide-in-from-top-10 data-closed:animate-out
					data-closed:fade-out-0 data-[side=bottom]:data-closed:slide-out-to-bottom-10
					data-[side=left]:data-closed:slide-out-to-left-10
					data-[side=right]:data-closed:slide-out-to-right-10
					data-[side=top]:data-closed:slide-out-to-top-10`,
					className
				)}
				{...restOfProps}
			>
				{children}

				{withCloseButton && (
					<SheetPrimitive.Close
						className={shadcnButtonVariants({
							className: "absolute top-3 right-3",
							size: "icon-sm",
							variant: "ghost",
						})}
					>
						<IconBox icon="lucide:x" className="size-4" />
						<span className="sr-only">Close</span>
					</SheetPrimitive.Close>
				)}
			</SheetPrimitive.Content>
		</SheetPortal>
	);
}

function SheetHeader(props: React.ComponentProps<"div">) {
	const { className, ...restOfProps } = props;

	return (
		<div
			data-slot="sheet-header"
			className={cnMerge("flex flex-col gap-0.5 p-4", className)}
			{...restOfProps}
		/>
	);
}

function SheetFooter(props: React.ComponentProps<"div">) {
	const { className, ...restOfProps } = props;

	return (
		<div
			data-slot="sheet-footer"
			className={cnMerge("mt-auto flex flex-col gap-2 p-4", className)}
			{...restOfProps}
		/>
	);
}

function SheetTitle(props: React.ComponentProps<typeof SheetPrimitive.Title>) {
	const { className, ...restOfProps } = props;

	return (
		<SheetPrimitive.Title
			data-slot="sheet-title"
			className={cnMerge("text-base font-medium text-shadcn-foreground", className)}
			{...restOfProps}
		/>
	);
}

function SheetDescription(props: React.ComponentProps<typeof SheetPrimitive.Description>) {
	const { className, ...restOfProps } = props;

	return (
		<SheetPrimitive.Description
			data-slot="sheet-description"
			className={cnMerge("text-sm text-shadcn-muted-foreground", className)}
			{...restOfProps}
		/>
	);
}

export {
	SheetRoot as Root,
	SheetTrigger as Trigger,
	SheetClose as Close,
	SheetContent as Content,
	SheetHeader as Header,
	SheetFooter as Footer,
	SheetTitle as Title,
	SheetDescription as Description,
};
