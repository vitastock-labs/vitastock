import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { backendApiSchemaRoutes } from "@vitastock/shared/validation/backendApiSchema";
import type { InferProps } from "@zayne-labs/toolkit-react/utils";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useDialogContext } from "@/components/animated/primitives/dialog-radix";
import { DialogAnimated } from "@/components/animated/ui";
import { IconBox, type MoniconIconBoxProps } from "@/components/common/IconBox";
import { Avatar, Button, DropdownMenu, Select } from "@/components/ui";
import {
	DataTable,
	DataTableColumnHeader,
	DataTableToolbar,
	useDataTable,
} from "@/components/ui/data-table";
import { Form } from "@/components/ui/form";
import { Switch as SwitchButton } from "@/components/ui/switch";
import { callBackendApiForQuery } from "@/lib/api/callBackendApi";
import { WorkspaceRoleSchema } from "@/lib/api/callBackendApi/apiSchema";
import {
	cancelWorkspaceInvitationMutation,
	changeWorkspaceMemberRoleMutation,
	removeWorkspaceMemberMutation,
	suspendWorkspaceMemberMutation,
} from "@/lib/react-query/mutationOptions";
import {
	dashboardOverviewQuery,
	inventoryAlertsQueryKey,
	sessionQuery,
	workspaceMembersQuery,
	type WorkspaceMembersQueryResultType,
} from "@/lib/react-query/queryOptions";
import { cnJoin, cnMerge } from "@/lib/utils/cn";
import { getNameInitials } from "@/lib/utils/common";
import { formatDate } from "@/lib/utils/formatters";
import { DrugMasterDialog } from "../-components/DrugMasterDialog";
import { Main } from "../-components/Main";

function SettingsPage() {
	return (
		<Main className="max-w-225 gap-8 self-center">
			<header className="flex flex-col gap-1.5">
				<h1 className="text-[28px] font-extrabold tracking-tight text-black">System Settings</h1>
				<p className="text-[15px] font-medium text-vitastock-body-color/80">
					Manage your workspace preferences and alert configurations.
				</p>
			</header>

			<div className="flex flex-col gap-8">
				<PeopleWorkspaceSection />

				<AlertSettingsSection />

				<DrugManagementSection />
			</div>
		</Main>
	);
}

export default SettingsPage;

function DrugManagementSection() {
	const sessionQueryResult = useQuery(sessionQuery());
	const currentUserRole = sessionQueryResult.data?.user.role;

	if (currentUserRole !== "owner" && currentUserRole !== "admin") return null;

	return (
		<section
			className="flex flex-col items-start justify-between gap-5 rounded-xl border
				border-vitastock-primary-main/20 bg-vitastock-primary-dark/5 p-6 sm:flex-row sm:items-center"
		>
			<div className="flex flex-col gap-1.5">
				<h2 className="text-[16px] font-bold text-black">Drug Management</h2>
				<p className="text-[14.5px] font-medium text-vitastock-body-color/90">
					Add, edit, and manage the medicines in your Drug Master.
				</p>
			</div>

			<DialogAnimated.Root>
				<DialogAnimated.Trigger asChild={true}>
					<Button
						className="h-10.5 rounded-lg bg-vitastock-primary-dark px-5
							hover:bg-vitastock-primary-dark/90"
					>
						<IconBox icon="lucide:book-user" className="size-4" />
						Manage Drug List
					</Button>
				</DialogAnimated.Trigger>

				<DrugMasterDialog />
			</DialogAnimated.Root>
		</section>
	);
}

const AlertSettingsSchema = backendApiSchemaRoutes["@patch/workspace/alert-settings"].body;

