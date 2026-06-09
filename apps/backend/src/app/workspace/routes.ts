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
import { emitAppEvent } from "@/lib/events";
import { AppError, AppJsonResponse } from "@/lib/utils";
import { generateRandomBytes } from "@/lib/utils/random";
import { authMiddleware, authorizeRoleMiddleware, validateWithZodMiddleware } from "@/middleware";
import { removeFromCache } from "@/services/cache";
import { getAuthResponseData } from "../auth/services/common";
import { hashToken, hashValue } from "../auth/services/hash";
import {
	assertAdminCanOnlyManagePharmacist,
	assertCanManageMember,
	assertNotCurrentUser,
} from "./services/assert";
import { getPendingInvitationForAction, getWorkspaceMemberForAction } from "./services/data-access";
import { sendPharmacistInviteEmail } from "./services/emails";
import { getWorkspaceEventPayload } from "./services/events";

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

			assertAdminCanOnlyManagePharmacist({ actorRole: currentUser.role, targetRole: role });

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

			emitAppEvent("workspace.invitationSent", {
				...getWorkspaceEventPayload({
					requestId: ctx.get("requestId"),
					user: currentUser,
				}),
				invitationId: insertedInvitation.id,
				recipient: inviteeEmail,
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

	.patch(
		"/member/role",
		authorizeRoleMiddleware(["owner"]),
		validateWithZodMiddleware("json", backendApiSchemaRoutes["@patch/workspace/member/role"].body),
		async (ctx) => {
			const { memberId, role } = ctx.req.valid("json");
			const currentUser = ctx.get("currentUser");

			const targetMember = await getWorkspaceMemberForAction({
				memberId,
				workspaceId: currentUser.workspaceId,
			});

			assertNotCurrentUser({ actorId: currentUser.id, targetMember });
			assertCanManageMember({ actorRole: currentUser.role, targetMember });

			const [updatedUser] = await db
				.update(users)
				.set({ role })
				.where(eq(users.id, targetMember.id))
				.returning();

			if (!updatedUser) {
				throw new AppError({
					code: 500,
					message: "Failed to update member role",
				});
			}

			await removeFromCache(`user:${targetMember.id}`);

			const eventPayload = getWorkspaceEventPayload({
				requestId: ctx.get("requestId"),
				user: currentUser,
			});

			emitAppEvent("workspace.memberRoleChanged", {
				...eventPayload,
				newRole: role,
				targetUserId: targetMember.id,
			});

			return AppJsonResponse(ctx, {
				data: null,
				message: "Member role updated successfully",
				schema: backendApiSchemaRoutes["@patch/workspace/member/role"].data,
			});
		}
	)

	.post(
		"/member/suspension",
		authorizeRoleMiddleware(["owner", "admin"]),
		validateWithZodMiddleware("json", backendApiSchemaRoutes["@post/workspace/member/suspension"].body),
		async (ctx) => {
			const { action, memberId } = ctx.req.valid("json");
			const currentUser = ctx.get("currentUser");

			const targetMember = await getWorkspaceMemberForAction({
				memberId,
				workspaceId: currentUser.workspaceId,
			});

			assertNotCurrentUser({ actorId: currentUser.id, targetMember });
			assertCanManageMember({ actorRole: currentUser.role, targetMember });

			if (action === "suspend" && targetMember.suspendedAt) {
				return AppJsonResponse(ctx, {
					data: null,
					message: "Member already suspended",
					schema: backendApiSchemaRoutes["@post/workspace/member/suspension"].data,
				});
			}

			if (action === "unsuspend" && !targetMember.suspendedAt) {
				return AppJsonResponse(ctx, {
					data: null,
					message: "Member is not suspended",
					schema: backendApiSchemaRoutes["@post/workspace/member/suspension"].data,
				});
			}

			const updateData =
				action === "suspend" ?
					{
						refreshTokenArray: [],
						suspendedAt: new Date(),
					}
				:	{ suspendedAt: null };

			const [updatedUser] = await db
				.update(users)
				.set(updateData)
				.where(eq(users.id, targetMember.id))
				.returning();

			if (!updatedUser) {
				throw new AppError({
					code: 500,
					message: `Failed to ${action} member`,
				});
			}

			await removeFromCache(`user:${targetMember.id}`);

			const eventPayload = getWorkspaceEventPayload({
				requestId: ctx.get("requestId"),
				user: currentUser,
			});

			emitAppEvent("workspace.memberSuspensionChanged", {
				...eventPayload,
				action,
				targetUserId: targetMember.id,
			});

			return AppJsonResponse(ctx, {
				data: null,
				message: `Member ${action === "suspend" ? "suspended" : "unsuspended"} successfully`,
				schema: backendApiSchemaRoutes["@post/workspace/member/suspension"].data,
			});
		}
	)

	.delete(
		"/member/:memberId",
		authorizeRoleMiddleware(["owner", "admin"]),
		validateWithZodMiddleware(
			"param",
			backendApiSchemaRoutes["@delete/workspace/member/:memberId"].params
		),
		async (ctx) => {
			const { memberId } = ctx.req.valid("param");
			const currentUser = ctx.get("currentUser");

			const targetMember = await getWorkspaceMemberForAction({
				memberId,
				workspaceId: currentUser.workspaceId,
			});

			assertNotCurrentUser({ actorId: currentUser.id, targetMember });
			assertCanManageMember({ actorRole: currentUser.role, targetMember });

			await db.delete(users).where(eq(users.id, targetMember.id));
			await removeFromCache(`user:${targetMember.id}`);

			const eventPayload = getWorkspaceEventPayload({
				requestId: ctx.get("requestId"),
				user: currentUser,
			});

			emitAppEvent("workspace.memberRemoved", {
				...eventPayload,
				targetUserId: targetMember.id,
			});

			return AppJsonResponse(ctx, {
				data: null,
				message: "Member permanently removed",
				schema: backendApiSchemaRoutes["@delete/workspace/member/:memberId"].data,
			});
		}
	)

	.post(
		"/invitation/resend",
		authorizeRoleMiddleware(["owner", "admin"]),
		validateWithZodMiddleware("json", backendApiSchemaRoutes["@post/workspace/invitation/resend"].body),
		async (ctx) => {
			const { defaultPassword, invitationId } = ctx.req.valid("json");

			const currentUser = ctx.get("currentUser");
			const currentWorkspace = ctx.get("currentWorkspace");

			const invitation = await getPendingInvitationForAction({
				invitationId,
				workspaceId: currentUser.workspaceId,
			});

			assertAdminCanOnlyManagePharmacist({ actorRole: currentUser.role, targetRole: invitation.role });

			const invitationToken = generateRandomBytes();
			const expiresAt = add(new Date(), { days: 7 });

			const [updatedInvitation] = await db
				.update(workspaceInvitations)
				.set({
					defaultPasswordHash: await hashValue(defaultPassword),
					expiresAt,
					tokenHash: hashToken(invitationToken),
				})
				.where(eq(workspaceInvitations.id, invitation.id))
				.returning();

			if (!updatedInvitation) {
				throw new AppError({
					code: 500,
					message: "Failed to resend invitation",
				});
			}

			await sendPharmacistInviteEmail({
				defaultPassword,
				invitedByEmail: currentUser.email,
				inviteeEmail: invitation.inviteeEmail,
				inviteeName: invitation.inviteeName,
				role: invitation.role,
				token: invitationToken,
				workspaceName: currentWorkspace.name,
			});

			const eventPayload = getWorkspaceEventPayload({
				requestId: ctx.get("requestId"),
				user: currentUser,
			});

			emitAppEvent("workspace.invitationResent", {
				...eventPayload,
				invitationId: invitation.id,
				recipient: invitation.inviteeEmail,
			});

			return AppJsonResponse(ctx, {
				data: null,
				message: "Invitation resent successfully",
				schema: backendApiSchemaRoutes["@post/workspace/invitation/resend"].data,
			});
		}
	)

	.delete(
		"/invitation/:invitationId",
		authorizeRoleMiddleware(["owner", "admin"]),
		validateWithZodMiddleware(
			"param",
			backendApiSchemaRoutes["@delete/workspace/invitation/:invitationId"].params
		),
		async (ctx) => {
			const { invitationId } = ctx.req.valid("param");
			const currentUser = ctx.get("currentUser");

			const invitation = await getPendingInvitationForAction({
				invitationId,
				workspaceId: currentUser.workspaceId,
			});

			assertAdminCanOnlyManagePharmacist({ actorRole: currentUser.role, targetRole: invitation.role });

			await db.delete(workspaceInvitations).where(eq(workspaceInvitations.id, invitation.id));

			const eventPayload = getWorkspaceEventPayload({
				requestId: ctx.get("requestId"),
				user: currentUser,
			});

			emitAppEvent("workspace.invitationCanceled", {
				...eventPayload,
				invitationId: invitation.id,
				recipient: invitation.inviteeEmail,
			});

			return AppJsonResponse(ctx, {
				data: null,
				message: "Invitation canceled successfully",
				schema: backendApiSchemaRoutes["@delete/workspace/invitation/:invitationId"].data,
			});
		}
	)

	.get("/members", async (ctx) => {
		const currentUser = ctx.get("currentUser");

		const [workspaceUsers, pendingInvitations] = await db.transaction((tx) => {
			return Promise.all([
				tx
					.select(pickKeys(users, ["createdAt", "email", "fullName", "id", "role", "suspendedAt"]))
					.from(users)
					.where(eq(users.workspaceId, currentUser.workspaceId)),

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
							isNull(workspaceInvitations.acceptedAt)
						)
					),
			]);
		});

		return AppJsonResponse(ctx, {
			data: {
				members: [
					...workspaceUsers.map((user) => {
						const isCurrentUser = user.id === currentUser.id;

						if (user.suspendedAt) {
							return {
								createdAt: user.createdAt,
								email: user.email,
								fullName: user.fullName,
								id: user.id,
								isCurrentUser,
								role: user.role,
								status: "suspended" as const,
								suspendedAt: user.suspendedAt,
							};
						}

						return {
							createdAt: user.createdAt,
							email: user.email,
							fullName: user.fullName,
							id: user.id,
							isCurrentUser,
							role: user.role,
							status: "active" as const,
						};
					}),
					...pendingInvitations.map((invitation) => ({
						...invitation,
						isCurrentUser: false as const,
						status: isPast(invitation.expiresAt) ? ("expired" as const) : ("pending" as const),
					})),
				],
			},
			message: "Workspace members fetched successfully",
			schema: backendApiSchemaRoutes["@get/workspace/members"].data,
		});
	});
