import * as React from "react";
import { Button, Heading, render, Section, Text } from "react-email";
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
				className="mb-6 text-center text-2xl font-semibold tracking-tight text-vitastock-primary-main"
			>
				Welcome to VitaStock
			</Heading>

			<Text className="mb-4 text-base/relaxed text-vitastock-body-color">
				Hello <span className="font-semibold text-vitastock-primary-darker">{name}</span>,
			</Text>

			<Text className="mb-6 text-base/relaxed text-vitastock-body-color">
				{role === "owner" ?
					"We're thrilled to have you join as an owner! VitaStock helps you oversee pharmacy operations, manage your workspaces, and efficiently track inventory across your network."
				:	"We're excited to have you on board! VitaStock provides you with the tools you need to effectively manage pharmacy inventory, process orders, and stay on top of stock levels."
				}
			</Text>

			<Section className="my-8 text-center">
				<Button
					className="inline-block rounded-full bg-vitastock-primary-main px-10 py-4 text-sm
						font-semibold text-white no-underline shadow-md"
					href={loginURL}
				>
					{role === "owner" ? "Access Owner Dashboard" : "Access Workspace"}
				</Button>
			</Section>

			<Text className="mb-0 text-sm/relaxed text-slate-500">
				If you have any questions, feel free to reply to this email or visit our{" "}
				<Button className="text-vitastock-primary-main underline" href={supportURL}>
					Help Center
				</Button>
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
