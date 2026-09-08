import type { InferProps } from "@zayne-labs/toolkit-react/utils";
import { cnMerge } from "@/lib/utils/cn";

function Main(props: InferProps<"main">) {
	const { className, ...restOfProps } = props;

	return (
		<main
			className={cnMerge("flex min-w-0 grow basis-0 flex-col px-12 pt-12 pb-[100px]", className)}
			{...restOfProps}
		/>
	);
}

export { Main };
