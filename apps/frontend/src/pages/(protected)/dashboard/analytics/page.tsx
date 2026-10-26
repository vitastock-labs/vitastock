"use client";

import { useQuery } from "@tanstack/react-query";
import { ANALYTICS_EXPIRY_RISK_WINDOW_DAYS } from "@vitastock/shared/constants";
import { createSearchParamsString } from "@zayne-labs/toolkit-core";
import { useConstant } from "@zayne-labs/toolkit-react";
import { format, isSameMonth, parseISO, startOfMonth, startOfWeek, subDays } from "date-fns";
import { parseAsString, parseAsStringLiteral, useQueryState, useQueryStates } from "nuqs";
import { useEffect } from "react";
import { Area, AreaChart, CartesianGrid, Pie, PieChart, ReferenceDot, XAxis, YAxis } from "recharts";
import { For, ForWithWrapper } from "@/components/common/for";
import { IconBox } from "@/components/common/IconBox";
import { NavLinkEphemeral } from "@/components/common/NavLink";
import { Show } from "@/components/common/show";
import { Switch } from "@/components/common/switch";
import { Badge } from "@/components/ui";
import { Button } from "@/components/ui/button";
import * as Chart from "@/components/ui/chart";
import {
	createDataTableColumnHelper,
	DataTableColumnHeader,
	useDataTable,
} from "@/components/ui/data-table";
import { DateTimePicker } from "@/components/ui/datetime-picker";
import { posthog } from "@/lib/posthog";
import {
	dashboardAnalyticsQuery,
	sessionQuery,
	type DashboardAnalyticsQueryResultType,
} from "@/lib/react-query/queryOptions";
import { cnJoin } from "@/lib/utils/cn";
import {
	formatCalendarDateInTimezone,
	formatDate,
	formatDrugLabel,
	formatEnumLabel,
	formatNaira,
	formatNairaCompact,
} from "@/lib/utils/formatters";
import { DashboardDataTable } from "../-components/DashboardDataTableShared";
import { EmptyState } from "../-components/EmptyState";
import { Main } from "../-components/Main";

function AnalyticsPage() {
	const sessionQueryResult = useQuery(sessionQuery());
	const session = sessionQueryResult.data;
	const isManager = session?.user.role === "owner" || session?.user.role === "admin";

	return (
		<Main className="gap-6">
			<header className="flex flex-col gap-1.5">
				<h1 className="text-[24px] font-extrabold tracking-tight text-black md:text-[30px]">
					Analytics
				</h1>
				<p className="text-[15px] font-medium text-vitastock-body-color">
					How {session?.workspace.name ?? "your pharmacy"} is doing. Visible to Owner and Admin only.
				</p>
			</header>

			<Switch.Root>
				<Switch.Match when={session && !isManager}>
					<EmptyState
						icon="lucide:shield"
						title="Analytics is for the Owner and Admins"
						description="Ask your pharmacy's Owner if you need to see sales and profit."
					/>
				</Switch.Match>

				<Switch.Match when={isManager}>
					{session && <AnalyticsContent timezone={session.workspace.timezone} />}
				</Switch.Match>
			</Switch.Root>
		</Main>
	);
}
export default AnalyticsPage;

const ANALYTICS_PERIODS = ["today", "yesterday", "week", "month", "custom"] as const;

type AnalyticsPeriod = (typeof ANALYTICS_PERIODS)[number];

const ANALYTICS_PERIOD_LABELS = {
	custom: "Pick dates",
	month: "This month",
	today: "Today",
	week: "This week",
	yesterday: "Yesterday",
} satisfies Record<AnalyticsPeriod, string>;

const ISO_DATE_FORMAT = "yyyy-MM-dd";

const getPresetRange = (period: Exclude<AnalyticsPeriod, "custom">, today: string) => {
	const todayDate = parseISO(today);

	const range = {
		month: { from: format(startOfMonth(todayDate), ISO_DATE_FORMAT), to: today },
		today: { from: today, to: today },
		week: { from: format(startOfWeek(todayDate, { weekStartsOn: 1 }), ISO_DATE_FORMAT), to: today },
		yesterday: {
			from: format(subDays(todayDate, 1), ISO_DATE_FORMAT),
			to: format(subDays(todayDate, 1), ISO_DATE_FORMAT),
		},
	};

	return range[period];
};

const formatRangeLabel = (range: { from: string; to: string }) => {
	if (range.from === range.to) {
		return format(parseISO(range.from), "MMM d, yyyy");
	}

	return `${format(parseISO(range.from), "MMM d")} – ${format(parseISO(range.to), "MMM d, yyyy")}`;
};

const formatShortRangeLabel = (range: { from: string; to: string }) => {
	const from = parseISO(range.from);
	const to = parseISO(range.to);

	if (range.from === range.to) {
		return format(from, "MMM d");
	}

	if (isSameMonth(from, to)) {
		return `${format(from, "MMM d")}–${format(to, "d")}`;
	}

	return `${format(from, "MMM d")} – ${format(to, "MMM d")}`;
};

