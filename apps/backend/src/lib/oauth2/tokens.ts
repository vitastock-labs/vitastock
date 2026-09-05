import { z } from "zod";

export const OAuth2TokenDataSchema = z
	.object({
		access_token: z.string().min(1),
		expires_in: z.number().nonnegative().optional(),
		id_token: z.string().min(1).optional(),
		refresh_token: z.string().min(1).optional(),
		scope: z.string().optional(),
		token_type: z.string().min(1),
	})
	.loose();

type OAuth2TokenData = z.output<typeof OAuth2TokenDataSchema>;

const requireString = (data: OAuth2TokenData, field: string) => {
	const value = data[field];

	if (typeof value !== "string") {
		throw new TypeError(`Missing or invalid OAuth 2.0 token field: ${field}`);
	}

	return value;
};

const decodeBase64Url = (value: string) => {
	const base64 = value
		.replaceAll("-", "+")
		.replaceAll("_", "/")
		.padEnd(Math.ceil(value.length / 4) * 4, "=");
	const bytes = Uint8Array.from(atob(base64), (character) => character.codePointAt(0) ?? 0);

	return new TextDecoder().decode(bytes);
};

export const decodeUnverifiedIdTokenPayload = <TSchema extends z.ZodType>(
	idToken: string,
	schema: TSchema
) => {
	const encodedPayload = idToken.split(".")[1];

	if (!encodedPayload) {
		throw new TypeError("Invalid ID token");
	}

	try {
		return schema.parse(JSON.parse(decodeBase64Url(encodedPayload)));
	} catch (error) {
		throw new TypeError("Invalid ID token payload", { cause: error });
	}
};

export const createOAuth2Tokens = (data: OAuth2TokenData) => {
	const accessToken = () => data.access_token;
	const tokenType = () => data.token_type;
	const expiresInSeconds = () => {
		const value = data.expires_in;

		if (value === undefined) {
			throw new TypeError("Missing or invalid OAuth 2.0 token field: expires_in");
		}

		return value;
	};
	const scopes = () => data.scope?.split(" ").filter(Boolean) ?? [];

	return {
		accessToken,
		accessTokenExpiresAt: (now = Date.now()) => new Date(now + expiresInSeconds() * 1000),
		accessTokenExpiresInSeconds: expiresInSeconds,
		data,
		decodeUnverifiedIdToken: <TSchema extends z.ZodType>(schema: TSchema) =>
			decodeUnverifiedIdTokenPayload(requireString(data, "id_token"), schema),
		hasAccessTokenExpiry: () => data.expires_in !== undefined,
		hasIdToken: () => data.id_token !== undefined,
		hasRefreshToken: () => data.refresh_token !== undefined,
		hasScopes: () => data.scope !== undefined,
		idToken: () => requireString(data, "id_token"),
		refreshToken: () => requireString(data, "refresh_token"),
		scopes,
		tokenType,
	};
};

export type OAuth2Tokens = ReturnType<typeof createOAuth2Tokens>;
