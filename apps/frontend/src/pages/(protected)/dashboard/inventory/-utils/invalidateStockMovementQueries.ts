import type { QueryClient } from "@tanstack/react-query";
import {
	dashboardOverviewQuery,
	inventoryActivityQuery,
	inventoryAlertsQuery,
	inventoryAlertsStatusQuery,
	inventorySummaryQuery,
} from "@/lib/react-query/queryOptions";

export const invalidateStockMovementQueries = (queryClient: QueryClient) => {
	return Promise.all([
		queryClient.invalidateQueries(inventorySummaryQuery()),
		queryClient.invalidateQueries(dashboardOverviewQuery()),
		queryClient.invalidateQueries(inventoryAlertsStatusQuery()),
		queryClient.invalidateQueries({ queryKey: inventoryAlertsQuery().queryKey.slice(0, -1) }),
		queryClient.invalidateQueries({ queryKey: inventoryActivityQuery().queryKey.slice(0, -1) }),
	]);
};
