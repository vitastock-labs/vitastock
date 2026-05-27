import type { BrevoClient } from "@getbrevo/brevo";
import { TEMPLATE_LOOKUP, type EmailJobOptions } from "@vitastock/transactional/emails";
import type { CallbackFn } from "@zayne-labs/toolkit-type-helpers";
import { consola } from "consola";
import type * as nodemailer from "nodemailer";
import type { Options as SmtpTransportOptions } from "nodemailer/lib/smtp-transport";
import { ENVIRONMENT } from "@/config/env";

// const getProductionTransporterOptions = (): SmtpTransportOptions => ({
// 	auth: {
// 		pass: ENVIRONMENT.EMAIL_APP_PASSWORD,
// 		// clientId: ENVIRONMENT.GOOGLE_CLIENT_ID,
// 		// clientSecret: ENVIRONMENT.GOOGLE_CLIENT_SECRET,
// 		// refreshToken: ENVIRONMENT.GOOGLE_AUTH_REFRESH_TOKEN,
// 		// type: "OAuth2",
// 		user: ENVIRONMENT.EMAIL_USER,
// 	},
// 	service: "gmail",
// });

const getDevTransporterOptions = (): SmtpTransportOptions => ({
	auth: {
		pass: ENVIRONMENT.EMAIL_APP_PASSWORD_DEV,
		user: ENVIRONMENT.EMAIL_USER_DEV,
	},
	host: "smtp.ethereal.email",
	port: 587,
});

let brevo: BrevoClient | null = null;

let devTransporter: ReturnType<typeof nodemailer.createTransport> | null = null;

export const sendEmail = async (options: EmailJobOptions) => {
	const { data, type } = options;

	const templateOptions = TEMPLATE_LOOKUP[type];

	const templateFn = templateOptions.template as CallbackFn<
		Parameters<typeof templateOptions.template>[0],
		ReturnType<typeof templateOptions.template>
	>;

	try {
		const htmlContent = await templateFn(data);

		if (ENVIRONMENT.NODE_ENV === "production") {
			const { BrevoClient } = await import("@getbrevo/brevo");

			brevo ??= new BrevoClient({
				apiKey: ENVIRONMENT.BREVO_API_KEY,
				maxRetries: 3,
				timeoutInSeconds: 30,
			});

			const result = await brevo.transactionalEmails.sendTransacEmail({
				htmlContent,
				sender: templateOptions.from,
				subject: templateOptions.subject,
				to: [data.to],
			});

			consola.info("Email sent: %s", JSON.stringify(result, null, 2));

			return;
		}

		const nodemailer = await import("nodemailer");

		devTransporter ??= nodemailer.createTransport(getDevTransporterOptions());

		const info = await devTransporter.sendMail({
			from: { address: templateOptions.from.email, name: templateOptions.from.name },
			html: htmlContent,
			subject: templateOptions.subject,
			to: { address: data.to.email, name: data.to.name },
		});

		consola.info("Email sent: %s", JSON.stringify(info, null, 2));
		consola.info("Email preview URL: ", nodemailer.getTestMessageUrl(info));
	} catch (error) {
		consola.error(
			new Error(`Failed to deliver '${type}' email to '${data.to.email}'`, { cause: error })
		);
		throw error;
	}
};
