import { InsertUserSchema, SelectUserSchema } from "@vitastock/db/schema/auth";
import {
	InsertWorkspaceSchema,
	SelectWorkspaceInvitationSchema,
	SelectWorkspaceSchema,
} from "@vitastock/db/schema/workspace";
import { AUTH_ERROR_APP_CODES } from "@vitastock/shared/constants";
import type { InferAllMainRouteKeys, InferAllMainRoutes } from "@zayne-labs/callapi";
import { fallBackRouteSchemaKey } from "@zayne-labs/callapi/constants";
import { defineSchema, defineSchemaRoutes } from "@zayne-labs/callapi/utils";
import { z } from "zod";

const BaseSuccessResponseSchema = z.object({
	data: z.record(z.string(), z.unknown()),
	message: z.string(),
	status: z.literal("success"),
});

const BaseErrorResponseSchema = z.object({
	appCode: z.literal(AUTH_ERROR_APP_CODES).optional(),
	errors: z.record(z.string(), z.array(z.string())).optional(),
	message: z.string(),
	status: z.literal("error"),
});

export type BaseApiSuccessResponse<TData = z.infer<typeof BaseSuccessResponseSchema.shape.data>> = Omit<
	z.infer<typeof BaseSuccessResponseSchema>,
	"data"
> & { data: TData };

export type BaseApiErrorResponse<TErrors = z.infer<typeof BaseErrorResponseSchema>["errors"]> = Omit<
	z.infer<typeof BaseErrorResponseSchema>,
	"errors"
> & { errors: TErrors };

const withBaseSuccessResponse = <TDataSchema extends z.ZodType>(dataSchema: TDataSchema) => {
	return BaseSuccessResponseSchema.extend({ data: dataSchema });
};
const withBaseErrorResponse = <
	TErrorSchema extends z.ZodType = typeof BaseErrorResponseSchema.shape.errors,
>(
	errorSchema?: TErrorSchema
) => {
	return BaseErrorResponseSchema.extend({
		errors: (errorSchema ?? BaseErrorResponseSchema.shape.errors) as NonNullable<TErrorSchema>,
	});
};

const PasswordSchema = z.string().min(8, "Password must be at least 8 characters long");

const stringWithDateValidation = () =>
	z.preprocess((value) => (typeof value === "string" ? new Date(value) : value), z.date());

const TokenObjectSchema = z.object({
	expiresAt: stringWithDateValidation(),
	token: z.string(),
});

export const SignUpSchema = InsertUserSchema.pick({
	email: true,
	fullName: true,
}).extend({
	password: PasswordSchema,
	pharmacyName: InsertWorkspaceSchema.shape.name,
});

export const withMatchingPasswordFields = <
	TPasswordKey extends "newPassword" | "password",
	TConfirmPasswordKey extends "confirmNewPassword" | "confirmPassword",
	TSchema extends z.ZodObject<Record<TConfirmPasswordKey | TPasswordKey, z.ZodType>>,
>(options: {
	confirmPasswordKey: TConfirmPasswordKey;
	passwordKey: TPasswordKey;
	schema: TSchema;
}) => {
	const { confirmPasswordKey, passwordKey, schema } = options;

	return schema.refine((data) => data[passwordKey as never] === data[confirmPasswordKey as never], {
		error: "Passwords do not match",
		path: [confirmPasswordKey],
	});
};

const defaultSchemaRoute = defineSchemaRoutes({
	[fallBackRouteSchemaKey]: {
		errorData: withBaseErrorResponse(),
	},
});

const UserDetailsSchema = SelectUserSchema.pick({
	email: true,
	emailVerifiedAt: true,
	fullName: true,
	id: true,
	mustChangePassword: true,
	role: true,
	workspaceId: true,
}).extend({
	emailVerifiedAt: stringWithDateValidation().nullable(),
});

const WorkspaceDetailsSchema = SelectWorkspaceSchema.pick({
	alertEmail: true,
	id: true,
	lowStockThreshold: true,
	name: true,
	nearExpiryDays: true,
	timezone: true,
});

const AuthDataSchema = z.object({
	user: UserDetailsSchema,
	workspace: WorkspaceDetailsSchema,
});

const AuthSuccessResponseSchema = withBaseSuccessResponse(AuthDataSchema);

const NullSuccessResponseSchema = withBaseSuccessResponse(z.null());

const authRoutes = () => {
	const AuthTokensSchema = z.object({
		access: TokenObjectSchema,
		refresh: TokenObjectSchema,
	});

	return defineSchemaRoutes({
		"@get/auth/session": {
			data: AuthSuccessResponseSchema,
		},

		"@patch/auth/change-password": {
			body: withMatchingPasswordFields({
				confirmPasswordKey: "confirmNewPassword",
				passwordKey: "newPassword",
				schema: z.object({
					confirmNewPassword: PasswordSchema,
					currentPassword: z.string().min(1, "Current password is required"),
					newPassword: PasswordSchema,
				}),
			}),
			data: NullSuccessResponseSchema,
		},

		"@post/auth/forgot-password": {
			body: SignUpSchema.pick({ email: true }),
			data: NullSuccessResponseSchema,
		},

		"@post/auth/resend-verification-email": {
			body: SignUpSchema.pick({ email: true }),
			data: NullSuccessResponseSchema,
		},

		"@post/auth/reset-password": {
			body: withMatchingPasswordFields({
				confirmPasswordKey: "confirmNewPassword",
				passwordKey: "newPassword",
				schema: z.object({
					confirmNewPassword: PasswordSchema,
					newPassword: PasswordSchema,
					token: z.string().min(1, "Reset token is required"),
				}),
			}),
			data: NullSuccessResponseSchema,
		},

		"@post/auth/signin": {
			body: SignUpSchema.pick({
				email: true,
				password: true,
			}),
			data: withBaseSuccessResponse(
				z.object({
					tokens: AuthTokensSchema,
					user: UserDetailsSchema,
					workspace: WorkspaceDetailsSchema,
				})
			),
		},

		"@post/auth/signout": {
			data: NullSuccessResponseSchema,
		},

		"@post/auth/signup": {
			body: SignUpSchema,
			data: AuthSuccessResponseSchema,
		},

		"@post/auth/verify-email": {
			body: SignUpSchema.pick({ email: true }).extend({
				code: z.string().length(6, "Code must be 6 digits long"),
			}),
			data: AuthSuccessResponseSchema,
		},
	});
};

