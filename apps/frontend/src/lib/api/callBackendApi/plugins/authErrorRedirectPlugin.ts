import type { RequestContext, ResponseErrorContext } from "@zayne-labs/callapi";
import { definePlugin } from "@zayne-labs/callapi/utils";
import { isBrowser } from "@zayne-labs/toolkit-core";
import type { MainAppRoutes } from "@/components/common/NavLink";
import type { BaseApiErrorResponse } from "../apiSchema";
import type { ToastPluginMeta } from "./toastPlugin";
import { isAuthErrorThatNeedsRedirect, isPathnameMatchingRoute, redirectTo } from "./utils/common";

export type AuthErrorRedirectPluginMeta = {
	auth?: {
		redirectDelay?: number;
		redirectErrorMessage?: string;
		redirectFn?: (route: MainAppRoutes) => void;
		redirectRoute?: MainAppRoutes;
		routesToExemptFromErrorRedirect?: Array<`${MainAppRoutes}/**` | `${string}/**` | MainAppRoutes>;
		skipErrorRedirect?: boolean;
	};
};

const defaultRedirectRoute =
	"/auth/signin" satisfies Required<AuthErrorRedirectPluginMeta>["auth"]["redirectRoute"];

const defaultRedirectErrorMessage = "Session is invalid or expired! Redirecting to login...";

const defaultRedirectDelay = 1500;

export const authErrorRedirectPlugin = (authOptions?: AuthErrorRedirectPluginMeta["auth"]) => {
	const getAuthMetaAndDerivatives = (
		ctx: RequestContext<{ Meta: AuthErrorRedirectPluginMeta & ToastPluginMeta }>
	) => {
		const authMeta =
			authOptions ? { ...authOptions, ...ctx.options.meta?.auth } : ctx.options.meta?.auth;

		const redirectFn: Required<AuthErrorRedirectPluginMeta>["auth"]["redirectFn"] = (...params) => {
			const selectedRedirectFn = authMeta?.redirectFn ?? redirectTo;
			const redirectDelay = authMeta?.redirectDelay ?? defaultRedirectDelay;

			setTimeout(() => {
				selectedRedirectFn(...params);
			}, redirectDelay);
		};

		const turnOffErrorToast = () => {
			ctx.options.meta ??= {};
			ctx.options.meta.toast ??= {};
			ctx.options.meta.toast.error = false;
		};

		const signInRoute = authMeta?.redirectRoute ?? defaultRedirectRoute;

		const redirectErrorMessage = authMeta?.redirectErrorMessage ?? defaultRedirectErrorMessage;

		const isExemptedRouteFromRedirect = Boolean(
			authMeta?.routesToExemptFromErrorRedirect?.some((route) => isPathnameMatchingRoute(route))
		);

		const shouldSkipRouteFromRedirect = isExemptedRouteFromRedirect || authMeta?.skipErrorRedirect;

		return {
			authMeta,
			redirectErrorMessage,
			redirectFn,
			shouldSkipRouteFromRedirect,
			signInRoute,
			turnOffErrorToast,
		};
	};

	return definePlugin({
		id: "auth-error-redirect-plugin",
		name: "authErrorRedirectPlugin",

		// eslint-disable-next-line perfectionist/sort-objects
		hooks: {
			onResponseError: (
				ctx: ResponseErrorContext<{
					ErrorData: BaseApiErrorResponse;
					Meta: AuthErrorRedirectPluginMeta & ToastPluginMeta;
				}>
			) => {
				const {
					redirectErrorMessage,
					redirectFn,
					shouldSkipRouteFromRedirect,
					signInRoute,
					turnOffErrorToast,
				} = getAuthMetaAndDerivatives(ctx);

				// == Turn off error toast in the case where redirect is skipped and auth error needs redirect
				if (shouldSkipRouteFromRedirect && isAuthErrorThatNeedsRedirect(ctx.error)) {
					turnOffErrorToast();
				}

				if (shouldSkipRouteFromRedirect || !isAuthErrorThatNeedsRedirect(ctx.error)) return;

				if (isBrowser()) {
					redirectFn(signInRoute);
				}

				throw new Error(redirectErrorMessage);
			},
		},
	});
};
