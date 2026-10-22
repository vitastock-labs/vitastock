import { randomUUID } from "node:crypto";
import { expect, test } from "vitest";
import { AppError } from "@/lib/utils";
import { createInventoryFixture, getDateFromToday } from "@/test/inventoryFixture";
import { createInventoryStockLog } from "../stock-log";
import { handleDrugAction } from "./drugs";

test("Drug lifecycle - blocks deactivation until all stock is removed", async () => {
	await using fixture = await createInventoryFixture();

	await createInventoryStockLog({
		body: {
			batchNumber: "BATCH-DEACTIVATION",
			drugId: fixture.drug.id,
			expiryDate: getDateFromToday(90),
			logType: "stock_in",
			quantity: 2,
		},
		idempotencyKey: randomUUID(),
		timezone: fixture.workspace.timezone,
		userId: fixture.user.id,
		workspaceId: fixture.workspace.id,
	});

	await expect(
		handleDrugAction({
			action: "deactivate",
			drugId: fixture.drug.id,
			workspaceId: fixture.workspace.id,
		})
	).rejects.toEqual(expect.objectContaining<Partial<AppError>>({ statusCode: 409 }));

	await createInventoryStockLog({
		body: {
			drugId: fixture.drug.id,
			logType: "stock_out",
			quantity: 2,
			reason: "patient",
		},
		idempotencyKey: randomUUID(),
		timezone: fixture.workspace.timezone,
		userId: fixture.user.id,
		workspaceId: fixture.workspace.id,
	});

	const deactivatedDrug = await handleDrugAction({
		action: "deactivate",
		drugId: fixture.drug.id,
		workspaceId: fixture.workspace.id,
	});

	expect(deactivatedDrug.isActive).toBe(false);
});
