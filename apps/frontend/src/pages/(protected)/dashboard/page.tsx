"use client";

import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { createSearchParams } from "@zayne-labs/toolkit-core";
import { For } from "@/components/common/for";
import { IconBox } from "@/components/common/IconBox";
import { NavLinkEphemeral } from "@/components/common/NavLink";
import { Switch } from "@/components/common/switch";
import { Badge } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { DataTable, useDataTable } from "@/components/ui/data-table";
import {
	StockMovementLogTypeSchema,
	StockReductionLogTypeSchema,
} from "@/lib/api/callBackendApi/apiSchema";
import {
	dashboardOverviewQuery,
	sessionQuery,
	type DashboardOverviewQueryResultType,
} from "@/lib/react-query/queryOptions";
import { cnJoin } from "@/lib/utils/cn";
import { formatDate, formatEnumLabel, formatKoboAsNaira } from "@/lib/utils/formatters";
import { EmptyState } from "@/pages/(protected)/dashboard/-components/EmptyState";
import { Main } from "./-components/Main";

function DashboardPage() {
	const dashboardOverviewQueryResult = useQuery(dashboardOverviewQuery());
	const overview = dashboardOverviewQueryResult.data;

	const hasNoInventory =
		dashboardOverviewQueryResult.isSuccess
		&& overview?.recentActivity.length === 0
		&& overview.stats.stockValueKobo === 0;

	return (
		<Main className="gap-10 px-12 pt-12">
			<DashboardHeader />

			<Switch.Root>
				<Switch.Match when={hasNoInventory}>
					<EmptyState
						icon="lucide:package-x"
						title="No inventory data yet"
						description="Start by adding stock to begin tracking inventory levels, locations, and expiry dates automatically."
						action={
							<NavLinkEphemeral to="/dashboard/inventory">
								<Button>
									<IconBox icon="lucide:plus" className="size-4" />
									Add Inventory
								</Button>
							</NavLinkEphemeral>
						}
					/>
				</Switch.Match>

				<Switch.Default>
					<DashboardStats />
					<DashboardQuickActions />
					<DashboardActivity />
				</Switch.Default>
			</Switch.Root>
		</Main>
	);
}

export default DashboardPage;

function DashboardHeader() {
	const sessionQueryResult = useQuery(sessionQuery());

	return (
		<header className="flex flex-col gap-1.5">
			<h1 className="text-[30px] font-extrabold tracking-tight text-black">
				Hello, {sessionQueryResult.data?.workspace.name}
			</h1>
			<p className="text-[15px] font-medium text-vitastock-body-color/80">Welcome back!</p>
		</header>
	);
}

function DashboardStats() {
	const dashboardOverviewQueryResult = useQuery(dashboardOverviewQuery());
	const stats = dashboardOverviewQueryResult.data?.stats;
	const statItems = [
		{
			color: "text-[#d97706]",
			desc: "Items below threshold",
			icon: "lucide:archive",
			title: "Low Stock",
			value: String(stats?.lowStockCount ?? 0),
		},
		{
			color: "text-[#dc2626]",
			desc: "Near expiry window",
			icon: "lucide:calendar-x",
			title: "Expiring Soon",
			value: String(stats?.expiringSoonCount ?? 0),
		},
		{
			color: "text-[#dc2626]",
			desc: "Require disposal",
			icon: "lucide:triangle-alert",
			title: "Expired",
			value: String(stats?.expiredCount ?? 0),
		},
		{
			color: "text-vitastock-primary-main",
			desc: "Estimated total",
			icon: "lucide:wallet",
			title: "Stock Value",
			value: formatKoboAsNaira(stats?.stockValueKobo ?? 0),
		},
	] as const;

	return (
		<section className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
			<For
				each={statItems}
				renderItem={(stat) => (
					<li
						key={stat.title}
						className="flex flex-col gap-5 rounded-2xl bg-white p-6 shadow-sm ring-1
							ring-shadcn-border/40"
					>
						<div className="flex items-center justify-between">
							<h3 className="text-[14px] font-medium">{stat.title}</h3>
							<IconBox icon={stat.icon} className={cnJoin("size-5", stat.color)} />
						</div>
						<div>
							<p className="text-[34px] leading-none font-extrabold tracking-tight text-black">
								{dashboardOverviewQueryResult.isLoading ? "..." : stat.value}
							</p>
							<p className="mt-2 text-[13px] text-vitastock-body-color/70">{stat.desc}</p>
						</div>
					</li>
				)}
			/>
		</section>
	);
}

