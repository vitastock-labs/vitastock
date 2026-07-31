import { useMutation } from "@tanstack/react-query";
import { createSearchParams } from "@zayne-labs/toolkit-core";
import { parseAsString, useQueryStates } from "nuqs";
import { useNavigate } from "react-router";
import { IconBox } from "@/components/common/IconBox";
import { Logo } from "@/components/common/Logo";
import { NavLinkEphemeral } from "@/components/common/NavLink";
import { Switch } from "@/components/common/switch";
import { Button } from "@/components/ui";
import { acceptWorkspaceInvitationMutation } from "@/lib/react-query/mutationOptions";
import { Main } from "@/pages/auth/-components/Main";

function AcceptInvitationPage() {
	const [{ inviteeEmail, token, workspaceName }] = useQueryStates({
		inviteeEmail: parseAsString.withDefault(""),
		token: parseAsString.withDefault(""),
		workspaceName: parseAsString.withDefault("your workspace"),
	});

	const navigate = useNavigate();

	const acceptInvitationMutationResult = useMutation(acceptWorkspaceInvitationMutation());

	const onAcceptInvitation = () => {
		acceptInvitationMutationResult.mutate(
			{ token },
			{
				onSuccess: () => {
					void navigate(
						{
							pathname: "/auth/signin",
							search: createSearchParams({ email: inviteeEmail }).toString(),
						},
						{ replace: true }
					);
				},
			}
		);
	};

	const hasInviteParams = Boolean(token && inviteeEmail);

	return (
		<Main>
			<section
				className="flex w-full max-w-[420px] flex-col items-center gap-8 rounded-[16px] border
					border-[hsl(210,6%,93%)] bg-white p-8 text-center shadow-[0_1px_2px_hsl(0,0%,0%,0.05)]"
			>
				<Logo width={96} classNames={{ base: "flex flex-col items-center gap-1", image: "w-[96px]" }}>
					<h1 className="text-[30px] font-bold text-black">VitaStock</h1>
				</Logo>

				<span
					className="grid size-[72px] place-items-center rounded-[12px] bg-vitastock-primary-subtle"
				>
					<IconBox
						icon={
							acceptInvitationMutationResult.isError ? "lucide:triangle-alert" : "lucide:user-check"
						}
						className="size-7 text-vitastock-primary-light"
					/>
				</span>

				<div className="flex flex-col gap-3">
					<h2 className="text-[24px] font-extrabold tracking-tight text-black">
						<Switch.Root>
							<Switch.Match when={!hasInviteParams}>Invalid invitation link</Switch.Match>
							<Switch.Match when={acceptInvitationMutationResult.isError}>
								Invitation could not be accepted
							</Switch.Match>
							<Switch.Default>Accepting your invitation</Switch.Default>
						</Switch.Root>
					</h2>

					<p className="text-[14.5px] leading-relaxed text-vitastock-body-color/80">
						<Switch.Root>
							<Switch.Match when={!hasInviteParams}>
								This invitation link is missing required details. Click the invite link in your
								email again or ask your workspace owner to send you a new invite.
							</Switch.Match>
							<Switch.Match when={acceptInvitationMutationResult.isError}>
								The invite may be invalid, expired, or already used.
							</Switch.Match>
							<Switch.Default>
								We are creating the {workspaceName} workspace account for {inviteeEmail}. You will
								be sent to sign in when it is ready.
							</Switch.Default>
						</Switch.Root>
					</p>
				</div>

				<Switch.Root>
					<Switch.Match when={!hasInviteParams}>
						<NavLinkEphemeral to="/auth/signin">
							<Button theme="primary" size="full-width">
								Go to sign in
							</Button>
						</NavLinkEphemeral>
					</Switch.Match>
					<Switch.Default>
						<div className="flex w-full flex-col gap-2">
							<Button
								onClick={onAcceptInvitation}
								theme="primary"
								size="full-width"
								isDisabled={acceptInvitationMutationResult.isPending}
								isLoading={acceptInvitationMutationResult.isPending}
							>
								Accept Invite
							</Button>

							<NavLinkEphemeral to="/auth/signin">
								<Button theme="primary-outline" size="full-width">
									Go to sign in
								</Button>
							</NavLinkEphemeral>
						</div>
					</Switch.Default>
				</Switch.Root>
			</section>
		</Main>
	);
}

export default AcceptInvitationPage;
