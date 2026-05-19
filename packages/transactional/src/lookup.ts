import type { InferProps } from "@zayne-labs/toolkit-react/utils";
import { defineEnumDeep, type AnyFunction } from "@zayne-labs/toolkit-type-helpers";

type TemplateType = Record<
	string,
	{
		from: string;
		subject: string;
		template: (props: never) => Promise<string>;
	}
>;

const getTemplateFn =
	<TModule extends { TemplateFn: AnyFunction<Promise<string>> }>(funcPromise: Promise<TModule>) =>
	async (props: InferProps<TModule["TemplateFn"]>) => {
		const func = await funcPromise;

		return func.TemplateFn(props);
	};

export const TEMPLATE_LOOKUP = defineEnumDeep(
	{
		resetPassword: {
			from: "MedInfo <donotreply@medical-info.com>",
			subject: "Reset your password",
			template: getTemplateFn(import("../emails/ResetPasswordEmail")),
		},
		resetPasswordComplete: {
			from: "MedInfo <donotreply@medical-info.com>",
			subject: "Password Reset Successful",
			template: getTemplateFn(import("../emails/ResetPasswordCompleteEmail")),
		},
		verifyEmail: {
			from: "MedInfo <donotreply@medical-info.com>",
			subject: "Verify your email address",
			template: getTemplateFn(import("../emails/VerifyEmail")),
		},
		welcomeEmail: {
			from: "MedInfo <donotreply@medical-info.com>",
			subject: "Welcome to MedInfo",
			template: getTemplateFn(import("../emails/WelcomeEmail")),
		},
	},
	{ inferredUnionVariant: "none" }
) satisfies TemplateType;

export type TemplateLookupType = typeof TEMPLATE_LOOKUP;
