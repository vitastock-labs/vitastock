import type { InferProps } from "@zayne-labs/toolkit-react/utils";
import { defineEnumDeep, type AnyFunction } from "@zayne-labs/toolkit-type-helpers";

type TemplateType = Record<
	string,
	{
		from: {
			email: string;
			name: string;
		};
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
			from: { email: "donotreply@vitastock.com", name: "Vitastock" },
			subject: "You have been invited to join VitaStock",
			template: getTemplateFn(import("../emails/PharmacistInviteEmail")),
		},
		resetPassword: {
			from: { email: "donotreply@vitastock.com", name: "Vitastock" },
			subject: "Reset your password",
			template: getTemplateFn(import("../emails/ResetPasswordEmail")),
		},
		resetPasswordComplete: {
			from: { email: "donotreply@vitastock.com", name: "Vitastock" },
			subject: "Password Reset Successful",
			template: getTemplateFn(import("../emails/ResetPasswordCompleteEmail")),
		},
		verifyEmail: {
			from: { email: "donotreply@vitastock.com", name: "Vitastock" },
			subject: "Verify your email address",
			template: getTemplateFn(import("../emails/VerifyEmail")),
		},
		welcomeEmail: {
			from: { email: "donotreply@vitastock.com", name: "Vitastock" },
			subject: "Welcome to Vitastock",
			template: getTemplateFn(import("../emails/WelcomeEmail")),
		},
	},
	{ inferredUnionVariant: "none" }
) satisfies TemplateType;

export type TemplateLookupType = typeof TEMPLATE_LOOKUP;
