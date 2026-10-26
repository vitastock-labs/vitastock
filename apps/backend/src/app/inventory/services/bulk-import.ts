import { db } from "@vitastock/db";
import { users } from "@vitastock/db/schema/auth";
import { drugs, stockBatches, stockLogs, stockTransactions } from "@vitastock/db/schema/inventory";
import type { backendApiSchemaRoutes } from "@vitastock/shared/validation/backendApiSchema";
import {
	and,
	asc,
	countDistinct,
	desc,
	eq,
	gt,
	inArray,
	isNull,
	ne,
	notInArray,
	sql,
	sum,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { z } from "zod";
import { appLogger } from "@/lib/logger";
import { AppError } from "@/lib/utils";
import { receiveStockBatch } from "./data-access/stock-batches";
import {
	claimStockTransaction,
	createStockTransactionRequestHash,
} from "./data-access/stock-transactions";
import { getWorkspaceToday } from "./utils/date";

type BulkImportTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

type BulkImportRow = z.infer<
	(typeof backendApiSchemaRoutes)["@post/inventory/bulk-import"]["body"]
>["rows"][number];

const normalizeDrugValue = (value: string | null | undefined) => value?.trim().toLowerCase() ?? "";

const createExactDrugIdentity = (identity: {
	form?: string | null;
	genericName: string;
	name: string;
	strength?: string | null;
	unit?: string | null;
}) => {
	return [identity.name, identity.genericName, identity.strength, identity.form, identity.unit]
		.map((value) => normalizeDrugValue(value))
		.join("|");
};

type DrugResolutionCandidate = Pick<
	typeof drugs.$inferSelect,
	"form" | "genericName" | "id" | "isActive" | "lowStockThreshold" | "name" | "strength" | "unit"
>;

const getDrugResolutionCandidates = (row: BulkImportRow, existingDrugs: DrugResolutionCandidate[]) => {
	return existingDrugs.filter((drug) => {
		if (
			normalizeDrugValue(drug.name) !== normalizeDrugValue(row.name)
			|| normalizeDrugValue(drug.genericName) !== normalizeDrugValue(row.genericName)
		) {
			return false;
		}

		return (["strength", "form", "unit"] as const).every((field) => {
			return (
				row[field] === undefined || normalizeDrugValue(drug[field]) === normalizeDrugValue(row[field])
			);
		});
	});
};

const resolveDrug = (row: BulkImportRow, candidates: DrugResolutionCandidate[]) => {
	const matches = getDrugResolutionCandidates(row, candidates);

	if (matches.length > 1) {
		return { status: "ambiguous" as const };
	}

	const [drug] = matches;

	if (!drug) {
		return { status: "missing" as const };
	}

	if (!drug.isActive) {
		return { drug, status: "inactive" as const };
	}

	return { drug, status: "resolved" as const };
};

const DRUG_LEVEL_IMPORT_FIELDS = ["lowStockThreshold", "retailPrice", "wholesalePrice"] as const;

const DRUG_LEVEL_FIELD_LABELS = {
	lowStockThreshold: "low stock threshold",
	retailPrice: "retail price",
	wholesalePrice: "wholesale price",
} satisfies Record<(typeof DRUG_LEVEL_IMPORT_FIELDS)[number], string>;

const collectDrugLevelValues = (options: {
	drugIdByRowIndex: Map<number, string>;
	field: (typeof DRUG_LEVEL_IMPORT_FIELDS)[number];
	rows: BulkImportRow[];
}) => {
	const { drugIdByRowIndex, field, rows } = options;
	const valueByDrugId = new Map<string, number>();
	const conflictingRowIndexes: number[] = [];

	for (const [rowIndex, row] of rows.entries()) {
		const value = row[field];
		const drugId = drugIdByRowIndex.get(rowIndex);

		if (value === undefined || !drugId) continue;

		const previousValue = valueByDrugId.get(drugId);

		if (previousValue !== undefined && previousValue !== value) {
			conflictingRowIndexes.push(rowIndex);
			continue;
		}

		valueByDrugId.set(drugId, value);
	}

	return { conflictingRowIndexes, valueByDrugId };
};

const getBelowCostWarnings = (row: BulkImportRow, rowIndex: number) => {
	const { costPrice } = row;

	if (costPrice === undefined) {
		return [];
	}

	return (["retailPrice", "wholesalePrice"] as const)
		.filter((field) => {
			const sellingPrice = row[field];

			return sellingPrice !== undefined && sellingPrice < costPrice;
		})
		.map((field) => ({
			message: `${row.name}: the ${DRUG_LEVEL_FIELD_LABELS[field]} is below the cost price`,
			rowIndex,
		}));
};

export const validateInventoryBulkImportRows = async (options: {
	rows: BulkImportRow[];
	workspaceId: string;
}) => {
	const { rows, workspaceId } = options;
	const existingDrugs = await db.select().from(drugs).where(eq(drugs.workspaceId, workspaceId));
	const proposedDrugs = new Map<string, DrugResolutionCandidate>();

	for (const row of rows) {
		if (resolveDrug(row, existingDrugs).status !== "missing") {
			continue;
		}

		const identity = createExactDrugIdentity(row);

		proposedDrugs.set(identity, {
			form: row.form ?? null,
			genericName: row.genericName,
			id: identity,
			isActive: true,
			lowStockThreshold: row.lowStockThreshold ?? null,
			name: row.name,
			strength: row.strength ?? null,
			unit: row.unit ?? null,
		});
	}

	const resolutionPool = [...existingDrugs, ...proposedDrugs.values()];

	const issues: Array<{ message: string; rowIndex: number }> = [];
	const warnings: Array<{ message: string; rowIndex: number }> = [];
	const resolvedDrugIdByRowIndex = new Map<number, string>();

	for (const [rowIndex, row] of rows.entries()) {
		const resolution = resolveDrug(row, resolutionPool);

		if (resolution.status === "ambiguous") {
			issues.push({
				message: "Multiple Drug Master records match this row. Supply more drug details.",
				rowIndex,
			});
			continue;
		}

		if (resolution.status === "inactive") {
			issues.push({
				message: `${resolution.drug.name} must be reactivated before stock can be imported`,
				rowIndex,
			});
			continue;
		}

		if (resolution.status === "resolved") {
			resolvedDrugIdByRowIndex.set(rowIndex, resolution.drug.id);
		}

		warnings.push(...getBelowCostWarnings(row, rowIndex));
	}

	for (const field of DRUG_LEVEL_IMPORT_FIELDS) {
		const { conflictingRowIndexes } = collectDrugLevelValues({
			drugIdByRowIndex: resolvedDrugIdByRowIndex,
			field,
			rows,
		});

		for (const rowIndex of conflictingRowIndexes) {
			issues.push({
				message: `${rows[rowIndex]?.name ?? "This drug"} has conflicting ${DRUG_LEVEL_FIELD_LABELS[field]} values in this file`,
				rowIndex,
			});
		}
	}

	return { issues, warnings };
};

const resolveDrugIdsByRowIndex = async (options: {
	rows: BulkImportRow[];
	tx: BulkImportTransaction;
	workspaceId: string;
}) => {
	const { rows, tx, workspaceId } = options;
	const existingDrugs = await tx.select().from(drugs).where(eq(drugs.workspaceId, workspaceId));
	const missingIdentities = new Map<string, BulkImportRow>();

	for (const row of rows) {
		const resolution = resolveDrug(row, existingDrugs);

		if (resolution.status === "ambiguous") {
			throw new AppError({
				code: 409,
				message: `${row.name} matches multiple Drug Master records. Supply more drug details.`,
			});
		}

		if (resolution.status === "missing") {
			missingIdentities.set(createExactDrugIdentity(row), row);
		}
	}

	if (missingIdentities.size > 0) {
		await tx
			.insert(drugs)
			.values(
				missingIdentities
					.values()
					.map((row) => ({
						form: row.form ?? null,
						genericName: row.genericName,
						lowStockThreshold: row.lowStockThreshold ?? null,
						name: row.name,
						strength: row.strength ?? null,
						unit: row.unit ?? null,
						workspaceId,
					}))
					.toArray()
			)
			.onConflictDoNothing();
	}

	const resolvedDrugs = await tx.select().from(drugs).where(eq(drugs.workspaceId, workspaceId));

	return new Map(
		rows.map((row, rowIndex) => {
			const resolution = resolveDrug(row, resolvedDrugs);

			if (resolution.status !== "resolved") {
				throw new AppError({
					code: 409,
					message: `${row.name} could not be resolved to one Drug Master record`,
				});
			}

			return [rowIndex, resolution.drug.id] as const;
		})
	);
};

type ImportedSellingPriceField = "retailPrice" | "wholesalePrice";

const applyImportedSellingPrices = async (options: {
	importedDrugs: Array<Record<ImportedSellingPriceField, number | null> & { id: string; name: string }>;
	retailPriceByDrugId: Map<string, number>;
	tx: BulkImportTransaction;
	userId: string;
	wholesalePriceByDrugId: Map<string, number>;
	workspaceId: string;
}) => {
	const { importedDrugs, retailPriceByDrugId, tx, userId, wholesalePriceByDrugId, workspaceId } = options;
	const priceChanges: Array<{
		drugName: string;
		field: ImportedSellingPriceField;
		newPrice: number;
		previousPrice: number | null;
	}> = [];

	for (const drug of importedDrugs) {
		const filePrices = {
			retailPrice: retailPriceByDrugId.get(drug.id),
			wholesalePrice: wholesalePriceByDrugId.get(drug.id),
		};
		const changedFields = (["retailPrice", "wholesalePrice"] as const).filter((field) => {
			const filePrice = filePrices[field];

			return filePrice !== undefined && filePrice !== drug[field];
		});

		if (changedFields.length === 0) continue;

		priceChanges.push(
			...changedFields.flatMap((field) => {
				const previousPrice = drug[field];
				const newPrice = filePrices[field];

				return previousPrice !== null && newPrice !== undefined ?
						[{ drugName: drug.name, field, newPrice, previousPrice }]
					:	[];
			})
		);

		// eslint-disable-next-line no-await-in-loop -- queries on one transaction share a single connection and run sequentially
		await tx
			.update(drugs)
			.set({
				...(changedFields.includes("retailPrice") && { retailPrice: filePrices.retailPrice }),
				...(changedFields.includes("wholesalePrice") && { wholesalePrice: filePrices.wholesalePrice }),
				priceUpdatedAt: new Date(),
				priceUpdatedByUserId: userId,
			})
			.where(and(eq(drugs.id, drug.id), eq(drugs.workspaceId, workspaceId)));
	}

	return priceChanges;
};

export const createInventoryBulkImport = async (options: {
	idempotencyKey: string;
	rows: BulkImportRow[];
	timezone: string;
	userId: string;
	workspaceId: string;
}) => {
	const { idempotencyKey, rows, timezone, userId, workspaceId } = options;
	const startedAt = Date.now();
	const requestHash = createStockTransactionRequestHash(rows);
	const today = getWorkspaceToday(timezone);
	const rowWithPastExpiry = rows.find((row) => row.expiryDate < today);

	if (rowWithPastExpiry) {
		throw new AppError({
			code: 400,
			message: `${rowWithPastExpiry.name} has an expiry date before today`,
		});
	}

	const { importedCount, priceChanges } = await db.transaction(async (tx) => {
		const stockTransaction = await claimStockTransaction({
			idempotencyKey,
			operation: "bulk_import",
			requestHash,
			tx,
			userId,
			workspaceId,
		});

		if (stockTransaction.isReplay) {
			return { importedCount: rows.length, priceChanges: [] };
		}

		const drugIdByRowIndex = await resolveDrugIdsByRowIndex({ rows, tx, workspaceId });
		const drugIds = [...new Set(drugIdByRowIndex.values())].toSorted();
		const importedDrugs = await tx
			.select({
				id: drugs.id,
				isActive: drugs.isActive,
				name: drugs.name,
				retailPrice: drugs.retailPrice,
				wholesalePrice: drugs.wholesalePrice,
			})
			.from(drugs)
			.where(and(eq(drugs.workspaceId, workspaceId), inArray(drugs.id, drugIds)))
			.orderBy(asc(drugs.id))
			.for("update");
		const inactiveDrug = importedDrugs.find((drug) => !drug.isActive);

		if (inactiveDrug) {
			throw new AppError({
				code: 409,
				message: `${inactiveDrug.name} must be reactivated before stock can be imported`,
			});
		}

		const drugLevelValues = Object.fromEntries(
			DRUG_LEVEL_IMPORT_FIELDS.map((field) => {
				const { conflictingRowIndexes, valueByDrugId } = collectDrugLevelValues({
					drugIdByRowIndex,
					field,
					rows,
				});
				const [conflictingRowIndex] = conflictingRowIndexes;

				if (conflictingRowIndex !== undefined) {
					throw new AppError({
						code: 400,
						message: `${rows[conflictingRowIndex]?.name ?? "A drug"} has conflicting ${DRUG_LEVEL_FIELD_LABELS[field]} values in this file`,
					});
				}

				return [field, valueByDrugId] as const;
			})
		) as Record<(typeof DRUG_LEVEL_IMPORT_FIELDS)[number], Map<string, number>>;

		for (const [drugId, lowStockThreshold] of drugLevelValues.lowStockThreshold) {
			// eslint-disable-next-line no-await-in-loop -- queries on one transaction share a single connection and run sequentially
			await tx
				.update(drugs)
				.set({ lowStockThreshold })
				.where(and(eq(drugs.id, drugId), eq(drugs.workspaceId, workspaceId)));
		}

		const importPriceChanges = await applyImportedSellingPrices({
			importedDrugs,
			retailPriceByDrugId: drugLevelValues.retailPrice,
			tx,
			userId,
			wholesalePriceByDrugId: drugLevelValues.wholesalePrice,
			workspaceId,
		});

		const receipts = new Map<
			string,
			{ costPrice: number | undefined; drugId: string; expiryDate: string; quantity: number }
		>();

		for (const [rowIndex, row] of rows.entries()) {
			const drugId = drugIdByRowIndex.get(rowIndex);

			if (!drugId) {
				throw new AppError({
					code: 500,
					message: `Failed to resolve drug for row: ${row.name}`,
				});
			}
			const receiptKey = `${drugId}|${row.expiryDate}|${row.costPrice ?? ""}`;
			const existingReceipt = receipts.get(receiptKey);

			if (existingReceipt) {
				existingReceipt.quantity += row.quantity;
				continue;
			}

			receipts.set(receiptKey, {
				costPrice: row.costPrice,
				drugId,
				expiryDate: row.expiryDate,
				quantity: row.quantity,
			});
		}

		const importedBatches: Array<{ batchId: string; drugId: string; quantity: number }> = [];

		for (const receipt of receipts.values()) {
			// eslint-disable-next-line no-await-in-loop -- queries on one transaction share a single connection and run sequentially
			const batch = await receiveStockBatch({
				...receipt,
				tx,
				userId,
				workspaceId,
			});

			importedBatches.push({ batchId: batch.id, drugId: receipt.drugId, quantity: receipt.quantity });
		}

		await tx.insert(stockLogs).values(
			importedBatches.map(({ batchId, drugId, quantity }) => ({
				batchId,
				drugId,
				logType: "opening_stock" as const,
				performedByUserId: userId,
				quantity,
				stockTransactionId: stockTransaction.id,
				workspaceId,
			}))
		);

		return { importedCount: rows.length, priceChanges: importPriceChanges };
	});

	appLogger.structured.info(
		{
			durationMs: Date.now() - startedAt,
			rowCount: rows.length,
			userId,
			workspaceId,
		},
		"Inventory bulk import completed"
	);

	return { importedCount, priceChanges };
};

type BulkImportReader = BulkImportTransaction | typeof db;

const removedByUsers = alias(users, "removed_by_users");

const STOCK_RECEIPT_LOG_TYPES = ["opening_stock", "stock_in"] as const;

// == Read in SQL: a JS Date drops Postgres's microseconds, so it never equals the stored timestamp
const getImportCreatedAt = (stockTransactionId: string) =>
	sql`(select ${stockTransactions.createdAt} from ${stockTransactions} where ${stockTransactions.id} = ${stockTransactionId})`;

const getBulkImportRemovalBlockedReason = async (options: {
	reader: BulkImportReader;
	stockTransaction: { id: string; removedAt: Date | null };
}) => {
	const { reader, stockTransaction } = options;

	if (stockTransaction.removedAt) {
		return "This import has already been removed.";
	}

	const importLogs = await reader
		.select({ batchId: stockLogs.batchId, quantity: stockLogs.quantity })
		.from(stockLogs)
		.where(eq(stockLogs.stockTransactionId, stockTransaction.id));
	const importBatchIds = importLogs.map((log) => log.batchId).filter((batchId) => batchId !== null);

	if (importLogs.length === 0 || importBatchIds.length !== importLogs.length) {
		return "Some of this import's batches no longer exist.";
	}

	const [laterMovement] = await reader
		.select({ id: stockLogs.id })
		.from(stockLogs)
		.where(
			and(
				inArray(stockLogs.batchId, importBatchIds),
				ne(stockLogs.stockTransactionId, stockTransaction.id),
				gt(stockLogs.createdAt, getImportCreatedAt(stockTransaction.id)),
				notInArray(stockLogs.logType, [...STOCK_RECEIPT_LOG_TYPES]),
				isNull(stockLogs.undoneAt)
			)
		)
		.limit(1);

	if (laterMovement) {
		return "Some of this import's stock has already been dispensed, removed or adjusted.";
	}

	return null;
};

export const getInventoryBulkImports = async (workspaceId: string) => {
	const imports = await db
		.select({
			createdAt: stockTransactions.createdAt,
			drugCount: countDistinct(stockLogs.drugId),
			id: stockTransactions.id,
			importedBy: users.fullName,
			removedAt: stockTransactions.removedAt,
			removedBy: removedByUsers.fullName,
			unitCount: sql<number>`coalesce(${sum(stockLogs.quantity)}, 0)`.mapWith(Number),
		})
		.from(stockTransactions)
		.innerJoin(users, eq(stockTransactions.performedByUserId, users.id))
		.leftJoin(removedByUsers, eq(stockTransactions.removedByUserId, removedByUsers.id))
		.leftJoin(stockLogs, eq(stockLogs.stockTransactionId, stockTransactions.id))
		.where(
			and(
				eq(stockTransactions.workspaceId, workspaceId),
				eq(stockTransactions.operation, "bulk_import")
			)
		)
		.groupBy(stockTransactions.id, users.id, removedByUsers.id)
		.orderBy(desc(stockTransactions.createdAt))
		.limit(50);

	return Promise.all(
		imports.map(async ({ removedAt, removedBy, ...bulkImport }) => ({
			...bulkImport,
			removal: removedAt ? { removedAt, removedBy: removedBy ?? "A former team member" } : null,
			removalBlockedReason: await getBulkImportRemovalBlockedReason({
				reader: db,
				stockTransaction: { id: bulkImport.id, removedAt },
			}),
		}))
	);
};

export const removeInventoryBulkImport = async (options: {
	stockTransactionId: string;
	userId: string;
	workspaceId: string;
}) => {
	const { stockTransactionId, userId, workspaceId } = options;

	await db.transaction(async (tx) => {
		const [stockTransaction] = await tx
			.select({ id: stockTransactions.id, removedAt: stockTransactions.removedAt })
			.from(stockTransactions)
			.where(
				and(
					eq(stockTransactions.id, stockTransactionId),
					eq(stockTransactions.workspaceId, workspaceId),
					eq(stockTransactions.operation, "bulk_import")
				)
			)
			.limit(1)
			.for("update");

		if (!stockTransaction) {
			throw new AppError({ code: 404, message: "Import not found" });
		}

		const blockedReason = await getBulkImportRemovalBlockedReason({ reader: tx, stockTransaction });

		if (blockedReason) {
			throw new AppError({ code: 409, message: blockedReason });
		}

		const importLogs = await tx
			.update(stockLogs)
			.set({ undoneAt: sql`now()`, undoneByUserId: userId })
			.where(eq(stockLogs.stockTransactionId, stockTransaction.id))
			.returning({ batchId: stockLogs.batchId, quantity: stockLogs.quantity });

		for (const log of importLogs) {
			if (!log.batchId) continue;

			// eslint-disable-next-line no-await-in-loop -- queries on one transaction share a single connection and run sequentially
			const [batch] = await tx
				.update(stockBatches)
				.set({
					quantityAvailable: sql`${stockBatches.quantityAvailable} - ${log.quantity}`,
					quantityReceived: sql`${stockBatches.quantityReceived} - ${log.quantity}`,
				})
				.where(and(eq(stockBatches.id, log.batchId), gt(stockBatches.quantityReceived, log.quantity)))
				.returning({ id: stockBatches.id });

			if (!batch) {
				// eslint-disable-next-line no-await-in-loop -- queries on one transaction share a single connection and run sequentially
				await tx.delete(stockBatches).where(eq(stockBatches.id, log.batchId));
			}
		}

		await tx
			.update(stockTransactions)
			.set({ removedAt: sql`now()`, removedByUserId: userId })
			.where(eq(stockTransactions.id, stockTransaction.id));

		// == Drugs inserted by the import share its transaction timestamp: Postgres now() is fixed per transaction
		const createdDrugs = await tx
			.select({ id: drugs.id })
			.from(drugs)
			.where(
				and(
					eq(drugs.workspaceId, workspaceId),
					eq(drugs.createdAt, getImportCreatedAt(stockTransaction.id))
				)
			);

		for (const drug of createdDrugs) {
			// eslint-disable-next-line no-await-in-loop -- queries on one transaction share a single connection and run sequentially
			const [remainingBatch] = await tx
				.select({ id: stockBatches.id })
				.from(stockBatches)
				.where(eq(stockBatches.drugId, drug.id))
				.limit(1);
			// eslint-disable-next-line no-await-in-loop -- queries on one transaction share a single connection and run sequentially
			const [otherMovement] = await tx
				.select({ id: stockLogs.id })
				.from(stockLogs)
				.where(
					and(eq(stockLogs.drugId, drug.id), ne(stockLogs.stockTransactionId, stockTransaction.id))
				)
				.limit(1);

			if (remainingBatch || otherMovement) continue;

			// eslint-disable-next-line no-await-in-loop -- queries on one transaction share a single connection and run sequentially
			await tx.delete(drugs).where(eq(drugs.id, drug.id));
		}
	});
};
