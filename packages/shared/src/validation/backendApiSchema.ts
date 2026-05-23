import {
	InsertUserSchema,
	InsertWorkspaceInvitationSchema,
	SelectUserSchema,
	SelectWorkspaceInvitationSchema,
} from "@vitastock/db/schema/auth";
import { InsertWorkspaceSchema, SelectWorkspaceSchema } from "@vitastock/db/schema/workspaces";
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

const withBaseSuccessResponse = <T extends z.ZodType>(dataSchema: T) =>
	BaseSuccessResponseSchema.extend({ data: dataSchema });

const withBaseErrorResponse = <T extends z.ZodType = typeof BaseErrorResponseSchema.shape.errors>(
	errorSchema?: T
) =>
	BaseErrorResponseSchema.extend({
		errors: (errorSchema ?? BaseErrorResponseSchema.shape.errors) as NonNullable<T>,
	});

const PasswordSchema = z.string().min(8, "Password must be at least 8 characters long");

const TokenObjectSchema = z.object({
	expiresAt: z.date(),
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

const authRoutes = () => {
	const UserDetailsSchema = SelectUserSchema.pick({
		email: true,
		emailVerifiedAt: true,
		fullName: true,
		id: true,
		mustChangePassword: true,
		role: true,
		workspaceId: true,
	});

	const WorkspaceDetailsSchema = SelectWorkspaceSchema.pick({
		alertEmail: true,
		id: true,
		lowStockThreshold: true,
		name: true,
		nearExpiryDays: true,
		timezone: true,
	});

	const AuthTokensSchema = z.object({
		access: TokenObjectSchema,
		refresh: TokenObjectSchema,
	});

	const AuthDataSchema = z.object({
		user: UserDetailsSchema,
		workspace: WorkspaceDetailsSchema,
	});

	const InvitationDataSchema = z.object({
		defaultPassword: PasswordSchema,
		inviteeEmail: InsertWorkspaceInvitationSchema.shape.inviteeEmail,
		inviteeName: InsertWorkspaceInvitationSchema.shape.inviteeName,
		role: UserDetailsSchema.shape.role.exclude(["owner"]),
	});

	const AuthSuccessResponseSchema = withBaseSuccessResponse(AuthDataSchema);

	const NullSuccessResponseSchema = withBaseSuccessResponse(z.null());

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

		"@post/auth/invitations/accept": {
			body: z.object({
				token: z.string().min(1, "Invitation token is required"),
			}),
			data: AuthSuccessResponseSchema,
		},

		"@post/auth/invitations/send": {
			body: InvitationDataSchema,
			data: withBaseSuccessResponse(
				z.object({
					invitation: InvitationDataSchema.pick({
						inviteeEmail: true,
						inviteeName: true,
						role: true,
					}).extend(SelectWorkspaceInvitationSchema.pick({ expiresAt: true }).shape),
				})
			),
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
export const backendApiSchema = defineSchema(
	{
		...defaultSchemaRoute,
		...authRoutes(),
	},
	{ strict: true }
);

export const backendApiSchemaRoutes = backendApiSchema.routes;

export type BackendApiRoutes = InferAllMainRoutes<typeof backendApiSchema.routes>;

export type BackendApiRouteKeys = InferAllMainRouteKeys<
	typeof backendApiSchema.routes,
	typeof backendApiSchema.config
>;
