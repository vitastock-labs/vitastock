"use client";

import { useQuery } from "@tanstack/react-query";
import { For } from "@/components/common/for";
import { IconBox } from "@/components/common/IconBox";
import { Badge, Table } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { sessionQuery } from "@/lib/react-query/queryOptions";
import { cnJoin } from "@/lib/utils/cn";
import { Main } from "./-components/Main";

function DashboardPage() {
	return (
		<Main className="gap-10 px-12 pt-12">
			<DashboardHeader />
			<DashboardStats />
			<DashboardQuickActions />
			<DashboardActivity />
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

const stats = [
	{
		color: "text-[#d97706]",
		desc: "Items below threshold",
		icon: "lucide:archive",
		title: "Low Stock",
		value: "12",
	},
	{
		color: "text-[#dc2626]",
		desc: "Next 30 days",
		icon: "lucide:calendar-x",
		title: "Expiring Soon",
		value: "8",
	},
	{
		color: "text-[#dc2626]",
		desc: "Require disposal",
		icon: "lucide:triangle-alert",
		title: "Expired",
		value: "2",
	},
	{
		color: "text-vitastock-primary-main",
		desc: "Estimated total",
		icon: "lucide:wallet",
		title: "Stock Value",
		value: "$42.5k",
	},
];

function DashboardStats() {
	return (
		<section className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
			<For
				each={stats}
				renderItem={(stat) => (
					<li
						key={stat.title}
						className="flex flex-col gap-5 rounded-2xl bg-white p-6 shadow-sm ring-1
							ring-shadcn-border/40"
					>
						<div className="flex items-center justify-between">
							<h3 className="text-[14px] font-medium">{stat.title}</h3>
							<IconBox type="online" icon={stat.icon} className={cnJoin("size-5", stat.color)} />
						</div>
						<div>
							<p className="text-[34px] leading-none font-extrabold tracking-tight text-black">
								{stat.value}
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
				<Button>
					<IconBox type="online" icon="lucide:plus" className="size-4.5" />
					Stock In
				</Button>
				<Button>
					<IconBox type="online" icon="lucide:minus" className="size-4.5" />
					Dispense
				</Button>
				<Button>
					<IconBox type="online" icon="lucide:bell" className="size-4.5" />
					View Alerts
				</Button>
			</div>
		</section>
	);
}

const activities = [
	{
		action: "Dispense",
		drug: "Amoxicillin 500mg",
		person: "Dr. Smith",
		quantity: "-30",
		time: "10 mins ago",
	},
	{
		action: "Stock In",
		drug: "Lisinopril 10mg",
		person: "Admin",
		quantity: "+100",
		time: "1 hour ago",
	},
	{
		action: "Dispense",
		drug: "Metformin 850mg",
		person: "Dr. Jones",
		quantity: "-60",
		time: "3 hours ago",
	},
];

const columns = ["Drug", "Action", "Quantity", "Person", "Time"] as const;

function DashboardActivity() {
	return (
		<section className="rounded-[20px] bg-white p-6 shadow-sm ring-1 ring-shadcn-border/40">
			<h2 className="mb-6 text-[18px] font-bold text-black">Recent Activity</h2>

			<Table.Root>
				<Table.Header>
					<Table.Row className="border-b-shadcn-border/50 hover:bg-transparent">
						<For
							each={columns}
							renderItem={(column) => (
								<Table.Head
									key={column}
									className={cnJoin(
										`h-11 text-[12px] font-semibold tracking-wider text-vitastock-body-color/70
										uppercase`,
										column === "Time" && "text-right"
									)}
								>
									{column}
								</Table.Head>
							)}
						/>
					</Table.Row>
				</Table.Header>

				<Table.Body>
					{activities.map((activity) => (
						<Table.Row
							key={`${activity.drug}-${activity.time}`}
							className="border-b-shadcn-border/30 last:border-0 hover:bg-shadcn-muted/20"
						>
							<Table.Cell className="py-4 text-[14px] font-medium text-black">
								{activity.drug}
							</Table.Cell>
							<Table.Cell className="py-4">
								<Badge
									className={cnJoin(
										"border-none px-3 py-1 text-[12px] font-semibold",
										activity.action === "Dispense" ?
											`bg-vitastock-primary-main/10 text-vitastock-primary-main
												hover:bg-vitastock-primary-main/20`
										:	"bg-shadcn-muted text-vitastock-body-color hover:bg-shadcn-muted/80"
									)}
								>
									{activity.action}
								</Badge>
							</Table.Cell>
							<Table.Cell className="py-4 text-[14px] text-black">{activity.quantity}</Table.Cell>
							<Table.Cell className="py-4 text-[14px]">{activity.person}</Table.Cell>
							<Table.Cell className="py-4 text-right text-[14px] text-vitastock-body-color/70">
								{activity.time}
							</Table.Cell>
						</Table.Row>
					))}
				</Table.Body>
			</Table.Root>
		</section>
	);
}
