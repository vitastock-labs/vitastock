import { db } from "@vitastock/db";
import { users } from "@vitastock/db/schema/auth";
import { backendApiSchemaRoutes } from "@vitastock/shared/validation/backendApiSchema";
import { differenceInHours, isPast } from "date-fns";
import { and, eq, isNull, sql } from "drizzle-orm";
import { Hono } from "hono";
import { rateLimiter } from "hono-rate-limiter";
import { authRateLimiterOptions } from "@/config/rateLimiterOptions";
import { AppError, AppJsonResponse } from "@/lib/utils";
import { authMiddleware, validateWithZodMiddleware } from "@/middleware";
import { AUTH_ERROR_MESSAGES } from "@/middleware/authMiddleware/constants";
import { removeFromCache, setCache } from "@/services/cache";
import { getNecessaryUserDetails } from "./services/common";
import { deleteCookie, getCookie, setCookie } from "./services/cookie";
import { sendPasswordResetEmail, sendResetPasswordCompleteEmail, TokenSchema } from "./services/emails";
import { hashValue, verifyHashedValue } from "./services/hash";
import {
	decodeJwtToken,
	generateAccessToken,
	generateRefreshToken,
	getUpdatedTokenResultArray,
} from "./services/token";

const authRoutes = new Hono()
	.basePath("/auth")

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
				});
			}

			const isValidPassword = await verifyHashedValue(currentUser.passwordHash, password);

			if (!isValidPassword) {
				await db
					.update(users)
					.set({ loginRetryCount: sql`${users.loginRetryCount} + 1` })
					.where(eq(users.id, currentUser.id));

				throw new AppError({
					cause: "Invalid password",
					code: 401,
					message: "Email or password is incorrect",
				});
			}

			if (currentUser.suspendedAt) {
				throw new AppError({
					code: 401,
					message: AUTH_ERROR_MESSAGES.ACCOUNT_SUSPENDED,
				});
			}

			const hoursSinceLastLogin = differenceInHours(new Date(), currentUser.lastLoginAt);
			const loginRetryWindowActive = hoursSinceLastLogin < 12;

			if (currentUser.loginRetryCount >= 3 && loginRetryWindowActive) {
				throw new AppError({
					code: 401,
					message: "Login retries exceeded",
				});
			}

			const newRefreshTokenResult = generateRefreshToken(currentUser);

			const updatedTokenArray = getUpdatedTokenResultArray({
				currentUser,
				zayneRefreshToken: getCookie(ctx, "zayneVitaStockRefreshToken"),
			});

			const [updatedUser] = await db
				.update(users)
				.set({
					lastLoginAt: new Date(),
					loginRetryCount: 0,
					refreshTokenArray: [...updatedTokenArray, newRefreshTokenResult],
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

			const newAccessTokenResult = generateAccessToken(currentUser);

			setCookie(ctx, {
				expires: newAccessTokenResult.expiresAt,
				name: "zayneVitaStockAccessToken",
				value: newAccessTokenResult.token,
			});
			setCookie(ctx, {
				expires: newRefreshTokenResult.expiresAt,
				name: "zayneVitaStockRefreshToken",
				value: newRefreshTokenResult.token,
			});

			return AppJsonResponse(ctx, {
				data: {
					tokens: { access: newAccessTokenResult, refresh: newRefreshTokenResult },
					user: getNecessaryUserDetails(updatedUser),
				},
				message: "Signed in successfully",
				schema: backendApiSchemaRoutes["@post/auth/signin"].data,
			});
		}
	)

	.post(
		"/forgot-password",
		rateLimiter(authRateLimiterOptions),
		validateWithZodMiddleware("json", backendApiSchemaRoutes["@post/auth/forgot-password"].body),
		async (ctx) => {
			const { email } = ctx.req.valid("json");

			const [existingUser] = await db
				.select({
					email: users.email,
					firstName: users.firstName,
					id: users.id,
					passwordResetRetriedAt: users.passwordResetRetriedAt,
					passwordResetRetryCount: users.passwordResetRetryCount,
				})
				.from(users)
				.where(eq(users.email, email))
				.limit(1);

			// NOTE - Always respond generically to avoid user enumeration
			if (!existingUser) {
				return AppJsonResponse(ctx, {
					data: null,
					message: `Password reset link sent to ${email}`,
					schema: backendApiSchemaRoutes["@post/auth/forgot-password"].data,
				});
			}

			const hoursSincePasswordRetryWindowStart =
				existingUser.passwordResetRetriedAt ?
					differenceInHours(new Date(), existingUser.passwordResetRetriedAt)
				:	null;

			const passwordResetWindowActive =
				hoursSincePasswordRetryWindowStart !== null && hoursSincePasswordRetryWindowStart < 24;

			if (existingUser.passwordResetRetryCount >= 3 && passwordResetWindowActive) {
				await db.update(users).set({ suspendedAt: new Date() }).where(eq(users.id, existingUser.id));

				throw new AppError({
					code: 401,
					message: "Password reset retries exceeded! Account suspended temporarily",
				});
			}

			await db.transaction(async (tx) => {
				const [updatedUser] = await tx
					.update(users)
					.set({
						passwordResetRetriedAt:
							passwordResetWindowActive ? existingUser.passwordResetRetriedAt : new Date(),
						passwordResetRetryCount:
							passwordResetWindowActive ? sql`${users.passwordResetRetryCount} + 1` : 1,
					})
					.where(eq(users.id, existingUser.id))
					.returning({ email: users.email, firstName: users.firstName, id: users.id });

				if (!updatedUser) {
					throw new AppError({ code: 500, message: "Failed to update user" });
				}

				await sendPasswordResetEmail(updatedUser, tx as unknown as typeof db);
			});

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
						cause: error.message,
						code: 400,
						message: "Invalid or expired reset token",
					});
				},
				schema: TokenSchema,
			});

			const [result] = await db
				.select({
					email: users.email,
					firstName: users.firstName,
					id: users.id,
					passwordResetToken: users.passwordResetToken,
					passwordResetTokenExpiresAt: users.passwordResetTokenExpiresAt,
				})
				.from(users)
				.where(and(eq(users.passwordResetToken, decodedPayload.token), isNull(users.suspendedAt)))
				.limit(1);

			if (!result?.passwordResetToken || !result.passwordResetTokenExpiresAt) {
				throw new AppError({ code: 400, message: "Invalid or expired reset token" });
			}

			if (isPast(result.passwordResetTokenExpiresAt)) {
				await db
					.update(users)
					.set({ passwordResetToken: null, passwordResetTokenExpiresAt: null })
					.where(eq(users.id, result.id));

				throw new AppError({ code: 400, message: "Invalid or expired reset token" });
			}

			const newPasswordHash = await hashValue(newPassword);

			const [updatedUser] = await db
				.update(users)
				.set({
					passwordChangedAt: new Date(),
					passwordHash: newPasswordHash,
					passwordResetRetriedAt: null,
					passwordResetRetryCount: 0,
					passwordResetToken: null,
					passwordResetTokenExpiresAt: null,
					refreshTokenArray: [],
					suspendedAt: null,
				})
				.where(eq(users.id, result.id))
				.returning({ email: users.email, firstName: users.firstName, id: users.id });

			if (!updatedUser) {
				throw new AppError({ code: 400, message: "Password reset failed" });
			}

			await Promise.all([
				removeFromCache(`user:${updatedUser.id}`),
				sendResetPasswordCompleteEmail({ email: updatedUser.email, firstName: updatedUser.firstName }),
			]);

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
			zayneRefreshToken: getCookie(ctx, "zayneVitaStockRefreshToken"),
		});

		await Promise.all([
			db
				.update(users)
				.set({ refreshTokenArray: updatedTokenArray })
				.where(eq(users.id, currentUser.id)),
			removeFromCache(`user:${currentUser.id}`),
		]);

		deleteCookie(ctx, "zayneVitaStockAccessToken");
		deleteCookie(ctx, "zayneVitaStockRefreshToken");

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

		deleteCookie(ctx, "zayneVitaStockAccessToken");
		deleteCookie(ctx, "zayneVitaStockRefreshToken");

		return AppJsonResponse(ctx, {
			data: null,
			message: "Signed out from all devices successfully",
			schema: backendApiSchemaRoutes["@post/auth/signout"].data,
		});
	})

	.get("/session", (ctx) => {
		const currentUser = ctx.get("currentUser");

		return AppJsonResponse(ctx, {
			data: { user: getNecessaryUserDetails(currentUser) },
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
			const currentUser = ctx.get("currentUser");

			const isValidPassword = await verifyHashedValue(currentUser.passwordHash, currentPassword);

			if (!isValidPassword) {
				throw new AppError({ code: 401, message: "Current password is incorrect" });
			}

			const newPasswordHash = await hashValue(newPassword);

			const updatedTokenArray = getUpdatedTokenResultArray({
				currentUser,
				variant: "keep-current",
				zayneRefreshToken: getCookie(ctx, "zayneVitaStockRefreshToken"),
			});

			const [updatedUser] = await db
				.update(users)
				.set({
					passwordChangedAt: new Date(),
					passwordHash: newPasswordHash,
					refreshTokenArray: updatedTokenArray,
				})
				.where(eq(users.id, currentUser.id))
				.returning();

			if (!updatedUser) {
				throw new AppError({ code: 500, message: "Password change failed" });
			}

			await setCache(`user:${updatedUser.id}`, updatedUser);

			return AppJsonResponse(ctx, {
				data: null,
				message: "Password changed successfully",
				schema: backendApiSchemaRoutes["@patch/auth/change-password"].data,
			});
		}
	);

export { authRoutes };
