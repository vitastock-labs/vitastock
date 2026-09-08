import { ROLES } from "@vitastock/db/constants";
import type { InsertUserType, SelectUserType } from "@vitastock/db/schema/auth";
import {
	INVENTORY_ALERT_STATUSES,
	INVENTORY_ALERT_TYPES,
	INVENTORY_STOCK_STATUS,
	STOCK_LOG_TYPES,
	STOCK_OUT_REASONS,
	type SelectDrugType,
	type SelectStockBatchType,
	type SelectStockLogType,
} from "@vitastock/db/schema/inventory";
import {
	EMAIL_ALERT_DELIVERY_POLICIES,
	type InsertWorkspaceType,
	type SelectWorkspaceInvitationType,
	type SelectWorkspaceMembershipType,
	type SelectWorkspaceType,
} from "@vitastock/db/schema/workspace";
import type { InferAllMainRouteKeys, InferAllMainRoutes } from "@zayne-labs/callapi";
import { fallBackRouteSchemaKey } from "@zayne-labs/callapi/constants";
import { defineSchema, defineSchemaRoutes } from "@zayne-labs/callapi/utils";
import type { Prettify } from "@zayne-labs/toolkit-type-helpers";
import { z } from "zod";
import {
	createInventoryBulkImportRowKey,
	INVENTORY_BULK_IMPORT_MAX_ROWS,
} from "../inventoryBulkImportSchema";
import {
	STOCK_ADDITION_LOG_TYPES,
	STOCK_MOVEMENT_LOG_TYPES,
	STOCK_OUT_LOG_TYPES,
	STOCK_REDUCTION_LOG_TYPES,
} from "./constants";
import {
	stringWithDateValidation,
	stringWithNumberValidation,
	withBaseErrorResponse,
	withBaseSuccessResponse,
	withMatchingPasswordFields,
} from "./utils";

const PasswordSchema = z.string().min(8, "Password must be at least 8 characters long");

export const WorkspaceRoleSchema = z.enum(ROLES);
export const EmailAlertDeliveryPolicySchema = z.enum(EMAIL_ALERT_DELIVERY_POLICIES);

export const StockLogTypeSchema = z.enum(STOCK_LOG_TYPES);
export const StockOutReasonSchema = z.enum(STOCK_OUT_REASONS);
export const StockAdditionLogTypeSchema = z.enum(STOCK_ADDITION_LOG_TYPES);
export const StockOutLogTypeSchema = z.enum(STOCK_OUT_LOG_TYPES);
export const StockMovementLogTypeSchema = z.enum(STOCK_MOVEMENT_LOG_TYPES);
export const StockReductionLogTypeSchema = z.enum(STOCK_REDUCTION_LOG_TYPES);

type SignUpPayloadType = Prettify<
	Pick<InsertUserType, "email" | "fullName"> & {
		password: string;
		pharmacyName: InsertWorkspaceType["name"];
	}
>;

export const SignUpSchema = z.toZod<SignUpPayloadType>()(
	z.object({
		email: z.email("Please enter a valid email"),
		fullName: z.string().min(1, "Name is required"),
		password: PasswordSchema,
		pharmacyName: z.string().min(1, "Pharmacy name is required"),
	})
);

type UserDetailsType = Prettify<
	Pick<SelectUserType, "email" | "emailVerifiedAt" | "fullName" | "id" | "mustChangePassword"> & {
		role: SelectWorkspaceMembershipType["role"];
		workspaceId: SelectWorkspaceMembershipType["workspaceId"];
	}
>;

const UserDetailsSchema = z.toZod<UserDetailsType>()(
	z.object({
		email: z.email("Please enter a valid email"),
		emailVerifiedAt: stringWithDateValidation().nullable(),
		fullName: z.string().min(1, "Name is required"),
		id: z.uuid(),
		mustChangePassword: z.boolean(),
		role: WorkspaceRoleSchema,
		workspaceId: z.uuid(),
	})
);

