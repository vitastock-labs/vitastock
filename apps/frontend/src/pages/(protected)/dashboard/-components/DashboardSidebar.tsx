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
		<Sidebar.Provider sidebarWidth="256px" sidebarWidthIcon="68px" withMobileBreakpoint={false}>
			<Sidebar.Root
				collapsible="icon"
				classNames={{
					container: "animate-slide-from-left border-r-[hsl(231,20%,80%,0.2)]",
					inner: "gap-7 bg-[hsl(210,9%,96%)]",
				}}
			>
				<Sidebar.Header className="relative px-3 pt-5">
					<Sidebar.Menu>
						<Sidebar.MenuItem>
							<Sidebar.MenuButton className="h-auto p-0">
								<Logo
									width={48}
									classNames={{
										base: "flex items-center gap-3",
										image: "size-12",
									}}
								>
									<h3
										className="text-[20px] leading-none font-extrabold tracking-tight
											text-vitastock-primary-main"
									>
										VitaStock
									</h3>
								</Logo>
							</Sidebar.MenuButton>
						</Sidebar.MenuItem>
					</Sidebar.Menu>

					<Sidebar.Trigger
						className="absolute top-8 -right-4 z-20 hover:text-vitastock-primary-main
							in-data-[state=collapsed]:text-vitastock-primary-dark"
					/>
				</Sidebar.Header>

				<Sidebar.Content className="px-3">
					<Sidebar.Group>
						<Sidebar.Menu className="gap-2">
							<For
								each={navItems}
								renderItem={(item) => (
									<Sidebar.MenuItem key={item.title}>
										<Sidebar.MenuButton
											tooltip={item.title}
											className="h-11 gap-3 px-3.5 text-[14px] font-medium transition-colors
												hover:bg-black/5 hover:text-vitastock-primary-dark
												data-active:bg-vitastock-primary-subtle/70
												data-active:text-vitastock-primary-dark
												data-active:hover:bg-vitastock-primary-subtle/90
												data-active:hover:text-vitastock-primary-dark"
											asChild={true}
										>
											<NavLink to={item.href}>
												{(ctx) => (
													<>
														<IconBox
															icon={ctx.isActive ? item.iconActive : item.icon}
															className="size-4.5 shrink-0"
														/>
														<p>{item.title}</p>
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
