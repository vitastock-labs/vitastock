import * as React from "react";
import { Heading, Hr, Section, Text, render } from "react-email";
import { EmailButton } from "../src/components/EmailButton";
import { FRONTEND_URL } from "../src/constants";
import { BaseLayout } from "../src/layouts/BaseLayout";

export type InventoryAlertDigestEmailProps = {
	alertCount: number;
	alertSummaries: string[];
	name: string;
	workspaceName: string;
};

export function InventoryAlertDigestEmail(props: InventoryAlertDigestEmailProps) {
	const { alertCount, alertSummaries, name, workspaceName } = props;

	return (
		<BaseLayout preview={`${alertCount} unresolved inventory alerts for ${workspaceName}`}>
			<Heading className="mt-8 text-center text-2xl font-semibold text-vitastock-primary-main">
				Daily inventory alert digest
			</Heading>
			<Text className="mt-4 text-center text-base/relaxed text-slate-600">Hello {name},</Text>
			<Text className="mt-2 text-center text-base/relaxed text-slate-600">
				{workspaceName} has {alertCount} unresolved inventory alert{alertCount === 1 ? "" : "s"}.
			</Text>
			<Section className="mt-6 rounded-lg bg-slate-50 px-6 py-4">
				{alertSummaries.map((summary) => (
					<Text key={summary} className="m-0 py-1 text-sm/relaxed text-slate-600">
						{summary}
					</Text>
				))}
			</Section>
			<Section className="mt-8 text-center">
				<EmailButton href={`${FRONTEND_URL}/dashboard/alerts`}>Review alerts</EmailButton>
			</Section>
			<Hr className="mt-8 border-slate-200" />
			<Text className="mt-6 text-center text-sm/relaxed text-slate-500">
				This digest includes active alerts only.
			</Text>
		</BaseLayout>
	);
}

export const TemplateFn = (props: InventoryAlertDigestEmailProps) =>
	render(<InventoryAlertDigestEmail {...props} />);

InventoryAlertDigestEmail.PreviewProps = {
	alertCount: 3,
	alertSummaries: [
		"Amoxicillin 500mg has 4 units available, below its 10-unit threshold.",
		"Paracetamol 500mg has 12 units approaching expiry.",
	],
	name: "Alex Johnson",
	workspaceName: "CityCare Pharmacy",
} satisfies InventoryAlertDigestEmailProps;

export default InventoryAlertDigestEmail;
