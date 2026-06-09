import { mutationOptions } from "@tanstack/react-query";
import type { z } from "zod";
import { callBackendApiForQuery } from "../api/callBackendApi";
import type { BackendApiRoutes } from "../api/callBackendApi/apiSchema";

export const signoutMutation = () => {
	return mutationOptions({
		mutationFn: () => {
			return callBackendApiForQuery("@post/auth/signout", {
				meta: { toast: { success: true } },
			});
		},
		mutationKey: ["auth", "signout"],
	});
};

export const resendVerificationEmailMutation = () => {
	return mutationOptions({
		mutationFn: (body: z.infer<BackendApiRoutes["@post/auth/resend-verification-email"]["body"]>) => {
			return callBackendApiForQuery("@post/auth/resend-verification-email", {
				body,
				meta: { toast: { success: true } },
			});
		},
		mutationKey: ["auth", "resend-verification-email"],
	});
};

export const acceptWorkspaceInvitationMutation = () => {
	return mutationOptions({
		mutationFn: (body: z.infer<BackendApiRoutes["@post/workspace/invitation/accept"]["body"]>) => {
			return callBackendApiForQuery("@post/workspace/invitation/accept", {
				body,
				meta: { toast: { success: true } },
			});
		},
		mutationKey: ["workspace", "invitation", "accept"],
	});
};

export const cancelWorkspaceInvitationMutation = () => {
	return mutationOptions({
		mutationFn: (
			params: z.infer<BackendApiRoutes["@delete/workspace/invitation/:invitationId"]["params"]>
		) => {
			return callBackendApiForQuery("@delete/workspace/invitation/:invitationId", {
				meta: { toast: { success: true } },
				params,
			});
		},
		mutationKey: ["workspace", "invitation", "cancel"],
	});
};

export const changeWorkspaceMemberRoleMutation = () => {
	return mutationOptions({
		mutationFn: (body: z.infer<BackendApiRoutes["@patch/workspace/member/role"]["body"]>) => {
			return callBackendApiForQuery("@patch/workspace/member/role", {
				body,
				meta: { toast: { success: true } },
			});
		},
		mutationKey: ["workspace", "member", "role"],
	});
};

export const permanentlyRemoveWorkspaceMemberMutation = () => {
	return mutationOptions({
		mutationFn: (params: z.infer<BackendApiRoutes["@delete/workspace/member/:memberId"]["params"]>) => {
			return callBackendApiForQuery("@delete/workspace/member/:memberId", {
				meta: { toast: { success: true } },
				params,
			});
		},
		mutationKey: ["workspace", "member", "remove"],
	});
};

export const resendWorkspaceInvitationMutation = () => {
	return mutationOptions({
		mutationFn: (body: z.infer<BackendApiRoutes["@post/workspace/invitation/resend"]["body"]>) => {
			return callBackendApiForQuery("@post/workspace/invitation/resend", {
				body,
				meta: { toast: { success: true } },
			});
		},
		mutationKey: ["workspace", "invitation", "resend"],
	});
};

export const suspendWorkspaceMemberMutation = () => {
	return mutationOptions({
		mutationFn: (bodyData: z.infer<BackendApiRoutes["@post/workspace/member/suspension"]["body"]>) => {
			return callBackendApiForQuery("@post/workspace/member/suspension", {
				body: bodyData,
				meta: { toast: { success: true } },
			});
		},
		mutationKey: ["workspace", "member", "suspend"],
	});
};