const getTimezoneLabel = (timezone: string) =>
	`${(timezone.split("/").at(-1) ?? timezone).replaceAll("_", " ")} time`;

function AnalyticsContent(props: { timezone: string }) {
	const { timezone } = props;

	const [period, setPeriod] = useQueryState(
		"period",
		parseAsStringLiteral(ANALYTICS_PERIODS).withDefault("today")
	);
	const [customRange, setCustomRange] = useQueryStates({ from: parseAsString, to: parseAsString });

	useEffect(() => {
		posthog?.capture("analytics_viewed", { period });
	}, [period]);

	const today = useConstant(() => formatCalendarDateInTimezone(new Date(), timezone));
	const range = (() => {
		if (period !== "custom") {
			return getPresetRange(period, today);
		}

		if (customRange.from && customRange.to && customRange.from <= customRange.to) {
			return { from: customRange.from, to: customRange.to };
		}

		return null;
	})();

	const analyticsQueryResult = useQuery({
		...dashboardAnalyticsQuery(range ?? { from: today, to: today }),
		enabled: range !== null,
	});
	const analytics = analyticsQueryResult.data;

	return (
		<>
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Period">
					<For
						each={ANALYTICS_PERIODS}
						renderItem={(option) => (
							<Button
								key={option}
								unstyled={true}
								role="radio"
								aria-checked={period === option}
								className={cnJoin(
									"h-9 rounded-full border px-4 text-[13px] font-semibold",
									period === option ?
										"border-vitastock-primary-main bg-vitastock-primary-main text-white"
									:	"border-shadcn-border bg-white text-shadcn-foreground hover:bg-shadcn-muted"
								)}
								onClick={() => void setPeriod(option)}
							>
								{ANALYTICS_PERIOD_LABELS[option]}
							</Button>
						)}
					/>
				</div>

				<Show.Root when={range}>
					<p className="text-[13px] font-medium text-vitastock-body-color">
						{range && formatRangeLabel(range)} · {getTimezoneLabel(timezone)}
					</p>
				</Show.Root>
			</div>

			<Show.Root when={period === "custom"}>
				<div className="flex flex-wrap items-center gap-2">
					<DateTimePicker
						variant="date"
						dateString={customRange.from ?? ""}
						placeholder="From"
						datePickerProps={{ disabled: [{ after: parseISO(customRange.to ?? today) }] }}
						dateFormats={{ onChangeDate: ISO_DATE_FORMAT, visibleDate: "dd MMM yyyy" }}
						className="h-10 w-40 rounded-lg border border-shadcn-border bg-white px-3 text-[13px]"
						onDateStringChange={(value) => void setCustomRange({ from: value ?? null })}
					/>
					<DateTimePicker
						variant="date"
						dateString={customRange.to ?? ""}
						placeholder="To"
						datePickerProps={{
							disabled: [
								...(customRange.from ? [{ before: parseISO(customRange.from) }] : []),
								{ after: parseISO(today) },
							],
						}}
						dateFormats={{ onChangeDate: ISO_DATE_FORMAT, visibleDate: "dd MMM yyyy" }}
						className="h-10 w-40 rounded-lg border border-shadcn-border bg-white px-3 text-[13px]"
						onDateStringChange={(value) => void setCustomRange({ to: value ?? null })}
					/>
				</div>
			</Show.Root>

			<Switch.Root>
				<Switch.Match when={range === null}>
					<p
						className="rounded-xl bg-white p-6 text-[14px] text-vitastock-body-color ring-1
							ring-shadcn-border/60"
					>
						Pick a start and end date to see that period.
					</p>
				</Switch.Match>

				<Switch.Match when={analyticsQueryResult.isError}>
					<p
						className="rounded-xl bg-white p-6 text-[14px] text-shadcn-destructive ring-1
							ring-shadcn-border/60"
					>
						Failed to load analytics. Please try again.
					</p>
				</Switch.Match>

				<Switch.Match when={analytics === undefined}>
					<p
						role="status"
						className="rounded-xl bg-white p-6 text-[14px] text-vitastock-body-color ring-1
							ring-shadcn-border/60"
					>
						Loading analytics...
					</p>
				</Switch.Match>

				<Switch.Default>
					{analytics && (
						<AnalyticsSections analytics={analytics} periodLabel={ANALYTICS_PERIOD_LABELS[period]} />
					)}
				</Switch.Default>
			</Switch.Root>
		</>
	);
}

type Analytics = DashboardAnalyticsQueryResultType;

