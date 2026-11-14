import { randomUUID } from "node:crypto";
import { db } from "@vitastock/db";
import { drugs, inventoryAlerts, stockBatches, stockLogs } from "@vitastock/db/schema/inventory";
import { and, eq } from "drizzle-orm";
import { expect, test } from "vitest";
import { AppError } from "@/lib/utils";
import {
	createInventoryFixture,
	dispenseTestStock,
	getDateFromToday,
	type InventoryFixture,
} from "@/test/inventoryFixture";
import { syncInventoryAlerts } from "./alertLifecycle";
import {
	createInventoryBulkImport,
	getInventoryBulkImports,
	removeInventoryBulkImport,
	validateInventoryBulkImportRows,
} from "./bulk-import";
import { createInventoryStockLog } from "./stock-log";

const buildRow = (
	overrides: Partial<Parameters<typeof createInventoryBulkImport>[0]["rows"][number]> = {}
) => {
	return {
		expiryDate: getDateFromToday(180),
		form: "Tablet",
		genericName: "Ibuprofen",
		name: "Ibuprofen",
		quantity: 100,
		strength: "400mg",
		unit: "Tablets",
		...overrides,
	};
};

const findDrugByName = async (workspaceId: string, name: string) => {
	const [drug] = await db
		.select()
		.from(drugs)
		.where(and(eq(drugs.workspaceId, workspaceId), eq(drugs.name, name)));

	return drug;
};

const getDrugByName = async (workspaceId: string, name: string) => {
	const drug = await findDrugByName(workspaceId, name);

	if (!drug) {
		throw new Error(`Expected drug "${name}" to exist in workspace ${workspaceId}`);
	}

	return drug;
};

test("Import - creates a drug, batch, and opening-stock log per row", async () => {
	await using fixture = await createInventoryFixture();

	const result = await createInventoryBulkImport({
		idempotencyKey: randomUUID(),
		rows: [buildRow({ lowStockThreshold: 25 })],
		timezone: fixture.workspace.timezone,
		userId: fixture.user.id,
		workspaceId: fixture.workspace.id,
	});

	expect(result.importedCount).toBe(1);

	const drug = await getDrugByName(fixture.workspace.id, "Ibuprofen");
	expect(drug.lowStockThreshold).toBe(25);

	const batches = await db.select().from(stockBatches).where(eq(stockBatches.drugId, drug.id));

	expect(batches).toHaveLength(1);
	expect(batches[0]?.quantityAvailable).toBe(100);
	expect(batches[0]?.quantityReceived).toBe(100);

	const logs = await db.select().from(stockLogs).where(eq(stockLogs.drugId, drug.id));

	expect(logs).toHaveLength(1);
	expect(logs[0]?.logType).toBe("opening_stock");
	expect(logs[0]?.quantity).toBe(100);
});

test("Import - concurrent manual and imported receipts preserve all quantities", async () => {
	await using fixture = await createInventoryFixture();
	const expiryDate = getDateFromToday(180);
	const options = {
		timezone: fixture.workspace.timezone,
		userId: fixture.user.id,
		workspaceId: fixture.workspace.id,
	};
	const results = await Promise.allSettled([
		createInventoryStockLog({
			...options,
			body: { drugId: fixture.drug.id, expiryDate, logType: "stock_in", quantity: 10 },
			idempotencyKey: randomUUID(),
		}),
		createInventoryBulkImport({
			...options,
			idempotencyKey: randomUUID(),
			rows: [
				{ expiryDate, genericName: fixture.drug.genericName, name: fixture.drug.name, quantity: 5 },
			],
		}),
	]);

	expect(results.every((result) => result.status === "fulfilled")).toBe(true);
	const batches = await db.select().from(stockBatches).where(eq(stockBatches.drugId, fixture.drug.id));
	const logs = await db.select().from(stockLogs).where(eq(stockLogs.drugId, fixture.drug.id));

	expect(batches).toHaveLength(1);
	expect(batches[0]).toMatchObject({ quantityAvailable: 15, quantityReceived: 15 });
	expect(logs).toHaveLength(2);
	expect(logs.reduce((total, log) => total + log.quantity, 0)).toBe(15);
});

