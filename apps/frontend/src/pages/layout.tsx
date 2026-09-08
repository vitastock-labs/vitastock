import { NuqsAdapter } from "nuqs/adapters/react-router/v8";
import { Outlet, ScrollRestoration } from "react-router";
import { useDispatchAppEvent } from "@/lib/hooks/useDispatchAppEvent";
import { useNavigationProgress } from "@/lib/hooks/useNavigationProgress";

function RootLayout() {
	useDispatchAppEvent();
	useNavigationProgress();

	return (
		<div className="isolate flex min-h-svh flex-col">
			<ScrollRestoration />
			<NuqsAdapter>
				<Outlet />
			</NuqsAdapter>
		</div>
	);
}

export default RootLayout;
