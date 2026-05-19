import { TEMPLATE_LOOKUP, type EmailJobOptions } from "@vitastock/transactional/emails";
import type { CallbackFn } from "@zayne-labs/toolkit-type-helpers";
import { consola } from "consola";
import * as nodemailer from "nodemailer";
import { ENVIRONMENT } from "@/config/env";

const transporter = nodemailer.createTransport({
	auth: {
		pass:
			ENVIRONMENT.NODE_ENV === "development" ?
				ENVIRONMENT.EMAIL_APP_PASSWORD_DEV
			:	ENVIRONMENT.EMAIL_APP_PASSWORD,
		user: ENVIRONMENT.NODE_ENV === "development" ? ENVIRONMENT.EMAIL_USER_DEV : ENVIRONMENT.EMAIL_USER,
	},
	host: ENVIRONMENT.NODE_ENV === "development" ? "smtp.ethereal.email" : "smtp.gmail.com",
	port: ENVIRONMENT.NODE_ENV === "development" ? 587 : undefined,
	...(ENVIRONMENT.NODE_ENV === "production" && {
		secure: true,
		service: "Gmail",
	}),
});

export const sendEmail = async (options: EmailJobOptions) => {
	const { data, type } = options;

	const templateOptions = TEMPLATE_LOOKUP[type];

	const templateFn = templateOptions.template as CallbackFn<
		Parameters<typeof templateOptions.template>[0],
		ReturnType<typeof templateOptions.template>
	>;

	try {
		await transporter.sendMail({
			from: templateOptions.from,
			html: await templateFn(data),
			subject: templateOptions.subject,
			to: data.to,
		});
	} catch (error) {
		consola.error(new Error(`Failed to deliver '${type}' email to '${data.to}'`, { cause: error }));
		throw error;
	}
};
