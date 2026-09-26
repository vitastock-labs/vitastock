import type { InferProps } from "@zayne-labs/toolkit-react/utils";
import { isFunction } from "@zayne-labs/toolkit-type-helpers";
import { NavLink as NavLinkPrimitive, useLocation } from "react-router";
import { cnMerge } from "@/lib/utils/cn";

export type MainAppRoutes = string & {};

export function NavLink(
	props: InferProps<typeof NavLinkPrimitive> & { transitionType?: "no-transition" | "regular" }
) {
	const { className, to, transitionType = "no-transition", ...restOfProps } = props;

	const { pathname } = useLocation();

	return (
		<NavLinkPrimitive
			to={to}
			data-active={pathname === to}
			className={(ctx) =>
				cnMerge(
					transitionType !== "no-transition" && "nav-link-transition",
					isFunction(className) ? className(ctx) : className
				)
			}
			{...restOfProps}
		/>
	);
}

export const NavLinkEphemeral: typeof NavLink = (props) => {
	const { className, ...restOfProps } = props;

	return (
		<NavLink
			className={(ctx) => cnMerge("contents", isFunction(className) ? className(ctx) : className)}
			{...restOfProps}
		/>
	);
};
