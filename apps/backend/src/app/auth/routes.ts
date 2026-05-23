import { db } from "@vitastock/db";
import {
	emailVerificationCodes,
	passwordResetTokens,
	users,
	workspaceInvitations,
} from "@vitastock/db/schema/auth";
import { workspaces } from "@vitastock/db/schema/workspaces";
import { AUTH_ERRORS } from "@vitastock/shared/constants";
import { backendApiSchemaRoutes } from "@vitastock/shared/validation/backendApiSchema";
import { pickKeys } from "@zayne-labs/toolkit-core";
import { add, differenceInHours, isPast } from "date-fns";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { Hono } from "hono";
import { rateLimiter } from "hono-rate-limiter";
import { authRateLimiterOptions } from "@/config/rateLimiterOptions";
import { AppError, AppJsonResponse } from "@/lib/utils";
import { generateRandomBytes } from "@/lib/utils/random";
import { authMiddleware, authorizeRoleMiddleware, validateWithZodMiddleware } from "@/middleware";
import { removeFromCache, setCache } from "@/services/cache";
import { getAuthResponseData } from "./services/common";
import { deleteCookie, getCookie, setCookie } from "./services/cookie";
import {
	sendPasswordResetEmail,
	sendPharmacistInviteEmail,
	sendResetPasswordCompleteEmail,
	sendVerificationEmail,
	TokenSchema,
} from "./services/emails";
import { hashToken, hashValue, verifyHashedValue } from "./services/hash";
import {
	decodeJwtToken,
	generateAccessToken,
	generateRefreshToken,
	getRefreshTokenResultWithHash,
	getUpdatedTokenResultArray,
} from "./services/token";

