# Google OAuth

Sign-in is the OIDC Authorization Code Flow with PKCE, brokered by [Authlib](https://docs.authlib.org/) against Google's discovery document. The backend mints a session cookie identical to the one `/dev/login` produces, so all downstream routes are unchanged whether the session was started by Google or by the dev bypass.

This doc covers the dev-environment setup. The production OAuth Client is created later as part of the Railway deployment phase and never shares its secret with the dev client.

## Cloud Console setup (one-time, per environment)

Use a separate OAuth Client for development and production so the dev client's secret and redirect URI never overlap with prod. For local development:

1. In the [Google Cloud Console](https://console.cloud.google.com/), create or pick a project.
2. Open **APIs & Services → OAuth consent screen**. Set User type to **External** and leave the publishing status as **Testing**. Add your own Google account under **Test users** so only you can complete the flow. Required scopes are `openid`, `email`, and `profile`.
3. Open **APIs & Services → Credentials** and create an **OAuth 2.0 Client ID** of type **Web application** named `Household Shopping List (dev)`:
   - Authorized JavaScript origins: `http://localhost:8080`
   - Authorized redirect URIs: `http://localhost:8080/api/auth/google/callback`
4. Copy the generated Client ID and Client Secret into your local `backend/.env`:

```sh
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...
APP_BASE_URL=http://localhost:8080
```

`APP_BASE_URL` is used to build the absolute redirect URI sent to Google, since the backend sits behind the local Nginx edge.

## Configuration flags

- `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET` — both must be set for OAuth to be enabled. When either is missing, the backend treats Google sign-in as disabled.
- `APP_BASE_URL` — the public origin the browser uses, including scheme and port. Defaults to `http://localhost:8080`. Used by the backend to build the absolute redirect URI in the authorize request.

When OAuth is disabled, `/auth/google/login` and `/auth/google/callback` return `503 Service Unavailable` and `/config` reports `google_oauth_enabled: false`, so the frontend hides the Google sign-in button.

## Routes

- `GET /auth/google/login` — Authlib stores `state`, `nonce`, and the PKCE `code_verifier` in the signed session cookie, then 302-redirects the browser to Google's authorize endpoint.
- `GET /auth/google/callback` — Authlib validates `state`, exchanges the code (with the PKCE verifier and the client secret) for an `id_token`, and verifies the JWT signature, `iss`, `aud`, `exp`, and `nonce`. The handler additionally rejects the response if `email_verified` is not `true`. On success, the user is upserted (looked up first by `google_oauth_subject`, then by email so accounts created via `/dev/login` get their `sub` attached on first real sign-in) and the session cookie's `user_id` is set before redirecting back to `/`.
- `POST /auth/logout` — clears the session cookie. Works for both Google and dev-login sessions.
- `GET /config` — unauthenticated; returns `{ "dev_login_enabled": bool, "google_oauth_enabled": bool }` so the frontend can render the appropriate sign-in UI.

## Dev bypass coexistence

`/dev/login` remains gated by `ENV in {development, test}` and is intended for local API testing and tests that do not want to mock the OAuth round-trip. It is independent of the Google OAuth configuration: enabling Google sign-in does not disable the dev bypass, and disabling the dev bypass (by running with `ENV=production`) does not affect Google sign-in.

## Why localhost as a redirect URI is safe

Registering `http://localhost:8080/api/auth/google/callback` does not give arbitrary localhost services permission to use this Client ID. Google's redirect-URI list is an allow-list for **destinations**, not for **initiators**. An attacker who tricks a user into starting a flow with our `client_id` and a localhost `redirect_uri` cannot read the resulting authorization code (it lands on the victim's machine, not theirs), and even if they did, they cannot exchange it without the client secret and the PKCE `code_verifier` that Authlib generated on the legitimate origin. The state cookie further guarantees that codes only flow back to the same browser session that started the flow.

The remaining real-world concern is **client-secret hygiene**: if `GOOGLE_OAUTH_CLIENT_SECRET` leaks, an attacker could host a clone at `localhost:8080` and phish users into completing the consent screen. Two mitigations are baked into the setup above:

- The dev client lives in a Cloud Console project in **Testing** mode with only your account as a test user, so even with the secret, Google will refuse to issue tokens to anyone else.
- A separate prod OAuth Client (created later) means the dev secret has no power over the production deployment.
