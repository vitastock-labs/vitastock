import { ENVIRONMENT } from "@/lib/config/env";

const backendHosts = {
	development: ENVIRONMENT.BASE_BACKEND_HOST_DEV,
	production: ENVIRONMENT.BASE_BACKEND_HOST,
	staging: ENVIRONMENT.BASE_BACKEND_HOST_STAGING,
} satisfies Record<typeof ENVIRONMENT.MODE, string>;

const BACKEND_HOST = backendHosts[ENVIRONMENT.MODE];

export const BASE_API_URL = `${BACKEND_HOST}/api/v1`;
