import { db } from "@vitastock/db";
import { emailVerificationCodes, passwordResetTokens, users } from "@vitastock/db/schema/auth";
import { workspaceMemberships, workspaces } from "@vitastock/db/schema/workspace";
import { AUTH_ERRORS } from "@vitastock/shared/constants";
import { backendApiSchemaRoutes } from "@vitastock/shared/validation/backendApiSchema";
import { pickKeys } from "@zayne-labs/toolkit-core";
import { differenceInHours, isPast } from "date-fns";
import { eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { rateLimiter } from "hono-rate-limiter";
import { authRateLimiterOptions } from "@/config/rateLimiterOptions";
import { emitAppEvent } from "@/lib/events";
import { appLogger } from "@/lib/logger";
import { AppError, AppJsonResponse } from "@/lib/utils";
import { deleteCookie, getCookie, setCookie } from "@/lib/utils/cookie";
import { authMiddleware, validateWithZodMiddleware } from "@/middleware";
import { removeFromCache, setCache } from "@/services/cache";
import { getAuthResponseData, getCurrentSessionState } from "./services/data-access/common";
import { sendPasswordResetEmail, sendVerificationEmail, TokenSchema } from "./services/emails";
import { getAuthEventPayload } from "./services/events";
import { hashToken, hashValue, verifyHashedValue } from "./services/utils/hash";
import {
	decodeJwtToken,
	generateAccessToken,
	generateRefreshToken,
	getRefreshTokenResultWithHash,
	getUpdatedTokenResultArray,
} from "./services/utils/token";

const authRoutes = new Hono()
	.basePath("/auth")

	.post(
		"/signup",
		rateLimiter(authRateLimiterOptions),
		validateWithZodMiddleware("json", backendApiSchemaRoutes["@post/auth/signup"].body),
		async (ctx) => {
			const { email, fullName, password, pharmacyName } = ctx.req.valid("json");

			const [[existingUser], [existingWorkspace]] = await Promise.all([
				db
					.select(pickKeys(users, ["id"]))
					.from(users)
					.where(eq(users.email, email))
					.limit(1),
				db
					.select(pickKeys(workspaces, ["id"]))
					.from(workspaces)
					.where(eq(workspaces.name, pharmacyName))
					.limit(1),
			]);

			if (existingUser) {
				throw new AppError({
					appCode: AUTH_ERRORS.USER_ALREADY_EXISTS.appCode,
					code: 400,
					message: AUTH_ERRORS.USER_ALREADY_EXISTS.message,
				});
			}

			if (existingWorkspace) {
				throw new AppError({
					appCode: AUTH_ERRORS.WORKSPACE_ALREADY_EXISTS.appCode,
					code: 400,
					message: AUTH_ERRORS.WORKSPACE_ALREADY_EXISTS.message,
				});
			}

			const passwordHash = await hashValue(password);

			const newUser = await db.transaction(async (tx) => {
				const [insertedWorkspace] = await tx
					.insert(workspaces)
					.values({ name: pharmacyName })
					.returning();

				if (!insertedWorkspace) {
					throw new AppError({
						code: 500,
						message: "Failed to create workspace",
					});
				}

				const [insertedUser] = await tx
					.insert(users)
					.values({
						email,
						fullName,
						passwordHash,
					})
					.returning();

				if (!insertedUser) {
					throw new AppError({
						code: 500,
						message: "Failed to create user",
					});
				}

				const [insertedMembership] = await tx
					.insert(workspaceMemberships)
					.values({
						role: "owner",
						userId: insertedUser.id,
						workspaceId: insertedWorkspace.id,
					})
					.returning();

				if (!insertedMembership) {
					throw new AppError({
						code: 500,
						message: "Failed to create workspace membership",
					});
				}

				await sendVerificationEmail(insertedUser, tx as unknown as typeof db);

				return { insertedMembership, insertedUser, insertedWorkspace };
			});

			const { currentUser, currentWorkspace } = await getCurrentSessionState({
				existingMembership: newUser.insertedMembership,
				existingWorkspace: newUser.insertedWorkspace,
				user: newUser.insertedUser,
			});

			return AppJsonResponse(ctx, {
				data: await getAuthResponseData(currentUser, currentWorkspace),
				message: "Account created successfully",
				schema: backendApiSchemaRoutes["@post/auth/signup"].data,
			});
		}
	)

	.post(
		"/signin",
		rateLimiter(authRateLimiterOptions),
		validateWithZodMiddleware("json", backendApiSchemaRoutes["@post/auth/signin"].body),
		async (ctx) => {
			const { email, password } = ctx.req.valid("json");

			const [currentUser] = await db.select().from(users).where(eq(users.email, email)).limit(1);

			if (!currentUser) {
				throw new AppError({
					code: 401,
					message: "Email or password is incorrect",
					realReason: "User not found",
				});
			}

			const isValidPassword = await verifyHashedValue(currentUser.passwordHash, password);

			if (!isValidPassword) {
				await db
					.update(users)
					.set({ loginRetryCount: sql`${users.loginRetryCount} + 1` })
					.where(eq(users.id, currentUser.id));

				throw new AppError({
					code: 401,
					message: "Email or password is incorrect",
					realReason: "Invalid password",
				});
			}

			const {
				currentMembership,
				currentUser: sessionUser,
				currentWorkspace,
			} = await getCurrentSessionState({ user: currentUser });

			if (currentMembership.suspendedAt) {
				throw new AppError({
					appCode: AUTH_ERRORS.ACCOUNT_SUSPENDED.appCode,
					code: 401,
					message: AUTH_ERRORS.ACCOUNT_SUSPENDED.message,
				});
			}

			if (!sessionUser.emailVerifiedAt) {
				await sendVerificationEmail(currentUser, db);

				throw new AppError({
					appCode: AUTH_ERRORS.EMAIL_UNVERIFIED.appCode,
					code: 401,
					message: AUTH_ERRORS.EMAIL_UNVERIFIED.message,
				});
			}

			const hoursSinceLastLogin = differenceInHours(new Date(), sessionUser.lastLoginAt);
			const loginRetryWindowActive = hoursSinceLastLogin < 12;

			if (sessionUser.loginRetryCount >= 3 && loginRetryWindowActive) {
				throw new AppError({
					code: 401,
					message: "Login retries exceeded",
				});
			}

			const newRefreshTokenResult = generateRefreshToken(sessionUser);
			const newRefreshTokenResultWithHash = getRefreshTokenResultWithHash(newRefreshTokenResult);

			const updatedTokenArray = getUpdatedTokenResultArray({
				currentUser: sessionUser,
				refreshToken: getCookie(ctx, "vitastockRefreshToken"),
			});

			const [updatedUser] = await db
				.update(users)
				.set({
					lastLoginAt: new Date(),
					loginRetryCount: 0,
					refreshTokenArray: [...updatedTokenArray, newRefreshTokenResultWithHash],
				})
				.where(eq(users.id, currentUser.id))
				.returning();

			if (!updatedUser) {
				throw new AppError({
					code: 500,
					message: "Sign in failed",
				});
			}

			await setCache(`user:${updatedUser.id}`, updatedUser);

			const { currentUser: updatedSessionUser } = await getCurrentSessionState({
				existingMembership: currentMembership,
				existingWorkspace: currentWorkspace,
				user: updatedUser,
			});

			const newAccessTokenResult = generateAccessToken(updatedSessionUser);

			setCookie(ctx, {
				expires: newAccessTokenResult.expiresAt,
				name: "vitastockAccessToken",
				value: newAccessTokenResult.token,
			});
			setCookie(ctx, {
				expires: newRefreshTokenResult.expiresAt,
				name: "vitastockRefreshToken",
				value: newRefreshTokenResult.token,
			});

			emitAppEvent(
				"auth.userSignedIn",
				getAuthEventPayload({ requestId: ctx.get("requestId"), user: updatedSessionUser })
			);

			return AppJsonResponse(ctx, {
				data: {
					...(await getAuthResponseData(updatedSessionUser, currentWorkspace)),
					tokens: {
						access: newAccessTokenResult,
						refresh: newRefreshTokenResult,
					},
				},
				message: "Signed in successfully",
				schema: backendApiSchemaRoutes["@post/auth/signin"].data,
			});
		}
	)

	.post(
		"/verify-email",
		rateLimiter(authRateLimiterOptions),
		validateWithZodMiddleware("json", backendApiSchemaRoutes["@post/auth/verify-email"].body),
		async (ctx) => {
			const { code, email } = ctx.req.valid("json");

			const [result] = await db
				.select(pickKeys(emailVerificationCodes, ["code", "expiresAt", "userId"]))
				.from(emailVerificationCodes)
				.innerJoin(users, eq(emailVerificationCodes.userId, users.id))
				.where(eq(users.email, email))
				.limit(1);

			if (!result) {
				throw new AppError({
					code: 400,
					message: "Invalid or expired verification code",
					realReason: "No user or verification code found",
				});
			}

			if (isPast(result.expiresAt)) {
				await db
					.delete(emailVerificationCodes)
					.where(eq(emailVerificationCodes.userId, result.userId));

				throw new AppError({
					code: 400,
					message: "Invalid or expired verification code",
					realReason: "Verification code has expired",
				});
			}

			const isCodeValid = await verifyHashedValue(result.code, code);

			if (!isCodeValid) {
				throw new AppError({
					code: 400,
					message: "Invalid or expired verification code",
					realReason: "Invalid verification code",
				});
			}

			const [updatedUser] = await db
				.update(users)
				.set({ emailVerifiedAt: new Date() })
				.where(eq(users.id, result.userId))
				.returning();

			if (!updatedUser) {
				throw new AppError({
					code: 500,
					message: "User update failed",
				});
			}

			await db.delete(emailVerificationCodes).where(eq(emailVerificationCodes.userId, result.userId));

			const { currentUser, currentWorkspace } = await getCurrentSessionState({
				user: updatedUser,
			});

			return AppJsonResponse(ctx, {
				data: await getAuthResponseData(currentUser, currentWorkspace),
				message: "Account successfully verified!",
				schema: backendApiSchemaRoutes["@post/auth/verify-email"].data,
			});
		}
	)

	.post(
		"/resend-verification-email",
		rateLimiter(authRateLimiterOptions),
		validateWithZodMiddleware(
			"json",
			backendApiSchemaRoutes["@post/auth/resend-verification-email"].body
		),
		async (ctx) => {
			const { email } = ctx.req.valid("json");

			const [existingUser] = await db
				.select(pickKeys(users, ["id", "emailVerifiedAt", "email", "fullName"]))
				.from(users)
				.where(eq(users.email, email))
				.limit(1);

			// NOTE - Always respond generically to avoid user enumeration
			if (!existingUser || existingUser.emailVerifiedAt) {
				appLogger.pretty.warn(
					new Error(
						existingUser?.emailVerifiedAt ?
							`User with email address ${email} already verified at ${existingUser.emailVerifiedAt.toISOString()}`
						:	`User with email address ${email} not found`
					)
				);

				return AppJsonResponse(ctx, {
					data: null,
					message: "Verification email sent successfully",
					schema: backendApiSchemaRoutes["@post/auth/resend-verification-email"].data,
				});
			}

			await sendVerificationEmail(existingUser, db);

			return AppJsonResponse(ctx, {
				data: null,
				message: "Verification email sent successfully",
				schema: backendApiSchemaRoutes["@post/auth/resend-verification-email"].data,
			});
		}
	)

	.post(
		"/forgot-password",
		rateLimiter(authRateLimiterOptions),
		validateWithZodMiddleware("json", backendApiSchemaRoutes["@post/auth/forgot-password"].body),
		async (ctx) => {
			const { email } = ctx.req.valid("json");

			const [result] = await db
				.select({
					token: pickKeys(passwordResetTokens, ["retriedAt", "retryCount"]),
					user: pickKeys(users, ["email", "fullName", "id"]),
				})
				.from(users)
				.leftJoin(passwordResetTokens, eq(users.id, passwordResetTokens.userId))
				.where(eq(users.email, email))
				.limit(1);

			// NOTE - Always respond generically to avoid user enumeration
			if (!result) {
				appLogger.pretty.warn(new Error(`User with email address ${email} not found`));

				return AppJsonResponse(ctx, {
					data: null,
					message: `Password reset link sent to ${email}`,
					schema: backendApiSchemaRoutes["@post/auth/forgot-password"].data,
				});
			}

			const hoursSincePasswordRetryWindowStart =
				result.token?.retriedAt ? differenceInHours(new Date(), result.token.retriedAt) : null;

			const passwordResetWindowActive =
				hoursSincePasswordRetryWindowStart !== null && hoursSincePasswordRetryWindowStart < 24;

			if (result.token && result.token.retryCount >= 3 && passwordResetWindowActive) {
				const suspendedAt = new Date();

				await Promise.all([
					db
						.update(workspaceMemberships)
						.set({
							suspendedAt,
						})
						.where(eq(workspaceMemberships.userId, result.user.id)),
					removeFromCache(`workspace-membership:${result.user.id}`),
				]);

				throw new AppError({
					code: 401,
					message: "Password reset retries exceeded! Account suspended temporarily",
				});
			}

			await sendPasswordResetEmail(result.user, db, passwordResetWindowActive);

			return AppJsonResponse(ctx, {
				data: null,
				message: `Password reset link sent to ${email}`,
				schema: backendApiSchemaRoutes["@post/auth/forgot-password"].data,
			});
		}
	)

	.post(
		"/reset-password",
		rateLimiter(authRateLimiterOptions),
		validateWithZodMiddleware("json", backendApiSchemaRoutes["@post/auth/reset-password"].body),
		async (ctx) => {
			const { newPassword, token } = ctx.req.valid("json");

			const decodedPayload = decodeJwtToken(token, {
				onValidationError: (error) => {
					throw new AppError({
						code: 400,
						message: "Invalid or expired reset token",
						realReason: `Invalid reset token payload: ${error.message}`,
					});
				},
				schema: TokenSchema,
			});

			const hashedIncomingToken = hashToken(decodedPayload.token);

			const [result] = await db
				.select({
					membership: {
						id: workspaceMemberships.id,
						role: workspaceMemberships.role,
						suspendedAt: workspaceMemberships.suspendedAt,
						workspaceId: workspaceMemberships.workspaceId,
					},
					token: pickKeys(passwordResetTokens, ["expiresAt", "id"]),
					user: pickKeys(users, ["email", "fullName", "id"]),
				})
				.from(passwordResetTokens)
				.innerJoin(users, eq(passwordResetTokens.userId, users.id))
				.innerJoin(workspaceMemberships, eq(workspaceMemberships.userId, users.id))
				.where(eq(passwordResetTokens.tokenHash, hashedIncomingToken))
				.limit(1);

			if (!result?.token || result.membership.suspendedAt) {
				throw new AppError({
					code: 400,
					message: "Invalid or expired reset token",
					realReason: "No user or reset token found",
				});
			}

			if (isPast(result.token.expiresAt)) {
				await db.delete(passwordResetTokens).where(eq(passwordResetTokens.id, result.token.id));

				throw new AppError({
					code: 400,
					message: "Invalid or expired reset token",
					realReason: "Reset token has expired",
				});
			}

			const newPasswordHash = await hashValue(newPassword);

			const { updatedMembership, updatedUser } = await db.transaction(async (tx) => {
				const [userUpdate] = await tx
					.update(users)
					.set({
						passwordChangedAt: new Date(),
						passwordHash: newPasswordHash,
						// Sign out from all devices
						refreshTokenArray: [],
					})
					.where(eq(users.id, result.user.id))
					.returning();

				const [membershipUpdate] = await tx
					.update(workspaceMemberships)
					.set({
						suspendedAt: null,
					})
					.where(eq(workspaceMemberships.id, result.membership.id))
					.returning();

				await tx.delete(passwordResetTokens).where(eq(passwordResetTokens.id, result.token.id));

				return {
					updatedMembership: membershipUpdate,
					updatedUser: userUpdate,
				};
			});

			if (!updatedUser) {
				throw new AppError({
					code: 400,
					message: "Password reset failed",
				});
			}

			if (!updatedMembership) {
				throw new AppError({
					code: 400,
					message: "Password reset failed",
				});
			}

			await removeFromCache(`user:${updatedUser.id}`);
			await removeFromCache(`workspace-membership:${updatedUser.id}`);

			const { currentUser } = await getCurrentSessionState({
				existingMembership: updatedMembership,
				user: updatedUser,
			});

			emitAppEvent(
				"auth.passwordResetCompleted",
				getAuthEventPayload({ requestId: ctx.get("requestId"), user: currentUser })
			);

			return AppJsonResponse(ctx, {
				data: null,
				message: "Password reset successfully. Please sign in with your new password.",
				schema: backendApiSchemaRoutes["@post/auth/reset-password"].data,
			});
		}
	)

	.use(authMiddleware)

	.post("/signout", async (ctx) => {
		const currentUser = ctx.get("currentUser");

		const updatedTokenArray = getUpdatedTokenResultArray({
			currentUser,
			refreshToken: getCookie(ctx, "vitastockRefreshToken"),
		});

		await Promise.all([
			db
				.update(users)
				.set({ refreshTokenArray: updatedTokenArray })
				.where(eq(users.id, currentUser.id)),
			removeFromCache(`user:${currentUser.id}`),
		]);

		deleteCookie(ctx, "vitastockAccessToken");
		deleteCookie(ctx, "vitastockRefreshToken");

		emitAppEvent(
			"auth.userSignedOut",
			getAuthEventPayload({ requestId: ctx.get("requestId"), user: currentUser })
		);

		return AppJsonResponse(ctx, {
			data: null,
			message: "Signed out successfully",
			schema: backendApiSchemaRoutes["@post/auth/signout"].data,
		});
	})

	.post("/signout/all", async (ctx) => {
		const currentUser = ctx.get("currentUser");

		await Promise.all([
			db.update(users).set({ refreshTokenArray: [] }).where(eq(users.id, currentUser.id)),
			removeFromCache(`user:${currentUser.id}`),
		]);

		deleteCookie(ctx, "vitastockAccessToken");
		deleteCookie(ctx, "vitastockRefreshToken");

		emitAppEvent(
			"auth.userSignedOut",
			getAuthEventPayload({ requestId: ctx.get("requestId"), user: currentUser })
		);

		return AppJsonResponse(ctx, {
			data: null,
			message: "Signed out from all devices successfully",
			schema: backendApiSchemaRoutes["@post/auth/signout"].data,
		});
	})

	.get("/session", async (ctx) => {
		const currentUser = ctx.get("currentUser");
		const currentWorkspace = ctx.get("currentWorkspace");

		return AppJsonResponse(ctx, {
			data: await getAuthResponseData(currentUser, currentWorkspace),
			message: "Session fetched successfully",
			schema: backendApiSchemaRoutes["@get/auth/session"].data,
		});
	})

	.patch(
		"/change-password",
		rateLimiter(authRateLimiterOptions),
		validateWithZodMiddleware("json", backendApiSchemaRoutes["@patch/auth/change-password"].body),
		async (ctx) => {
			const { currentPassword, newPassword } = ctx.req.valid("json");
			const currentMembership = ctx.get("currentMembership");
			const currentUser = ctx.get("currentUser");
			const currentWorkspace = ctx.get("currentWorkspace");

			const isValidPassword = await verifyHashedValue(currentUser.passwordHash, currentPassword);

			if (!isValidPassword) {
				throw new AppError({
					code: 401,
					message: "Current password is incorrect",
				});
			}

			if (currentPassword === newPassword) {
				throw new AppError({
					code: 400,
					message: "Current password and new password cannot be the same",
				});
			}

			const newPasswordHash = await hashValue(newPassword);

			const updatedTokenArray = getUpdatedTokenResultArray({
				currentUser,
				refreshToken: getCookie(ctx, "vitastockRefreshToken"),
				variant: "keep-current",
			});

			const [updatedUser] = await db
				.update(users)
				.set({
					mustChangePassword: false,
					passwordChangedAt: new Date(),
					passwordHash: newPasswordHash,
					refreshTokenArray: updatedTokenArray,
					temporaryPasswordIssuedAt: null,
				})
				.where(eq(users.id, currentUser.id))
				.returning();

			if (!updatedUser) {
				throw new AppError({ code: 500, message: "Password change failed" });
			}

			await setCache(`user:${updatedUser.id}`, updatedUser);

			const { currentUser: updatedSessionUser } = await getCurrentSessionState({
				existingMembership: currentMembership,
				existingWorkspace: currentWorkspace,
				user: updatedUser,
			});

			emitAppEvent(
				"auth.passwordChanged",
				getAuthEventPayload({ requestId: ctx.get("requestId"), user: updatedSessionUser })
			);

			return AppJsonResponse(ctx, {
				data: null,
				message: "Password changed successfully",
				schema: backendApiSchemaRoutes["@patch/auth/change-password"].data,
			});
		}
	);

export { authRoutes };
