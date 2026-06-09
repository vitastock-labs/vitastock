/* eslint-disable import/no-named-as-default-member */

import { db } from "@vitastock/db";
import { users, type SelectUserType } from "@vitastock/db/schema/auth";
import { workspaces, type SelectWorkspaceType } from "@vitastock/db/schema/workspace";
import { AUTH_ERRORS } from "@vitastock/shared/constants";
import type { UnionDiscriminator } from "@zayne-labs/toolkit-type-helpers";
import { eq } from "drizzle-orm";
/* eslint-disable import/default */
import jwt from "jsonwebtoken";
/* eslint-enable import/default */
import {
	decodeJwtToken,
	generateAccessToken,
	isTokenInWhitelist,
	warnAboutTokenReuse,
} from "@/app/auth/services/token";
import { ENVIRONMENT } from "@/config/env";
import { AppError } from "@/lib/utils";
import { deleteCookie } from "@/lib/utils/cookie";
import { getFromCache, removeFromCache } from "@/services/cache";
import { requestContext } from "./requestContext";

type VerifyOptions = UnionDiscriminator<
	[
		{
			variant: "accessToken";
			zayneAccessToken: string;
			zayneRefreshToken: string;
		},
		{
			variant: "refreshToken";
			zayneRefreshToken: string;
		},
	]
>;

const handleTokenValidationError = () => {
	throw new AppError({
		appCode: AUTH_ERRORS.SESSION_NOT_EXIST.appCode,
		code: 401,
		message: AUTH_ERRORS.SESSION_NOT_EXIST.message,
	});
};

const getAndVerifyUserFromToken = async (options: VerifyOptions) => {
	const { variant, zayneAccessToken, zayneRefreshToken } = options;

	const decodedPayload =
		variant === "accessToken" ?
			decodeJwtToken(zayneAccessToken, {
				onValidationError: handleTokenValidationError,
				secretKey: ENVIRONMENT.ACCESS_SECRET,
			})
		:	decodeJwtToken(zayneRefreshToken, {
				onValidationError: handleTokenValidationError,
				secretKey: ENVIRONMENT.REFRESH_SECRET,
			});

	const currentUser = await getFromCache(`user:${decodedPayload.id}`, {
		onCacheMiss: async () => {
			const [user] = await db.select().from(users).where(eq(users.id, decodedPayload.id)).limit(1);

			return user;
		},
	});

	if (!currentUser) {
		throw new AppError({
			appCode: AUTH_ERRORS.SESSION_NOT_EXIST.appCode,
			code: 401,
			message: AUTH_ERRORS.SESSION_NOT_EXIST.message,
		});
	}

	const requestContextValue = requestContext.get();

	// == At this point, the refresh token is still valid but is not in the refreshTokenArray (whitelist)
	// == So it can be seen as a token reuse situation
	// == So clear the refreshTokenArray to log the user out from all devices including current device, greatly diminishing the risk of another token reuse attack
	if (!isTokenInWhitelist(currentUser.refreshTokenArray, zayneRefreshToken)) {
		warnAboutTokenReuse({
			compromisedRefreshToken: zayneRefreshToken,
			compromisedUser: currentUser,
			requestUserAgent: requestContextValue.honoCtx.req.header("user-agent") ?? "unknown",
		});

		await Promise.all([
			db.update(users).set({ refreshTokenArray: [] }).where(eq(users.id, currentUser.id)),
			removeFromCache(`user:${currentUser.id}`),
		]);

		deleteCookie(requestContextValue.honoCtx, "vitaStockRefreshToken");
		deleteCookie(requestContextValue.honoCtx, "vitaStockAccessToken");

		throw new AppError({
			appCode: AUTH_ERRORS.INVALID_SESSION.appCode,
			code: 401,
			message: AUTH_ERRORS.INVALID_SESSION.message,
		});
	}

	if (currentUser.suspendedAt) {
		throw new AppError({
			appCode: AUTH_ERRORS.ACCOUNT_SUSPENDED.appCode,
			code: 401,
			message: AUTH_ERRORS.ACCOUNT_SUSPENDED.message,
		});
	}

	if (!currentUser.emailVerifiedAt) {
		throw new AppError({
			appCode: AUTH_ERRORS.EMAIL_UNVERIFIED.appCode,
			code: 422,
			message: AUTH_ERRORS.EMAIL_UNVERIFIED.message,
		});
	}

	if (
		currentUser.mustChangePassword
		&& !requestContextValue.honoCtx.req.path.endsWith("/auth/change-password")
	) {
		throw new AppError({
			appCode: AUTH_ERRORS.PASSWORD_CHANGE_REQUIRED.appCode,
			code: 403,
			message: AUTH_ERRORS.PASSWORD_CHANGE_REQUIRED.message,
		});
	}

	// TODO csrf protection
	// TODO browser client fingerprinting

	return currentUser;
};

