/* eslint-disable react/set-state-in-effect */
"use client";

import {
	autoUpdate,
	flip,
	FloatingArrow,
	arrow as floatingArrow,
	offset as floatingOffset,
	FloatingPortal,
	shift,
	useFloating,
	type UseFloatingReturn,
} from "@floating-ui/react";
import { createCustomContext } from "@zayne-labs/toolkit-react";
import { AnimatePresence, LayoutGroup, motion, type HTMLMotionProps, type Transition } from "motion/react";
import {
	useCallback,
	useEffect,
	useId,
	useImperativeHandle,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { Slot, type WithAsChild } from "./slot";

type Side = "bottom" | "left" | "right" | "top";
type Align = "center" | "end" | "start";

type TooltipData = {
	align: Align;
	alignOffset: number;
	contentAsChild: boolean;
	contentProps: HTMLMotionProps<"div">;
	id: string;
	rect: DOMRect;
	side: Side;
	sideOffset: number;
};

type GlobalTooltipContextType = {
	currentTooltip: TooltipData | null;
	globalId: string;
	hideImmediate: () => void;
	hideTooltip: () => void;
	referenceElRef: React.RefObject<HTMLElement | null>;
	setReferenceEl: (el: HTMLElement | null) => void;
	showTooltip: (data: TooltipData) => void;
	transition: Transition;
};

const [TooltipProviderGlobal, useGlobalTooltipContext] = createCustomContext<GlobalTooltipContextType>({
	hookName: "useGlobalTooltipContext",
	name: "GlobalTooltipProvider",
});

type TooltipContextType = {
	align: Align;
	alignOffset: number;
	asChild: boolean;
	id: string;
	props: HTMLMotionProps<"div">;
	setAsChild: React.Dispatch<React.SetStateAction<boolean>>;
	setProps: React.Dispatch<React.SetStateAction<HTMLMotionProps<"div">>>;
	side: Side;
	sideOffset: number;
};

const [TooltipProviderLocal, useTooltipContext] = createCustomContext<TooltipContextType>({
	hookName: "useTooltipContext",
	name: "TooltipContextLocal",
	providerName: "TooltipProviderLocal",
});

function getResolvedSide(placement: `${Side}-${Align}` | Side) {
	if (placement.includes("-")) {
		return placement.split("-")[0] as Side;
	}
	return placement as Side;
}

type TooltipPosition = { x: number; y: number };

function initialFromSide(side: Side): Partial<TooltipPosition> {
	if (side === "top") return { y: 15 };
	if (side === "bottom") return { y: -15 };
	if (side === "left") return { x: 15 };
	return { x: -15 };
}

type TooltipProviderProps = {
	children: React.ReactNode;
	closeDelay?: number;
	id?: string;
	openDelay?: number;
	transition?: Transition;
};

function TooltipProvider(props: TooltipProviderProps) {
	const { children, closeDelay = 300, id, openDelay = 700, transition } = props;

	const globalId = useId();
	const [currentTooltip, setCurrentTooltip] = useState<TooltipData | null>(null);
	const timeoutRef = useRef<number | null>(null);
	const lastCloseTimeRef = useRef(0);
	const referenceElRef = useRef<HTMLElement | null>(null);

	const showTooltip = useCallback(
		(data: TooltipData) => {
			if (timeoutRef.current) clearTimeout(timeoutRef.current);
			if (currentTooltip !== null) {
				setCurrentTooltip(data);
				return;
			}
			const now = Date.now();
			const delay = now - lastCloseTimeRef.current < closeDelay ? 0 : openDelay;
			timeoutRef.current = window.setTimeout(() => setCurrentTooltip(data), delay);
		},
		[openDelay, closeDelay, currentTooltip]
	);

	const hideTooltip = useCallback(() => {
		if (timeoutRef.current) clearTimeout(timeoutRef.current);
		timeoutRef.current = window.setTimeout(() => {
			setCurrentTooltip(null);
			lastCloseTimeRef.current = Date.now();
		}, closeDelay);
	}, [closeDelay]);

	const hideImmediate = useCallback(() => {
		if (timeoutRef.current) clearTimeout(timeoutRef.current);
		setCurrentTooltip(null);
		lastCloseTimeRef.current = Date.now();
	}, []);

	const setReferenceEl = useCallback((el: HTMLElement | null) => {
		referenceElRef.current = el;
	}, []);

	useEffect(() => {
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") hideImmediate();
		};

		window.addEventListener("keydown", onKeyDown, true);
		window.addEventListener("scroll", hideImmediate, true);
		window.addEventListener("resize", hideImmediate, true);
		return () => {
			window.removeEventListener("keydown", onKeyDown, true);
			window.removeEventListener("scroll", hideImmediate, true);
			window.removeEventListener("resize", hideImmediate, true);
		};
	}, [hideImmediate]);

	const contextValue = useMemo(
		() => ({
			currentTooltip,
			globalId: id ?? globalId,
			hideImmediate,
			hideTooltip,
			referenceElRef,
			setReferenceEl,
			showTooltip,
			transition: transition ?? { damping: 35, stiffness: 300, type: "spring" },
		}),
		[currentTooltip, globalId, hideImmediate, hideTooltip, id, setReferenceEl, showTooltip, transition]
	);

	return (
		<TooltipProviderGlobal value={contextValue}>
			<LayoutGroup>{children}</LayoutGroup>
			<TooltipOverlay />
		</TooltipProviderGlobal>
	);
}

