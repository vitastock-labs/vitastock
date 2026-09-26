import type { InferProps } from "@zayne-labs/toolkit-react/utils";
import { cnMerge } from "@/lib/utils/cn";

function Main(props: InferProps<"main">) {
	const { className, ...restOfProps } = props;

	return (
		<main
			className={cnMerge(
				`flex min-w-0 grow basis-0 flex-col px-4 pt-6 pb-16 md:px-8 md:pt-10 lg:px-12 lg:pt-12
				lg:pb-[100px]`,
				className
			)}
			{...restOfProps}
		/>
	);
}

export { Main };
