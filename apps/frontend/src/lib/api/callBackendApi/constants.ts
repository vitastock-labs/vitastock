import { ENVIRONMENT } from "@/lib/config/env";

const BACKEND_HOST =
	ENVIRONMENT.MODE === "development" ? ENVIRONMENT.BASE_BACKEND_HOST_DEV : ENVIRONMENT.BASE_BACKEND_HOST;

export const BASE_API_URL = `${BACKEND_HOST}/api/v1`;