type RenderedTooltipContextType = {
	align: Align;
	open: boolean;
	side: Side;
};

const [RenderedTooltipProvider, useRenderedTooltipContext] =
	createCustomContext<RenderedTooltipContextType>({
		hookName: "useRenderedTooltipContext",
		name: "RenderedTooltipContext",
	});

type FloatingContextType = {
	arrowRef: React.RefObject<SVGSVGElement | null>;
	context: UseFloatingReturn["context"];
};

const [FloatingProvider, useFloatingContext] = createCustomContext<FloatingContextType>({
	hookName: "useFloatingContext",
	name: "FloatingContext",
});

const MotionTooltipArrow = motion.create(FloatingArrow);

type TooltipArrowProps = Omit<React.ComponentProps<typeof MotionTooltipArrow>, "context"> & {
	withTransition?: boolean;
};

function TooltipArrow(props: TooltipArrowProps) {
	const { ref, withTransition = true, ...restOfProps } = props;
	const { align, open, side } = useRenderedTooltipContext();
	const { arrowRef, context } = useFloatingContext();
	const { globalId, transition } = useGlobalTooltipContext();

	useImperativeHandle(ref, () => arrowRef.current as SVGSVGElement);

	const deg = { bottom: 180, left: -90, right: 90, top: 0 }[side];

	return (
		<MotionTooltipArrow
			ref={arrowRef}
			context={context}
			data-state={open ? "open" : "closed"}
			data-side={side}
			data-align={align}
			data-slot="tooltip-arrow"
			style={{ rotate: deg }}
			layoutId={withTransition ? `tooltip-arrow-${globalId}` : undefined}
			transition={withTransition ? transition : undefined}
			{...restOfProps}
		/>
	);
}

type TooltipPortalProps = React.ComponentProps<typeof FloatingPortal>;

function TooltipPortal(props: TooltipPortalProps) {
	return <FloatingPortal {...props} />;
}

