import { zodResolver } from "@hookform/resolvers/zod";
import { backendApiSchemaRoutes } from "@vitastock/shared/validation/backendApiSchema";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { useDialogContext } from "@/components/animated/primitives/dialog-radix";
import { DialogAnimated } from "@/components/animated/ui";
import { For } from "@/components/common/for";
import { IconBox } from "@/components/common/IconBox";
import { Avatar, Button, Select, Table } from "@/components/ui";
import { Form } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { callBackendApiForQuery } from "@/lib/api/callBackendApi";
import { cnJoin } from "@/lib/utils/cn";
import { Main } from "../-components/Main";

const InviteMemberSchema = backendApiSchemaRoutes["@post/auth/invitations/send"].body;

type InviteMemberFormValues = z.infer<typeof InviteMemberSchema>;

const members = [
	{
		email: "zonwodi@vitastock.com",
		initials: "ZO",
		isCurrentUser: true,
		joinedDate: "Dec 6, 2023",
		name: "Zion Onwodi",
		role: "owner",
		status: "active",
	},
	{
		email: "s.miller@vitastock.com",
		initials: "SM",
		isCurrentUser: false,
		joinedDate: "Jan 12, 2024",
		name: "Sarah Miller",
		role: "pharmacist",
		status: "active",
	},
	{
		email: "j.doe@vitastock.com",
		initials: null,
		isCurrentUser: false,
		joinedDate: "-",
		name: "Invited User",
		role: "pharmacist",
		status: "pending",
	},
] as const;

const memberTableColumns = [
	{ className: "", label: "Name" },
	{ className: "", label: "Email" },
	{ className: "", label: "Role" },
	{ className: "", label: "Joined Date" },
	{ className: "", label: "Status" },
	{ className: "text-right", label: "Actions" },
] as const;

function SettingsPage() {
	const form = useForm({
		defaultValues: {
			email: "owner@vitastock.com",
			emailAlerts: true,
			lowStockThreshold: 20,
			pharmacyName: "Central Branch Pharmacy",
		},
	});

	const onSubmit = form.handleSubmit(() => {});

	return (
		<Main className="max-w-225 gap-8 self-center">
			<header className="flex flex-col gap-1.5">
				<h1 className="text-[28px] font-extrabold tracking-tight text-black">System Settings</h1>
				<p className="text-[15px] font-medium text-vitastock-body-color/80">
					Manage your workspace preferences and alert configurations.
				</p>
			</header>

			<Form.Root form={form} onSubmit={(event) => void onSubmit(event)} className="flex flex-col gap-8">
				<PeopleWorkspaceSection />

				<article className="flex flex-col rounded-xl bg-white ring-1 ring-shadcn-border/60">
					<div className="flex items-center gap-2.5 border-b border-shadcn-border/50 p-5">
						<IconBox icon="lucide:bell" className="size-5 text-vitastock-primary-main" />
						<h2 className="text-[16px] font-bold text-black">Alert Settings</h2>
					</div>

					<div className="flex flex-col p-6">
						<div className="flex items-center justify-between border-b border-shadcn-border/50 pb-6">
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
										text-center text-[14.5px] font-medium text-black transition-colors
										outline-none focus-within:border-vitastock-primary-main focus-within:ring-1
										focus-within:ring-vitastock-primary-main"
								/>
								<Form.ErrorMessage />
							</Form.Field>
						</div>

						<div className="flex items-center justify-between pt-6">
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
									<Switch
										checked={field.value}
										onCheckedChange={field.onChange}
										className="data-checked:bg-vitastock-primary-dark
											data-unchecked:bg-shadcn-border"
									/>
								)}
							/>
						</div>
					</div>
				</article>

				<article
					className="flex flex-col items-start justify-between gap-5 rounded-xl border
						border-vitastock-primary-main/20 bg-[#f0f6fc] p-6 sm:flex-row sm:items-center"
				>
					<div className="flex flex-col gap-1.5">
						<h2 className="text-[16px] font-bold text-black">Drug Management</h2>
						<p className="text-[14.5px] font-medium text-vitastock-body-color/90">
							Add, remove, or categorize items in your central inventory.
						</p>
					</div>

					<Button className="h-10.5 shrink-0 rounded-lg bg-[#0047b3] px-5 hover:bg-[#0047b3]/90">
						<IconBox type="online" icon="lucide:book-user" className="size-4" />
						Manage Drug List
					</Button>
				</article>
			</Form.Root>
		</Main>
	);
}

export default SettingsPage;

function PeopleWorkspaceSection() {
	return (
		<DialogAnimated.Root>
			<article className="flex flex-col rounded-xl bg-white shadow-sm ring-1 ring-shadcn-border/70">
				<div className="flex items-center gap-2.5 border-b border-shadcn-border/50 p-5">
					<IconBox icon="lucide:users-round" className="size-5 text-vitastock-primary-main" />
					<h2 className="text-[16px] font-bold text-black">People & Workspace</h2>
				</div>

				<div
					className="flex flex-col items-start justify-between gap-5 p-6 sm:flex-row sm:items-center"
				>
					<p className="text-[14.5px] font-medium text-vitastock-body-color/90">
						Manage workspace members, invitations, and access.
					</p>

					<DialogAnimated.Trigger asChild={true}>
						<Button className="h-10.5 shrink-0 rounded-lg bg-[#0047b3] px-5 hover:bg-[#0047b3]/90">
							<IconBox icon="lucide:users-round" className="size-4" />
							Manage People
						</Button>
					</DialogAnimated.Trigger>
				</div>
			</article>

			<ManagePeopleDialog />
		</DialogAnimated.Root>
	);
}

