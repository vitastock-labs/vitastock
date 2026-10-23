import { ProgressProvider } from "@bprogress/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { getQueryClient } from "@/lib/react-query/queryClient";

export function Providers(props: { children: React.ReactNode }) {
	const { children } = props;

	const queryClient = getQueryClient();

	return (
		<QueryClientProvider client={queryClient}>
			<ProgressProvider
				height="2.5px"
				color="var(--color-vitastock-primary-darker)"
				options={{ showSpinner: true }}
				shallowRouting={true}
			>
				{children}
			</ProgressProvider>

			<ReactQueryDevtools buttonPosition="bottom-right" initialIsOpen={false} />
		</QueryClientProvider>
	);
}
