"use client";

import type { InferProps, PolymorphicPropsStrict } from "@zayne-labs/toolkit-react/utils";
import type { Prettify } from "@zayne-labs/toolkit-type-helpers";
import { tv, type VariantProps } from "tailwind-variants";
import { Slot } from "@/components/common/slot";
import { cnJoin } from "@/lib/utils/cn";
import { SpinnerIcon } from "../icons/SpinnerIcon";

export type ButtonProps = InferProps<"button">
	& Prettify<
		VariantProps<typeof buttonVariants> & {
			asChild?: boolean;
			isLoading?: boolean;
			unstyled?: boolean;
		}
	>;

const buttonVariants = tv({
	base: "flex w-fit items-center justify-center gap-2.5 rounded-[10px] text-[14px] font-medium",

	compoundVariants: [
		{
			className: "grid place-items-center",
			isLoading: true,
			loadingStyle: "replace-content",
		},
		{
			className: "gap-1.5",
			isLoading: true,
			loadingStyle: "side-by-side",
		},
	],

	defaultVariants: {
		size: "medium",
		theme: "primary",
	},

	variants: {
		disabled: {
			true: "cursor-not-allowed opacity-60",
		},

		isDisabled: {
			true: "cursor-not-allowed",
		},

		isLoading: {
			true: "",
		},

		loadingStyle: {
			"replace-content": "",
			"side-by-side": "",
		},

		size: {
			"full-width": "h-12 w-full px-6",

			medium: "h-12 px-5 text-[14px]",
		},

		theme: {
			primary: "bg-vitastock-primary-main text-white hover:bg-vitastock-primary-main/90",

			"primary-ghost": `bg-transparent text-vitastock-primary-main hover:bg-vitastock-primary-subtle/50
			hover:text-vitastock-primary-dark`,

			"primary-outline": `border-[1.5px] border-vitastock-primary-main bg-transparent
			text-vitastock-primary-main shadow-[0_1px_2px_hsl(0,0%,0%,0.05)]`,

			"secondary-outline": `border-[1.5px] border-[hsl(200,5%,89%)] bg-transparent text-black
			shadow-[0_1px_2px_hsl(0,0%,0%,0.05)]`,
		},
	},
});

function Button<TElement extends React.ElementType = "button">(
	props: PolymorphicPropsStrict<TElement, ButtonProps>
) {
	const {
		as: Element = "button",
		asChild,
		children,
		className,
		isDisabled = false,
		disabled = isDisabled,
		isLoading = false,
		loadingStyle = "replace-content",
		size,
		theme,
		type = "button",
		unstyled,
		...restOfProps
	} = props;

	const Component = asChild ? Slot.Root : Element;

	const BTN_CLASSES =
		!unstyled ?
			buttonVariants({
				className,
				disabled,
				isDisabled,
				isLoading,
				loadingStyle,
				size,
				theme,
			})
		:	className;

	const withIcon = (
		<>
			<Slot.Slottable>
				{loadingStyle === "replace-content" ?
					<div className="invisible [grid-area:1/1]">{children}</div>
				:	children}
			</Slot.Slottable>
			<span className={cnJoin(loadingStyle === "replace-content" && "[grid-area:1/1]")}>
				<SpinnerIcon className="size-5" />
			</span>
		</>
	);

	// == This technique helps prevents content shift when replacing children with spinner icon
	return (
		<Component type={type} className={BTN_CLASSES} disabled={disabled || isDisabled} {...restOfProps}>
			{isLoading ? withIcon : children}
		</Component>
	);
}

export { Button };
