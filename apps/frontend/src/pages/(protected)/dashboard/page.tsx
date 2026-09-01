"use client";

import { useQuery } from "@tanstack/react-query";
import { createSearchParams } from "@zayne-labs/toolkit-core";
import { For } from "@/components/common/for";
import { IconBox } from "@/components/common/IconBox";
import { NavLinkEphemeral } from "@/components/common/NavLink";
import { Switch } from "@/components/common/switch";
import { Badge, Card } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { createDataTableColumnHelper, useDataTable } from "@/components/ui/data-table";
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
import {
	formatDate,
	formatDrugLabel,
	formatEnumLabel,
	formatKoboAsNaira,
	formatUncostedBatchCount,
} from "@/lib/utils/formatters";
import { EmptyState } from "@/pages/(protected)/dashboard/-components/EmptyState";
import { DashboardDataTable } from "./-components/DashboardDataTableShared";
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
			color: "text-amber-600",
			desc: "Items below threshold",
			icon: "lucide:archive",
			title: "Low Stock",
			value: String(stats?.lowStockCount ?? 0),
		},
		{
			color: "text-red-600",
			desc: "Near expiry window",
			icon: "lucide:calendar-x",
			title: "Expiring Soon",
			value: String(stats?.expiringSoonCount ?? 0),
		},
		{
			color: "text-red-600",
			desc: "Require disposal",
			icon: "lucide:triangle-alert",
			title: "Expired",
			value: String(stats?.expiredCount ?? 0),
		},
		{
			color: "text-vitastock-primary-main",
			desc: formatUncostedBatchCount(stats?.uncostedBatchCount ?? 0),
			icon: "lucide:wallet",
			title: "Recorded Inventory Value",
			value: formatKoboAsNaira(stats?.stockValueKobo ?? 0),
		},
	] as const;

	return (
		<section className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
			<For
				each={statItems}
				renderItem={(stat) => (
					<Card.Root
						key={stat.title}
						className="flex flex-col gap-5 rounded-2xl bg-white p-6 shadow-sm ring-1
							ring-shadcn-border/40"
					>
						<Card.Header className="flex flex-row items-center justify-between">
							<Card.Title className="text-[14px] font-medium">{stat.title}</Card.Title>
							<IconBox icon={stat.icon} className={cnJoin("size-5", stat.color)} />
						</Card.Header>

						<Card.Content className="flex min-w-0 grow flex-col justify-between gap-2">
							<p
								className={cnJoin(
									"max-w-full text-[34px] leading-none font-extrabold tracking-tight text-black",
									stat.title === "Recorded Inventory Value" && "text-[28px] wrap-break-word"
								)}
							>
								{dashboardOverviewQueryResult.isLoading ? "..." : stat.value}
							</p>
							<Card.Description className="text-[13px] text-vitastock-body-color/70">
								{stat.desc}
							</Card.Description>
						</Card.Content>
					</Card.Root>
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

const EMPTY_DASHBOARD_ACTIVITY: DashboardActivityRow[] = [];

const dashboardActivityColumnHelper = createDataTableColumnHelper<DashboardActivityRow>();

const stockReductionLogTypes = new Set<string>(StockReductionLogTypeSchema.options);

const dashboardActivityColumns = dashboardActivityColumnHelper.columns([
	dashboardActivityColumnHelper.accessor(
		(row) => formatDrugLabel(row.drug, { includeGenericName: true }),
		{
			cell: ({ row }) => (
				<div>
					<p className="text-[14px] font-medium text-black">{formatDrugLabel(row.original.drug)}</p>
					<p className="mt-0.5 text-[12px] text-vitastock-body-color">
						{row.original.drug.genericName}
					</p>
				</div>
			),
			header: "Drug",
			id: "drug",
		}
	),
	dashboardActivityColumnHelper.accessor("logType", {
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
	}),
	dashboardActivityColumnHelper.accessor("quantity", {
		cell: ({ getValue }) => <span className="text-[14px] text-black">{getValue()}</span>,
		header: "Quantity",
	}),
	dashboardActivityColumnHelper.accessor("person", {
		cell: ({ getValue }) => <span className="text-[14px]">{getValue()}</span>,
		header: "Person",
	}),
	dashboardActivityColumnHelper.accessor("createdAt", {
		cell: ({ getValue }) => (
			<span className="block text-right text-[14px] text-vitastock-body-color/70">
				{formatDate(getValue())}
			</span>
		),
		header: () => <span className="block text-right">Time</span>,
	}),
]);

function DashboardActivity() {
	const dashboardOverviewQueryResult = useQuery(dashboardOverviewQuery());
	const recentActivity = dashboardOverviewQueryResult.data?.recentActivity ?? EMPTY_DASHBOARD_ACTIVITY;

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

			<DashboardDataTable
				table={table}
				isError={dashboardOverviewQueryResult.isError}
				isLoading={dashboardOverviewQueryResult.isLoading}
				showPagination={false}
				emptyMessage="No stock activity yet."
				errorMessage="Failed to load activity."
			/>
		</section>
	);
}
