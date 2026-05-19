import { getBackendEnv } from "@vitastock/env/backend";

const ENVIRONMENT = getBackendEnv();

export const getFrontendURL = () => {
	return ENVIRONMENT.NODE_ENV === "development" ?
			ENVIRONMENT.BASE_FRONTEND_HOST_DEV
		:	ENVIRONMENT.BASE_FRONTEND_HOST;
};
