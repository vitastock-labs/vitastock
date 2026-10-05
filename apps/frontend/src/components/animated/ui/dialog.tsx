"use client";

import { IconBox } from "@/components/common/IconBox";
import { cnMerge } from "@/lib/utils/cn";
import * as DialogPrimitive from "../primitives/dialog-radix";

function DialogRoot(props: React.ComponentProps<typeof DialogPrimitive.Root>) {
	return <DialogPrimitive.Root {...props} />;
}

function DialogTrigger(props: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
	return <DialogPrimitive.Trigger {...props} />;
}

function DialogClose(props: React.ComponentProps<typeof DialogPrimitive.Close>) {
	return <DialogPrimitive.Close {...props} />;
}

function DialogOverlay(props: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
	const { className, ...restOfProps } = props;

	return (
		<DialogPrimitive.Overlay
			className={cnMerge("fixed inset-0 z-50 bg-black/50", className)}
			{...restOfProps}
		/>
	);
}

function DialogContent(
	props: React.ComponentProps<typeof DialogPrimitive.Content> & {
		classNames?: {
			base?: string;
			overlay?: string;
		};
		withCloseButton?: boolean;
	}
) {
	const { children, className, classNames, withCloseButton = true, ...restOfProps } = props;

	return (
		<DialogPrimitive.Portal>
			<DialogOverlay className={classNames?.overlay} />
			<DialogPrimitive.Content
				className={cnMerge(
					`fixed top-1/2 left-1/2 z-50 grid max-h-[calc(100svh-32px)] w-[calc(100%-32px)] max-w-lg
					-translate-1/2 gap-4 overflow-y-auto overscroll-contain rounded-lg border
					bg-shadcn-background p-6 shadow-lg`,
					className,
					classNames?.base
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

function DialogHeader(props: React.ComponentProps<typeof DialogPrimitive.Header>) {
	const { className, ...restOfProps } = props;

	return (
		<DialogPrimitive.Header
			className={cnMerge("flex flex-col gap-2 text-center sm:text-left", className)}
			{...restOfProps}
		/>
	);
}

function DialogFooter(props: React.ComponentProps<typeof DialogPrimitive.Footer>) {
	const { className, ...restOfProps } = props;

	return (
		<DialogPrimitive.Footer className={cnMerge("flex flex-col gap-2", className)} {...restOfProps} />
	);
}

function DialogTitle(props: React.ComponentProps<typeof DialogPrimitive.Title>) {
	const { className, ...restOfProps } = props;

	return (
		<DialogPrimitive.Title
			className={cnMerge("text-lg leading-none font-semibold", className)}
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

export {
	DialogRoot as Root,
	DialogTrigger as Trigger,
	DialogClose as Close,
	DialogOverlay as Overlay,
	DialogContent as Content,
	DialogHeader as Header,
	DialogFooter as Footer,
	DialogTitle as Title,
	DialogDescription as Description,
};
