import { ENVIRONMENT } from "@/lib/config/env";

const BACKEND_HOST =
	process.env.NODE_ENV === "development" ?
		ENVIRONMENT.BASE_BACKEND_HOST_DEV
	:	ENVIRONMENT.BASE_BACKEND_HOST;

export const BASE_API_URL = `${BACKEND_HOST}/api/v1`;