function AlertSettingsSection() {
	const sessionQueryResult = useQuery(sessionQuery());
	const queryClient = useQueryClient();
	const currentUser = sessionQueryResult.data?.user;
	const canUpdateAlertSettings = currentUser?.role === "owner" || currentUser?.role === "admin";

	const form = useForm({
		resolver: zodResolver(AlertSettingsSchema),
		values: {
			alertEmail: sessionQueryResult.data?.workspace.alertEmail ?? undefined,
			emailAlertsEnabled: Boolean(sessionQueryResult.data?.workspace.alertEmail),
			lowStockThreshold: sessionQueryResult.data?.workspace.lowStockThreshold ?? 0,
			nearExpiryDays: sessionQueryResult.data?.workspace.nearExpiryDays ?? 0,
		},
	});

	const onSubmit = form.handleSubmit(async (data) => {
		await callBackendApiForQuery("@patch/workspace/alert-settings", {
			body: data,
			meta: { toast: { success: true } },
			onSuccess: () => {
				void queryClient.invalidateQueries(sessionQuery());
				void queryClient.invalidateQueries(dashboardOverviewQuery());
				void queryClient.invalidateQueries({ queryKey: inventoryAlertsQueryKey });
			},
		});
	});

	return (
		<section className="flex flex-col rounded-xl bg-white ring-1 ring-shadcn-border/60">
			<div className="flex items-center gap-2.5 border-b border-shadcn-border/50 p-5">
				<IconBox icon="lucide:bell" className="size-5 text-vitastock-primary-main" />
				<h2 className="text-[16px] font-bold text-black">Alert Settings</h2>
			</div>

			<Form.Root form={form} onSubmit={(event) => void onSubmit(event)} className="flex flex-col p-6">
				<article className="flex items-center justify-between border-b border-shadcn-border/50 pb-6">
					<div className="flex flex-col gap-1">
						<h3 className="text-[14.5px] font-bold text-black">Low Stock Threshold</h3>
						<p className="text-[13.5px] font-medium text-vitastock-body-color/80">
							Trigger alert when item quantity falls below this number.
						</p>
					</div>

					<Form.Field control={form.control} name="lowStockThreshold">
						<Form.Input
							type="number"
							className="h-10 w-25 rounded-lg border border-shadcn-border bg-transparent px-3
								text-center text-[14.5px] font-medium text-black transition-colors outline-none
								focus-within:border-vitastock-primary-main focus-within:ring-1
								focus-within:ring-vitastock-primary-main"
						/>
						<Form.ErrorMessage />
					</Form.Field>
				</article>

				<article className="flex items-center justify-between border-b border-shadcn-border/50 py-6">
					<div className="flex flex-col gap-1">
						<h3 className="text-[14.5px] font-bold text-black">Email Alerts</h3>
						<p className="text-[13.5px] font-medium text-vitastock-body-color/80">
							Receive critical stock warnings via email.
						</p>
					</div>

					<Form.FieldWithController
						control={form.control}
						name="emailAlertsEnabled"
						render={({ field }) => (
							<SwitchButton
								checked={field.value}
								onCheckedChange={field.onChange}
								classNames={{
									base: "data-checked:bg-vitastock-primary-dark",
									thumb: "data-checked:bg-white data-unchecked:bg-vitastock-primary-dark",
								}}
							/>
						)}
					/>
				</article>

				<Form.Watch name="emailAlertsEnabled">
					{(emailAlertsEnabled) => (
						<Form.Field control={form.control} name="alertEmail" className="pt-6">
							<Form.Label className="text-[14.5px] font-bold text-black">Alert Email</Form.Label>
							<Form.Description>
								Immediate alerts and daily digests are sent to this address and active workspace
								managers.
							</Form.Description>
							<Form.Input
								type="email"
								disabled={!canUpdateAlertSettings || !emailAlertsEnabled}
								placeholder="alerts@pharmacy.com"
								className="mt-2 h-10 rounded-lg border border-shadcn-border bg-transparent px-3
									text-[14.5px] font-medium text-black transition-colors outline-none
									placeholder:text-vitastock-body-color/60
									focus-within:border-vitastock-primary-main focus-within:ring-1
									focus-within:ring-vitastock-primary-main"
							/>
							<Form.ErrorMessage />
						</Form.Field>
					)}
				</Form.Watch>

				<article className="flex items-center justify-between pt-6">
					<div className="flex flex-col gap-1">
						<h3 className="text-[14.5px] font-bold text-black">Near-Expiry Window</h3>
						<p className="text-[13.5px] font-medium text-vitastock-body-color/80">
							Flag batches that expire within this number of days.
						</p>
					</div>

					<Form.Field control={form.control} name="nearExpiryDays">
						<Form.Input
							type="number"
							disabled={!canUpdateAlertSettings}
							className="h-10 w-25 rounded-lg border border-shadcn-border bg-transparent px-3
								text-center text-[14.5px] font-medium text-black transition-colors outline-none
								focus-within:border-vitastock-primary-main focus-within:ring-1
								focus-within:ring-vitastock-primary-main"
						/>
						<Form.ErrorMessage />
					</Form.Field>
				</article>

				{canUpdateAlertSettings && (
					<div className="mt-6 flex justify-end">
						<Form.Submit asChild={true}>
							{(formState) => (
								<Button isDisabled={formState.isSubmitting} isLoading={formState.isSubmitting}>
									Save Alert Settings
								</Button>
							)}
						</Form.Submit>
					</div>
				)}
			</Form.Root>
		</section>
	);
}

function PeopleWorkspaceSection() {
	return (
		<section className="flex flex-col rounded-xl bg-white shadow-sm ring-1 ring-shadcn-border/70">
			<div className="flex items-center gap-2.5 border-b border-shadcn-border/50 p-5">
				<IconBox icon="lucide:users-round" className="size-5 text-vitastock-primary-main" />
				<h2 className="text-[16px] font-bold text-black">People & Workspace</h2>
			</div>

			<div className="flex flex-col items-start justify-between gap-5 p-6 sm:flex-row sm:items-center">
				<p className="text-[14.5px] font-medium text-vitastock-body-color/90">
					Manage workspace members, invitations, and access.
				</p>

				<DialogAnimated.Root>
					<DialogAnimated.Trigger asChild={true}>
						<Button
							className="h-10.5 rounded-lg bg-vitastock-primary-dark px-5
								hover:bg-vitastock-primary-dark/90"
						>
							<IconBox icon="lucide:users-round" className="size-4" />
							Manage People
						</Button>
					</DialogAnimated.Trigger>

					<ManagePeopleDialog />
				</DialogAnimated.Root>
			</div>
		</section>
	);
}

type Member = WorkspaceMembersQueryResultType["members"][number];

const isInvitationMember = (member: Member) => {
	return member.status === "pending" || member.status === "expired";
};

