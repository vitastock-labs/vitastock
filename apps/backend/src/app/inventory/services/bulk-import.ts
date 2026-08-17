import { db } from "@vitastock/db";
import { drugs, stockBatches, stockLogs } from "@vitastock/db/schema/inventory";
import type { backendApiSchemaRoutes } from "@vitastock/shared/validation/backendApiSchema";
import { count, eq } from "drizzle-orm";
import type { z } from "zod";
import { appLogger } from "@/lib/logger";
import { AppError } from "@/lib/utils";
import {
	claimStockTransaction,
	createStockTransactionRequestHash,
} from "./data-access/stock-transactions";

type BulkImportTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

type BulkImportRow = z.infer<
	(typeof backendApiSchemaRoutes)["@post/inventory/bulk-import"]["body"]
>["rows"][number];

const normalizeDrugIdentity = (identity: {
	form: string;
	genericName: string;
	name: string;
	strength: string;
	unit: string;
}) => {
	return [identity.name, identity.genericName, identity.strength, identity.form, identity.unit]
		.map((value) => value.trim().toLowerCase())
		.join("|");
};

const resolveDrugIdsByIdentity = async (options: {
	rows: BulkImportRow[];
	tx: BulkImportTransaction;
	workspaceId: string;
}) => {
	const { rows, tx, workspaceId } = options;

	const existingDrugs = await tx.select().from(drugs).where(eq(drugs.workspaceId, workspaceId));

	const drugIdByIdentity = new Map(existingDrugs.map((drug) => [normalizeDrugIdentity(drug), drug.id]));

	const missingIdentities = new Map<string, BulkImportRow>();

	for (const row of rows) {
		const identity = normalizeDrugIdentity(row);

		if (!drugIdByIdentity.has(identity)) {
			missingIdentities.set(identity, row);
		}
	}

	if (missingIdentities.size === 0) {
		return drugIdByIdentity;
	}

	const insertedDrugs = await tx
		.insert(drugs)
		.values(
			[...missingIdentities.values()].map((row) => ({
				form: row.form,
				genericName: row.genericName,
				name: row.name,
				strength: row.strength,
				unit: row.unit,
				workspaceId,
			}))
		)
		.onConflictDoNothing()
		.returning();

	for (const drug of insertedDrugs) {
		drugIdByIdentity.set(normalizeDrugIdentity(drug), drug.id);
	}

	const stillMissingIdentities = [...missingIdentities.keys()].filter(
		(identity) => !drugIdByIdentity.has(identity)
	);

	if (stillMissingIdentities.length === 0) {
		return drugIdByIdentity;
	}

	// Another concurrent request already inserted these identities between our select and insert - re-fetch to pick up their ids.
	const raceWinners = await tx.select().from(drugs).where(eq(drugs.workspaceId, workspaceId));

	for (const drug of raceWinners) {
		drugIdByIdentity.set(normalizeDrugIdentity(drug), drug.id);
	}

	return drugIdByIdentity;
};

export const createInventoryBulkImport = async (options: {
	idempotencyKey: string;
	rows: BulkImportRow[];
	userId: string;
	workspaceId: string;
}) => {
	const { idempotencyKey, rows, userId, workspaceId } = options;
	const startedAt = Date.now();
	const requestHash = createStockTransactionRequestHash(rows);

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
			const [logCount] = await tx
				.select({ value: count() })
				.from(stockLogs)
				.where(eq(stockLogs.stockTransactionId, stockTransaction.id));

			return logCount?.value ?? 0;
		}

		const drugIdByIdentity = await resolveDrugIdsByIdentity({ rows, tx, workspaceId });

		const insertedBatches = await tx
			.insert(stockBatches)
			.values(
				rows.map((row) => {
					const drugId = drugIdByIdentity.get(normalizeDrugIdentity(row));

					if (!drugId) {
						throw new AppError({
							code: 500,
							message: `Failed to resolve drug for row: ${row.name}`,
						});
					}

					const unitCostKobo = Math.round(row.unitCostNaira * 100);

					return {
						drugId,
						expiryDate: row.expiryDate,
						quantityAvailable: row.quantity,
						quantityReceived: row.quantity,
						unitCostKobo,
						userId,
						workspaceId,
					};
				})
			)
			.returning();

		await tx.insert(stockLogs).values(
			insertedBatches.map((batch) => ({
				batchId: batch.id,
				drugId: batch.drugId,
				logType: "opening_stock" as const,
				performedByUserId: userId,
				quantity: batch.quantityAvailable,
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