function AnalyticsSections(props: { analytics: Analytics; periodLabel: string }) {
	const { analytics, periodLabel } = props;
	const hasNoPricedSales = analytics.totals.current.sales === 0 && analytics.totals.previous.sales === 0;
	const isSingleDay = analytics.period.from === analytics.period.to;

	return (
		<div className="flex flex-col gap-6">
			<PricesMissingBanner analytics={analytics} periodLabel={periodLabel} />

			<Switch.Root>
				<Switch.Match when={hasNoPricedSales && analytics.pricesMissingDrugCount > 0}>
					<EmptyState
						icon="tabler:currency-naira"
						title="Profit appears once prices are added"
						description="Sales are counted from the prices saved when you dispense. Add selling and cost prices to start seeing sales and profit here."
						action={
							<NavLinkEphemeral to="/dashboard/prices">
								<Button>Go to Price List</Button>
							</NavLinkEphemeral>
						}
					/>
				</Switch.Match>

				<Switch.Default>
					<MoneySummary analytics={analytics} />
				</Switch.Default>
			</Switch.Root>

			<Show.Root when={!isSingleDay && !hasNoPricedSales}>
				<SalesByDayChart daily={analytics.daily} />
			</Show.Root>

			<div className="grid gap-6 lg:grid-cols-2">
				<SalesSplitCard
					title="Retail vs Wholesale"
					description="Retail = to a patient · Wholesale = to a business"
					centerLabel="Retail"
					centerKey="retail"
					slices={analytics.salesBySaleType.map((item) => ({
						key: item.saleType,
						sales: item.sales,
					}))}
					labels={{ retail: "Retail", wholesale: "Wholesale" }}
				/>
				<SalesSplitCard
					title="How customers paid"
					description="From the Cash / Transfer / POS buttons"
					centerLabel="Payment noted"
					centerKey="noted"
					slices={analytics.salesByPaymentMethod.map((item) => ({
						key: item.paymentMethod ?? "not_noted",
						sales: item.sales,
					}))}
					labels={{ cash: "Cash", not_noted: "Not noted", pos: "POS", transfer: "Transfer" }}
				/>
			</div>

			<div className="grid gap-6 lg:grid-cols-2">
				<TopSellersCard topSellers={analytics.topSellers} />
				<SlowSellersCard slowSellers={analytics.slowSellers} />
			</div>

			<div className="grid gap-6 lg:grid-cols-2">
				<MoneyInStockCard moneyInStock={analytics.moneyInStock} />
				<ExpiryRiskCard expiryRisk={analytics.expiryRisk} />
			</div>

			<LossesCard losses={analytics.losses} periodLabel={periodLabel} />
			<StaffActivityCard staffActivity={analytics.staffActivity} periodLabel={periodLabel} />
		</div>
	);
}

function AnalyticsCard(props: {
	action?: React.ReactNode;
	children: React.ReactNode;
	description?: string;
	title: string;
}) {
	const { action, children, description, title } = props;

	return (
		<article className="flex min-w-0 flex-col gap-4 rounded-xl bg-white p-5 ring-1 ring-shadcn-border/60">
			<header className="flex flex-wrap items-start justify-between gap-3">
				<div className="flex flex-col gap-0.5">
					<h2 className="text-[15px] font-bold text-black">{title}</h2>
					<Show.Root when={description}>
						<p className="text-[12px] text-vitastock-body-color">{description}</p>
					</Show.Root>
				</div>
				{action}
			</header>
			{children}
		</article>
	);
}

function PricesMissingBanner(props: { analytics: Analytics; periodLabel: string }) {
	const { analytics, periodLabel } = props;
	const { uncostedSaleLineCount, unpricedSaleLineCount } = analytics.totals.current;

	if (unpricedSaleLineCount === 0 && uncostedSaleLineCount === 0) {
		return null;
	}

	return (
		<aside
			className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4
				py-2.5 text-[13px] font-medium text-amber-800"
		>
			<IconBox icon="lucide:triangle-alert" className="size-4 shrink-0" />
			<span>
				<Show.Root when={unpricedSaleLineCount > 0}>
					{unpricedSaleLineCount} sales {periodLabel.toLowerCase()} had no price, so they are not in
					these totals.{" "}
				</Show.Root>
				<Show.Root when={uncostedSaleLineCount > 0}>
					{uncostedSaleLineCount} sales had no cost price, so they are in sales but not in profit.
				</Show.Root>
			</span>
			<NavLinkEphemeral
				to={{ pathname: "/dashboard/prices", search: createSearchParamsString({ prices: "missing" }) }}
				className="font-bold text-vitastock-primary-main hover:underline"
			>
				Add prices →
			</NavLinkEphemeral>
		</aside>
	);
}

const getPercentChange = (current: number, previous: number) => {
	if (previous === 0) {
		return null;
	}

	return ((current - previous) / Math.abs(previous)) * 100;
};