const getMemberEmail = (member: Member) => {
	return isInvitationMember(member) ? member.inviteeEmail : member.email;
};

const getMemberName = (member: Member) => {
	return isInvitationMember(member) ? member.inviteeName : member.fullName;
};

const getMemberInitials = (member: Member) => {
	return getNameInitials(getMemberName(member));
};

const getJoinedDate = (member: Member) => {
	return isInvitationMember(member) ? "-" : formatDate(member.createdAt);
};

const WORKSPACE_ROLE_FILTER_OPTIONS = WorkspaceRoleSchema.options.map((role) => ({
	label: `${role.charAt(0).toUpperCase()}${role.slice(1)}`,
	value: role,
}));
function ManagePeopleDialog() {
	const workspaceMembersQueryResult = useQuery(workspaceMembersQuery());
	const tableMembers = workspaceMembersQueryResult.data?.members ?? [];
	const sessionQueryResult = useQuery(sessionQuery());
	const currentUser = sessionQueryResult.data?.user;
	const canInviteMembers = currentUser?.role === "owner" || currentUser?.role === "admin";
	const columns = useMemo<Array<ColumnDef<Member>>>(
		() => [
			{
				accessorFn: getMemberName,
				cell: ({ row }) => (
					<div className="flex items-center gap-3">
						<MemberAvatar member={row.original} />
						<p className="text-black">
							{getMemberName(row.original)}
							{row.original.isCurrentUser && (
								<span className="ml-1.5 text-vitastock-body-color/70">(you)</span>
							)}
						</p>
					</div>
				),
				filterFn: (row, _columnId, filterValue: string) => {
					const normalizedFilterValue = filterValue.trim().toLowerCase();

					return (
						getMemberName(row.original).toLowerCase().includes(normalizedFilterValue)
						|| getMemberEmail(row.original).toLowerCase().includes(normalizedFilterValue)
					);
				},
				header: ({ column }) => <DataTableColumnHeader column={column}>Name</DataTableColumnHeader>,
				id: "name",
				meta: {
					placeholder: "Search members...",
					variant: "text",
				},
			},
			{
				accessorFn: getMemberEmail,
				cell: ({ row }) => (
					<span className="text-vitastock-body-color">{getMemberEmail(row.original)}</span>
				),
				header: ({ column }) => <DataTableColumnHeader column={column}>Email</DataTableColumnHeader>,
				id: "email",
			},
			{
				accessorKey: "role",
				cell: ({ row }) => <RoleBadge role={row.original.role} />,
				filterFn: "equalsString",
				header: ({ column }) => <DataTableColumnHeader column={column}>Role</DataTableColumnHeader>,
				meta: {
					label: "All Roles",
					options: WORKSPACE_ROLE_FILTER_OPTIONS,
					variant: "select",
				},
			},
			{
				accessorFn: getJoinedDate,
				cell: ({ row }) => (
					<span className="text-vitastock-body-color">{getJoinedDate(row.original)}</span>
				),
				header: ({ column }) => (
					<DataTableColumnHeader column={column}>Joined Date</DataTableColumnHeader>
				),
				id: "joinedDate",
			},
			{
				accessorKey: "status",
				cell: ({ row }) => <StatusLabel status={row.original.status} />,
				enableSorting: false,
				header: "Status",
			},
			{
				cell: ({ row }) => (
					<div className="flex justify-end">
						<MemberActionsDropdown currentUserRole={currentUser?.role} member={row.original} />
					</div>
				),
				enableSorting: false,
				header: () => <span className="block text-right">Actions</span>,
				id: "actions",
			},
		],
		[currentUser?.role]
	);
	const table = useDataTable({
		columns,
		data: tableMembers,
		getRowId: (member) => member.id,
		initialState: {
			pagination: {
				pageIndex: 0,
				pageSize: 10,
			},
			sorting: [{ desc: false, id: "name" }],
		},
	});

	return (
		<DialogAnimated.Content
			onInteractOutside={(event) => event.preventDefault()}
			withCloseButton={false}
			className="flex h-[calc(100svh-120px)] w-[calc(100vw-120px)] max-w-[unset] flex-col gap-0
				overflow-hidden rounded-2xl border-shadcn-border bg-white p-0 shadow-2xl"
		>
			<DialogAnimated.Header
				className="flex-row items-start justify-between gap-6 border-b border-shadcn-border/70 px-6
					py-5"
			>
				<div className="flex flex-col gap-1">
					<DialogAnimated.Title
						className="text-[20px] leading-tight font-bold tracking-tight text-black"
					>
						Manage People
					</DialogAnimated.Title>
					<DialogAnimated.Description className="text-[14px] font-medium text-vitastock-body-color/90">
						Manage workspace members and their roles.
					</DialogAnimated.Description>
				</div>

				<DialogAnimated.Close
					className="rounded-lg p-1 text-vitastock-body-color transition-colors hover:bg-shadcn-muted"
				>
					<IconBox icon="lucide:x" className="size-6" />
					<span className="sr-only">Close</span>
				</DialogAnimated.Close>
			</DialogAnimated.Header>

			<section className="flex min-h-0 grow flex-col">
				<DataTable
					table={table}
					isError={workspaceMembersQueryResult.isError}
					isLoading={workspaceMembersQueryResult.isLoading}
					emptyMessage="No workspace members match these filters."
					errorMessage="Failed to load members. Please try again later."
					classNames={{
						base: "min-h-0 grow overflow-hidden text-[14px] font-medium",
						tableCell: "px-6 py-4",
						tableContainer: "min-h-0 grow overflow-auto",
						tableHead: `h-11 px-6 text-[12px] font-bold tracking-wider text-vitastock-body-color
						uppercase`,
						tableHeader: "bg-shadcn-muted",
						tableRow: "border-b border-shadcn-border",
					}}
				>
					<DataTableToolbar
						table={table}
						actions={
							canInviteMembers && (
								<DialogAnimated.Root>
									<DialogAnimated.Trigger asChild={true}>
										<Button
											className="h-10 rounded-lg bg-vitastock-primary-main px-4 text-[14px]
												font-bold hover:bg-vitastock-primary-main/90"
										>
											<IconBox icon="lucide:plus" className="size-4.5" />
											Invite Member
										</Button>
									</DialogAnimated.Trigger>

									<InviteMemberDialog />
								</DialogAnimated.Root>
							)
						}
					/>
				</DataTable>
			</section>
		</DialogAnimated.Content>
	);
}