function ManagePeopleDialog() {
	return (
		<DialogAnimated.Content
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
							<Select.Content>
								<Select.Item value="all">All Roles</Select.Item>
								<Select.Item value="owner">Owner</Select.Item>
								<Select.Item value="admin">Admin</Select.Item>
								<Select.Item value="pharmacist">Pharmacist</Select.Item>
							</Select.Content>
						</Select.Root>
					</div>

					<div className="flex items-center gap-3">
						<Button
							theme="secondary-outline"
							className="size-10 rounded-lg px-0 text-vitastock-body-color"
							aria-label="Copy invite link"
						>
							<IconBox type="online" icon="lucide:link" className="size-4.5" />
						</Button>

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
					</div>
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
											key={column.label}
											className={cnJoin("px-6 py-3 font-bold", column.className)}
										>
											{column.label}
										</Table.Head>
									)}
								/>
							</Table.Row>
						</Table.Header>

						<Table.Body>
							<For
								each={members}
								renderItem={(member) => (
									<Table.Row
										key={member.email}
										className="border-b-shadcn-border/50 text-[14px] font-medium
											hover:bg-shadcn-muted/20"
									>
										<Table.Cell className="px-6 py-4">
											<div className="flex items-center gap-3">
												<MemberAvatar member={member} />
												<span className="text-black">
													{member.name}
													{member.isCurrentUser && (
														<span className="ml-1.5 text-vitastock-body-color/70">
															(you)
														</span>
													)}
												</span>
											</div>
										</Table.Cell>
										<Table.Cell className="px-5 py-4 text-vitastock-body-color">
											{member.email}
										</Table.Cell>
										<Table.Cell className="px-5 py-4">
											<RoleBadge role={member.role} />
										</Table.Cell>
										<Table.Cell className="px-5 py-4 text-vitastock-body-color">
											{member.joinedDate}
										</Table.Cell>
										<Table.Cell className="px-5 py-4">
											<StatusLabel status={member.status} />
										</Table.Cell>
										<Table.Cell className="px-6 py-4 text-right">
											<Button
												unstyled={true}
												className="inline-flex rounded-md p-1.5 text-vitastock-body-color/70
													hover:bg-shadcn-muted"
												aria-label={`Open actions for ${member.name}`}
											>
												<IconBox type="online" icon="lucide:ellipsis" className="size-4.5" />
											</Button>
										</Table.Cell>
									</Table.Row>
								)}
							/>
						</Table.Body>
					</Table.Root>
				</div>
			</section>
		</DialogAnimated.Content>
	);
}

function InviteMemberDialog(props: { onInviteSent?: () => void }) {
	const { onInviteSent } = props;

	const form = useForm<InviteMemberFormValues>({
		defaultValues: {
			defaultPassword: "",
			inviteeEmail: "",
			inviteeName: "",
			role: "pharmacist",
		},
		resolver: zodResolver(InviteMemberSchema),
	});

	const dialogCtx = useDialogContext();

	const onSubmit = form.handleSubmit(async (data) => {
		await callBackendApiForQuery("@post/auth/invitations/send", {
			body: data,
			meta: { toast: { success: true } },
			onSuccess: () => {
				form.reset();
				dialogCtx.setIsOpen(false);
				onInviteSent?.();
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
						<Button theme="primary-ghost">Cancel</Button>
					</DialogAnimated.Close>

					<Form.Submit asChild={true}>
						{(formState) => (
							<Button
								isDisabled={formState.isSubmitting}
								isLoading={formState.isSubmitting}
								loadingStyle="side-by-side"
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

function MemberAvatar(props: { member: (typeof members)[number] }) {
	const { member } = props;

	if (member.status === "pending") {
		return (
			<span
				className="grid size-9 place-items-center rounded-full border border-dashed
					border-vitastock-body-color/30 bg-shadcn-muted text-vitastock-body-color/70"
			>
				<IconBox type="online" icon="lucide:mail" className="size-4.5" />
			</span>
		);
	}

	return (
		<Avatar.Root
			className={cnJoin(
				"size-9",
				member.isCurrentUser ?
					"bg-vitastock-primary-main"
				:	"bg-shadcn-muted ring-1 ring-shadcn-border"
			)}
		>
			<Avatar.Fallback
				className={cnJoin(
					"text-[12px] font-extrabold",
					member.isCurrentUser ? "bg-vitastock-primary-main text-white" : "text-vitastock-body-color"
				)}
			>
				{member.initials}
			</Avatar.Fallback>
		</Avatar.Root>
	);
}

function RoleBadge(props: { role: (typeof members)[number]["role"] }) {
	const { role } = props;

	if (role === "owner") {
		return (
			<span
				className="inline-flex items-center gap-1.5 rounded-md bg-vitastock-primary-main/10 px-2.5 py-1
					text-[12px] font-bold text-vitastock-primary-darker"
			>
				<IconBox
					type="online"
					icon="lucide:shield-check"
					className="size-3.5 text-vitastock-primary-main"
				/>
				Owner
			</span>
		);
	}

	return <span className="text-vitastock-body-color capitalize">{role}</span>;
}

function StatusLabel(props: { status: (typeof members)[number]["status"] }) {
	const { status } = props;
	const isActive = status === "active";

	return (
		<span className="inline-flex items-center gap-2 text-vitastock-body-color capitalize">
			<span className={cnJoin("size-2 rounded-full", isActive ? "bg-emerald-500" : "bg-amber-500")} />
			{status}
		</span>
	);
}
