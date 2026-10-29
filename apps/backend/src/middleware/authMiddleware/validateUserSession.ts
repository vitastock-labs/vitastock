/* eslint-disable import/no-named-as-default-member */

import { db } from "@vitastock/db";
import { users, type SessionUserType } from "@vitastock/db/schema/auth";
import { AUTH_ERRORS } from "@vitastock/shared/constants";
import type { UnionDiscriminator } from "@zayne-labs/toolkit-type-helpers";
import { eq } from "drizzle-orm";
/* eslint-disable import/default */
import jwt from "jsonwebtoken";
import { getCurrentMembership, getCurrentSessionState } from "@/app/auth/services/data-access/common";
/* eslint-enable import/default */
import {
	decodeJwtToken,
	generateAccessToken,
	isTokenInWhitelist,
	warnAboutTokenReuse,
} from "@/app/auth/services/utils/token";
import { ENVIRONMENT } from "@/config/env";
import { AppError } from "@/lib/utils";
import { deleteCookie } from "@/lib/utils/cookie";
import { getFromCache, removeFromCache } from "@/services/cache";
import { requestContext } from "./requestContext";

type VerifyOptions = UnionDiscriminator<
	[
		{
			existingAccessToken: string;
			existingRefreshToken: string;
			variant: "accessToken";
		},
		{
			existingRefreshToken: string;
			variant: "refreshToken";
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
	const { existingAccessToken, existingRefreshToken, variant } = options;

	const decodedPayload =
		variant === "accessToken" ?
			decodeJwtToken(existingAccessToken, {
				onValidationError: handleTokenValidationError,
				secretKey: ENVIRONMENT.ACCESS_SECRET,
			})
		:	decodeJwtToken(existingRefreshToken, {
				onValidationError: handleTokenValidationError,
				secretKey: ENVIRONMENT.REFRESH_SECRET,
			});

	const baseUser = await getFromCache(`user:${decodedPayload.id}`, {
		onCacheMiss: async () => {
			const [user] = await db.select().from(users).where(eq(users.id, decodedPayload.id)).limit(1);

			return user;
		},
	});

	if (!baseUser) {
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
	if (!isTokenInWhitelist(baseUser.refreshTokenArray, existingRefreshToken)) {
		const membership = await getCurrentMembership(baseUser.id);

		warnAboutTokenReuse({
			compromisedRefreshToken: existingRefreshToken,
			compromisedUser: {
				...baseUser,
				role: membership.role,
				workspaceId: membership.workspaceId,
			},
			requestUserAgent: requestContextValue.honoCtx.req.header("user-agent") ?? "unknown",
		});

		deleteCookie(requestContextValue.honoCtx, "vitastockRefreshToken");
		deleteCookie(requestContextValue.honoCtx, "vitastockAccessToken");

		await Promise.all([
			db.update(users).set({ refreshTokenArray: [] }).where(eq(users.id, baseUser.id)),
			removeFromCache(`user:${baseUser.id}`),
			removeFromCache(`workspace-membership:${baseUser.id}`),
		]);

		throw new AppError({
			appCode: AUTH_ERRORS.INVALID_SESSION.appCode,
			code: 401,
			message: AUTH_ERRORS.INVALID_SESSION.message,
		});
	}

	const { currentMembership, currentUser, currentWorkspace } = await getCurrentSessionState({
		user: baseUser,
	});

	if (currentMembership.suspendedAt) {
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

	return { currentMembership, currentUser, currentWorkspace };
};

type BaseSession = {
	currentMembership: Awaited<ReturnType<typeof getCurrentMembership>>;
	currentUser: SessionUserType;
	currentWorkspace: Awaited<ReturnType<typeof getCurrentSessionState>>["currentWorkspace"];
};

type NewSession = BaseSession & {
	newZayneAccessTokenResult: ReturnType<typeof generateAccessToken>;
};

/**
 * @description This function is used to validate the refresh token and generate a new access token
 */
export const refreshUserSession = async (
	options: Pick<VerifyOptions, "existingRefreshToken">
): Promise<NewSession> => {
	const { existingRefreshToken } = options;

	try {
		const { currentMembership, currentUser, currentWorkspace } = await getAndVerifyUserFromToken({
			existingRefreshToken,
			variant: "refreshToken",
		});

		const newZayneAccessTokenResult = generateAccessToken(currentUser);

		return {
			currentMembership,
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
	existingAccessToken: string | undefined;
	existingRefreshToken: string | undefined;
};

/**
 * @description Main authentication function that validates or refreshes user sessions
 * Handles both initial authentication and token refresh scenarios
 */
const validateUserSession = async (
	tokens: TokenPairFromCookies
): Promise<ExistingSession | NewSession> => {
	const { existingAccessToken, existingRefreshToken } = tokens;

	if (!existingRefreshToken) {
		throw new AppError({
			appCode: AUTH_ERRORS.SESSION_NOT_EXIST.appCode,
			code: 401,
			message: AUTH_ERRORS.SESSION_NOT_EXIST.message,
		});
	}

	if (!existingAccessToken) {
		return refreshUserSession({ existingRefreshToken });
	}

	try {
		const { currentMembership, currentUser, currentWorkspace } = await getAndVerifyUserFromToken({
			existingAccessToken,
			existingRefreshToken,
			variant: "accessToken",
		});

		return {
			currentMembership,
			currentUser,
			currentWorkspace,
			newZayneAccessTokenResult: null,
		};
	} catch (error) {
		if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
			return refreshUserSession({ existingRefreshToken });
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
