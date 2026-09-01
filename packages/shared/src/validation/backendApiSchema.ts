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
import { AUTH_ERROR_APP_CODES } from "@vitastock/shared/constants";
import type { InferAllMainRouteKeys, InferAllMainRoutes } from "@zayne-labs/callapi";
import { fallBackRouteSchemaKey } from "@zayne-labs/callapi/constants";
import { defineSchema, defineSchemaRoutes } from "@zayne-labs/callapi/utils";
import type { Prettify } from "@zayne-labs/toolkit-type-helpers";
import { z } from "zod";

export const INVENTORY_BULK_IMPORT_MAX_ROWS = 2000;

export const INVENTORY_BULK_IMPORT_COLUMNS = {
	"Dosage Form": "form",
	"Drug Name": "name",
	"Expiry Date": "expiryDate",
	"Generic Name": "genericName",
	Quantity: "quantity",
	Strength: "strength",
	Unit: "unit",
	"Unit Cost (₦)": "unitCostNaira",
} as const;

export const INVENTORY_BULK_IMPORT_REQUIRED_HEADERS = [
	"Drug Name",
	"Expiry Date",
	"Generic Name",
	"Quantity",
] as const;

export const InventoryBulkImportHeadersSchema = z.array(z.string()).superRefine((headers, ctx) => {
	const seenHeaders = new Set<string>();
	const duplicateHeaders = new Set<string>();

	for (const header of headers) {
		if (!header) continue;

		if (seenHeaders.has(header)) {
			duplicateHeaders.add(header);
		}

		seenHeaders.add(header);
	}

	if (duplicateHeaders.size > 0) {
		ctx.addIssue({
			code: "custom",
			message: `Duplicate columns: ${[...duplicateHeaders].join(", ")}`,
		});
	}

	const unknownHeaders = headers.filter(
		(header) => header.length > 0 && !(header in INVENTORY_BULK_IMPORT_COLUMNS)
	);

	if (unknownHeaders.length > 0) {
		ctx.addIssue({
			code: "custom",
			message: `Unknown columns: ${unknownHeaders.join(", ")}`,
		});
	}

	const missingHeaders = INVENTORY_BULK_IMPORT_REQUIRED_HEADERS.filter(
		(header) => !seenHeaders.has(header)
	);

	if (missingHeaders.length > 0) {
		ctx.addIssue({
			code: "custom",
			message: `Missing required columns: ${missingHeaders.join(", ")}`,
		});
	}
});

type InventoryBulkImportRowIdentity = {
	expiryDate: string;
	form?: string;
	genericName: string;
	name: string;
	quantity: number;
	strength?: string;
	unit?: string;
	unitCostNaira?: number;
};

export const createInventoryBulkImportRowKey = (row: InventoryBulkImportRowIdentity) => {
	const drugIdentity = [row.name, row.genericName, row.strength, row.form, row.unit]
		.map((value) => value?.trim().toLowerCase() ?? "")
		.join("|");

	const unitCostKobo = row.unitCostNaira === undefined ? "" : Math.round(row.unitCostNaira * 100);

	return `${drugIdentity}|${row.expiryDate}|${row.quantity}|${unitCostKobo}`;
};

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

export const WorkspaceRoleSchema = z.enum(["owner", "admin", "pharmacist"]);

export const StockLogTypeSchema = z.enum(STOCK_LOG_TYPES);
export const StockOutReasonSchema = z.enum(STOCK_OUT_REASONS);
export const StockAdditionLogTypeSchema = z.enum([STOCK_LOG_TYPES[2], STOCK_LOG_TYPES[4]]);
export const StockOutLogTypeSchema = z.enum([STOCK_LOG_TYPES[5]]);
export const StockMovementLogTypeSchema = z.enum([STOCK_LOG_TYPES[4], STOCK_LOG_TYPES[5]]);
export const StockReductionLogTypeSchema = z.enum([
	STOCK_LOG_TYPES[0],
	STOCK_LOG_TYPES[1],
	STOCK_LOG_TYPES[5],
]);

type SignUpPayloadType = Prettify<
	Pick<InsertUserType, "email" | "fullName"> & {
		password: string;
		pharmacyName: InsertWorkspaceType["name"];
	}
>;
type UserDetailsType = Prettify<
	Pick<SelectUserType, "email" | "emailVerifiedAt" | "fullName" | "id" | "mustChangePassword"> & {
		role: SelectWorkspaceMembershipType["role"];
		workspaceId: SelectWorkspaceMembershipType["workspaceId"];
	}
>;
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
type WorkspaceInvitationRecordType = Pick<
	SelectWorkspaceInvitationType,
	"createdAt" | "expiresAt" | "id" | "inviteeEmail" | "inviteeName" | "role"
>;

type DrugDetailsType = Pick<
	SelectDrugType,
	"form" | "genericName" | "id" | "isActive" | "name" | "strength" | "unit"
>;

type RecentStockActivityType = Prettify<
	Pick<SelectStockLogType, "createdAt" | "id" | "logType" | "quantity" | "stockTransactionId"> & {
		batchCount: number;
		drug: Pick<SelectDrugType, "genericName" | "id" | "name" | "strength">;
		person: string;
	}
>;

type InventorySummaryRowType = {
	drug: DrugDetailsType;
	drugId: SelectDrugType["id"];
	expiredBatchCount: number;
	nearestBatch?: Pick<
		SelectStockBatchType,
		"batchNumber" | "expiryDate" | "id" | "quantityAvailable" | "unitCostKobo"
	>;
	nearestExpiryDate?: SelectStockBatchType["expiryDate"];
	nearExpiryBatchCount: number;
	stockStatus: typeof INVENTORY_STOCK_STATUS.$inferUnion;
	stockValueKobo: number;
	totalAvailable: number;
	uncostedBatchCount: number;
	usableBatchCount: number;
	usableExpiryDateCount: number;
};