function ChangeLabel(props: { current: number; note?: string; previous: number; previousLabel: string }) {
	const { current, note, previous, previousLabel } = props;
	const change = getPercentChange(current, previous);

	if (change === null) {
		return (
			<p className="text-[12px] text-vitastock-body-color">
				{note && `${note} · `}No sales in {previousLabel}
			</p>
		);
	}

	return (
		<p
			className={cnJoin("text-[12px] font-semibold", change >= 0 ? "text-emerald-700" : "text-red-700")}
		>
			{note && `${note} · `}
			{change >= 0 ? "▲" : "▼"} {Math.abs(change).toFixed(0)}%
			<Show.Root when={!note}>
				<span className="font-normal"> vs {previousLabel}</span>
			</Show.Root>
		</p>
	);
}

function MoneySummary(props: { analytics: Analytics }) {
	const { analytics } = props;
	const { current, previous } = analytics.totals;
	const previousLabel = formatShortRangeLabel(analytics.previousPeriod);

	const cards = [
		{
			current: current.sales,
			label: "Sales",
			previous: previous.sales,
			value: formatNaira(current.sales),
		},
		{
			current: current.costOfSales,
			label: "Cost of Drugs Sold",
			previous: previous.costOfSales,
			value: formatNaira(current.costOfSales),
		},
		{
			current: current.profit,
			label: "Profit on Drugs Sold",
			note:
				current.profitPercent === null ? undefined : `${current.profitPercent.toFixed(1)}% of sales`,
			previous: previous.profit,
			value: formatNaira(current.profit),
		},
		{
			current: current.saleCount,
			label: "Number of Sales",
			previous: previous.saleCount,
			value: current.saleCount.toLocaleString(),
		},
	];

	return (
		<ForWithWrapper
			as="ul"
			aria-label="Money summary"
			className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
			each={cards}
			renderItem={(card) => (
				<li
					key={card.label}
					className="flex flex-col gap-1.5 rounded-xl bg-white p-5 ring-1 ring-shadcn-border/60"
				>
					<p className="text-[12px] font-medium text-vitastock-body-color">{card.label}</p>
					<p className="text-[24px] font-extrabold tracking-tight text-black">{card.value}</p>
					<ChangeLabel
						current={card.current}
						note={card.note}
						previous={card.previous}
						previousLabel={previousLabel}
					/>
				</li>
			)}
		/>
	);
}

const salesByDayChartConfig = {
	profit: { color: "var(--color-emerald-600)", label: "Profit" },
	sales: { color: "var(--color-vitastock-primary-main)", label: "Sales" },
} satisfies Chart.ChartConfig;

function SalesByDayChart(props: { daily: Analytics["daily"] }) {
	const { daily } = props;
	const bestDay = daily.reduce<Analytics["daily"][number] | null>(
		(best, day) => (best === null || day.sales > best.sales ? day : best),
		null
	);
	const lastDay = daily.at(-1);

	return (
		<AnalyticsCard
			title="Sales and profit by day"
			action={
				<ForWithWrapper
					as="ul"
					className="flex items-center gap-4 text-[12px] text-vitastock-body-color"
					each={["sales", "profit"] as const}
					renderItem={(key) => (
						<li key={key} className="flex items-center gap-1.5">
							<span
								className="h-0.5 w-3.5 rounded-full"
								style={{ backgroundColor: salesByDayChartConfig[key].color }}
							/>
							{salesByDayChartConfig[key].label}
						</li>
					)}
				/>
			}
		>
			<Chart.Container config={salesByDayChartConfig} className="aspect-auto h-64 w-full">
				<AreaChart data={daily} margin={{ left: 0, right: 12, top: 24 }}>
					<CartesianGrid vertical={false} />
					<XAxis
						dataKey="date"
						tickLine={false}
						axisLine={false}
						minTickGap={24}
						tickFormatter={(value: string) => format(parseISO(value), "MMM d")}
					/>
					<YAxis
						tickLine={false}
						axisLine={false}
						width={56}
						tickFormatter={(value: number) => formatNairaCompact(value)}
					/>
					<Chart.Tooltip content={<Chart.TooltipContent />} />
					<Area
						dataKey="sales"
						type="monotone"
						stroke="var(--color-sales)"
						strokeWidth={2}
						fill="var(--color-sales)"
						fillOpacity={0.08}
					/>
					<Area
						dataKey="profit"
						type="monotone"
						stroke="var(--color-profit)"
						strokeWidth={2}
						fill="var(--color-profit)"
						fillOpacity={0.08}
					/>
					{bestDay && bestDay.sales > 0 && (
						<ReferenceDot
							x={bestDay.date}
							y={bestDay.sales}
							r={4}
							fill="white"
							stroke="var(--color-sales)"
							strokeWidth={2}
							label={{
								fill: "var(--color-sales)",
								fontSize: 11,
								fontWeight: 600,
								position: "top",
								value: `Best day: ${format(parseISO(bestDay.date), "MMM d")} · ${formatNaira(bestDay.sales)}`,
							}}
						/>
					)}
					{lastDay && (
						<ReferenceDot
							x={lastDay.date}
							y={lastDay.sales}
							r={3.5}
							fill="var(--color-sales)"
							stroke="white"
						/>
					)}
					{lastDay && (
						<ReferenceDot
							x={lastDay.date}
							y={lastDay.profit}
							r={3.5}
							fill="var(--color-profit)"
							stroke="white"
						/>
					)}
				</AreaChart>
			</Chart.Container>
		</AnalyticsCard>
	);
}

