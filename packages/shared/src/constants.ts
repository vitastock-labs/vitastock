import { defineEnum, type NonEmptyArray } from "@zayne-labs/toolkit-type-helpers";

export const AUTH_ERRORS = defineEnum(
	{
		ACCOUNT_SUSPENDED: {
			appCode: "ACCOUNT_SUSPENDED",
			message: "Your account is currently suspended",
		},
		EMAIL_UNVERIFIED: {
			appCode: "EMAIL_UNVERIFIED",
			message: "Your email is yet to be verified",
		},
		INSUFFICIENT_PERMISSIONS: {
			appCode: "INSUFFICIENT_PERMISSIONS",
			message: "You do not have permission to perform this action",
		},
		INVALID_SESSION: {
			appCode: "INVALID_SESSION",
			message: "Invalid session. Please log in again",
		},
		PASSWORD_CHANGE_REQUIRED: {
			appCode: "PASSWORD_CHANGE_REQUIRED",
			message: "Password change required",
		},
		SESSION_EXPIRED: {
			appCode: "SESSION_EXPIRED",
			message: "Session expired. Please log in again",
		},
		SESSION_NOT_EXIST: {
			appCode: "SESSION_NOT_EXIST",
			message: "Session doesn't exist. Please log in",
		},
		SESSION_VALIDATION_FAILED: {
			appCode: "SESSION_VALIDATION_FAILED",
			message: "Something went wrong while validating your session. Please log in again",
		},
	},
	{ inferredUnionVariant: "values" }
);

export type AuthErrorAppCodeType = (typeof AUTH_ERRORS.$inferUnion)["appCode"];

export const AUTH_ERROR_APP_CODES = Object.values(AUTH_ERRORS).map(
	(error) => error.appCode
) as NonEmptyArray<AuthErrorAppCodeType>;
