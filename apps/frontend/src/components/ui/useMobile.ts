import { on } from "@zayne-labs/toolkit-core";
import { useEffect, useState } from "react";

const useIsMobile = (options: { enable?: boolean; mobileBreakpoint?: number }) => {
	const { enable = true, mobileBreakpoint = 768 } = options;

	const [isMobile, setIsMobile] = useState<boolean | undefined>();

	useEffect(() => {
		if (!enable) return;

		const mql = window.matchMedia(`(max-width: ${mobileBreakpoint - 1}px)`);

		const onChange = () => setIsMobile(window.innerWidth < mobileBreakpoint);

		const cleanup = on(mql, "change", onChange);

		// eslint-disable-next-line react/set-state-in-effect
		onChange();

		return () => cleanup();
	}, [mobileBreakpoint, enable]);

	return Boolean(isMobile);
};

export { useIsMobile };
