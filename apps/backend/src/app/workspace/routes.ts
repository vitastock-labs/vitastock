import { db } from "@vitastock/db";
import { users } from "@vitastock/db/schema/auth";
import { workspaceInvitations, workspaces } from "@vitastock/db/schema/workspace";
import { backendApiSchemaRoutes } from "@vitastock/shared/validation/backendApiSchema";
import { pickKeys } from "@zayne-labs/toolkit-core";
import { add, isPast } from "date-fns";
import { and, eq, gt, isNull } from "drizzle-orm";
import { Hono } from "hono";
import { rateLimiter } from "hono-rate-limiter";
import { authRateLimiterOptions } from "@/config/rateLimiterOptions";
import { AppError, AppJsonResponse } from "@/lib/utils";
import { generateRandomBytes } from "@/lib/utils/random";
import { authMiddleware, authorizeRoleMiddleware, validateWithZodMiddleware } from "@/middleware";
import { getAuthResponseData } from "../auth/services/common";
import { hashToken, hashValue } from "../auth/services/hash";
import { sendPharmacistInviteEmail } from "./services/emails";

export const workspaceRoutes = new Hono()
	.basePath("/workspace")

	.post(
		"/invitation/accept",
		validateWithZodMiddleware("json", backendApiSchemaRoutes["@post/workspace/invitation/accept"].body),
		async (ctx) => {
			const { token } = ctx.req.valid("json");

			const tokenHash = hashToken(token);

			const [invitationResult] = await db
				.select(
					pickKeys(workspaceInvitations, [
						"acceptedAt",
						"defaultPasswordHash",
						"expiresAt",
						"id",
						"inviteeEmail",
						"inviteeName",
						"role",
						"workspaceId",
					])
				)
				.from(workspaceInvitations)
				.innerJoin(workspaces, eq(workspaceInvitations.workspaceId, workspaces.id))
				.where(eq(workspaceInvitations.tokenHash, tokenHash))
				.limit(1);

			if (!invitationResult || invitationResult.acceptedAt) {
				throw new AppError({
					code: 400,
					message: "Invalid invitation",
				});
			}

			if (isPast(invitationResult.expiresAt)) {
				await db.delete(workspaceInvitations).where(eq(workspaceInvitations.id, invitationResult.id));

				throw new AppError({
					code: 400,
					message: "Invalid or expired invitation",
				});
			}

			const [existingUser] = await db
				.select(pickKeys(users, ["id"]))
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
						role: invitationResult.role,
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
				schema: backendApiSchemaRoutes["@post/workspace/invitation/accept"].data,
			});
		}
	)

	.use(authMiddleware)

	.post(
		"/invitation/send",
		authorizeRoleMiddleware(["owner", "admin"]),
		rateLimiter(authRateLimiterOptions),
		validateWithZodMiddleware("json", backendApiSchemaRoutes["@post/workspace/invitation/send"].body),
		async (ctx) => {
			const { defaultPassword, inviteeEmail, inviteeName, role } = ctx.req.valid("json");

			const currentUser = ctx.get("currentUser");
			const currentWorkspace = ctx.get("currentWorkspace");

			const [existingUser] = await db
				.select(pickKeys(users, ["id"]))
				.from(users)
				.where(eq(users.email, inviteeEmail))
				.limit(1);

			if (existingUser) {
				throw new AppError({
					code: 400,
					message: "A user with this email already exists in this workspace",
				});
			}

			const [activeInvitation] = await db
				.select(pickKeys(workspaceInvitations, ["id"]))
				.from(workspaceInvitations)
				.where(
					and(
						eq(workspaceInvitations.inviteeEmail, inviteeEmail),
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
					inviteeEmail,
					inviteeName,
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
				invitedByEmail: currentUser.email,
				inviteeEmail,
				inviteeName,
				role,
				token: invitationToken,
				workspaceName: currentWorkspace.name,
			});

			return AppJsonResponse(ctx, {
				data: {
					invitation: {
						...pickKeys(insertedInvitation, ["expiresAt", "id", "inviteeEmail", "inviteeName"]),
						role,
					},
				},
				message: "Invitation sent successfully",
				schema: backendApiSchemaRoutes["@post/workspace/invitation/send"].data,
			});
		}
	)

	.get("/members", async (ctx) => {
		const currentUser = ctx.get("currentUser");

		const [workspaceUsers, pendingInvitations] = await db.transaction((tx) => {
			return Promise.all([
				tx
					.select(pickKeys(users, ["createdAt", "email", "fullName", "id", "role"]))
					.from(users)
					.where(and(eq(users.workspaceId, currentUser.workspaceId), isNull(users.suspendedAt))),

				tx
					.select(
						pickKeys(workspaceInvitations, [
							"createdAt",
							"expiresAt",
							"id",
							"inviteeEmail",
							"inviteeName",
							"role",
						])
					)
					.from(workspaceInvitations)
					.where(
						and(
							eq(workspaceInvitations.workspaceId, currentUser.workspaceId),
							gt(workspaceInvitations.expiresAt, new Date()),
							isNull(workspaceInvitations.acceptedAt)
						)
					),
			]);
		});

		return AppJsonResponse(ctx, {
			data: {
				members: [
					...workspaceUsers.map((user) => ({
						...user,
						isCurrentUser: user.id === currentUser.id,
						status: "active" as const,
					})),
					...pendingInvitations.map((invitation) => ({
						...invitation,
						isCurrentUser: false as const,
						status: "pending" as const,
					})),
				],
			},
			message: "Workspace members fetched successfully",
			schema: backendApiSchemaRoutes["@get/workspace/members"].data,
		});
	});