function DashboardQuickActions() {
	return (
		<section className="flex flex-col gap-4">
			<h2 className="text-[14px] font-bold tracking-widest text-black uppercase">Quick Actions</h2>

			<div className="flex flex-wrap items-center gap-4">
				<NavLinkEphemeral
					to={{
						pathname: "/dashboard/inventory",
						search: createSearchParams({
							movement: StockMovementLogTypeSchema.enum.stock_in,
						}).toString(),
					}}
				>
					<Button>
						<IconBox icon="lucide:plus" className="size-4.5" />
						Stock In
					</Button>
				</NavLinkEphemeral>
				<NavLinkEphemeral
					to={{
						pathname: "/dashboard/inventory",
						search: createSearchParams({
							movement: StockMovementLogTypeSchema.enum.stock_out,
						}).toString(),
					}}
				>
					<Button>
						<IconBox icon="lucide:minus" className="size-4.5" />
						Dispense
					</Button>
				</NavLinkEphemeral>
				<NavLinkEphemeral to="/dashboard/alerts">
					<Button>
						<IconBox icon="lucide:bell" className="size-4.5" />
						View Alerts
					</Button>
				</NavLinkEphemeral>
			</div>
		</section>
	);
}

type DashboardActivityRow = DashboardOverviewQueryResultType["recentActivity"][number];

const stockReductionLogTypes = new Set<string>(StockReductionLogTypeSchema.options);

const dashboardActivityColumns: Array<ColumnDef<DashboardActivityRow>> = [
	{
		accessorFn: (row) => `${row.drug.name} ${row.drug.genericName} ${row.drug.strength}`,
		cell: ({ row }) => (
			<div>
				<p className="text-[14px] font-medium text-black">
					{row.original.drug.name} {row.original.drug.strength}
				</p>
				<p className="mt-0.5 text-[12px] text-vitastock-body-color">
					{row.original.drug.genericName}
				</p>
			</div>
		),
		header: "Drug",
		id: "drug",
	},
	{
		accessorKey: "logType",
		cell: ({ row }) => (
			<Badge
				className={cnJoin(
					"border-none px-3 py-1 text-[12px] font-semibold",
					stockReductionLogTypes.has(row.original.logType)
						&& `bg-vitastock-primary-main/10 text-vitastock-primary-main
						hover:bg-vitastock-primary-main/20`,
					!stockReductionLogTypes.has(row.original.logType)
						&& "bg-shadcn-muted text-vitastock-body-color hover:bg-shadcn-muted/80"
				)}
			>
				{formatEnumLabel(row.original.logType)}
			</Badge>
		),
		header: "Action",
	},
	{
		accessorKey: "quantity",
		cell: ({ row }) => <span className="text-[14px] text-black">{row.original.quantity}</span>,
		header: "Quantity",
	},
	{
		accessorKey: "person",
		cell: ({ row }) => <span className="text-[14px]">{row.original.person}</span>,
		header: "Person",
	},
	{
		accessorKey: "createdAt",
		cell: ({ row }) => (
			<span className="block text-right text-[14px] text-vitastock-body-color/70">
				{formatDate(row.original.createdAt)}
			</span>
		),
		header: () => <span className="block text-right">Time</span>,
	},
];

function DashboardActivity() {
	const dashboardOverviewQueryResult = useQuery(dashboardOverviewQuery());
	const recentActivity = dashboardOverviewQueryResult.data?.recentActivity ?? [];

	const table = useDataTable({
		columns: dashboardActivityColumns,
		data: recentActivity,
		getRowId: (activity) => activity.id,
	});

	return (
		<section
			className="flex flex-col gap-6 rounded-[20px] bg-white py-6 shadow-sm ring-1
				ring-shadcn-border/40"
		>
			<h2 className="px-6 text-[18px] font-bold text-black">Recent Activity</h2>

			<DataTable
				table={table}
				isError={dashboardOverviewQueryResult.isError}
				isLoading={dashboardOverviewQueryResult.isLoading}
				showPagination={false}
				emptyMessage="No stock activity yet."
				errorMessage="Failed to load activity."
				classNames={{
					tableCell: "py-4",
					tableHead: `h-11 text-[12px] font-semibold tracking-wider text-vitastock-body-color/70
					uppercase`,
					tableHeader: "bg-shadcn-muted",
					tableRow: "border-b border-shadcn-border hover:bg-shadcn-muted/20",
				}}
			/>
		</section>
	);
}
