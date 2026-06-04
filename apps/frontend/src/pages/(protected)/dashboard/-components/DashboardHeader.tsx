import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router";
import { AvatarGroupAnimated } from "@/components/animated/ui";
import { IconBox } from "@/components/common/IconBox";
import { NavLink } from "@/components/common/NavLink";
import { Button, DropdownMenu } from "@/components/ui";
import * as Avatar from "@/components/ui/avatar";
import { Form } from "@/components/ui/form";
import { signoutMutation } from "@/lib/react-query/mutationOptions";
import { sessionQuery } from "@/lib/react-query/queryOptions";
import { getNameInitials } from "@/lib/utils/common";

function DashboardHeader() {
	const pathname = useLocation().pathname;

	const getPlaceholder = () => {
		switch (pathname) {
			case "/dashboard":
			case "/dashboard/inventory": {
				return "Search inventory...";
			}
			case "/dashboard/alerts": {
				return "Search alerts...";
			}
			case "/dashboard/reports": {
				return "Search reports...";
			}
			case "/dashboard/settings": {
				return "Search settings...";
			}
			default: {
				return null;
			}
		}
	};

	const placeholder = getPlaceholder();

	return (
		<header className="flex justify-between gap-10 border-b border-[hsl(231,20%,80%,0.15)] px-6 py-7">
			<span className="invisible w-[28px]" />

			<Form.InputGroup
				className="h-10 w-full max-w-[576px] gap-3.5 justify-self-center rounded-[12px] border
					border-[hsl(231,20%,80%,0.3)] bg-white px-4 py-1 text-[14px]"
			>
				<Form.InputLeftItem>
					<IconBox type="online" icon="lucide:search" />
				</Form.InputLeftItem>

				{placeholder && (
					<Form.InputPrimitive
						type="search"
						placeholder={placeholder}
						className="h-full placeholder:text-[14px]"
					/>
				)}
			</Form.InputGroup>

			<div className="flex items-center gap-6">
				<Button unstyled={true} className="relative hover:text-vitastock-primary-main">
					<IconBox icon="lucide:bell" className="size-5" />
					<span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-shadcn-destructive" />
				</Button>

				<ProfileDropdown />
			</div>
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

			<DropdownMenu.Content align="end" sideOffset={10} className="w-72 rounded-xl p-2 shadow-xl">
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
						<IconBox type="online" icon="lucide:layout-dashboard" className="size-4" />
						Dashboard
					</NavLink>
				</DropdownMenu.Item>

				<DropdownMenu.Item asChild={true}>
					<NavLink to="/dashboard/settings" className="px-3 py-2">
						<IconBox type="online" icon="lucide:settings" className="size-4" />
						Settings
					</NavLink>
				</DropdownMenu.Item>

				<DropdownMenu.Separator />

				<DropdownMenu.Item variant="destructive" asChild={true}>
					<Button
						theme="primary-ghost"
						isLoading={signoutMutationResult.isPending}
						isDisabled={signoutMutationResult.isPending}
						loadingStyle="side-by-side"
						className="h-auto px-3 py-2"
						onClick={onSignout}
					>
						<IconBox type="online" icon="lucide:log-out" className="size-4" />
						Sign out
					</Button>
				</DropdownMenu.Item>
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	);
}
