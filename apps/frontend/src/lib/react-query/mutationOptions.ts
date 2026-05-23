import { mutationOptions } from "@tanstack/react-query";
import { callBackendApiForQuery } from "../api/callBackendApi";

export const signoutMutation = () => {
	return mutationOptions({
		mutationFn: () => {
			return callBackendApiForQuery("@post/auth/signout");
		},
		mutationKey: ["auth", "signout"],
	});
};

export const resendVerificationEmailMutation = () => {
	return mutationOptions({
		mutationFn: (bodyData: { email: string }) => {
			return callBackendApiForQuery("@post/auth/resend-verification-email", {
				body: bodyData,
				meta: { toast: { success: true } },
			});
		},
		mutationKey: ["auth", "resend-verification-email"],
	});
};