const SPLIT_COLORS = [
	"var(--color-vitastock-primary-main)",
	"var(--color-blue-400)",
	"var(--color-blue-200)",
	"var(--color-slate-300)",
];

function SalesSplitCard(props: {
	centerKey: string;
	centerLabel: string;
	description: string;
	labels: Record<string, string>;
	slices: Array<{ key: string; sales: number }>;
	title: string;
}) {
	const { centerKey, centerLabel, description, labels, slices, title } = props;
	const total = slices.reduce((sum, slice) => sum + slice.sales, 0);
	const centerValue =
		centerKey === "noted" ?
			slices.filter((slice) => slice.key !== "not_noted").reduce((sum, slice) => sum + slice.sales, 0)
		:	(slices.find((slice) => slice.key === centerKey)?.sales ?? 0);
	const orderedSlices = Object.keys(labels)
		.map((key) => ({ key, sales: slices.find((slice) => slice.key === key)?.sales ?? 0 }))
		.filter((slice) => slice.sales > 0);
	const chartConfig = Object.fromEntries(
		orderedSlices.map((slice, index) => [
			slice.key,
			{ color: SPLIT_COLORS[index], label: labels[slice.key] },
		])
	) satisfies Chart.ChartConfig;

	return (
		<AnalyticsCard title={title} description={description}>
			<Switch.Root>
				<Switch.Match when={total === 0}>
					<p className="text-[13px] text-vitastock-body-color">No priced sales in this period.</p>
				</Switch.Match>

				<Switch.Default>
					<div className="flex flex-wrap items-center gap-6">
						<div className="relative size-32 shrink-0">
							<Chart.Container config={chartConfig} className="aspect-square size-32">
								<PieChart>
									<Pie
										data={orderedSlices.map((slice, index) => ({
											...slice,
											fill: SPLIT_COLORS[index],
										}))}
										dataKey="sales"
										nameKey="key"
										innerRadius={42}
										outerRadius={62}
										strokeWidth={2}
									/>
								</PieChart>
							</Chart.Container>
							<div
								className="pointer-events-none absolute inset-0 grid place-items-center
									text-center"
							>
								<p className="flex flex-col">
									<span className="text-[18px] font-extrabold text-black">
										{Math.round((centerValue / total) * 100)}%
									</span>
									<span className="text-[10px] text-vitastock-body-color">{centerLabel}</span>
								</p>
							</div>
						</div>

						<ForWithWrapper
							as="ul"
							className="flex min-w-40 flex-1 flex-col gap-2"
							each={orderedSlices}
							renderItem={(slice, index) => (
								<li key={slice.key} className="flex items-center gap-2 text-[13px]">
									<span
										className="size-2.5 shrink-0 rounded-full"
										style={{ backgroundColor: SPLIT_COLORS[index] }}
									/>
									<span className="flex-1 text-shadcn-foreground">{labels[slice.key]}</span>
									<span className="font-semibold text-black">{formatNaira(slice.sales)}</span>
									<span className="w-9 text-right text-vitastock-body-color">
										{Math.round((slice.sales / total) * 100)}%
									</span>
								</li>
							)}
						/>
					</div>
				</Switch.Default>
			</Switch.Root>
		</AnalyticsCard>
	);
}

const TOP_SELLER_MODES = ["money", "quantity"] as const;
const DISPLAYED_LIST_SIZE = 5;

const getUnitLabel = (unit: string | null) => unit?.toLowerCase() ?? "units";

const getSellerValueLabel = (
	seller: Analytics["topSellers"]["bySales"][number],
	mode: (typeof TOP_SELLER_MODES)[number]
) => {
	if (mode === "quantity") {
		return seller.quantity.toLocaleString();
	}

	return seller.sales === null ? "No price" : formatNaira(seller.sales);
};

