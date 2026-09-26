import { db } from "@vitastock/db";
import { stockBatches } from "@vitastock/db/schema/inventory";
import type { backendApiSchemaRoutes } from "@vitastock/shared/validation/backendApiSchema";
import { and, asc, eq, gt, gte, lt, ne, sql, type SQL } from "drizzle-orm";
import type { z } from "zod";
import { AppError } from "@/lib/utils";
import { getWorkspaceToday } from "../utils/date";

type BatchAvailability = z.infer<
	(typeof backendApiSchemaRoutes)["@get/inventory/drugs/:drugId/batches"]["query"]
>["availability"];

const getDatabaseErrorCode = (error: unknown): string | undefined => {
	if (!(error instanceof Error)) {
		return undefined;
	}

	if ("code" in error && typeof error.code === "string") {
		return error.code;
	}

	return getDatabaseErrorCode(error.cause);
};

export const getWorkspaceDrugBatches = async (options: {
	availability: BatchAvailability;
	drugId: string;
	timezone: string;
	workspaceId: string;
}) => {
	const { availability, drugId, timezone, workspaceId } = options;
	const today = getWorkspaceToday(timezone);
	let expiryCondition: SQL | undefined;

	if (availability === "expired") {
		expiryCondition = lt(stockBatches.expiryDate, today);
	}

	if (availability === "usable") {
		expiryCondition = gte(stockBatches.expiryDate, today);
	}

	return db
		.select({
			batchNumber: stockBatches.batchNumber,
			expiryDate: stockBatches.expiryDate,
			id: stockBatches.id,
			quantityAvailable: stockBatches.quantityAvailable,
		})
		.from(stockBatches)
		.where(
			and(
				eq(stockBatches.workspaceId, workspaceId),
				eq(stockBatches.drugId, drugId),
				gt(stockBatches.quantityAvailable, 0),
				expiryCondition
			)
		)
		.orderBy(asc(stockBatches.expiryDate), asc(stockBatches.createdAt), asc(stockBatches.id));
};

export const updateWorkspaceBatchExpiryDate = async (options: {
	batchId: string;
	expiryDate: string;
	workspaceId: string;
}) => {
	const { batchId, expiryDate, workspaceId } = options;

	try {
		return await db.transaction(async (tx) => {
			const [batch] = await tx
				.select()
				.from(stockBatches)
				.where(and(eq(stockBatches.id, batchId), eq(stockBatches.workspaceId, workspaceId)))
				.limit(1)
				.for("update");

			if (!batch) {
				throw new AppError({ code: 404, message: "Stock batch not found" });
			}

			const [conflictingBatch] = await tx
				.select({ id: stockBatches.id })
				.from(stockBatches)
				.where(
					and(
						eq(stockBatches.workspaceId, workspaceId),
						eq(stockBatches.drugId, batch.drugId),
						eq(stockBatches.expiryDate, expiryDate),
						ne(stockBatches.id, batch.id),
						sql`coalesce(lower(btrim(${stockBatches.batchNumber})), '') = ${batch.batchNumber?.trim().toLowerCase() ?? ""}`
					)
				)
				.limit(1);

			if (conflictingBatch) {
				throw new AppError({
					code: 409,
					message: "Another batch with this batch number and expiry date already exists",
				});
			}

			const [updatedBatch] = await tx
				.update(stockBatches)
				.set({ expiryDate })
				.where(eq(stockBatches.id, batch.id))
				.returning({
					batchNumber: stockBatches.batchNumber,
					expiryDate: stockBatches.expiryDate,
					id: stockBatches.id,
					quantityAvailable: stockBatches.quantityAvailable,
				});

			if (!updatedBatch) {
				throw new AppError({ code: 500, message: "Failed to update batch expiry date" });
			}

			return updatedBatch;
		});
	} catch (error) {
		if (getDatabaseErrorCode(error) === "23505") {
			throw new AppError({
				cause: error,
				code: 409,
				message: "Another batch with this batch number and expiry date already exists",
			});
		}

		throw error;
	}
};
