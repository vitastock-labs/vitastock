# OAuth 2.0 Client And Provider Catalog

A copy-pasteable OAuth 2.0 authorization-code client built on
[`@zayne-labs/callapi`](https://www.npmjs.com/package/@zayne-labs/callapi). It includes factory
adapters for all 64 providers shipped by Arctic 3.7.0 while keeping every HTTP request inside
CallApi.

The catalog reproduces Arctic 3.7.0 behavior. Provider endpoints and requirements change, so check
the current provider documentation before enabling an integration in production.

## Installation

```bash
pnpm add @zayne-labs/callapi jsonwebtoken zod
pnpm add -D @types/jsonwebtoken
```

Copy the `oauth2` directory as a unit and import factories from its `index.ts` barrel.

## Standard Provider

```ts
import { createGitHubOAuth2Client } from "./lib/oauth2";

const github = createGitHubOAuth2Client({
	clientId: environment.GITHUB_CLIENT_ID,
	clientSecret: environment.GITHUB_CLIENT_SECRET,
	redirectUri: `${environment.APP_URL}/auth/github/callback`,
});

const authorization = await github.createAuthorizationRequest({
	scopes: ["read:user", "user:email"],
});

const tokens = await github.exchangeAuthorizationCode({
	code: callbackCode,
	codeVerifier: authorization.codeVerifier,
});
```

Authorization is normalized for every provider:

```ts
type OAuth2ProviderAuthorization = {
	codeVerifier: string | null;
	state: string;
	url: URL;
};
```

Store state and the verifier against this one login attempt in a server-side session or encrypted,
secure, HTTP-only cookie. On callback, compare state before exchanging the code, consume both stored
values once, and reject missing or mismatched values.

## Public And Optional-PKCE Clients

```ts
const spotify = createSpotifyOAuth2Client({
	clientId: environment.SPOTIFY_CLIENT_ID,
	redirectUri: `${environment.APP_URL}/auth/spotify/callback`,
});

const authorization = await spotify.createAuthorizationRequest({
	scopes: ["user-read-email", "user-read-private"],
});
```

Optional-PKCE providers use PKCE by default. Pass `usePkce: false` only when integrating a
confidential application that cannot use PKCE. Required-PKCE providers reject opt-out and
non-PKCE providers reject opt-in.

## Dynamic Providers

Dynamic factories validate their URL input immediately and join endpoint paths with `URL`.

```ts
const microsoft = createMicrosoftEntraIdOAuth2Client({
	clientId: environment.MICROSOFT_CLIENT_ID,
	clientSecret: environment.MICROSOFT_CLIENT_SECRET,
	redirectUri: `${environment.APP_URL}/auth/microsoft/callback`,
	tenant: environment.MICROSOFT_TENANT_ID,
});

const mastodon = createMastodonOAuth2Client({
	baseUrl: "https://mastodon.social",
	clientId: environment.MASTODON_CLIENT_ID,
	clientSecret: environment.MASTODON_CLIENT_SECRET,
	redirectUri: `${environment.APP_URL}/auth/mastodon/callback`,
});
```

Use `baseUrl` for Authentik, Gitea, GitLab, Keycloak realm URLs, Mastodon, and Synology. Use
`domain` for Amazon Cognito, Auth0, Salesforce, and Okta. Okta also accepts
`authorizationServerId`.

## Apple

Apple creates a fresh five-minute ES256 client secret for every token request.

```ts
const apple = createAppleOAuth2Client({
	clientId: environment.APPLE_CLIENT_ID,
	keyId: environment.APPLE_KEY_ID,
	privateKey: environment.APPLE_PRIVATE_KEY,
	redirectUri: `${environment.APP_URL}/auth/apple/callback`,
	teamId: environment.APPLE_TEAM_ID,
});

const authorization = await apple.createAuthorizationRequest({ scopes: ["email", "name"] });
const tokens = await apple.exchangeAuthorizationCode({ code: callbackCode });
```

Keep the Apple private key server-side and preserve its PEM newlines when loading it from an
environment variable or secret manager.

## CallApi Configuration

Every factory forwards `callApiConfig` unchanged to the underlying client.

```ts
const google = createGoogleOAuth2Client({
	callApiConfig: { retryAttempts: 1, timeout: 10_000 },
	clientId: environment.GOOGLE_CLIENT_ID,
	clientSecret: environment.GOOGLE_CLIENT_SECRET,
	redirectUri: `${environment.APP_URL}/auth/google/callback`,
});
```

Authorization codes are one-time credentials. Use retries conservatively because a timed-out token
request may still have reached the provider.

## Provider Matrix

`Secret` follows Arctic's constructor. Optional providers support public clients. Every provider
supports token refresh when the provider issues a refresh token. Figma and Start.gg use separate
refresh endpoints.

| Provider           | Factory                              | PKCE     | Secret    | Revoke | Dynamic input       |
| ------------------ | ------------------------------------ | -------- | --------- | ------ | ------------------- |
| 42                 | `createFortyTwoOAuth2Client`         | No       | Required  | No     | -                   |
| Amazon Cognito     | `createAmazonCognitoOAuth2Client`    | Required | Optional  | Yes    | `domain`            |
| AniList            | `createAniListOAuth2Client`          | No       | Required  | No     | -                   |
| Apple              | `createAppleOAuth2Client`            | No       | Generated | No     | Apple keys          |
| Atlassian          | `createAtlassianOAuth2Client`        | No       | Required  | No     | -                   |
| Auth0              | `createAuth0OAuth2Client`            | Optional | Optional  | Yes    | `domain`            |
| Authentik          | `createAuthentikOAuth2Client`        | Required | Optional  | Yes    | `baseUrl`           |
| Autodesk           | `createAutodeskOAuth2Client`         | Required | Optional  | Yes    | -                   |
| Battle.net         | `createBattleNetOAuth2Client`        | No       | Required  | No     | -                   |
| Bitbucket          | `createBitbucketOAuth2Client`        | No       | Required  | No     | -                   |
| Box                | `createBoxOAuth2Client`              | No       | Required  | Yes    | -                   |
| Bungie             | `createBungieOAuth2Client`           | No       | Optional  | No     | -                   |
| Coinbase           | `createCoinbaseOAuth2Client`         | No       | Required  | Yes    | -                   |
| Discord            | `createDiscordOAuth2Client`          | Optional | Optional  | Yes    | -                   |
| DonationAlerts     | `createDonationAlertsOAuth2Client`   | No       | Required  | No     | -                   |
| Dribbble           | `createDribbbleOAuth2Client`         | No       | Required  | No     | -                   |
| Dropbox            | `createDropboxOAuth2Client`          | No       | Required  | Yes    | -                   |
| Epic Games         | `createEpicGamesOAuth2Client`        | No       | Required  | Yes    | -                   |
| Etsy               | `createEtsyOAuth2Client`             | Required | None      | No     | -                   |
| Facebook           | `createFacebookOAuth2Client`         | No       | Required  | No     | -                   |
| Figma              | `createFigmaOAuth2Client`            | No       | Required  | No     | -                   |
| Gitea              | `createGiteaOAuth2Client`            | Required | Optional  | No     | `baseUrl`           |
| GitHub             | `createGitHubOAuth2Client`           | No       | Required  | No     | -                   |
| GitLab             | `createGitLabOAuth2Client`           | No       | Optional  | Yes    | `baseUrl`           |
| Google             | `createGoogleOAuth2Client`           | Required | Required  | Yes    | -                   |
| Intuit             | `createIntuitOAuth2Client`           | No       | Required  | Yes    | -                   |
| Kakao              | `createKakaoOAuth2Client`            | No       | Required  | No     | -                   |
| Keycloak           | `createKeycloakOAuth2Client`         | Required | Optional  | Yes    | realm `baseUrl`     |
| Kick               | `createKickOAuth2Client`             | Required | Required  | Yes    | -                   |
| Lichess            | `createLichessOAuth2Client`          | Required | None      | No     | -                   |
| Line               | `createLineOAuth2Client`             | Required | Required  | No     | -                   |
| Linear             | `createLinearOAuth2Client`           | No       | Required  | No     | -                   |
| LinkedIn           | `createLinkedInOAuth2Client`         | No       | Required  | No     | -                   |
| Mastodon           | `createMastodonOAuth2Client`         | Required | Required  | Yes    | `baseUrl`           |
| Mercado Libre      | `createMercadoLibreOAuth2Client`     | Required | Required  | No     | -                   |
| Mercado Pago       | `createMercadoPagoOAuth2Client`      | Required | Required  | No     | -                   |
| Microsoft Entra ID | `createMicrosoftEntraIdOAuth2Client` | Required | Optional  | No     | `tenant`            |
| MyAnimeList        | `createMyAnimeListOAuth2Client`      | Required | Required  | No     | -                   |
| Naver              | `createNaverOAuth2Client`            | No       | Required  | No     | -                   |
| Notion             | `createNotionOAuth2Client`           | No       | Required  | No     | -                   |
| Okta               | `createOktaOAuth2Client`             | Required | Optional  | Yes    | `domain`, server ID |
| osu!               | `createOsuOAuth2Client`              | No       | Required  | No     | -                   |
| Patreon            | `createPatreonOAuth2Client`          | No       | Required  | No     | -                   |
| Polar              | `createPolarOAuth2Client`            | Required | Optional  | Yes    | -                   |
| Reddit             | `createRedditOAuth2Client`           | No       | Required  | No     | -                   |
| Roblox             | `createRobloxOAuth2Client`           | Required | Optional  | Yes    | -                   |
| Salesforce         | `createSalesforceOAuth2Client`       | Required | Optional  | Yes    | `domain`            |
| Shikimori          | `createShikimoriOAuth2Client`        | No       | Required  | No     | -                   |
| Slack              | `createSlackOAuth2Client`            | No       | Required  | No     | -                   |
| Spotify            | `createSpotifyOAuth2Client`          | Optional | Optional  | No     | -                   |
| Start.gg           | `createStartGGOAuth2Client`          | No       | Required  | No     | -                   |
| Strava             | `createStravaOAuth2Client`           | No       | Required  | No     | -                   |
| Synology           | `createSynologyOAuth2Client`         | Required | Required  | No     | `baseUrl`           |
| TikTok             | `createTikTokOAuth2Client`           | Required | Required  | Yes    | -                   |
| Tiltify            | `createTiltifyOAuth2Client`          | No       | Required  | No     | -                   |
| Tumblr             | `createTumblrOAuth2Client`           | No       | Required  | No     | -                   |
| Twitch             | `createTwitchOAuth2Client`           | No       | Required  | No     | -                   |
| Twitter            | `createTwitterOAuth2Client`          | Required | Optional  | Yes    | -                   |
| VK                 | `createVKOAuth2Client`               | No       | Required  | No     | -                   |
| Withings           | `createWithingsOAuth2Client`         | No       | Required  | No     | -                   |
| WorkOS             | `createWorkOSOAuth2Client`           | Optional | Optional  | No     | -                   |
| Yahoo              | `createYahooOAuth2Client`            | No       | Required  | No     | -                   |
| Yandex             | `createYandexOAuth2Client`           | No       | Required  | No     | -                   |
| Zoom               | `createZoomOAuth2Client`             | Required | Required  | Yes    | -                   |

`revokeToken()` throws when the provider has no catalogued revocation endpoint.

## Generic Client And Extensions

Use `createOAuth2Client()` directly for a provider outside the catalog. Its generic behavior remains
unchanged. Authorization, exchange, refresh, and revocation calls accept extension parameters, but
cannot override protocol fields, credentials, or provider-fixed parameters.

Token helpers expose access, refresh, ID-token, expiry, and scope data. Decoding an ID token does
not verify its signature, issuer, audience, nonce, or expiry; use a maintained OIDC/JWT verifier
before trusting identity claims.

## Attribution

Provider definitions were adapted from Arctic 3.7.0, Copyright (c) 2023 pilcrowOnPaper, distributed
under the MIT License. This implementation is reorganized around factory functions, CallApi,
provider profiles, Zod validation, and normalized PKCE authorization results.
