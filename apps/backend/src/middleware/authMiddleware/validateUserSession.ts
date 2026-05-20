/* eslint-disable import/no-named-as-default-member */

import { db } from "@vitastock/db";
import { users, type SelectUserType } from "@vitastock/db/schema/auth";
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
import { getFromCache, removeFromCache } from "@/services/cache";
import { AUTH_ERROR_MESSAGES } from "./constants";
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
		code: 401,
		message: AUTH_ERROR_MESSAGES.SESSION_NOT_EXIST,
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
			code: 401,
			message: AUTH_ERROR_MESSAGES.SESSION_NOT_EXIST,
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
			requestUserAgent: requestContextValue.userAgent ?? "unknown",
		});

		await Promise.all([
			db.update(users).set({ refreshTokenArray: [] }).where(eq(users.id, currentUser.id)),
			removeFromCache(`user:${currentUser.id}`),
		]);

		throw new AppError({
			code: 401,
			message: AUTH_ERROR_MESSAGES.INVALID_SESSION,
		});
	}

	if (currentUser.suspendedAt) {
		throw new AppError({
			code: 401,
			message: AUTH_ERROR_MESSAGES.ACCOUNT_SUSPENDED,
		});
	}

	if (!currentUser.emailVerifiedAt) {
		throw new AppError({
			code: 422,
			message: AUTH_ERROR_MESSAGES.EMAIL_UNVERIFIED,
		});
	}

	if (currentUser.mustChangePassword && !requestContextValue.path.endsWith("/auth/change-password")) {
		throw new AppError({
			code: 403,
			message: AUTH_ERROR_MESSAGES.PASSWORD_CHANGE_REQUIRED,
		});
	}

	// TODO csrf protection
	// TODO browser client fingerprinting

	return currentUser;
};

type NewSession = {
	currentUser: SelectUserType;
	newZayneAccessTokenResult: ReturnType<typeof generateAccessToken>;
};

/**
 * @description This function is used to validate the refresh token and generate a new access token
 */
export const refreshUserSession = async (zayneRefreshToken: string): Promise<NewSession> => {
	try {
		const currentUser = await getAndVerifyUserFromToken({
			variant: "refreshToken",
			zayneRefreshToken,
		});

		const newZayneAccessTokenResult = generateAccessToken(currentUser);

		return {
			currentUser,
			newZayneAccessTokenResult,
		};
	} catch (error) {
		if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
			throw new AppError({
				cause: error,
				code: 401,
				message: AUTH_ERROR_MESSAGES.SESSION_EXPIRED,
			});
		}

		if (AppError.isError(error)) {
			throw error;
		}

		throw new AppError({
			cause: error,
			code: 401,
			message: AUTH_ERROR_MESSAGES.GENERIC_ERROR,
		});
	}
};

type ExistingSession = {
	currentUser: SelectUserType;
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
			code: 401,
			message: AUTH_ERROR_MESSAGES.SESSION_NOT_EXIST,
		});
	}

	if (!zayneAccessToken) {
		return refreshUserSession(zayneRefreshToken);
	}

	try {
		const currentUser = await getAndVerifyUserFromToken({
			variant: "accessToken",
			zayneAccessToken,
			zayneRefreshToken,
		});

		return {
			currentUser,
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
			cause: error,
			code: 401,
			message: AUTH_ERROR_MESSAGES.GENERIC_ERROR,
		});
	}
};

export { validateUserSession };