test("Import - preserves missing metadata as null", async () => {
	await using fixture = await createInventoryFixture();

	await createInventoryBulkImport({
		idempotencyKey: randomUUID(),
		rows: [
			{
				expiryDate: getDateFromToday(180),
				genericName: "Cetirizine",
				name: "Cetirizine",
				quantity: 25,
			},
		],
		timezone: fixture.workspace.timezone,
		userId: fixture.user.id,
		workspaceId: fixture.workspace.id,
	});

	const drug = await getDrugByName(fixture.workspace.id, "Cetirizine");
	const [batch] = await db.select().from(stockBatches).where(eq(stockBatches.drugId, drug.id));
	const [log] = await db.select().from(stockLogs).where(eq(stockLogs.drugId, drug.id));

	expect(drug).toMatchObject({ form: null, strength: null, unit: null });
	expect(batch?.quantityAvailable).toBe(25);
	expect(log?.quantity).toBe(25);
});

test("Import - matches an existing drug case- and whitespace-insensitively", async () => {
	await using fixture = await createInventoryFixture();

	await createInventoryBulkImport({
		idempotencyKey: randomUUID(),
		rows: [
			buildRow({
				form: fixture.drug.form?.toUpperCase(),
				genericName: fixture.drug.genericName.toUpperCase(),
				name: fixture.drug.name.toLowerCase(),
				strength: fixture.drug.strength?.toUpperCase(),
				unit: fixture.drug.unit?.toLowerCase(),
			}),
		],
		timezone: fixture.workspace.timezone,
		userId: fixture.user.id,
		workspaceId: fixture.workspace.id,
	});

	const workspaceDrugs = await db.select().from(drugs).where(eq(drugs.workspaceId, fixture.workspace.id));

	expect(workspaceDrugs).toHaveLength(1);

	const batches = await db.select().from(stockBatches).where(eq(stockBatches.drugId, fixture.drug.id));

	expect(batches).toHaveLength(1);
});

test("Import - creates separate batches for the same drug with different expiry dates", async () => {
	await using fixture = await createInventoryFixture();

	await createInventoryBulkImport({
		idempotencyKey: randomUUID(),
		rows: [
			buildRow({ expiryDate: getDateFromToday(60), quantity: 50 }),
			buildRow({ expiryDate: getDateFromToday(400), quantity: 75 }),
		],
		timezone: fixture.workspace.timezone,
		userId: fixture.user.id,
		workspaceId: fixture.workspace.id,
	});

	const drug = await getDrugByName(fixture.workspace.id, "Ibuprofen");

	const batches = await db
		.select({ quantityAvailable: stockBatches.quantityAvailable })
		.from(stockBatches)
		.where(eq(stockBatches.drugId, drug.id));

	expect(batches).toHaveLength(2);
	expect(batches.map((batch) => batch.quantityAvailable).toSorted()).toEqual([50, 75]);
});

test("Import - combines quantities for the same drug and expiry", async () => {
	await using fixture = await createInventoryFixture();
	const row = buildRow();

	await createInventoryBulkImport({
		idempotencyKey: randomUUID(),
		rows: [row, { ...row, quantity: row.quantity + 1 }],
		timezone: fixture.workspace.timezone,
		userId: fixture.user.id,
		workspaceId: fixture.workspace.id,
	});

	const drug = await getDrugByName(fixture.workspace.id, "Ibuprofen");

	const batches = await db.select().from(stockBatches).where(eq(stockBatches.drugId, drug.id));

	expect(batches).toHaveLength(1);
	expect(batches[0]).toMatchObject({ quantityAvailable: 201, quantityReceived: 201 });
});

