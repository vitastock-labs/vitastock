import { db } from "@vitastock/db";
import { stockBatches } from "@vitastock/db/schema/inventory";
import type { backendApiSchemaRoutes } from "@vitastock/shared/validation/backendApiSchema";
import { and, asc, eq, gt, gte, lt } from "drizzle-orm";
import type { z } from "zod";
import { getWorkspaceToday } from "../utils/date";

type BatchAvailability = z.infer<
	(typeof backendApiSchemaRoutes)["@get/inventory/drugs/:drugId/batches"]["query"]
>["availability"];

export const getWorkspaceDrugBatches = async (options: {
	availability: BatchAvailability;
	drugId: string;
	timezone: string;
	workspaceId: string;
}) => {
	const { availability, drugId, timezone, workspaceId } = options;
	const today = getWorkspaceToday(timezone);
	const expiryCondition =
		availability === "expired" ?
			lt(stockBatches.expiryDate, today)
		:	gte(stockBatches.expiryDate, today);

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
