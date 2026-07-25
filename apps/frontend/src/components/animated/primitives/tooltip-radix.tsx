/* eslint-disable react/immutability */
/* eslint-disable react/no-unstable-default-props */
"use client";

import { createCustomContext, useControllableState } from "@zayne-labs/toolkit-react";
import {
	AnimatePresence,
	motion,
	useMotionValue,
	useSpring,
	type HTMLMotionProps,
	type MotionValue,
	type SpringOptions,
} from "motion/react";
import { Tooltip as TooltipPrimitive } from "radix-ui";
import { useMemo } from "react";

type TooltipContextType = {
	followCursor?: "x" | "y" | boolean;
	followCursorSpringOptions?: SpringOptions;
	isOpen: boolean;
	setIsOpen: (isOpen: boolean) => void;
	x: MotionValue<number>;
	y: MotionValue<number>;
};

const [TooltipProviderLocal, useTooltipContext] = createCustomContext<TooltipContextType>({
	hookName: "useTooltipContext",
	name: "TooltipContext",
	providerName: "TooltipRoot",
});

function TooltipProvider(props: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
	return <TooltipPrimitive.Provider data-slot="tooltip-provider" {...props} />;
}

function TooltipRoot(
	props: Pick<TooltipContextType, "followCursor" | "followCursorSpringOptions">
		& React.ComponentProps<typeof TooltipPrimitive.Root>
) {
	const {
		defaultOpen,
		followCursor = false,
		followCursorSpringOptions = {
			damping: 17,
			stiffness: 200,
		},
		onOpenChange,
		open,
		...restOfProps
	} = props;

	const [isOpen, setIsOpen] = useControllableState({
		defaultProp: defaultOpen,
		onChange: onOpenChange,
		prop: open,
	});

	const x = useMotionValue(0);
	const y = useMotionValue(0);

	const contextValue = useMemo(
		() => ({ followCursor, followCursorSpringOptions, isOpen, setIsOpen, x, y }),
		[isOpen, setIsOpen, x, y, followCursor, followCursorSpringOptions]
	);

	return (
		<TooltipProviderLocal value={contextValue}>
			<TooltipPrimitive.Root
				data-slot="tooltip-root"
				{...restOfProps}
				open={isOpen}
				onOpenChange={setIsOpen}
			/>
		</TooltipProviderLocal>
	);
}

function TooltipTrigger(props: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
	const { onMouseMove, ...restOfProps } = props;

	const { followCursor, x, y } = useTooltipContext();

	const handleMouseMove = (event: React.MouseEvent<HTMLButtonElement>) => {
		onMouseMove?.(event);

		const target = event.currentTarget.getBoundingClientRect();

		if (followCursor === "x" || followCursor === true) {
			const eventOffsetX = event.clientX - target.left;
			const offsetXFromCenter = (eventOffsetX - target.width / 2) / 2;
			x.set(offsetXFromCenter);
		}

		if (followCursor === "y" || followCursor === true) {
			const eventOffsetY = event.clientY - target.top;
			const offsetYFromCenter = (eventOffsetY - target.height / 2) / 2;
			y.set(offsetYFromCenter);
		}
	};

	return (
		<TooltipPrimitive.Trigger
			data-slot="tooltip-trigger"
			{...restOfProps}
			onMouseMove={handleMouseMove}
		/>
	);
}

function TooltipPortal(props: Omit<React.ComponentProps<typeof TooltipPrimitive.Portal>, "forceMount">) {
	const { isOpen } = useTooltipContext();

	return (
		<AnimatePresence>
			{isOpen && <TooltipPrimitive.Portal forceMount={true} data-slot="tooltip-portal" {...props} />}
		</AnimatePresence>
	);
}

function TooltipContent(
	props: HTMLMotionProps<"div">
		& Omit<React.ComponentProps<typeof TooltipPrimitive.Content>, "asChild" | "forceMount">
) {
	const {
		align,
		alignOffset,
		arrowPadding,
		avoidCollisions,
		collisionBoundary,
		collisionPadding,
		hideWhenDetached,
		onEscapeKeyDown,
		onPointerDownOutside,
		side,
		sideOffset,
		sticky,
		style,
		transition = { damping: 25, stiffness: 300, type: "spring" },
		...restOfProps
	} = props;

	const { followCursor, followCursorSpringOptions, x, y } = useTooltipContext();
	const translateX = useSpring(x, followCursorSpringOptions);
	const translateY = useSpring(y, followCursorSpringOptions);

	return (
		<TooltipPrimitive.Content
			asChild={true}
			forceMount={true}
			align={align}
			alignOffset={alignOffset}
			side={side}
			sideOffset={sideOffset}
			avoidCollisions={avoidCollisions}
			collisionBoundary={collisionBoundary}
			collisionPadding={collisionPadding}
			arrowPadding={arrowPadding}
			sticky={sticky}
			hideWhenDetached={hideWhenDetached}
			onEscapeKeyDown={onEscapeKeyDown}
			onPointerDownOutside={onPointerDownOutside}
		>
			<motion.div
				key="popover-content"
				data-slot="popover-content"
				initial={{ opacity: 0, scale: 0.5 }}
				animate={{ opacity: 1, scale: 1 }}
				exit={{ opacity: 0, scale: 0.5 }}
				transition={transition}
				style={{
					x: followCursor === "x" || followCursor === true ? translateX : undefined,
					y: followCursor === "y" || followCursor === true ? translateY : undefined,
					...style,
				}}
				{...restOfProps}
			/>
		</TooltipPrimitive.Content>
	);
}

function TooltipArrow(props: React.ComponentProps<typeof TooltipPrimitive.Arrow>) {
	return <TooltipPrimitive.Arrow data-slot="tooltip-arrow" {...props} />;
}

export {
	TooltipProvider as Provider,
	TooltipRoot as Root,
	TooltipTrigger as Trigger,
	TooltipPortal as Portal,
	TooltipContent as Content,
	TooltipArrow as Arrow,
	// eslint-disable-next-line react-refresh/only-export-components
	useTooltipContext,
};
