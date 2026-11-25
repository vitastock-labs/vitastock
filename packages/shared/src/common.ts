import { getBackendEnv } from "@vitastock/env/backend";

const ENVIRONMENT = getBackendEnv();

const frontendHosts = {
	development: ENVIRONMENT.BASE_FRONTEND_HOST_DEV,
	production: ENVIRONMENT.BASE_FRONTEND_HOST,
	staging: ENVIRONMENT.BASE_FRONTEND_HOST_STAGING,
} as const satisfies Record<typeof ENVIRONMENT.NODE_ENV, string>;

export const getFrontendURL = () => {
	return frontendHosts[ENVIRONMENT.NODE_ENV];
};
