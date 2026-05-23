import type {
	CallApiResultErrorVariant,
	ErrorContext,
	RequestContext,
	SuccessContext,
} from "@zayne-labs/callapi";
import { definePlugin, isHTTPError } from "@zayne-labs/callapi/utils";
import { isBrowser } from "@zayne-labs/toolkit-core";
import { toast } from "sonner";
import type { MainAppRoutes } from "@/components/common/NavLink";
import type { BackendApiRouteKeys, BaseApiErrorResponse, BaseApiSuccessResponse } from "../apiSchema";
import { isPathnameMatchingRoute } from "./utils/common";

type RoutePattern = Array<`${MainAppRoutes}/**` | `${string}/**` | MainAppRoutes>;

export type ToastPluginMeta = {
	toast?: {
		endpointsToSkip?: Array<{
			endpoints: BackendApiRouteKeys[];
			on: "error" | "errorAndSuccess" | "success";
			routesExclude?: RoutePattern;
			routesInclude?: RoutePattern;
		}>;
		error?: boolean;
		errorAndSuccess?: boolean;
		errorsToSkip?: Array<CallApiResultErrorVariant<unknown>["error"]["name"]>;
		errorsToSkipCondition?: (
			error: CallApiResultErrorVariant<BaseApiErrorResponse>["error"]
		) => boolean | undefined;
		success?: boolean;
	};
};

const shouldEndpointBeSkipped = (
	options: Pick<NonNullable<ToastPluginMeta["toast"]>, "endpointsToSkip"> & {
		initURL: string | undefined;
		type: "error" | "success";
	}
) => {
	const { endpointsToSkip, initURL, type } = options;

	return Boolean(
		endpointsToSkip?.some((entry) => {
			const onMatches = entry.on === type || entry.on === "errorAndSuccess";

			if (!onMatches || initURL == null || !entry.endpoints.includes(initURL as BackendApiRouteKeys)) {
				return false;
			}

			const isRouteExcluded =
				entry.routesExclude ?
					entry.routesExclude.some((pattern) => isPathnameMatchingRoute(pattern))
				:	false;

			const isRouteIncluded =
				entry.routesInclude ?
					entry.routesInclude.some((pattern) => isPathnameMatchingRoute(pattern))
				:	true;

			return !isRouteExcluded && isRouteIncluded;
		})
	);
};

export const toastPlugin = (toastOptions?: ToastPluginMeta["toast"]) => {
	const getToastMeta = (ctx: RequestContext<{ Meta: ToastPluginMeta }>) => {
		return toastOptions ? { ...toastOptions, ...ctx.options.meta?.toast } : ctx.options.meta?.toast;
	};

	return definePlugin({
		id: "toast-plugin",
		name: "toastPlugin",

		// eslint-disable-next-line perfectionist/sort-objects
		hooks: {
			onError: (ctx: ErrorContext<{ ErrorData: BaseApiErrorResponse }>) => {
				if (!isBrowser()) return;

				const toastMeta = getToastMeta(ctx);

				const initURL = ctx.options.initURL;

				const shouldSkipErrorToast =
					shouldEndpointBeSkipped({
						endpointsToSkip: toastMeta?.endpointsToSkip,
						initURL,
						type: "error",
					})
					|| (toastMeta?.errorsToSkip?.includes(ctx.error.name) ?? false)
					|| (toastMeta?.errorsToSkipCondition?.(ctx.error) ?? false);

				const isErrorToastEnabled = toastMeta?.error ?? toastMeta?.errorAndSuccess;

				if (shouldSkipErrorToast || !isErrorToastEnabled) return;

				if (isHTTPError(ctx.error) && ctx.error.errorData.errors) {
					Object.values(ctx.error.errorData.errors).forEach((message) => toast.error(message));
					return;
				}

				toast.error(ctx.error.message);
			},

			onSuccess: (ctx: SuccessContext<{ Data: BaseApiSuccessResponse }>) => {
				if (!isBrowser()) return;

				const toastMeta = getToastMeta(ctx);

				const initURL = ctx.options.initURL;

				const shouldSkipSuccessToast = shouldEndpointBeSkipped({
					endpointsToSkip: toastMeta?.endpointsToSkip,
					initURL,
					type: "success",
				});

				const isSuccessToastEnabled = toastMeta?.success ?? toastMeta?.errorAndSuccess;

				if (shouldSkipSuccessToast || !isSuccessToastEnabled) return;

				toast.success(ctx.data.message);
			},
		},
	});
};