test("Import - retrying with the same idempotency key does not create duplicates", async () => {
	await using fixture = await createInventoryFixture();
	const idempotencyKey = randomUUID();
	const options = {
		idempotencyKey,
		rows: [buildRow()],
		timezone: fixture.workspace.timezone,
		userId: fixture.user.id,
		workspaceId: fixture.workspace.id,
	};

	const first = await createInventoryBulkImport(options);
	const second = await createInventoryBulkImport(options);

	expect(second.importedCount).toBe(first.importedCount);

	const drug = await getDrugByName(fixture.workspace.id, "Ibuprofen");

	const batches = await db.select().from(stockBatches).where(eq(stockBatches.drugId, drug.id));
	const logs = await db.select().from(stockLogs).where(eq(stockLogs.drugId, drug.id));

	expect(batches).toHaveLength(1);
	expect(logs).toHaveLength(1);
});

test("Import - rejects an idempotency key reused with another payload", async () => {
	await using fixture = await createInventoryFixture();
	const idempotencyKey = randomUUID();

	await createInventoryBulkImport({
		idempotencyKey,
		rows: [buildRow()],
		timezone: fixture.workspace.timezone,
		userId: fixture.user.id,
		workspaceId: fixture.workspace.id,
	});

	const importPromise = createInventoryBulkImport({
		idempotencyKey,
		rows: [buildRow({ quantity: 101 })],
		timezone: fixture.workspace.timezone,
		userId: fixture.user.id,
		workspaceId: fixture.workspace.id,
	});

	await expect(importPromise).rejects.toEqual(
		expect.objectContaining<Partial<AppError>>({ statusCode: 409 })
	);
});

test("Import - rejects an idempotency key already used by a stock movement", async () => {
	await using fixture = await createInventoryFixture();
	const idempotencyKey = randomUUID();

	await createInventoryStockLog({
		body: {
			drugId: fixture.drug.id,
			expiryDate: getDateFromToday(90),
			logType: "stock_in",
			quantity: 10,
		},
		idempotencyKey,
		timezone: fixture.workspace.timezone,
		userId: fixture.user.id,
		workspaceId: fixture.workspace.id,
	});

	const importPromise = createInventoryBulkImport({
		idempotencyKey,
		rows: [buildRow()],
		timezone: fixture.workspace.timezone,
		userId: fixture.user.id,
		workspaceId: fixture.workspace.id,
	});

	await expect(importPromise).rejects.toEqual(
		expect.objectContaining<Partial<AppError>>({ statusCode: 409 })
	);
});

test("Import - workspace isolation for identical drug identities", async () => {
	await using firstFixture = await createInventoryFixture();
	await using secondFixture = await createInventoryFixture();

	await createInventoryBulkImport({
		idempotencyKey: randomUUID(),
		rows: [buildRow()],
		timezone: firstFixture.workspace.timezone,
		userId: firstFixture.user.id,
		workspaceId: firstFixture.workspace.id,
	});
	await createInventoryBulkImport({
		idempotencyKey: randomUUID(),
		rows: [buildRow()],
		timezone: secondFixture.workspace.timezone,
		userId: secondFixture.user.id,
		workspaceId: secondFixture.workspace.id,
	});

	const firstDrug = await getDrugByName(firstFixture.workspace.id, "Ibuprofen");
	const secondDrug = await getDrugByName(secondFixture.workspace.id, "Ibuprofen");

	expect(firstDrug.id).not.toBe(secondDrug.id);
});

test("Import - imported batches feed into low-stock alert sync", async () => {
	await using fixture = await createInventoryFixture({ lowStockThreshold: 200 });

	await createInventoryBulkImport({
		idempotencyKey: randomUUID(),
		rows: [buildRow({ quantity: 5 })],
		timezone: fixture.workspace.timezone,
		userId: fixture.user.id,
		workspaceId: fixture.workspace.id,
	});

	await syncInventoryAlerts({
		lowStockThreshold: fixture.workspace.lowStockThreshold,
		nearExpiryDays: fixture.workspace.nearExpiryDays,
		timezone: fixture.workspace.timezone,
		workspaceId: fixture.workspace.id,
	});

	const drug = await getDrugByName(fixture.workspace.id, "Ibuprofen");

	const alerts = await db
		.select()
		.from(inventoryAlerts)
		.where(
			and(eq(inventoryAlerts.workspaceId, fixture.workspace.id), eq(inventoryAlerts.drugId, drug.id))
		);

	expect(alerts).toHaveLength(1);
	expect(alerts[0]?.type).toBe("low_stock");
	expect(alerts[0]?.status).toBe("active");
});

