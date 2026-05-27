/* eslint-disable react/no-nested-component-definitions */

import { DayButton, DayPicker, getDefaultClassNames } from "@daypicker/react";
import type { ExtractUnion } from "@zayne-labs/toolkit-type-helpers";
import { useEffect, useRef } from "react";
import { cnMerge } from "@/lib/utils/cn";
import { IconBox } from "../common/IconBox";
import { shadcnButtonVariants, type ShadcnButtonProps } from "./constants";

export function Calendar(
	props: React.ComponentProps<typeof DayPicker> & {
		buttonVariant?: ExtractUnion<(typeof shadcnButtonVariants)["variants"]["variant"]>;
		classNames?: React.ComponentProps<typeof DayPicker>["classNames"] & { base?: string };
	}
) {
	const {
		buttonVariant = "ghost",
		captionLayout = "label",
		className,
		classNames,
		components,
		formatters,
		showOutsideDays = true,
		...restOfProps
	} = props;

	const defaultClassNames = getDefaultClassNames();

	return (
		<DayPicker
			showOutsideDays={showOutsideDays}
			className={cnMerge(
				`group/calendar bg-shadcn-background p-3 [--cell-size:--spacing(8)]
				in-data-[slot=card-content]:bg-transparent in-data-[slot=popover-content]:bg-transparent`,
				// prettier-ignore
				// eslint-disable-next-line react-hooks/todo
				String.raw`rtl:**:[.rdp-button\_next>svg]:rotate-180`,
				// prettier-ignore
				// eslint-disable-next-line react-hooks/todo
				String.raw`rtl:**:[.rdp-button\_previous>svg]:rotate-180`,
				className,
				classNames?.base
			)}
			captionLayout={captionLayout}
			formatters={{
				formatMonthDropdown: (date) => date.toLocaleString("default", { month: "short" }),
				...formatters,
			}}
			classNames={{
				...classNames,

				button_next: cnMerge(
					shadcnButtonVariants({ variant: buttonVariant }),
					"size-(--cell-size) p-0 select-none aria-disabled:opacity-50",
					defaultClassNames.button_next,
					classNames?.button_next
				),
				button_previous: cnMerge(
					shadcnButtonVariants({ variant: buttonVariant }),
					"size-(--cell-size) p-0 select-none aria-disabled:opacity-50",
					defaultClassNames.button_previous,
					classNames?.button_previous
				),
				caption_label: cnMerge(
					"font-medium select-none",
					captionLayout === "label" ? "text-sm" : (
						`flex h-8 items-center gap-1 rounded-md pr-1 pl-2 text-sm [&>svg]:size-3.5
							[&>svg]:text-shadcn-muted-foreground`
					),
					defaultClassNames.caption_label,
					classNames?.caption_label
				),
				day: cnMerge(
					`group/day relative aspect-square size-full p-0 text-center select-none
					[&:first-child[data-selected=true]_button]:rounded-l-md
					[&:last-child[data-selected=true]_button]:rounded-r-md`,
					defaultClassNames.day,
					classNames?.day
				),
				disabled: cnMerge(
					"text-shadcn-muted-foreground opacity-50",
					defaultClassNames.disabled,
					classNames?.disabled
				),
				dropdown: cnMerge(
					"absolute inset-0 opacity-0",
					defaultClassNames.dropdown,
					classNames?.dropdown
				),
				dropdown_root: cnMerge(
					`relative rounded-md border border-shadcn-input shadow-xs has-focus:border-shadcn-ring
					has-focus:ring-[3px] has-focus:ring-shadcn-ring/50`,
					defaultClassNames.dropdown_root,
					classNames?.dropdown_root
				),
				dropdowns: cnMerge(
					"flex h-(--cell-size) w-full items-center justify-center gap-1.5 text-sm font-medium",
					defaultClassNames.dropdowns,
					classNames?.dropdowns
				),
				hidden: cnMerge("invisible", defaultClassNames.hidden, classNames?.hidden),
				month: cnMerge("flex w-full flex-col gap-4", defaultClassNames.month, classNames?.month),
				month_caption: cnMerge(
					"flex h-(--cell-size) w-full items-center justify-center px-(--cell-size)",
					defaultClassNames.month_caption,
					classNames?.month_caption
				),
				months: cnMerge(
					"relative flex flex-col gap-4 md:flex-row",
					defaultClassNames.months,
					classNames?.months
				),
				nav: cnMerge(
					"absolute inset-x-0 top-0 flex w-full items-center justify-between gap-1",
					defaultClassNames.nav,
					classNames?.nav
				),
				outside: cnMerge(
					"text-shadcn-muted-foreground aria-selected:text-shadcn-muted-foreground",
					defaultClassNames.outside,
					classNames?.outside
				),
				range_end: cnMerge(
					"rounded-r-md bg-shadcn-accent",
					defaultClassNames.range_end,
					classNames?.range_end
				),
				range_middle: cnMerge(
					"rounded-none",
					defaultClassNames.range_middle,
					classNames?.range_middle
				),
				range_start: cnMerge(
					"rounded-l-md bg-shadcn-accent",
					defaultClassNames.range_start,
					classNames?.range_start
				),
				root: cnMerge("w-fit", defaultClassNames.root, classNames?.root),
				today: cnMerge(
					`rounded-md bg-shadcn-accent text-shadcn-accent-foreground
					data-[selected=true]:rounded-none`,
					defaultClassNames.today,
					classNames?.today
				),
				week: cnMerge("mt-2 flex w-full", defaultClassNames.week, classNames?.week),
				week_number: cnMerge(
					"text-[12.8px] text-shadcn-muted-foreground select-none",
					defaultClassNames.week_number,
					classNames?.week_number
				),
				week_number_header: cnMerge(
					"w-(--cell-size) select-none",
					defaultClassNames.week_number_header,
					classNames?.week_number_header
				),
				weekday: cnMerge(
					"flex-1 rounded-md text-[12.8px] font-normal text-shadcn-muted-foreground select-none",
					defaultClassNames.weekday,
					classNames?.weekday
				),
				weekdays: cnMerge("flex", defaultClassNames.weekdays, classNames?.weekdays),
			}}
			components={{
				Chevron: ({ className: innerClassName, orientation, ...innerRestOfProps }) => {
					if (orientation === "left") {
						return (
							<IconBox
								icon="lucide:chevron-left"
								className={cnMerge("size-4", innerClassName)}
								{...innerRestOfProps}
							/>
						);
					}

					if (orientation === "right") {
						return (
							<IconBox
								icon="lucide:chevron-right"
								className={cnMerge("size-4", innerClassName)}
								{...innerRestOfProps}
							/>
						);
					}

					return (
						<IconBox
							icon="lucide:chevron-down"
							className={cnMerge("size-4", innerClassName)}
							{...innerRestOfProps}
						/>
					);
				},

				DayButton: CalendarDayButton,

				Root: ({ className: innerClassName, rootRef, ...innerRestOfProps }) => {
					return (
						<div
							data-slot="calendar"
							ref={rootRef}
							className={cnMerge(innerClassName)}
							{...innerRestOfProps}
						/>
					);
				},

				WeekNumber: ({ children, ...innerRestOfProps }) => {
					return (
						<td {...innerRestOfProps}>
							<div className="flex size-(--cell-size) items-center justify-center text-center">
								{children}
							</div>
						</td>
					);
				},

				...components,
			}}
			{...restOfProps}
		/>
	);
}

