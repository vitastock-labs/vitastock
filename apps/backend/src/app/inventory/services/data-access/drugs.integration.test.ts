import { randomUUID } from "node:crypto";
import { expect, test } from "vitest";
import { AppError } from "@/lib/utils";
import { createInventoryFixture, getDateFromToday, receiveTestStock } from "@/test/inventoryFixture";
import { createInventoryStockLog } from "../stock-log";
import { getWorkspacePriceList, handleDrugAction, updateDrug } from "./drugs";

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

test("Drug prices - records who changed a price and when", async () => {
	await using fixture = await createInventoryFixture();

	const drug = await updateDrug({
		drugId: fixture.drug.id,
		retailPrice: 1500,
		userId: fixture.user.id,
		wholesalePrice: 1300,
		workspaceId: fixture.workspace.id,
	});

	expect(drug).toMatchObject({
		priceUpdatedByUserId: fixture.user.id,
		retailPrice: 1500,
		wholesalePrice: 1300,
	});
	expect(drug.priceUpdatedAt).toBeInstanceOf(Date);
});

test("Drug prices - editing other details leaves the price stamp alone", async () => {
	await using fixture = await createInventoryFixture();

	const drug = await updateDrug({
		drugId: fixture.drug.id,
		lowStockThreshold: 4,
		userId: fixture.user.id,
		workspaceId: fixture.workspace.id,
	});

	expect(drug).toMatchObject({ priceUpdatedAt: null, priceUpdatedByUserId: null });
});

test("Price list - shows the cost range of usable stock and flags uncosted batches", async () => {
	await using fixture = await createInventoryFixture();
	const receiveCostedStock = (options: {
		batchNumber: string;
		costPrice: number;
		expiresInDays: number;
	}) =>
		createInventoryStockLog({
			body: {
				batchNumber: options.batchNumber,
				costPrice: options.costPrice,
				drugId: fixture.drug.id,
				expiryDate: getDateFromToday(options.expiresInDays),
				logType: "stock_in",
				quantity: 5,
			},
			idempotencyKey: randomUUID(),
			timezone: fixture.workspace.timezone,
			userId: fixture.user.id,
			workspaceId: fixture.workspace.id,
		});

	await receiveTestStock({ drugId: fixture.drug.id, expiresInDays: 30, fixture, quantity: 5 });
	await receiveCostedStock({ batchNumber: "BATCH-PRICED-A", costPrice: 2000, expiresInDays: 60 });
	await receiveCostedStock({ batchNumber: "BATCH-PRICED-B", costPrice: 2600, expiresInDays: 90 });

	const priceList = await getWorkspacePriceList({
		query: undefined,
		timezone: fixture.workspace.timezone,
		workspaceId: fixture.workspace.id,
	});

	expect(priceList.rows).toEqual([
		expect.objectContaining({
			costRange: { highest: 2600, lowest: 2000 },
			uncostedBatchCount: 1,
		}),
	]);
});

test("Price list - the prices missing filter only lists drugs without a retail price", async () => {
	await using fixture = await createInventoryFixture();

	const listMissing = () =>
		getWorkspacePriceList({
			query: { pricesMissing: true },
			timezone: fixture.workspace.timezone,
			workspaceId: fixture.workspace.id,
		});

	const missingBeforePricing = await listMissing();

	expect(missingBeforePricing.rows).toHaveLength(1);

	await updateDrug({
		drugId: fixture.drug.id,
		retailPrice: 900,
		userId: fixture.user.id,
		workspaceId: fixture.workspace.id,
	});

	const missingAfterPricing = await listMissing();

	expect(missingAfterPricing.rows).toHaveLength(0);
});
