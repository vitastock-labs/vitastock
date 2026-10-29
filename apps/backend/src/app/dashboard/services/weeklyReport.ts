import { db } from "@vitastock/db";
import { users } from "@vitastock/db/schema/auth";
import { drugs, inventoryAlerts, stockBatches, stockLogs } from "@vitastock/db/schema/inventory";
import { workspaceMemberships, workspaces } from "@vitastock/db/schema/workspace";
import { WEEKLY_REPORT_EXPIRING_SOON_DAYS } from "@vitastock/shared/constants";
import { formatWholeNaira } from "@vitastock/shared/formatters";
import { addDays, format, getHours, parseISO, subDays } from "date-fns";
import {
	and,
	asc,
	count,
	countDistinct,
	eq,
	gt,
	gte,
	inArray,
	isNotNull,
	isNull,
	lte,
	sql,
} from "drizzle-orm";
import { getWorkspaceLocalTime } from "@/app/inventory/services/utils/date";
import { appLogger } from "@/lib/logger";
import { addEmailToQueue } from "@/services/queues/emailQueue";
import { getDashboardAnalytics } from "./analytics";

const ISO_DATE_FORMAT = "yyyy-MM-dd";
const SUNDAY_ISO_WEEKDAY = 7;
const EMAIL_LIST_SIZE = 5;
const ATTENTION_ITEM_COUNT = 2;

const PAYMENT_ORDER = [
	{ key: "cash", label: "Cash" },
	{ key: "transfer", label: "Transfer" },
	{ key: "pos", label: "POS" },
	{ key: "not_noted", label: "Not noted" },
] as const;

const formatDrugName = (drug: { name: string; strength: string | null }) =>
	[drug.name, drug.strength].filter(Boolean).join(" ");

const formatUnits = (quantity: number, unit: string | null) =>
	`${quantity.toLocaleString()} ${unit?.toLowerCase() ?? "units"}`;

const formatPerson = (person: string, role: string | null) =>
	role ? `${person} (${role.charAt(0).toUpperCase()}${role.slice(1)})` : person;

const getPercentChange = (current: number, previous: number) =>
	previous === 0 ? null : ((current - previous) / Math.abs(previous)) * 100;

const getGreeting = (sentAt: Date) => {
	const hour = getHours(sentAt);

	if (hour < 12) {
		return "Good morning";
	}

	return hour < 17 ? "Good afternoon" : "Good evening";
};

const getWeeklyReportRecipients = (workspaceId: string) => {
	return db
		.select({ email: users.email, fullName: users.fullName })
		.from(workspaceMemberships)
		.innerJoin(users, eq(workspaceMemberships.userId, users.id))
		.where(
			and(
				eq(workspaceMemberships.workspaceId, workspaceId),
				isNull(workspaceMemberships.suspendedAt),
				inArray(workspaceMemberships.role, ["owner", "admin"])
			)
		);
};

