import * as React from "react";
import { Heading, render, Section, Text } from "react-email";
import { EmailButton } from "../src/components/EmailButton";
import { FRONTEND_URL } from "../src/constants";
import { BaseLayout } from "../src/layouts/BaseLayout";

export type PharmacistInviteEmailProps = {
	defaultPassword: string;
	invitedByEmail: string;
	inviteeEmail: string;
	inviteeName: string;
	role: string;
	token: string;
	workspaceName: string;
};

export function PharmacistInviteEmail(props: PharmacistInviteEmailProps) {
	const { defaultPassword, invitedByEmail, inviteeEmail, inviteeName, role, token, workspaceName } =
		props;

	const invitationUrl = `${FRONTEND_URL}/auth/workspace/invitation/accept?${new URLSearchParams({ inviteeEmail, token, workspaceName }).toString()}`;

	return (
		<BaseLayout preview={`You have been invited to join ${workspaceName} on VitaStock`}>
			<Heading
				className="m-0 text-center text-2xl font-semibold tracking-tight text-vitastock-primary-main"
			>
				Join {workspaceName}
			</Heading>

			<Text className="mt-6 text-center text-base/relaxed text-vitastock-body-color">
				Hello <span className="font-semibold text-vitastock-primary-darker">{inviteeName}</span>,
			</Text>

			<Text className="mt-4 text-center text-base/relaxed text-vitastock-body-color">
				{invitedByEmail} invited you to join {workspaceName} as a {role} on VitaStock.
			</Text>

			<Text className="mt-4 text-center text-base/relaxed text-vitastock-body-color">
				Accept the invitation, then sign in with {inviteeEmail} and the temporary password below.
			</Text>

			<Text
				className="mt-6 rounded-lg bg-slate-100 px-4 py-3 text-center font-mono text-base font-semibold
					text-slate-900"
			>
				{defaultPassword}
			</Text>

			<Text className="mt-6 text-center text-base/relaxed text-vitastock-body-color">
				You will be asked to change this password before accessing the workspace.
			</Text>

			<Section className="mt-8 text-center">
				<EmailButton href={invitationUrl}>Accept Invitation</EmailButton>
			</Section>

			<Text className="mt-8 text-center text-sm/relaxed text-slate-500">
				If you were not expecting this invitation, you can safely ignore this email.
			</Text>
		</BaseLayout>
	);
}

PharmacistInviteEmail.PreviewProps = {
	defaultPassword: "VS-Default123",
	invitedByEmail: "owner@example.com",
	inviteeEmail: "pharmacist@example.cuf",
	inviteeName: "Amina Yusom",
	role: "pharmacist",
	token: "example-token",
	workspaceName: "Greenleaf Pharmacy",
} satisfies PharmacistInviteEmailProps;

export const TemplateFn = (props: PharmacistInviteEmailProps) =>
	render(<PharmacistInviteEmail {...props} />);

export default PharmacistInviteEmail;
