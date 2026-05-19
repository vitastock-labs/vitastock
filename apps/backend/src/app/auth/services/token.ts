/* eslint-disable import/no-named-as-default-member */

import type { SelectUserType } from "@vitastock/db/schema/auth";
import { pickKeys } from "@zayne-labs/toolkit-core";
import { consola } from "consola";
import { isPast } from "date-fns";
/* eslint-disable import/default */
import jwt from "jsonwebtoken";
/* eslint-enable import/default */
import { z } from "zod";
import { ENVIRONMENT } from "@/config/env";
import { getValidatedValue, type GetValidatedValueExtraOptions } from "@/lib/utils";

type JwtOptions<TExtraOptions> = TExtraOptions & {
	expiresIn?: number;
	secretKey?: string;
};

const AuthJwtPayloadSchema = z.object({
	id: z.string().min(1, "Id cannot be an empty string"),
});

type EncodeJwtOptions = JwtOptions<jwt.SignOptions>;

export const encodeJwtToken = <
	TSchema extends z.ZodType<Record<string, unknown>> = typeof AuthJwtPayloadSchema,
>(
	payload: z.infer<TSchema>,
	options?: EncodeJwtOptions & { schema?: TSchema }
) => {
	const {
		schema = AuthJwtPayloadSchema,
		secretKey = ENVIRONMENT.ACCESS_SECRET,
		...restOfOptions
	} = options ?? {};

	const validPayload = getValidatedValue(payload, schema);

	const encodedToken = jwt.sign(validPayload, secretKey, restOfOptions);

	return encodedToken;
};

type DecodeJwtOptions = JwtOptions<jwt.VerifyOptions>;

export const decodeJwtToken = <
	TSchema extends z.ZodType<Record<string, unknown>> = typeof AuthJwtPayloadSchema,
>(
	token: string,
	options?: DecodeJwtOptions & {
		onValidationError?: GetValidatedValueExtraOptions["onError"];
		schema?: TSchema;
	}
) => {
	const {
		onValidationError,
		schema = AuthJwtPayloadSchema,
		secretKey = ENVIRONMENT.ACCESS_SECRET,
		...restOfOptions
	} = options ?? {};

	const decodedPayload = jwt.verify(token, secretKey, restOfOptions);

	const validPayload = getValidatedValue(decodedPayload as z.infer<TSchema>, schema as TSchema, {
		onError: onValidationError,
	});

	return validPayload;
};

export const generateAccessToken = (
	user: SelectUserType,
	options?: Pick<EncodeJwtOptions, "expiresIn">
): SelectUserType["refreshTokenArray"][number] => {
	const { expiresIn = ENVIRONMENT.ACCESS_JWT_EXPIRES_IN } = options ?? {};

	const payload = pickKeys(user, ["id"]);

	const accessToken = encodeJwtToken(payload, { expiresIn, secretKey: ENVIRONMENT.ACCESS_SECRET });

	const expiresAt = new Date(Date.now() + expiresIn);

	const issuedAt = new Date();

	return { expiresAt, issuedAt, token: accessToken };
};

export const generateRefreshToken = (
	user: SelectUserType,
	options?: Pick<EncodeJwtOptions, "expiresIn">
): SelectUserType["refreshTokenArray"][number] => {
	const { expiresIn = ENVIRONMENT.REFRESH_JWT_EXPIRES_IN } = options ?? {};

	const payload = pickKeys(user, ["id"]);

	const refreshToken = encodeJwtToken(payload, { expiresIn, secretKey: ENVIRONMENT.REFRESH_SECRET });

	const expiresAt = new Date(Date.now() + expiresIn);

	const issuedAt = new Date();

	return { expiresAt, issuedAt, token: refreshToken };
};

export const isTokenInWhitelist = (
	refreshTokenArray: SelectUserType["refreshTokenArray"],
	zayneRefreshToken: string
) => {
	return refreshTokenArray.some((item) => item.token === zayneRefreshToken);
};

export const warnAboutTokenReuse = (options: {
	compromisedRefreshToken: string;
	compromisedUser: SelectUserType;
	requestUserAgent: string;
}) => {
	const { compromisedRefreshToken, compromisedUser, requestUserAgent } = options;

	const error = new Error("Possible token reuse detected!", {
		cause: {
			compromisedRefreshToken,
			compromisedUserDetails: pickKeys(compromisedUser, ["id", "email", "fullName", "role"]),
			userAgent: requestUserAgent,
		},
	});

	consola.warn(error);
};

type TokenArrayOptions = {
	currentUser: SelectUserType;
	variant?: "keep-current" | "remove-current";
	zayneRefreshToken: string | undefined;
};

export const getUpdatedTokenResultArray = (
	options: TokenArrayOptions
): SelectUserType["refreshTokenArray"] => {
	const { currentUser, variant = "remove-current", zayneRefreshToken } = options;

	if (!zayneRefreshToken) {
		return currentUser.refreshTokenArray.filter((item) => !isPast(item.expiresAt));
	}

	return currentUser.refreshTokenArray.filter((item) => {
		if (isPast(item.expiresAt)) return false;

		return variant === "remove-current" ?
				item.token !== zayneRefreshToken
			:	item.token === zayneRefreshToken;
	});
};