const getAttentionItems = async (options: {
	timezone: string;
	today: string;
	weekStart: string;
	workspaceId: string;
}) => {
	const { timezone, today, weekStart, workspaceId } = options;
	const expiringSoonEnd = format(
		addDays(parseISO(today), WEEKLY_REPORT_EXPIRING_SOON_DAYS),
		ISO_DATE_FORMAT
	);

	const lowStockConditions = and(
		eq(inventoryAlerts.workspaceId, workspaceId),
		eq(inventoryAlerts.status, "active"),
		inArray(inventoryAlerts.type, ["low_stock", "out_of_stock"])
	);
	const expiringSoonConditions = and(
		eq(stockBatches.workspaceId, workspaceId),
		gt(stockBatches.quantityAvailable, 0),
		gte(stockBatches.expiryDate, today),
		lte(stockBatches.expiryDate, expiringSoonEnd)
	);
	const createdDay = sql<string>`to_char(${stockLogs.createdAt} at time zone ${timezone}, 'YYYY-MM-DD')`;

	const [lowStockAlerts, [lowStockCount], expiringBatches, [expiringCount], undoneDispenses] =
		await Promise.all([
			db
				.select({
					drug: { name: drugs.name, strength: drugs.strength, unit: drugs.unit },
					quantityAffected: inventoryAlerts.quantityAffected,
				})
				.from(inventoryAlerts)
				.innerJoin(drugs, eq(inventoryAlerts.drugId, drugs.id))
				.where(lowStockConditions)
				.orderBy(asc(inventoryAlerts.quantityAffected))
				.limit(ATTENTION_ITEM_COUNT),

			db.select({ total: count() }).from(inventoryAlerts).where(lowStockConditions),

			db
				.select({
					drug: { name: drugs.name, strength: drugs.strength, unit: drugs.unit },
					expiryDate: stockBatches.expiryDate,
					quantity: stockBatches.quantityAvailable,
				})
				.from(stockBatches)
				.innerJoin(drugs, eq(stockBatches.drugId, drugs.id))
				.where(expiringSoonConditions)
				.orderBy(asc(stockBatches.expiryDate))
				.limit(ATTENTION_ITEM_COUNT),

			db
				.select({ total: countDistinct(stockBatches.drugId) })
				.from(stockBatches)
				.where(expiringSoonConditions),

			db
				.select({
					drug: { name: drugs.name, strength: drugs.strength, unit: drugs.unit },
					person: users.fullName,
					personRole: workspaceMemberships.role,
					quantity: sql<number>`sum(${stockLogs.quantity})`.mapWith(Number),
				})
				.from(stockLogs)
				.innerJoin(drugs, eq(stockLogs.drugId, drugs.id))
				.innerJoin(users, eq(stockLogs.undoneByUserId, users.id))
				.leftJoin(
					workspaceMemberships,
					and(
						eq(workspaceMemberships.userId, users.id),
						eq(workspaceMemberships.workspaceId, workspaceId)
					)
				)
				.where(
					and(
						eq(stockLogs.workspaceId, workspaceId),
						isNotNull(stockLogs.undoneAt),
						sql`${createdDay} between ${weekStart} and ${today}`
					)
				)
				.groupBy(stockLogs.stockTransactionId, drugs.id, users.id, workspaceMemberships.role),
		]);

	return {
		expiringSoon: {
			items: expiringBatches.map(
				(batch) =>
					`${formatDrugName(batch.drug)} — ${format(parseISO(batch.expiryDate), "MMM d, yyyy")} · ${formatUnits(batch.quantity, batch.drug.unit)}`
			),
			total: expiringCount?.total ?? 0,
		},
		lowStock: {
			items: lowStockAlerts.map((alert) =>
				alert.quantityAffected === null ?
					formatDrugName(alert.drug)
				:	`${formatDrugName(alert.drug)} — ${formatUnits(alert.quantityAffected, alert.drug.unit)} left`
			),
			total: lowStockCount?.total ?? 0,
		},
		undoneDispenses,
	};
};

const buildWeeklyReport = async (options: {
	time: string;
	timezone: string;
	today: string;
	weekStart: string;
	workspaceId: string;
	workspaceName: string;
}) => {
	const { time, timezone, today, weekStart, workspaceId, workspaceName } = options;
	const [analytics, attention] = await Promise.all([
		getDashboardAnalytics({ from: weekStart, timezone, to: today, workspaceId }),
		getAttentionItems({ timezone, today, weekStart, workspaceId }),
	]);
	const { current, previous } = analytics.totals;
	const sentAt = parseISO(`${today}T${time}`);

	const removalLines = [
		...analytics.losses.map(
			(loss) =>
				`${formatDrugName(loss.drug)} — ${formatUnits(loss.quantity, loss.drug.unit)} removed as ${loss.reason === "expired" ? "Expired" : "Damaged"} by ${formatPerson(loss.person, loss.personRole)}`
		),
		...attention.undoneDispenses.map(
			(undo) =>
				`${formatDrugName(undo.drug)} — ${formatUnits(undo.quantity, undo.drug.unit)} dispense undone by ${formatPerson(undo.person, undo.personRole)}`
		),
	];

	return {
		attention: {
			expiringSoon: attention.expiringSoon,
			lowStock: attention.lowStock,
			removals: {
				items: removalLines.slice(0, ATTENTION_ITEM_COUNT),
				removalCount: analytics.losses.length,
				undoCount: attention.undoneDispenses.length,
			},
		},
		greeting: getGreeting(sentAt),
		payments: PAYMENT_ORDER.flatMap(({ key, label }) => {
			const sales =
				analytics.salesByPaymentMethod.find(
					(payment) => (payment.paymentMethod ?? "not_noted") === key
				)?.sales ?? 0;

			return sales > 0 ? [{ label, sales }] : [];
		}),
		periodLabel: `${format(parseISO(weekStart), "MMM d")} – ${format(parseISO(today), "MMM d, yyyy")}, up to ${format(sentAt, "h:mmaaa")}`,
		slowSellers: analytics.slowSellers.slice(0, EMAIL_LIST_SIZE).map((item) => ({
			detail: `${formatUnits(item.onHandQuantity, item.drug.unit)} · ${item.soldLast30Days.toLocaleString()} sold`,
			name: formatDrugName(item.drug),
			value: item.stockValue === null ? "No cost" : formatWholeNaira(item.stockValue),
		})),
		subject: `${workspaceName} this week: ${formatWholeNaira(current.sales)} sales, ${formatWholeNaira(current.profit)} profit`,
		topSellers: analytics.topSellers.bySales.slice(0, EMAIL_LIST_SIZE).map((seller) => ({
			detail: formatUnits(seller.quantity, seller.drug.unit),
			name: formatDrugName(seller.drug),
			value: seller.sales === null ? "No price" : formatWholeNaira(seller.sales),
		})),
		totals: {
			profit: current.profit,
			profitPercent: current.profitPercent,
			saleCount: current.saleCount,
			saleCountChange: previous.saleCount === 0 ? null : current.saleCount - previous.saleCount,
			sales: current.sales,
			salesChangePercent: getPercentChange(current.sales, previous.sales),
		},
		workspaceName,
	};
};

