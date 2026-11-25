import { WEEKLY_REPORT_EXPIRING_SOON_DAYS } from "@vitastock/shared/constants";
import { formatWholeNaira } from "@vitastock/shared/formatters";
import * as React from "react";
import { Button, Column, Heading, Hr, render, Row, Section, Text } from "react-email";
import { FRONTEND_URL } from "../src/constants";
import { BaseLayout } from "../src/layouts/BaseLayout";

type ReportRow = { detail: string; name: string; value: string };

type AttentionGroup = { items: string[]; total: number };

export type WeeklyOwnerReportEmailProps = {
	attention: {
		expiringSoon: AttentionGroup;
		lowStock: AttentionGroup;
		removals: { items: string[]; removalCount: number; undoCount: number };
	};
	greeting: string;
	name: string;
	payments: Array<{ label: string; sales: number }>;
	periodLabel: string;
	slowSellers: ReportRow[];
	topSellers: ReportRow[];
	totals: {
		profit: number;
		profitPercent: number | null;
		saleCount: number;
		saleCountChange: number | null;
		sales: number;
		salesChangePercent: number | null;
	};
	workspaceName: string;
};

const pluralize = (count: number, singular: string, plural: string) =>
	`${count} ${count === 1 ? singular : plural}`;

const PAYMENT_COLORS = ["#0049C7", "#5184FB", "#ADC0FF", "#D1D5DB"];

function StatBox(props: { change?: React.ReactNode; label: string; value: string }) {
	const { change, label, value } = props;

	return (
		<Section className="rounded-xl bg-slate-100 px-4 py-3.5">
			<Text className="m-0 text-xs text-vitastock-body-color">{label}</Text>
			<Text className="m-0 mt-1 text-xl font-semibold text-slate-900">{value}</Text>
			<Text className="m-0 mt-1 text-xs">{change}</Text>
		</Section>
	);
}

function ChangeText(props: { change: number | null; suffix: string }) {
	const { change, suffix } = props;

	if (change === null) {
		return <span className="text-vitastock-body-color">No sales last week</span>;
	}

	return (
		<span className={change >= 0 ? "text-emerald-700" : "text-red-700"}>
			{change >= 0 ? "▲" : "▼"} {Math.abs(change).toFixed(0)}
			{suffix} vs last week
		</span>
	);
}

function SectionHeading(props: { children: React.ReactNode }) {
	const { children } = props;

	return <Text className="m-0 mt-8 text-base font-semibold text-slate-900">{children}</Text>;
}

function RankedList(props: { rows: ReportRow[] }) {
	const { rows } = props;

	return (
		<Section className="mt-2">
			{rows.map((row, index) => (
				<Row
					key={row.name}
					className={index < rows.length - 1 ? "border-0 border-b border-solid border-slate-200" : ""}
				>
					<Column className="w-7 py-2.5 align-top text-sm text-slate-900">{index + 1}.</Column>
					<Column className="py-2.5 align-top text-sm text-slate-900">{row.name}</Column>
					<Column className="py-2.5 pr-4 text-right align-top text-xs text-vitastock-body-color">
						{row.detail}
					</Column>
					<Column className="w-24 py-2.5 text-right align-top text-sm font-semibold text-slate-900">
						{row.value}
					</Column>
				</Row>
			))}
		</Section>
	);
}

function AttentionCard(props: {
	badge: string;
	badgeClassName: string;
	items: string[];
	title: string;
	total: number;
}) {
	const { badge, badgeClassName, items, title, total } = props;

	if (total === 0) {
		return null;
	}

	return (
		<Section className="mt-3 rounded-xl border border-solid border-slate-200 px-4 py-3.5">
			<Text className="m-0 text-sm font-semibold text-slate-900">
				<span className={`mr-2 rounded-md px-2 py-1 text-xs font-normal ${badgeClassName}`}>
					{badge}
				</span>
				{title}
			</Text>
			{items.map((item) => (
				<Text key={item} className="m-0 mt-2 text-sm text-vitastock-body-color">
					{item}
				</Text>
			))}
			{total > items.length && (
				<Text className="m-0 mt-2 text-sm text-vitastock-body-color">
					+ {total - items.length} more
				</Text>
			)}
		</Section>
	);
}

