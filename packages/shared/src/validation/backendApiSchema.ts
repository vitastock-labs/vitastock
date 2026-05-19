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
	expiresAt: z.preprocess((v: string) => new Date(v), z.date()),
	token: z.string(),
});

const UserSchema = z.object({
	email: z.string(),
	firstName: z.string(),
	fullName: z.string(),
	id: z.string(),
	lastName: z.string(),
	role: z.enum(["pharmacist", "admin"]),
	workspaceId: z.string(),
});

const defaultSchemaRoute = defineSchemaRoutes({
	[fallBackRouteSchemaKey]: {
		errorData: withBaseErrorResponse(),
	},
});

const authRoutes = () =>
	defineSchemaRoutes({
		"@get/auth/session": {
			data: withBaseSuccessResponse(
				z.object({
					user: UserSchema,
				})
			),
		},

		"@patch/auth/change-password": {
			body: z
				.object({
					confirmNewPassword: PasswordSchema,
					currentPassword: z.string().min(1, "Current password is required"),
					newPassword: PasswordSchema,
				})
				.refine((d) => d.newPassword === d.confirmNewPassword, {
					message: "Passwords do not match",
					path: ["confirmNewPassword"],
				}),
			data: withBaseSuccessResponse(z.null()),
		},

		"@post/auth/forgot-password": {
			body: z.object({
				email: z.email("Please enter a valid email"),
			}),
			data: withBaseSuccessResponse(z.null()),
		},

		"@post/auth/reset-password": {
			body: z
				.object({
					confirmNewPassword: PasswordSchema,
					newPassword: PasswordSchema,
					token: z.string().min(1, "Reset token is required"),
				})
				.refine((d) => d.newPassword === d.confirmNewPassword, {
					message: "Passwords do not match",
					path: ["confirmNewPassword"],
				}),
			data: withBaseSuccessResponse(z.null()),
		},

		"@post/auth/signin": {
			body: z.object({
				email: z.email("Please enter a valid email"),
				password: PasswordSchema,
			}),
			data: withBaseSuccessResponse(
				z.object({
					tokens: z.object({
						access: TokenObjectSchema,
						refresh: TokenObjectSchema,
					}),
					user: UserSchema,
				})
			),
		},

		"@post/auth/signout": {
			data: withBaseSuccessResponse(z.null()),
		},
	});

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
