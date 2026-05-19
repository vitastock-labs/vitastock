import type { Context } from "hono";
import * as cookieHelpers from "hono/cookie";
import type { CookieOptions } from "hono/utils/cookie";
import { ENVIRONMENT } from "@/config/env";

type ZayneCookieNames = "zayneVitaStockAccessToken" | "zayneVitaStockRefreshToken";

type GoogleCookieNames = "google_code_verifier" | "google_oauth_state";

type PossibleCookieNames = GoogleCookieNames | ZayneCookieNames;

export const getCookie = (ctx: Context, name: PossibleCookieNames) => cookieHelpers.getCookie(ctx, name);

export const getZayneCookieHeader = (ctx: Context, name: ZayneCookieNames) => ctx.req.header(name);

export const setCookie = (
	ctx: Context,
	options: CookieOptions & { name: PossibleCookieNames; value: string }
) => {
	const { name, value, ...restOptions } = options;

	const isProduction = ENVIRONMENT.NODE_ENV === "production";

	cookieHelpers.setCookie(ctx, name, value, {
		httpOnly: true,
		partitioned: isProduction,
		sameSite: isProduction ? "none" : "lax",
		secure: isProduction,
		...restOptions,
	});
};

export const deleteCookie = (ctx: Context, name: PossibleCookieNames) => {
	cookieHelpers.deleteCookie(ctx, name);
};
