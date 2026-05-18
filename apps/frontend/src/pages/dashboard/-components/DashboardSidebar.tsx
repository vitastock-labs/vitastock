"use client";

import { For } from "@/components/common/for";
import { IconBox } from "@/components/common/IconBox";
import { Logo } from "@/components/common/Logo";
import { NavLink } from "@/components/common/NavLink";
import { Sidebar } from "@/components/ui";

const navItems = [
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
	{
		href: "/dashboard/settings",
		icon: "material-symbols:settings-outline-rounded",
		iconActive: "material-symbols:settings-rounded",
		title: "Settings",
	},
] as const;

function DashboardSidebar() {
	return (
		<Sidebar.Provider
			sidebarWidth="256px"
			sidebarWidthIcon="68px"
			className="shrink-0 transition-[width] duration-300 ease-in-out
				data-[state=collapsed]:w-(--sidebar-width-icon) data-[state=expanded]:w-(--sidebar-width)"
		>
			<Sidebar.Root
				collapsible="icon"
				classNames={{
					base: "bg-[hsl(210,9%,96%)]",
					container: "border-r-[hsl(231,20%,80%,0.2)]",
					inner: "gap-7 bg-[hsl(210,9%,96%)]",
				}}
			>
				<Sidebar.Header className="relative px-3 pt-5">
					<Logo
						width={48}
						classNames={{
							base: "flex w-fit items-center gap-3 overflow-hidden",
							image: "size-12",
						}}
					>
						<h3
							className="text-[20px] leading-none font-extrabold tracking-tight
								text-vitastock-primary-main group-data-[collapsible=icon]:hidden"
						>
							VitaStock
						</h3>
					</Logo>

					<Sidebar.Trigger
						className="absolute top-8 -right-4 z-20 hover:text-vitastock-primary-main
							in-data-[state=collapsed]:text-vitastock-primary-dark"
					/>
				</Sidebar.Header>

				<Sidebar.Content className="px-3">
					<Sidebar.Group className="p-0">
						<Sidebar.Menu className="gap-2">
							<For
								each={navItems}
								renderItem={(item) => (
									<Sidebar.MenuItem key={item.title}>
										<Sidebar.MenuButton tooltip={item.title} asChild={true}>
											<NavLink
												to={item.href}
												className="h-11 gap-3 px-3.5 text-[14px] font-medium transition-colors
													hover:bg-black/5 hover:text-vitastock-primary-dark
													data-[active=true]:bg-vitastock-226-100-84/70
													data-[active=true]:text-vitastock-primary-dark
													data-[active=true]:hover:bg-vitastock-226-100-84/90
													data-[active=true]:hover:text-vitastock-primary-dark"
											>
												{(ctx) => (
													<>
														<IconBox
															icon={ctx.isActive ? item.iconActive : item.icon}
															className="size-4.5"
														/>
														<span>{item.title}</span>
													</>
												)}
											</NavLink>
										</Sidebar.MenuButton>
									</Sidebar.MenuItem>
								)}
							/>
						</Sidebar.Menu>
					</Sidebar.Group>
				</Sidebar.Content>

				<Sidebar.Rail />
			</Sidebar.Root>
		</Sidebar.Provider>
	);
}

export { DashboardSidebar };