function TopSellersCard(props: { topSellers: Analytics["topSellers"] }) {
	const { topSellers } = props;

	const [mode, setMode] = useQueryState(
		"topBy",
		parseAsStringLiteral(TOP_SELLER_MODES).withDefault("money")
	);
	const sellers = (mode === "money" ? topSellers.bySales : topSellers.byQuantity).slice(
		0,
		DISPLAYED_LIST_SIZE
	);
	const highestValue = Math.max(
		...sellers.map((seller) => (mode === "money" ? (seller.sales ?? 0) : seller.quantity)),
		1
	);

	return (
		<AnalyticsCard
			title="Top sellers"
			description={mode === "money" ? "Ranked by money from sales" : "Ranked by quantity sold"}
			action={
				<div
					className="flex rounded-lg bg-shadcn-muted p-0.5"
					role="radiogroup"
					aria-label="Rank top sellers by"
				>
					<For
						each={TOP_SELLER_MODES}
						renderItem={(option) => (
							<Button
								key={option}
								unstyled={true}
								role="radio"
								aria-checked={mode === option}
								className={cnJoin(
									"h-7 rounded-md px-3 text-[12px] font-semibold",
									mode === option ?
										"bg-white text-shadcn-foreground shadow-sm"
									:	"text-vitastock-body-color"
								)}
								onClick={() => void setMode(option)}
							>
								{option === "money" ? "By Money" : "By Quantity"}
							</Button>
						)}
					/>
				</div>
			}
		>
			<Switch.Root>
				<Switch.Match when={sellers.length === 0}>
					<p className="text-[13px] text-vitastock-body-color">No sales in this period.</p>
				</Switch.Match>

				<Switch.Default>
					<ForWithWrapper
						as="ol"
						className="flex flex-col gap-3"
						each={sellers}
						renderItem={(seller, index) => (
							<li key={seller.drug.id} className="flex flex-col gap-1.5">
								<div className="flex items-start gap-3">
									<span className="w-4 shrink-0 text-[13px] font-bold text-black">
										{index + 1}
									</span>
									<div className="min-w-0 flex-1">
										<p className="truncate text-[13px] font-semibold text-black">
											{formatDrugLabel(seller.drug)}
										</p>
										<p className="text-[11px] text-vitastock-body-color">
											{seller.quantity.toLocaleString()} {getUnitLabel(seller.drug.unit)} sold
										</p>
									</div>
									<span className="shrink-0 text-[13px] font-bold text-black">
										{getSellerValueLabel(seller, mode)}
									</span>
								</div>
								<div className="ml-7 h-1.5 rounded-full bg-shadcn-muted">
									<div
										className="h-full rounded-full bg-vitastock-primary-main"
										style={{
											width: `${((mode === "money" ? (seller.sales ?? 0) : seller.quantity) / highestValue) * 100}%`,
										}}
									/>
								</div>
							</li>
						)}
					/>
				</Switch.Default>
			</Switch.Root>
		</AnalyticsCard>
	);
}

function SlowSellersCard(props: { slowSellers: Analytics["slowSellers"] }) {
	const { slowSellers } = props;

	return (
		<AnalyticsCard
			title="Slow sellers"
			description="Little or no sales in the last 30 days · most money stuck first"
		>
			<Switch.Root>
				<Switch.Match when={slowSellers.length === 0}>
					<p className="text-[13px] text-vitastock-body-color">Everything in stock is selling.</p>
				</Switch.Match>

				<Switch.Default>
					<ForWithWrapper
						as="ul"
						className="flex flex-col divide-y divide-shadcn-border/70"
						each={slowSellers.slice(0, DISPLAYED_LIST_SIZE)}
						renderItem={(item) => (
							<li
								key={item.drug.id}
								className="flex items-start justify-between gap-3 py-2.5 first:pt-0"
							>
								<div className="min-w-0">
									<p className="truncate text-[13px] font-semibold text-black">
										{formatDrugLabel(item.drug)}
									</p>
									<p className="text-[11px] text-vitastock-body-color">
										{item.onHandQuantity.toLocaleString()} {getUnitLabel(item.drug.unit)} in
										stock · {item.soldLast30Days.toLocaleString()} sold
									</p>
								</div>
								<p className="shrink-0 text-right">
									<span className="block text-[13px] font-bold text-black">
										{item.stockValue === null ? "No cost" : formatNaira(item.stockValue)}
									</span>
									<span className="text-[11px] text-vitastock-body-color">tied up</span>
								</p>
							</li>
						)}
					/>
				</Switch.Default>
			</Switch.Root>
		</AnalyticsCard>
	);
}

function MoneyInStockCard(props: { moneyInStock: Analytics["moneyInStock"] }) {
	const { moneyInStock } = props;

	return (
		<AnalyticsCard title="Money in stock" description="Value of all unexpired stock at cost price">
			<div className="flex flex-col gap-1">
				<p className="text-[28px] font-extrabold tracking-tight text-black">
					{formatNaira(moneyInStock.total)}
				</p>
				<Show.Root when={moneyInStock.uncostedBatchCount > 0}>
					<p className="text-[12px] font-medium text-amber-700">
						{moneyInStock.uncostedBatchCount}{" "}
						{moneyInStock.uncostedBatchCount === 1 ? "batch has" : "batches have"} no cost price and{" "}
						{moneyInStock.uncostedBatchCount === 1 ? "is" : "are"} not counted
					</p>
				</Show.Root>
			</div>

			<Show.Root when={moneyInStock.topDrugs.length > 0}>
				<p className="text-[12px] font-semibold text-vitastock-body-color">
					Drugs holding the most money
				</p>
				<ForWithWrapper
					as="ul"
					className="flex flex-col divide-y divide-shadcn-border/70"
					each={moneyInStock.topDrugs.slice(0, DISPLAYED_LIST_SIZE)}
					renderItem={(item) => (
						<li
							key={item.drug.id}
							className="flex items-start justify-between gap-3 py-2.5 first:pt-0"
						>
							<div className="min-w-0">
								<p className="truncate text-[13px] font-semibold text-black">
									{formatDrugLabel(item.drug)}
								</p>
								<p className="text-[11px] text-vitastock-body-color">
									{item.quantity.toLocaleString()} {getUnitLabel(item.drug.unit)} in stock
								</p>
							</div>
							<span className="shrink-0 text-[13px] font-bold text-black">
								{formatNaira(item.value)}
							</span>
						</li>
					)}
				/>
			</Show.Root>
		</AnalyticsCard>
	);
}

