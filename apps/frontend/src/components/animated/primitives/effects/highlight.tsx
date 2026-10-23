/* eslint-disable unicorn/prefer-observer-apis */
/* eslint-disable react-you-might-not-need-an-effect/no-event-handler */
/* eslint-disable react/set-state-in-effect */
/* eslint-disable react-you-might-not-need-an-effect/no-derived-state */
/* eslint-disable react/no-unstable-default-props */
"use client";

import { toArray } from "@zayne-labs/toolkit-core";
import { createCustomContext } from "@zayne-labs/toolkit-react";
import type { PolymorphicProps } from "@zayne-labs/toolkit-react/utils";
import { AnimatePresence, motion, type Transition } from "motion/react";
import {
	cloneElement,
	isValidElement,
	useCallback,
	useEffect,
	useId,
	useImperativeHandle,
	useMemo,
	useRef,
	useState,
} from "react";
import { cnMerge } from "@/lib/utils/cn";

type HighlightMode = "children" | "parent";

type Bounds = {
	height: number;
	left: number;
	top: number;
	width: number;
};

const DEFAULT_BOUNDS_OFFSET: Bounds = {
	height: 0,
	left: 0,
	top: 0,
	width: 0,
};

type HighlightContextType<T extends string> = {
	activeClassName?: string;
	activeValue: T | null;
	as?: keyof HTMLElementTagNameMap;
	className?: string;
	clearBounds: () => void;
	click: boolean;
	disabled?: boolean;
	enabled?: boolean;
	exitDelay?: number;
	forceUpdateBounds?: boolean;
	hover: boolean;
	id: string;
	mode: HighlightMode;
	setActiveClassName: (className: string) => void;
	setActiveValue: (value: T | null) => void;
	setBounds: (bounds: DOMRect) => void;
	style?: React.CSSProperties;
	transition?: Transition;
};

const [HighlightContextProvider, useHighlightContext] = createCustomContext<HighlightContextType<string>>({
	hookName: "useHighlightContext",
	name: "HighlightContext",
	providerName: "HighLightRoot",
});

type BaseHighlightProps<T extends React.ElementType = "div"> = {
	as?: T;
	className?: string;
	click?: boolean;
	defaultValue?: string | null;
	disabled?: boolean;
	enabled?: boolean;
	exitDelay?: number;
	hover?: boolean;
	mode?: HighlightMode;
	onValueChange?: (value: string | null) => void;
	ref?: React.Ref<HTMLDivElement>;
	style?: React.CSSProperties;
	transition?: Transition;
	value?: string | null;
};

type ParentModeHighlightProps = {
	boundsOffset?: Partial<Bounds>;
	containerClassName?: string;
	forceUpdateBounds?: boolean;
};

type ControlledParentModeHighlightProps<T extends React.ElementType = "div"> = BaseHighlightProps<T>
	& ParentModeHighlightProps & {
		children: React.ReactNode;
		controlledItems: true;
		mode: "parent";
	};

type ControlledChildrenModeHighlightProps<T extends React.ElementType = "div"> = BaseHighlightProps<T> & {
	children: React.ReactNode;
	controlledItems: true;
	mode?: "children" | undefined;
};

type UncontrolledParentModeHighlightProps<T extends React.ElementType = "div"> = BaseHighlightProps<T>
	& ParentModeHighlightProps & {
		children: React.ReactElement | React.ReactElement[];
		controlledItems?: false;
		itemsClassName?: string;
		mode: "parent";
	};

type UncontrolledChildrenModeHighlightProps<T extends React.ElementType = "div"> =
	BaseHighlightProps<T> & {
		children: React.ReactElement | React.ReactElement[];
		controlledItems?: false;
		itemsClassName?: string;
		mode?: "children";
	};

type HighlightProps<T extends React.ElementType = "div"> =
	| ControlledChildrenModeHighlightProps<T>
	| ControlledParentModeHighlightProps<T>
	| UncontrolledChildrenModeHighlightProps<T>
	| UncontrolledParentModeHighlightProps<T>;

