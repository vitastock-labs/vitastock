"use client";

import { Accordion as AccordionPrimitive } from "radix-ui";
import { cnMerge } from "@/lib/utils/cn";
import { IconBox } from "../common/IconBox";

function AccordionRoot(props: React.ComponentProps<typeof AccordionPrimitive.Root>) {
	return <AccordionPrimitive.Root data-slot="accordion-root" {...props} />;
}

function AccordionItem(props: React.ComponentProps<typeof AccordionPrimitive.Item>) {
	const { className, ...restOfProps } = props;

	return <AccordionPrimitive.Item data-slot="accordion-item" className={className} {...restOfProps} />;
}

function AccordionTrigger(
	props: React.ComponentProps<typeof AccordionPrimitive.Trigger> & {
		classNames?: { base?: string; header?: string; icon?: string };
		withIcon?: boolean;
	}
) {
	const { children, className, classNames, withIcon = true, ...restOfProps } = props;

	return (
		<AccordionPrimitive.Header className={cnMerge("flex", classNames?.header)}>
			<AccordionPrimitive.Trigger
				data-slot="accordion-trigger"
				className={cnMerge(
					`flex flex-1 items-start justify-between gap-4 rounded-md text-left text-[14px] font-medium
					transition-all outline-none focus-visible:border-shadcn-ring focus-visible:ring-[3px]
					focus-visible:ring-shadcn-ring/50 disabled:pointer-events-none disabled:opacity-50
					[&[data-state=open]>[data-icon]>svg]:rotate-180 [&[data-state=open]>svg]:rotate-180`,
					className,
					classNames?.base
				)}
				{...restOfProps}
			>
				{children}

				{withIcon && (
					<IconBox
						icon="radix-icons:chevron-down"
						className={cnMerge(
							`pointer-events-none size-4 shrink-0 translate-y-0.5 text-shadcn-muted-foreground
							transition-transform duration-200`,
							classNames?.icon
						)}
					/>
				)}
			</AccordionPrimitive.Trigger>
		</AccordionPrimitive.Header>
	);
}

function AccordionContent(props: React.ComponentProps<typeof AccordionPrimitive.Content>) {
	const { children, className, ...restOfProps } = props;

	return (
		<AccordionPrimitive.Content
			data-slot="accordion-content"
			className="overflow-hidden text-[14px] data-[state=closed]:animate-accordion-up
				data-[state=open]:animate-accordion-down"
			{...restOfProps}
		>
			<div className={className}>{children}</div>
		</AccordionPrimitive.Content>
	);
}

export {
	AccordionContent as Content,
	AccordionItem as Item,
	AccordionRoot as Root,
	AccordionTrigger as Trigger,
};