type MemberActionsDropdownProps = {
	currentUserRole: Member["role"] | undefined;
	member: Member;
};

type MemberActionPermissions = {
	canCancelInvitation: boolean;
	canChangeRole: boolean;
	canRemoveMember: boolean;
	canResendInvitation: boolean;
	canSuspendMember: boolean;
	canUnsuspendMember: boolean;
};

const noMemberActions = {
	canCancelInvitation: false,
	canChangeRole: false,
	canRemoveMember: false,
	canResendInvitation: false,
	canSuspendMember: false,
	canUnsuspendMember: false,
} satisfies MemberActionPermissions;

const getMemberActionPermissions = (props: MemberActionsDropdownProps): MemberActionPermissions => {
	const { currentUserRole, member } = props;

	const userCanManagePeople = currentUserRole === "owner" || currentUserRole === "admin";

	if (!userCanManagePeople) {
		return noMemberActions;
	}

	if (isInvitationMember(member)) {
		const ownerCanManageInvite = currentUserRole === "owner";
		const adminCanManageInvite = currentUserRole === "admin" && member.role === "pharmacist";
		const canManageInvite = ownerCanManageInvite || adminCanManageInvite;

		return {
			...noMemberActions,
			canCancelInvitation: canManageInvite,
			canResendInvitation: canManageInvite,
		};
	}

	if (member.isCurrentUser) {
		return noMemberActions;
	}

	if (currentUserRole === "admin" && member.role !== "pharmacist") {
		return noMemberActions;
	}

	if (member.role === "owner") {
		return noMemberActions;
	}

	const memberIsActive = member.status === "active";
	const userIsOwner = currentUserRole === "owner";

	return {
		canCancelInvitation: false,
		canChangeRole: userIsOwner && memberIsActive,
		canRemoveMember: true,
		canResendInvitation: false,
		canSuspendMember: memberIsActive,
		canUnsuspendMember: member.status === "suspended",
	};
};