export function WeeklyOwnerReportEmail(props: WeeklyOwnerReportEmailProps) {
	const {
		attention,
		greeting,
		name,
		payments,
		periodLabel,
		slowSellers,
		topSellers,
		totals,
		workspaceName,
	} = props;
	const paymentTotal = payments.reduce((total, payment) => total + payment.sales, 0);
	const removalAndUndoCount = attention.removals.removalCount + attention.removals.undoCount;
	const hasAttentionItems =
		attention.lowStock.total + attention.expiringSoon.total + removalAndUndoCount > 0;

	return (
		<BaseLayout
			preview={`${workspaceName} this week: ${formatWholeNaira(totals.sales)} sales, ${formatWholeNaira(totals.profit)} profit`}
		>
			<Heading className="m-0 text-2xl font-semibold tracking-tight text-slate-900">
				{greeting}, {name}
			</Heading>
			<Text className="mt-2 text-base/relaxed text-vitastock-body-color">
				Here is how {workspaceName} did this week, {periodLabel}.
			</Text>

			{totals.saleCount === 0 ?
				<Text className="mt-6 rounded-xl bg-slate-100 px-5 py-4 text-base text-vitastock-body-color">
					No sales recorded this week.
				</Text>
			:	<Row className="mt-6">
					<Column className="w-1/3 pr-1.5 align-top">
						<StatBox
							label="Sales"
							value={formatWholeNaira(totals.sales)}
							change={<ChangeText change={totals.salesChangePercent} suffix="%" />}
						/>
					</Column>
					<Column className="w-1/3 px-1.5 align-top">
						<StatBox
							label="Profit on drugs sold"
							value={formatWholeNaira(totals.profit)}
							change={
								<span className="text-vitastock-body-color">
									{totals.profitPercent === null ?
										"No cost prices yet"
									:	`${totals.profitPercent.toFixed(1)}% of sales`}
								</span>
							}
						/>
					</Column>
					<Column className="w-1/3 pl-1.5 align-top">
						<StatBox
							label="Number of sales"
							value={totals.saleCount.toLocaleString()}
							change={<ChangeText change={totals.saleCountChange} suffix="" />}
						/>
					</Column>
				</Row>
			}

			{paymentTotal > 0 && (
				<>
					<SectionHeading>How customers paid</SectionHeading>
					<Row className="mt-3 overflow-hidden rounded-full">
						{payments.map((payment, index) => (
							<Column
								key={payment.label}
								className="h-2"
								style={{
									backgroundColor: PAYMENT_COLORS[index],
									width: `${(payment.sales / paymentTotal) * 100}%`,
								}}
							/>
						))}
					</Row>
					<Text className="m-0 mt-3 text-sm text-slate-900">
						{payments.map((payment, index) => (
							<span key={payment.label} className="mr-4 inline-block">
								<span style={{ color: PAYMENT_COLORS[index] }}>●</span> {payment.label}{" "}
								{formatWholeNaira(payment.sales)}
							</span>
						))}
					</Text>
				</>
			)}

			{topSellers.length > 0 && (
				<>
					<SectionHeading>Top 5 sellers this week</SectionHeading>
					<RankedList rows={topSellers} />
				</>
			)}

			{slowSellers.length > 0 && (
				<>
					<SectionHeading>Slow sellers · money tied up</SectionHeading>
					<RankedList rows={slowSellers} />
				</>
			)}

			{hasAttentionItems && (
				<>
					<SectionHeading>Needs your attention</SectionHeading>
					<AttentionCard
						badge="Low Stock"
						badgeClassName="bg-amber-100 text-amber-800"
						title={`${pluralize(attention.lowStock.total, "drug", "drugs")} running low`}
						items={attention.lowStock.items}
						total={attention.lowStock.total}
					/>
					<AttentionCard
						badge="Expiring Soon"
						badgeClassName="bg-amber-100 text-amber-800"
						title={`${pluralize(attention.expiringSoon.total, "drug", "drugs")} expire in the next ${WEEKLY_REPORT_EXPIRING_SOON_DAYS} days`}
						items={attention.expiringSoon.items}
						total={attention.expiringSoon.total}
					/>
					<AttentionCard
						badge="Removed / Undone"
						badgeClassName="bg-red-50 text-red-700"
						title={`${pluralize(attention.removals.removalCount, "removal", "removals")} and ${pluralize(attention.removals.undoCount, "undo", "undos")} this week`}
						items={attention.removals.items}
						total={removalAndUndoCount}
					/>
				</>
			)}

			<Button
				href={`${FRONTEND_URL}/dashboard/analytics?period=week`}
				className="mt-8 box-border block w-full rounded-xl bg-vitastock-primary-dark py-4 text-center
					text-base font-semibold text-white no-underline"
			>
				See Full Analytics
			</Button>

			<Hr className="mt-8 border-slate-200" />
			<Text className="mt-6 text-xs/relaxed text-slate-500">
				You get this email because you are an Owner or Admin of {workspaceName} on VitaStock. Change
				the time or turn it off in Settings.
			</Text>
		</BaseLayout>
	);
}

