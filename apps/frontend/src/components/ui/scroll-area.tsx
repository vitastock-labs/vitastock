"use client";

import { ScrollArea as ScrollAreaPrimitive } from "radix-ui";
import { cnMerge } from "@/lib/utils/cn";

function ScrollAreaRoot(
	props: React.ComponentProps<typeof ScrollAreaPrimitive.Root> & {
		classNames?: {
			base?: string;
			corner?: string;
			scrollbar?: string;
			thumb?: string;
			viewport?: string;
		};
		orientation?: "both" | "horizontal" | "vertical";
	}
) {
	const { children, className, classNames, orientation, ...restProps } = props;
	const hasHorizontalScrollbar = orientation === "both" || orientation === "horizontal";
	const hasVerticalScrollbar =
		orientation === undefined || orientation === "both" || orientation === "vertical";

	return (
		<ScrollAreaPrimitive.Root
			data-slot="scroll-area-root"
			className={cnMerge("relative", className, classNames?.base)}
			{...restProps}
		>
			<ScrollAreaPrimitive.Viewport
				data-slot="scroll-area-viewport"
				className={cnMerge(
					`size-full rounded-[inherit] transition-[color,box-shadow] outline-none
					focus-visible:ring-[3px] focus-visible:ring-shadcn-ring/50 focus-visible:outline-1`,
					classNames?.viewport
				)}
			>
				{children}
			</ScrollAreaPrimitive.Viewport>

			{hasVerticalScrollbar && (
				<ScrollAreaScrollBar
					classNames={{ base: classNames?.scrollbar, thumb: classNames?.thumb }}
					orientation="vertical"
				/>
			)}
			{hasHorizontalScrollbar && (
				<ScrollAreaScrollBar
					classNames={{ base: classNames?.scrollbar, thumb: classNames?.thumb }}
					orientation="horizontal"
				/>
			)}

			<ScrollAreaPrimitive.Corner className={classNames?.corner} />
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
			data-orientation={orientation}
			orientation={orientation}
			className={cnMerge(
				`flex touch-none p-px transition-colors select-none data-[state=hidden]:animate-fade-out
				data-horizontal:h-2.5 data-horizontal:flex-col data-horizontal:border-t
				data-horizontal:border-t-transparent data-vertical:h-full data-vertical:w-2.5
				data-vertical:border-l data-vertical:border-l-transparent`,
				className,
				classNames?.base
			)}
			{...restProps}
		>
			<ScrollAreaPrimitive.ScrollAreaThumb
				data-slot="scroll-area-thumb"
				className={cnMerge(
					"relative grow rounded-full bg-vitastock-primary-main/35 hover:bg-vitastock-primary-main/55",
					classNames?.thumb
				)}
			/>
		</ScrollAreaPrimitive.ScrollAreaScrollbar>
	);
}

export { ScrollAreaRoot as Root, ScrollAreaScrollBar as ScrollBar };
