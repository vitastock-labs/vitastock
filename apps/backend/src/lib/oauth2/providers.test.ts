import { generateKeyPairSync } from "node:crypto";
import { decode } from "jsonwebtoken";
import { describe, expect, test, vi } from "vitest";
import * as providerCatalog from "./providers";
import {
	createAppleOAuth2Client,
	createGitHubOAuth2Client,
	createMastodonOAuth2Client,
	createMicrosoftEntraIdOAuth2Client,
	createSpotifyOAuth2Client,
	createTikTokOAuth2Client,
	createWithingsOAuth2Client,
} from "./providers";

const providerFactoryNames = [
	"createAmazonCognitoOAuth2Client",
	"createAniListOAuth2Client",
	"createAppleOAuth2Client",
	"createAtlassianOAuth2Client",
	"createAuth0OAuth2Client",
	"createAuthentikOAuth2Client",
	"createAutodeskOAuth2Client",
	"createBattleNetOAuth2Client",
	"createBitbucketOAuth2Client",
	"createBoxOAuth2Client",
	"createBungieOAuth2Client",
	"createCoinbaseOAuth2Client",
	"createDiscordOAuth2Client",
	"createDonationAlertsOAuth2Client",
	"createDribbbleOAuth2Client",
	"createDropboxOAuth2Client",
	"createEpicGamesOAuth2Client",
	"createEtsyOAuth2Client",
	"createFacebookOAuth2Client",
	"createFigmaOAuth2Client",
	"createFortyTwoOAuth2Client",
	"createGiteaOAuth2Client",
	"createGitHubOAuth2Client",
	"createGitLabOAuth2Client",
	"createGoogleOAuth2Client",
	"createIntuitOAuth2Client",
	"createKakaoOAuth2Client",
	"createKeycloakOAuth2Client",
	"createKickOAuth2Client",
	"createLichessOAuth2Client",
	"createLineOAuth2Client",
	"createLinearOAuth2Client",
	"createLinkedInOAuth2Client",
	"createMastodonOAuth2Client",
	"createMercadoLibreOAuth2Client",
	"createMercadoPagoOAuth2Client",
	"createMicrosoftEntraIdOAuth2Client",
	"createMyAnimeListOAuth2Client",
	"createNaverOAuth2Client",
	"createNotionOAuth2Client",
	"createOktaOAuth2Client",
	"createOsuOAuth2Client",
	"createPatreonOAuth2Client",
	"createPolarOAuth2Client",
	"createRedditOAuth2Client",
	"createRobloxOAuth2Client",
	"createSalesforceOAuth2Client",
	"createShikimoriOAuth2Client",
	"createSlackOAuth2Client",
	"createSpotifyOAuth2Client",
	"createStartGGOAuth2Client",
	"createStravaOAuth2Client",
	"createSynologyOAuth2Client",
	"createTikTokOAuth2Client",
	"createTiltifyOAuth2Client",
	"createTumblrOAuth2Client",
	"createTwitchOAuth2Client",
	"createTwitterOAuth2Client",
	"createVKOAuth2Client",
	"createWithingsOAuth2Client",
	"createWorkOSOAuth2Client",
	"createYahooOAuth2Client",
	"createYandexOAuth2Client",
	"createZoomOAuth2Client",
] as const;

const createJsonFetch = (body: unknown) => {
	return vi.fn<typeof fetch>(() =>
		Promise.resolve(Response.json(body, { headers: { "Content-Type": "application/json" } }))
	);
};

const getRequestBody = (customFetchImpl: ReturnType<typeof createJsonFetch>) => {
	return customFetchImpl.mock.calls[0]?.[1]?.body as URLSearchParams;
};

test("OAuth2 providers - exports every Arctic 3.7.0 provider factory", () => {
	expect(providerFactoryNames).toHaveLength(64);
	expect(
		Object.entries(providerCatalog)
			.filter(([name, value]) => name.startsWith("create") && typeof value === "function")
			.map(([name]) => name)
			.toSorted()
	).toEqual(providerFactoryNames.toSorted());
});

test("OAuth2 providers - normalizes non-PKCE and optional-PKCE authorization", async () => {
	const github = createGitHubOAuth2Client({
		clientId: "github-client",
		clientSecret: "github-secret",
		redirectUri: "https://example.com/auth/github/callback",
	});
	const spotify = createSpotifyOAuth2Client({
		clientId: "spotify-client",
		redirectUri: "https://example.com/auth/spotify/callback",
	});
	const githubAuthorization = await github.createAuthorizationRequest({ scopes: ["read:user"] });
	const spotifyAuthorization = await spotify.createAuthorizationRequest({
		scopes: ["user-read-email"],
	});
	const spotifyWithoutPkce = await spotify.createAuthorizationRequest({ usePkce: false });

	expect(githubAuthorization.codeVerifier).toBeNull();
	expect(githubAuthorization.url.searchParams.get("code_challenge")).toBeNull();
	expect(spotifyAuthorization.codeVerifier).not.toBeNull();
	expect(spotifyAuthorization.url.searchParams.get("code_challenge_method")).toBe("S256");
	expect(spotifyWithoutPkce.codeVerifier).toBeNull();
	await expect(github.createAuthorizationRequest({ usePkce: true })).rejects.toThrow(
		"does not support PKCE"
	);
});

