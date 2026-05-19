import * as React from "react";
import { Button, Heading, render, Section, Text } from "react-email";
import { FRONTEND_URL } from "../src/constants";
import { BaseLayout } from "../src/layouts/BaseLayout";

export type WelcomeEmailProps = {
	name: string;
	role: "doctor" | "patient";
};

export function WelcomeEmail(props: WelcomeEmailProps) {
	const { name, role } = props;

	const loginURL = `${FRONTEND_URL}/auth/signin?user=${role}`;

	const supportURL = `${FRONTEND_URL}/support`;

	return (
		<BaseLayout preview={`Welcome to MedInfo Nigeria ${role === "doctor" ? "Partner Network" : ""}`}>
			<Heading
				className="mb-6 text-center text-2xl font-semibold tracking-tight text-medinfo-primary-main"
			>
				Welcome to MedInfo
			</Heading>

			<Text className="mb-4 text-base/relaxed text-medinfo-body-color">
				Hello <span className="font-semibold text-medinfo-primary-darker">{name}</span>,
			</Text>

			<Text className="mb-6 text-base/relaxed text-medinfo-body-color">
				{role === "doctor" ?
					"We're thrilled to have you join our network of healthcare professionals! MedInfo Nigeria helps you connect with patients seeking expert medical advice and streamlines your practice management."
				:	"We're excited to have you on board! MedInfo Nigeria connects you with certified doctors and provides reliable medical information right at your fingertips."
				}
			</Text>

			<Section className="my-8 text-center">
				<Button
					className="inline-block rounded-full bg-medinfo-primary-main px-10 py-4 text-sm
						font-semibold text-white no-underline shadow-md"
					href={loginURL}
				>
					{role === "doctor" ? "Access Provider Dashboard" : "Explore Dashboard"}
				</Button>
			</Section>

			<Text className="mb-0 text-sm/relaxed text-medinfo-dark-4">
				If you have any questions, feel free to reply to this email or visit our{" "}
				<Button className="text-medinfo-primary-main underline" href={supportURL}>
					Help Center
				</Button>
				.
			</Text>
		</BaseLayout>
	);
}

WelcomeEmail.PreviewProps = {
	name: "Dr. Doe",
	role: "doctor",
} satisfies WelcomeEmailProps;

export const TemplateFn = (props: WelcomeEmailProps) => render(<WelcomeEmail {...props} />);

export default WelcomeEmail;
