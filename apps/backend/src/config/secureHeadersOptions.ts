import type { secureHeaders } from "hono/secure-headers";

export const secureHeadersOptions = {
	contentSecurityPolicy: {
		connectSrc: ["'self'"],
		defaultSrc: ["'self'"],
		frameAncestors: ["'none'"],
		imgSrc: ["'self'", "https://res.cloudinary.com", "data:"],
		upgradeInsecureRequests: [],
	},
} satisfies Parameters<typeof secureHeaders>[0];

export const bullBoardSecureHeadersOptions = {
	...secureHeadersOptions,
	contentSecurityPolicy: {
		...secureHeadersOptions.contentSecurityPolicy,
		fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
		styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
	},
} satisfies Parameters<typeof secureHeaders>[0];
