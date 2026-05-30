import { queryOptions } from "@tanstack/react-query";
import { callBackendApiForQuery } from "@/lib/api/callBackendApi";
import { checkUserSessionForQuery } from "../api/callBackendApi/plugins/utils/session";

export const sessionQuery = () => {
	return queryOptions({
		queryFn: () => checkUserSessionForQuery(),
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
