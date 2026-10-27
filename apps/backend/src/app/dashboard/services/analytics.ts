import { db } from "@vitastock/db";
import { users } from "@vitastock/db/schema/auth";
import { drugs, STOCK_OUT_REASONS, stockBatches, stockLogs } from "@vitastock/db/schema/inventory";
import { workspaceMemberships } from "@vitastock/db/schema/workspace";
import { ANALYTICS_EXPIRY_RISK_WINDOW_DAYS } from "@vitastock/shared/constants";
import { addDays, differenceInCalendarDays, format, parseISO, subDays } from "date-fns";
import { and, asc, desc, eq, gt, gte, inArray, isNotNull, isNull, lt, sql, type SQL } from "drizzle-orm";
import { getWorkspaceDateRange, getWorkspaceToday } from "@/app/inventory/services/utils/date";

const ISO_DATE_FORMAT = "yyyy-MM-dd";
const TOP_LIST_SIZE = 10;
const SLOW_SELLER_WINDOW_DAYS = 30;
const SLOW_SELLER_SOLD_RATIO = 0.1;

const drugColumns = {
	genericName: drugs.genericName,
	id: drugs.id,
	name: drugs.name,
	strength: drugs.strength,
	unit: drugs.unit,
};

const toNumber = (value: number | string | null) => (value === null ? 0 : Number(value));

const toNullableNumber = (value: number | string | null) => (value === null ? null : Number(value));

const sumKnownValues = (values: Array<number | null>) => {
	const knownValues = values.filter((value) => value !== null);

	if (values.length > 0 && knownValues.length === 0) {
		return null;
	}

	return knownValues.reduce((total, value) => total + value, 0);
};

const lineSales = sql`${stockLogs.quantity} * ${stockLogs.unitSellingPrice}`;
const lineCost = sql`${stockLogs.quantity} * ${stockLogs.unitCostPrice}`;
const hasBothPrices = sql`${stockLogs.unitSellingPrice} is not null and ${stockLogs.unitCostPrice} is not null`;

const isPatientSale = and(
	eq(stockLogs.logType, "stock_out"),
	eq(stockLogs.reason, STOCK_OUT_REASONS[2]),
	isNull(stockLogs.undoneAt)
);

const isLossRemoval = and(
	eq(stockLogs.logType, "stock_out"),
	inArray(stockLogs.reason, [STOCK_OUT_REASONS[0], STOCK_OUT_REASONS[1]]),
	isNull(stockLogs.undoneAt)
);

const getPeriodConditions = (options: {
	from: string;
	timezone: string;
	to: string;
	workspaceId: string;
}): SQL[] => {
	const { from, timezone, to, workspaceId } = options;
	const range = getWorkspaceDateRange({ from, timezone, to });
	const conditions = [eq(stockLogs.workspaceId, workspaceId)];

	if (range.from) {
		conditions.push(gte(stockLogs.createdAt, range.from));
	}

	if (range.toExclusive) {
		conditions.push(lt(stockLogs.createdAt, range.toExclusive));
	}

	return conditions;
};

const getPeriodTotals = async (periodConditions: SQL[]) => {
	const [totals] = await db
		.select({
			costOfSales: sql<string | null>`sum(case when ${hasBothPrices} then ${lineCost} end)`,
			pricedSales: sql<string | null>`sum(case when ${hasBothPrices} then ${lineSales} end)`,
			profit: sql<string | null>`sum(case when ${hasBothPrices} then ${lineSales} - ${lineCost} end)`,
			saleCount: sql<number>`count(distinct ${stockLogs.stockTransactionId})`.mapWith(Number),
			sales: sql<string | null>`sum(${lineSales})`,
			uncostedSaleLineCount: sql<number>`
				count(*) filter (where ${stockLogs.unitSellingPrice} is not null and ${stockLogs.unitCostPrice} is null)
			`.mapWith(Number),
			unpricedSaleLineCount:
				sql<number>`count(*) filter (where ${stockLogs.unitSellingPrice} is null)`.mapWith(Number),
		})
		.from(stockLogs)
		.where(and(...periodConditions, isPatientSale));

	const pricedSales = toNumber(totals?.pricedSales ?? null);
	const profit = toNumber(totals?.profit ?? null);

	return {
		costOfSales: toNumber(totals?.costOfSales ?? null),
		profit,
		profitPercent: pricedSales > 0 ? (profit / pricedSales) * 100 : null,
		saleCount: totals?.saleCount ?? 0,
		sales: toNumber(totals?.sales ?? null),
		uncostedSaleLineCount: totals?.uncostedSaleLineCount ?? 0,
		unpricedSaleLineCount: totals?.unpricedSaleLineCount ?? 0,
	};
};

