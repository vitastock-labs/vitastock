import { sign } from "jsonwebtoken";
import { z } from "zod";
import {
	createOAuth2Client,
	generateOAuth2CodeVerifier,
	generateOAuth2State,
	type CreateAuthorizationRequestOptions,
	type ExchangeAuthorizationCodeOptions,
	type OAuth2CallApiConfig,
	type OAuth2Client,
	type OAuth2ClientAuthentication,
	type OAuth2ProviderProfile,
} from "./client";
import { OAuth2TokenDataSchema } from "./tokens";

export type OAuth2PkcePolicy = "none" | "optional" | "required";

export type OAuth2ProviderAuthorization = {
	codeVerifier: string | null;
	state: string;
	url: URL;
};

export type OAuth2ProviderAuthorizationOptions = CreateAuthorizationRequestOptions & {
	usePkce?: boolean;
};

export type OAuth2ProviderExchangeOptions = Omit<ExchangeAuthorizationCodeOptions, "codeVerifier"> & {
	codeVerifier?: string | null;
};

export type OAuth2ProviderClient = Omit<
	OAuth2Client,
	"createAuthorizationRequest" | "exchangeAuthorizationCode"
> & {
	createAuthorizationRequest: (
		options?: OAuth2ProviderAuthorizationOptions
	) => Promise<OAuth2ProviderAuthorization>;
	exchangeAuthorizationCode: (
		options: OAuth2ProviderExchangeOptions
	) => ReturnType<OAuth2Client["exchangeAuthorizationCode"]>;
};

export type OAuth2ProviderOptions = {
	callApiConfig?: OAuth2CallApiConfig;
	clientId: string;
	clientSecret?: string;
	redirectUri: string;
};

export type OAuth2ConfidentialProviderOptions = OAuth2ProviderOptions & {
	clientSecret: string;
};

export type AppleOAuth2ClientOptions = Omit<OAuth2ProviderOptions, "clientSecret"> & {
	keyId: string;
	privateKey: string;
	teamId: string;
};

export type DynamicOAuth2ProviderOptions = OAuth2ProviderOptions & {
	baseUrl: string;
};

export type DomainOAuth2ProviderOptions = OAuth2ProviderOptions & {
	domain: string;
};

export type MicrosoftEntraIdOAuth2ClientOptions = OAuth2ProviderOptions & {
	tenant: string;
};

export type OktaOAuth2ClientOptions = DomainOAuth2ProviderOptions & {
	authorizationServerId?: string;
};

type OAuth2ProviderDefinition = {
	authorizationEndpoint: string;
	clientAuthentication?: OAuth2ClientAuthentication;
	pkce: OAuth2PkcePolicy;
	profile?: OAuth2ProviderProfile;
	revocationEndpoint?: string;
	secretRequired?: boolean;
	tokenEndpoint: string;
};

const createOAuth2ProviderClient = (options: {
	client: OAuth2Client;
	pkce: OAuth2PkcePolicy;
}): OAuth2ProviderClient => {
	const createAuthorizationRequest = async (
		authorizationOptions: OAuth2ProviderAuthorizationOptions = {}
	) => {
		const { usePkce, ...requestOptions } = authorizationOptions;
		let shouldUsePkce = options.pkce !== "none";

		if (options.pkce === "optional" && usePkce === false) {
			shouldUsePkce = false;
		}

		if (options.pkce === "required" && usePkce === false) {
			throw new TypeError("This provider requires PKCE");
		}

		if (options.pkce === "none" && usePkce === true) {
			throw new TypeError("This provider does not support PKCE");
		}

		const codeVerifier = shouldUsePkce ? generateOAuth2CodeVerifier() : null;
		const state = generateOAuth2State();
		const url = await options.client.createAuthorizationUrl({
			...requestOptions,
			codeVerifier: codeVerifier ?? undefined,
			state,
		});

		return { codeVerifier, state, url };
	};

	const exchangeAuthorizationCode = (exchangeOptions: OAuth2ProviderExchangeOptions) => {
		return options.client.exchangeAuthorizationCode({
			...exchangeOptions,
			codeVerifier: exchangeOptions.codeVerifier ?? undefined,
		});
	};

	return { ...options.client, createAuthorizationRequest, exchangeAuthorizationCode };
};

