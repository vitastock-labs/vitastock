import { useQuery } from "@tanstack/react-query";
import type { BaseApiErrorResponse } from "@vitastock/shared/validation/backendApiSchema";
import { isHTTPError } from "@zayne-labs/callapi/utils";
import { useEffect } from "react";
import { Outlet, useNavigate } from "react-router";
import { LoadingScreen } from "@/components/common/LoadingScreen";
import { Switch } from "@/components/common/switch";
import { posthog } from "@/lib/posthog";
import { sessionQuery } from "@/lib/react-query/queryOptions";
import { ForceChangePasswordDialog } from "@/pages/(protected)/-components/ForceChangePasswordDialog";

function ProtectedLayout() {
	const navigate = useNavigate();

	const sessionQueryResult = useQuery(
		sessionQuery({
			auth: { redirectFn: (route) => navigate(route, { replace: true }) },
			toast: {
				errorsToSkipCondition: (error) =>
					isHTTPError(error) && error.errorData.appCode === "PASSWORD_CHANGE_REQUIRED",
			},
		})
	);

	const mustChangePassword =
		(sessionQueryResult.error?.cause as BaseApiErrorResponse | undefined)?.appCode
		=== "PASSWORD_CHANGE_REQUIRED";

	useEffect(() => {
		const user = sessionQueryResult.data?.user;

		user
			&& posthog?.identify(user.id, {
				email: user.email,
				name: user.fullName,
				role: user.role,
			});
	}, [sessionQueryResult.data?.user]);

	return (
		<Switch.Root>
			<Switch.Match when={mustChangePassword}>
				<ForceChangePasswordDialog />
			</Switch.Match>

			<Switch.Match when={!sessionQueryResult.data}>
				<LoadingScreen isVisible={true} loadingText="Verifying account..." />
			</Switch.Match>

			<Switch.Default>
				<Outlet />
			</Switch.Default>
		</Switch.Root>
	);
}

export default ProtectedLayout;