function HighlightRoot<T extends React.ElementType = "div">(props: HighlightProps<T>) {
	const {
		as: Component = "div",
		children,
		className,
		click = true,
		controlledItems,
		defaultValue,
		disabled = false,
		enabled = true,
		exitDelay = 200,
		hover = false,
		mode = "children",
		onValueChange,
		ref,
		style,
		transition = { damping: 35, stiffness: 350, type: "spring" },
		value,
	} = props;

	const localRef = useRef<HTMLDivElement>(null);
	useImperativeHandle(ref, () => localRef.current as HTMLDivElement);

	const propsBoundsOffset = (props as ParentModeHighlightProps).boundsOffset;
	const boundsOffset = propsBoundsOffset ?? DEFAULT_BOUNDS_OFFSET;
	const boundsOffsetTop = boundsOffset.top ?? 0;
	const boundsOffsetLeft = boundsOffset.left ?? 0;
	const boundsOffsetWidth = boundsOffset.width ?? 0;
	const boundsOffsetHeight = boundsOffset.height ?? 0;

	const boundsOffsetRef = useRef({
		height: boundsOffsetHeight,
		left: boundsOffsetLeft,
		top: boundsOffsetTop,
		width: boundsOffsetWidth,
	});

	useEffect(() => {
		boundsOffsetRef.current = {
			height: boundsOffsetHeight,
			left: boundsOffsetLeft,
			top: boundsOffsetTop,
			width: boundsOffsetWidth,
		};
	}, [boundsOffsetTop, boundsOffsetLeft, boundsOffsetWidth, boundsOffsetHeight]);

	const [activeValue, setActiveValue] = useState<string | null>(value ?? defaultValue ?? null);
	const [boundsState, setBoundsState] = useState<Bounds | null>(null);
	const [activeClassNameState, setActiveClassNameState] = useState<string>("");

	const safeSetActiveValue = useCallback(
		(id: string | null) => {
			setActiveValue((prev) => {
				if (prev !== id) {
					onValueChange?.(id);
					return id;
				}
				return prev;
			});
		},
		[onValueChange]
	);

	const safeSetBoundsRef = useRef<((bounds: DOMRect) => void) | undefined>(undefined);

	useEffect(() => {
		safeSetBoundsRef.current = (bounds: DOMRect) => {
			if (!localRef.current) return;

			const containerRect = localRef.current.getBoundingClientRect();
			const offset = boundsOffsetRef.current;
			const newBounds: Bounds = {
				height: bounds.height + offset.height,
				left: bounds.left - containerRect.left + offset.left,
				top: bounds.top - containerRect.top + offset.top,
				width: bounds.width + offset.width,
			};

			setBoundsState((prev) => {
				if (
					prev?.top === newBounds.top
					&& prev.left === newBounds.left
					&& prev.width === newBounds.width
					&& prev.height === newBounds.height
				) {
					return prev;
				}
				return newBounds;
			});
		};
	});

	const safeSetBounds = useCallback((bounds: DOMRect) => {
		safeSetBoundsRef.current?.(bounds);
	}, []);

	const clearBounds = useCallback(() => {
		setBoundsState((prev) => (prev === null ? prev : null));
	}, []);

	useEffect(() => {
		if (value !== undefined) setActiveValue(value);
		else if (defaultValue !== undefined) setActiveValue(defaultValue);
	}, [value, defaultValue]);

	const id = useId();

	useEffect(() => {
		if (mode !== "parent") return;
		const container = localRef.current;
		if (!container) return;

		const onScroll = () => {
			if (!activeValue) return;
			const activeEl = container.querySelector<HTMLElement>(
				`[data-value="${CSS.escape(activeValue)}"][data-highlight="true"]`
			);
			if (activeEl) safeSetBoundsRef.current?.(activeEl.getBoundingClientRect());
		};

		container.addEventListener("scroll", onScroll, { passive: true });
		return () => container.removeEventListener("scroll", onScroll);
	}, [mode, activeValue]);

	const render = (innerChildren: React.ReactNode) => {
		if (mode === "parent") {
			return (
				<Component
					ref={localRef}
					data-slot="motion-highlight-container"
					style={{ position: "relative", zIndex: 1 }}
					className={(props as ParentModeHighlightProps).containerClassName}
				>
					<AnimatePresence initial={false} mode="wait">
						{boundsState && (
							<motion.div
								data-slot="motion-highlight"
								animate={{
									height: boundsState.height,
									left: boundsState.left,
									opacity: 1,
									top: boundsState.top,
									width: boundsState.width,
								}}
								initial={{
									height: boundsState.height,
									left: boundsState.left,
									opacity: 0,
									top: boundsState.top,
									width: boundsState.width,
								}}
								exit={{
									opacity: 0,
									transition: {
										...transition,
										delay: (transition.delay ?? 0) + (exitDelay || 0) / 1000,
									},
								}}
								transition={transition}
								style={{ position: "absolute", zIndex: 0, ...style }}
								className={cnMerge(className, activeClassNameState)}
							/>
						)}
					</AnimatePresence>
					{innerChildren}
				</Component>
			);
		}

		return innerChildren;
	};

	const contextValue = useMemo(
		() => ({
			activeClassName: activeClassNameState,
			activeValue,
			className,
			clearBounds,
			click,
			disabled,
			enabled,
			exitDelay,
			forceUpdateBounds: (props as ParentModeHighlightProps).forceUpdateBounds,
			hover,
			id,
			mode,
			setActiveClassName: setActiveClassNameState,
			setActiveValue: safeSetActiveValue,
			setBounds: safeSetBounds,
			style,
			transition,
		}),
		[
			activeClassNameState,
			activeValue,
			className,
			clearBounds,
			click,
			disabled,
			enabled,
			exitDelay,
			hover,
			id,
			mode,
			props,
			safeSetActiveValue,
			safeSetBounds,
			style,
			transition,
		]
	);

	return (
		<HighlightContextProvider value={contextValue}>
			{enabled ?
				render(
					controlledItems ? children : (
						toArray(children).map((child, index) => (
							// eslint-disable-next-line react/no-array-index-key
							<HighlightItem key={index} className={props.itemsClassName}>
								{child}
							</HighlightItem>
						))
					)
				)
			:	children}
		</HighlightContextProvider>
	);
}

