import type { InsertUserType, SelectUserType } from "@vitastock/db/schema/auth";
import {
	INVENTORY_STATUS,
	STOCK_LOG_TYPES,
	STOCK_OUT_REASONS,
	type InsertStockBatchType,
	type InsertStockLogType,
	type SelectDrugType,
	type SelectStockBatchType,
	type SelectStockLogType,
} from "@vitastock/db/schema/inventory";
import type {
	InsertWorkspaceType,
	SelectWorkspaceInvitationType,
	SelectWorkspaceMembershipType,
	SelectWorkspaceType,
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
const WorkspaceRoleSchema = z.enum(["owner", "admin", "pharmacist"]);

type SignUpPayloadType = Pick<InsertUserType, "email" | "fullName"> & {
	password: string;
	pharmacyName: InsertWorkspaceType["name"];
};
type UserDetailsType = Pick<
	SelectUserType,
	"email" | "emailVerifiedAt" | "fullName" | "id" | "mustChangePassword"
> & {
	role: SelectWorkspaceMembershipType["role"];
	workspaceId: SelectWorkspaceMembershipType["workspaceId"];
};
type WorkspaceDetailsType = Pick<
	SelectWorkspaceType,
	"alertEmail" | "id" | "lowStockThreshold" | "name" | "nearExpiryDays" | "timezone"
>;
type WorkspaceInvitationRecordType = Pick<
	SelectWorkspaceInvitationType,
	"createdAt" | "expiresAt" | "id" | "inviteeEmail" | "inviteeName" | "role"
>;

type DrugDetailsType = Pick<SelectDrugType, "form" | "id" | "name" | "strength" | "unit">;

type RecentStockActivityType = Pick<SelectStockLogType, "createdAt" | "id" | "logType" | "quantity"> & {
	drug: Pick<SelectDrugType, "id" | "name" | "strength">;
	person: string;
};

type InventorySummaryRowType = {
	drug: DrugDetailsType;
	drugId: SelectDrugType["id"];
	nearestBatch?: Pick<
		SelectStockBatchType,
		"batchNumber" | "id" | "quantityAvailable" | "unitCostKobo"
	> & {
		expiryDate: Date;
	};
	nearestExpiryDate?: Date;
	status: typeof INVENTORY_STATUS.$inferUnion;
	stockValueKobo: number;
	totalAvailable: number;
};

const stringWithDateValidation = () => {
	return z.preprocess((value: string) => new Date(value), z.date());
};

const stringWithNumberValidation = <TNumberSchema extends z.ZodNumber>(numberSchema: TNumberSchema) => {
	return z.preprocess((value: string) => Number(value), numberSchema);
};

const TokenObjectSchema = z.object({
	expiresAt: stringWithDateValidation(),
	token: z.string(),
});

export const SignUpSchema = z.object({
	email: z.email("Please enter a valid email"),
	fullName: z.string().min(1, "Name is required"),
	password: PasswordSchema,
	pharmacyName: z.string().min(1, "Pharmacy name is required"),
}) satisfies z.ZodType<SignUpPayloadType>;

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

const UserDetailsSchema = z.object({
	email: z.email("Please enter a valid email"),
	emailVerifiedAt: stringWithDateValidation().nullable(),
	fullName: z.string().min(1, "Name is required"),
	id: z.uuid(),
	mustChangePassword: z.boolean(),
	role: WorkspaceRoleSchema,
	workspaceId: z.uuid(),
}) satisfies z.ZodType<UserDetailsType>;

const WorkspaceDetailsSchema = z.object({
	alertEmail: z.email().nullable(),
	id: z.uuid(),
	lowStockThreshold: z.number(),
	name: z.string().min(1, "Pharmacy name is required"),
	nearExpiryDays: z.number(),
	timezone: z.string(),
}) satisfies z.ZodType<WorkspaceDetailsType>;

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
	const ManageableWorkspaceRoleSchema = WorkspaceRoleSchema.exclude(["owner"]);

	const InvitationRecordSchema = z.object({
		createdAt: stringWithDateValidation(),
		expiresAt: stringWithDateValidation(),
		id: z.uuid(),
		inviteeEmail: z.email("Please enter a valid email"),
		inviteeName: z.string().min(1, "Name is required"),
		role: ManageableWorkspaceRoleSchema,
	}) satisfies z.ZodType<WorkspaceInvitationRecordType>;

	const WorkspaceMemberSchema = z.discriminatedUnion("status", [
		z.object({
			createdAt: stringWithDateValidation(),
			email: z.email("Please enter a valid email"),
			fullName: z.string().min(1, "Name is required"),
			id: z.uuid(),
			isCurrentUser: z.boolean(),
			role: WorkspaceRoleSchema,
			status: z.literal("active"),
		}),
		z.object({
			createdAt: stringWithDateValidation(),
			email: z.email("Please enter a valid email"),
			fullName: z.string().min(1, "Name is required"),
			id: z.uuid(),
			isCurrentUser: z.boolean(),
			role: WorkspaceRoleSchema,
			status: z.literal("suspended"),
			suspendedAt: stringWithDateValidation(),
		}),
		InvitationRecordSchema.extend({
			isCurrentUser: z.literal(false),
			status: z.literal("pending"),
		}),
		InvitationRecordSchema.extend({
			isCurrentUser: z.literal(false),
			status: z.literal("expired"),
		}),
	]);

	const InvitationIdParamSchema = z.object({
		invitationId: z.uuid("Invalid invitation ID"),
	});

	const MemberIdParamSchema = z.object({
		memberId: z.uuid("Invalid member ID"),
	});

	const InvitationDataSchema = z.object({
		defaultPassword: PasswordSchema,
		expiresAt: stringWithDateValidation(),
		inviteeEmail: z.email("Please enter a valid email"),
		inviteeName: z.string().min(1, "Name is required"),
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

const DrugDetailsSchema = z.object({
	form: z.string(),
	id: z.uuid(),
	name: z.string(),
	strength: z.string(),
	unit: z.string(),
}) satisfies z.ZodType<DrugDetailsType>;

const inventoryRoutes = () => {
	const InsertStockLogSchema = z.object({
		batchId: z.uuid().optional(),
		createdAt: stringWithDateValidation(),
		drugId: z.uuid(),
		id: z.uuid(),
		logType: z.enum(STOCK_LOG_TYPES),
		notes: z.string().optional(),
		performedByUserId: z.uuid(),
		quantity: z.number(),
		reason: z.enum(STOCK_OUT_REASONS).optional(),
		stockTransactionId: z.uuid().optional(),
		unitCostKobo: z.number().default(0),
		workspaceId: z.uuid(),
	}) satisfies z.ZodType<InsertStockLogType>;

	const InsertStockBatchSchema = z.object({
		batchNumber: z.string().optional(),
		createdAt: stringWithDateValidation(),
		drugId: z.uuid(),
		expiryDate: stringWithDateValidation(),
		id: z.uuid(),
		quantityAvailable: z.number(),
		quantityReceived: z.number(),
		unitCostKobo: z.number().default(0),
		updatedAt: stringWithDateValidation(),
		userId: z.uuid(),
		workspaceId: z.uuid(),
	}) satisfies z.ZodType<InsertStockBatchType>;

	const StockAdditionBodySchema = InsertStockLogSchema.pick({
		drugId: true,
		logType: true,
		notes: true,
		quantity: true,
		unitCostKobo: true,
	}).extend({
		batchNumber: InsertStockBatchSchema.shape.batchNumber.optional(),
		expiryDate: stringWithDateValidation(),
		logType: z.enum(["opening_stock", "stock_in"]),
		quantity: stringWithNumberValidation(InsertStockLogSchema.shape.quantity.positive()),
		unitCostKobo: stringWithNumberValidation(
			InsertStockLogSchema.shape.unitCostKobo.unwrap().min(0)
		).optional(),
	});

	const StockOutBodySchema = InsertStockLogSchema.pick({
		drugId: true,
		logType: true,
		notes: true,
		quantity: true,
		reason: true,
	}).extend({
		logType: z.literal("stock_out"),
		quantity: stringWithNumberValidation(InsertStockLogSchema.shape.quantity.positive()),
		reason: z.enum(["damaged", "expired", "patient", "ward"]),
	});

	const InventorySummaryRowSchema = z.object({
		drug: DrugDetailsSchema,
		drugId: z.uuid(),
		nearestBatch: z
			.object({
				batchNumber: z.string().nullable(),
				expiryDate: stringWithDateValidation(),
				id: z.uuid(),
				quantityAvailable: z.number(),
				unitCostKobo: z.number(),
			})
			.optional(),
		nearestExpiryDate: stringWithDateValidation().optional(),
		status: z.enum(INVENTORY_STATUS),
		stockValueKobo: z.number(),
		totalAvailable: z.number(),
	}) satisfies z.ZodType<InventorySummaryRowType>;

	return defineSchemaRoutes({
		"@get/inventory/summary": {
			data: withBaseSuccessResponse(
				z.object({
					rows: z.array(InventorySummaryRowSchema),
					stats: z.object({
						criticalCount: z.number(),
						stockValueKobo: z.number(),
					}),
				})
			),
		},

		"@post/inventory/stock-log": {
			body: z.discriminatedUnion("logType", [StockAdditionBodySchema, StockOutBodySchema]),
			data: NullSuccessResponseSchema,
		},
	});
};

const dashboardRoutes = () => {
	const RecentStockActivitySchema = z.object({
		createdAt: stringWithDateValidation(),
		drug: DrugDetailsSchema.pick({
			id: true,
			name: true,
			strength: true,
		}),
		id: z.uuid(),
		logType: z.enum(["damaged", "expired", "opening_stock", "reconciliation", "stock_in", "stock_out"]),
		person: z.string(),
		quantity: z.number(),
	}) satisfies z.ZodType<RecentStockActivityType>;

	return defineSchemaRoutes({
		"@get/dashboard/overview": {
			data: withBaseSuccessResponse(
				z.object({
					recentActivity: z.array(RecentStockActivitySchema),
					stats: z.object({
						expiredCount: z.number(),
						expiringSoonCount: z.number(),
						lowStockCount: z.number(),
						stockValueKobo: z.number(),
					}),
				})
			),
		},
	});
};
export const backendApiSchema = defineSchema(
	{
		...defaultSchemaRoute,
		...authRoutes(),
		...workspaceRoutes(),
		...inventoryRoutes(),
		...dashboardRoutes(),
	},
	{ strict: true }
);

export const backendApiSchemaRoutes = backendApiSchema.routes;

export type BackendApiRoutes = InferAllMainRoutes<typeof backendApiSchema.routes>;

export type BackendApiRouteKeys = InferAllMainRouteKeys<
	typeof backendApiSchema.routes,
	typeof backendApiSchema.config
>;
