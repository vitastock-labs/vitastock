import type { Context } from "hono";
import * as cookieHelpers from "hono/cookie";
import type { CookieOptions } from "hono/utils/cookie";
import { ENVIRONMENT } from "@/config/env";

type VitaStockCookieNames = "vitaStockAccessToken" | "vitaStockRefreshToken";

type GoogleCookieNames = "google_code_verifier" | "google_oauth_state";

type PossibleCookieNames = GoogleCookieNames | VitaStockCookieNames;

export const getCookie = (ctx: Context, name: PossibleCookieNames) => cookieHelpers.getCookie(ctx, name);

const getBaseCookieOptions = () => {
	const isProduction = ENVIRONMENT.NODE_ENV === "production";

	return {
		httpOnly: true,
		partitioned: isProduction,
		sameSite: isProduction ? "none" : "lax",
		secure: isProduction,
	} satisfies CookieOptions;
};

export const setCookie = (
	ctx: Context,
	options: CookieOptions & { name: PossibleCookieNames; value: string }
) => {
	const { name, value, ...restOptions } = options;

	cookieHelpers.setCookie(ctx, name, value, {
		...getBaseCookieOptions(),
		...restOptions,
	});
};

export const deleteCookie = (ctx: Context, name: PossibleCookieNames) => {
	cookieHelpers.deleteCookie(ctx, name, getBaseCookieOptions());
};
