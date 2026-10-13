/* eslint-disable react-you-might-not-need-an-effect/no-event-handler */
/* eslint-disable react/set-state-in-effect */
/* eslint-disable react-you-might-not-need-an-effect/no-derived-state */
/* eslint-disable react-you-might-not-need-an-effect/no-chain-state-updates */
/* eslint-disable react-hooks/preserve-manual-memoization */
/* eslint-disable react/no-unstable-default-props */
"use client";

import { toArray } from "@zayne-labs/toolkit-core";
import { createCustomContext } from "@zayne-labs/toolkit-react";
import { motion, type HTMLMotionProps, type Transition } from "motion/react";
import {
	isValidElement,
	useCallback,
	useEffect,
	useImperativeHandle,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import * as HighlightPrimitive from "./effects/highlight";
import { Slot, type WithAsChild } from "./slot";

type TabsContextType = {
	activeValue: string;
	handleValueChange: (value: string) => void;
	registerTrigger: (value: string, node: HTMLElement | null) => void;
};

const [TabsProvider, useTabsContext] = createCustomContext<TabsContextType>({
	hookName: "useTabsContext",
	name: "TabsContext",
	providerName: "TabsRoot",
});

type BaseTabsProps = React.ComponentProps<"div"> & {
	children: React.ReactNode;
};

type UnControlledTabsProps = BaseTabsProps & {
	defaultValue?: string;
	onValueChange?: never;
	value?: never;
};

type ControlledTabsProps = BaseTabsProps & {
	defaultValue?: never;
	onValueChange?: (value: string) => void;
	value: string;
};

type TabsProps = ControlledTabsProps | UnControlledTabsProps;

function TabsRoot(props: TabsProps) {
	const { children, defaultValue, onValueChange, value, ...restOfProps } = props;
	const [activeValue, setActiveValue] = useState(defaultValue);
	const triggersRef = useRef(new Map<string, HTMLElement>());
	const initialSetRef = useRef(false);
	const isControlled = value !== undefined;

	useEffect(() => {
		if (
			!isControlled
			&& activeValue === undefined
			&& triggersRef.current.size > 0
			&& !initialSetRef.current
		) {
			const firstTab = triggersRef.current.keys().next().value;
			if (firstTab !== undefined) {
				setActiveValue(firstTab);
				initialSetRef.current = true;
			}
		}
	}, [activeValue, isControlled]);

	const registerTrigger = useCallback(
		(val: string, node: HTMLElement | null) => {
			if (node) {
				triggersRef.current.set(val, node);
				if (!isControlled && activeValue === undefined && !initialSetRef.current) {
					setActiveValue(val);
					initialSetRef.current = true;
				}
			} else {
				triggersRef.current.delete(val);
			}
		},
		[activeValue, isControlled]
	);

	const handleValueChange = useCallback(
		(val: string) => {
			if (!isControlled) setActiveValue(val);
			else onValueChange?.(val);
		},
		[isControlled, onValueChange]
	);

	return (
		<TabsProvider
			value={{
				activeValue: (value ?? activeValue) as string,
				handleValueChange,
				registerTrigger,
			}}
		>
			<div data-slot="tabs-root" {...restOfProps}>
				{children}
			</div>
		</TabsProvider>
	);
}

type TabsHighlightProps = Omit<
	React.ComponentProps<typeof HighlightPrimitive.Root>,
	"controlledItems" | "value"
>;

function TabsHighlight(props: TabsHighlightProps) {
	const { transition = { damping: 25, stiffness: 200, type: "spring" }, ...restOfProps } = props;
	const { activeValue } = useTabsContext();

	return (
		<HighlightPrimitive.Root
			data-slot="tabs-highlight-root"
			controlledItems={true}
			value={activeValue}
			transition={transition}
			{...restOfProps}
		/>
	);
}

type TabsListProps = React.ComponentProps<"div"> & {
	children: React.ReactNode;
};

function TabsList(props: TabsListProps) {
	return <div role="tablist" data-slot="tabs-list" {...props} />;
}

type TabsHighlightItemProps = React.ComponentProps<typeof HighlightPrimitive.Item> & {
	value: string;
};

function TabsHighlightItem(props: TabsHighlightItemProps) {
	return <HighlightPrimitive.Item data-slot="tabs-highlight-item" {...props} />;
}

type TabsTriggerProps = WithAsChild<
	HTMLMotionProps<"button"> & {
		children: React.ReactNode;
		value: string;
	}
>;

function TabsTrigger(props: TabsTriggerProps) {
	const { asChild = false, ref, value, ...restOfProps } = props;
	const { activeValue, handleValueChange, registerTrigger } = useTabsContext();

	const localRef = useRef<HTMLButtonElement | null>(null);
	useImperativeHandle(ref, () => localRef.current as HTMLButtonElement);

	useEffect(() => {
		registerTrigger(value, localRef.current);
		return () => registerTrigger(value, null);
	}, [value, registerTrigger]);

	const Component = asChild ? Slot : motion.button;

	return (
		<Component
			ref={localRef}
			data-slot="tabs-trigger"
			role="tab"
			onClick={() => handleValueChange(value)}
			data-state={activeValue === value ? "active" : "inactive"}
			{...restOfProps}
		/>
	);
}

type TabsContentsProps = HTMLMotionProps<"div"> & {
	children: React.ReactNode;
	transition?: Transition;
};

function TabsContentList(props: TabsContentsProps) {
	const { children, transition, ...restOfProps } = props;
	const { activeValue } = useTabsContext();
	const childrenArray = toArray(children);
	const activeIndex = childrenArray.findIndex(
		(child): child is React.ReactElement<{ value: string }> =>
			isValidElement(child)
			&& typeof child.props === "object"
			&& child.props !== null
			&& "value" in child.props
			&& child.props.value === activeValue
	);

	const containerRef = useRef<HTMLDivElement | null>(null);
	const itemsRef = useRef<Array<HTMLDivElement | null>>([]);
	const [height, setHeight] = useState(0);
	const roRef = useRef<ResizeObserver | null>(null);

	const measure = useCallback(() => {
		const pane = itemsRef.current[activeIndex];
		const container = containerRef.current;
		if (!pane || !container) return 0;

		const base = pane.getBoundingClientRect().height || 0;

		const cs = getComputedStyle(container);
		const isBorderBox = cs.boxSizing === "border-box";
		const paddingY = (Number(cs.paddingTop || "0") || 0) + (Number(cs.paddingBottom || "0") || 0);
		const borderY = (Number(cs.borderTopWidth || "0") || 0) + (Number(cs.borderBottomWidth || "0") || 0);

		let total = base + (isBorderBox ? paddingY + borderY : 0);

		const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
		total = Math.ceil(total * dpr) / dpr;

		return total;
	}, [activeIndex]);

	useEffect(() => {
		if (roRef.current) {
			roRef.current.disconnect();
			roRef.current = null;
		}

		const pane = itemsRef.current[activeIndex];
		const container = containerRef.current;
		if (!pane || !container) return;

		setHeight(measure());

		const ro = new ResizeObserver(() => {
			const next = measure();
			requestAnimationFrame(() => setHeight(next));
		});

		ro.observe(pane);
		ro.observe(container);

		roRef.current = ro;
		return () => {
			ro.disconnect();
			roRef.current = null;
		};
	}, [activeIndex, childrenArray.length, measure]);

	useLayoutEffect(() => {
		if (height === 0 && activeIndex !== -1) {
			const next = measure();
			if (next !== 0) setHeight(next);
		}
	}, [activeIndex, height, measure]);

	return (
		<motion.div
			ref={containerRef}
			data-slot="tabs-content-list"
			style={{ overflow: "hidden" }}
			animate={{ height }}
			transition={transition}
			{...restOfProps}
		>
			<motion.div
				className="-mx-2 flex"
				animate={{ x: `${activeIndex * -100}%` }}
				transition={transition}
			>
				{childrenArray.map((child, index) => (
					<div
						// eslint-disable-next-line react/no-array-index-key
						key={index}
						ref={(el) => {
							itemsRef.current[index] = el;
						}}
						className="size-full shrink-0 px-2"
					>
						{child}
					</div>
				))}
			</motion.div>
		</motion.div>
	);
}

type TabsContentProps = WithAsChild<
	HTMLMotionProps<"div"> & {
		children: React.ReactNode;
		value: string;
	}
>;

function TabsContent({ asChild = false, style, value, ...props }: TabsContentProps) {
	const { activeValue } = useTabsContext();
	const isActive = activeValue === value;

	const Component = asChild ? Slot : motion.div;

	return (
		<Component
			role="tabpanel"
			data-slot="tabs-content"
			inert={!isActive}
			style={{ overflow: "hidden", ...style }}
			initial={{ filter: "blur(0px)" }}
			animate={{ filter: isActive ? "blur(0px)" : "blur(4px)" }}
			exit={{ filter: "blur(0px)" }}
			transition={{ damping: 25, stiffness: 200, type: "spring" }}
			{...props}
		/>
	);
}

export {
	TabsRoot as Root,
	TabsHighlight as Highlight,
	TabsHighlightItem as HighlightItem,
	TabsTrigger as Trigger,
	TabsList as List,
	TabsContentList as ContentList,
	TabsContent as Content,
	// eslint-disable-next-line react-refresh/only-export-components
	useTabsContext,
};
