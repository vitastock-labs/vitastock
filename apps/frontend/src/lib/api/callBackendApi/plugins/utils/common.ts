import { AUTH_ERRORS, type AuthErrorAppCodeType } from "@vitastock/shared/constants";
import type { ResponseErrorContext } from "@zayne-labs/callapi";
import { isHTTPError } from "@zayne-labs/callapi/utils";
import { hardNavigate, isBrowser } from "@zayne-labs/toolkit-core";
import type { MainAppRoutes } from "@/components/common/NavLink";
import type { BaseApiErrorResponse } from "../../apiSchema";

export const isAuthError = (error: ResponseErrorContext["error"]) => {
	return isHTTPError(error) && error.originalError.response.status === 401;
};

const REDIRECT_AUTH_ERROR_APP_CODES = new Set<AuthErrorAppCodeType>([
	AUTH_ERRORS.INVALID_SESSION.appCode,
	AUTH_ERRORS.SESSION_EXPIRED.appCode,
	AUTH_ERRORS.SESSION_NOT_EXIST.appCode,
	AUTH_ERRORS.SESSION_VALIDATION_FAILED.appCode,
]);

export const isAuthErrorThatNeedsRedirect = (
	error: ResponseErrorContext<{ ErrorData: BaseApiErrorResponse }>["error"]
) => {
	if (!isAuthError(error)) {
		return false;
	}

	return REDIRECT_AUTH_ERROR_APP_CODES.has(error.errorData.appCode as AuthErrorAppCodeType);
};

export const redirectTo = (route: MainAppRoutes) => {
	setTimeout(() => hardNavigate(route), 1500);
};

export const isPathnameMatchingRoute = (route: string) => {
	if (!isBrowser()) {
		return false;
	}

	const pathname = globalThis.location.pathname;

	const isRouteWithCatchAll = route.endsWith("/**");

	if (isRouteWithCatchAll) {
		const routeWithoutCatchAll = route.slice(0, -3);

		return pathname === routeWithoutCatchAll || pathname.startsWith(`${routeWithoutCatchAll}/`);
	}

	return pathname === route;
};
