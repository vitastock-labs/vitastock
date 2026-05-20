import * as React from "react";
import { Button, Heading, render, Section, Text } from "react-email";
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
				className="mb-6 text-center text-2xl font-semibold tracking-tight text-vitastock-primary-main"
			>
				Verify Your Email
			</Heading>

			<Text className="mb-4 text-center text-base/relaxed text-vitastock-body-color">
				Hello <span className="font-semibold text-vitastock-primary-darker">{name}</span>,
			</Text>

			<Text className="mb-4 text-center text-base/relaxed text-vitastock-body-color">
				We received a request to register your VitaStock account. Use the code below to verify your email.
			</Text>

			<Section
				className="mx-auto my-8 w-full rounded-xl border border-slate-200
					bg-slate-50 py-6 text-center"
			>
				<Text className="m-0 font-mono text-4xl font-bold tracking-[0.25em] text-vitastock-primary-main">
					{validationCode}
				</Text>
			</Section>

			<Section className="mb-6 text-center">
				<Text className="mb-4 text-center text-sm text-vitastock-body-color">
					Or you can also click the link below to verify:
				</Text>

				<Button
					className="inline-block rounded-full bg-vitastock-primary-main px-10 py-4 text-sm
						font-semibold text-white no-underline shadow-md"
					href={validationUrl}
				>
					Verify Account
				</Button>
			</Section>

			<Text className="mb-0 text-center text-sm/relaxed text-slate-500">
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
