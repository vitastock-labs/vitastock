import posthogClient from "posthog-js";

const posthogKey: string | null = "phc_rPeD43twFYdicjRwTtwqYGC8NJDLLrX3Cfd5gXMewYND";

export const isPostHogEnabled = Boolean(posthogKey);

posthogClient.init(posthogKey, {
	api_host: "https://eu.i.posthog.com",
	capture_exceptions: {
		capture_console_errors: false,
		capture_unhandled_errors: true,
		capture_unhandled_rejections: true,
	},
	defaults: "2026-05-30",
});

// eslint-disable-next-line unicorn/prefer-export-from
export { posthogClient as posthog };