function MemberActionsDropdown(props: MemberActionsDropdownProps) {
	const { currentUserRole, member } = props;

	const queryClient = useQueryClient();
	const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
	const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false);
	const cancelInvitationMutation = useMutation(cancelWorkspaceInvitationMutation());
	const changeRoleMutation = useMutation(changeWorkspaceMemberRoleMutation());
	const removeMemberMutation = useMutation(removeWorkspaceMemberMutation());
	const suspendMemberMutation = useMutation(suspendWorkspaceMemberMutation());

	const invalidateMembersQuery = () => {
		void queryClient.invalidateQueries(workspaceMembersQuery());
	};

	const permissions = getMemberActionPermissions({ currentUserRole, member });

	const hasPendingMutation =
		cancelInvitationMutation.isPending
		|| changeRoleMutation.isPending
		|| removeMemberMutation.isPending
		|| suspendMemberMutation.isPending;

	return (
		<>
			<DropdownMenu.Root modal={false}>
				<DropdownMenu.Trigger
					className="inline-flex rounded-md p-1.5 text-vitastock-body-color/70 hover:bg-shadcn-muted"
					aria-label={`Open actions for ${getMemberName(member)}`}
				>
					<IconBox icon="lucide:ellipsis" className="size-4.5" />
				</DropdownMenu.Trigger>

				<DropdownMenu.Content
					align="end"
					className="w-58 rounded-xl border border-shadcn-border/80 bg-white p-1.5 shadow-xl
						shadow-black/10"
				>
					<DropdownMenu.Item asChild={true}>
						<MemberActionMenuButton icon="lucide:eye" onClick={() => setIsDetailsDialogOpen(true)}>
							View details
						</MemberActionMenuButton>
					</DropdownMenu.Item>

					{permissions.canChangeRole && (
						<DropdownMenu.SubRoot>
							<DropdownMenu.SubTrigger>
								<MemberActionMenuButton icon="lucide:user-cog">Change role</MemberActionMenuButton>
							</DropdownMenu.SubTrigger>

							<DropdownMenu.SubContent
								className="w-54 rounded-xl border border-shadcn-border/80 bg-white p-1.5 shadow-xl
									shadow-black/10"
							>
								{member.role === "pharmacist" && (
									<DropdownMenu.Item onSelect={(event) => event.preventDefault()} asChild={true}>
										<MemberActionMenuButton
											icon="lucide:shield"
											isDisabled={hasPendingMutation}
											isLoading={changeRoleMutation.isPending}
											onClick={() =>
												changeRoleMutation.mutate(
													{ memberId: member.id, role: "admin" },
													{ onSuccess: invalidateMembersQuery }
												)
											}
										>
											Make admin
										</MemberActionMenuButton>
									</DropdownMenu.Item>
								)}

								{member.role === "admin" && (
									<DropdownMenu.Item onSelect={(event) => event.preventDefault()} asChild={true}>
										<MemberActionMenuButton
											icon="lucide:user-round"
											isDisabled={hasPendingMutation}
											isLoading={changeRoleMutation.isPending}
											onClick={() =>
												changeRoleMutation.mutate(
													{ memberId: member.id, role: "pharmacist" },
													{ onSuccess: invalidateMembersQuery }
												)
											}
										>
											Make pharmacist
										</MemberActionMenuButton>
									</DropdownMenu.Item>
								)}
							</DropdownMenu.SubContent>
						</DropdownMenu.SubRoot>
					)}

					{(permissions.canResendInvitation || permissions.canCancelInvitation) && (
						<>
							<DropdownMenu.Separator />

							{permissions.canResendInvitation && (
								<DialogAnimated.Root>
									<DialogAnimated.Trigger asChild={true}>
										<DropdownMenu.Item
											onSelect={(event) => event.preventDefault()}
											asChild={true}
										>
											<MemberActionMenuButton
												icon="lucide:send"
												isDisabled={hasPendingMutation}
											>
												Resend invitation
											</MemberActionMenuButton>
										</DropdownMenu.Item>
									</DialogAnimated.Trigger>

									<ResendInvitationDialog invitationId={member.id} />
								</DialogAnimated.Root>
							)}

							{permissions.canCancelInvitation && (
								<DropdownMenu.Item
									variant="destructive"
									onSelect={(event) => event.preventDefault()}
									asChild={true}
								>
									<MemberActionMenuButton
										icon="lucide:x"
										isDisabled={hasPendingMutation}
										isLoading={cancelInvitationMutation.isPending}
										onClick={() =>
											cancelInvitationMutation.mutate(
												{ invitationId: member.id },
												{ onSuccess: invalidateMembersQuery }
											)
										}
									>
										Cancel invitation
									</MemberActionMenuButton>
								</DropdownMenu.Item>
							)}
						</>
					)}

					{(permissions.canSuspendMember
						|| permissions.canUnsuspendMember
						|| permissions.canRemoveMember) && <DropdownMenu.Separator />}

					{permissions.canSuspendMember && (
						<DropdownMenu.Item onSelect={(event) => event.preventDefault()} asChild={true}>
							<MemberActionMenuButton
								icon="lucide:user-round-x"
								isDisabled={hasPendingMutation}
								isLoading={suspendMemberMutation.isPending}
								onClick={() =>
									suspendMemberMutation.mutate(
										{ action: "suspend", memberId: member.id },
										{ onSuccess: invalidateMembersQuery }
									)
								}
							>
								Suspend member
							</MemberActionMenuButton>
						</DropdownMenu.Item>
					)}

					{permissions.canUnsuspendMember && (
						<DropdownMenu.Item onSelect={(event) => event.preventDefault()} asChild={true}>
							<MemberActionMenuButton
								icon="lucide:user-check"
								isDisabled={hasPendingMutation}
								isLoading={suspendMemberMutation.isPending}
								onClick={() =>
									suspendMemberMutation.mutate(
										{ action: "unsuspend", memberId: member.id },
										{ onSuccess: invalidateMembersQuery }
									)
								}
							>
								Unsuspend member
							</MemberActionMenuButton>
						</DropdownMenu.Item>
					)}

					{permissions.canRemoveMember && (
						<DropdownMenu.Item variant="destructive" asChild={true}>
							<MemberActionMenuButton
								icon="lucide:trash-2"
								isDisabled={hasPendingMutation}
								onClick={() => setIsRemoveDialogOpen(true)}
							>
								Remove from workspace
							</MemberActionMenuButton>
						</DropdownMenu.Item>
					)}
				</DropdownMenu.Content>
			</DropdownMenu.Root>

			<MemberDetailsDialog
				isOpen={isDetailsDialogOpen}
				member={member}
				onOpenChange={setIsDetailsDialogOpen}
			/>

			<ConfirmRemoveMemberDialog
				isLoading={removeMemberMutation.isPending}
				member={isRemoveDialogOpen ? member : null}
				onClose={() => setIsRemoveDialogOpen(false)}
				onConfirm={() =>
					removeMemberMutation.mutate(
						{ memberId: member.id },
						{
							onSuccess: () => {
								setIsRemoveDialogOpen(false);
								invalidateMembersQuery();
							},
						}
					)
				}
			/>
		</>
	);
}

