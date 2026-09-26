import { QueryClient } from "@tanstack/react-query";
import { isServer } from "@zayne-labs/toolkit-core";
import { cache } from "react";

const makeQueryClient = () => {
	return new QueryClient({
		defaultOptions: {
			queries: {
				retry: 0,
				// == Absorbs refetch bursts from focus/remounts; mutations still invalidate what they change
				staleTime: 10_000,
			},
		},
	});
};

const makeQueryClientOnServer = cache(makeQueryClient);

let browserQueryClient: QueryClient | undefined;

export const getQueryClient = () => {
	if (isServer()) {
		return makeQueryClientOnServer();
	}

	browserQueryClient ??= makeQueryClient();

	return browserQueryClient;
};
