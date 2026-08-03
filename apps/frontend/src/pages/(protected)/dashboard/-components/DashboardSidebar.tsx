"use client";

import { For } from "@/components/common/for";
import { IconBox } from "@/components/common/IconBox";
import { Logo } from "@/components/common/Logo";
import { NavLink } from "@/components/common/NavLink";
import { Sidebar } from "@/components/ui";

const dashboardNavItems = [
	{
		href: "/dashboard",
		icon: "material-symbols:dashboard-outline-rounded",
		iconActive: "material-symbols:dashboard-rounded",
		title: "Dashboard",
	},
	{
		href: "/dashboard/inventory",
		icon: "material-symbols:inventory-2-outline-rounded",
		iconActive: "material-symbols:inventory-2-rounded",
		title: "Inventory",
	},
	{
		href: "/dashboard/reports",
		icon: "mdi:chart-box-outline",
		iconActive: "mdi:chart-box",
		title: "Reports",
	},
	{
		href: "/dashboard/alerts",
		icon: "material-symbols:warning-outline",
		iconActive: "material-symbols:warning-rounded",
		title: "Alerts",
	},
] as const;

const dashboardUtilityItems = [
	{
		href: "/dashboard/settings",
		icon: "material-symbols:settings-outline-rounded",
		iconActive: "material-symbols:settings-rounded",
		title: "Settings",
	},
] as const;

type DashboardNavItem = (typeof dashboardNavItems)[number] | (typeof dashboardUtilityItems)[number];

function DashboardSidebar() {
	return (
		<Sidebar.Provider sidebarWidth="272px" sidebarWidthIcon="76px" withMobileBreakpoint={false}>
			<Sidebar.Root
				collapsible="icon"
				classNames={{
					container: "animate-slide-from-left border-r border-shadcn-border/60",
					inner: "gap-0 bg-[hsl(210,14%,97%)]",
				}}
			>
				<Sidebar.Header className="relative border-b border-shadcn-border/60 px-4 py-5">
					<Logo
						width={40}
						classNames={{
							base: `flex min-w-0 items-center gap-3 overflow-hidden
							group-data-[state=collapsed]:justify-center`,
							image: "size-10",
						}}
					>
						<div
							className="min-w-0 overflow-hidden whitespace-nowrap opacity-100
								transition-[width,opacity] duration-200 ease-linear
								group-data-[state=collapsed]:absolute group-data-[state=collapsed]:w-0
								group-data-[state=collapsed]:opacity-0"
						>
							<h3 className="text-[19px] leading-none font-extrabold text-vitastock-primary-main">
								VitaStock
							</h3>
							<p className="mt-1.5 text-[11px] font-semibold text-vitastock-body-color/60">
								Inventory workspace
							</p>
						</div>
					</Logo>

					<Sidebar.Trigger
						className="absolute top-1/2 -right-3.5 z-20 size-7 -translate-y-1/2 rounded-full border
							border-shadcn-border bg-white text-vitastock-body-color shadow-sm
							hover:bg-vitastock-primary-subtle hover:text-vitastock-primary-main"
					/>
				</Sidebar.Header>

				<Sidebar.Content className="scrollbar-none px-3 py-6">
					<Sidebar.Group className="gap-2">
						<Sidebar.GroupLabel
							className="px-3 text-[11px] font-bold tracking-wider text-vitastock-body-color/50
								uppercase"
						>
							Workspace
						</Sidebar.GroupLabel>

						<DashboardSidebarMenu items={dashboardNavItems} />
					</Sidebar.Group>
				</Sidebar.Content>

				<Sidebar.Footer className="border-t border-shadcn-border/60 px-3 py-8">
					<DashboardSidebarMenu items={dashboardUtilityItems} />
				</Sidebar.Footer>

				<Sidebar.Rail className="group-data-[state=collapsed]:-translate-x-1" />
			</Sidebar.Root>
		</Sidebar.Provider>
	);
}

function DashboardSidebarMenu(props: { items: readonly DashboardNavItem[] }) {
	const { items } = props;

	return (
		<Sidebar.Menu className="gap-2">
			<For
				each={items}
				renderItem={(item) => (
					<Sidebar.MenuItem key={item.title}>
						<DashboardSidebarLink item={item} />
					</Sidebar.MenuItem>
				)}
			/>
		</Sidebar.Menu>
	);
}

function DashboardSidebarLink(props: { item: DashboardNavItem }) {
	const { item } = props;

	return (
		<Sidebar.MenuButton
			tooltip={item.title}
			className="h-11 gap-3 rounded-lg px-3.5 text-[14px] font-semibold text-vitastock-body-color
				transition-[background-color,color,box-shadow,padding] duration-200
				group-data-[state=collapsed]:px-0 hover:bg-white hover:text-vitastock-primary-dark
				data-active:bg-white data-active:text-vitastock-primary-dark
				data-active:shadow-[0_1px_2px_rgba(15,23,42,0.04),0_0_0_1px_rgba(15,23,42,0.05)]
				data-active:before:absolute data-active:before:left-0 data-active:before:h-5
				data-active:before:w-0.5 data-active:before:rounded-full
				data-active:before:bg-vitastock-primary-main"
			asChild={true}
		>
			<NavLink to={item.href} end={item.href === "/dashboard"}>
				{(ctx) => (
					<>
						<span
							className="flex size-7 shrink-0 items-center justify-center rounded-md
								group-data-[state=collapsed]:mx-auto"
						>
							<IconBox icon={ctx.isActive ? item.iconActive : item.icon} className="size-5" />
						</span>

						<p
							className="w-fit shrink-0 overflow-hidden whitespace-nowrap opacity-100
								transition-[width,opacity] duration-200 ease-linear
								group-data-[state=collapsed]:absolute group-data-[state=collapsed]:w-0
								group-data-[state=collapsed]:opacity-0"
						>
							{item.title}
						</p>
					</>
				)}
			</NavLink>
		</Sidebar.MenuButton>
	);
}

export { DashboardSidebar };
