import { createFetchClient, type BaseCallApiConfig } from "@zayne-labs/callapi";
import { fallBackRouteSchemaKey } from "@zayne-labs/callapi/constants";
import { defineSchema, toSearchParams } from "@zayne-labs/callapi/utils";
import { z } from "zod";
import { OAuth2RequestError, OAuth2ResponseError, OAuth2TransportError } from "./errors";
import { createOAuth2Tokens, OAuth2TokenDataSchema } from "./tokens";

export type OAuth2ClientAuthentication = "client_secret_basic" | "client_secret_post" | "none";

export type OAuth2CallApiConfig = Omit<
	BaseCallApiConfig,
	| "auth"
	| "bodyTransformer"
	| "dedupeStrategy"
	| "responseParser"
	| "responseType"
	| "resultMode"
	| "schema"
	| "throwOnError"
>;
type OAuth2RequestBody = Record<string, string>;
export type OAuth2ExtensionParameters = Record<string, string>;

export type OAuth2ClientOptions = {
	authorizationEndpoint: string;
	callApiConfig?: OAuth2CallApiConfig;
	clientAuthentication?: OAuth2ClientAuthentication;
	clientId: string;
	clientSecret?: string;
	redirectUri?: string;
	revocationEndpoint?: string;
	tokenEndpoint: string;
};

export type CreateAuthorizationUrlOptions = {
	codeVerifier?: string;
	parameters?: Record<string, string>;
	scopes?: string[];
	state: string;
};

export type CreateAuthorizationRequestOptions = Omit<
	CreateAuthorizationUrlOptions,
	"codeVerifier" | "state"
>;

export type ExchangeAuthorizationCodeOptions = {
	code: string;
	codeVerifier?: string;
	parameters?: OAuth2ExtensionParameters;
};

export type RefreshAccessTokenOptions = {
	parameters?: OAuth2ExtensionParameters;
	refreshToken: string;
	scopes?: string[];
};

export type RevokeTokenOptions = {
	parameters?: OAuth2ExtensionParameters;
};

const OAuth2ResponseDataSchema = z.record(z.string(), z.unknown());
const OAuth2RequestBodySchema = z.record(z.string(), z.string());
const reservedAuthorizationParameters = new Set([
	"client_id",
	"code_challenge",
	"code_challenge_method",
	"redirect_uri",
	"response_type",
	"state",
]);
const reservedClientParameters = new Set(["client_id", "client_secret"]);
const reservedExchangeParameters = new Set([
	...reservedClientParameters,
	"code",
	"code_verifier",
	"grant_type",
	"redirect_uri",
]);
const reservedRefreshParameters = new Set([
	...reservedClientParameters,
	"grant_type",
	"refresh_token",
	"scope",
]);
const reservedRevocationParameters = new Set([...reservedClientParameters, "token"]);

const encodeFormComponent = (value: string) => {
	return new URLSearchParams({ value }).toString().slice("value=".length);
};

const encodeBase64Url = (bytes: Uint8Array) => {
	const binary = Array.from(bytes, (byte) => String.fromCodePoint(byte)).join("");

	return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
};

const getOptionalString = (data: Record<string, unknown>, field: string) => {
	return typeof data[field] === "string" ? data[field] : null;
};

const addExtensionParameters = (
	body: OAuth2RequestBody,
	parameters: OAuth2ExtensionParameters | undefined,
	reservedParameters: ReadonlySet<string>
) => {
	for (const key of Object.keys(parameters ?? {})) {
		if (reservedParameters.has(key)) {
			throw new TypeError(`OAuth 2.0 extension parameter cannot override ${key}`);
		}
	}

	return { ...body, ...parameters };
};

const createResponseError = (status: number, body: unknown) => {
	const parsedBody = OAuth2ResponseDataSchema.safeParse(body);

	if (!parsedBody.success || typeof parsedBody.data.error !== "string") {
		return new OAuth2ResponseError(status, body);
	}

	return new OAuth2RequestError(
		status,
		parsedBody.data.error,
		getOptionalString(parsedBody.data, "error_description"),
		getOptionalString(parsedBody.data, "error_uri"),
		getOptionalString(parsedBody.data, "state"),
		parsedBody.data
	);
};

export const generateOAuth2State = () => {
	const bytes = crypto.getRandomValues(new Uint8Array(32));

	return encodeBase64Url(bytes);
};

export const generateOAuth2CodeVerifier = generateOAuth2State;

export const createS256CodeChallenge = async (codeVerifier: string) => {
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(codeVerifier));

	return encodeBase64Url(new Uint8Array(digest));
};