function TooltipOverlay() {
	const { currentTooltip, globalId, referenceElRef, transition } = useGlobalTooltipContext();

	const [rendered, setRendered] = useState<{
		data: TooltipData | null;
		open: boolean;
	}>({ data: null, open: false });

	const arrowRef = useRef<SVGSVGElement | null>(null);

	const side = rendered.data?.side ?? "top";
	const align = rendered.data?.align ?? "center";

	const { context, refs, strategy, update, x, y } = useFloating({
		middleware: [
			floatingOffset({
				crossAxis: rendered.data?.alignOffset ?? 0,
				mainAxis: rendered.data?.sideOffset ?? 0,
			}),
			flip(),
			shift({ padding: 8 }),
			floatingArrow({ element: arrowRef }),
		],
		placement: align === "center" ? side : `${side}-${align}`,
		whileElementsMounted: autoUpdate,
	});

	useEffect(() => {
		if (currentTooltip) {
			setRendered({ data: currentTooltip, open: true });
		} else {
			setRendered((p) => (p.data ? { ...p, open: false } : p));
		}
	}, [currentTooltip]);

	useLayoutEffect(() => {
		if (referenceElRef.current) {
			refs.setReference(referenceElRef.current);
			update();
		}
	}, [referenceElRef, refs, update, rendered.data]);

	// eslint-disable-next-line ts-eslint/no-unnecessary-condition
	const ready = x != null && y != null;
	const Component = rendered.data?.contentAsChild ? Slot : motion.div;
	const resolvedSide = getResolvedSide(context.placement);

	return (
		<AnimatePresence mode="wait">
			{rendered.data && ready && (
				<TooltipPortal>
					<div
						ref={refs.setFloating}
						data-slot="tooltip-overlay"
						data-side={resolvedSide}
						data-align={rendered.data.align}
						data-state={rendered.open ? "open" : "closed"}
						style={{
							left: 0,
							position: strategy,
							top: 0,
							transform: `translate3d(${x}px, ${y}px, 0)`,
							zIndex: 50,
						}}
					>
						<FloatingProvider value={{ arrowRef, context }}>
							<RenderedTooltipProvider
								value={{
									align: rendered.data.align,
									open: rendered.open,
									side: resolvedSide,
								}}
							>
								<Component
									data-slot="tooltip-content"
									data-side={resolvedSide}
									data-align={rendered.data.align}
									data-state={rendered.open ? "open" : "closed"}
									layoutId={`tooltip-content-${globalId}`}
									initial={{
										opacity: 0,
										scale: 0,
										...initialFromSide(rendered.data.side),
									}}
									animate={
										rendered.open ?
											{ opacity: 1, scale: 1, x: 0, y: 0 }
										:	{
												opacity: 0,
												scale: 0,
												...initialFromSide(rendered.data.side),
											}
									}
									exit={{
										opacity: 0,
										scale: 0,
										...initialFromSide(rendered.data.side),
									}}
									onAnimationComplete={() => {
										if (!rendered.open) setRendered({ data: null, open: false });
									}}
									transition={transition}
									{...rendered.data.contentProps}
									style={{
										position: "relative",
										...rendered.data.contentProps.style,
									}}
								/>
							</RenderedTooltipProvider>
						</FloatingProvider>
					</div>
				</TooltipPortal>
			)}
		</AnimatePresence>
	);
}

type TooltipRootProps = {
	align?: Align;
	alignOffset?: number;
	children: React.ReactNode;
	side?: Side;
	sideOffset?: number;
};

function TooltipRoot(props: TooltipRootProps) {
	const { align = "center", alignOffset = 0, children, side = "top", sideOffset = 0 } = props;
	const id = useId();
	const [motionProps, setMotionProps] = useState<HTMLMotionProps<"div">>({});
	const [asChild, setAsChild] = useState(false);

	const contextValue = useMemo(
		() => ({
			align,
			alignOffset,
			asChild,
			id,
			props: motionProps,
			setAsChild,
			setProps: setMotionProps,
			side,
			sideOffset,
		}),
		[align, alignOffset, asChild, id, motionProps, side, sideOffset]
	);

	return <TooltipProviderLocal value={contextValue}>{children}</TooltipProviderLocal>;
}

type TooltipContentProps = WithAsChild<HTMLMotionProps<"div">>;

function shallowEqualWithoutChildren(a?: HTMLMotionProps<"div">, b?: HTMLMotionProps<"div">) {
	if (a === b) return true;
	if (!a || !b) return false;
	const keysA = Object.keys(a).filter((k) => k !== "children");
	const keysB = Object.keys(b).filter((k) => k !== "children");
	if (keysA.length !== keysB.length) return false;
	for (const k of keysA) {
		// @ts-expect-error index -- Not my code
		if (a[k] !== b[k]) return false;
	}
	return true;
}

