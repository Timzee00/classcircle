# ClassCircle — Neon PostgreSQL deployment (experimental adapter)

This is an **independent rewrite**, not the original Floot source. The default D1 deployment remains available with `wrangler-lite.jsonc`. These Neon instructions use **Cloudflare Workers to run both the frontend and API, Neon to store relational data, and Gemini/Groq for server-side AI**. None of these providers grants truly unlimited free usage.

**Important limitation:** The PostgreSQL connector is an additional compatibility implementation created without access to your Neon database. Local mock tests, SQL migration review and syntax checks can pass without proving a live deployment. **Use a fresh empty Neon project, not an existing application database**, and test sign-up, course creation, following, feed posting, messaging and OAuth before inviting users. Do not run D1 migrations against Neon.

## 1. Create a free Neon database

1. Sign in at https://console.neon.tech and create a new project (e.g. `classcircle`).
2. In its SQL editor run `migrations/0001_postgres.sql`, then `migrations/0002_postgres.sql` in that order.
3. Obtain the project's PostgreSQL connection string from the Neon dashboard. **Do not paste it into ChatGPT, GitHub, or a frontend JavaScript file**.
4. Choose a Neon region with sensible latency for your audience. Test performance from Nigerian mobile networks before launch.

## 2. Run the app locally

Install Node.js 20+ and dependencies in the project directory:

```bash
npm install
npx wrangler login
cp .dev.vars.example .dev.vars
```

In `.dev.vars`, replace `DATABASE_URL` with your private Neon Postgres connection string and add either `GEMINI_API_KEY` or `GROQ_API_KEY` (or omit AI keys to test non-AI features). Keep `.dev.vars` untracked. On Windows, `copy .dev.vars.example .dev.vars` replaces `cp`.

```bash
npm run dev:neon
```

Open the localhost URL, typically http://localhost:8787 .

## 3. Deploy to Cloudflare Workers

```bash
npx wrangler secret put DATABASE_URL -c wrangler-neon.jsonc
npx wrangler secret put GEMINI_API_KEY -c wrangler-neon.jsonc
# OR: npx wrangler secret put GROQ_API_KEY -c wrangler-neon.jsonc
npm run deploy:neon
```

The `wrangler-neon.jsonc` file deploys text-only study posts and the social network **without any R2 media bucket**. It has no D1 binding, uses `worker/neon-entry.js` to connect to Postgres, and serves the same static app UI.

For Google and Microsoft OAuth, use `OAUTH_SETUP.md` and enter the provider client IDs and secrets into the **Neon Worker** with `npx wrangler secret put GOOGLE_CLIENT_ID -c wrangler-neon.jsonc`, etc. You must register the new deployed callback domain in Google/Microsoft developer consoles. OAuth UI buttons are not substitutes for working credentials.

## 4. Photo/video uploads

This variant does **not** implement Neon's object-storage APIs. `wrangler-neon-r2.jsonc` supports the existing R2 media path if you separately enable Cloudflare R2 and create its bucket. Without R2, **text posts, messages, study content and AI remain available**. Future work can integrate Neon Object Storage, which has its own free allowance, to avoid relying on Cloudflare R2 billing setup. Never treat file uploads as production-safe until scanning, moderation, quotas and retention controls are added.

## Key differences from the D1 original

- `worker/neon-entry.js`: request-scoped Neon `Client` and DB injection.
- `worker/neon-adapter.js`: safe bound `$1` queries, D1-style result adaptation, batched atomic transactions.
- `worker/index-neon.js` + `worker/social-neon.js`: PostgreSQL-compatible feed-score math. The D1 modules remain unchanged.
- `migrations/0001_postgres.sql` + `0002_postgres.sql`: fresh PostgreSQL schema with foreign keys.
- `wrangler-neon.jsonc`: Neon config; `wrangler-neon-r2.jsonc`: optional media config.

## GitHub push

Once you create a **new empty** repo such as `your-username/classcircle`, share its URL in chat. With access enabled for the connected GitHub account, ChatGPT can write these source files to the repo. Push `.dev.vars.example` but **not** `.dev.vars`, `.env`, database URLs, API keys, secret tokens or any exported account data. A **private** repo is sensible until you've reviewed security.

## Other free options

- **Existing D1 variant + Cloudflare Workers:** minimal changes and simplest launch; use `README.md`.
- **Netlify + Neon:** feasible, but requires creating Netlify Functions/route rewrites or a framework adapter; not accomplished simply by uploading this Cloudflare Workers project as-is.
- **Vercel + Neon:** also feasible with a new serverless deployment adapter; Hobby tier has use-policy restrictions for commercial products.

The shortest path to a functioning demo is the **D1 lite setup**, because that is what the current automated test suite targets. The Neon variant here is for users who specifically prefer PostgreSQL.