const authRoutes = new Hono()
	.basePath("/auth")

	.post(
		"/signup",
		rateLimiter(authRateLimiterOptions),
		validateWithZodMiddleware("json", backendApiSchemaRoutes["@post/auth/signup"].body),
		async (ctx) => {
			const { email, fullName, password, pharmacyName } = ctx.req.valid("json");

			const [existingUser] = await db
				.select({ id: users.id })
				.from(users)
				.where(eq(users.email, email))
				.limit(1);

			if (existingUser) {
				throw new AppError({
					code: 400,
					message: "User already exists",
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
						role: "owner",
						workspaceId: insertedWorkspace.id,
					})
					.returning();

				if (!insertedUser) {
					throw new AppError({
						code: 500,
						message: "Failed to create user",
					});
				}

				await sendVerificationEmail(insertedUser, tx as unknown as typeof db);

				return insertedUser;
			});

			return AppJsonResponse(ctx, {
				data: await getAuthResponseData(newUser),
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

			if (currentUser.suspendedAt) {
				throw new AppError({
					appCode: AUTH_ERRORS.ACCOUNT_SUSPENDED.appCode,
					code: 401,
					message: AUTH_ERRORS.ACCOUNT_SUSPENDED.message,
				});
			}

			if (!currentUser.emailVerifiedAt) {
				await sendVerificationEmail(currentUser, db);

				throw new AppError({
					appCode: AUTH_ERRORS.EMAIL_UNVERIFIED.appCode,
					code: 401,
					message: AUTH_ERRORS.EMAIL_UNVERIFIED.message,
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
			const newRefreshTokenResultWithHash = getRefreshTokenResultWithHash(newRefreshTokenResult);

			const updatedTokenArray = getUpdatedTokenResultArray({
				currentUser,
				zayneRefreshToken: getCookie(ctx, "zayneVitaStockRefreshToken"),
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

			const newAccessTokenResult = generateAccessToken(updatedUser);

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
					...(await getAuthResponseData(updatedUser)),
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
				.select({
					code: emailVerificationCodes.code,
					expiresAt: emailVerificationCodes.expiresAt,
					userId: emailVerificationCodes.userId,
				})
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

			return AppJsonResponse(ctx, {
				data: {
					...(await getAuthResponseData(updatedUser)),
				},
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
			if (existingUser && !existingUser.emailVerifiedAt) {
				await sendVerificationEmail(existingUser, db);
			}

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
					token: {
						retriedAt: passwordResetTokens.retriedAt,
						retryCount: passwordResetTokens.retryCount,
					},
					user: {
						email: users.email,
						fullName: users.fullName,
						id: users.id,
					},
				})
				.from(users)
				.leftJoin(passwordResetTokens, eq(users.id, passwordResetTokens.userId))
				.where(eq(users.email, email))
				.limit(1);

			// NOTE - Always respond generically to avoid user enumeration
			if (!result) {
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
				await db
					.update(users)
					.set({
						suspendedAt: new Date(),
					})
					.where(eq(users.id, result.user.id));

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
					token: {
						expiresAt: passwordResetTokens.expiresAt,
						id: passwordResetTokens.id,
					},
					user: {
						email: users.email,
						fullName: users.fullName,
						id: users.id,
					},
				})
				.from(passwordResetTokens)
				.innerJoin(users, eq(passwordResetTokens.userId, users.id))
				.where(and(eq(passwordResetTokens.tokenHash, hashedIncomingToken), isNull(users.suspendedAt)))
				.limit(1);

			if (!result?.token) {
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

			const [updatedUser] = await db.transaction(async (tx) => {
				const [userUpdate] = await tx
					.update(users)
					.set({
						passwordChangedAt: new Date(),
						passwordHash: newPasswordHash,
						// Sign out from all devices
						refreshTokenArray: [],
						suspendedAt: null,
					})
					.where(eq(users.id, result.user.id))
					.returning();

				await tx.delete(passwordResetTokens).where(eq(passwordResetTokens.id, result.token.id));

				return [userUpdate];
			});

			if (!updatedUser) {
				throw new AppError({
					code: 400,
					message: "Password reset failed",
				});
			}

			await Promise.all([
				removeFromCache(`user:${updatedUser.id}`),
				sendResetPasswordCompleteEmail({ email: updatedUser.email, fullName: updatedUser.fullName }),
			]);

			return AppJsonResponse(ctx, {
				data: null,
				message: "Password reset successfully. Please sign in with your new password.",
				schema: backendApiSchemaRoutes["@post/auth/reset-password"].data,
			});
		}
	)

	.post(
		"/invitations/accept",
		rateLimiter(authRateLimiterOptions),
		validateWithZodMiddleware("json", backendApiSchemaRoutes["@post/auth/invitations/accept"].body),
		async (ctx) => {
			const { token } = ctx.req.valid("json");

			const tokenHash = hashToken(token);

			const [invitationResult] = await db
				.select({
					acceptedAt: workspaceInvitations.acceptedAt,
					defaultPasswordHash: workspaceInvitations.defaultPasswordHash,
					expiresAt: workspaceInvitations.expiresAt,
					id: workspaceInvitations.id,
					inviteeEmail: workspaceInvitations.inviteeEmail,
					inviteeName: workspaceInvitations.inviteeName,
					role: workspaceInvitations.role,
					workspaceId: workspaceInvitations.workspaceId,
				})
				.from(workspaceInvitations)
				.innerJoin(workspaces, eq(workspaceInvitations.workspaceId, workspaces.id))
				.where(eq(workspaceInvitations.tokenHash, tokenHash))
				.limit(1);

			if (!invitationResult || invitationResult.acceptedAt || isPast(invitationResult.expiresAt)) {
				throw new AppError({
					code: 400,
					message: "Invalid or expired invitation",
				});
			}

			const [existingUser] = await db
				.select({ id: users.id })
				.from(users)
				.where(eq(users.email, invitationResult.inviteeEmail))
				.limit(1);

			if (existingUser) {
				throw new AppError({
					code: 400,
					message: "A user with this email already exists",
				});
			}

			const newUser = await db.transaction(async (tx) => {
				const [insertedUser] = await tx
					.insert(users)
					.values({
						email: invitationResult.inviteeEmail,
						emailVerifiedAt: new Date(),
						fullName: invitationResult.inviteeName,
						mustChangePassword: true,
						passwordHash: invitationResult.defaultPasswordHash,
						role: "pharmacist",
						temporaryPasswordIssuedAt: new Date(),
						workspaceId: invitationResult.workspaceId,
					})
					.returning();

				if (!insertedUser) {
					throw new AppError({
						code: 500,
						message: "Failed to create invited user",
					});
				}

				await tx
					.update(workspaceInvitations)
					.set({ acceptedAt: new Date() })
					.where(eq(workspaceInvitations.id, invitationResult.id));

				return insertedUser;
			});

			return AppJsonResponse(ctx, {
				data: await getAuthResponseData(newUser),
				message: "Invitation accepted successfully",
				schema: backendApiSchemaRoutes["@post/auth/invitations/accept"].data,
			});
		}
	)

	.use(authMiddleware)

	.post(
		"/invitations",
		authorizeRoleMiddleware(["owner"]),
		rateLimiter(authRateLimiterOptions),
		validateWithZodMiddleware("json", backendApiSchemaRoutes["@post/auth/invitations"].body),
		async (ctx) => {
			const { defaultPassword, email, name, role } = ctx.req.valid("json");

			const currentUser = ctx.get("currentUser");
			const currentWorkspace = ctx.get("currentWorkspace");

			const [existingUser] = await db
				.select({ id: users.id })
				.from(users)
				.where(eq(users.email, email))
				.limit(1);

			if (existingUser) {
				throw new AppError({
					code: 400,
					message: "A user with this email already exists",
				});
			}

			const [activeInvitation] = await db
				.select({ id: workspaceInvitations.id })
				.from(workspaceInvitations)
				.where(
					and(
						eq(workspaceInvitations.inviteeEmail, email),
						eq(workspaceInvitations.workspaceId, currentUser.workspaceId),
						gt(workspaceInvitations.expiresAt, new Date()),
						isNull(workspaceInvitations.acceptedAt)
					)
				)
				.limit(1);

			if (activeInvitation) {
				throw new AppError({
					code: 400,
					message: "An active invitation already exists for this email",
				});
			}

			const invitationToken = generateRandomBytes();

			const defaultPasswordHash = await hashValue(defaultPassword);

			const tokenHash = hashToken(invitationToken);

			const expiresAt = add(new Date(), { days: 7 });

			const [insertedInvitation] = await db
				.insert(workspaceInvitations)
				.values({
					defaultPasswordHash,
					expiresAt,
					invitedByUserId: currentUser.id,
					inviteeEmail: email,
					inviteeName: name,
					role,
					tokenHash,
					workspaceId: currentUser.workspaceId,
				})
				.returning();

			if (!insertedInvitation) {
				throw new AppError({
					code: 500,
					message: "Failed to create invitation",
				});
			}

			await sendPharmacistInviteEmail({
				defaultPassword,
				email,
				inviterEmail: currentUser.email,
				name,
				role,
				token: invitationToken,
				workspaceName: currentWorkspace.name,
			});

			return AppJsonResponse(ctx, {
				data: {
					invitation: {
						expiresAt: insertedInvitation.expiresAt,
						id: insertedInvitation.id,
						inviteeEmail: insertedInvitation.inviteeEmail,
						inviteeName: insertedInvitation.inviteeName,
						role,
					},
				},
				message: "Invitation sent successfully",
				schema: backendApiSchemaRoutes["@post/auth/invitations"].data,
			});
		}
	)

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
			const currentUser = ctx.get("currentUser");

			const isValidPassword = await verifyHashedValue(currentUser.passwordHash, currentPassword);

			if (!isValidPassword) {
				throw new AppError({
					code: 401,
					message: "Current password is incorrect",
				});
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

			return AppJsonResponse(ctx, {
				data: null,
				message: "Password changed successfully",
				schema: backendApiSchemaRoutes["@patch/auth/change-password"].data,
			});
		}
	);

export { authRoutes };