function getNonOverridingDataAttributes(
	element: React.ReactElement,
	dataAttributes: Record<string, unknown>
): Record<string, unknown> {
	return Object.keys(dataAttributes).reduce<Record<string, unknown>>((acc, key) => {
		if ((element.props as Record<string, unknown>)[key] === undefined) {
			acc[key] = dataAttributes[key];
		}
		return acc;
	}, {});
}

type ExtendedChildProps = React.ComponentProps<"div"> & {
	"data-active"?: string;
	"data-disabled"?: boolean;
	"data-highlight"?: boolean;
	"data-slot"?: string;
	"data-value"?: string;
	id?: string;
	ref?: React.Ref<HTMLElement>;
};

type HighlightItemProps<T extends React.ElementType = "div"> = PolymorphicProps<
	T,
	{
		activeClassName?: string;
		as?: T;
		asChild?: boolean;
		className?: string;
		disabled?: boolean;
		exitDelay?: number;
		forceUpdateBounds?: boolean;
		id?: string;
		style?: React.CSSProperties;
		transition?: Transition;
		value?: string;
	}
>;

function HighlightItem<T extends React.ElementType = "div">(
	props: HighlightItemProps<T>
): React.ReactNode {
	const {
		activeClassName,
		as: Component = "div",
		asChild = false,
		children,
		className,
		disabled = false,
		exitDelay,
		forceUpdateBounds,
		id,
		ref,
		style,
		transition,
		value,
		...restOfProps
	} = props;

	const itemId = useId();

	const {
		activeValue,
		className: contextClassName,
		clearBounds,
		click,
		disabled: contextDisabled = disabled,
		enabled,
		exitDelay: contextExitDelay,
		forceUpdateBounds: contextForceUpdateBounds,
		hover,
		id: contextId,
		mode,
		setActiveClassName,
		setActiveValue,
		setBounds,
		style: contextStyle,
		transition: contextTransition,
	} = useHighlightContext();

	const element = children as React.ReactElement<ExtendedChildProps>;
	const childValue = id ?? value ?? element.props["data-value"] ?? element.props.id ?? itemId;
	const isActive = activeValue === childValue;
	const isDisabled = contextDisabled;
	const itemTransition = transition ?? contextTransition;

	const localRef = useRef<HTMLDivElement>(null);
	useImperativeHandle(ref, () => localRef.current as HTMLDivElement);

	const refCallback = useCallback((node: HTMLElement | null) => {
		localRef.current = node as HTMLDivElement;
	}, []);

	useEffect(() => {
		if (mode !== "parent") return;

		let rafId: number;
		let previousBounds: Bounds | null = null;
		const shouldUpdateBounds =
			forceUpdateBounds === true || (contextForceUpdateBounds && forceUpdateBounds !== false);

		const updateBounds = () => {
			if (!localRef.current) return;

			const bounds = localRef.current.getBoundingClientRect();

			if (shouldUpdateBounds) {
				if (
					previousBounds?.top === bounds.top
					&& previousBounds.left === bounds.left
					&& previousBounds.width === bounds.width
					&& previousBounds.height === bounds.height
				) {
					rafId = requestAnimationFrame(updateBounds);
					return;
				}
				previousBounds = bounds;
				rafId = requestAnimationFrame(updateBounds);
			}

			setBounds(bounds);
		};

		if (isActive) {
			updateBounds();
			setActiveClassName(activeClassName ?? "");
		} else if (!activeValue) {
			clearBounds();
		}

		if (!shouldUpdateBounds) return;

		return () => cancelAnimationFrame(rafId);
	}, [
		mode,
		isActive,
		activeValue,
		setBounds,
		clearBounds,
		activeClassName,
		setActiveClassName,
		forceUpdateBounds,
		contextForceUpdateBounds,
	]);

	if (!isValidElement(children)) {
		return children;
	}

	const dataAttributes = {
		"aria-selected": isActive,
		"data-active": isActive ? "true" : "false",
		"data-disabled": isDisabled,
		"data-highlight": true,
		"data-value": childValue,
	};

	const commonHandlers =
		hover ?
			{
				onMouseEnter: (e: React.MouseEvent<HTMLDivElement>) => {
					setActiveValue(childValue);
					element.props.onMouseEnter?.(e);
				},
				onMouseLeave: (e: React.MouseEvent<HTMLDivElement>) => {
					setActiveValue(null);
					element.props.onMouseLeave?.(e);
				},
			}
			// eslint-disable-next-line unicorn/no-nested-ternary
		: click ?
			{
				onClick: (e: React.MouseEvent<HTMLDivElement>) => {
					setActiveValue(childValue);
					element.props.onClick?.(e);
				},
			}
		:	{};

	if (asChild) {
		if (mode === "children") {
			return cloneElement(
				element,
				{
					className: cnMerge("relative", element.props.className),
					key: childValue,
					ref: refCallback,
					...getNonOverridingDataAttributes(element, {
						...dataAttributes,
						"data-slot": "motion-highlight-item-container",
					}),
					...commonHandlers,
					...props,
				},
				<>
					<AnimatePresence initial={false} mode="wait">
						{isActive && !isDisabled && (
							<motion.div
								layoutId={`transition-background-${contextId}`}
								data-slot="motion-highlight"
								style={{
									position: "absolute",
									zIndex: 0,
									...contextStyle,
									...style,
								}}
								className={cnMerge(contextClassName, activeClassName)}
								transition={itemTransition}
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								exit={{
									opacity: 0,
									transition: {
										...itemTransition,
										delay:
											(itemTransition?.delay ?? 0)
											+ (exitDelay ?? contextExitDelay ?? 0) / 1000,
									},
								}}
								{...dataAttributes}
							/>
						)}
					</AnimatePresence>

					<Component
						data-slot="motion-highlight-item"
						style={{ position: "relative", zIndex: 1 }}
						className={className}
						{...dataAttributes}
					>
						{children}
					</Component>
				</>
			);
		}

		return cloneElement(element, {
			ref: refCallback,
			...getNonOverridingDataAttributes(element, {
				...dataAttributes,
				"data-slot": "motion-highlight-item",
			}),
			...commonHandlers,
		});
	}

	return enabled ?
			<Component
				key={childValue}
				ref={localRef}
				data-slot="motion-highlight-item-container"
				className={cnMerge(mode === "children" && "relative", className)}
				{...dataAttributes}
				{...restOfProps}
				{...commonHandlers}
			>
				{mode === "children" && (
					<AnimatePresence initial={false} mode="wait">
						{isActive && !isDisabled && (
							<motion.div
								layoutId={`transition-background-${contextId}`}
								data-slot="motion-highlight"
								style={{
									position: "absolute",
									zIndex: 0,
									...contextStyle,
									...style,
								}}
								className={cnMerge(contextClassName, activeClassName)}
								transition={itemTransition}
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								exit={{
									opacity: 0,
									transition: {
										...itemTransition,
										delay:
											(itemTransition?.delay ?? 0)
											+ (exitDelay ?? contextExitDelay ?? 0) / 1000,
									},
								}}
								{...dataAttributes}
							/>
						)}
					</AnimatePresence>
				)}

				{cloneElement(element, {
					className: element.props.className,
					style: { position: "relative", zIndex: 1 },
					...getNonOverridingDataAttributes(element, {
						...dataAttributes,
						"data-slot": "motion-highlight-item",
					}),
				})}
			</Component>
		:	children;
}

export {
	HighlightRoot as Root,
	HighlightItem as Item,
	// eslint-disable-next-line react-refresh/only-export-components
	useHighlightContext,
};