const IsoDateSchema = z.iso.date();

const stringWithDateValidation = () => {
	return z.preprocess((value: string) => new Date(value), z.date());
};

const stringWithNumberValidation = <TNumberSchema extends z.ZodNumber>(numberSchema: TNumberSchema) => {
	return z.preprocess(
		(value: number | string) => (value === "" ? undefined : Number(value)),
		numberSchema
	);
};

const optionalTrimmedStringSchema = z.preprocess(
	(value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
	z.string().trim().min(1).optional()
);

const nullableTrimmedStringSchema = z.preprocess(
	(value) => (typeof value === "string" && value.trim() === "" ? null : value),
	z.string().trim().min(1).nullable()
);

const optionalStringWithNumberValidation = <TNumberSchema extends z.ZodNumber>(
	numberSchema: TNumberSchema
) => {
	return z.preprocess(
		(value) => (value === "" || value === null || value === undefined ? undefined : Number(value)),
		numberSchema.optional()
	);
};

const TokenObjectSchema = z.object({
	expiresAt: stringWithDateValidation(),
	token: z.string(),
});

export const SignUpSchema = z.toZod<SignUpPayloadType>()(
	z.object({
		email: z.email("Please enter a valid email"),
		fullName: z.string().min(1, "Name is required"),
		password: PasswordSchema,
		pharmacyName: z.string().min(1, "Pharmacy name is required"),
	})
);

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

const WorkspaceDetailsSchema = z.toZod<WorkspaceDetailsType>()(
	z.object({
		alertEmail: z.email().nullable(),
		emailAlertDeliveryPolicy: z.enum(EMAIL_ALERT_DELIVERY_POLICIES),
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
			emailAlertDeliveryPolicy: z.enum(EMAIL_ALERT_DELIVERY_POLICIES),
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

	const StockQuantitySchema = stringWithNumberValidation(z.number().positive());
	const StockAdditionBodySchema = z.object({
		batchNumber: z.string().optional(),
		drugId: z.uuid(),
		expiryDate: IsoDateSchema,
		logType: StockAdditionLogTypeSchema,
		notes: z.string().optional(),
		quantity: StockQuantitySchema,
		unitCostNaira: optionalStringWithNumberValidation(z.number().min(0).multipleOf(0.01)),
	});

	const StockOutBodySchema = z.object({
		drugId: z.uuid(),
		logType: StockOutLogTypeSchema,
		notes: z.string().optional(),
		quantity: StockQuantitySchema,
	});
	const FEFOStockOutBodySchema = StockOutBodySchema.extend({
		batchId: z.never().optional(),
		reason: z.enum([STOCK_OUT_REASONS[2], STOCK_OUT_REASONS[3]]),
	});
	const DisposalStockOutBodySchema = StockOutBodySchema.extend({
		batchId: z.uuid(),
		reason: z.enum([STOCK_OUT_REASONS[0], STOCK_OUT_REASONS[1]]),
	});

	const InventoryBulkImportRowSchema = DrugCreateSchema.extend({
		expiryDate: IsoDateSchema,
		quantity: stringWithNumberValidation(z.number().positive().int()),
		unitCostNaira: optionalStringWithNumberValidation(z.number().min(0).multipleOf(0.01)),
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
					unitCostKobo: z.number().nullable(),
				})
				.optional(),
			nearestExpiryDate: IsoDateSchema.optional(),
			nearExpiryBatchCount: z.number(),
			stockStatus: z.enum(INVENTORY_STOCK_STATUS),
			stockValueKobo: z.number(),
			totalAvailable: z.number(),
			uncostedBatchCount: z.number(),
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

	const InventoryActivityQuerySchema = z
		.object({
			logType: StockLogTypeSchema,
			page: stringWithNumberValidation(z.number().int().min(1)),
			pageSize: stringWithNumberValidation(z.number().int().min(1).max(100)),
			search: z.string().trim().min(1),
		})
		.partial()
		.optional();

	const InventoryActivityRowSchema = z.object({
		batchCount: z.number(),
		createdAt: stringWithDateValidation(),
		drug: DrugDetailsSchema.pick({
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
					pagination: z.object({
						page: z.number(),
						pageCount: z.number(),
						pageSize: z.number(),
						total: z.number(),
					}),
					rows: z.array(InventoryActivityRowSchema),
					stats: z.object({
						expiredLossQuantity: z.number(),
						expiredLossValueKobo: z.number(),
						weeklyMovementCount: z.number(),
						weeklyStockInQuantity: z.number(),
						weeklyStockOutQuantity: z.number(),
					}),
				})
			),
			query: InventoryActivityQuerySchema,
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

		"@get/inventory/alerts/unread-count": {
			data: withBaseSuccessResponse(z.object({ count: z.number() })),
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
						stockValueKobo: z.number(),
						uncostedBatchCount: z.number(),
					}),
				})
			),
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
			body: z.union([StockAdditionBodySchema, FEFOStockOutBodySchema, DisposalStockOutBodySchema]),
			data: NullSuccessResponseSchema,
			headers: z.object({
				"x-idempotency-key": z.uuid(),
			}),
		},
	});
};

const dashboardRoutes = () => {
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
						expiredCount: z.preprocess((value) => Number(value), z.number()),
						expiringSoonCount: z.preprocess((value) => Number(value), z.number()),
						lowStockCount: z.number(),
						stockValueKobo: z.number(),
						uncostedBatchCount: z.number(),
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
