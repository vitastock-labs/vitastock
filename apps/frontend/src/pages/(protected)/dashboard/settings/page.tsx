import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { backendApiSchemaRoutes } from "@vitastock/shared/validation/backendApiSchema";
import { tw } from "@zayne-labs/toolkit-core";
import type { InferProps } from "@zayne-labs/toolkit-react/utils";
import { defineEnum } from "@zayne-labs/toolkit-type-helpers";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useDialogContext } from "@/components/animated/primitives/dialog-radix";
import { DialogAnimated } from "@/components/animated/ui";
import { For } from "@/components/common/for";
import { IconBox, type MoniconIconBoxProps } from "@/components/common/IconBox";
import { Switch } from "@/components/common/switch";
import { Avatar, Button, DropdownMenu, Select, Table } from "@/components/ui";
import { Form } from "@/components/ui/form";
import { Switch as SwitchButton } from "@/components/ui/switch";
import { callBackendApiForQuery } from "@/lib/api/callBackendApi";
import {
	cancelWorkspaceInvitationMutation,
	changeWorkspaceMemberRoleMutation,
	permanentlyRemoveWorkspaceMemberMutation,
	resendWorkspaceInvitationMutation,
	suspendWorkspaceMemberMutation,
} from "@/lib/react-query/mutationOptions";
import {
	sessionQuery,
	workspaceMembersQuery,
	type WorkspaceMembersQueryResultType,
} from "@/lib/react-query/queryOptions";
import { cnJoin, cnMerge } from "@/lib/utils/cn";
import { getNameInitials } from "@/lib/utils/common";
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

				<section
					className="flex flex-col items-start justify-between gap-5 rounded-xl border
						border-vitastock-primary-main/20 bg-vitastock-primary-dark/5 p-6 sm:flex-row
						sm:items-center"
				>
					<div className="flex flex-col gap-1.5">
						<h2 className="text-[16px] font-bold text-black">Drug Management</h2>
						<p className="text-[14.5px] font-medium text-vitastock-body-color/90">
							Add, remove, or categorize items in your central inventory.
						</p>
					</div>

					<Button
						className="h-10.5 shrink-0 rounded-lg bg-vitastock-primary-dark px-5
							hover:bg-vitastock-primary-dark/90"
					>
						<IconBox icon="lucide:book-user" className="size-4" />
						Manage Drug List
					</Button>
				</section>
			</div>
		</Main>
	);
}

export default SettingsPage;

