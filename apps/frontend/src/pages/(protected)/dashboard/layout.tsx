import { Outlet } from "react-router";
import { DashboardHeader } from "./-components/DashboardHeader";
import { DashboardSidebar } from "./-components/DashboardSidebar";

function DashboardLayout() {
	return (
		<div className="flex grow bg-[hsl(210,17%,98%)]">
			<DashboardSidebar />
			<div className="flex grow flex-col">
				<DashboardHeader />
				<Outlet />
			</div>
		</div>
	);
}

export default DashboardLayout;
