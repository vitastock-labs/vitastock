import type { GetCallApiContext, RequestContext } from "@zayne-labs/callapi";
import { definePluginWithContext } from "@zayne-labs/callapi/utils";
import { isBrowser, waitFor } from "@zayne-labs/toolkit-core";
import type { Awaitable } from "@zayne-labs/toolkit-type-helpers";
import type { MainAppRoutes } from "@/components/common/NavLink";
import type { BaseApiErrorResponse } from "../apiSchema";
import { isAuthErrorThatNeedsRedirect, isPathnameMatchingRoute, redirectTo } from "./utils/common";

export type AuthErrorRedirectPluginMeta = {
	auth?: {
		redirectDelay?: number;
		redirectErrorMessage?: string;
		redirectFn?: (route: MainAppRoutes) => Awaitable<void>;
		redirectRoute?: MainAppRoutes;
		routesToExemptFromErrorRedirect?: Array<`${MainAppRoutes}/**` | `${string}/**` | MainAppRoutes>;
		skipErrorRedirect?: boolean;
	};
};

type AuthErrorRedirectContext = GetCallApiContext<{
	ErrorData: BaseApiErrorResponse;
	Meta: AuthErrorRedirectPluginMeta;
}>;

const defaultRedirectRoute =
	"/auth/signin" satisfies Required<AuthErrorRedirectPluginMeta>["auth"]["redirectRoute"];

const defaultRedirectErrorMessage = "Session is invalid or expired! Redirecting to login...";

const defaultRedirectDelay = 1500;

export const authErrorRedirectPlugin = (authOptions?: AuthErrorRedirectPluginMeta["auth"]) => {
	const getAuthMetaAndDerivatives = (ctx: RequestContext<AuthErrorRedirectContext>) => {
		const authMeta =
			authOptions ? { ...authOptions, ...ctx.options.meta?.auth } : ctx.options.meta?.auth;

		const redirectFn: Required<AuthErrorRedirectPluginMeta>["auth"]["redirectFn"] = async (
			...params
		) => {
			const selectedRedirectFn = authMeta?.redirectFn ?? redirectTo;
			const redirectDelay = authMeta?.redirectDelay ?? defaultRedirectDelay;

			await waitFor(redirectDelay);

			await selectedRedirectFn(...params);
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
		};
	};

	return definePluginWithContext<AuthErrorRedirectContext>()({
		id: "auth-error-redirect-plugin",
		name: "authErrorRedirectPlugin",

		// eslint-disable-next-line perfectionist/sort-objects
		hooks: {
			onResponseError: async (ctx) => {
				const { redirectErrorMessage, redirectFn, shouldSkipRouteFromRedirect, signInRoute } =
					getAuthMetaAndDerivatives(ctx);

				if (shouldSkipRouteFromRedirect || !isAuthErrorThatNeedsRedirect(ctx.error)) return;

				if (isBrowser()) {
					await redirectFn(signInRoute);
				}

				throw new Error(redirectErrorMessage);
			},
		},
	});
};
