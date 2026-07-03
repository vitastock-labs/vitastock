import { useQuery } from "@tanstack/react-query";
import type { BaseApiErrorResponse } from "@vitastock/shared/validation/backendApiSchema";
import { Outlet, useNavigate } from "react-router";
import { LoadingScreen } from "@/components/common/LoadingScreen";
import { Switch } from "@/components/common/switch";
import { sessionQuery } from "@/lib/react-query/queryOptions";
import { ForceChangePasswordDialog } from "@/pages/(protected)/-components/ForceChangePasswordDialog";

function ProtectedLayout() {
	const navigate = useNavigate();

	const sessionQueryResult = useQuery(
		sessionQuery({
			auth: { redirectFn: (route) => void navigate(route, { replace: true }) },
		})
	);

	const mustChangePassword =
		(sessionQueryResult.error?.cause as BaseApiErrorResponse | undefined)?.appCode
		=== "PASSWORD_CHANGE_REQUIRED";

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
