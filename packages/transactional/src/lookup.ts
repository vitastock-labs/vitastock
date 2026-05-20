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
		pharmacistInvite: {
			from: "VitaStock <donotreply@vitastock.com>",
			subject: "You have been invited to join VitaStock",
			template: getTemplateFn(import("../emails/PharmacistInviteEmail")),
		},
		resetPassword: {
			from: "Vitastock <donotreply@vitastock.com>",
			subject: "Reset your password",
			template: getTemplateFn(import("../emails/ResetPasswordEmail")),
		},
		resetPasswordComplete: {
			from: "Vitastock <donotreply@vitastock.com>",
			subject: "Password Reset Successful",
			template: getTemplateFn(import("../emails/ResetPasswordCompleteEmail")),
		},
		verifyEmail: {
			from: "Vitastock <donotreply@vitastock.com>",
			subject: "Verify your email address",
			template: getTemplateFn(import("../emails/VerifyEmail")),
		},
		welcomeEmail: {
			from: "Vitastock <donotreply@vitastock.com>",
			subject: "Welcome to Vitastock",
			template: getTemplateFn(import("../emails/WelcomeEmail")),
		},
	},
	{ inferredUnionVariant: "none" }
) satisfies TemplateType;

export type TemplateLookupType = typeof TEMPLATE_LOOKUP;
