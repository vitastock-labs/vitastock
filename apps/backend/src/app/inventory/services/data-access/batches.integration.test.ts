import { randomUUID } from "node:crypto";
import { expect, test } from "vitest";
import { AppError } from "@/lib/utils";
import { createInventoryFixture, getDateFromToday, type InventoryFixture } from "@/test/inventoryFixture";
import { createInventoryStockLog } from "../stock-log";
import { getWorkspaceDrugBatches, updateWorkspaceBatch } from "./batches";

const receiveCorrectionStock = (fixture: InventoryFixture, costPrice?: number) => {
	return createInventoryStockLog({
		body: {
			batchNumber: "BATCH-CORRECTION",
			costPrice,
			drugId: fixture.drug.id,
			expiryDate: getDateFromToday(120),
			logType: "stock_in",
			quantity: 10,
		},
		idempotencyKey: randomUUID(),
		timezone: fixture.workspace.timezone,
		userId: fixture.user.id,
		workspaceId: fixture.workspace.id,
	});
};

const getBatches = (fixture: InventoryFixture) => {
	return getWorkspaceDrugBatches({
		availability: "all",
		drugId: fixture.drug.id,
		timezone: fixture.workspace.timezone,
		workspaceId: fixture.workspace.id,
	});
};

test("Batch corrections - sets the cost price of a batch recorded without one", async () => {
	await using fixture = await createInventoryFixture();

	await receiveCorrectionStock(fixture);

	const [batch] = await getBatches(fixture);

	if (!batch) {
		throw new Error("Expected the received batch to exist");
	}

	const updatedBatch = await updateWorkspaceBatch({
		batchId: batch.id,
		costPrice: 1800,
		workspaceId: fixture.workspace.id,
	});

	expect(updatedBatch).toMatchObject({ costPrice: 1800, expiryDate: batch.expiryDate });
});

test("Batch corrections - refuses a cost that would duplicate another batch", async () => {
	await using fixture = await createInventoryFixture();

	await receiveCorrectionStock(fixture, 1800);
	await receiveCorrectionStock(fixture);

	const batches = await getBatches(fixture);
	const uncostedBatch = batches.find((batch) => batch.costPrice === null);

	if (!uncostedBatch) {
		throw new Error("Expected an uncosted batch to exist");
	}

	await expect(
		updateWorkspaceBatch({
			batchId: uncostedBatch.id,
			costPrice: 1800,
			workspaceId: fixture.workspace.id,
		})
	).rejects.toEqual(expect.objectContaining<Partial<AppError>>({ statusCode: 409 }));
});