export const getDashboardAnalytics = async (options: {
	from: string;
	timezone: string;
	to: string;
	workspaceId: string;
}) => {
	const { from, timezone, to, workspaceId } = options;
	const periodLength = differenceInCalendarDays(parseISO(to), parseISO(from)) + 1;
	const previousTo = format(subDays(parseISO(from), 1), ISO_DATE_FORMAT);
	const previousFrom = format(subDays(parseISO(from), periodLength), ISO_DATE_FORMAT);
	const today = getWorkspaceToday(timezone);
	const expiryRiskEnd = format(
		addDays(parseISO(today), ANALYTICS_EXPIRY_RISK_WINDOW_DAYS),
		ISO_DATE_FORMAT
	);
	const slowSellerStart = format(subDays(parseISO(today), SLOW_SELLER_WINDOW_DAYS - 1), ISO_DATE_FORMAT);

	const periodConditions = getPeriodConditions({ from, timezone, to, workspaceId });
	const slowSellerConditions = getPeriodConditions({
		from: slowSellerStart,
		timezone,
		to: today,
		workspaceId,
	});
	const saleDay = sql<string>`to_char(${stockLogs.createdAt} at time zone ${timezone}, 'YYYY-MM-DD')`;
	const usableBatch = and(
		eq(stockBatches.workspaceId, workspaceId),
		gt(stockBatches.quantityAvailable, 0),
		gte(stockBatches.expiryDate, today)
	);
	const batchValue = sql`${stockBatches.quantityAvailable} * ${stockBatches.costPrice}`;

	const [
		current,
		previous,
		dailyRows,
		saleTypeRows,
		paymentRows,
		sellerRows,
		slowSellerRows,
		stockValueRows,
		[uncostedBatches],
		expiryRows,
		lossRows,
		staffRows,
		[pricesMissing],
	] = await Promise.all([
		getPeriodTotals(periodConditions),
		getPeriodTotals(getPeriodConditions({ from: previousFrom, timezone, to: previousTo, workspaceId })),

		db
			.select({
				date: saleDay,
				profit: sql<
					string | null
				>`sum(case when ${hasBothPrices} then ${lineSales} - ${lineCost} end)`,
				sales: sql<string | null>`sum(${lineSales})`,
			})
			.from(stockLogs)
			.where(and(...periodConditions, isPatientSale))
			// == Repeating saleDay rebinds the timezone, which Postgres reads as a different expression
			.groupBy(sql`1`)
			.orderBy(sql`1`),

		db
			.select({ sales: sql<string | null>`sum(${lineSales})`, saleType: stockLogs.saleType })
			.from(stockLogs)
			.where(and(...periodConditions, isPatientSale))
			.groupBy(stockLogs.saleType),

		db
			.select({ paymentMethod: stockLogs.paymentMethod, sales: sql<string | null>`sum(${lineSales})` })
			.from(stockLogs)
			.where(and(...periodConditions, isPatientSale))
			.groupBy(stockLogs.paymentMethod),

		db
			.select({
				drug: drugColumns,
				quantity: sql<number>`sum(${stockLogs.quantity})`.mapWith(Number),
				sales: sql<string | null>`sum(${lineSales})`,
			})
			.from(stockLogs)
			.innerJoin(drugs, eq(stockLogs.drugId, drugs.id))
			.where(and(...periodConditions, isPatientSale))
			.groupBy(drugs.id),

		db
			.select({
				drug: drugColumns,
				onHandQuantity: sql<number>`sum(${stockBatches.quantityAvailable})`.mapWith(Number),
				stockValue: sql<string | null>`sum(${batchValue})`,
			})
			.from(stockBatches)
			.innerJoin(drugs, eq(stockBatches.drugId, drugs.id))
			.where(and(usableBatch, eq(drugs.isActive, true)))
			.groupBy(drugs.id),

		db
			.select({
				drug: drugColumns,
				quantity: sql<number>`sum(${stockBatches.quantityAvailable})`.mapWith(Number),
				value: sql<string | null>`sum(${batchValue})`,
			})
			.from(stockBatches)
			.innerJoin(drugs, eq(stockBatches.drugId, drugs.id))
			.where(and(usableBatch, isNotNull(stockBatches.costPrice)))
			.groupBy(drugs.id)
			.orderBy(desc(sql`sum(${batchValue})`)),

		db
			.select({ total: sql<number>`count(*)`.mapWith(Number) })
			.from(stockBatches)
			.where(and(usableBatch, isNull(stockBatches.costPrice))),

		db
			.select({
				drug: drugColumns,
				expiryDate: stockBatches.expiryDate,
				quantity: stockBatches.quantityAvailable,
				value: sql<string | null>`${batchValue}`,
			})
			.from(stockBatches)
			.innerJoin(drugs, eq(stockBatches.drugId, drugs.id))
			.where(
				and(
					eq(stockBatches.workspaceId, workspaceId),
					gt(stockBatches.quantityAvailable, 0),
					lt(stockBatches.expiryDate, expiryRiskEnd)
				)
			)
			.orderBy(asc(stockBatches.expiryDate)),

		db
			.select({
				createdAt: stockLogs.createdAt,
				drug: drugColumns,
				id: stockLogs.id,
				person: users.fullName,
				personRole: workspaceMemberships.role,
				quantity: stockLogs.quantity,
				reason: stockLogs.reason,
				value: sql<string | null>`${lineCost}`,
			})
			.from(stockLogs)
			.innerJoin(drugs, eq(stockLogs.drugId, drugs.id))
			.innerJoin(users, eq(stockLogs.performedByUserId, users.id))
			.leftJoin(
				workspaceMemberships,
				and(
					eq(workspaceMemberships.userId, users.id),
					eq(workspaceMemberships.workspaceId, workspaceId)
				)
			)
			.where(and(...periodConditions, isLossRemoval))
			.orderBy(desc(stockLogs.createdAt)),

		db
			.select({
				dispenseCount: sql<number>`
					count(distinct ${stockLogs.stockTransactionId}) filter (where ${isPatientSale})
				`.mapWith(Number),
				person: users.fullName,
				personRole: workspaceMemberships.role,
				removalCount: sql<number>`
					count(distinct ${stockLogs.stockTransactionId}) filter (where ${isLossRemoval})
				`.mapWith(Number),
				sales: sql<string | null>`sum(${lineSales}) filter (where ${isPatientSale})`,
				undoCount: sql<number>`
					count(distinct ${stockLogs.stockTransactionId}) filter (where ${stockLogs.undoneAt} is not null and ${stockLogs.reason} = ${STOCK_OUT_REASONS[2]})
				`.mapWith(Number),
				userId: users.id,
			})
			// == Start from the members so people with no activity this period still appear
			.from(workspaceMemberships)
			.innerJoin(users, eq(workspaceMemberships.userId, users.id))
			.leftJoin(
				stockLogs,
				and(
					eq(stockLogs.performedByUserId, users.id),
					...periodConditions,
					eq(stockLogs.logType, "stock_out")
				)
			)
			.where(
				and(
					eq(workspaceMemberships.workspaceId, workspaceId),
					isNull(workspaceMemberships.suspendedAt)
				)
			)
			.groupBy(users.id, workspaceMemberships.role)
			.orderBy(desc(sql`count(distinct ${stockLogs.stockTransactionId})`), asc(users.fullName)),

		db
			.select({ total: sql<number>`count(*)`.mapWith(Number) })
			.from(drugs)
			.where(
				and(eq(drugs.workspaceId, workspaceId), eq(drugs.isActive, true), isNull(drugs.retailPrice))
			),
	]);

	const soldLast30DaysRows = await db
		.select({
			drugId: stockLogs.drugId,
			quantity: sql<number>`sum(${stockLogs.quantity})`.mapWith(Number),
		})
		.from(stockLogs)
		.where(and(...slowSellerConditions, isPatientSale))
		.groupBy(stockLogs.drugId);
	const soldLast30DaysByDrugId = new Map(soldLast30DaysRows.map((row) => [row.drugId, row.quantity]));

	const sellers = sellerRows.map((row) => ({ ...row, sales: toNullableNumber(row.sales) }));
	const expiryItems = expiryRows.map((row) => ({
		drug: row.drug,
		expiryDate: row.expiryDate,
		isExpired: row.expiryDate < today,
		quantity: row.quantity,
		value: toNullableNumber(row.value),
	}));

	return {
		daily: dailyRows.map((row) => ({
			date: row.date,
			profit: toNumber(row.profit),
			sales: toNumber(row.sales),
		})),
		expiryRisk: {
			expiredDrugCount: new Set(
				expiryItems.filter((item) => item.isExpired).map((item) => item.drug.id)
			).size,
			expiredValue: sumKnownValues(
				expiryItems.filter((item) => item.isExpired).map((item) => item.value)
			),
			expiringDrugCount: new Set(
				expiryItems.filter((item) => !item.isExpired).map((item) => item.drug.id)
			).size,
			expiringValue: sumKnownValues(
				expiryItems.filter((item) => !item.isExpired).map((item) => item.value)
			),
			items: expiryItems,
		},
		losses: lossRows.flatMap((row) =>
			row.reason ? [{ ...row, reason: row.reason, value: toNullableNumber(row.value) }] : []
		),
		moneyInStock: {
			topDrugs: stockValueRows
				.slice(0, TOP_LIST_SIZE)
				.map((row) => ({ drug: row.drug, quantity: row.quantity, value: toNumber(row.value) })),
			total: stockValueRows.reduce((total, row) => total + toNumber(row.value), 0),
			uncostedBatchCount: uncostedBatches?.total ?? 0,
		},
		period: { from, to },
		previousPeriod: { from: previousFrom, to: previousTo },
		pricesMissingDrugCount: pricesMissing?.total ?? 0,
		salesByPaymentMethod: paymentRows.map((row) => ({
			paymentMethod: row.paymentMethod,
			sales: toNumber(row.sales),
		})),
		salesBySaleType: saleTypeRows.map((row) => ({ sales: toNumber(row.sales), saleType: row.saleType })),
		slowSellers: slowSellerRows
			.map((row) => ({
				drug: row.drug,
				onHandQuantity: row.onHandQuantity,
				soldLast30Days: soldLast30DaysByDrugId.get(row.drug.id) ?? 0,
				stockValue: toNullableNumber(row.stockValue),
			}))
			.filter((row) => row.soldLast30Days < row.onHandQuantity * SLOW_SELLER_SOLD_RATIO)
			.toSorted((first, second) => (second.stockValue ?? 0) - (first.stockValue ?? 0))
			.slice(0, TOP_LIST_SIZE),
		staffActivity: staffRows.map((row) => ({
			...row,
			sales: row.dispenseCount > 0 ? toNullableNumber(row.sales) : 0,
		})),
		topSellers: {
			byQuantity: [...sellers]
				.toSorted((first, second) => second.quantity - first.quantity)
				.slice(0, TOP_LIST_SIZE),
			bySales: sellers
				.toSorted((first, second) => (second.sales ?? 0) - (first.sales ?? 0))
				.slice(0, TOP_LIST_SIZE),
		},
		totals: { current, previous },
	};
};
