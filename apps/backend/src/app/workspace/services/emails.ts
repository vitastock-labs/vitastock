import type { EmailJobOptions } from "@vitastock/transactional/emails";
import { addEmailToQueue } from "@/services/queues";

export const sendPharmacistInviteEmail = async (
	options: Omit<Extract<EmailJobOptions, { type: "pharmacistInvite" }>["data"], "priority" | "to">
) => {
	const { defaultPassword, invitedByEmail, inviteeEmail, inviteeName, role, token, workspaceName } =
		options;

	await addEmailToQueue({
		data: {
			defaultPassword,
			invitedByEmail,
			inviteeEmail,
			inviteeName,
			priority: "high",
			role,
			to: { email: inviteeEmail, name: inviteeName },
			token,
			workspaceName,
		},
		type: "pharmacistInvite",
	});
};