function ExpiryRiskCard(props: { expiryRisk: Analytics["expiryRisk"] }) {
	const { expiryRisk } = props;

	return (
		<AnalyticsCard title="Expiry risk" description="Money at risk from expiry, at cost price">
			<div className="grid grid-cols-2 gap-3">
				<div className="flex flex-col gap-0.5 rounded-lg bg-amber-50 p-3">
					<p className="text-[11px] font-semibold text-amber-800">
						Expiring in {ANALYTICS_EXPIRY_RISK_WINDOW_DAYS} days
					</p>
					<p className="text-[18px] font-extrabold text-amber-900">
						{expiryRisk.expiringValue === null ? "No cost" : formatNaira(expiryRisk.expiringValue)}
					</p>
					<p className="text-[11px] text-amber-800">
						{expiryRisk.expiringDrugCount} {expiryRisk.expiringDrugCount === 1 ? "drug" : "drugs"}
					</p>
				</div>
				<div className="flex flex-col gap-0.5 rounded-lg bg-red-50 p-3">
					<p className="text-[11px] font-semibold text-red-700">Already expired</p>
					<p className="text-[18px] font-extrabold text-red-800">
						{expiryRisk.expiredValue === null ? "No cost" : formatNaira(expiryRisk.expiredValue)}
					</p>
					<p className="text-[11px] text-red-700">
						{expiryRisk.expiredDrugCount} {expiryRisk.expiredDrugCount === 1 ? "drug" : "drugs"} ·
						money lost
					</p>
				</div>
			</div>

			<ForWithWrapper
				as="ul"
				className="flex flex-col divide-y divide-shadcn-border/70"
				each={expiryRisk.items.slice(0, DISPLAYED_LIST_SIZE)}
				renderItem={(item) => (
					<li
						key={`${item.drug.id}-${item.expiryDate}`}
						className="flex items-start justify-between gap-3 py-2.5 first:pt-0"
					>
						<div className="min-w-0">
							<p className="truncate text-[13px] font-semibold text-black">
								{formatDrugLabel(item.drug)}
							</p>
							<p className="text-[11px] text-vitastock-body-color">
								{item.isExpired ? "Expired" : "Expires"} {formatDate(item.expiryDate)} ·{" "}
								{item.quantity.toLocaleString()} {getUnitLabel(item.drug.unit)}
							</p>
						</div>
						<div className="flex shrink-0 items-center gap-2">
							<Badge
								className={cnJoin(
									"border-none px-2 py-0.5 text-[11px] font-semibold",
									item.isExpired ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800"
								)}
							>
								{item.isExpired ? "Expired" : "Expiring Soon"}
							</Badge>
							<span className="w-20 text-right text-[13px] font-bold text-black">
								{item.value === null ? "No cost" : formatNaira(item.value)}
							</span>
						</div>
					</li>
				)}
			/>
		</AnalyticsCard>
	);
}

type LossRow = Analytics["losses"][number];

const EMPTY_LOSSES: LossRow[] = [];

const lossColumnHelper = createDataTableColumnHelper<LossRow>();

const formatPersonWithRole = (person: string, role: string | null) =>
	role ? `${person} (${formatEnumLabel(role)})` : person;

