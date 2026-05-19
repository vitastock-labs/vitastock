import * as React from "react";
import { Button, Heading, render, Section, Text } from "react-email";
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
		<BaseLayout preview="Reset your MedInfo password">
			<Heading
				className="mb-6 text-center text-2xl font-semibold tracking-tight text-medinfo-primary-main"
			>
				Reset Your Password
			</Heading>

			<Text className="mb-4 text-center text-base/relaxed text-medinfo-body-color">
				Hello <span className="font-semibold text-medinfo-primary-darker">{name}</span>,
			</Text>

			<Text className="mb-4 text-center text-base/relaxed text-medinfo-body-color">
				We received a request to reset your MedInfo password. Click the button below to choose a new
				password. This link expires in <strong>20 minutes</strong>.
			</Text>

			<Section className="my-8 text-center">
				<Button
					className="inline-block rounded-full bg-medinfo-primary-main px-10 py-4 text-sm
						font-semibold text-white no-underline shadow-md"
					href={resetURL}
				>
					Reset Password
				</Button>
			</Section>

			<Text className="mb-0 text-center text-sm/relaxed text-medinfo-dark-4">
				If you didn't request a password reset, you can safely ignore this email. Your password will
				not be changed.
			</Text>
		</BaseLayout>
	);
}

ResetPasswordEmail.PreviewProps = {
	name: "Dr. Doe",
	token: "abc123",
} satisfies ResetPasswordEmailProps;

export const TemplateFn = (props: ResetPasswordEmailProps) => render(<ResetPasswordEmail {...props} />);

export default ResetPasswordEmail;