function TooltipContent(props: TooltipContentProps) {
	const { asChild = false } = props;
	const { setAsChild, setProps } = useTooltipContext();
	const lastPropsRef = useRef<HTMLMotionProps<"div"> | undefined>(undefined);

	useEffect(() => {
		if (!shallowEqualWithoutChildren(lastPropsRef.current, props)) {
			lastPropsRef.current = props;
			setProps(props);
		}
	}, [props, setProps]);

	useEffect(() => {
		setAsChild(asChild);
	}, [asChild, setAsChild]);

	return null;
}

type TooltipTriggerProps = WithAsChild<HTMLMotionProps<"div">>;

function TooltipTrigger(props: TooltipTriggerProps) {
	const {
		asChild = false,
		onBlur,
		onFocus,
		onMouseEnter,
		onMouseLeave,
		onPointerDown,
		ref,
		...restOfProps
	} = props;

	const {
		align,
		alignOffset,
		asChild: contentAsChild,
		id,
		props: contentProps,
		side,
		sideOffset,
	} = useTooltipContext();
	const { currentTooltip, hideImmediate, hideTooltip, setReferenceEl, showTooltip } =
		useGlobalTooltipContext();

	const triggerRef = useRef<HTMLDivElement>(null);
	useImperativeHandle(ref, () => triggerRef.current as HTMLDivElement);

	const suppressNextFocusRef = useRef(false);

	const handleOpen = useCallback(() => {
		if (!triggerRef.current) return;
		setReferenceEl(triggerRef.current);
		const rect = triggerRef.current.getBoundingClientRect();
		showTooltip({
			align,
			alignOffset,
			contentAsChild,
			contentProps,
			id,
			rect,
			side,
			sideOffset,
		});
	}, [
		showTooltip,
		setReferenceEl,
		contentProps,
		contentAsChild,
		side,
		sideOffset,
		align,
		alignOffset,
		id,
	]);

	const handlePointerDown = useCallback(
		(e: React.PointerEvent<HTMLDivElement>) => {
			onPointerDown?.(e);
			if (currentTooltip?.id === id) {
				suppressNextFocusRef.current = true;
				hideImmediate();
				void Promise.resolve().then(() => {
					suppressNextFocusRef.current = false;
				});
			}
		},
		[onPointerDown, currentTooltip?.id, id, hideImmediate]
	);

	const handleMouseEnter = useCallback(
		(e: React.MouseEvent<HTMLDivElement>) => {
			onMouseEnter?.(e);
			handleOpen();
		},
		[handleOpen, onMouseEnter]
	);

	const handleMouseLeave = useCallback(
		(e: React.MouseEvent<HTMLDivElement>) => {
			onMouseLeave?.(e);
			hideTooltip();
		},
		[hideTooltip, onMouseLeave]
	);

	const handleFocus = useCallback(
		(e: React.FocusEvent<HTMLDivElement>) => {
			onFocus?.(e);
			if (suppressNextFocusRef.current) return;
			handleOpen();
		},
		[handleOpen, onFocus]
	);

	const handleBlur = useCallback(
		(e: React.FocusEvent<HTMLDivElement>) => {
			onBlur?.(e);
			hideTooltip();
		},
		[hideTooltip, onBlur]
	);

	const Component = asChild ? Slot : motion.div;

	return (
		<Component
			ref={triggerRef}
			onPointerDown={handlePointerDown}
			onMouseEnter={handleMouseEnter}
			onMouseLeave={handleMouseLeave}
			onFocus={handleFocus}
			onBlur={handleBlur}
			data-slot="tooltip-trigger"
			data-side={side}
			data-align={align}
			data-state={currentTooltip?.id === id ? "open" : "closed"}
			{...restOfProps}
		/>
	);
}

export {
	TooltipProvider as Provider,
	TooltipRoot as Root,
	TooltipContent as Content,
	TooltipTrigger as Trigger,
	TooltipArrow as Arrow,
	// eslint-disable-next-line react-refresh/only-export-components
	useGlobalTooltipContext,
	// eslint-disable-next-line react-refresh/only-export-components
	useTooltipContext,
};
