import { mutationOptions } from "@tanstack/react-query";
import type { z } from "zod";
import { callBackendApiForQuery } from "../api/callBackendApi";
import type { BackendApiRoutes } from "../api/callBackendApi/apiSchema";
import { isPostHogEnabled, posthog } from "../posthog";

export const signoutMutation = () => {
	return mutationOptions({
		mutationFn: () => {
			return callBackendApiForQuery("@post/auth/signout", {
				meta: { toast: { success: true } },
				onSuccess: () => {
					isPostHogEnabled && posthog.reset();
				},
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
				onSuccess: () => {
					isPostHogEnabled && posthog.capture("workspace_invitation_cancelled");
				},
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
				onSuccess: () => {
					isPostHogEnabled && posthog.capture("workspace_member_role_changed");
				},
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
				onSuccess: () => {
					isPostHogEnabled && posthog.capture("workspace_member_removed");
				},
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
				onSuccess: () => {
					isPostHogEnabled && posthog.capture("workspace_member_suspension_changed");
				},
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
				onSuccess: () => {
					isPostHogEnabled && posthog.capture("inventory_alert_acknowledged");
				},
			});
		},
		mutationKey: ["inventory", "alerts", "acknowledge"],
	});
};

export const inventoryActivityExportMutation = () => {
	return mutationOptions({
		mutationFn: (
			query: z.infer<NonNullable<BackendApiRoutes["@get/inventory/activity/export"]["query"]>>
		) => {
			return callBackendApiForQuery("@get/inventory/activity/export", {
				onSuccess: ({ data, response }) => {
					const disposition = response.headers.get("Content-Disposition");
					const filename = disposition?.match(/filename="(?<filename>[^"]+)"/u)?.groups?.filename;

					forceDownload(data, filename ?? "vitastock-stock-movements.csv");

					isPostHogEnabled && posthog.capture("inventory_activity_exported");
				},
				query,
				responseType: "blob",
			});
		},
		mutationKey: ["inventory", "activity", "export"],
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

const forceDownload = (data: Blob, filename: string) => {
	const fileUrl = URL.createObjectURL(data);
	const link = document.createElement("a");

	link.href = fileUrl;
	link.download = filename;
	document.body.append(link);
	link.click();
	link.remove();
	URL.revokeObjectURL(fileUrl);
};
