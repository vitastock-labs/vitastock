import { randomUUID } from "node:crypto";
import { db } from "@vitastock/db";
import { drugs, inventoryAlerts, stockBatches, stockLogs } from "@vitastock/db/schema/inventory";
import { addDays, format } from "date-fns";
import { and, eq } from "drizzle-orm";
import { afterAll, expect, test } from "vitest";
import { AppError } from "@/lib/utils";
import { createInventoryFixture } from "@/test/inventoryFixture";
import { syncInventoryAlerts } from "./alertLifecycle";
import { createInventoryBulkImport, validateInventoryBulkImportRows } from "./bulk-import";
import { createInventoryStockLog } from "./stock-log";

afterAll(async () => {
	await db.$client.end();
});

const getDateFromToday = (days: number) => format(addDays(new Date(), days), "yyyy-MM-dd");

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
		unitCostNaira: 15.5,
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

test("Bulk import integration - creates a drug, batch, and opening-stock log per row", async () => {
	await using fixture = await createInventoryFixture();

	const result = await createInventoryBulkImport({
		idempotencyKey: randomUUID(),
		rows: [buildRow()],
		timezone: fixture.workspace.timezone,
		userId: fixture.user.id,
		workspaceId: fixture.workspace.id,
	});

	expect(result.importedCount).toBe(1);

	const drug = await getDrugByName(fixture.workspace.id, "Ibuprofen");

	const batches = await db.select().from(stockBatches).where(eq(stockBatches.drugId, drug.id));

	expect(batches).toHaveLength(1);
	expect(batches[0]?.quantityAvailable).toBe(100);
	expect(batches[0]?.quantityReceived).toBe(100);

	const logs = await db.select().from(stockLogs).where(eq(stockLogs.drugId, drug.id));

	expect(logs).toHaveLength(1);
	expect(logs[0]?.logType).toBe("opening_stock");
	expect(logs[0]?.quantity).toBe(100);
});

test("Bulk import integration - converts naira to kobo by rounding", async () => {
	await using fixture = await createInventoryFixture();

	await createInventoryBulkImport({
		idempotencyKey: randomUUID(),
		rows: [buildRow({ unitCostNaira: 12.345 })],
		timezone: fixture.workspace.timezone,
		userId: fixture.user.id,
		workspaceId: fixture.workspace.id,
	});

	const [batch] = await db
		.select()
		.from(stockBatches)
		.where(eq(stockBatches.workspaceId, fixture.workspace.id));

	expect(batch?.unitCostKobo).toBe(Math.round(12.345 * 100));
});

test("Bulk import integration - preserves missing metadata and cost as null", async () => {
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
	expect(batch?.unitCostKobo).toBeNull();
	expect(log?.unitCostKobo).toBeNull();
});

test("Bulk import validation - reports ambiguous incomplete drug identities", async () => {
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

	expect(results).toEqual([
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

test("Bulk import validation - reports ambiguity introduced by rows in the same file", async () => {
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

	expect(results).toEqual([
		expect.objectContaining({
			message: "Multiple Drug Master records match this row. Supply more drug details.",
			rowIndex: 1,
		}),
	]);
});

test("Bulk import integration - matches an existing drug case- and whitespace-insensitively", async () => {
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

test("Bulk import integration - creates separate batches for the same drug with different expiry dates", async () => {
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

test("Bulk import integration - allows the same drug with a different quantity as a separate batch", async () => {
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

	expect(batches).toHaveLength(2);
});

test("Bulk import integration - retrying with the same idempotency key does not create duplicates", async () => {
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

test("Bulk import integration - rejects an idempotency key reused with another payload", async () => {
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

test("Bulk import integration - rejects an idempotency key already used by a stock movement", async () => {
	await using fixture = await createInventoryFixture();
	const idempotencyKey = randomUUID();

	await createInventoryStockLog({
		body: {
			drugId: fixture.drug.id,
			expiryDate: getDateFromToday(90),
			logType: "stock_in",
			quantity: 10,
			unitCostNaira: 10,
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

test("Bulk import integration - workspace isolation for identical drug identities", async () => {
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

test("Bulk import integration - imported batches feed into low-stock alert sync", async () => {
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