function MemberDetailsDialog(props: {
	isOpen: boolean;
	member: Member;
	onOpenChange: (isOpen: boolean) => void;
}) {
	const { isOpen, member, onOpenChange } = props;

	return (
		<DialogAnimated.Root open={isOpen} onOpenChange={onOpenChange}>
			<DialogAnimated.Content
				className="max-w-[440px] gap-0 overflow-hidden rounded-2xl border-shadcn-border bg-white p-0
					shadow-2xl"
			>
				<DialogAnimated.Header className="border-b border-shadcn-border/70 px-6 py-5">
					<div className="flex items-center gap-3">
						<MemberAvatar member={member} />
						<div className="min-w-0">
							<DialogAnimated.Title className="truncate text-[18px] font-bold text-black">
								{getMemberName(member)}
							</DialogAnimated.Title>
							<DialogAnimated.Description
								className="truncate text-[14px] font-medium text-vitastock-body-color"
							>
								{getMemberEmail(member)}
							</DialogAnimated.Description>
						</div>
					</div>
				</DialogAnimated.Header>

				<div className="grid gap-4 p-6">
					<MemberDetailRow label="Role" value={<RoleBadge role={member.role} />} />
					<MemberDetailRow label="Status" value={<StatusLabel status={member.status} />} />
					<MemberDetailRow label="Joined" value={getJoinedDate(member)} />

					{isInvitationMember(member) && (
						<MemberDetailRow label="Invitation expires" value={formatDate(member.expiresAt)} />
					)}

					{member.status === "suspended" && (
						<MemberDetailRow label="Suspended" value={formatDate(member.suspendedAt)} />
					)}
				</div>

				<DialogAnimated.Footer className="flex-row justify-end border-t border-shadcn-border/70 p-4">
					<DialogAnimated.Close asChild={true}>
						<Button theme="primary-ghost" className="h-10">
							Close
						</Button>
					</DialogAnimated.Close>
				</DialogAnimated.Footer>
			</DialogAnimated.Content>
		</DialogAnimated.Root>
	);
}

function MemberDetailRow(props: { label: string; value: React.ReactNode }) {
	const { label, value } = props;

	return (
		<div className="grid grid-cols-[120px_1fr] items-center gap-4">
			<p className="text-[13px] font-bold text-vitastock-body-color/70">{label}</p>
			<div className="min-w-0 text-[14px] font-semibold text-black">{value}</div>
		</div>
	);
}

type MemberActionMenuButtonProps = InferProps<typeof Button> & {
	icon: MoniconIconBoxProps["icon"];
};

function MemberActionMenuButton(props: MemberActionMenuButtonProps) {
	const { children, className, icon, isDisabled, isLoading, onClick, ...restOfProps } = props;

	return (
		<Button
			theme="none"
			size="none"
			isDisabled={isDisabled}
			isLoading={isLoading}
			loadingStyle="side-by-side"
			className={cnMerge("w-full justify-start", className)}
			onClick={onClick}
			{...restOfProps}
		>
			<IconBox icon={icon} className="size-4 justify-self-center" />
			<p className="truncate">{children}</p>
		</Button>
	);
}

function ConfirmRemoveMemberDialog(props: {
	isLoading: boolean;
	member: Member | null;
	onClose: () => void;
	onConfirm: () => void;
}) {
	const { isLoading, member, onClose, onConfirm } = props;

	return (
		<DialogAnimated.Root open={Boolean(member)} onOpenChange={(isOpen) => !isOpen && onClose()}>
			{member && (
				<DialogAnimated.Content
					withCloseButton={false}
					className="max-w-[420px] gap-0 overflow-hidden rounded-2xl border-shadcn-border bg-white p-0
						shadow-2xl"
				>
					<DialogAnimated.Header className="border-b border-shadcn-border/70 px-6 py-5">
						<DialogAnimated.Title className="text-[18px] font-bold text-black">
							Remove member from workspace?
						</DialogAnimated.Title>
						<DialogAnimated.Description
							className="mt-2 text-[14px] leading-relaxed text-vitastock-body-color"
						>
							This removes {getMemberName(member)} ({getMemberEmail(member)}) from the workspace and
							revokes their access. Their identity is retained in historical stock records.
						</DialogAnimated.Description>
					</DialogAnimated.Header>

					<DialogAnimated.Footer className="flex-row justify-end gap-3 p-4">
						<Button theme="primary-ghost" className="h-10" onClick={onClose}>
							Cancel
						</Button>

						<Button
							isDisabled={isLoading}
							isLoading={isLoading}
							className="h-10 bg-shadcn-destructive text-white hover:bg-shadcn-destructive/90"
							onClick={onConfirm}
						>
							<IconBox icon="lucide:trash-2" className="size-4" />
							Remove member
						</Button>
					</DialogAnimated.Footer>
				</DialogAnimated.Content>
			)}
		</DialogAnimated.Root>
	);
}

const InviteMemberSchema = backendApiSchemaRoutes["@post/workspace/invitation/send"].body;