const createProvider = (definition: OAuth2ProviderDefinition, options: OAuth2ProviderOptions) => {
	if (definition.secretRequired && !options.clientSecret) {
		throw new TypeError("This provider requires a clientSecret");
	}

	const client = createOAuth2Client({
		authorizationEndpoint: definition.authorizationEndpoint,
		callApiConfig: options.callApiConfig,
		clientAuthentication: definition.clientAuthentication,
		clientId: options.clientId,
		clientSecret: options.clientSecret,
		providerProfile: definition.profile,
		redirectUri: options.redirectUri,
		revocationEndpoint: definition.revocationEndpoint,
		tokenEndpoint: definition.tokenEndpoint,
	});

	return createOAuth2ProviderClient({ client, pkce: definition.pkce });
};

const createProviderFactory = <TDefinition extends OAuth2ProviderDefinition>(definition: TDefinition) => {
	type Options =
		TDefinition["secretRequired"] extends true ? OAuth2ConfidentialProviderOptions
		:	OAuth2ProviderOptions;

	return (options: Options) => createProvider(definition, options);
};

const parseBaseUrl = (value: string) => {
	const url = new URL(value);

	if (url.protocol !== "http:" && url.protocol !== "https:") {
		throw new TypeError("OAuth provider baseUrl must use HTTP or HTTPS");
	}

	if (url.username || url.password || url.search || url.hash) {
		throw new TypeError("OAuth provider baseUrl cannot include credentials, a query, or a hash");
	}

	return url;
};

const parseDomainBaseUrl = (domain: string) => {
	if (!domain || domain.includes("/") || domain.includes(":")) {
		throw new TypeError("OAuth provider domain must be a hostname");
	}

	const url = new URL(`https://${domain}`);

	if (url.hostname !== domain.toLowerCase()) {
		throw new TypeError("OAuth provider domain must be a valid hostname");
	}

	return url;
};

