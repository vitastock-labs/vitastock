import { Outlet, ScrollRestoration } from "react-router";
import { useDispatchAppEvent } from "@/lib/hooks/useDispatchAppEvent";
import { useNavigationProgress } from "@/lib/hooks/useNavigationProgress";

function RootLayout() {
	useDispatchAppEvent();
	useNavigationProgress();

	return (
		<div className="isolate flex min-h-svh flex-col">
			<ScrollRestoration />
			<Outlet />
		</div>
	);
}

export default RootLayout;
