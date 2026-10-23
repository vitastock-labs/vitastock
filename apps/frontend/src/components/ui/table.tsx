import { cnMerge } from "@/lib/utils/cn";
import * as ScrollArea from "./scroll-area";

function TableRoot(
	props: React.ComponentProps<"table"> & {
		classNames?: { container?: string; scrollAreaThumb?: string; table?: string };
	}
) {
	const { className, classNames, ...restOfProps } = props;

	return (
		<ScrollArea.Root
			data-slot="table-container"
			type="auto"
			orientation="both"
			classNames={{
				base: cnMerge("w-full", classNames?.container),
				thumb: classNames?.scrollAreaThumb,
			}}
		>
			<table
				data-slot="table-root"
				className={cnMerge("w-full caption-bottom text-sm", className, classNames?.table)}
				{...restOfProps}
			/>
		</ScrollArea.Root>
	);
}

function TableHeader(props: React.ComponentProps<"thead">) {
	const { className, ...restOfProps } = props;

	return (
		<thead data-slot="table-header" className={cnMerge("[&_tr]:border-b", className)} {...restOfProps} />
	);
}

function TableBody(props: React.ComponentProps<"tbody">) {
	const { className, ...restOfProps } = props;

	return (
		<tbody
			data-slot="table-body"
			className={cnMerge("[&_tr:last-child]:border-0", className)}
			{...restOfProps}
		/>
	);
}

function TableFooter(props: React.ComponentProps<"tfoot">) {
	const { className, ...restOfProps } = props;

	return (
		<tfoot
			data-slot="table-footer"
			className={cnMerge("border-t bg-shadcn-muted/50 font-medium [&>tr]:last:border-b-0", className)}
			{...restOfProps}
		/>
	);
}

function TableRow(props: React.ComponentProps<"tr">) {
	const { className, ...restOfProps } = props;

	return (
		<tr
			data-slot="table-row"
			className={cnMerge(
				"border-b transition-colors hover:bg-shadcn-muted/50 data-[state=selected]:bg-shadcn-muted",
				className
			)}
			{...restOfProps}
		/>
	);
}

function TableHead(props: React.ComponentProps<"th">) {
	const { className, ...restOfProps } = props;

	return (
		<th
			data-slot="table-head"
			className={cnMerge(
				`h-10 px-2 text-left align-middle font-medium text-shadcn-foreground has-[[role=checkbox]]:pr-0
				*:[[role=checkbox]]:translate-y-0.5`,
				className
			)}
			{...restOfProps}
		/>
	);
}

function TableCell(props: React.ComponentProps<"td">) {
	const { className, ...restOfProps } = props;

	return (
		<td
			data-slot="table-cell"
			className={cnMerge(
				"p-2 align-middle has-[[role=checkbox]]:pr-0 *:[[role=checkbox]]:translate-y-0.5",
				className
			)}
			{...restOfProps}
		/>
	);
}

function TableCaption(props: React.ComponentProps<"caption">) {
	const { className, ...restOfProps } = props;

	return (
		<caption
			data-slot="table-caption"
			className={cnMerge("mt-4 text-sm text-shadcn-muted-foreground", className)}
			{...restOfProps}
		/>
	);
}

export {
	TableRoot as Root,
	TableHeader as Header,
	TableBody as Body,
	TableFooter as Footer,
	TableRow as Row,
	TableHead as Head,
	TableCell as Cell,
	TableCaption as Caption,
};
