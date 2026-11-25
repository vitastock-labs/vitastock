import { z } from "zod";

const stringWithNumberValidation = <TNumberSchema extends z.ZodType>(numberSchema: TNumberSchema) => {
	return z.preprocess(
		(value: number | string | undefined) =>
			value === "" || value === undefined ? undefined : Number(value),
		numberSchema
	);
};

export const base64urlJsonValidation = <TSchema extends z.ZodType>(schema: TSchema) => {
	return z.preprocess((value: string) => {
		try {
			return JSON.parse(new TextDecoder().decode(z.util.base64urlToUint8Array(value)));
		} catch {
			return value;
		}
	}, schema);
};

export const OAuth2TokenDataSchema = z.looseObject({
	access_token: z.string().min(1),
	expires_in: stringWithNumberValidation(z.number().nonnegative().optional()),
	id_token: z.string().min(1).optional(),
	refresh_token: z.string().min(1).optional(),
	scope: z.string().optional(),
	token_type: z.string().min(1).optional(),
});

export type OAuth2TokenData = z.output<typeof OAuth2TokenDataSchema>;

export const decodeUnverifiedIdTokenPayload = <TSchema extends z.ZodType>(
	idToken: string,
	schema: TSchema
) => {
	return z
		.jwt()
		.transform((token) => token.split(".", 3)[1] ?? "")
		.pipe(base64urlJsonValidation(schema))
		.parse(idToken);
};

const getRequiredField = <TSchema extends z.ZodType>(schema: TSchema, value: unknown, field: string) => {
	return schema.parse(value, { error: () => `Missing or invalid OAuth 2.0 token field: ${field}` });
};

export const createOAuth2Tokens = (data: OAuth2TokenData) => {
	const expiresInSeconds = () => getRequiredField(z.number(), data.expires_in, "expires_in");

	const idToken = () => getRequiredField(z.string(), data.id_token, "id_token");

	return {
		accessToken: () => data.access_token,
		accessTokenExpiresAt: (now = Date.now()) => new Date(now + expiresInSeconds() * 1000),
		accessTokenExpiresInSeconds: expiresInSeconds,
		data,
		decodeUnverifiedIdToken: <TSchema extends z.ZodType>(schema: TSchema) =>
			decodeUnverifiedIdTokenPayload(idToken(), schema),
		hasAccessTokenExpiry: () => data.expires_in !== undefined,
		hasIdToken: () => data.id_token !== undefined,
		hasRefreshToken: () => data.refresh_token !== undefined,
		hasScopes: () => data.scope !== undefined,
		idToken,
		refreshToken: () => getRequiredField(z.string(), data.refresh_token, "refresh_token"),
		scopes: () => data.scope?.split(" ").filter(Boolean) ?? [],
		tokenType: () => getRequiredField(z.string(), data.token_type, "token_type"),
	};
};

export type OAuth2Tokens = ReturnType<typeof createOAuth2Tokens>;
