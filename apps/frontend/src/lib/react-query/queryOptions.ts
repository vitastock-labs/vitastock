import { queryOptions } from "@tanstack/react-query";
import { callBackendApiForQuery } from "@/lib/api/callBackendApi";
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
