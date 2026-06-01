import * as React from "react";
import { Heading, render, Section, Text } from "react-email";
import { EmailButton } from "../src/components/EmailButton";
import { FRONTEND_URL } from "../src/constants";
import { BaseLayout } from "../src/layouts/BaseLayout";

export type VerifyEmailProps = {
	email: string;
	name: string;
	validationCode: string;
};

export function VerifyEmail(props: VerifyEmailProps) {
	const { email, name, validationCode } = props;

	const validationUrl = `${FRONTEND_URL}/auth/verify-email?${new URLSearchParams({ code: validationCode, email }).toString()}`;

	return (
		<BaseLayout preview="Verify your email address for VitaStock">
			<Heading
				className="m-0 text-center text-2xl font-semibold tracking-tight text-vitastock-primary-main"
			>
				Verify your email
			</Heading>

			<Text className="mt-6 text-center text-base/relaxed text-vitastock-body-color">
				Hello <span className="font-semibold text-vitastock-primary-darker">{name}</span>,
			</Text>

			<Text className="mt-4 text-center text-base/relaxed text-vitastock-body-color">
				Use this code to finish creating your VitaStock account.
			</Text>

			<Section
				className="mx-auto my-8 w-full rounded-xl border border-slate-200 bg-slate-50 py-6 text-center"
			>
				<Text
					className="m-0 font-mono text-4xl font-bold tracking-[0.25em] text-vitastock-primary-main"
				>
					{validationCode}
				</Text>
			</Section>

			<Section className="mt-8 text-center">
				<Text className="text-center text-sm text-vitastock-body-color">
					You can also verify your account with this secure link.
				</Text>

				<EmailButton href={validationUrl}>Verify Account</EmailButton>
			</Section>

			<Text className="mt-6 text-center text-sm/relaxed text-slate-500">
				If you didn't request this code, you can safely ignore this email.
			</Text>
		</BaseLayout>
	);
}

VerifyEmail.PreviewProps = {
	email: "jane.doe@example.com",
	name: "Jane Doe",
	validationCode: "123456",
} satisfies VerifyEmailProps;

export const TemplateFn = (props: VerifyEmailProps) => render(<VerifyEmail {...props} />);

export default VerifyEmail;
