import { lazy } from "react";
import { createBrowserRouter, createRoutesFromElements, Route, RouterProvider } from "react-router";
import { SonnerToaster } from "./components/common/Toaster";
import ErrorPage from "./pages/error";
import RootLayout from "./pages/layout";
import NotFoundPage from "./pages/not-found";
import { Providers } from "./Providers";

/* Layouts */
const HomeLayout = lazy(() => import("./pages/(home)/layout"));
const AuthLayout = lazy(() => import("./pages/auth/layout"));
const ProtectedLayout = lazy(() => import("./pages/(protected)/layout"));
const DashboardLayout = lazy(() => import("./pages/(protected)/dashboard/layout"));

const routes = createRoutesFromElements(
	<Route Component={RootLayout} errorElement={<ErrorPage />}>
		<Route Component={HomeLayout}>
			<Route path="/" Component={lazy(() => import("./pages/(home)/page"))} />
		</Route>

		<Route Component={AuthLayout}>
			<Route path="/auth/signup" Component={lazy(() => import("./pages/auth/signup/page"))} />
			<Route path="/auth/signin" Component={lazy(() => import("./pages/auth/signin/page"))} />
			<Route
				path="/auth/verify-email"
				Component={lazy(() => import("./pages/auth/verify-email/page"))}
			/>
			<Route
				path="/auth/verify-email/success"
				Component={lazy(() => import("./pages/auth/verify-email/success/page"))}
			/>
			<Route
				path="/auth/forgot-password"
				Component={lazy(() => import("./pages/auth/forgot-password/page"))}
			/>
			<Route
				path="/auth/reset-password"
				Component={lazy(() => import("./pages/auth/reset-password/page"))}
			/>
			<Route
				path="/auth/reset-password/success"
				Component={lazy(() => import("./pages/auth/reset-password/success/page"))}
			/>
		</Route>

		<Route Component={ProtectedLayout}>
			<Route Component={DashboardLayout}>
				<Route
					path="/dashboard"
					Component={lazy(() => import("./pages/(protected)/dashboard/page"))}
				/>
				<Route
					path="/dashboard/inventory"
					Component={lazy(() => import("./pages/(protected)/dashboard/inventory/page"))}
				/>
				<Route
					path="/dashboard/reports"
					Component={lazy(() => import("./pages/(protected)/dashboard/reports/page"))}
				/>
				<Route
					path="/dashboard/alerts"
					Component={lazy(() => import("./pages/(protected)/dashboard/alerts/page"))}
				/>
				<Route
					path="/dashboard/settings"
					Component={lazy(() => import("./pages/(protected)/dashboard/settings/page"))}
				/>
			</Route>
		</Route>

		{/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
		<Route path="*" Component={NotFoundPage} />
	</Route>
);

const browserRouter = createBrowserRouter(routes);

export function Router() {
	return (
		<Providers>
			{/* <Suspense fallback={<LoadingScreen />}> */}
			<RouterProvider router={browserRouter} />
			{/* </Suspense> */}
			<SonnerToaster />
		</Providers>
	);
}
