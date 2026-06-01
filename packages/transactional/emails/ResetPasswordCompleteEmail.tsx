import * as React from "react";
import { Heading, Hr, Link, render, Section, Text } from "react-email";
import { EmailButton } from "../src/components/EmailButton";
import { FRONTEND_URL } from "../src/constants";
import { BaseLayout } from "../src/layouts/BaseLayout";

export type ResetPasswordCompleteEmailProps = {
	name: string;
};

export function ResetPasswordCompleteEmail(props: ResetPasswordCompleteEmailProps) {
	const { name } = props;

	const loginURL = `${FRONTEND_URL}/auth/signin`;
	const supportURL = `${FRONTEND_URL}/support`;

	return (
		<BaseLayout preview="Your password has been successfully reset">
			<Section className="text-center">
				<div className="mx-auto inline-block size-16 rounded-full bg-vitastock-primary-subtle">
					<Text className="m-0 text-4xl/16 text-vitastock-primary-main">✓</Text>
				</div>
			</Section>

			<Heading
				className="mt-8 text-center text-2xl font-semibold tracking-tight text-vitastock-primary-main"
			>
				Password reset successful
			</Heading>

			<Text className="mt-4 text-center text-base/relaxed text-slate-600">
				Hello <span className="font-semibold text-vitastock-primary-darker">{name}</span>, your
				password has been successfully reset.
			</Text>

			<Section className="mt-8 text-center">
				<EmailButton href={loginURL}>Sign In to Your Account</EmailButton>
			</Section>

			<Hr className="mt-8 border-slate-200" />

			<Section className="mt-8 rounded-lg bg-slate-50 px-6 py-5">
				<Text className="m-0 text-sm font-semibold text-vitastock-primary-darker">
					Security Reminder
				</Text>
				<Text className="mt-2 text-sm/relaxed text-slate-500">
					If you did not request this password reset, contact support immediately so we can help
					secure your account.
				</Text>
			</Section>

			<Text className="mt-8 text-center text-sm/relaxed text-slate-500">
				Need help? Visit our{" "}
				<Link className="text-vitastock-primary-main underline" href={supportURL}>
					Help Center
				</Link>{" "}
				or reply to this email.
			</Text>
		</BaseLayout>
	);
}

ResetPasswordCompleteEmail.PreviewProps = {
	name: "John Doe",
} satisfies ResetPasswordCompleteEmailProps;

export const TemplateFn = (props: ResetPasswordCompleteEmailProps) =>
	render(<ResetPasswordCompleteEmail {...props} />);

export default ResetPasswordCompleteEmail;
