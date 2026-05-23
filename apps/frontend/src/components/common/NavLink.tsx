import type { InferProps } from "@zayne-labs/toolkit-react/utils";
import { isFunction } from "@zayne-labs/toolkit-type-helpers";
import { NavLink as NavLinkPrimitive, useLocation } from "react-router";
import { cnMerge } from "@/lib/utils/cn";

export type MainAppRoutes = string & {};

function NavLink(
	props: InferProps<typeof NavLinkPrimitive> & { transitionType?: "no-transition" | "regular" }
) {
	const { className, to, transitionType = "no-transition", ...restOfProps } = props;

	const { pathname } = useLocation();

	return (
		<NavLinkPrimitive
			to={to}
			data-active={pathname === to}
			className={(renderProps) =>
				cnMerge(
					transitionType !== "no-transition" && "nav-link-transition",
					isFunction(className) ? className(renderProps) : className
				)
			}
			{...restOfProps}
		/>
	);
}

export { NavLink };
