import { ROLES } from "@vitastock/db/constants";
import type { InsertUserType, SelectUserType } from "@vitastock/db/schema/auth";
import {
	INVENTORY_ALERT_STATUSES,
	INVENTORY_ALERT_TYPES,
	INVENTORY_STOCK_STATUS,
	PAYMENT_METHODS,
	SALE_TYPES,
	STOCK_LOG_PATIENT_NAME_MAX_LENGTH,
	STOCK_LOG_TYPES,
	STOCK_OUT_REASONS,
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
import type { InferAllMainRouteKeys, InferAllMainRoutes } from "@zayne-labs/callapi";
import { defineFallbackRouteSchema, defineSchema, defineSchemaRoutes } from "@zayne-labs/callapi/utils";
import { isString, type Prettify } from "@zayne-labs/toolkit-type-helpers";
import { z } from "zod";
import {
	cleanNairaAmount,
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

const fallbackRouteSchema = () => {
	return defineFallbackRouteSchema({
		errorData: withBaseErrorResponse(),
	});
};

const PasswordSchema = z.string().min(8, "Password must be at least 8 characters long");

export const RequestEmailSchema = z
	.string()
	.trim()
	.toLowerCase()
	.pipe(z.email("Please enter a valid email"));

export const WorkspaceRoleSchema = z.enum(ROLES);

export const StockLogTypeSchema = z.enum(STOCK_LOG_TYPES);
export const StockOutReasonSchema = z.enum(STOCK_OUT_REASONS);
export const StockAdditionLogTypeSchema = z.enum(STOCK_ADDITION_LOG_TYPES);
export const StockOutLogTypeSchema = z.enum(STOCK_OUT_LOG_TYPES);
export const StockMovementLogTypeSchema = z.enum(STOCK_MOVEMENT_LOG_TYPES);
export const StockReductionLogTypeSchema = z.enum(STOCK_REDUCTION_LOG_TYPES);
export const SaleTypeSchema = z.enum(SALE_TYPES);
export const PaymentMethodSchema = z.enum(PAYMENT_METHODS);

export const PatientNameSchema = z
	.preprocess(
		(value) => (isString(value) ? value.trim().replaceAll(/\s+/g, " ") : value),
		z
			.string()
			.max(
				STOCK_LOG_PATIENT_NAME_MAX_LENGTH,
				`Patient name must be ${STOCK_LOG_PATIENT_NAME_MAX_LENGTH} characters or fewer.`
			)
			.transform((value) => (value === "" ? null : value))
	)
	.nullish();

type SignUpPayloadType = Prettify<
	Pick<InsertUserType, "email" | "fullName"> & {
		password: string;
		pharmacyName: InsertWorkspaceType["name"];
	}
>;

export const SignUpSchema = z.toZod<SignUpPayloadType>()(
	z.object({
		email: RequestEmailSchema,
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
	| "id"
	| "lowStockThreshold"
	| "name"
	| "nearExpiryDays"
	| "timezone"
	| "weeklyEmailEnabled"
	| "weeklyEmailTime"
>;

const WorkspaceDetailsSchema = z.toZod<WorkspaceDetailsType>()(
	z.object({
		id: z.uuid(),
		lowStockThreshold: z.number(),
		name: z.string().min(1, "Pharmacy name is required"),
		nearExpiryDays: stringWithNumberValidation(z.number()),
		timezone: z.string(),
		weeklyEmailEnabled: z.boolean(),
		weeklyEmailTime: z.string(),
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

	const WorkspaceAlertSettingsSchema = z.object({
		lowStockThreshold: stringWithNumberValidation(z.number().int().min(0)),
		nearExpiryDays: stringWithNumberValidation(z.number().int().positive()),
		weeklyEmailEnabled: z.boolean(),
		weeklyEmailTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/u, "Choose a valid time"),
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
			body: InvitationDataSchema.omit({ expiresAt: true }).extend({ inviteeEmail: RequestEmailSchema }),
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
	| "form"
	| "genericName"
	| "id"
	| "isActive"
	| "lowStockThreshold"
	| "name"
	| "retailPrice"
	| "strength"
	| "unit"
	| "wholesalePrice"
>;

const DrugDetailsSchema = z.toZod<DrugDetailsType>()(
	z.object({
		form: z.string().nullable(),
		genericName: z.string().min(1, "Generic name is required"),
		id: z.uuid(),
		isActive: z.boolean(),
		lowStockThreshold: z.number().int().min(0).nullable(),
		name: z.string().min(1, "Drug name is required"),
		retailPrice: z.number().nullable(),
		strength: z.string().nullable(),
		unit: z.string().nullable(),
		wholesalePrice: z.number().nullable(),
	})
);

const IsoDateSchema = z.iso.date();

const PriceSchema = z
	.number({ error: "Enter a price." })
	.positive("Enter a price above zero.")
	.max(9_999_999_999.99, "Enter a smaller price.")
	.refine((price) => Math.abs(price * 100 - Math.round(price * 100)) < 1e-6, {
		message: "Use at most 2 decimal places.",
	});

const optionalPriceSchema = z.preprocess(
	(value) => (value === "" || value === null || value === undefined ? undefined : Number(value)),
	PriceSchema.optional()
);

const importPriceSchema = z.preprocess((value) => {
	const cleanedValue = cleanNairaAmount(value);

	return cleanedValue === "" || cleanedValue === null || cleanedValue === undefined ?
			undefined
		:	Number(cleanedValue);
}, PriceSchema.optional());

const nullablePriceSchema = z.preprocess(
	(value) => (value === "" || value === null ? null : Number(value)),
	PriceSchema.nullable()
);

const inventoryRoutes = () => {
	type InventorySummaryRowType = {
		drug: DrugDetailsType;
		drugId: SelectDrugType["id"];
		effectiveLowStockThreshold: number;
		expiredBatchCount: number;
		nearestBatch?: Pick<SelectStockBatchType, "batchNumber" | "expiryDate" | "id" | "quantityAvailable">;
		nearestExpiryDate?: SelectStockBatchType["expiryDate"];
		nearExpiryBatchCount: number;
		stockStatus: typeof INVENTORY_STOCK_STATUS.$inferUnion;
		totalAvailable: number;
		usableBatchCount: number;
		usableExpiryDateCount: number;
	};

	const optionalTrimmedStringSchema = z.preprocess(
		(value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
		z.string().trim().min(1).optional()
	);

	const nullableTrimmedStringSchema = z.preprocess(
		(value) => (typeof value === "string" && value.trim() === "" ? null : value),
		z.string().trim().min(1).nullable()
	);
	const optionalLowStockThresholdSchema = z.preprocess(
		(value) => (value === "" || value === undefined ? undefined : Number(value)),
		z.number().int().min(0).optional()
	);
	const nullableLowStockThresholdSchema = z.preprocess(
		(value) => (value === "" || value === null ? null : Number(value)),
		z.number().int().min(0).nullable()
	);

	const DrugCreateSchema = z.object({
		form: optionalTrimmedStringSchema,
		genericName: DrugDetailsSchema.shape.genericName.trim(),
		lowStockThreshold: optionalLowStockThresholdSchema,
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
		costPrice: optionalPriceSchema,
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
		patientName: PatientNameSchema,
		reason: z.enum([STOCK_OUT_REASONS[2]]),
	});
	const DisposalStockOutBodySchema = StockOutBodySchema.extend({
		batchId: z.uuid({ error: "Select a batch to remove stock from." }),
		reason: z.enum([STOCK_OUT_REASONS[0], STOCK_OUT_REASONS[1]]),
	});

	const DispenseCartItemsSchema = FEFOStockOutBodySchema.pick({
		drugId: true,
		patientName: true,
		quantity: true,
		reason: true,
	})
		.array()
		.min(1, "Add at least one medication to dispense.")
		.max(100)
		.superRefine((items, ctx) => {
			const firstItemIndexByKey = new Map<string, number>();

			for (const [itemIndex, item] of items.entries()) {
				const itemKey = `${item.drugId}:${item.patientName ?? ""}`;
				const firstItemIndex = firstItemIndexByKey.get(itemKey);

				if (firstItemIndex !== undefined) {
					ctx.addIssue({
						code: "custom",
						message: `Duplicate of item ${firstItemIndex + 1}`,
						path: [itemIndex],
					});

					continue;
				}

				firstItemIndexByKey.set(itemKey, itemIndex);
			}
		});

	const InventoryBulkImportRowSchema = DrugCreateSchema.extend({
		costPrice: importPriceSchema,
		expiryDate: IsoDateSchema,
		quantity: stringWithNumberValidation(z.number().positive().int()),
		retailPrice: importPriceSchema,
		wholesalePrice: importPriceSchema,
	});

	const BulkImportRowMessageSchema = z.object({
		message: z.string(),
		rowIndex: z.number().int().nonnegative(),
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
			effectiveLowStockThreshold: z.number().int().min(0),
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
		patientName: z.string().nullable(),
		performedByUserId: z.uuid(),
		person: z.string(),
		quantity: z.number(),
		reason: StockOutReasonSchema.nullable(),
		stockTransactionId: z.uuid(),
		undoneAt: stringWithDateValidation().nullable(),
		undoneBy: z.string().nullable(),
	});

	const InventoryBatchAvailabilitySchema = z.enum(["all", "expired", "usable"]);
	const InventoryBatchSchema = z.object({
		batchNumber: z.string().nullable(),
		costPrice: z.number().nullable(),
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

		"@get/inventory/bulk-imports": {
			data: withBaseSuccessResponse(
				z.object({
					imports: z.array(
						z.object({
							createdAt: stringWithDateValidation(),
							drugCount: z.number(),
							id: z.uuid(),
							importedBy: z.string(),
							removal: z
								.object({ removedAt: stringWithDateValidation(), removedBy: z.string() })
								.nullable(),
							removalBlockedReason: z.string().nullable(),
							unitCount: z.number(),
						})
					),
				})
			),
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

		"@get/inventory/price-list": {
			data: withBaseSuccessResponse(
				z.object({
					pagination: z.object({
						page: z.number(),
						pageCount: z.number(),
						pageSize: z.number(),
						total: z.number(),
					}),
					rows: z.array(
						z.object({
							costRange: z.object({ highest: z.number(), lowest: z.number() }).nullable(),
							drug: DrugDetailsSchema,
							uncostedBatchCount: z.number(),
						})
					),
				})
			),
			query: z
				.object({
					page: stringWithNumberValidation(z.number().int().min(1)),
					pageSize: stringWithNumberValidation(z.number().int().min(1).max(100)),
					pricesMissing: z.stringbool(),
					search: z.string().trim().min(1),
				})
				.partial()
				.optional(),
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

		"@patch/inventory/batches/:batchId": {
			body: z
				.object({ costPrice: nullablePriceSchema, expiryDate: IsoDateSchema })
				.partial()
				.refine((body) => body.costPrice !== undefined || body.expiryDate !== undefined, {
					message: "Provide a cost price or an expiry date to update.",
				}),
			data: withBaseSuccessResponse(z.object({ batch: InventoryBatchSchema })),
			params: z.object({ batchId: z.uuid("Invalid batch ID") }),
		},

		"@patch/inventory/drugs/:drugId": {
			body: DrugCreateSchema.partial().extend({
				form: nullableTrimmedStringSchema.optional(),
				lowStockThreshold: nullableLowStockThresholdSchema.optional(),
				retailPrice: nullablePriceSchema.optional(),
				strength: nullableTrimmedStringSchema.optional(),
				unit: nullableTrimmedStringSchema.optional(),
				wholesalePrice: nullablePriceSchema.optional(),
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
			data: withBaseSuccessResponse(
				z.object({
					importedCount: z.number(),
					priceChanges: z.array(
						z.object({
							drugName: z.string(),
							field: z.enum(["retailPrice", "wholesalePrice"]),
							newPrice: z.number(),
							previousPrice: z.number().nullable(),
						})
					),
				})
			),
			headers: z.object({
				"x-idempotency-key": z.uuid(),
			}),
		},

		"@post/inventory/bulk-import/validate": {
			body: z.object({ rows: InventoryBulkImportRowsSchema }),
			data: withBaseSuccessResponse(
				z.object({
					issues: z.array(BulkImportRowMessageSchema),
					warnings: z.array(BulkImportRowMessageSchema),
				})
			),
		},

		"@post/inventory/bulk-imports/:stockTransactionId/remove": {
			data: NullSuccessResponseSchema,
			params: z.object({ stockTransactionId: z.uuid("Invalid import ID") }),
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

		"@post/inventory/stock-log/dispense": {
			body: z.object({
				items: DispenseCartItemsSchema,
				notes: z.string().trim().max(500, "Keep the note under 500 characters.").optional(),
				paymentMethod: PaymentMethodSchema.optional(),
				saleType: SaleTypeSchema.default(SALE_TYPES[0]),
			}),
			data: withBaseSuccessResponse(
				z.object({
					stockTransactionId: z.uuid(),
					undoExpiresAt: stringWithDateValidation(),
				})
			),
			headers: z.object({
				"x-idempotency-key": z.uuid(),
			}),
		},

		"@post/inventory/stock-transactions/:stockTransactionId/undo": {
			data: NullSuccessResponseSchema,
			params: z.object({ stockTransactionId: z.uuid("Invalid stock transaction ID") }),
		},
	});
};

const dashboardRoutes = () => {
	type RecentStockActivityType = Prettify<
		Pick<
			SelectStockLogType,
			| "createdAt"
			| "id"
			| "logType"
			| "patientName"
			| "performedByUserId"
			| "quantity"
			| "reason"
			| "stockTransactionId"
			| "undoneAt"
		> & {
			batchCount: number;
			drug: Pick<SelectDrugType, "genericName" | "id" | "name" | "strength">;
			person: string;
			undoneBy: string | null;
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
			patientName: z.string().nullable(),
			performedByUserId: z.uuid(),
			person: z.string(),
			quantity: z.number(),
			reason: StockOutReasonSchema.nullable(),
			stockTransactionId: z.uuid(),
			undoneAt: stringWithDateValidation().nullable(),
			undoneBy: z.string().nullable(),
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

const dashboardAnalyticsRoutes = () => {
	const AnalyticsDrugSchema = DrugDetailsSchema.pick({
		genericName: true,
		id: true,
		name: true,
		strength: true,
		unit: true,
	});

	const AnalyticsTotalsSchema = z.object({
		costOfSales: z.number(),
		profit: z.number(),
		profitPercent: z.number().nullable(),
		saleCount: z.number(),
		sales: z.number(),
		uncostedSaleLineCount: z.number(),
		unpricedSaleLineCount: z.number(),
	});

	const AnalyticsSellerSchema = z.object({
		drug: AnalyticsDrugSchema,
		quantity: z.number(),
		sales: z.number().nullable(),
	});

	return defineSchemaRoutes({
		"@get/dashboard/analytics": {
			data: withBaseSuccessResponse(
				z.object({
					daily: z.array(z.object({ date: IsoDateSchema, profit: z.number(), sales: z.number() })),
					expiryRisk: z.object({
						expiredDrugCount: z.number(),
						expiredValue: z.number().nullable(),
						expiringDrugCount: z.number(),
						expiringValue: z.number().nullable(),
						items: z.array(
							z.object({
								drug: AnalyticsDrugSchema,
								expiryDate: IsoDateSchema,
								isExpired: z.boolean(),
								quantity: z.number(),
								value: z.number().nullable(),
							})
						),
					}),
					losses: z.array(
						z.object({
							createdAt: stringWithDateValidation(),
							drug: AnalyticsDrugSchema,
							id: z.uuid(),
							person: z.string(),
							// == Null when the person has since left the workspace
							personRole: WorkspaceRoleSchema.nullable(),
							quantity: z.number(),
							reason: StockOutReasonSchema,
							value: z.number().nullable(),
						})
					),
					moneyInStock: z.object({
						topDrugs: z.array(
							z.object({ drug: AnalyticsDrugSchema, quantity: z.number(), value: z.number() })
						),
						total: z.number(),
						uncostedBatchCount: z.number(),
					}),
					period: z.object({ from: IsoDateSchema, to: IsoDateSchema }),
					previousPeriod: z.object({ from: IsoDateSchema, to: IsoDateSchema }),
					pricesMissingDrugCount: z.number(),
					salesByPaymentMethod: z.array(
						z.object({ paymentMethod: PaymentMethodSchema.nullable(), sales: z.number() })
					),
					salesBySaleType: z.array(z.object({ sales: z.number(), saleType: SaleTypeSchema })),
					slowSellers: z.array(
						z.object({
							drug: AnalyticsDrugSchema,
							onHandQuantity: z.number(),
							soldLast30Days: z.number(),
							stockValue: z.number().nullable(),
						})
					),
					staffActivity: z.array(
						z.object({
							dispenseCount: z.number(),
							person: z.string(),
							personRole: WorkspaceRoleSchema,
							removalCount: z.number(),
							sales: z.number().nullable(),
							undoCount: z.number(),
							userId: z.uuid(),
						})
					),
					topSellers: z.object({
						byQuantity: z.array(AnalyticsSellerSchema),
						bySales: z.array(AnalyticsSellerSchema),
					}),
					totals: z.object({ current: AnalyticsTotalsSchema, previous: AnalyticsTotalsSchema }),
				})
			),
			query: z
				.object({ from: IsoDateSchema, to: IsoDateSchema })
				.refine((query) => query.from <= query.to, {
					message: "The end date must be on or after the start date",
					path: ["to"],
				}),
		},
	});
};

export const backendApiSchema = defineSchema(
	{
		...fallbackRouteSchema(),
		...authRoutes(),
		...workspaceRoutes(),
		...inventoryRoutes(),
		...dashboardRoutes(),
		...dashboardAnalyticsRoutes(),
	},
	{ strict: true }
);

export const backendApiSchemaRoutes = backendApiSchema.routes;

export type BackendApiRoutes = InferAllMainRoutes<typeof backendApiSchema.routes>;

export type BackendApiRouteKeys = InferAllMainRouteKeys<
	typeof backendApiSchema.routes,
	typeof backendApiSchema.config
>;
