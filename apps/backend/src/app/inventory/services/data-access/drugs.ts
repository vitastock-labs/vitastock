import { db } from "@vitastock/db";
import { drugs } from "@vitastock/db/schema/inventory";
import type { backendApiSchemaRoutes } from "@vitastock/shared/validation/backendApiSchema";
import { and, count, eq, ilike, or, type SQL } from "drizzle-orm";
import type { z } from "zod";
import { AppError } from "@/lib/utils";

type InventoryDrugsQuery = z.infer<
	NonNullable<(typeof backendApiSchemaRoutes)["@get/inventory/drugs"]["query"]>
>;

export const getWorkspaceDrugList = async (options: {
	query: InventoryDrugsQuery | undefined;
	workspaceId: string;
}) => {
	const { query, workspaceId } = options;

	if (!query || Object.keys(query).length === 0) {
		const drugsResult = await db
			.select()
			.from(drugs)
			.where(and(eq(drugs.workspaceId, workspaceId), eq(drugs.isActive, true)))
			.orderBy(drugs.name);

		return {
			drugs: drugsResult,
		};
	}

	const page = query.page ?? 1;
	const pageSize = query.pageSize ?? 10;
	const search = query.search;

	const whereConditions: Array<SQL | undefined> = [eq(drugs.workspaceId, workspaceId)];

	if (search) {
		whereConditions.push(
			or(
				ilike(drugs.genericName, `%${search}%`),
				ilike(drugs.name, `%${search}%`),
				ilike(drugs.strength, `%${search}%`),
				ilike(drugs.form, `%${search}%`),
				ilike(drugs.unit, `%${search}%`)
			)
		);
	}

	const [drugsResult, totalResult] = await Promise.all([
		db
			.select()
			.from(drugs)
			.where(and(...whereConditions))
			.orderBy(drugs.name)
			.limit(pageSize)
			.offset((page - 1) * pageSize),
		db
			.select({ total: count() })
			.from(drugs)
			.where(and(...whereConditions)),
	]);
	const total = totalResult[0]?.total ?? 0;

	return {
		drugs: drugsResult,
		pagination: {
			page,
			pageCount: Math.ceil(total / pageSize),
			pageSize,
			total,
		},
	};
};

type CreateDrugBody = z.infer<(typeof backendApiSchemaRoutes)["@post/inventory/drugs"]["body"]>;
type UpdateDrugBody = z.infer<(typeof backendApiSchemaRoutes)["@patch/inventory/drugs/:drugId"]["body"]>;

export const createDrugForWorkspace = async (options: CreateDrugBody & { workspaceId: string }) => {
	const { form, genericName, name, strength, unit, workspaceId } = options;

	const result = db
		.insert(drugs)
		.values({
			form,
			genericName,
			name,
			strength,
			unit,
			workspaceId,
		})
		.returning();

	const [drug] = await result;

	if (!drug) {
		throw new AppError({
			code: 500,
			message: "Failed to create drug",
		});
	}

	return drug;
};
export const updateDrug = async (options: UpdateDrugBody & { drugId: string; workspaceId: string }) => {
	const { drugId, form, genericName, name, strength, unit, workspaceId } = options;

	const [drug] = await db
		.update(drugs)
		.set({
			...(form !== undefined && { form }),
			...(genericName !== undefined && { genericName }),
			...(name !== undefined && { name }),
			...(strength !== undefined && { strength }),
			...(unit !== undefined && { unit }),
		})
		.where(and(eq(drugs.id, drugId), eq(drugs.workspaceId, workspaceId)))
		.returning();

	if (!drug) {
		throw new AppError({
			code: 404,
			message: "Drug not found",
		});
	}

	return drug;
};
export const deactivateDrug = async (options: { drugId: string; workspaceId: string }) => {
	const { drugId, workspaceId } = options;

	const [drug] = await db
		.update(drugs)
		.set({ isActive: false })
		.where(and(eq(drugs.id, drugId), eq(drugs.workspaceId, workspaceId)))
		.returning();

	if (!drug) {
		throw new AppError({
			code: 404,
			message: "Drug not found",
		});
	}

	return drug;
};

type DrugActionBody = z.infer<
	(typeof backendApiSchemaRoutes)["@post/inventory/drugs/:drugId/action"]["body"]
>;

export const handleDrugAction = async (options: {
	action: DrugActionBody["action"];
	drugId: string;
	workspaceId: string;
}) => {
	const { action, drugId, workspaceId } = options;

	const [drug] = await db
		.update(drugs)
		.set({ isActive: action === "reactivate" })
		.where(and(eq(drugs.id, drugId), eq(drugs.workspaceId, workspaceId)))
		.returning();

	if (!drug) {
		throw new AppError({
			code: 404,
			message: "Drug not found",
		});
	}

	return drug;
};