test("OAuth2 providers - validates and safely joins dynamic URLs", async () => {
	const mastodon = createMastodonOAuth2Client({
		baseUrl: "https://mastodon.social",
		clientId: "mastodon-client",
		clientSecret: "mastodon-secret",
		redirectUri: "https://example.com/auth/mastodon/callback",
	});
	const authorization = await mastodon.createAuthorizationRequest();

	expect(authorization.url.origin + authorization.url.pathname).toBe(
		"https://mastodon.social/api/v1/oauth/authorize"
	);
	expect(() =>
		createMastodonOAuth2Client({
			baseUrl: "ftp://mastodon.social",
			clientId: "client",
			clientSecret: "secret",
			redirectUri: "https://example.com/callback",
		})
	).toThrow("must use HTTP or HTTPS");
});

test("OAuth2 providers - uses TikTok credential names and comma-separated scopes", async () => {
	const customFetchImpl = createJsonFetch({ access_token: "token", token_type: "Bearer" });
	const tiktok = createTikTokOAuth2Client({
		callApiConfig: { customFetchImpl },
		clientId: "tiktok-key",
		clientSecret: "tiktok-secret",
		redirectUri: "https://example.com/auth/tiktok/callback",
	});
	const authorization = await tiktok.createAuthorizationRequest({
		scopes: ["user.info.basic", "video.list"],
	});

	expect(authorization.url.searchParams.get("client_key")).toBe("tiktok-key");
	expect(authorization.url.searchParams.get("scope")).toBe("user.info.basic,video.list");
	await tiktok.exchangeAuthorizationCode({
		code: "code",
		codeVerifier: authorization.codeVerifier,
	});
	expect(getRequestBody(customFetchImpl).get("client_key")).toBe("tiktok-key");
	expect(getRequestBody(customFetchImpl).get("client_secret")).toBe("tiktok-secret");
	await expect(
		tiktok.exchangeAuthorizationCode({
			code: "code",
			codeVerifier: authorization.codeVerifier,
			parameters: { client_key: "replacement" },
		})
	).rejects.toThrow("cannot override client_key");
});

test("OAuth2 providers - supports public Microsoft Entra clients", async () => {
	const customFetchImpl = createJsonFetch({ access_token: "token", token_type: "Bearer" });
	const microsoft = createMicrosoftEntraIdOAuth2Client({
		callApiConfig: { customFetchImpl },
		clientId: "microsoft-client",
		redirectUri: "https://example.com/auth/microsoft/callback",
		tenant: "organizations",
	});
	const authorization = await microsoft.createAuthorizationRequest();

	await microsoft.exchangeAuthorizationCode({
		code: "code",
		codeVerifier: authorization.codeVerifier,
	});
	expect(getRequestBody(customFetchImpl).get("client_id")).toBe("microsoft-client");
	expect(new Headers(customFetchImpl.mock.calls[0]?.[1]?.headers).get("Origin")).toBe("arctic");
});

test("OAuth2 providers - unwraps Withings token responses", async () => {
	const customFetchImpl = createJsonFetch({
		body: { access_token: "withings-token", token_type: "Bearer" },
		status: 0,
	});
	const withings = createWithingsOAuth2Client({
		callApiConfig: { customFetchImpl },
		clientId: "withings-client",
		clientSecret: "withings-secret",
		redirectUri: "https://example.com/auth/withings/callback",
	});
	const tokens = await withings.exchangeAuthorizationCode({ code: "code" });

	expect(tokens.accessToken()).toBe("withings-token");
	expect(getRequestBody(customFetchImpl).get("action")).toBe("requesttoken");
});

describe("OAuth2 providers - Apple", () => {
	test("creates a short-lived ES256 client secret", async () => {
		const { privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
		const customFetchImpl = createJsonFetch({ access_token: "apple-token", token_type: "Bearer" });
		const apple = createAppleOAuth2Client({
			callApiConfig: { customFetchImpl },
			clientId: "com.example.web",
			keyId: "APPLE_KEY_ID",
			privateKey: privateKey.export({ format: "pem", type: "pkcs8" }),
			redirectUri: "https://example.com/auth/apple/callback",
			teamId: "APPLE_TEAM_ID",
		});

		await apple.exchangeAuthorizationCode({ code: "code" });
		const clientSecret = getRequestBody(customFetchImpl).get("client_secret");
		const decoded = decode(clientSecret ?? "", { complete: true });

		expect(decoded?.header).toMatchObject({ alg: "ES256", kid: "APPLE_KEY_ID", typ: "JWT" });
		expect(decoded?.payload).toMatchObject({
			aud: "https://appleid.apple.com",
			iss: "APPLE_TEAM_ID",
			sub: "com.example.web",
		});
	});
});
