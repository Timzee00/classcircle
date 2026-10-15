# ClassCircle Google & Microsoft OAuth setup

Google and Microsoft are **not the same as Gemini API or Groq API keys**. To offer social sign-in you register your own web application with both identity providers. This project supports server-side OpenID Connect Authorization Code + PKCE; clients and secrets reside only in Cloudflare Worker secrets, never in the browser.

## Google Sign In

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials), select/create a project, and configure the Google Auth Platform/OAuth consent screen with your product identity, support email, authorized domains and relevant testing/publishing settings.
2. Create an OAuth client ID of type **Web application**. Add an Authorized redirect URI like `https://YOUR-APP.YOUR-SUBDOMAIN.workers.dev/api/oauth/google/callback` (replace exactly with the URL you deployed).
3. Save Client ID and Client Secret with `wrangler secret put GOOGLE_CLIENT_ID` and `wrangler secret put GOOGLE_CLIENT_SECRET` (choose `-c wrangler-lite.jsonc` when using lite mode).
4. Redeploy the Worker. The login page shows **Continue with Google** only when both values are configured.
5. To link Google to an existing email/password ClassCircle account, sign in first and visit **Settings → Connected sign-in methods → Connect Google**. Unauthenticated OAuth sign-in will *not* silently merge accounts that happen to share an email address.

## Microsoft Sign In

1. Go to the [Microsoft Entra admin center](https://entra.microsoft.com/) → **App registrations** → New registration.
2. Choose supported account types matching your audience; for a broad Nigerian student audience that often means **organizational accounts and personal Microsoft accounts**, if available to your tenant/registration.
3. Set a **Web** redirect URI exactly like `https://YOUR-APP.YOUR-SUBDOMAIN.workers.dev/api/oauth/microsoft/callback`.
4. Under Certificates & secrets, create a client secret. Store its **value** securely (not secret ID).
5. Add `MICROSOFT_CLIENT_ID` (Application/client ID) and `MICROSOFT_CLIENT_SECRET` to Wrangler secrets. Redeploy. The app requests `openid profile email`.
6. Microsoft UserInfo may not supply an email for some account types. This implementation refuses to create an account in that situation. A future enhancement can use additional permissions or a verified ID token pipeline after a careful authorization review.

## Security model and caveats

- An authorization request creates a random state, nonce and PKCE verifier in D1; a matching Secure HttpOnly SameSite=Lax cookie restricts callbacks to the initiating browser. State is single use and expires after 8 minutes.
- The Worker redeems the authorization code and fetches identity claims over TLS from the identity provider's UserInfo endpoint. The stable issuer-scoped `sub` (provider+subject) identifies the account. This is **not** an unsafe "trust any matching email" flow.
- Account linking requires the user already to have a valid local ClassCircle session at initiation and at callback. If a provider account is linked to someone else, linking is refused.
- Client secrets and callback URLs are different for each deployed domain. A localhost callback may need separate redirect URI registrations.
- Full live third-party authorization testing, domain validation, account recovery flows, Microsoft tenant-policy variants and identity-provider review still need testing before wide deployment.

Source reference: https://developers.google.com/identity/openid-connect/openid-connect and https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow
