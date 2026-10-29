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
type BatchUpdateBody = z.infer<
	(typeof backendApiSchemaRoutes)["@patch/inventory/batches/:batchId"]["body"]
>;

const batchColumns = {
	batchNumber: stockBatches.batchNumber,
	costPrice: stockBatches.costPrice,
	expiryDate: stockBatches.expiryDate,
	id: stockBatches.id,
	quantityAvailable: stockBatches.quantityAvailable,
};

const BATCH_IDENTITY_CONFLICT_MESSAGE =
	"Another batch with this batch number, expiry date and cost price already exists";

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
		.select(batchColumns)
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

export const updateWorkspaceBatch = async (
	options: BatchUpdateBody & { batchId: string; workspaceId: string }
) => {
	const { batchId, costPrice, expiryDate, workspaceId } = options;

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

			const nextExpiryDate = expiryDate ?? batch.expiryDate;
			const nextCostPrice = costPrice === undefined ? batch.costPrice : costPrice;

			const [conflictingBatch] = await tx
				.select({ id: stockBatches.id })
				.from(stockBatches)
				.where(
					and(
						eq(stockBatches.workspaceId, workspaceId),
						eq(stockBatches.drugId, batch.drugId),
						eq(stockBatches.expiryDate, nextExpiryDate),
						ne(stockBatches.id, batch.id),
						sql`coalesce(lower(btrim(${stockBatches.batchNumber})), '') = ${batch.batchNumber?.trim().toLowerCase() ?? ""}`,
						sql`coalesce(${stockBatches.costPrice}, 0) = ${nextCostPrice ?? 0}`
					)
				)
				.limit(1);

			if (conflictingBatch) {
				throw new AppError({ code: 409, message: BATCH_IDENTITY_CONFLICT_MESSAGE });
			}

			const [updatedBatch] = await tx
				.update(stockBatches)
				.set({ costPrice: nextCostPrice, expiryDate: nextExpiryDate })
				.where(eq(stockBatches.id, batch.id))
				.returning(batchColumns);

			if (!updatedBatch) {
				throw new AppError({ code: 500, message: "Failed to update stock batch" });
			}

			return updatedBatch;
		});
	} catch (error) {
		if (getDatabaseErrorCode(error) === "23505") {
			throw new AppError({ cause: error, code: 409, message: BATCH_IDENTITY_CONFLICT_MESSAGE });
		}

		throw error;
	}
};
