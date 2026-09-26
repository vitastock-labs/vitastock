import type { db } from "@vitastock/db";
import { stockBatches } from "@vitastock/db/schema/inventory";
import { and, eq, sql } from "drizzle-orm";
import { AppError } from "@/lib/utils";

// Call within the stock transaction after locking and validating the drug.
export const receiveStockBatch = async (options: {
	batchNumber?: string | null;
	drugId: string;
	expiryDate: string;
	quantity: number;
	tx: Parameters<Parameters<typeof db.transaction>[0]>[0];
	userId: string;
	workspaceId: string;
}) => {
	const { batchNumber, drugId, expiryDate, quantity, tx, userId, workspaceId } = options;
	const normalizedBatchNumber = batchNumber?.trim() ?? "";
	const [existingBatch] = await tx
		.select()
		.from(stockBatches)
		.where(
			and(
				eq(stockBatches.workspaceId, workspaceId),
				eq(stockBatches.drugId, drugId),
				eq(stockBatches.expiryDate, expiryDate),
				sql`coalesce(lower(btrim(${stockBatches.batchNumber})), '') = ${normalizedBatchNumber.toLowerCase()}`
			)
		)
		.limit(1)
		.for("update");

	if (existingBatch) {
		await tx
			.update(stockBatches)
			.set({
				quantityAvailable: existingBatch.quantityAvailable + quantity,
				quantityReceived: existingBatch.quantityReceived + quantity,
			})
			.where(eq(stockBatches.id, existingBatch.id));

		return { id: existingBatch.id };
	}

	const [batch] = await tx
		.insert(stockBatches)
		.values({
			batchNumber: normalizedBatchNumber === "" ? null : normalizedBatchNumber,
			drugId,
			expiryDate,
			quantityAvailable: quantity,
			quantityReceived: quantity,
			userId,
			workspaceId,
		})
		.returning({ id: stockBatches.id });

	if (!batch) {
		throw new AppError({ code: 500, message: "Failed to receive stock batch" });
	}

	return batch;
};
