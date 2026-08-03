"use client";

import { ScrollArea as ScrollAreaPrimitive } from "radix-ui";
import { cnMerge } from "@/lib/utils/cn";

function ScrollAreaRoot(props: React.ComponentProps<typeof ScrollAreaPrimitive.Root>) {
	const { children, className, ...restProps } = props;

	return (
		<ScrollAreaPrimitive.Root
			data-slot="scroll-area-root"
			className={cnMerge("relative", className)}
			{...restProps}
		>
			<ScrollAreaPrimitive.Viewport
				data-slot="scroll-area-viewport"
				className="size-full rounded-[inherit] transition-[color,box-shadow] outline-none
					focus-visible:ring-[3px] focus-visible:ring-shadcn-ring/50 focus-visible:outline-1"
			>
				{children}
			</ScrollAreaPrimitive.Viewport>

			<ScrollAreaScrollBar />

			<ScrollAreaPrimitive.Corner />
		</ScrollAreaPrimitive.Root>
	);
}

function ScrollAreaScrollBar(
	props: React.ComponentProps<typeof ScrollAreaPrimitive.ScrollAreaScrollbar> & {
		classNames?: {
			base?: string;
			thumb?: string;
		};
	}
) {
	const { className, classNames, orientation = "vertical", ...restProps } = props;

	return (
		<ScrollAreaPrimitive.ScrollAreaScrollbar
			data-slot="scroll-area-scrollbar"
			orientation={orientation}
			className={cnMerge(
				"flex touch-none p-px transition-colors select-none",
				orientation === "vertical" && "h-full w-2.5 border-l border-l-transparent",
				orientation === "horizontal" && "h-2.5 flex-col border-t border-t-transparent",
				className,
				classNames?.base
			)}
			{...restProps}
		>
			<ScrollAreaPrimitive.ScrollAreaThumb
				data-slot="scroll-area-thumb"
				className={cnMerge("relative grow rounded-full bg-shadcn-border", classNames?.thumb)}
			/>
		</ScrollAreaPrimitive.ScrollAreaScrollbar>
	);
}

export { ScrollAreaRoot as Root, ScrollAreaScrollBar as ScrollBar };
