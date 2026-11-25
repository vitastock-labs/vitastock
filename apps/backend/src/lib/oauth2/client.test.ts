import { expect, test, vi } from "vitest";
import { z } from "zod";
import { createOAuth2Client, decodeUnverifiedIdTokenPayload } from ".";

const createFetch = (response: Response) => vi.fn<typeof fetch>(() => Promise.resolve(response));

const encodeSegment = (value: Record<string, unknown>) =>
	Buffer.from(JSON.stringify(value)).toString("base64url");

test("OAuth2 client - creates a Google authorization URL with PKCE and provider parameters", async () => {
	const client = createOAuth2Client({
		authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
		clientId: "client-id",
		clientSecret: "client-secret",
		redirectUri: "https://example.com/oauth/callback",
		tokenEndpoint: "https://oauth2.googleapis.com/token",
	});
	const url = await client.createAuthorizationUrl({
		codeVerifier: "test-code-verifier",
		parameters: { access_type: "offline", prompt: "consent" },
		scopes: ["openid", "email"],
		state: "test-state",
	});

	expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
	expect(url.searchParams.get("state")).toBe("test-state");
	expect(url.searchParams.get("scope")).toBe("openid email");
	expect(url.searchParams.get("code_challenge_method")).toBe("S256");
	expect(url.searchParams.get("code_challenge")).toBeTruthy();
	expect(url.searchParams.get("access_type")).toBe("offline");
});

test("OAuth2 client - prevents extra parameters from replacing protocol fields", async () => {
	const client = createOAuth2Client({
		authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
		clientId: "client-id",
		clientSecret: "client-secret",
		tokenEndpoint: "https://oauth2.googleapis.com/token",
	});

	await expect(
		client.createAuthorizationUrl({ parameters: { state: "replaced" }, state: "original" })
	).rejects.toThrow("Authorization parameter cannot override state");
});

test("OAuth2 client - creates a complete state and PKCE authorization request", async () => {
	const client = createOAuth2Client({
		authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
		clientId: "client-id",
		clientSecret: "client-secret",
		tokenEndpoint: "https://oauth2.googleapis.com/token",
	});
	const request = await client.createAuthorizationRequest({ scopes: ["openid", "email"] });

	expect(request.state).toHaveLength(43);
	expect(request.codeVerifier).toHaveLength(43);
	expect(request.url.searchParams.get("state")).toBe(request.state);
	expect(request.url.searchParams.get("code_challenge_method")).toBe("S256");
});

test("OAuth2 client - decodes and validates ID token claims", () => {
	const idToken = `${encodeSegment({ alg: "RS256", typ: "JWT" })}.${encodeSegment({
		email: "user@example.com",
		sub: "google-user-id",
	})}.c2lnbmF0dXJl`;
	const claims = decodeUnverifiedIdTokenPayload(
		idToken,
		z.object({
			email: z.email(),
			sub: z.string(),
		})
	);

	expect(claims).toEqual({ email: "user@example.com", sub: "google-user-id" });
});

test("OAuth2 client - exchanges an authorization code through CallApi transport", async () => {
	const customFetchImpl = createFetch(
		Response.json(
			{
				access_token: "access-token",
				refresh_token: "refresh-token",
				token_type: "Bearer",
			},
			{ headers: { "Content-Type": "application/json" }, status: 200 }
		)
	);
	const client = createOAuth2Client({
		authorizationEndpoint: "https://provider.example/authorize",
		callApiConfig: { customFetchImpl },
		clientId: "client-id",
		clientSecret: "client-secret",
		tokenEndpoint: "https://provider.example/token",
	});
	const tokens = await client.exchangeAuthorizationCode({
		code: "authorization-code",
		parameters: { audience: "https://provider.example/api" },
	});

	expect(tokens.accessToken()).toBe("access-token");
	expect(tokens.hasAccessTokenExpiry()).toBe(false);
	expect(tokens.refreshToken()).toBe("refresh-token");
	expect(customFetchImpl).toHaveBeenCalledOnce();
	expect(customFetchImpl.mock.calls[0]?.[1]).toMatchObject({
		method: "POST",
	});
	expect(customFetchImpl.mock.calls[0]?.[1]?.body).toEqual(
		new URLSearchParams([
			["code", "authorization-code"],
			["grant_type", "authorization_code"],
			["audience", "https://provider.example/api"],
		])
	);
	expect(new Headers(customFetchImpl.mock.calls[0]?.[1]?.headers).get("Authorization")).toBe(
		"Basic Y2xpZW50LWlkOmNsaWVudC1zZWNyZXQ="
	);
});

test("OAuth2 client - exposes provider error details", async () => {
	const customFetchImpl = createFetch(
		Response.json(
			{ error: "invalid_grant", error_description: "Authorization code expired" },
			{ headers: { "Content-Type": "application/json" }, status: 400 }
		)
	);
	const client = createOAuth2Client({
		authorizationEndpoint: "https://provider.example/authorize",
		callApiConfig: { customFetchImpl },
		clientId: "client-id",
		tokenEndpoint: "https://provider.example/token",
	});

	await expect(client.exchangeAuthorizationCode({ code: "expired-code" })).rejects.toMatchObject({
		code: "invalid_grant",
		description: "Authorization code expired",
		name: "OAuth2RequestError",
		status: 400,
	});
});

test("OAuth2 client - accepts token responses without token_type and with a string expires_in", async () => {
	const customFetchImpl = createFetch(
		Response.json(
			{ access_token: "access-token", expires_in: "3600" },
			{ headers: { "Content-Type": "application/json" }, status: 200 }
		)
	);
	const client = createOAuth2Client({
		authorizationEndpoint: "https://provider.example/authorize",
		callApiConfig: { customFetchImpl },
		clientId: "client-id",
		tokenEndpoint: "https://provider.example/token",
	});
	const tokens = await client.exchangeAuthorizationCode({ code: "authorization-code" });

	expect(tokens.accessTokenExpiresInSeconds()).toBe(3600);
	expect(() => tokens.tokenType()).toThrow("token_type");
});

test("OAuth2 client - resolves a generated client secret for HTTP Basic authentication", async () => {
	const customFetchImpl = createFetch(
		Response.json(
			{ access_token: "access-token", token_type: "Bearer" },
			{ headers: { "Content-Type": "application/json" }, status: 200 }
		)
	);
	const client = createOAuth2Client({
		authorizationEndpoint: "https://provider.example/authorize",
		callApiConfig: { customFetchImpl },
		clientAuthentication: "client_secret_basic",
		clientId: "client id",
		providerProfile: { clientCredentials: { resolveClientSecret: () => Promise.resolve("s3cret+/") } },
		tokenEndpoint: "https://provider.example/token",
	});

	await client.exchangeAuthorizationCode({ code: "authorization-code" });

	expect(new Headers(customFetchImpl.mock.calls[0]?.[1]?.headers).get("Authorization")).toBe(
		`Basic ${btoa("client+id:s3cret%2B%2F")}`
	);
});
