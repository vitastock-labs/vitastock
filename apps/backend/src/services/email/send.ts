import { TEMPLATE_LOOKUP, type EmailJobOptions } from "@vitastock/transactional/emails";
import type { CallbackFn } from "@zayne-labs/toolkit-type-helpers";
import { consola } from "consola";
import * as nodemailer from "nodemailer";
import type { Options as SmtpTransportOptions } from "nodemailer/lib/smtp-transport";
import { ENVIRONMENT } from "@/config/env";

type NodeSmtpTransportOptions = SmtpTransportOptions & {
	family?: 4 | 6;
};

const getTransporterOptions = (): NodeSmtpTransportOptions => {
	if (ENVIRONMENT.NODE_ENV === "production") {
		return {
			auth: {
				clientId: ENVIRONMENT.GOOGLE_CLIENT_ID,
				clientSecret: ENVIRONMENT.GOOGLE_CLIENT_SECRET,
				refreshToken: ENVIRONMENT.GOOGLE_AUTH_REFRESH_TOKEN,
				type: "OAuth2",
				user: ENVIRONMENT.EMAIL_USER,
			},
			connectionTimeout: 15_000,
			family: 4,
			greetingTimeout: 15_000,
			host: "smtp.gmail.com",
			port: 587,
			requireTLS: true,
			secure: false,
			socketTimeout: 30_000,
		};
	}

	return {
		auth: {
			pass: ENVIRONMENT.EMAIL_APP_PASSWORD_DEV,
			user: ENVIRONMENT.EMAIL_USER_DEV,
		},
		host: "smtp.ethereal.email",
		port: 587,
		secure: false,
	};
};

const transporter = nodemailer.createTransport(getTransporterOptions());

export const sendEmail = async (options: EmailJobOptions) => {
	const { data, type } = options;

	const templateOptions = TEMPLATE_LOOKUP[type];

	const templateFn = templateOptions.template as CallbackFn<
		Parameters<typeof templateOptions.template>[0],
		ReturnType<typeof templateOptions.template>
	>;

	try {
		const info = await transporter.sendMail({
			from: templateOptions.from,
			html: await templateFn(data),
			subject: templateOptions.subject,
			to: data.to,
		});

		if (ENVIRONMENT.NODE_ENV === "development") {
			consola.info("Email sent: %s", info);
			consola.info("Preview URL: %s", nodemailer.getTestMessageUrl(info));
		}
	} catch (error) {
		consola.error(new Error(`Failed to deliver '${type}' email to '${data.to}'`, { cause: error }));
		throw error;
	}
};
