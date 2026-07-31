import { queryOptions } from "@tanstack/react-query";
import type { z } from "zod";
import { callBackendApiForQuery } from "@/lib/api/callBackendApi";
import type { BackendApiRoutes } from "@/lib/api/callBackendApi/apiSchema";
import { checkUserSessionForQuery } from "../api/callBackendApi/plugins/utils/session";

export const sessionQuery = (...params: Parameters<typeof checkUserSessionForQuery>) => {
	// eslint-disable-next-line tanstack-query/exhaustive-deps
	return queryOptions({
		queryFn: () => checkUserSessionForQuery(...params),
		queryKey: ["auth", "session"],
		select: (data) => data.data,
		staleTime: Infinity,
	});
};

export type SessionQueryResultType = Awaited<
	ReturnType<NonNullable<ReturnType<typeof sessionQuery>["select"]>>
>;

export const workspaceMembersQuery = () => {
	return queryOptions({
		queryFn: () => callBackendApiForQuery("@get/workspace/members"),
		queryKey: ["auth", "workspace", "members"],
		select: (data) => data.data,
	});
};

export type WorkspaceMembersQueryResultType = Awaited<
	ReturnType<NonNullable<ReturnType<typeof workspaceMembersQuery>["select"]>>
>;

export const dashboardOverviewQuery = () => {
	return queryOptions({
		queryFn: () => callBackendApiForQuery("@get/dashboard/overview"),
		queryKey: ["dashboard", "overview"],
		select: (data) => data.data,
	});
};

export type DashboardOverviewQueryResultType = Awaited<
	ReturnType<NonNullable<ReturnType<typeof dashboardOverviewQuery>["select"]>>
>;

export const inventorySummaryQuery = () => {
	return queryOptions({
		queryFn: () => callBackendApiForQuery("@get/inventory/summary"),
		queryKey: ["inventory", "summary"],
		select: (data) => data.data,
	});
};

export type InventorySummaryQueryResultType = Awaited<
	ReturnType<NonNullable<ReturnType<typeof inventorySummaryQuery>["select"]>>
>;

export const inventoryDrugsQuery = () => {
	return queryOptions({
		queryFn: () => callBackendApiForQuery("@get/inventory/drugs"),
		queryKey: ["inventory", "drugs"],
		select: (data) => data.data,
	});
};

export type InventoryDrugsQueryResultType = Awaited<
	ReturnType<NonNullable<ReturnType<typeof inventoryDrugsQuery>["select"]>>
>;

export const inventoryAlertsQueryKey = ["inventory", "alerts"] as const;

export const inventoryAlertsQuery = (
	query: z.infer<NonNullable<BackendApiRoutes["@get/inventory/alerts"]["query"]>> = {}
) => {
	return queryOptions({
		queryFn: () =>
			callBackendApiForQuery("@get/inventory/alerts", {
				query,
			}),
		queryKey: [...inventoryAlertsQueryKey, query],
		select: (data) => data.data,
	});
};

export type InventoryAlertsQueryResultType = Awaited<
	ReturnType<NonNullable<ReturnType<typeof inventoryAlertsQuery>["select"]>>
>;

export const inventoryAlertsUnreadCountQuery = () => {
	return queryOptions({
		queryFn: () => callBackendApiForQuery("@get/inventory/alerts/unread-count"),
		queryKey: ["inventory", "alerts", "unread-count"],
		refetchInterval: 60_000,
		select: (data) => data.data,
	});
};

export type InventoryAlertsUnreadCountQueryResultType = Awaited<
	ReturnType<NonNullable<ReturnType<typeof inventoryAlertsUnreadCountQuery>["select"]>>
>;

export const inventoryActivityQueryKey = ["inventory", "activity"] as const;

export const inventoryActivityQuery = (
	query: z.infer<NonNullable<BackendApiRoutes["@get/inventory/activity"]["query"]>> = {}
) => {
	return queryOptions({
		queryFn: () =>
			callBackendApiForQuery("@get/inventory/activity", {
				query,
			}),
		queryKey: [...inventoryActivityQueryKey, query],
		select: (data) => data.data,
	});
};

export type InventoryActivityQueryResultType = Awaited<
	ReturnType<NonNullable<ReturnType<typeof inventoryActivityQuery>["select"]>>
>;
