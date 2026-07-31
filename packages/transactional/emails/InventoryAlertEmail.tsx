import * as React from "react";
import { Heading, Hr, render, Section, Text } from "react-email";
import { EmailButton } from "../src/components/EmailButton";
import { FRONTEND_URL } from "../src/constants";
import { BaseLayout } from "../src/layouts/BaseLayout";

export type InventoryAlertEmailProps = {
	alertType: string;
	name: string;
	summary: string;
	workspaceName: string;
};

export function InventoryAlertEmail(props: InventoryAlertEmailProps) {
	const { alertType, name, summary, workspaceName } = props;

	return (
		<BaseLayout preview={`${alertType} inventory alert for ${workspaceName}`}>
			<Heading className="mt-8 text-center text-2xl font-semibold text-vitastock-primary-main">
				Inventory needs attention
			</Heading>
			<Text className="mt-4 text-center text-base/relaxed text-slate-600">Hello {name},</Text>
			<Text className="mt-2 text-center text-base/relaxed text-slate-600">{summary}</Text>
			<Section className="mt-8 text-center">
				<EmailButton href={`${FRONTEND_URL}/dashboard/alerts`}>Review alert</EmailButton>
			</Section>
			<Hr className="mt-8 border-slate-200" />
			<Text className="mt-6 text-center text-sm/relaxed text-slate-500">
				You are receiving this because alerts are enabled for {workspaceName}.
			</Text>
		</BaseLayout>
	);
}

export const TemplateFn = (props: InventoryAlertEmailProps) => render(<InventoryAlertEmail {...props} />);

InventoryAlertEmail.PreviewProps = {
	alertType: "Low stock",
	name: "Alex Johnson",
	summary: "Amoxicillin 500mg has fallen below its low-stock threshold.",
	workspaceName: "CityCare Pharmacy",
} satisfies InventoryAlertEmailProps;

export default InventoryAlertEmail;
