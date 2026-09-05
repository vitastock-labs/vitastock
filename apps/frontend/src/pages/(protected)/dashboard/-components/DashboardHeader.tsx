import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { AvatarGroupAnimated } from "@/components/animated/ui";
import { IconBox } from "@/components/common/IconBox";
import { NavLink, NavLinkEphemeral } from "@/components/common/NavLink";
import { Button, DropdownMenu } from "@/components/ui";
import * as Avatar from "@/components/ui/avatar";
import { signoutMutation } from "@/lib/react-query/mutationOptions";
import { inventoryAlertsUnreadCountQuery, sessionQuery } from "@/lib/react-query/queryOptions";
import { getNameInitials } from "@/lib/utils/common";
import { LOADING_DISPLAY_VALUE } from "./constants";

function DashboardHeader() {
	const sessionQueryResult = useQuery(sessionQuery());
	const inventoryAlertsUnreadCountQueryResult = useQuery(inventoryAlertsUnreadCountQuery());
	const unreadAlertCount = inventoryAlertsUnreadCountQueryResult.data?.count ?? 0;

	return (
		<header
			className="flex min-w-0 items-center gap-4 border-b border-shadcn-border/40 px-4 py-5 sm:gap-6
				sm:px-6"
		>
			<div className="flex min-w-0 flex-1 flex-col gap-1">
				<p className="text-[15px] font-semibold wrap-anywhere text-shadcn-foreground sm:text-[18px]">
					{sessionQueryResult.data?.workspace.name ?? LOADING_DISPLAY_VALUE}
				</p>
				<p className="text-[12px] text-vitastock-body-color/70">Inventory workspace</p>
			</div>
			<NavLinkEphemeral to="/dashboard/alerts">
				<Button
					unstyled={true}
					className="relative grid size-10 shrink-0 place-items-center rounded-lg
						hover:bg-vitastock-primary-main/5 hover:text-vitastock-primary-main
						focus-visible:outline-2 focus-visible:outline-vitastock-primary-main"
					aria-label={`Inventory alerts, ${unreadAlertCount} unread`}
				>
					<IconBox icon="lucide:bell" className="size-5" />
					{unreadAlertCount > 0 && (
						<span
							className="absolute -top-1 -right-1 grid min-w-4 place-items-center rounded-full
								bg-shadcn-destructive px-1 py-0.5 text-[9px] leading-none font-bold text-white
								ring-2 ring-white"
						>
							{unreadAlertCount > 99 ? "99+" : unreadAlertCount}
						</span>
					)}
				</Button>
			</NavLinkEphemeral>

			<ProfileDropdown />
		</header>
	);
}

export { DashboardHeader };

function ProfileDropdown() {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const sessionQueryResult = useQuery(sessionQuery());

	const signoutMutationResult = useMutation(signoutMutation());

	const onSignout = () => {
		signoutMutationResult.mutate(undefined, {
			onSuccess: () => {
				void queryClient.invalidateQueries(sessionQuery());
				void navigate("/", { replace: true });
			},
		});
	};

	const userName = sessionQueryResult.data?.user.fullName ?? "VitaStock User";
	const userEmail = sessionQueryResult.data?.user.email ?? "No email available";
	const workspaceName = sessionQueryResult.data?.workspace.name ?? "Workspace";

	const userInitials = getNameInitials(userName) ?? "VS";

	return (
		<DropdownMenu.Root modal={false}>
			<DropdownMenu.Trigger
				className="rounded-full outline-none focus-visible:ring-2
					focus-visible:ring-vitastock-primary-main focus-visible:ring-offset-2"
			>
				<AvatarGroupAnimated.Root sideOffset={10} translate="5%">
					<div
						className="relative rounded-full p-0.5
							shadow-[0_10px_24px_-14px_theme(--color-vitastock-primary-darker)]"
					>
						<Avatar.Root className="size-10 bg-vitastock-primary-darker text-white ring-2 ring-white">
							<AvatarGroupAnimated.Tooltip
								classNames={{ base: "bg-vitastock-primary-darker text-white" }}
							>
								{userName}
							</AvatarGroupAnimated.Tooltip>

							<Avatar.Fallback
								className="bg-vitastock-primary-darker text-[12px] font-extrabold tracking-[0.04em]
									text-white"
							>
								{userInitials}
							</Avatar.Fallback>
						</Avatar.Root>

						<span
							className="absolute right-0 bottom-0 size-3 rounded-full border-2 border-white
								bg-emerald-500 shadow-[0_0_0_2px_rgba(16,185,129,0.18)]"
						/>
					</div>
				</AvatarGroupAnimated.Root>
			</DropdownMenu.Trigger>

			<DropdownMenu.Content align="end" sideOffset={10} className="w-72 rounded-xl p-2">
				<DropdownMenu.Label className="flex min-w-0 items-center gap-3 px-3 py-2">
					<Avatar.Root
						className="size-11 bg-vitastock-primary-darker text-white ring-1 ring-shadcn-border"
					>
						<Avatar.Fallback
							className="bg-vitastock-primary-darker text-[13px] font-extrabold tracking-[0.04em]
								text-white"
						>
							{userInitials}
						</Avatar.Fallback>
					</Avatar.Root>

					<div className="min-w-0">
						<p className="truncate text-[14px] font-bold text-black">{userName}</p>
						<p className="truncate text-[12px] font-medium text-vitastock-body-color/70">
							{userEmail}
						</p>
					</div>
				</DropdownMenu.Label>

				<DropdownMenu.Separator />

				<DropdownMenu.Label className="px-3 py-2">
					<p className="text-[11px] font-bold tracking-widest text-vitastock-body-color/50 uppercase">
						Workspace
					</p>
					<p className="mt-1 truncate text-[13px] font-semibold text-vitastock-body-color">
						{workspaceName}
					</p>
				</DropdownMenu.Label>

				<DropdownMenu.Separator />

				<DropdownMenu.Item asChild={true}>
					<NavLink to="/dashboard" className="px-3 py-2">
						<IconBox icon="lucide:layout-dashboard" className="size-4" />
						Dashboard
					</NavLink>
				</DropdownMenu.Item>

				<DropdownMenu.Item asChild={true}>
					<NavLink to="/dashboard/settings" className="px-3 py-2">
						<IconBox icon="lucide:settings" className="size-4" />
						Settings
					</NavLink>
				</DropdownMenu.Item>

				<DropdownMenu.Separator />

				<DropdownMenu.Item
					variant="destructive"
					onSelect={(event) => event.preventDefault()}
					asChild={true}
				>
					<Button
						theme="none"
						size="none"
						isLoading={signoutMutationResult.isPending}
						isDisabled={signoutMutationResult.isPending}
						className="px-3 py-2"
						loadingStyle="side-by-side"
						onClick={onSignout}
					>
						<IconBox icon="lucide:log-out" className="size-4" />
						Sign out
					</Button>
				</DropdownMenu.Item>
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	);
}
