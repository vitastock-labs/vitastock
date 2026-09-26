import * as React from "react";
import { Heading, render, Section, Text } from "react-email";
import { EmailButton } from "../src/components/EmailButton";
import { FRONTEND_URL } from "../src/constants";
import { BaseLayout } from "../src/layouts/BaseLayout";

export type ResetPasswordEmailProps = {
	name: string;
	token: string;
};

export function ResetPasswordEmail(props: ResetPasswordEmailProps) {
	const { name, token } = props;

	const resetURL = `${FRONTEND_URL}/auth/reset-password?${new URLSearchParams({ token }).toString()}`;

	return (
		<BaseLayout preview="Reset your VitaStock password">
			<Heading
				className="m-0 text-center text-2xl font-semibold tracking-tight text-vitastock-primary-main"
			>
				Reset your password
			</Heading>

			<Text className="mt-6 text-center text-base/relaxed text-vitastock-body-color">
				Hello <span className="font-semibold text-vitastock-primary-darker">{name}</span>,
			</Text>

			<Text className="mt-4 text-center text-base/relaxed text-vitastock-body-color">
				We received a request to reset your VitaStock password. Choose a new password using the secure
				link below. This link expires in <strong>20 minutes</strong>.
			</Text>

			<Section className="mt-8 text-center">
				<EmailButton href={resetURL}>Reset Password</EmailButton>
			</Section>

			<Text className="mt-8 text-center text-sm/relaxed text-slate-500">
				If you didn't request a password reset, you can ignore this email. Your password won't be
				changed.
			</Text>
		</BaseLayout>
	);
}

ResetPasswordEmail.PreviewProps = {
	name: "Jane Doe",
	token: "abc123",
} satisfies ResetPasswordEmailProps;

export const TemplateFn = (props: ResetPasswordEmailProps) => render(<ResetPasswordEmail {...props} />);

export default ResetPasswordEmail;