function InviteMemberDialog() {
	const form = useForm({
		defaultValues: {
			defaultPassword: "",
			inviteeEmail: "",
			inviteeName: "",
			role: "pharmacist" as const,
		},
		resolver: zodResolver(InviteMemberSchema),
	});

	const dialogCtx = useDialogContext();
	const queryClient = useQueryClient();

	const onSubmit = form.handleSubmit(async (data) => {
		await callBackendApiForQuery("@post/workspace/invitation/send", {
			body: data,
			meta: { toast: { success: true } },
			onSuccess: () => {
				void queryClient.invalidateQueries(workspaceMembersQuery());
				form.reset();
				dialogCtx.setIsOpen(false);
			},
		});
	});

	return (
		<DialogAnimated.Content
			withCloseButton={false}
			className="max-w-[448px] gap-0 overflow-hidden rounded-2xl border-shadcn-border bg-white p-0
				shadow-2xl"
		>
			<header
				className="flex items-start justify-between gap-6 border-b border-shadcn-border/70 px-6 py-5"
			>
				<div className="flex flex-col gap-1">
					<DialogAnimated.Title className="text-[20px] font-bold text-black">
						Invite Member
					</DialogAnimated.Title>
					<DialogAnimated.Description className="text-[14px] font-medium text-vitastock-body-color/90">
						Add a new member to your pharmacy workspace.
					</DialogAnimated.Description>
				</div>

				<DialogAnimated.Close
					className="rounded-lg p-1 text-vitastock-body-color transition-colors hover:bg-shadcn-muted"
				>
					<IconBox icon="lucide:x" className="size-6" />
					<span className="sr-only">Close</span>
				</DialogAnimated.Close>
			</header>

			<Form.Root form={form} onSubmit={(event) => void onSubmit(event)}>
				<div className="flex flex-col gap-5 border-y border-shadcn-border/70 p-6">
					<Form.Field control={form.control} name="inviteeName">
						<Form.Label className="text-[14px] font-medium text-black">
							Name of pharmacist
						</Form.Label>
						<Form.Description>
							This name will be used to track what this user does within the work space. It cannot
							be changed later.
						</Form.Description>
						<Form.Input
							placeholder="Enter full name"
							className="h-10 rounded-lg border border-shadcn-border bg-transparent px-4 text-[14px]
								font-medium text-black outline-none placeholder:text-vitastock-body-color/60
								focus-within:border-vitastock-primary-main focus-within:ring-1
								focus-within:ring-vitastock-primary-main"
						/>
						<Form.ErrorMessage />
					</Form.Field>

					<Form.Field control={form.control} name="inviteeEmail">
						<Form.Label className="text-[14px] font-medium text-black">Email Address</Form.Label>
						<Form.Input
							type="email"
							placeholder="e.g. name@company.com"
							className="h-10 rounded-lg border border-shadcn-border bg-transparent px-4 text-[14px]
								font-medium text-black outline-none placeholder:text-vitastock-body-color/60
								focus-within:border-vitastock-primary-main focus-within:ring-1
								focus-within:ring-vitastock-primary-main"
						/>
						<Form.ErrorMessage />
					</Form.Field>

					<Form.Field control={form.control} name="defaultPassword">
						<Form.Label className="text-[14px] font-medium text-black">Default Password</Form.Label>
						<Form.Input
							type="password"
							placeholder="Enter initial password"
							classNames={{
								inputGroup: `h-10 rounded-lg border border-shadcn-border bg-transparent px-4
								text-[16px] font-medium text-black outline-none
								focus-within:border-vitastock-primary-main focus-within:ring-1
								focus-within:ring-vitastock-primary-main`,
							}}
						/>
						<Form.ErrorMessage />
					</Form.Field>

					<Form.Field control={form.control} name="role">
						<Form.Label className="text-[14px] font-medium text-black">Role</Form.Label>
						<Form.FieldBoundController
							render={({ field }) => (
								<Select.Root value={field.value} onValueChange={field.onChange}>
									<Select.Trigger
										className="h-10 rounded-lg border border-shadcn-border bg-white px-4
											text-[14px] font-medium text-black"
									>
										<Select.Value placeholder="Select role" />
									</Select.Trigger>
									<Select.Content classNames={{ viewport: "gap-1" }}>
										<Select.Item value="pharmacist">Pharmacist</Select.Item>
										<Select.Item value="admin">Admin</Select.Item>
									</Select.Content>
								</Select.Root>
							)}
						/>
						<Form.ErrorMessage />
					</Form.Field>
				</div>

				<DialogAnimated.Footer className="flex-row items-center justify-end gap-3 p-4">
					<DialogAnimated.Close asChild={true}>
						<Button theme="primary-ghost" className="h-11">
							Cancel
						</Button>
					</DialogAnimated.Close>

					<Form.Submit asChild={true}>
						{(formState) => (
							<Button
								isDisabled={formState.isSubmitting}
								isLoading={formState.isSubmitting}
								className="h-11"
							>
								<IconBox icon="lucide:send-horizontal" className="size-5" />
								Send Invite
							</Button>
						)}
					</Form.Submit>
				</DialogAnimated.Footer>
			</Form.Root>
		</DialogAnimated.Content>
	);
}

const ResendInvitationSchema = backendApiSchemaRoutes["@post/workspace/invitation/resend"].body.omit({
	invitationId: true,
});

