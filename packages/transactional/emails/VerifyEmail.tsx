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
		<BaseLayout preview="Verify your email address for MedInfo">
			<Heading
				className="mb-6 text-center text-2xl font-semibold tracking-tight text-medinfo-primary-main"
			>
				Verify Your Email
			</Heading>

			<Text className="mb-4 text-center text-base/relaxed text-medinfo-body-color">
				Hello <span className="font-semibold text-medinfo-primary-darker">{name}</span>,
			</Text>

			<Text className="mb-4 text-center text-base/relaxed text-medinfo-body-color">
				We received a request to create a MedInfo account. Use the code below to complete your
				registration.
			</Text>

			<Section
				className="mx-auto my-8 w-full rounded-xl border border-medinfo-light-2
					bg-medinfo-secondary-subtle py-6 text-center"
			>
				<Text className="m-0 font-mono text-4xl font-bold tracking-[0.25em] text-medinfo-primary-main">
					{validationCode}
				</Text>
			</Section>

			<Section className="mb-6 text-center">
				<Text className="mb-4 text-center text-sm text-medinfo-body-color">
					Or you can also click the link below to verify:
				</Text>

				<Button
					className="inline-block rounded-full bg-medinfo-primary-main px-10 py-4 text-sm
						font-semibold text-white no-underline shadow-md"
					href={validationUrl}
				>
					Verify Account
				</Button>
			</Section>

			<Text className="mb-0 text-center text-sm/relaxed text-medinfo-dark-4">
				If you didn't request this code, you can safely ignore this email.
			</Text>
		</BaseLayout>
	);
}

VerifyEmail.PreviewProps = {
	email: "dr.doe@example.com",
	name: "Dr. Doe",
	validationCode: "123456",
} satisfies VerifyEmailProps;

export const TemplateFn = (props: VerifyEmailProps) => render(<VerifyEmail {...props} />);

export default VerifyEmail;