test("Validation - reports ambiguous incomplete drug identities", async () => {
	await using fixture = await createInventoryFixture();

	await db.insert(drugs).values({
		form: fixture.drug.form,
		genericName: fixture.drug.genericName,
		name: fixture.drug.name,
		strength: "250mg",
		unit: fixture.drug.unit,
		workspaceId: fixture.workspace.id,
	});

	const row = {
		expiryDate: getDateFromToday(180),
		genericName: fixture.drug.genericName,
		name: fixture.drug.name,
		quantity: 20,
	};
	const results = await validateInventoryBulkImportRows({
		rows: [row],
		workspaceId: fixture.workspace.id,
	});

	expect(results.issues).toEqual([
		expect.objectContaining({
			message: "Multiple Drug Master records match this row. Supply more drug details.",
			rowIndex: 0,
		}),
	]);
	await expect(
		createInventoryBulkImport({
			idempotencyKey: randomUUID(),
			rows: [row],
			timezone: fixture.workspace.timezone,
			userId: fixture.user.id,
			workspaceId: fixture.workspace.id,
		})
	).rejects.toEqual(expect.objectContaining<Partial<AppError>>({ statusCode: 409 }));
});

test("Validation - reports ambiguity introduced by rows in the same file", async () => {
	await using fixture = await createInventoryFixture();
	const rows = [
		{
			expiryDate: getDateFromToday(180),
			genericName: "Paracetamol",
			name: "Panadol",
			quantity: 20,
			strength: "500mg",
		},
		{
			expiryDate: getDateFromToday(240),
			genericName: "Paracetamol",
			name: "Panadol",
			quantity: 10,
		},
	];
	const results = await validateInventoryBulkImportRows({
		rows,
		workspaceId: fixture.workspace.id,
	});

	expect(results.issues).toEqual([
		expect.objectContaining({
			message: "Multiple Drug Master records match this row. Supply more drug details.",
			rowIndex: 1,
		}),
	]);
});

const buildFixtureDrugRow = (
	fixture: InventoryFixture,
	overrides: Parameters<typeof buildRow>[0] = {}
) => {
	return buildRow({
		form: fixture.drug.form ?? undefined,
		genericName: fixture.drug.genericName,
		name: fixture.drug.name,
		strength: fixture.drug.strength ?? undefined,
		unit: fixture.drug.unit ?? undefined,
		...overrides,
	});
};

const importRows = (fixture: InventoryFixture, rows: Array<ReturnType<typeof buildRow>>) => {
	return createInventoryBulkImport({
		idempotencyKey: randomUUID(),
		rows,
		timezone: fixture.workspace.timezone,
		userId: fixture.user.id,
		workspaceId: fixture.workspace.id,
	});
};

test("Import - saves cost on the batch and selling prices on the drug", async () => {
	await using fixture = await createInventoryFixture();

	await importRows(fixture, [buildRow({ costPrice: 120, retailPrice: 200, wholesalePrice: 170 })]);

	const drug = await getDrugByName(fixture.workspace.id, "Ibuprofen");
	const [batch] = await db.select().from(stockBatches).where(eq(stockBatches.drugId, drug.id));

	expect(drug).toMatchObject({
		priceUpdatedByUserId: fixture.user.id,
		retailPrice: 200,
		wholesalePrice: 170,
	});
	expect(batch?.costPrice).toBe(120);
});

test("Import - the file's selling price wins and the change is reported", async () => {
	await using fixture = await createInventoryFixture();

	await importRows(fixture, [buildRow({ retailPrice: 200 })]);

	const result = await importRows(fixture, [buildRow({ quantity: 20, retailPrice: 260 })]);
	const drug = await getDrugByName(fixture.workspace.id, "Ibuprofen");

	expect(drug.retailPrice).toBe(260);
	expect(result.priceChanges).toEqual([
		{ drugName: "Ibuprofen", field: "retailPrice", newPrice: 260, previousPrice: 200 },
	]);
});

