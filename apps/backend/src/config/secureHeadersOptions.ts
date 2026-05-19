import type { secureHeaders } from "hono/secure-headers";

export const secureHeadersOptions = {
	contentSecurityPolicy: {
		connectSrc: ["'self'"],
		defaultSrc: ["'self'"],
		frameAncestors: ["'none'"],
		imgSrc: ["'self'", "https://res.cloudinary.com", "data:"],
		upgradeInsecureRequests: ["'self'"],
	},
} satisfies Parameters<typeof secureHeaders>[0];
