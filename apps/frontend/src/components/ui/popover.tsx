"use client";

import { Popover as PopoverPrimitive } from "radix-ui";
import { cnMerge } from "@/lib/utils/cn";

function PopoverRoot(props: React.ComponentProps<typeof PopoverPrimitive.Root>) {
	return <PopoverPrimitive.Root data-slot="popover-root" {...props} />;
}

function PopoverTrigger(props: React.ComponentProps<typeof PopoverPrimitive.Trigger>) {
	return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
}

function PopoverContent(props: React.ComponentProps<typeof PopoverPrimitive.Content>) {
	const { align = "center", className, sideOffset = 4, ...restOfProps } = props;

	return (
		<PopoverPrimitive.Portal>
			<PopoverPrimitive.Content
				data-slot="popover-content"
				align={align}
				sideOffset={sideOffset}
				className={cnMerge(
					`z-50 w-72 origin-(--radix-popover-content-transform-origin) rounded-md border
					border-transparent bg-shadcn-popover p-4 text-shadcn-popover-foreground shadow-xl
					shadow-black/20 outline-hidden data-[side=bottom]:slide-in-from-top-2
					data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2
					data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out
					data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in
					data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95`,
					className
				)}
				{...restOfProps}
			/>
		</PopoverPrimitive.Portal>
	);
}
function PopoverAnchor(props: React.ComponentProps<typeof PopoverPrimitive.Anchor>) {
	return <PopoverPrimitive.Anchor data-slot="popover-anchor" {...props} />;
}

export {
	PopoverRoot as Root,
	PopoverContent as Content,
	PopoverTrigger as Trigger,
	PopoverAnchor as Anchor,
};