export const workspaceRoutes = () => {
	const ManageableWorkspaceRoleSchema = UserDetailsSchema.shape.role.exclude(["owner"]);

	const WorkspaceMemberSchema = z.discriminatedUnion("status", [
		SelectUserSchema.pick({
			createdAt: true,
			email: true,
			fullName: true,
			id: true,
			role: true,
		}).extend({
			createdAt: stringWithDateValidation(),
			isCurrentUser: z.boolean(),
			status: z.literal("active"),
		}),
		SelectUserSchema.pick({
			createdAt: true,
			email: true,
			fullName: true,
			id: true,
			role: true,
			suspendedAt: true,
		}).extend({
			createdAt: stringWithDateValidation(),
			isCurrentUser: z.boolean(),
			status: z.literal("suspended"),
			suspendedAt: stringWithDateValidation(),
		}),
		SelectWorkspaceInvitationSchema.pick({
			createdAt: true,
			expiresAt: true,
			id: true,
			inviteeEmail: true,
			inviteeName: true,
			role: true,
		}).extend({
			createdAt: stringWithDateValidation(),
			expiresAt: stringWithDateValidation(),
			isCurrentUser: z.literal(false),
			role: ManageableWorkspaceRoleSchema,
			status: z.literal("pending"),
		}),
		SelectWorkspaceInvitationSchema.pick({
			createdAt: true,
			expiresAt: true,
			id: true,
			inviteeEmail: true,
			inviteeName: true,
			role: true,
		}).extend({
			createdAt: stringWithDateValidation(),
			expiresAt: stringWithDateValidation(),
			isCurrentUser: z.literal(false),
			role: ManageableWorkspaceRoleSchema,
			status: z.literal("expired"),
		}),
	]);

	const InvitationIdParamSchema = z.object({
		invitationId: z.uuid("Invalid invitation ID"),
	});

	const MemberIdParamSchema = z.object({
		memberId: z.uuid("Invalid member ID"),
	});

	const InvitationDataSchema = SelectWorkspaceInvitationSchema.pick({
		expiresAt: true,
		inviteeEmail: true,
		inviteeName: true,
		role: true,
	}).extend({
		defaultPassword: PasswordSchema,
		expiresAt: stringWithDateValidation(),
		role: ManageableWorkspaceRoleSchema,
	});

	return defineSchemaRoutes({
		"@delete/workspace/invitation/:invitationId": {
			data: NullSuccessResponseSchema,
			params: InvitationIdParamSchema,
		},

		"@delete/workspace/member/:memberId": {
			data: NullSuccessResponseSchema,
			params: MemberIdParamSchema,
		},

		"@get/workspace/members": {
			data: withBaseSuccessResponse(
				z.object({
					members: z.array(WorkspaceMemberSchema),
				})
			),
		},

		"@patch/workspace/member/role": {
			body: z.object({
				memberId: MemberIdParamSchema.shape.memberId,
				role: ManageableWorkspaceRoleSchema,
			}),
			data: NullSuccessResponseSchema,
		},

		"@post/workspace/invitation/accept": {
			body: z.object({
				token: z.string().min(1, "Invitation token is required"),
			}),
			data: AuthSuccessResponseSchema,
		},

		"@post/workspace/invitation/resend": {
			body: InvitationIdParamSchema.extend(InvitationDataSchema.pick({ defaultPassword: true }).shape),
			data: NullSuccessResponseSchema,
		},

		"@post/workspace/invitation/send": {
			body: InvitationDataSchema.omit({ expiresAt: true }),
			data: withBaseSuccessResponse(
				z.object({
					invitation: InvitationDataSchema.pick({
						inviteeEmail: true,
						inviteeName: true,
						role: true,
					}).extend({
						expiresAt: stringWithDateValidation(),
					}),
				})
			),
		},

		"@post/workspace/member/suspension": {
			body: z.object({
				action: z.enum(["suspend", "unsuspend"]),
				memberId: MemberIdParamSchema.shape.memberId,
			}),
			data: NullSuccessResponseSchema,
		},
	});
};
export const backendApiSchema = defineSchema(
	{
		...defaultSchemaRoute,
		...authRoutes(),
		...workspaceRoutes(),
	},
	{ strict: true }
);

export const backendApiSchemaRoutes = backendApiSchema.routes;

export type BackendApiRoutes = InferAllMainRoutes<typeof backendApiSchema.routes>;

export type BackendApiRouteKeys = InferAllMainRouteKeys<
	typeof backendApiSchema.routes,
	typeof backendApiSchema.config
>;