export const TemplateFn = (props: WeeklyOwnerReportEmailProps) =>
	render(<WeeklyOwnerReportEmail {...props} />);

WeeklyOwnerReportEmail.PreviewProps = {
	attention: {
		expiringSoon: { items: ["Ampiclox Syrup 100ml — Nov 14, 2026 · 36 bottles"], total: 3 },
		lowStock: {
			items: ["Coartem 80/480mg Tablets — 6 packs left", "Metformin 500mg Tablets — 3 packs left"],
			total: 4,
		},
		removals: {
			items: [
				"Glucose 5% IV Fluid 500ml — 1 bag removed as Damaged by Tunde Bello (Admin)",
				"Paracetamol 500mg Tablets — 2 strips dispense undone by Chinedu Okafor (Pharmacist)",
			],
			removalCount: 1,
			undoCount: 1,
		},
	},
	greeting: "Good evening",
	name: "Ifunanya",
	payments: [
		{ label: "Cash", sales: 92_600 },
		{ label: "Transfer", sales: 108_400 },
		{ label: "POS", sales: 31_200 },
		{ label: "Not noted", sales: 11_600 },
	],
	periodLabel: "Oct 19 – Oct 25, 2026, up to 9:00pm",
	slowSellers: [{ detail: "60 vials · 2 sold", name: "Ceftriaxone 1g Injection", value: "₦132,000" }],
	topSellers: [
		{ detail: "18 strips", name: "Amoxicillin 500mg Capsules", value: "₦16,200" },
		{ detail: "46 strips", name: "Paracetamol 500mg Tablets", value: "₦13,800" },
		{ detail: "4 packs", name: "Coartem 80/480mg Tablets", value: "₦11,200" },
		{ detail: "2 packs", name: "Augmentin 625mg Tablets", value: "₦10,000" },
		{ detail: "6 bottles", name: "Vitamin C 1000mg Tablets", value: "₦9,000" },
	],
	totals: {
		profit: 67_900,
		profitPercent: 27.9,
		saleCount: 61,
		saleCountChange: 5,
		sales: 243_800,
		salesChangePercent: 8,
	},
	workspaceName: "SpringCare Pharmacy",
} satisfies WeeklyOwnerReportEmailProps;

export default WeeklyOwnerReportEmail;