export function CalendarDayButton(props: React.ComponentProps<typeof DayButton> & ShadcnButtonProps) {
	const { className, day, modifiers, size = "icon", variant = "ghost", ...restOfProps } = props;

	const defaultClassNames = getDefaultClassNames();

	const buttonRef = useRef<HTMLButtonElement>(null);

	useEffect(() => {
		// eslint-disable-next-line react-you-might-not-need-an-effect/no-event-handler
		if (!modifiers.focused) return;

		buttonRef.current?.focus();
	}, [modifiers.focused]);

	return (
		<button
			type="button"
			ref={buttonRef}
			data-day={day.date.toLocaleDateString()}
			data-selected-single={
				modifiers.selected && !modifiers.range_start && !modifiers.range_end && !modifiers.range_middle
			}
			data-range-start={modifiers.range_start}
			data-range-end={modifiers.range_end}
			data-range-middle={modifiers.range_middle}
			className={cnMerge(
				`flex aspect-square size-auto w-full min-w-(--cell-size) flex-col gap-1 leading-none
				font-normal group-data-[focused=true]/day:relative group-data-[focused=true]/day:z-10
				group-data-[focused=true]/day:ring-[1px] group-data-[focused=true]/day:ring-shadcn-ring/30
				data-[range-end=true]:rounded-md data-[range-end=true]:rounded-r-md
				data-[range-end=true]:bg-shadcn-primary data-[range-end=true]:text-shadcn-primary-foreground
				data-[range-middle=true]:rounded-none data-[range-middle=true]:bg-shadcn-accent
				data-[range-middle=true]:text-shadcn-primary-foreground data-[range-start=true]:rounded-md
				data-[range-start=true]:rounded-l-md data-[range-start=true]:bg-shadcn-primary
				data-[range-start=true]:text-shadcn-primary-foreground
				data-[selected-single=true]:bg-shadcn-primary
				data-[selected-single=true]:text-shadcn-primary-foreground
				dark:hover:text-shadcn-primary-foreground [&>span]:text-xs [&>span]:opacity-70`,
				defaultClassNames.day,
				shadcnButtonVariants({ size, variant }),
				className
			)}
			{...restOfProps}
		/>
	);
}