// == Atomic claim: only one worker run can move the marker to this week, so the email goes out once
const claimWeeklyReport = async (options: { weekStart: string; workspaceId: string }) => {
	const { weekStart, workspaceId } = options;
	const [claimedWorkspace] = await db
		.update(workspaces)
		.set({ weeklyEmailLastSentWeek: weekStart })
		.where(
			and(
				eq(workspaces.id, workspaceId),
				sql`${workspaces.weeklyEmailLastSentWeek} is distinct from ${weekStart}`
			)
		)
		.returning({ id: workspaces.id });

	return claimedWorkspace !== undefined;
};

export const sendWeeklyOwnerReport = async (options: {
	now: Date;
	workspace: { id: string; name: string; timezone: string; weeklyEmailLastSentWeek: string | null };
}) => {
	const { now, workspace } = options;
	const localTime = getWorkspaceLocalTime(now, workspace.timezone);
	const weekStart = format(subDays(parseISO(localTime.date), localTime.isoWeekday - 1), ISO_DATE_FORMAT);

	const isClaimed = await claimWeeklyReport({ weekStart, workspaceId: workspace.id });

	if (!isClaimed) return;

	try {
		const [report, recipients] = await Promise.all([
			buildWeeklyReport({
				time: localTime.time,
				timezone: workspace.timezone,
				today: localTime.date,
				weekStart,
				workspaceId: workspace.id,
				workspaceName: workspace.name,
			}),
			getWeeklyReportRecipients(workspace.id),
		]);

		await Promise.all(
			recipients.map((recipient) =>
				addEmailToQueue({
					data: {
						...report,
						name: recipient.fullName.split(" ", 1)[0] ?? recipient.fullName,
						to: { email: recipient.email, name: recipient.fullName },
					},
					jobId: `weekly-owner-report:${workspace.id}:${weekStart}:${recipient.email.toLowerCase()}`,
					type: "weeklyOwnerReport",
				})
			)
		);
	} catch (error) {
		// == Release the claim so the next hourly run retries this week instead of silently skipping it
		await db
			.update(workspaces)
			.set({ weeklyEmailLastSentWeek: workspace.weeklyEmailLastSentWeek })
			.where(eq(workspaces.id, workspace.id));

		throw error;
	}
};

export const queueDueWeeklyOwnerReports = async (now = new Date()) => {
	const workspaceRows = await db
		.select({
			id: workspaces.id,
			name: workspaces.name,
			timezone: workspaces.timezone,
			weeklyEmailLastSentWeek: workspaces.weeklyEmailLastSentWeek,
			weeklyEmailTime: workspaces.weeklyEmailTime,
		})
		.from(workspaces)
		.where(eq(workspaces.weeklyEmailEnabled, true));

	const dueWorkspaces = workspaceRows.filter((workspace) => {
		const localTime = getWorkspaceLocalTime(now, workspace.timezone);

		return (
			localTime.isoWeekday === SUNDAY_ISO_WEEKDAY
			&& localTime.time >= workspace.weeklyEmailTime.slice(0, 5)
		);
	});

	const results = await Promise.allSettled(
		dueWorkspaces.map((workspace) => sendWeeklyOwnerReport({ now, workspace }))
	);

	for (const [index, result] of results.entries()) {
		if (result.status === "rejected") {
			appLogger
				.child({ workspaceId: dueWorkspaces[index]?.id })
				.error({ err: result.reason }, "Failed to queue the weekly owner report");
		}
	}
};
