"use client";

import { createCustomContext, useControllableState } from "@zayne-labs/toolkit-react";
import type { DiscriminatedRenderProps } from "@zayne-labs/toolkit-react/utils";
import { Dialog as DialogPrimitive } from "radix-ui";
import { useMemo } from "react";
import { cnMerge } from "@/lib/utils/cn";
import { IconBox } from "../common/IconBox";

type ContextType = {
	isOpen: boolean;
	setIsOpen: (open: boolean) => void;
};

const [DialogStateContextProvider, useDialogStateContext] = createCustomContext<ContextType>();

function DialogRoot(props: React.ComponentProps<typeof DialogPrimitive.Root>) {
	const {
		defaultOpen: defaultOpenProp = false,
		// eslint-disable-next-line ts-eslint/unbound-method
		onOpenChange: onOpenChangeProp,
		open: openProp,
		...restOfProps
	} = props;

	const [isOpen, setIsOpen] = useControllableState({
		defaultProp: defaultOpenProp,
		onChange: onOpenChangeProp,
		prop: openProp,
	});

	const contextValue = useMemo(() => ({ isOpen, setIsOpen }) satisfies ContextType, [setIsOpen, isOpen]);

	return (
		<DialogStateContextProvider value={contextValue}>
			<DialogPrimitive.Root
				data-slot="dialog-root"
				{...restOfProps}
				open={isOpen}
				onOpenChange={setIsOpen}
			/>
		</DialogStateContextProvider>
	);
}

type RenderFn = (props: ContextType) => React.ReactNode;

function DialogContext(props: DiscriminatedRenderProps<RenderFn>) {
	const { children, render } = props;

	const dialogCtx = useDialogStateContext();

	const selectedRenderFn = typeof children === "function" ? children : render;

	return selectedRenderFn(dialogCtx);
}

function DialogOverlay(props: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
	const { className, ...restOfProps } = props;

	return (
		<DialogPrimitive.Overlay
			className={cnMerge(
				`fixed inset-0 z-50 bg-black/80 data-[state=closed]:animate-out data-[state=closed]:fade-out-0
				data-[state=open]:animate-in data-[state=open]:fade-in-0`,
				className
			)}
			{...restOfProps}
		/>
	);
}

function DialogContent(
	props: React.ComponentProps<typeof DialogPrimitive.Content> & { withCloseButton?: boolean }
) {
	const { children, className, withCloseButton = true, ...restOfProps } = props;

	return (
		<DialogPrimitive.Portal>
			<DialogOverlay />

			<DialogPrimitive.Content
				className={cnMerge(
					`fixed top-1/2 left-1/2 z-50 grid w-full max-w-lg -translate-1/2 gap-4 border
					bg-shadcn-background p-6 shadow-lg duration-200 data-[state=closed]:animate-out
					data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95
					data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]
					data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95
					data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]`,
					className
				)}
				{...restOfProps}
			>
				{children}

				{withCloseButton && (
					<DialogPrimitive.Close
						className="absolute top-4 right-4 rounded-xs opacity-70 ring-offset-shadcn-background
							transition-opacity hover:opacity-100 focus:ring-2 focus:ring-shadcn-ring
							focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none
							data-[state=open]:bg-shadcn-accent data-[state=open]:text-shadcn-muted-foreground
							[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
					>
						<IconBox icon="lucide:x" />
						<span className="sr-only">Close</span>
					</DialogPrimitive.Close>
				)}
			</DialogPrimitive.Content>
		</DialogPrimitive.Portal>
	);
}

function DialogHeader(props: React.ComponentProps<"div">) {
	const { className, ...restOfProps } = props;

	return (
		<div
			className={cnMerge("flex flex-col gap-1.5 text-center sm:text-left", className)}
			{...restOfProps}
		/>
	);
}

function DialogFooter(props: React.ComponentProps<"div">) {
	const { className, ...restOfProps } = props;

	return <div className={cnMerge("flex flex-col", className)} {...restOfProps} />;
}

function DialogTitle(props: React.ComponentProps<typeof DialogPrimitive.Title>) {
	const { className, ...restOfProps } = props;

	return (
		<DialogPrimitive.Title
			className={cnMerge("text-lg leading-none font-semibold tracking-tight", className)}
			{...restOfProps}
		/>
	);
}

function DialogDescription(props: React.ComponentProps<typeof DialogPrimitive.Description>) {
	const { className, ...restOfProps } = props;

	return (
		<DialogPrimitive.Description
			className={cnMerge("text-sm text-shadcn-muted-foreground", className)}
			{...restOfProps}
		/>
	);
}

// eslint-disable-next-line react-refresh/only-export-components
export const Close = DialogPrimitive.Close;

// eslint-disable-next-line react-refresh/only-export-components
export const Portal = DialogPrimitive.Portal;

// eslint-disable-next-line react-refresh/only-export-components
export const Trigger = DialogPrimitive.Trigger;

export {
	DialogContent as Content,
	DialogContext as Context,
	DialogDescription as Description,
	DialogFooter as Footer,
	DialogHeader as Header,
	DialogOverlay as Overlay,
	DialogRoot as Root,
	DialogTitle as Title,
	// eslint-disable-next-line react-refresh/only-export-components
	useDialogStateContext,
};
