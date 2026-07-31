import { db } from "@vitastock/db";
import { drugs } from "@vitastock/db/schema/inventory";
import type { backendApiSchemaRoutes } from "@vitastock/shared/validation/backendApiSchema";
import { and, eq, ilike, or } from "drizzle-orm";
import { z } from "zod";
import { AppError } from "@/lib/utils";

export const getDrugsForWorkspace = async (options: { search?: string; workspaceId: string }) => {
	const { search, workspaceId } = options;

	const whereConditions = [
		eq(drugs.workspaceId, workspaceId),
		...(search ?
			[
				or(
					ilike(drugs.name, `%${search}%`),
					ilike(drugs.strength, `%${search}%`),
					ilike(drugs.form, `%${search}%`)
				),
			]
		:	[]),
	];

	return db
		.select()
		.from(drugs)
		.where(and(...whereConditions))
		.orderBy(drugs.name);
};

export const createDrugForWorkspace = async (options: {
	form: string;
	name: string;
	strength: string;
	unit: string;
	workspaceId: string;
}) => {
	const { form, name, strength, unit, workspaceId } = options;

	const result = db
		.insert(drugs)
		.values({
			form,
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

export const updateDrug = async (options: {
	drugId: string;
	form?: string;
	name?: string;
	strength?: string;
	unit?: string;
	workspaceId: string;
}) => {
	const { drugId, form, name, strength, unit, workspaceId } = options;

	const [drug] = await db
		.update(drugs)
		.set({
			...(form !== undefined && { form }),
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

export const findDrugByCompositeKey = async (options: {
	form: string;
	name: string;
	strength: string;
	workspaceId: string;
}) => {
	const { form, name, strength, workspaceId } = options;

	const [drug] = await db
		.select()
		.from(drugs)
		.where(
			and(
				eq(drugs.workspaceId, workspaceId),
				eq(drugs.name, name),
				eq(drugs.strength, strength),
				eq(drugs.form, form)
			)
		)
		.limit(1);

	return drug;
};
