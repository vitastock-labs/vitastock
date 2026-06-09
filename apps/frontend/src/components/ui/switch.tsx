"use client";

import { Switch as SwitchPrimitive } from "radix-ui";
import { cnMerge } from "@/lib/utils/cn";

function Switch(
	props: React.ComponentProps<typeof SwitchPrimitive.Root> & {
		classNames?: { base?: string; thumb?: string };
		size?: "default" | "sm";
	}
) {
	const { className, classNames, size = "default", ...restOfProps } = props;

	return (
		<SwitchPrimitive.Root
			data-slot="switch"
			data-size={size}
			className={cnMerge(
				`peer group/switch relative inline-flex shrink-0 items-center rounded-full border
				border-transparent transition-all outline-none after:absolute after:-inset-x-3 after:-inset-y-2
				focus-visible:border-shadcn-ring focus-visible:ring-3 focus-visible:ring-shadcn-ring/50
				aria-invalid:border-shadcn-destructive aria-invalid:ring-3
				aria-invalid:ring-shadcn-destructive/20 data-[size=default]:h-[18.4px] data-[size=default]:w-8
				data-[size=sm]:h-3.5 data-[size=sm]:w-6 data-checked:bg-shadcn-primary
				data-unchecked:bg-shadcn-input data-disabled:cursor-not-allowed data-disabled:opacity-50`,
				className,
				classNames?.base
			)}
			{...restOfProps}
		>
			<SwitchPrimitive.Thumb
				data-slot="switch-thumb"
				className={cnMerge(
					`pointer-events-none block rounded-full bg-shadcn-background ring-0 transition-transform
					group-data-[size=default]/switch:size-4 group-data-[size=sm]/switch:size-3
					group-data-[size=default]/switch:data-checked:translate-x-[calc(100%-2px)]
					group-data-[size=sm]/switch:data-checked:translate-x-[calc(100%-2px)]
					group-data-[size=default]/switch:data-unchecked:translate-x-0
					group-data-[size=sm]/switch:data-unchecked:translate-x-0`,
					classNames?.thumb
				)}
			/>
		</SwitchPrimitive.Root>
	);
}

export { Switch };
