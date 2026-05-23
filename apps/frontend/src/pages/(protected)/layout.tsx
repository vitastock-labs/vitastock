import { useQuery } from "@tanstack/react-query";
import { Outlet } from "react-router";
import { LoadingScreen } from "@/components/common/LoadingScreen";
import { sessionQuery } from "@/lib/react-query/queryOptions";

function ProtectedLayout() {
	const sessionQueryResult = useQuery(sessionQuery());

	return (
		<>
			{sessionQueryResult.data && <Outlet />}
			<LoadingScreen isVisible={!sessionQueryResult.data} loadingText="Verifying account..." />
		</>
	);
}

export default ProtectedLayout;
