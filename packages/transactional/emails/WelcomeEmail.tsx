import * as React from "react";
import { Heading, Link, render, Section, Text } from "react-email";
import { EmailButton } from "../src/components/EmailButton";
import { FRONTEND_URL } from "../src/constants";
import { BaseLayout } from "../src/layouts/BaseLayout";

export type WelcomeEmailProps = {
	name: string;
	role: "owner" | "pharmacist";
};

export function WelcomeEmail(props: WelcomeEmailProps) {
	const { name, role } = props;

	const loginURL = `${FRONTEND_URL}/auth/signin?user=${role}`;

	const supportURL = `${FRONTEND_URL}/support`;

	return (
		<BaseLayout preview={`Welcome to VitaStock ${role === "owner" ? "Management Network" : ""}`}>
			<Heading
				className="m-0 text-center text-2xl font-semibold tracking-tight text-vitastock-primary-main"
			>
				Welcome to VitaStock
			</Heading>

			<Text className="mt-6 text-base/relaxed text-vitastock-body-color">
				Hello <span className="font-semibold text-vitastock-primary-darker">{name}</span>,
			</Text>

			<Text className="mt-4 text-base/relaxed text-vitastock-body-color">
				{role === "owner" ?
					"Your VitaStock workspace is ready. You can now manage your pharmacy team, monitor stock, and stay ahead of critical inventory issues."
				:	"Your VitaStock workspace access is ready. You can now help manage inventory, process stock activity, and monitor important alerts."
				}
			</Text>

			<Section className="mt-8 text-center">
				<EmailButton href={loginURL}>
					{role === "owner" ? "Access Owner Dashboard" : "Access Workspace"}
				</EmailButton>
			</Section>

			<Text className="mt-8 text-sm/relaxed text-slate-500">
				Need help getting started? Reply to this email or visit the{" "}
				<Link className="text-vitastock-primary-main underline" href={supportURL}>
					Help Center
				</Link>
				.
			</Text>
		</BaseLayout>
	);
}

WelcomeEmail.PreviewProps = {
	name: "Jane Doe",
	role: "pharmacist",
} satisfies WelcomeEmailProps;

export const TemplateFn = (props: WelcomeEmailProps) => render(<WelcomeEmail {...props} />);

export default WelcomeEmail;
