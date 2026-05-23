import * as React from "react";
import { Button, Heading, render, Section, Text } from "react-email";
import { FRONTEND_URL } from "../src/constants";
import { BaseLayout } from "../src/layouts/BaseLayout";

export type PharmacistInviteEmailProps = {
	defaultPassword: string;
	email: string;
	inviterEmail: string;
	name: string;
	role: string;
	token: string;
	workspaceName: string;
};

export function PharmacistInviteEmail(props: PharmacistInviteEmailProps) {
	const { defaultPassword, email, inviterEmail, name, role, token, workspaceName } = props;

	const invitationUrl = `${FRONTEND_URL}/auth/invitations/accept?${new URLSearchParams({ token }).toString()}`;

	return (
		<BaseLayout preview={`You have been invited to join ${workspaceName} on VitaStock`}>
			<Heading
				className="mb-6 text-center text-2xl font-semibold tracking-tight text-vitastock-primary-main"
			>
				Join {workspaceName}
			</Heading>

			<Text className="mb-4 text-center text-base/relaxed text-vitastock-body-color">
				Hello <span className="font-semibold text-vitastock-primary-darker">{name}</span>,
			</Text>

			<Text className="mb-4 text-center text-base/relaxed text-vitastock-body-color">
				{inviterEmail} invited you to join the {workspaceName} workspace with the role of {role} on
				VitaStock.
			</Text>

			<Text className="mb-6 text-center text-base/relaxed text-vitastock-body-color">
				Accept the invitation, then sign in with {email} and this temporary password:
			</Text>

			<Text
				className="mb-6 rounded-lg bg-slate-100 px-4 py-3 text-center font-mono text-base font-semibold
					text-slate-900"
			>
				{defaultPassword}
			</Text>

			<Text className="mb-6 text-center text-base/relaxed text-vitastock-body-color">
				You will be asked to change this password before accessing the workspace.
			</Text>

			<Section className="mb-6 text-center">
				<Button
					className="inline-block rounded-full bg-vitastock-primary-main px-10 py-4 text-sm
						font-semibold text-white no-underline shadow-md"
					href={invitationUrl}
				>
					Accept Invitation
				</Button>
			</Section>

			<Text className="mb-0 text-center text-sm/relaxed text-slate-500">
				If you were not expecting this invitation, you can safely ignore this email.
			</Text>
		</BaseLayout>
	);
}

PharmacistInviteEmail.PreviewProps = {
	defaultPassword: "VS-Default123",
	email: "pharmacist@example.com",
	inviterEmail: "owner@example.com",
	name: "Amina Yusuf",
	role: "pharmacist",
	token: "example-token",
	workspaceName: "Greenleaf Pharmacy",
} satisfies PharmacistInviteEmailProps;

export const TemplateFn = (props: PharmacistInviteEmailProps) =>
	render(<PharmacistInviteEmail {...props} />);

export default PharmacistInviteEmail;