test("Import - keeps the same drug and expiry at two costs as two batches", async () => {
	await using fixture = await createInventoryFixture();

	await importRows(fixture, [buildRow({ costPrice: 100 }), buildRow({ costPrice: 130, quantity: 40 })]);

	const drug = await getDrugByName(fixture.workspace.id, "Ibuprofen");
	const batches = await db.select().from(stockBatches).where(eq(stockBatches.drugId, drug.id));

	expect(batches.map((batch) => batch.costPrice).toSorted()).toEqual([100, 130]);
});

test("Import validation - rejects conflicting selling prices and warns on prices below cost", async () => {
	await using fixture = await createInventoryFixture();

	const results = await validateInventoryBulkImportRows({
		rows: [
			buildRow({ costPrice: 300, retailPrice: 250 }),
			buildRow({ expiryDate: getDateFromToday(240), retailPrice: 280 }),
		],
		workspaceId: fixture.workspace.id,
	});

	expect(results.issues).toEqual([
		expect.objectContaining({
			message: "Ibuprofen has conflicting retail price values in this file",
			rowIndex: 1,
		}),
	]);
	expect(results.warnings).toEqual([
		expect.objectContaining({
			message: "Ibuprofen: the retail price is below the cost price",
			rowIndex: 0,
		}),
	]);
});

test("Import removal - takes the stock and the drugs it created back out", async () => {
	await using fixture = await createInventoryFixture();

	await importRows(fixture, [buildRow()]);

	const [bulkImport] = await getInventoryBulkImports(fixture.workspace.id);

	if (!bulkImport) {
		throw new Error("Expected the import to be listed");
	}

	expect(bulkImport).toMatchObject({
		drugCount: 1,
		removal: null,
		removalBlockedReason: null,
		unitCount: 100,
	});

	await removeInventoryBulkImport({
		stockTransactionId: bulkImport.id,
		userId: fixture.user.id,
		workspaceId: fixture.workspace.id,
	});

	const removedDrug = await findDrugByName(fixture.workspace.id, "Ibuprofen");
	const [listedImport] = await getInventoryBulkImports(fixture.workspace.id);

	expect(removedDrug).toBeUndefined();
	expect(listedImport?.removal).toEqual(expect.objectContaining({ removedBy: fixture.user.fullName }));
});

test("Import removal - leaves a drug's earlier stock untouched", async () => {
	await using fixture = await createInventoryFixture();

	await importRows(fixture, [buildFixtureDrugRow(fixture)]);
	await importRows(fixture, [buildFixtureDrugRow(fixture, { quantity: 30 })]);

	const [latestImport] = await getInventoryBulkImports(fixture.workspace.id);

	if (!latestImport) {
		throw new Error("Expected the latest import to be listed");
	}

	await removeInventoryBulkImport({
		stockTransactionId: latestImport.id,
		userId: fixture.user.id,
		workspaceId: fixture.workspace.id,
	});

	const [batch] = await db.select().from(stockBatches).where(eq(stockBatches.drugId, fixture.drug.id));

	expect(batch).toMatchObject({ quantityAvailable: 100, quantityReceived: 100 });
});

test("Import removal - is blocked once any of its stock has been dispensed", async () => {
	await using fixture = await createInventoryFixture();

	await importRows(fixture, [buildFixtureDrugRow(fixture)]);
	await dispenseTestStock(fixture, 1);

	const [bulkImport] = await getInventoryBulkImports(fixture.workspace.id);

	if (!bulkImport) {
		throw new Error("Expected the import to be listed");
	}

	expect(bulkImport.removalBlockedReason).toBe(
		"Some of this import's stock has already been dispensed, removed or adjusted."
	);
	await expect(
		removeInventoryBulkImport({
			stockTransactionId: bulkImport.id,
			userId: fixture.user.id,
			workspaceId: fixture.workspace.id,
		})
	).rejects.toEqual(expect.objectContaining<Partial<AppError>>({ statusCode: 409 }));
});
