import { createHash } from "node:crypto";
import { db } from "@vitastock/db";
import { STOCK_TRANSACTION_OPERATIONS, stockTransactions } from "@vitastock/db/schema/inventory";
import { and, eq } from "drizzle-orm";
import { AppError } from "@/lib/utils";

type InventoryTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export const createStockTransactionRequestHash = (payload: unknown) => {
	return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
};

export const claimStockTransaction = async (options: {
	idempotencyKey: string;
	operation: (typeof STOCK_TRANSACTION_OPERATIONS)[number];
	requestHash: string;
	tx: InventoryTransaction;
	userId: string;
	workspaceId: string;
}) => {
	const { idempotencyKey, operation, requestHash, tx, userId, workspaceId } = options;

	const [createdTransaction] = await tx
		.insert(stockTransactions)
		.values({
			idempotencyKey,
			operation,
			performedByUserId: userId,
			requestHash,
			workspaceId,
		})
		.onConflictDoNothing({
			target: [stockTransactions.workspaceId, stockTransactions.idempotencyKey],
		})
		.returning({ id: stockTransactions.id });

	if (createdTransaction) {
		return { id: createdTransaction.id, isReplay: false } as const;
	}

	const [existingTransaction] = await tx
		.select({
			id: stockTransactions.id,
			operation: stockTransactions.operation,
			requestHash: stockTransactions.requestHash,
		})
		.from(stockTransactions)
		.where(
			and(
				eq(stockTransactions.workspaceId, workspaceId),
				eq(stockTransactions.idempotencyKey, idempotencyKey)
			)
		)
		.limit(1);

	if (!existingTransaction) {
		throw new AppError({
			code: 500,
			message: "Failed to resolve the existing stock transaction",
		});
	}

	if (existingTransaction.operation !== operation || existingTransaction.requestHash !== requestHash) {
		throw new AppError({
			code: 409,
			message: "This idempotency key has already been used for another request",
		});
	}

	return { id: existingTransaction.id, isReplay: true } as const;
};
