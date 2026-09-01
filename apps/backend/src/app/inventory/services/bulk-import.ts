import { db } from "@vitastock/db";
import { drugs, stockBatches, stockLogs } from "@vitastock/db/schema/inventory";
import type { backendApiSchemaRoutes } from "@vitastock/shared/validation/backendApiSchema";
import { and, asc, eq, inArray } from "drizzle-orm";
import type { z } from "zod";
import { appLogger } from "@/lib/logger";
import { AppError } from "@/lib/utils";
import {
	claimStockTransaction,
	createStockTransactionRequestHash,
} from "./data-access/stock-transactions";
import { convertNairaToKobo } from "./utils/common";
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
	"form" | "genericName" | "id" | "isActive" | "name" | "strength" | "unit"
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
			name: row.name,
			strength: row.strength ?? null,
			unit: row.unit ?? null,
		});
	}

	const resolutionPool = [...existingDrugs, ...proposedDrugs.values()];

	const issues = [];

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
		}
	}

	return issues;
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
				[...missingIdentities.values()].map((row) => ({
					form: row.form ?? null,
					genericName: row.genericName,
					name: row.name,
					strength: row.strength ?? null,
					unit: row.unit ?? null,
					workspaceId,
				}))
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

	const importedCount = await db.transaction(async (tx) => {
		const stockTransaction = await claimStockTransaction({
			idempotencyKey,
			operation: "bulk_import",
			requestHash,
			tx,
			userId,
			workspaceId,
		});

		if (stockTransaction.isReplay) {
			return rows.length;
		}

		const drugIdByRowIndex = await resolveDrugIdsByRowIndex({ rows, tx, workspaceId });
		const drugIds = [...new Set(drugIdByRowIndex.values())].toSorted();
		const importedDrugs = await tx
			.select({ id: drugs.id, isActive: drugs.isActive, name: drugs.name })
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

		const receiptLayers = new Map<
			string,
			{ drugId: string; expiryDate: string; quantity: number; unitCostKobo: number | null }
		>();

		for (const [rowIndex, row] of rows.entries()) {
			const drugId = drugIdByRowIndex.get(rowIndex);

			if (!drugId) {
				throw new AppError({
					code: 500,
					message: `Failed to resolve drug for row: ${row.name}`,
				});
			}

			const unitCostKobo = convertNairaToKobo(row.unitCostNaira);
			const layerKey = `${drugId}|${row.expiryDate}|${unitCostKobo ?? "uncosted"}`;
			const existingLayer = receiptLayers.get(layerKey);

			if (existingLayer) {
				existingLayer.quantity += row.quantity;
				continue;
			}

			receiptLayers.set(layerKey, {
				drugId,
				expiryDate: row.expiryDate,
				quantity: row.quantity,
				unitCostKobo,
			});
		}

		const existingBatches = await tx
			.select()
			.from(stockBatches)
			.where(and(eq(stockBatches.workspaceId, workspaceId), inArray(stockBatches.drugId, drugIds)))
			.for("update");
		const existingBatchByLayerKey = new Map<string, (typeof existingBatches)[number]>();

		for (const batch of existingBatches) {
			if (batch.batchNumber !== null) continue;

			existingBatchByLayerKey.set(
				`${batch.drugId}|${batch.expiryDate}|${batch.unitCostKobo ?? "uncosted"}`,
				batch
			);
		}
		const importedBatches = await Promise.all(
			[...receiptLayers.entries()].map(async ([layerKey, layer]) => {
				const existingBatch = existingBatchByLayerKey.get(layerKey);

				if (existingBatch) {
					const [batch] = await tx
						.update(stockBatches)
						.set({
							quantityAvailable: existingBatch.quantityAvailable + layer.quantity,
							quantityReceived: existingBatch.quantityReceived + layer.quantity,
						})
						.where(eq(stockBatches.id, existingBatch.id))
						.returning();

					if (!batch) {
						throw new AppError({ code: 500, message: "Failed to update stock batch" });
					}

					return { batch, quantity: layer.quantity };
				}

				const [batch] = await tx
					.insert(stockBatches)
					.values({
						drugId: layer.drugId,
						expiryDate: layer.expiryDate,
						quantityAvailable: layer.quantity,
						quantityReceived: layer.quantity,
						unitCostKobo: layer.unitCostKobo,
						userId,
						workspaceId,
					})
					.returning();

				if (!batch) {
					throw new AppError({ code: 500, message: "Failed to create stock batch" });
				}

				return { batch, quantity: layer.quantity };
			})
		);

		await tx.insert(stockLogs).values(
			importedBatches.map(({ batch, quantity }) => ({
				batchId: batch.id,
				drugId: batch.drugId,
				logType: "opening_stock" as const,
				performedByUserId: userId,
				quantity,
				stockTransactionId: stockTransaction.id,
				unitCostKobo: batch.unitCostKobo,
				workspaceId,
			}))
		);

		return rows.length;
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

	return { importedCount };
};
