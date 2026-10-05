/* eslint-disable react/refs */
/* eslint-disable react/static-components */
"use client";

import { composeRefs, mergeProps } from "@zayne-labs/toolkit-react/utils";
import { isObject } from "@zayne-labs/toolkit-type-helpers";
import { isMotionComponent, motion, type HTMLMotionProps } from "motion/react";
import { isValidElement, useMemo } from "react";

type AnyProps = Record<string, unknown>;

type DOMMotionProps<T extends HTMLElement = HTMLElement> = Omit<
	HTMLMotionProps<keyof HTMLElementTagNameMap>,
	"ref"
> & { ref?: React.Ref<T> };

type WithAsChild<Base extends object> =
	(Base & { asChild: true; children: React.ReactElement }) | (Base & { asChild?: false | undefined });

type SlotProps<TElement extends HTMLElement = HTMLElement> = DOMMotionProps<TElement> & {
	children?: unknown;
};

function Slot<TElement extends HTMLElement = HTMLElement>(props: SlotProps<TElement>) {
	const { children, ref, ...restOfProps } = props;
	const childrenType = (children as React.ReactElement | undefined)?.type as React.ElementType;
	const isAlreadyMotion = isObject(childrenType) && isMotionComponent(childrenType);

	const Base = useMemo(
		() => (isAlreadyMotion ? childrenType : motion.create(childrenType)),
		[isAlreadyMotion, childrenType]
	);

	if (!isValidElement(children)) {
		return null;
	}

	const { ref: childRef, ...childProps } = children.props as AnyProps;

	const mergedProps = mergeProps(childProps, restOfProps);

	return <Base {...mergedProps} ref={composeRefs(childRef as React.Ref<TElement>, ref)} />;
}

export { Slot, type SlotProps, type WithAsChild, type DOMMotionProps, type AnyProps };
