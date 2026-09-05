# OAuth 2.0 Client

A small authorization-code OAuth 2.0 client built on
[`@zayne-labs/callapi`](https://www.npmjs.com/package/@zayne-labs/callapi).

The library handles authorization URLs, secure state, PKCE with `S256`, code exchange, token
refresh, token revocation, form-encoded requests, client authentication, and standard OAuth errors.

Provider details stay in the application as configuration. This keeps endpoint and authentication
differences visible instead of hiding them behind provider classes that can become outdated.

## Supported Providers

The client works with a provider when its documentation describes a standard authorization-code
flow with:

- an authorization endpoint;
- a token endpoint that returns JSON;
- `client_secret_basic`, `client_secret_post`, or a public client with no secret;
- optional PKCE using `S256`.

Providers may add fields such as `audience`, `resource`, or `token_type_hint`. Pass those through the
appropriate `parameters` option.

This client does not currently implement device authorization, client-credentials grants, JWT
client assertions, token introspection, or cryptographic OpenID Connect verification.

## Installation

Copy this directory into the target project and install its dependencies:

```bash
pnpm add @zayne-labs/callapi zod
```

The implementation uses the standard `URL`, Web Crypto, `TextEncoder`, `TextDecoder`, `atob`, and
`btoa` APIs.

## Configure A Provider

Read the provider's OAuth documentation and collect:

1. The authorization endpoint.
2. The token endpoint.
3. The exact redirect URI registered for your application.
4. Whether token requests use HTTP Basic authentication or body credentials.
5. Whether the provider supports PKCE with `S256`.
6. The scopes and any provider-specific parameters you need.
7. The revocation endpoint, when one exists.

Then create one client for that provider:

```ts
import { createOAuth2Client } from "./lib/oauth2";

const oauth = createOAuth2Client({
	authorizationEndpoint: "https://provider.example/oauth/authorize",
	clientAuthentication: "client_secret_basic",
	clientId: environment.OAUTH_CLIENT_ID,
	clientSecret: environment.OAUTH_CLIENT_SECRET,
	redirectUri: `${environment.APP_URL}/auth/provider/callback`,
	revocationEndpoint: "https://provider.example/oauth/revoke",
	tokenEndpoint: "https://provider.example/oauth/token",
});
```

Do not guess endpoints or authentication modes from another provider. Use the current documentation
for the provider being integrated.

## Choose Client Authentication

`clientAuthentication` controls how the client identifies itself at token and revocation endpoints.

| Value                 | Behavior                                                   | Use when                                       |
| --------------------- | ---------------------------------------------------------- | ---------------------------------------------- |
| `client_secret_basic` | Sends the client ID and secret using HTTP Basic auth.      | The provider requires an Authorization header. |
| `client_secret_post`  | Sends `client_id` and `client_secret` in the request body. | The provider requires body credentials.        |
| `none`                | Sends only `client_id` in the request body.                | A public client has no client secret.          |

When `clientAuthentication` is omitted, the client selects `client_secret_basic` when a secret is
provided and `none` otherwise. Set it explicitly whenever the provider requires
`client_secret_post`.

## Start Authorization

Use `createAuthorizationRequest()` when the provider supports PKCE:

```ts
const { codeVerifier, state, url } = await oauth.createAuthorizationRequest({
	parameters: { audience: "https://provider.example/api" },
	scopes: ["openid", "email", "profile"],
});
```

Before redirecting the browser to `url`, store both `state` and `codeVerifier` in the user's
server-side session or in encrypted, secure, HTTP-only cookies. They belong to this one login
attempt and should expire quickly.

```ts
await session.set("oauthState", state);
await session.set("oauthCodeVerifier", codeVerifier);

redirect(url.toString());
```

Do not send the client secret, stored state, or code verifier to browser JavaScript.

### Providers Without PKCE

When a provider explicitly does not support PKCE, generate state and build the URL without a code
verifier:

```ts
import { generateOAuth2State } from "./lib/oauth2";

const state = generateOAuth2State();
const url = await oauth.createAuthorizationUrl({
	scopes: ["profile"],
	state,
});
```

State is still required for protecting the callback from cross-site request forgery.

## Handle The Callback

The provider redirects the user to your registered callback with `code` and `state` query
parameters. The application must:

1. Reject a missing `code`, callback `state`, stored state, or stored code verifier.
2. Compare callback state with stored state using a constant-time comparison.
3. Delete the one-time state and verifier after reading them.
4. Exchange the code only after state validation succeeds.

```ts
const callbackState = requestUrl.searchParams.get("state");
const authorizationCode = requestUrl.searchParams.get("code");
const storedState = await session.get("oauthState");
const storedCodeVerifier = await session.get("oauthCodeVerifier");

assertValidOAuthCallback({
	authorizationCode,
	callbackState,
	storedCodeVerifier,
	storedState,
});

await session.delete("oauthState");
await session.delete("oauthCodeVerifier");

const tokens = await oauth.exchangeAuthorizationCode({
	code: authorizationCode,
	codeVerifier: storedCodeVerifier,
});
```

`assertValidOAuthCallback()` represents application-owned validation. Callback storage and response
handling depend on the web framework, so they are intentionally not part of this library.

## Use Tokens

The token endpoint must provide `access_token` and `token_type`. Other standard fields are optional.

```ts
const accessToken = tokens.accessToken();
const tokenType = tokens.tokenType();

if (tokens.hasAccessTokenExpiry()) {
	const expiresAt = tokens.accessTokenExpiresAt();
}

if (tokens.hasRefreshToken()) {
	const refreshToken = tokens.refreshToken();
}

if (tokens.hasScopes()) {
	const scopes = tokens.scopes();
}
```

`tokens.data` contains the complete validated token response, including provider-specific fields.
The generic `scopes()` accessor handles the standard space-separated format. Read and normalize
`tokens.data.scope` yourself when a provider returns another format, such as comma-separated scopes.

## Refresh Tokens

```ts
const refreshedTokens = await oauth.refreshAccessToken({
	refreshToken: tokens.refreshToken(),
	scopes: ["openid", "email", "profile"],
});
```

Only send `scopes` when the provider documents them for refresh requests. A provider may rotate the
refresh token, so check `refreshedTokens.hasRefreshToken()` and persist the new value when present.

## Revoke Tokens

Configure `revocationEndpoint` before calling `revokeToken()`:

```ts
await oauth.revokeToken(tokens.accessToken(), {
	parameters: { token_type_hint: "access_token" },
});
```

The method throws when the client has no revocation endpoint. Provider-specific token-deletion APIs
that use another HTTP method or URL shape should be called directly rather than forced through this
method.

## Provider Extensions

Authorization, exchange, refresh, and revocation methods accept extra string parameters:

```ts
const authorization = await oauth.createAuthorizationRequest({
	parameters: { access_type: "offline", prompt: "consent" },
	scopes: ["openid", "email"],
});

const tokens = await oauth.exchangeAuthorizationCode({
	code: authorizationCode,
	codeVerifier: storedCodeVerifier,
	parameters: { audience: "https://provider.example/api" },
});
```

Reserved protocol fields cannot be overridden through `parameters`. This prevents accidental
replacement of values such as `state`, `code`, `grant_type`, `client_id`, or `client_secret`.

## ID Tokens

`decodeUnverifiedIdToken()` decodes the JWT payload and validates its data shape with Zod:

```ts
import { z } from "zod";

const claims = tokens.decodeUnverifiedIdToken(
	z.object({
		email: z.email(),
		email_verified: z.boolean(),
		sub: z.string(),
	})
);
```

This does **not** verify the signature, issuer, audience, nonce, or expiry. Never authenticate a user
from these decoded claims alone. Use a maintained OpenID Connect or JWT verification library with
the provider's discovery metadata and JSON Web Key Set before trusting the identity.

OAuth-only providers may not issue ID tokens. Fetch the authenticated user's profile from the
provider's API using the access token instead.

## Error Handling

```ts
import { OAuth2RequestError, OAuth2ResponseError, OAuth2TransportError } from "./lib/oauth2";

try {
	const tokens = await oauth.exchangeAuthorizationCode({
		code: authorizationCode,
		codeVerifier: storedCodeVerifier,
	});
} catch (error) {
	if (error instanceof OAuth2RequestError) {
		console.error(error.code, error.description, error.status);
	} else if (error instanceof OAuth2ResponseError) {
		console.error(error.status, error.body);
	} else if (error instanceof OAuth2TransportError) {
		console.error(error.cause);
	} else {
		throw error;
	}
}
```

- `OAuth2RequestError`: the provider returned a standard OAuth error object.
- `OAuth2ResponseError`: the provider responded, but the response was unexpected or invalid.
- `OAuth2TransportError`: no usable HTTP response was received.

Do not return raw provider error bodies, tokens, or secrets to users or application logs.

## CallApi Configuration

Use `callApiConfig` for transport-level behavior:

```ts
const oauth = createOAuth2Client({
	authorizationEndpoint,
	callApiConfig: {
		retryAttempts: 2,
		timeout: 10_000,
	},
	clientId,
	clientSecret,
	redirectUri,
	tokenEndpoint,
});
```

It supports CallApi hooks, middleware, plugins, custom fetch implementations, headers, metadata,
timeouts, and retries. The OAuth client owns request serialization, response schemas, error mode,
and request deduplication because those are protocol invariants.

Be conservative with retries. Authorization codes are one-time credentials, and a timed-out request
may have reached the provider even when the application did not receive its response.

## Examples

### GitHub OAuth App

```ts
const github = createOAuth2Client({
	authorizationEndpoint: "https://github.com/login/oauth/authorize",
	clientAuthentication: "client_secret_post",
	clientId: environment.GITHUB_CLIENT_ID,
	clientSecret: environment.GITHUB_CLIENT_SECRET,
	redirectUri: `${environment.APP_URL}/auth/github/callback`,
	tokenEndpoint: "https://github.com/login/oauth/access_token",
});

const authorization = await github.createAuthorizationRequest({
	scopes: ["read:user", "user:email"],
});
```

GitHub's JSON token response can omit `expires_in`, and its scope string may be comma-separated.
GitHub token deletion uses provider-specific APIs, so no generic revocation endpoint is configured.

### Spotify Confidential Client

```ts
const spotify = createOAuth2Client({
	authorizationEndpoint: "https://accounts.spotify.com/authorize",
	clientId: environment.SPOTIFY_CLIENT_ID,
	clientSecret: environment.SPOTIFY_CLIENT_SECRET,
	redirectUri: `${environment.APP_URL}/auth/spotify/callback`,
	tokenEndpoint: "https://accounts.spotify.com/api/token",
});

const authorization = await spotify.createAuthorizationRequest({
	parameters: { show_dialog: "false" },
	scopes: ["user-read-email", "user-read-private"],
});
```

Spotify uses HTTP Basic authentication for a confidential authorization-code client, so the default
authentication mode is correct.

### Google

```ts
const google = createOAuth2Client({
	authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
	clientAuthentication: "client_secret_post",
	clientId: environment.GOOGLE_CLIENT_ID,
	clientSecret: environment.GOOGLE_CLIENT_SECRET,
	redirectUri: `${environment.APP_URL}/auth/google/callback`,
	revocationEndpoint: "https://oauth2.googleapis.com/revoke",
	tokenEndpoint: "https://oauth2.googleapis.com/token",
});

const authorization = await google.createAuthorizationRequest({
	parameters: { access_type: "offline", prompt: "consent" },
	scopes: ["openid", "email", "profile"],
});
```

## Why There Is No Provider Catalog

OAuth providers change endpoints, parameters, response formats, and authentication rules
independently. A large built-in catalog creates the impression that every adapter remains actively
verified. Keeping provider configuration beside the consuming application makes its assumptions
reviewable and allows each integration to follow current provider documentation.

If several projects use the same provider, share a small provider-specific factory in its own module
or package. Keep that adapter focused on one provider rather than adding it to this protocol core.

## Attribution

This implementation was informed by Arctic 3.7.0, Copyright (c) 2023 pilcrowOnPaper, and Arctic's
post-deprecation protocol examples.

Arctic 3.7.0 is distributed under the MIT License. Arctic's replacement examples are distributed
under the Zero-Clause BSD License. This implementation has been reorganized and rewritten around
factory functions, injectable CallApi transport, Web Crypto, PKCE-S256, protected extension
parameters, Zod schemas, and structured errors.
