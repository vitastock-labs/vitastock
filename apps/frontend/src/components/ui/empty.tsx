import { tv, type VariantProps } from "tailwind-variants";
import { cnMerge } from "@/lib/utils/cn";

function EmptyRoot(props: React.ComponentProps<"div">) {
	const { className, ...restOfProps } = props;

	return (
		<div
			data-slot="empty-root"
			className={cnMerge(
				`flex w-full min-w-0 grow flex-col items-center justify-center gap-4 rounded-xl border-dashed
				p-6 text-center text-balance`,
				className
			)}
			{...restOfProps}
		/>
	);
}

function EmptyHeader(props: React.ComponentProps<"div">) {
	const { className, ...restOfProps } = props;

	return (
		<div
			data-slot="empty-header"
			className={cnMerge("flex max-w-sm flex-col items-center gap-2", className)}
			{...restOfProps}
		/>
	);
}

const emptyMediaVariants = tv({
	base: "mb-2 flex shrink-0 items-center justify-center [&_svg]:pointer-events-none [&_svg]:shrink-0",
	defaultVariants: {
		variant: "default",
	},
	variants: {
		variant: {
			default: "bg-transparent",
			icon: `flex size-8 shrink-0 items-center justify-center rounded-lg bg-shadcn-muted
			text-shadcn-foreground [&_svg:not([class*='size-'])]:size-4`,
		},
	},
});

function EmptyMedia(props: React.ComponentProps<"div"> & VariantProps<typeof emptyMediaVariants>) {
	const { className, variant = "default", ...restOfProps } = props;

	return (
		<div
			data-slot="empty-icon"
			data-variant={variant}
			className={emptyMediaVariants({ className, variant })}
			{...restOfProps}
		/>
	);
}

function EmptyTitle(props: React.ComponentProps<"div">) {
	const { className, ...restOfProps } = props;

	return (
		<h3
			data-slot="empty-title"
			className={cnMerge("text-sm font-medium tracking-tight", className)}
			{...restOfProps}
		/>
	);
}

function EmptyDescription(props: React.ComponentProps<"p">) {
	const { className, ...restOfProps } = props;

	return (
		<div
			data-slot="empty-description"
			className={cnMerge(
				`text-sm/relaxed text-shadcn-muted-foreground [&>a]:underline [&>a]:underline-offset-4
				[&>a:hover]:text-shadcn-primary`,
				className
			)}
			{...restOfProps}
		/>
	);
}

function EmptyContent({ className, ...restOfProps }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="empty-content"
			className={cnMerge(
				"flex w-full max-w-sm min-w-0 flex-col items-center gap-2.5 text-sm text-balance",
				className
			)}
			{...restOfProps}
		/>
	);
}

export {
	EmptyRoot as Root,
	EmptyHeader as Header,
	EmptyTitle as Title,
	EmptyDescription as Description,
	EmptyContent as Content,
	EmptyMedia as Media,
};