const joinUrl = (baseUrl: URL, path: string) => {
	const normalizedBaseUrl = new URL(baseUrl);
	normalizedBaseUrl.pathname = `${normalizedBaseUrl.pathname.replace(/\/$/u, "")}/`;

	return new URL(path.replace(/^\//u, ""), normalizedBaseUrl).href;
};

const createDynamicProvider = (
	options: DynamicOAuth2ProviderOptions,
	paths: {
		authorization: string;
		revocation?: string;
		token: string;
	},
	definition: Omit<
		OAuth2ProviderDefinition,
		"authorizationEndpoint" | "revocationEndpoint" | "tokenEndpoint"
	>
) => {
	const baseUrl = parseBaseUrl(options.baseUrl);

	return createProvider(
		{
			...definition,
			authorizationEndpoint: joinUrl(baseUrl, paths.authorization),
			revocationEndpoint: paths.revocation && joinUrl(baseUrl, paths.revocation),
			tokenEndpoint: joinUrl(baseUrl, paths.token),
		},
		options
	);
};

const createDomainProvider = (
	options: DomainOAuth2ProviderOptions,
	paths: {
		authorization: string;
		revocation?: string;
		token: string;
	},
	definition: Omit<
		OAuth2ProviderDefinition,
		"authorizationEndpoint" | "revocationEndpoint" | "tokenEndpoint"
	>
) => {
	return createDynamicProvider(
		{ ...options, baseUrl: parseDomainBaseUrl(options.domain).href },
		paths,
		definition
	);
};

export const createFortyTwoOAuth2Client = createProviderFactory({
	authorizationEndpoint: "https://api.intra.42.fr/oauth/authorize",
	clientAuthentication: "client_secret_post",
	pkce: "none",
	secretRequired: true,
	tokenEndpoint: "https://api.intra.42.fr/oauth/token",
});

export const createAniListOAuth2Client = createProviderFactory({
	authorizationEndpoint: "https://anilist.co/api/v2/oauth/authorize",
	pkce: "none",
	secretRequired: true,
	tokenEndpoint: "https://anilist.co/api/v2/oauth/token",
});

export const createAtlassianOAuth2Client = createProviderFactory({
	authorizationEndpoint: "https://auth.atlassian.com/authorize",
	clientAuthentication: "client_secret_post",
	pkce: "none",
	profile: { authorization: { parameters: { audience: "api.atlassian.com", prompt: "consent" } } },
	secretRequired: true,
	tokenEndpoint: "https://auth.atlassian.com/oauth/token",
});

export const createAutodeskOAuth2Client = createProviderFactory({
	authorizationEndpoint: "https://developer.api.autodesk.com/authentication/v2/authorize",
	pkce: "required",
	revocationEndpoint: "https://developer.api.autodesk.com/authentication/v2/revoke",
	tokenEndpoint: "https://developer.api.autodesk.com/authentication/v2/token",
});

export const createBattleNetOAuth2Client = createProviderFactory({
	authorizationEndpoint: "https://oauth.battle.net/authorize",
	clientAuthentication: "client_secret_post",
	pkce: "none",
	secretRequired: true,
	tokenEndpoint: "https://oauth.battle.net/token",
});

export const createBitbucketOAuth2Client = createProviderFactory({
	authorizationEndpoint: "https://bitbucket.org/site/oauth2/authorize",
	pkce: "none",
	secretRequired: true,
	tokenEndpoint: "https://bitbucket.org/site/oauth2/access_token",
});

export const createBoxOAuth2Client = createProviderFactory({
	authorizationEndpoint: "https://account.box.com/api/oauth2/authorize",
	clientAuthentication: "client_secret_post",
	pkce: "none",
	revocationEndpoint: "https://api.box.com/oauth2/revoke",
	secretRequired: true,
	tokenEndpoint: "https://api.box.com/oauth2/token",
});

export const createBungieOAuth2Client = createProviderFactory({
	authorizationEndpoint: "https://www.bungie.net/en/oauth/authorize",
	pkce: "none",
	tokenEndpoint: "https://www.bungie.net/platform/app/oauth/token",
});

export const createCoinbaseOAuth2Client = createProviderFactory({
	authorizationEndpoint: "https://www.coinbase.com/oauth/authorize",
	clientAuthentication: "client_secret_post",
	pkce: "none",
	revocationEndpoint: "https://api.coinbase.com/oauth/revoke",
	secretRequired: true,
	tokenEndpoint: "https://www.coinbase.com/oauth/token",
});

export const createDiscordOAuth2Client = createProviderFactory({
	authorizationEndpoint: "https://discord.com/oauth2/authorize",
	pkce: "optional",
	revocationEndpoint: "https://discord.com/api/oauth2/token/revoke",
	tokenEndpoint: "https://discord.com/api/oauth2/token",
});

export const createDonationAlertsOAuth2Client = createProviderFactory({
	authorizationEndpoint: "https://www.donationalerts.com/oauth/authorize",
	clientAuthentication: "client_secret_post",
	pkce: "none",
	secretRequired: true,
	tokenEndpoint: "https://www.donationalerts.com/oauth/token",
});

export const createDribbbleOAuth2Client = createProviderFactory({
	authorizationEndpoint: "https://dribbble.com/oauth/authorize",
	clientAuthentication: "client_secret_post",
	pkce: "none",
	secretRequired: true,
	tokenEndpoint: "https://dribbble.com/oauth/token",
});

export const createDropboxOAuth2Client = createProviderFactory({
	authorizationEndpoint: "https://www.dropbox.com/oauth2/authorize",
	pkce: "none",
	revocationEndpoint: "https://api.dropboxapi.com/2/auth/token/revoke",
	secretRequired: true,
	tokenEndpoint: "https://api.dropboxapi.com/oauth2/token",
});

export const createEpicGamesOAuth2Client = createProviderFactory({
	authorizationEndpoint: "https://www.epicgames.com/id/authorize",
	pkce: "none",
	revocationEndpoint: "https://api.epicgames.dev/epic/oauth/v2/revoke",
	secretRequired: true,
	tokenEndpoint: "https://api.epicgames.dev/epic/oauth/v2/token",
});

export const createEtsyOAuth2Client = createProviderFactory({
	authorizationEndpoint: "https://www.etsy.com/oauth/connect",
	clientAuthentication: "none",
	pkce: "required",
	tokenEndpoint: "https://api.etsy.com/v3/public/oauth/token",
});

export const createFacebookOAuth2Client = createProviderFactory({
	authorizationEndpoint: "https://www.facebook.com/v16.0/dialog/oauth",
	clientAuthentication: "client_secret_post",
	pkce: "none",
	secretRequired: true,
	tokenEndpoint: "https://graph.facebook.com/v16.0/oauth/access_token",
});

export const createFigmaOAuth2Client = createProviderFactory({
	authorizationEndpoint: "https://www.figma.com/oauth",
	pkce: "none",
	profile: { refresh: { endpoint: "https://api.figma.com/v1/oauth/refresh" } },
	secretRequired: true,
	tokenEndpoint: "https://api.figma.com/v1/oauth/token",
});

export const createGitHubOAuth2Client = createProviderFactory({
	authorizationEndpoint: "https://github.com/login/oauth/authorize",
	pkce: "none",
	profile: { requestHeaders: { Accept: "application/json" } },
	secretRequired: true,
	tokenEndpoint: "https://github.com/login/oauth/access_token",
});

export const createGoogleOAuth2Client = createProviderFactory({
	authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
	pkce: "required",
	revocationEndpoint: "https://oauth2.googleapis.com/revoke",
	secretRequired: true,
	tokenEndpoint: "https://oauth2.googleapis.com/token",
});

export const createIntuitOAuth2Client = createProviderFactory({
	authorizationEndpoint: "https://appcenter.intuit.com/connect/oauth2",
	pkce: "none",
	revocationEndpoint: "https://developer.api.intuit.com/v2/oauth2/tokens/revoke",
	secretRequired: true,
	tokenEndpoint: "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer",
});

export const createKakaoOAuth2Client = createProviderFactory({
	authorizationEndpoint: "https://kauth.kakao.com/oauth/authorize",
	clientAuthentication: "client_secret_post",
	pkce: "none",
	secretRequired: true,
	tokenEndpoint: "https://kauth.kakao.com/oauth/token",
});

export const createKickOAuth2Client = createProviderFactory({
	authorizationEndpoint: "https://id.kick.com/oauth/authorize",
	clientAuthentication: "client_secret_post",
	pkce: "required",
	revocationEndpoint: "https://id.kick.com/oauth/revoke",
	secretRequired: true,
	tokenEndpoint: "https://id.kick.com/oauth/token",
});

export const createLichessOAuth2Client = createProviderFactory({
	authorizationEndpoint: "https://lichess.org/oauth",
	clientAuthentication: "none",
	pkce: "required",
	tokenEndpoint: "https://lichess.org/api/token",
});

export const createLineOAuth2Client = createProviderFactory({
	authorizationEndpoint: "https://access.line.me/oauth2/v2.1/authorize",
	clientAuthentication: "client_secret_post",
	pkce: "required",
	secretRequired: true,
	tokenEndpoint: "https://api.line.me/oauth2/v2.1/token",
});

export const createLinearOAuth2Client = createProviderFactory({
	authorizationEndpoint: "https://linear.app/oauth/authorize",
	clientAuthentication: "client_secret_post",
	pkce: "none",
	secretRequired: true,
	tokenEndpoint: "https://api.linear.app/oauth/token",
});

export const createLinkedInOAuth2Client = createProviderFactory({
	authorizationEndpoint: "https://www.linkedin.com/oauth/v2/authorization",
	clientAuthentication: "client_secret_post",
	pkce: "none",
	secretRequired: true,
	tokenEndpoint: "https://www.linkedin.com/oauth/v2/accessToken",
});

export const createMercadoLibreOAuth2Client = createProviderFactory({
	authorizationEndpoint: "https://auth.mercadolibre.com/authorization",
	clientAuthentication: "client_secret_post",
	pkce: "required",
	secretRequired: true,
	tokenEndpoint: "https://api.mercadolibre.com/oauth/token",
});

export const createMercadoPagoOAuth2Client = createProviderFactory({
	authorizationEndpoint: "https://auth.mercadopago.com/authorization",
	clientAuthentication: "client_secret_post",
	pkce: "required",
	secretRequired: true,
	tokenEndpoint: "https://api.mercadopago.com/oauth/token",
});

export const createMyAnimeListOAuth2Client = createProviderFactory({
	authorizationEndpoint: "https://myanimelist.net/v1/oauth2/authorize",
	pkce: "required",
	secretRequired: true,
	tokenEndpoint: "https://myanimelist.net/v1/oauth2/token",
});

export const createNaverOAuth2Client = createProviderFactory({
	authorizationEndpoint: "https://nid.naver.com/oauth2.0/authorize",
	clientAuthentication: "client_secret_post",
	pkce: "none",
	secretRequired: true,
	tokenEndpoint: "https://nid.naver.com/oauth2.0/token",
});

export const createNotionOAuth2Client = createProviderFactory({
	authorizationEndpoint: "https://api.notion.com/v1/oauth/authorize",
	pkce: "none",
	profile: { authorization: { parameters: { owner: "user" } } },
	secretRequired: true,
	tokenEndpoint: "https://api.notion.com/v1/oauth/token",
});

export const createOsuOAuth2Client = createProviderFactory({
	authorizationEndpoint: "https://osu.ppy.sh/oauth/authorize",
	clientAuthentication: "client_secret_post",
	pkce: "none",
	secretRequired: true,
	tokenEndpoint: "https://osu.ppy.sh/oauth/token",
});

export const createPatreonOAuth2Client = createProviderFactory({
	authorizationEndpoint: "https://www.patreon.com/oauth2/authorize",
	clientAuthentication: "client_secret_post",
	pkce: "none",
	secretRequired: true,
	tokenEndpoint: "https://www.patreon.com/api/oauth2/token",
});

export const createPolarOAuth2Client = createProviderFactory({
	authorizationEndpoint: "https://polar.sh/oauth2/authorize",
	clientAuthentication: "client_secret_post",
	pkce: "required",
	revocationEndpoint: "https://api.polar.sh/v1/oauth2/revoke",
	tokenEndpoint: "https://api.polar.sh/v1/oauth2/token",
});

export const createRedditOAuth2Client = createProviderFactory({
	authorizationEndpoint: "https://www.reddit.com/api/v1/authorize",
	pkce: "none",
	secretRequired: true,
	tokenEndpoint: "https://www.reddit.com/api/v1/access_token",
});

export const createRobloxOAuth2Client = createProviderFactory({
	authorizationEndpoint: "https://apis.roblox.com/oauth/v1/authorize",
	pkce: "required",
	revocationEndpoint: "https://apis.roblox.com/oauth/v1/token/revoke",
	tokenEndpoint: "https://apis.roblox.com/oauth/v1/token",
});

export const createShikimoriOAuth2Client = createProviderFactory({
	authorizationEndpoint: "https://shikimori.one/oauth/authorize",
	clientAuthentication: "client_secret_post",
	pkce: "none",
	secretRequired: true,
	tokenEndpoint: "https://shikimori.one/oauth/token",
});

export const createSlackOAuth2Client = createProviderFactory({
	authorizationEndpoint: "https://slack.com/openid/connect/authorize",
	pkce: "none",
	secretRequired: true,
	tokenEndpoint: "https://slack.com/api/openid.connect.token",
});

export const createSpotifyOAuth2Client = createProviderFactory({
	authorizationEndpoint: "https://accounts.spotify.com/authorize",
	pkce: "optional",
	tokenEndpoint: "https://accounts.spotify.com/api/token",
});

export const createStravaOAuth2Client = createProviderFactory({
	authorizationEndpoint: "https://www.strava.com/oauth/authorize",
	clientAuthentication: "client_secret_post",
	pkce: "none",
	profile: { authorization: { scopeSeparator: "," } },
	secretRequired: true,
	tokenEndpoint: "https://www.strava.com/api/v3/oauth/token",
});

export const createTiltifyOAuth2Client = createProviderFactory({
	authorizationEndpoint: "https://v5api.tiltify.com/oauth/authorize",
	clientAuthentication: "client_secret_post",
	pkce: "none",
	secretRequired: true,
	tokenEndpoint: "https://v5api.tiltify.com/oauth/token",
});

export const createTumblrOAuth2Client = createProviderFactory({
	authorizationEndpoint: "https://www.tumblr.com/oauth2/authorize",
	pkce: "none",
	secretRequired: true,
	tokenEndpoint: "https://api.tumblr.com/v2/oauth2/token",
});

export const createTwitchOAuth2Client = createProviderFactory({
	authorizationEndpoint: "https://id.twitch.tv/oauth2/authorize",
	clientAuthentication: "client_secret_post",
	pkce: "none",
	secretRequired: true,
	tokenEndpoint: "https://id.twitch.tv/oauth2/token",
});

export const createTwitterOAuth2Client = createProviderFactory({
	authorizationEndpoint: "https://twitter.com/i/oauth2/authorize",
	pkce: "required",
	revocationEndpoint: "https://api.twitter.com/2/oauth2/revoke",
	tokenEndpoint: "https://api.twitter.com/2/oauth2/token",
});

export const createVKOAuth2Client = createProviderFactory({
	authorizationEndpoint: "https://oauth.vk.com/authorize",
	clientAuthentication: "client_secret_post",
	pkce: "none",
	secretRequired: true,
	tokenEndpoint: "https://oauth.vk.com/access_token",
});

export const createWorkOSOAuth2Client = createProviderFactory({
	authorizationEndpoint: "https://api.workos.com/sso/authorize",
	pkce: "optional",
	tokenEndpoint: "https://api.workos.com/sso/token",
});

export const createYahooOAuth2Client = createProviderFactory({
	authorizationEndpoint: "https://api.login.yahoo.com/oauth2/request_auth",
	pkce: "none",
	secretRequired: true,
	tokenEndpoint: "https://api.login.yahoo.com/oauth2/get_token",
});

export const createYandexOAuth2Client = createProviderFactory({
	authorizationEndpoint: "https://oauth.yandex.com/authorize",
	pkce: "none",
	secretRequired: true,
	tokenEndpoint: "https://oauth.yandex.com/token",
});

export const createZoomOAuth2Client = createProviderFactory({
	authorizationEndpoint: "https://zoom.us/oauth/authorize",
	pkce: "required",
	revocationEndpoint: "https://zoom.us/oauth/revoke",
	secretRequired: true,
	tokenEndpoint: "https://zoom.us/oauth/token",
});

export const createAmazonCognitoOAuth2Client = (options: DomainOAuth2ProviderOptions) => {
	return createDomainProvider(
		options,
		{
			authorization: "/oauth2/authorize",
			revocation: "/oauth2/revoke",
			token: "/oauth2/token",
		},
		{ pkce: "required" }
	);
};

export const createAuth0OAuth2Client = (options: DomainOAuth2ProviderOptions) => {
	return createDomainProvider(
		options,
		{ authorization: "/authorize", revocation: "/oauth/revoke", token: "/oauth/token" },
		{ pkce: "optional" }
	);
};

export const createAuthentikOAuth2Client = (options: DynamicOAuth2ProviderOptions) => {
	return createDynamicProvider(
		options,
		{
			authorization: "/application/o/authorize/",
			revocation: "/application/o/revoke/",
			token: "/application/o/token/",
		},
		{ pkce: "required" }
	);
};

export const createGiteaOAuth2Client = (options: DynamicOAuth2ProviderOptions) => {
	return createDynamicProvider(
		options,
		{ authorization: "/login/oauth/authorize", token: "/login/oauth/access_token" },
		{ pkce: "required" }
	);
};

export const createGitLabOAuth2Client = (options: DynamicOAuth2ProviderOptions) => {
	return createDynamicProvider(
		options,
		{ authorization: "/oauth/authorize", revocation: "/oauth/revoke", token: "/oauth/token" },
		{ pkce: "none" }
	);
};

export const createKeycloakOAuth2Client = (options: DynamicOAuth2ProviderOptions) => {
	return createDynamicProvider(
		options,
		{
			authorization: "/protocol/openid-connect/auth",
			revocation: "/protocol/openid-connect/revoke",
			token: "/protocol/openid-connect/token",
		},
		{ pkce: "required" }
	);
};

export const createMastodonOAuth2Client = (options: DynamicOAuth2ProviderOptions) => {
	return createDynamicProvider(
		options,
		{
			authorization: "/api/v1/oauth/authorize",
			revocation: "/api/v1/oauth/revoke",
			token: "/api/v1/oauth/token",
		},
		{ pkce: "required", secretRequired: true }
	);
};

export const createMicrosoftEntraIdOAuth2Client = (options: MicrosoftEntraIdOAuth2ClientOptions) => {
	if (!/^[\w.-]+$/u.test(options.tenant)) {
		throw new TypeError("Microsoft Entra tenant is invalid");
	}

	const baseUrl = `https://login.microsoftonline.com/${encodeURIComponent(options.tenant)}`;
	const isPublicClient = !options.clientSecret;

	return createDynamicProvider(
		{ ...options, baseUrl },
		{ authorization: "/oauth2/v2.0/authorize", token: "/oauth2/v2.0/token" },
		{
			clientAuthentication: isPublicClient ? "none" : "client_secret_basic",
			pkce: "required",
			profile: isPublicClient ? { requestHeaders: { Origin: "arctic" } } : undefined,
		}
	);
};

export const createOktaOAuth2Client = (options: OktaOAuth2ClientOptions) => {
	if (options.authorizationServerId && !/^[\w.-]+$/u.test(options.authorizationServerId)) {
		throw new TypeError("Okta authorizationServerId is invalid");
	}

	const serverPath =
		options.authorizationServerId ? `/oauth2/${options.authorizationServerId}` : "/oauth2";

	return createDomainProvider(
		options,
		{
			authorization: `${serverPath}/v1/authorize`,
			revocation: `${serverPath}/v1/revoke`,
			token: `${serverPath}/v1/token`,
		},
		{ pkce: "required" }
	);
};

export const createSalesforceOAuth2Client = (options: DomainOAuth2ProviderOptions) => {
	return createDomainProvider(
		options,
		{
			authorization: "/services/oauth2/authorize",
			revocation: "/services/oauth2/revoke",
			token: "/services/oauth2/token",
		},
		{ pkce: "required" }
	);
};

export const createSynologyOAuth2Client = (options: DynamicOAuth2ProviderOptions) => {
	return createDynamicProvider(
		options,
		{
			authorization: "/webman/sso/SSOOauth.cgi",
			token: "/webman/sso/SSOAccessToken.cgi",
		},
		{ pkce: "required", secretRequired: true }
	);
};

export const createStartGGOAuth2Client = (options: OAuth2ConfidentialProviderOptions) => {
	return createProvider(
		{
			authorizationEndpoint: "https://start.gg/oauth/authorize",
			clientAuthentication: "client_secret_post",
			pkce: "none",
			profile: {
				refresh: {
					endpoint: "https://api.start.gg/oauth/refresh",
					parameters: { redirect_uri: options.redirectUri },
				},
			},
			secretRequired: true,
			tokenEndpoint: "https://api.start.gg/oauth/access_token",
		},
		options
	);
};

export const createTikTokOAuth2Client = (options: OAuth2ConfidentialProviderOptions) => {
	return createProvider(
		{
			authorizationEndpoint: "https://www.tiktok.com/v2/auth/authorize",
			clientAuthentication: "client_secret_post",
			pkce: "required",
			profile: {
				authorization: { clientIdParameter: "client_key", scopeSeparator: "," },
				clientCredentials: {
					clientIdParameter: "client_key",
					clientSecretParameter: "client_secret",
				},
			},
			revocationEndpoint: "https://open.tiktokapis.com/v2/oauth/revoke/",
			secretRequired: true,
			tokenEndpoint: "https://open.tiktokapis.com/v2/oauth/token/",
		},
		options
	);
};

const WithingsTokenDataSchema = z.preprocess((value: unknown) => {
	if (typeof value !== "object" || value === null || !("body" in value)) {
		return value;
	}

	return value.body;
}, OAuth2TokenDataSchema);

export const createWithingsOAuth2Client = (options: OAuth2ConfidentialProviderOptions) => {
	return createProvider(
		{
			authorizationEndpoint: "https://account.withings.com/oauth2_user/authorize2",
			clientAuthentication: "client_secret_post",
			pkce: "none",
			profile: {
				authorization: { scopeSeparator: "," },
				exchange: { parameters: { action: "requesttoken" } },
				tokenResponseSchema: WithingsTokenDataSchema,
			},
			secretRequired: true,
			tokenEndpoint: "https://wbsapi.withings.net/v2/oauth2",
		},
		options
	);
};

export const createAppleOAuth2Client = (options: AppleOAuth2ClientOptions) => {
	return createProvider(
		{
			authorizationEndpoint: "https://appleid.apple.com/auth/authorize",
			clientAuthentication: "client_secret_post",
			pkce: "none",
			profile: {
				clientCredentials: {
					resolveClientSecret: () => {
						const signedToken = sign({}, options.privateKey, {
							algorithm: "ES256",
							audience: "https://appleid.apple.com",
							expiresIn: "5m",
							header: { alg: "ES256", kid: options.keyId, typ: "JWT" },
							issuer: options.teamId,
							subject: options.clientId,
						});

						return signedToken;
					},
				},
			},
			tokenEndpoint: "https://appleid.apple.com/auth/token",
		},
		options
	);
};