const lossColumns = lossColumnHelper.columns([
	lossColumnHelper.accessor("createdAt", {
		cell: ({ getValue }) => format(getValue(), "MMM d"),
		header: ({ column }) => <DataTableColumnHeader column={column}>Date</DataTableColumnHeader>,
	}),
	lossColumnHelper.accessor((row) => formatDrugLabel(row.drug), {
		cell: ({ row }) => (
			<span className="font-medium text-black">{formatDrugLabel(row.original.drug)}</span>
		),
		header: ({ column }) => <DataTableColumnHeader column={column}>Drug</DataTableColumnHeader>,
		id: "drug",
	}),
	lossColumnHelper.accessor("reason", {
		cell: ({ getValue }) => (
			<Badge
				className={cnJoin(
					"border-none px-2 py-0.5 text-[11px] font-semibold",
					getValue() === "expired" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800"
				)}
			>
				{formatEnumLabel(getValue())}
			</Badge>
		),
		header: ({ column }) => <DataTableColumnHeader column={column}>Reason</DataTableColumnHeader>,
	}),
	lossColumnHelper.accessor("quantity", {
		cell: ({ row }) =>
			`${row.original.quantity.toLocaleString()} ${getUnitLabel(row.original.drug.unit)}`,
		header: ({ column }) => <DataTableColumnHeader column={column}>Quantity</DataTableColumnHeader>,
	}),
	lossColumnHelper.accessor("value", {
		cell: ({ getValue }) => {
			const value = getValue();

			return value === null ? "No cost" : formatNaira(value);
		},
		header: ({ column }) => <DataTableColumnHeader column={column}>Value</DataTableColumnHeader>,
	}),
	lossColumnHelper.accessor("person", {
		cell: ({ row }) => formatPersonWithRole(row.original.person, row.original.personRole),
		header: ({ column }) => <DataTableColumnHeader column={column}>Removed by</DataTableColumnHeader>,
	}),
]);

function LossesCard(props: { losses: Analytics["losses"]; periodLabel: string }) {
	const { losses, periodLabel } = props;
	const costedLosses = losses.filter((loss) => loss.value !== null);
	const totalLost = costedLosses.reduce((total, loss) => total + (loss.value ?? 0), 0);

	const table = useDataTable({
		columns: lossColumns,
		data: losses.length > 0 ? losses : EMPTY_LOSSES,
		getRowId: (row) => row.id,
	});

	return (
		<AnalyticsCard
			title="Losses and removals"
			description={`Stock removed as Damaged or Expired ${periodLabel.toLowerCase()}`}
			action={
				<p className="text-right">
					<span className="block text-[18px] font-extrabold text-red-700">
						{losses.length > 0 && costedLosses.length === 0 ? "No cost" : formatNaira(totalLost)}
					</span>
					<span className="text-[11px] text-vitastock-body-color">
						lost {periodLabel.toLowerCase()}
					</span>
				</p>
			}
		>
			<DashboardDataTable
				table={table}
				showPagination={false}
				emptyMessage="No damaged or expired stock was removed in this period."
				classNames={{ tableRoot: "min-w-170" }}
			/>
		</AnalyticsCard>
	);
}

type StaffRow = Analytics["staffActivity"][number];

const staffColumnHelper = createDataTableColumnHelper<StaffRow>();

const staffColumns = staffColumnHelper.columns([
	staffColumnHelper.accessor("person", {
		cell: ({ getValue }) => <span className="font-medium text-black">{getValue()}</span>,
		header: ({ column }) => <DataTableColumnHeader column={column}>Person</DataTableColumnHeader>,
	}),
	staffColumnHelper.accessor("personRole", {
		cell: ({ getValue }) => (
			<Badge
				className={cnJoin(
					"border-none px-2 py-0.5 text-[11px] font-semibold",
					getValue() === "pharmacist" ?
						"bg-shadcn-muted text-vitastock-body-color"
					:	"bg-vitastock-primary-main/10 text-vitastock-primary-main"
				)}
			>
				{formatEnumLabel(getValue())}
			</Badge>
		),
		header: ({ column }) => <DataTableColumnHeader column={column}>Role</DataTableColumnHeader>,
	}),
	staffColumnHelper.accessor("dispenseCount", {
		header: ({ column }) => <DataTableColumnHeader column={column}>Dispenses</DataTableColumnHeader>,
	}),
	staffColumnHelper.accessor("sales", {
		cell: ({ getValue }) => {
			const sales = getValue();

			return sales === null ? "No price" : formatNaira(sales);
		},
		header: ({ column }) => <DataTableColumnHeader column={column}>Sales</DataTableColumnHeader>,
	}),
	staffColumnHelper.accessor("undoCount", {
		header: ({ column }) => <DataTableColumnHeader column={column}>Undos</DataTableColumnHeader>,
	}),
	staffColumnHelper.accessor("removalCount", {
		header: ({ column }) => <DataTableColumnHeader column={column}>Removals</DataTableColumnHeader>,
	}),
]);

function StaffActivityCard(props: { periodLabel: string; staffActivity: Analytics["staffActivity"] }) {
	const { periodLabel, staffActivity } = props;

	const table = useDataTable({
		columns: staffColumns,
		data: staffActivity,
		getRowId: (row) => row.userId,
	});

	return (
		<AnalyticsCard
			title="Staff activity"
			description={`What each person did ${periodLabel.toLowerCase()}`}
		>
			<DashboardDataTable
				table={table}
				showPagination={false}
				emptyMessage="No team members yet."
				classNames={{ tableRoot: "min-w-150" }}
			/>
		</AnalyticsCard>
	);
}