type WorkspaceDetailsType = Pick<
	SelectWorkspaceType,
	| "alertEmail"
	| "emailAlertDeliveryPolicy"
	| "id"
	| "lowStockThreshold"
	| "name"
	| "nearExpiryDays"
	| "timezone"
>;

const WorkspaceDetailsSchema = z.toZod<WorkspaceDetailsType>()(
	z.object({
		alertEmail: z.email().nullable(),
		emailAlertDeliveryPolicy: EmailAlertDeliveryPolicySchema,
		id: z.uuid(),
		lowStockThreshold: z.number(),
		name: z.string().min(1, "Pharmacy name is required"),
		nearExpiryDays: stringWithNumberValidation(z.number()),
		timezone: z.string(),
	})
);

const AuthDataSchema = z.object({
	user: UserDetailsSchema,
	workspace: WorkspaceDetailsSchema,
});

const AuthSuccessResponseSchema = withBaseSuccessResponse(AuthDataSchema);

const NullSuccessResponseSchema = withBaseSuccessResponse(z.null());

const authRoutes = () => {
	const TokenObjectSchema = z.object({
		expiresAt: stringWithDateValidation(),
		token: z.string(),
	});

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
	type WorkspaceInvitationRecordType = Pick<
		SelectWorkspaceInvitationType,
		"createdAt" | "expiresAt" | "id" | "inviteeEmail" | "inviteeName" | "role"
	>;

	const ManageableWorkspaceRoleSchema = WorkspaceRoleSchema.exclude(["owner"]);

	const InvitationRecordSchema = z.toZod<WorkspaceInvitationRecordType>()(
		z.object({
			createdAt: stringWithDateValidation(),
			expiresAt: stringWithDateValidation(),
			id: z.uuid(),
			inviteeEmail: z.email("Please enter a valid email"),
			inviteeName: z.string().min(1, "Name is required"),
			role: ManageableWorkspaceRoleSchema,
		})
	);

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

	const WorkspaceAlertSettingsSchema = z
		.object({
			alertEmail: z.email("Please enter a valid alert email").optional(),
			emailAlertDeliveryPolicy: EmailAlertDeliveryPolicySchema,
			emailAlertsEnabled: z.boolean(),
			lowStockThreshold: stringWithNumberValidation(z.number().int().min(0)),
			nearExpiryDays: stringWithNumberValidation(z.number().int().positive()),
		})
		.superRefine((data, ctx) => {
			if (data.emailAlertsEnabled && !data.alertEmail) {
				ctx.addIssue({
					code: "custom",
					message: "An alert email is required when email alerts are enabled",
					path: ["alertEmail"],
				});
			}
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

		"@patch/workspace/alert-settings": {
			body: WorkspaceAlertSettingsSchema,
			data: NullSuccessResponseSchema,
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

type DrugDetailsType = Pick<
	SelectDrugType,
	"form" | "genericName" | "id" | "isActive" | "name" | "strength" | "unit"
>;

const DrugDetailsSchema = z.toZod<DrugDetailsType>()(
	z.object({
		form: z.string().nullable(),
		genericName: z.string().min(1, "Generic name is required"),
		id: z.uuid(),
		isActive: z.boolean(),
		name: z.string().min(1, "Drug name is required"),
		strength: z.string().nullable(),
		unit: z.string().nullable(),
	})
);

const inventoryRoutes = () => {
	type InventorySummaryRowType = {
		drug: DrugDetailsType;
		drugId: SelectDrugType["id"];
		expiredBatchCount: number;
		nearestBatch?: Pick<SelectStockBatchType, "batchNumber" | "expiryDate" | "id" | "quantityAvailable">;
		nearestExpiryDate?: SelectStockBatchType["expiryDate"];
		nearExpiryBatchCount: number;
		stockStatus: typeof INVENTORY_STOCK_STATUS.$inferUnion;
		totalAvailable: number;
		usableBatchCount: number;
		usableExpiryDateCount: number;
	};

	const IsoDateSchema = z.iso.date();

	const optionalTrimmedStringSchema = z.preprocess(
		(value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
		z.string().trim().min(1).optional()
	);

	const nullableTrimmedStringSchema = z.preprocess(
		(value) => (typeof value === "string" && value.trim() === "" ? null : value),
		z.string().trim().min(1).nullable()
	);

	const DrugCreateSchema = z.object({
		form: optionalTrimmedStringSchema,
		genericName: DrugDetailsSchema.shape.genericName.trim(),
		name: DrugDetailsSchema.shape.name.trim(),
		strength: optionalTrimmedStringSchema,
		unit: optionalTrimmedStringSchema,
	});

	const DrugIdParamSchema = z.object({
		drugId: z.uuid("Invalid drug ID"),
	});

	const StockQuantitySchema = stringWithNumberValidation(
		z
			.number({ error: "Enter a quantity greater than zero." })
			.positive("Enter a quantity greater than zero.")
	);
	const StockAdditionBodySchema = z.object({
		batchNumber: z.string().optional(),
		drugId: z.uuid({ error: "Select a drug." }),
		expiryDate: IsoDateSchema,
		logType: StockAdditionLogTypeSchema,
		notes: z.string().optional(),
		quantity: StockQuantitySchema,
	});

	const StockOutBodySchema = z.object({
		drugId: z.uuid({ error: "Select a drug." }),
		logType: StockOutLogTypeSchema,
		notes: z.string().optional(),
		quantity: StockQuantitySchema,
	});
	const FEFOStockOutBodySchema = StockOutBodySchema.extend({
		batchId: z.never({ error: "Batch selection is automatic for dispensing." }).optional(),
		reason: z.enum([STOCK_OUT_REASONS[2], STOCK_OUT_REASONS[3]]),
	});
	const DisposalStockOutBodySchema = StockOutBodySchema.extend({
		batchId: z.uuid({ error: "Select a batch to remove stock from." }),
		reason: z.enum([STOCK_OUT_REASONS[0], STOCK_OUT_REASONS[1]]),
	});

	const InventoryBulkImportRowSchema = DrugCreateSchema.extend({
		expiryDate: IsoDateSchema,
		quantity: stringWithNumberValidation(z.number().positive().int()),
	});

	const InventoryBulkImportRowsSchema = InventoryBulkImportRowSchema.array()
		.min(1)
		.max(INVENTORY_BULK_IMPORT_MAX_ROWS)
		.superRefine((rows, ctx) => {
			const firstRowIndexByKey = new Map<string, number>();

			for (const [rowIndex, row] of rows.entries()) {
				const rowKey = createInventoryBulkImportRowKey(row);
				const firstRowIndex = firstRowIndexByKey.get(rowKey);

				if (firstRowIndex !== undefined) {
					ctx.addIssue({
						code: "custom",
						message: `Duplicate of row ${firstRowIndex + 1}`,
						path: [rowIndex],
					});

					continue;
				}

				firstRowIndexByKey.set(rowKey, rowIndex);
			}
		});

	const InventorySummaryRowSchema = z.toZod<InventorySummaryRowType>()(
		z.object({
			drug: DrugDetailsSchema,
			drugId: z.uuid(),
			expiredBatchCount: z.number(),
			nearestBatch: z
				.object({
					batchNumber: z.string().nullable(),
					expiryDate: IsoDateSchema,
					id: z.uuid(),
					quantityAvailable: z.number(),
				})
				.optional(),
			nearestExpiryDate: IsoDateSchema.optional(),
			nearExpiryBatchCount: z.number(),
			stockStatus: z.enum(INVENTORY_STOCK_STATUS),
			totalAvailable: z.number(),
			usableBatchCount: z.number(),
			usableExpiryDateCount: z.number(),
		})
	);

	const InventoryAlertItemSchema = z.object({
		acknowledgedAt: stringWithDateValidation().nullable(),
		action: z.enum(["remove", "restock", "review"]),
		batchId: z.uuid().nullable(),
		batchNumber: z.string().nullable(),
		drug: DrugDetailsSchema,
		expiryDate: IsoDateSchema.nullable(),
		id: z.uuid(),
		quantityAffected: z.number().nullable(),
		status: z.enum(INVENTORY_ALERT_STATUSES),
		threshold: z.number().nullable(),
		type: z.enum(INVENTORY_ALERT_TYPES),
	});

	const InventoryActivityFiltersSchema = z
		.object({
			drugId: z.uuid(),
			from: IsoDateSchema,
			logType: StockLogTypeSchema,
			search: z.string().trim().min(1),
			to: IsoDateSchema,
		})
		.partial()
		.superRefine((filters, ctx) => {
			if (!filters.from || !filters.to || filters.from <= filters.to) return;

			ctx.addIssue({
				code: "custom",
				message: "The end date must be on or after the start date",
				path: ["to"],
			});
		});

	const InventoryActivityQuerySchema = InventoryActivityFiltersSchema.safeExtend({
		page: stringWithNumberValidation(z.number().int().min(1)).optional(),
		pageSize: stringWithNumberValidation(z.number().int().min(1).max(100)).optional(),
	}).optional();

	const InventoryActivityRowSchema = z.object({
		batchCount: z.number(),
		createdAt: stringWithDateValidation(),
		drug: DrugDetailsSchema.pick({
			form: true,
			genericName: true,
			id: true,
			name: true,
			strength: true,
			unit: true,
		}),
		id: z.string(),
		logType: StockLogTypeSchema,
		notes: z.string().nullable(),
		person: z.string(),
		quantity: z.number(),
		reason: StockOutReasonSchema.nullable(),
		stockTransactionId: z.uuid(),
	});

	const InventoryBatchAvailabilitySchema = z.enum(["expired", "usable"]);
	const InventoryBatchSchema = z.object({
		batchNumber: z.string().nullable(),
		expiryDate: IsoDateSchema,
		id: z.uuid(),
		quantityAvailable: z.number(),
	});

	return defineSchemaRoutes({
		"@get/inventory/activity": {
			data: withBaseSuccessResponse(
				z.object({
					availableDateRange: z
						.object({
							from: IsoDateSchema,
							to: IsoDateSchema,
						})
						.nullable(),
					pagination: z.object({
						page: z.number(),
						pageCount: z.number(),
						pageSize: z.number(),
						total: z.number(),
					}),
					rows: z.array(InventoryActivityRowSchema),
					stats: z.object({
						expiredLossQuantity: z.number(),
						weeklyMovementCount: z.number(),
						weeklyStockInQuantity: z.number(),
						weeklyStockOutQuantity: z.number(),
					}),
				})
			),
			query: InventoryActivityQuerySchema,
		},

		"@get/inventory/activity/export": {
			query: InventoryActivityFiltersSchema.optional(),
		},

		"@get/inventory/alerts": {
			data: withBaseSuccessResponse(
				z.object({
					alerts: z.array(InventoryAlertItemSchema),
				})
			),
			query: z
				.object({
					status: z.enum(INVENTORY_ALERT_STATUSES),
				})
				.partial()
				.optional(),
		},

		"@get/inventory/alerts/status": {
			data: withBaseSuccessResponse(z.object({ hasActiveAlerts: z.boolean() })),
		},

		"@get/inventory/drugs": {
			data: withBaseSuccessResponse(
				z.object({
					drugs: z.array(DrugDetailsSchema),
					pagination: z
						.object({
							page: z.number(),
							pageCount: z.number(),
							pageSize: z.number(),
							total: z.number(),
						})
						.optional(),
				})
			),
			query: z
				.object({
					drugId: z.uuid(),
					page: stringWithNumberValidation(z.number().int().min(1)),
					pageSize: stringWithNumberValidation(z.number().int().min(1).max(100)),
					search: z.string().trim().min(1),
				})
				.partial()
				.optional(),
		},

		"@get/inventory/drugs/:drugId/batches": {
			data: withBaseSuccessResponse(z.object({ batches: z.array(InventoryBatchSchema) })),
			params: DrugIdParamSchema,
			query: z.object({ availability: InventoryBatchAvailabilitySchema }),
		},

		"@get/inventory/summary": {
			data: withBaseSuccessResponse(
				z.object({
					rows: z.array(InventorySummaryRowSchema),
					stats: z.object({
						criticalCount: z.number(),
						drugsInStockCount: z.number(),
					}),
				})
			),
			query: z.object({ search: z.string().trim().min(1).optional() }).optional(),
		},

		"@patch/inventory/drugs/:drugId": {
			body: DrugCreateSchema.partial().extend({
				form: nullableTrimmedStringSchema.optional(),
				strength: nullableTrimmedStringSchema.optional(),
				unit: nullableTrimmedStringSchema.optional(),
			}),
			data: withBaseSuccessResponse(
				z.object({
					drug: DrugDetailsSchema,
				})
			),
			params: DrugIdParamSchema,
		},

		"@post/inventory/alerts/acknowledge": {
			body: z.object({ alertId: z.uuid() }),
			data: NullSuccessResponseSchema,
		},

		"@post/inventory/bulk-import": {
			body: z.object({
				rows: InventoryBulkImportRowsSchema,
			}),
			data: withBaseSuccessResponse(z.object({ importedCount: z.number() })),
			headers: z.object({
				"x-idempotency-key": z.uuid(),
			}),
		},

		"@post/inventory/bulk-import/validate": {
			body: z.object({ rows: InventoryBulkImportRowsSchema }),
			data: withBaseSuccessResponse(
				z.object({
					issues: z.array(
						z.object({
							message: z.string(),
							rowIndex: z.number().int().nonnegative(),
						})
					),
				})
			),
		},

		"@post/inventory/drugs": {
			body: DrugCreateSchema,
			data: withBaseSuccessResponse(
				z.object({
					drug: DrugDetailsSchema,
				})
			),
		},

		"@post/inventory/drugs/:drugId/action": {
			body: z.object({
				action: z.enum(["deactivate", "reactivate"]),
			}),
			data: withBaseSuccessResponse(
				z.object({
					drug: DrugDetailsSchema,
				})
			),
			params: DrugIdParamSchema,
		},

		"@post/inventory/stock-log": {
			body: z.discriminatedUnion("logType", [
				StockAdditionBodySchema,
				z.discriminatedUnion("reason", [FEFOStockOutBodySchema, DisposalStockOutBodySchema], {
					error: "Select a reason for this stock movement.",
				}),
			]),
			data: NullSuccessResponseSchema,
			headers: z.object({
				"x-idempotency-key": z.uuid(),
			}),
		},
	});
};

const dashboardRoutes = () => {
	type RecentStockActivityType = Prettify<
		Pick<SelectStockLogType, "createdAt" | "id" | "logType" | "quantity" | "stockTransactionId"> & {
			batchCount: number;
			drug: Pick<SelectDrugType, "genericName" | "id" | "name" | "strength">;
			person: string;
		}
	>;

	const RecentStockActivitySchema = z.toZod<RecentStockActivityType>()(
		z.object({
			batchCount: z.number(),
			createdAt: stringWithDateValidation(),
			drug: DrugDetailsSchema.pick({
				genericName: true,
				id: true,
				name: true,
				strength: true,
			}),
			id: z.string(),
			logType: StockLogTypeSchema,
			person: z.string(),
			quantity: z.number(),
			stockTransactionId: z.uuid(),
		})
	);

	return defineSchemaRoutes({
		"@get/dashboard/overview": {
			data: withBaseSuccessResponse(
				z.object({
					recentActivity: z.array(RecentStockActivitySchema),
					stats: z.object({
						drugsInStockCount: z.number(),
						expiredCount: z.preprocess((value) => Number(value), z.number()),
						expiringSoonCount: z.preprocess((value) => Number(value), z.number()),
						lowStockCount: z.number(),
					}),
				})
			),
		},
	});
};

export const backendApiSchema = defineSchema(
	{
		...defineSchemaRoutes({
			[fallBackRouteSchemaKey]: {
				errorData: withBaseErrorResponse(),
			},
		}),
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
