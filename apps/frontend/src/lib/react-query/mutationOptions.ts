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

export const removeWorkspaceMemberMutation = () => {
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

export const suspendWorkspaceMemberMutation = () => {
	return mutationOptions({
		mutationFn: (body: z.infer<BackendApiRoutes["@post/workspace/member/suspension"]["body"]>) => {
			return callBackendApiForQuery("@post/workspace/member/suspension", {
				body,
				meta: { toast: { success: true } },
			});
		},
		mutationKey: ["workspace", "member", "suspend"],
	});
};

export const acknowledgeInventoryAlertMutation = () => {
	return mutationOptions({
		mutationFn: (body: z.infer<BackendApiRoutes["@post/inventory/alerts/acknowledge"]["body"]>) => {
			return callBackendApiForQuery("@post/inventory/alerts/acknowledge", {
				body,
				meta: { toast: { success: true } },
			});
		},
		mutationKey: ["inventory", "alerts", "acknowledge"],
	});
};

export const handleInventoryDrugActionMutation = (
	params: z.infer<BackendApiRoutes["@post/inventory/drugs/:drugId/action"]["params"]>
) => {
	return mutationOptions({
		mutationFn: (body: z.infer<BackendApiRoutes["@post/inventory/drugs/:drugId/action"]["body"]>) => {
			return callBackendApiForQuery("@post/inventory/drugs/:drugId/action", {
				body,
				meta: { toast: { success: true } },
				params,
			});
		},
		mutationKey: ["inventory", "drugs", "action", params.drugId],
	});
};
