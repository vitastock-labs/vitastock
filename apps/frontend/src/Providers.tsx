import { ProgressProvider } from "@bprogress/react";
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import type { Awaitable } from "@zayne-labs/toolkit-type-helpers";
import { getQueryClient } from "@/lib/react-query/queryClient";

type ProvidersProps = {
	children: React.ReactNode;
	onPrefetch?: (queryClient: QueryClient) => Awaitable<void>;
};

export function Providers(props: ProvidersProps) {
	const { children, onPrefetch } = props;

	const queryClient = getQueryClient();

	void onPrefetch?.(queryClient);

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