export const createOAuth2Client = (options: OAuth2ClientOptions) => {
	const clientSecret = options.clientSecret ?? null;

	const clientAuthentication =
		options.clientAuthentication ?? (clientSecret ? "client_secret_basic" : "none");

	if (clientAuthentication !== "none" && !clientSecret) {
		throw new TypeError(`${clientAuthentication} requires a clientSecret`);
	}

	const requireClientSecret = () => {
		if (!clientSecret) {
			throw new TypeError(`${clientAuthentication} requires a clientSecret`);
		}

		return clientSecret;
	};

	const getBaseAuth = () => {
		if (clientAuthentication !== "client_secret_basic") return;

		return {
			password: () => encodeFormComponent(requireClientSecret()),
			type: "Basic" as const,
			username: () => encodeFormComponent(options.clientId),
		};
	};

	const callOAuth2Api = createFetchClient({
		...options.callApiConfig,
		auth: getBaseAuth(),
		bodyTransformer: ({ body }) => toSearchParams(body as OAuth2RequestBody),
		dedupeStrategy: "none",
		schema: defineSchema({
			[fallBackRouteSchemaKey]: {
				body: OAuth2RequestBodySchema,
				errorData: z.unknown(),
			},
		}),
	});

	const createAuthorizationUrl = async (authorizationOptions: CreateAuthorizationUrlOptions) => {
		const { codeVerifier, parameters = {}, scopes = [], state } = authorizationOptions;
		const url = new URL(options.authorizationEndpoint);

		url.searchParams.set("response_type", "code");
		url.searchParams.set("client_id", options.clientId);
		url.searchParams.set("state", state);

		if (options.redirectUri) {
			url.searchParams.set("redirect_uri", options.redirectUri);
		}

		if (scopes.length > 0) {
			url.searchParams.set("scope", scopes.join(" "));
		}

		if (codeVerifier) {
			url.searchParams.set("code_challenge_method", "S256");
			url.searchParams.set("code_challenge", await createS256CodeChallenge(codeVerifier));
		}

		for (const [key, value] of Object.entries(parameters)) {
			if (reservedAuthorizationParameters.has(key)) {
				throw new TypeError(`Authorization parameter cannot override ${key}`);
			}

			url.searchParams.set(key, value);
		}

		return url;
	};

	const createAuthorizationRequest = async (
		authorizationOptions: CreateAuthorizationRequestOptions = {}
	) => {
		const codeVerifier = generateOAuth2CodeVerifier();
		const state = generateOAuth2State();
		const url = await createAuthorizationUrl({ ...authorizationOptions, codeVerifier, state });

		return { codeVerifier, state, url };
	};

	const addClientCredentials = (body: OAuth2RequestBody) => {
		if (clientAuthentication === "client_secret_post") {
			return { ...body, client_id: options.clientId, client_secret: requireClientSecret() };
		}

		if (clientAuthentication === "none") {
			return { ...body, client_id: options.clientId };
		}

		return body;
	};

	const sendRequest = async <TData>(
		endpoint: string,
		body: OAuth2RequestBody,
		dataSchema: z.ZodType<TData>,
		responseType?: "text"
	) => {
		const result = await callOAuth2Api(endpoint, {
			body: addClientCredentials(body),
			method: "POST",
			responseType,
			schema: ({ currentRouteSchema }) => ({ ...currentRouteSchema, data: dataSchema }),
		});

		if (!result.error) {
			return result.data;
		}

		if (!result.response) {
			throw new OAuth2TransportError(result.error.originalError);
		}

		if (result.error.name === "HTTPError") {
			throw createResponseError(result.response.status, result.error.errorData);
		}

		throw new OAuth2ResponseError(result.response.status, result.error.errorData);
	};

	const requestTokens = async (body: OAuth2RequestBody) => {
		const tokenData = await sendRequest(options.tokenEndpoint, body, OAuth2TokenDataSchema);

		return createOAuth2Tokens(tokenData);
	};

	const exchangeAuthorizationCode = (exchangeOptions: ExchangeAuthorizationCodeOptions) => {
		const body: OAuth2RequestBody = { code: exchangeOptions.code, grant_type: "authorization_code" };

		if (options.redirectUri) {
			body.redirect_uri = options.redirectUri;
		}

		if (exchangeOptions.codeVerifier) {
			body.code_verifier = exchangeOptions.codeVerifier;
		}

		return requestTokens(
			addExtensionParameters(body, exchangeOptions.parameters, reservedExchangeParameters)
		);
	};

	const refreshAccessToken = (refreshOptions: RefreshAccessTokenOptions) => {
		const body: OAuth2RequestBody = {
			grant_type: "refresh_token",
			refresh_token: refreshOptions.refreshToken,
		};

		if (refreshOptions.scopes?.length) {
			body.scope = refreshOptions.scopes.join(" ");
		}

		return requestTokens(
			addExtensionParameters(body, refreshOptions.parameters, reservedRefreshParameters)
		);
	};

	const revokeToken = async (token: string, revokeOptions: RevokeTokenOptions = {}) => {
		if (!options.revocationEndpoint) {
			throw new TypeError("This OAuth 2.0 provider does not define a revocation endpoint");
		}

		const body = addExtensionParameters(
			{ token },
			revokeOptions.parameters,
			reservedRevocationParameters
		);

		await sendRequest(options.revocationEndpoint, body, z.string(), "text");
	};

	return {
		createAuthorizationRequest,
		createAuthorizationUrl,
		exchangeAuthorizationCode,
		refreshAccessToken,
		revokeToken,
	};
};

export type OAuth2Client = ReturnType<typeof createOAuth2Client>;
