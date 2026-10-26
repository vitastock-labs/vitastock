/* eslint-disable react/no-unstable-default-props */
import { createCustomContext, useCallbackRef, useToggle } from "@zayne-labs/toolkit-react";
import { isFunction } from "@zayne-labs/toolkit-type-helpers";
import { AnimatePresence, motion, type HTMLMotionProps, type Transition } from "motion/react";
import { Collapsible as CollapsiblePrimitive } from "radix-ui";
import { useCallback, useMemo } from "react";
import { cnMerge } from "@/lib/utils/cn";

type ContextValue = {
	isOpen: boolean;
	onClose: () => void;
	onOpen: () => void;
	setOpen: (open: boolean) => void;
};

const [CollapsibleContextProvider, useCollapsibleContext] = createCustomContext<ContextValue>();

function CollapsibleRoot(props: React.ComponentProps<typeof CollapsiblePrimitive.Root>) {
	const { defaultOpen, onOpenChange: setOpenProp, open: openProp, ...restOfProps } = props;

	const savedSetOpenProp = useCallbackRef(setOpenProp);

	const [internalOpen, toggleInternalOpen] = useToggle(defaultOpen);

	// == Use the open prop if it is provided
	// == Otherwise, use the internal open state
	const isOpen = openProp ?? internalOpen;

	const setOpen = useCallback(
		(value: boolean | ((value: boolean) => boolean)) => {
			const resolvedValue = isFunction(value) ? value(isOpen) : value;

			// == Call the onOpenChange prop if the openProp is provided
			// == Otherwise, toggle the internal open state
			const selectedOpenChange = openProp ? savedSetOpenProp : toggleInternalOpen;

			selectedOpenChange?.(resolvedValue);
		},
		[isOpen, openProp, savedSetOpenProp, toggleInternalOpen]
	);

	const onClose = useCallbackRef(() => setOpen(false));
	const onOpen = useCallbackRef(() => setOpen(true));

	const contextValue = useMemo(
		() => ({ isOpen, onClose, onOpen, setOpen }) satisfies ContextValue,
		[onClose, onOpen, isOpen, setOpen]
	);

	return (
		<CollapsibleContextProvider value={contextValue}>
			<CollapsiblePrimitive.Root
				{...restOfProps}
				data-slot="collapsible-root"
				open={isOpen}
				onOpenChange={setOpen}
			/>
		</CollapsibleContextProvider>
	);
}

function CollapsibleTrigger(props: React.ComponentProps<typeof CollapsiblePrimitive.Trigger>) {
	const { className, ...restOfProps } = props;

	return (
		<CollapsiblePrimitive.Trigger
			data-slot="collapsible-trigger"
			className={cnMerge("flex w-full items-center justify-between", className)}
			{...restOfProps}
		/>
	);
}

function CollapsibleContent(
	props: HTMLMotionProps<"li">
		& React.ComponentProps<typeof CollapsiblePrimitive.Content> & {
			keepRendered?: boolean;
			transition?: Transition;
		}
) {
	const {
		children,
		keepRendered = false,
		transition = { duration: 0.35, ease: "easeInOut" },
		...restOfProps
	} = props;

	const { isOpen } = useCollapsibleContext();

	return (
		<AnimatePresence>
			{keepRendered ?
				<CollapsiblePrimitive.Content asChild={true} forceMount={true}>
					<motion.li
						key="collapsible-content"
						data-slot="collapsible-content"
						layout={true}
						initial={{ height: 0, opacity: 0, overflow: "hidden", y: 20 }}
						animate={
							isOpen ?
								{ height: "auto", opacity: 1, overflow: "hidden", y: 0 }
							:	{ height: 0, opacity: 0, overflow: "hidden", y: 20 }
						}
						transition={transition}
						{...restOfProps}
					>
						{children}
					</motion.li>
				</CollapsiblePrimitive.Content>
			:	isOpen && (
					<CollapsiblePrimitive.Content asChild={true} forceMount={true}>
						<motion.li
							key="collapsible-content"
							data-slot="collapsible-content"
							layout={true}
							initial={{ height: 0, opacity: 0, overflow: "hidden", y: 20 }}
							animate={{ height: "auto", opacity: 1, overflow: "hidden", y: 0 }}
							exit={{ height: 0, opacity: 0, overflow: "hidden", y: 20 }}
							transition={transition}
							{...restOfProps}
						>
							{children}
						</motion.li>
					</CollapsiblePrimitive.Content>
				)
			}
		</AnimatePresence>
	);
}

export {
	CollapsibleRoot as Root,
	CollapsibleTrigger as Trigger,
	CollapsibleContent as Content,
	// eslint-disable-next-line react-refresh/only-export-components
	useCollapsibleContext,
};