function ResendInvitationDialog(props: { invitationId: string }) {
	const { invitationId } = props;

	const form = useForm({
		defaultValues: {
			defaultPassword: "",
		},
		resolver: zodResolver(ResendInvitationSchema),
	});

	const dialogCtx = useDialogContext();
	const queryClient = useQueryClient();

	const onSubmit = form.handleSubmit(async (data) => {
		await callBackendApiForQuery("@post/workspace/invitation/resend", {
			body: { ...data, invitationId },
			meta: { toast: { success: true } },
			onSuccess: () => {
				void queryClient.invalidateQueries(workspaceMembersQuery());
				form.reset();
				dialogCtx.setIsOpen(false);
			},
		});
	});

	return (
		<DialogAnimated.Content
			withCloseButton={false}
			className="max-w-[448px] gap-0 overflow-hidden rounded-2xl border-shadcn-border bg-white p-0
				shadow-2xl"
		>
			<header
				className="flex items-start justify-between gap-6 border-b border-shadcn-border/70 px-6 py-5"
			>
				<div className="flex flex-col gap-1">
					<DialogAnimated.Title className="text-[20px] font-bold text-black">
						Resend Invitation
					</DialogAnimated.Title>
					<DialogAnimated.Description className="text-[14px] font-medium text-vitastock-body-color/90">
						Resend invitation to a pending workspace member.
					</DialogAnimated.Description>
				</div>

				<DialogAnimated.Close
					className="rounded-lg p-1 text-vitastock-body-color transition-colors hover:bg-shadcn-muted"
				>
					<IconBox icon="lucide:x" className="size-6" />
					<span className="sr-only">Close</span>
				</DialogAnimated.Close>
			</header>

			<Form.Root form={form} onSubmit={(event) => void onSubmit(event)}>
				<div className="flex flex-col gap-5 border-y border-shadcn-border/70 p-6">
					<Form.Field control={form.control} name="defaultPassword">
						<Form.Label className="text-[14px] font-medium text-black">Default Password</Form.Label>
						<Form.Input
							type="password"
							placeholder="Enter initial password"
							classNames={{
								inputGroup: `h-10 rounded-lg border border-shadcn-border bg-transparent px-4
								text-[16px] font-medium text-black outline-none
								focus-within:border-vitastock-primary-main focus-within:ring-1
								focus-within:ring-vitastock-primary-main`,
							}}
						/>
						<Form.ErrorMessage />
					</Form.Field>
				</div>

				<DialogAnimated.Footer className="flex-row items-center justify-end gap-3 p-4">
					<DialogAnimated.Close asChild={true}>
						<Button theme="primary-ghost" className="h-11">
							Cancel
						</Button>
					</DialogAnimated.Close>

					<Form.Submit asChild={true}>
						{(formState) => (
							<Button
								isDisabled={formState.isSubmitting}
								isLoading={formState.isSubmitting}
								className="h-11"
							>
								<IconBox icon="lucide:send-horizontal" className="size-5" />
								Resend Invite
							</Button>
						)}
					</Form.Submit>
				</DialogAnimated.Footer>
			</Form.Root>
		</DialogAnimated.Content>
	);
}

function MemberAvatar(props: { member: Member }) {
	const { member } = props;

	if (isInvitationMember(member)) {
		return (
			<span
				className="grid size-9 place-items-center rounded-full border border-dashed
					border-vitastock-body-color/30 bg-shadcn-muted text-vitastock-body-color/70"
			>
				<IconBox icon="lucide:mail" className="size-4.5" />
			</span>
		);
	}

	return (
		<Avatar.Root
			className={cnJoin(
				"size-9",
				member.isCurrentUser && "bg-vitastock-primary-main",
				member.status === "suspended" && "bg-rose-50 ring-1 ring-rose-200",
				!member.isCurrentUser
					&& member.status !== "suspended"
					&& "bg-shadcn-muted ring-1 ring-shadcn-border"
			)}
		>
			<Avatar.Fallback
				className={cnJoin(
					"text-[12px] font-extrabold",
					member.isCurrentUser && "bg-vitastock-primary-main text-white",
					member.status === "suspended" && "bg-rose-50 text-rose-700",
					!member.isCurrentUser && member.status !== "suspended" && "text-vitastock-body-color"
				)}
			>
				{getMemberInitials(member)}
			</Avatar.Fallback>
		</Avatar.Root>
	);
}

function RoleBadge(props: { role: Member["role"] }) {
	const { role } = props;

	if (role === "owner") {
		return (
			<span
				className="inline-flex items-center gap-1.5 rounded-md bg-vitastock-primary-main/10 px-2.5 py-1
					text-[12px] font-bold text-vitastock-primary-darker"
			>
				<IconBox icon="lucide:shield-check" className="size-3.5 text-vitastock-primary-main" />
				Owner
			</span>
		);
	}

	return <span className="text-vitastock-body-color capitalize">{role}</span>;
}

function StatusLabel(props: { status: Member["status"] }) {
	const { status } = props;

	return (
		<span className="inline-flex items-center gap-2 text-vitastock-body-color capitalize">
			<span
				className={cnJoin(
					"size-2 rounded-full",
					status === "active" && "bg-emerald-500",
					status === "suspended" && "bg-rose-500",
					status === "expired" && "bg-zinc-400",
					status === "pending" && "bg-amber-500"
				)}
			/>
			{status}
		</span>
	);
}
