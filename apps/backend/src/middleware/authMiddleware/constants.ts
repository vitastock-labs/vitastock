import { defineEnum } from "@zayne-labs/toolkit-type-helpers";

export const AUTH_ERROR_MESSAGES = defineEnum({
	ACCOUNT_SUSPENDED: "Your account is currently suspended",
	EMAIL_UNVERIFIED: "Your email is yet to be verified",
	GENERIC_ERROR: "An error occurred. Please log in again",
	INVALID_SESSION: "Invalid session. Please log in again",
	SESSION_EXPIRED: "Session expired. Please log in again",
	SESSION_NOT_EXIST: "Session doesn't exist. Please log in",
});