function AlertSettingsSection() {
	const sessionQueryResult = useQuery(sessionQuery());

	const form = useForm({
		values: {
			emailAlerts: Boolean(sessionQueryResult.data?.workspace.alertEmail),
			lowStockThreshold: sessionQueryResult.data?.workspace.lowStockThreshold ?? 10,
		},
	});

	const onSubmit = form.handleSubmit(() => {});

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

				<article className="flex items-center justify-between pt-6">
					<div className="flex flex-col gap-1">
						<h3 className="text-[14.5px] font-bold text-black">Email Alerts</h3>
						<p className="text-[13.5px] font-medium text-vitastock-body-color/80">
							Receive critical stock warnings via email.
						</p>
					</div>

					<Form.FieldWithController
						control={form.control}
						name="emailAlerts"
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
							className="h-10.5 shrink-0 rounded-lg bg-vitastock-primary-dark px-5
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

const dateFormatter = new Intl.DateTimeFormat("en", {
	day: "numeric",
	month: "short",
	year: "numeric",
});

const getJoinedDate = (member: Member) => {
	return isInvitationMember(member) ? "-" : dateFormatter.format(member.createdAt);
};

const memberTableColumns = defineEnum(["Name", "Email", "Role", "Joined Date", "Status", "Actions"]);

function ManagePeopleDialog() {
	const workspaceMembersQueryResult = useQuery(workspaceMembersQuery());
	const tableMembers = workspaceMembersQueryResult.data?.members ?? [];
	const sessionQueryResult = useQuery(sessionQuery());

	const currentUser = sessionQueryResult.data?.user;
	const canInviteMembers = currentUser?.role === "owner" || currentUser?.role === "admin";

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

			<section>
				<header
					className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b
						border-shadcn-border/70 px-6 py-4"
				>
					<div className="flex items-center gap-3">
						<Form.InputGroup
							className="h-10 w-full max-w-[256px] items-center gap-2.5 rounded-lg border
								border-shadcn-border bg-shadcn-muted/50 px-3.5 text-vitastock-body-color"
						>
							<Form.InputLeftItem>
								<IconBox icon="lucide:search" className="size-4 text-vitastock-body-color/70" />
							</Form.InputLeftItem>
							<Form.InputPrimitive
								type="search"
								placeholder="Search members..."
								className="h-full min-w-0 flex-1 bg-transparent text-[14px] font-medium
									outline-none placeholder:text-vitastock-body-color/60"
							/>
						</Form.InputGroup>

						<Select.Root defaultValue="all">
							<Select.Trigger
								className="h-10 w-[140px] rounded-lg border-shadcn-border bg-shadcn-muted/50 px-3.5
									text-[14px] font-medium text-black"
							>
								<Select.Value placeholder="All Roles" />
							</Select.Trigger>
							<Select.Content
								className="rounded-xl border border-shadcn-border/80 bg-white p-1.5 shadow-xl
									shadow-black/10"
							>
								<Select.Item value="all">All Roles</Select.Item>
								<Select.Item value="owner">Owner</Select.Item>
								<Select.Item value="admin">Admin</Select.Item>
								<Select.Item value="pharmacist">Pharmacist</Select.Item>
							</Select.Content>
						</Select.Root>
					</div>

					{canInviteMembers && (
						<DialogAnimated.Root>
							<DialogAnimated.Trigger asChild={true}>
								<Button
									className="h-10 rounded-lg bg-[#0047b3] px-4 text-[14px] font-bold
										hover:bg-[#0047b3]/90"
								>
									<IconBox icon="lucide:plus" className="size-4.5" />
									Invite Member
								</Button>
							</DialogAnimated.Trigger>

							<InviteMemberDialog />
						</DialogAnimated.Root>
					)}
				</header>

				<div className="h-[400px] overflow-auto">
					<Table.Root className="mx-auto border-collapse text-left">
						<Table.Header
							className="sticky top-0 z-1 bg-shadcn-muted/40 text-[12px] font-extrabold
								tracking-wider text-vitastock-body-color uppercase"
						>
							<Table.Row className="border-b-shadcn-border/70 hover:bg-transparent">
								<For
									each={memberTableColumns}
									renderItem={(column) => (
										<Table.Head
											key={column}
											className={cnJoin(
												"px-6 py-3 font-bold",
												column === "Actions" && "text-right"
											)}
										>
											{column}
										</Table.Head>
									)}
								/>
							</Table.Row>
						</Table.Header>

						<Table.Body>
							<Switch.Root>
								<Switch.Match when={workspaceMembersQueryResult.isLoading}>
									<Table.Row>
										<Table.Cell
											colSpan={memberTableColumns.length}
											className="px-6 py-8 text-center text-[14px] font-medium
												text-vitastock-body-color"
										>
											Loading members...
										</Table.Cell>
									</Table.Row>
								</Switch.Match>

								<Switch.Match when={workspaceMembersQueryResult.isError}>
									<Table.Row>
										<Table.Cell
											colSpan={memberTableColumns.length}
											className="px-6 py-8 text-center text-[14px] font-medium
												text-vitastock-body-color"
										>
											Failed to load members. Please try again later.
										</Table.Cell>
									</Table.Row>
								</Switch.Match>

								<Switch.Match when={tableMembers.length === 0}>
									<Table.Row>
										<Table.Cell
											colSpan={memberTableColumns.length}
											className="px-6 py-8 text-center text-[14px] font-medium
												text-vitastock-body-color"
										>
											No workspace members found.
										</Table.Cell>
									</Table.Row>
								</Switch.Match>

								<Switch.Default>
									<For
										each={tableMembers}
										renderItem={(member) => (
											<Table.Row
												key={member.id}
												className="border-b-shadcn-border/50 text-[14px] font-medium
													hover:bg-shadcn-muted/20"
											>
												<Table.Cell className="flex items-center gap-3 px-6 py-4">
													<MemberAvatar member={member} />
													<p className="text-black">
														{getMemberName(member)}
														{member.isCurrentUser && (
															<span className="ml-1.5 text-vitastock-body-color/70">
																(you)
															</span>
														)}
													</p>
												</Table.Cell>
												<Table.Cell className="px-5 py-4 text-vitastock-body-color">
													{getMemberEmail(member)}
												</Table.Cell>
												<Table.Cell className="px-5 py-4">
													<RoleBadge role={member.role} />
												</Table.Cell>
												<Table.Cell className="px-5 py-4 text-vitastock-body-color">
													{getJoinedDate(member)}
												</Table.Cell>
												<Table.Cell className="px-5 py-4">
													<StatusLabel status={member.status} />
												</Table.Cell>
												<Table.Cell className="px-6 py-4 text-right">
													<MemberActionsDropdown
														currentUserRole={currentUser?.role}
														member={member}
													/>
												</Table.Cell>
											</Table.Row>
										)}
									/>
								</Switch.Default>
							</Switch.Root>
						</Table.Body>
					</Table.Root>
				</div>
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
	const removeMemberMutation = useMutation(permanentlyRemoveWorkspaceMemberMutation());
	const resendInvitationMutation = useMutation(resendWorkspaceInvitationMutation());
	const suspendMemberMutation = useMutation(suspendWorkspaceMemberMutation());

	const invalidateMembersQuery = () => {
		void queryClient.invalidateQueries(workspaceMembersQuery());
	};

	const permissions = getMemberActionPermissions({ currentUserRole, member });

	const hasPendingMutation =
		cancelInvitationMutation.isPending
		|| changeRoleMutation.isPending
		|| removeMemberMutation.isPending
		|| resendInvitationMutation.isPending
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
												isLoading={resendInvitationMutation.isPending}
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
								Permanently remove
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
						<MemberDetailRow
							label="Invitation expires"
							value={dateFormatter.format(member.expiresAt)}
						/>
					)}

					{member.status === "suspended" && (
						<MemberDetailRow label="Suspended" value={dateFormatter.format(member.suspendedAt)} />
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
							Permanently remove member?
						</DialogAnimated.Title>
						<DialogAnimated.Description
							className="mt-2 text-[14px] leading-relaxed text-vitastock-body-color"
						>
							This will permanently remove {getMemberName(member)} ({getMemberEmail(member)}) from
							the workspace. This action cannot be undone.
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
							Permanently remove
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
										className="h-10 rounded-lg border-shadcn-border bg-transparent px-4
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
		<Avatar.Root className={cnJoin("size-9", getMemberAvatarClassName(member))}>
			<Avatar.Fallback
				className={cnJoin("text-[12px] font-extrabold", getMemberAvatarFallbackClassName(member))}
			>
				{getMemberInitials(member)}
			</Avatar.Fallback>
		</Avatar.Root>
	);
}

function getMemberAvatarClassName(member: Member) {
	if (member.isCurrentUser) {
		return tw`bg-vitastock-primary-main`;
	}

	if (member.status === "suspended") {
		return tw`bg-rose-50 ring-1 ring-rose-200`;
	}

	return tw`bg-shadcn-muted ring-1 ring-shadcn-border`;
}

function getMemberAvatarFallbackClassName(member: Member) {
	if (member.isCurrentUser) return "bg-vitastock-primary-main text-white";

	if (member.status === "suspended") return "bg-rose-50 text-rose-700";

	return "text-vitastock-body-color";
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
	const dotClassName = getStatusDotClassName(status);

	return (
		<span className="inline-flex items-center gap-2 text-vitastock-body-color capitalize">
			<span className={cnJoin("size-2 rounded-full", dotClassName)} />
			{status}
		</span>
	);
}

function getStatusDotClassName(status: Member["status"]) {
	if (status === "active") return "bg-emerald-500";

	if (status === "suspended") return "bg-rose-500";

	if (status === "expired") return "bg-zinc-400";

	return "bg-amber-500";
}
