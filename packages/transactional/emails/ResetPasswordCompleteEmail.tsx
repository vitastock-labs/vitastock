import { Button, Heading, Hr, Link, render, Section, Text } from "react-email";
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
			<Section className="mb-8 text-center">
				<div className="mx-auto inline-block size-16 rounded-full bg-medinfo-primary-subtle">
					<Text className="m-0 text-4xl/16 text-medinfo-primary-main">✓</Text>
				</div>
			</Section>

			<Heading
				className="mb-4 text-center text-2xl font-semibold tracking-tight text-medinfo-primary-main"
			>
				Password Reset Successful
			</Heading>

			<Text className="mb-8 text-center text-base/relaxed text-medinfo-dark-3">
				Hello <span className="font-semibold text-medinfo-primary-darker">{name}</span>, your password
				has been successfully reset.
			</Text>

			<Section className="my-8 text-center">
				<Button
					className="inline-block rounded-full bg-medinfo-primary-main px-10 py-4 text-sm
						font-semibold text-white no-underline shadow-md"
					href={loginURL}
				>
					Sign In to Your Account
				</Button>
			</Section>

			<Hr className="my-8 border-medinfo-light-2" />

			<Section className="rounded-lg bg-medinfo-secondary-subtle px-6 py-5">
				<Text className="mb-2 text-sm font-semibold text-medinfo-primary-darker">
					Security Reminder
				</Text>
				<Text className="mb-0 text-sm/relaxed text-medinfo-dark-4">
					If you did not request this password reset, please contact our support team immediately.
					Your account security is important to us.
				</Text>
			</Section>

			<Text className="mt-8 mb-0 text-center text-sm/relaxed text-medinfo-dark-4">
				Need help? Visit our{" "}
				<Link className="text-medinfo-primary-main underline" href={supportURL}>
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
