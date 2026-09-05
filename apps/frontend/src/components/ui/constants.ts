import type { InferProps } from "@zayne-labs/toolkit-react/utils";
import { tv, type VariantProps } from "tailwind-variants";

export type ShadcnButtonProps = InferProps<"button"> & VariantProps<typeof shadcnButtonVariants>;

export const shadcnButtonVariants = tv({
	base: `group/button inline-flex shrink-0 items-center justify-center rounded-lg border
	border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none
	select-none focus-visible:border-shadcn-ring focus-visible:ring-3 focus-visible:ring-shadcn-ring/50
	disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-shadcn-destructive
	aria-invalid:ring-3 aria-invalid:ring-shadcn-destructive/20
	dark:aria-invalid:border-shadcn-destructive/50 dark:aria-invalid:ring-shadcn-destructive/40
	[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4`,

	defaultVariants: {
		size: "default",
		variant: "default",
	},
	variants: {
		size: {
			default: "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
			icon: "size-8",
			"icon-lg": "size-9",
			"icon-sm": "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
			"icon-xs": `size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg
			[&_svg:not([class*='size-'])]:size-3`,
			lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
			sm: `h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem]
			in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5
			has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5`,
			xs: `h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs
			in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5
			has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3`,
		},
		variant: {
			default: "bg-shadcn-primary text-shadcn-primary-foreground [a]:hover:bg-shadcn-primary/80",
			destructive: `bg-shadcn-destructive/10 text-shadcn-destructive hover:bg-shadcn-destructive/20
			focus-visible:border-shadcn-destructive/40 focus-visible:ring-shadcn-destructive/20
			dark:bg-shadcn-destructive/20 dark:hover:bg-shadcn-destructive/30
			dark:focus-visible:ring-shadcn-destructive/40`,
			ghost: `hover:bg-shadcn-accent hover:text-shadcn-accent-foreground aria-expanded:bg-shadcn-accent
			aria-expanded:text-shadcn-accent-foreground dark:hover:bg-shadcn-accent/50`,
			link: "text-shadcn-primary underline-offset-4 hover:underline",
			outline: `border-shadcn-border bg-shadcn-background hover:bg-shadcn-accent
			hover:text-shadcn-accent-foreground aria-expanded:bg-shadcn-accent
			aria-expanded:text-shadcn-accent-foreground dark:border-shadcn-input dark:bg-shadcn-input/30
			dark:hover:bg-shadcn-input/50`,
			secondary: `bg-shadcn-secondary text-shadcn-secondary-foreground hover:bg-shadcn-secondary/80
			aria-expanded:bg-shadcn-secondary aria-expanded:text-shadcn-secondary-foreground`,
		},
	},
});