const getUserAndWorkspaceFromToken = async (options: VerifyOptions) => {
	const currentUser = await getAndVerifyUserFromToken(options);

	const currentWorkspace = await getFromCache(`workspace:${currentUser.workspaceId}`, {
		onCacheMiss: async () => {
			const [workspace] = await db
				.select()
				.from(workspaces)
				.where(eq(workspaces.id, currentUser.workspaceId))
				.limit(1);

			return workspace;
		},
	});

	if (!currentWorkspace) {
		throw new AppError({
			code: 500,
			message: "User workspace not found",
		});
	}

	return { currentUser, currentWorkspace };
};

type BaseSession = {
	currentUser: SelectUserType;
	currentWorkspace: SelectWorkspaceType;
};

type NewSession = BaseSession & {
	newZayneAccessTokenResult: ReturnType<typeof generateAccessToken>;
};

/**
 * @description This function is used to validate the refresh token and generate a new access token
 */
export const refreshUserSession = async (zayneRefreshToken: string): Promise<NewSession> => {
	try {
		const { currentUser, currentWorkspace } = await getUserAndWorkspaceFromToken({
			variant: "refreshToken",
			zayneRefreshToken,
		});

		const newZayneAccessTokenResult = generateAccessToken(currentUser);

		return {
			currentUser,
			currentWorkspace,
			newZayneAccessTokenResult,
		};
	} catch (error) {
		if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
			throw new AppError({
				appCode: AUTH_ERRORS.SESSION_EXPIRED.appCode,
				cause: error,
				code: 401,
				message: AUTH_ERRORS.SESSION_EXPIRED.message,
			});
		}

		if (AppError.isError(error)) {
			throw error;
		}

		throw new AppError({
			appCode: AUTH_ERRORS.SESSION_VALIDATION_FAILED.appCode,
			cause: error,
			code: 401,
			message: AUTH_ERRORS.SESSION_VALIDATION_FAILED.message,
		});
	}
};

type ExistingSession = BaseSession & {
	newZayneAccessTokenResult: null;
};

type TokenPairFromCookies = {
	zayneAccessToken: string | undefined;
	zayneRefreshToken: string | undefined;
};

/**
 * @description Main authentication function that validates or refreshes user sessions
 * Handles both initial authentication and token refresh scenarios
 */
const validateUserSession = async (
	tokens: TokenPairFromCookies
): Promise<ExistingSession | NewSession> => {
	const { zayneAccessToken, zayneRefreshToken } = tokens;

	if (!zayneRefreshToken) {
		throw new AppError({
			appCode: AUTH_ERRORS.SESSION_NOT_EXIST.appCode,
			code: 401,
			message: AUTH_ERRORS.SESSION_NOT_EXIST.message,
		});
	}

	if (!zayneAccessToken) {
		return refreshUserSession(zayneRefreshToken);
	}

	try {
		const { currentUser, currentWorkspace } = await getUserAndWorkspaceFromToken({
			variant: "accessToken",
			zayneAccessToken,
			zayneRefreshToken,
		});

		return {
			currentUser,
			currentWorkspace,
			newZayneAccessTokenResult: null,
		};
	} catch (error) {
		if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
			return refreshUserSession(zayneRefreshToken);
		}

		if (AppError.isError(error)) {
			throw error;
		}

		throw new AppError({
			appCode: AUTH_ERRORS.SESSION_VALIDATION_FAILED.appCode,
			cause: error,
			code: 401,
			message: AUTH_ERRORS.SESSION_VALIDATION_FAILED.message,
		});
	}
};

export { validateUserSession };
