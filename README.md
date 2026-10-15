# ClassCircle Open — Campus Community + AI Study Platform

**NEW:** For a PostgreSQL deployment on Neon, see [NEON_DEPLOY.md](NEON_DEPLOY.md). The original Cloudflare D1 deployment instructions remain below. This is not pixel-identical to Floot.


**Independent, editable rebuild (version 0.2). Not the original Floot source export and not pixel-identical to Floot.**

ClassCircle Open is a portable student workspace for Cloudflare Workers, Cloudflare D1, an optional Cloudflare R2 media bucket, and a **server-side** Gemini or Groq API. It is a new implementation based on the ClassCircle product idea, not a conversion of Floot's React UI or its PostgreSQL database.

## What's now included

- Responsive mobile-first student dashboard, courses, assignments, deadline tracking, lecture scheduling with conflict detection, GPA/CGPA goal calculation, and class circles.
- **Student Community** with four useful navigation options: **For You** (freshness plus engagement ranking), **Following**, **Discover** (tags, search, recommended voices), **Saved** (bookmarks). Unlike having both "FYP" and "For You", each tab serves a distinct purpose.
- Publish original study tips, cheat sheets / learning aids, revision papers, resource links and questions; **optional** photos, PDFs or video attachments (R2 mode only).
- Likes, threaded/reply comments, comment likes, reposts with attribution, shareable links, bookmarks, follow and unfollow, optional private profiles, private follow request approval, blocking, reporting and a moderator-only review queue.
- Student direct messages, account-based authorization, rate limits and manually refreshed in-app notifications. **No end-to-end encryption, read receipts, or automatic real-time updates yet.**
- AI Exam Lab: topic or notes into explanations, flashcards, CBT-style multiple-choice practice, weaknesses and offline HTML study packs. Image/PDF input only in Gemini mode (small attachments in Exam Lab, not a community R2 file link).
- AI study planner from recorded courses and deadlines; AI explanations or mini-quizzes from text-based study posts; AI writing polish for captions; AI Socratic tutor. AI tools use the selected provider, not an unlimited free model.
- Email/password sign-up and Google and Microsoft login via **server-side OAuth authorization code with PKCE and state protection** (after you register the required OAuth apps). Existing local accounts can link providers in Settings instead of unsafe email-based auto-linking.
- Cloudflare Worker JavaScript backend, bound SQL for D1, no proprietary Floot dependencies, and a browser frontend with no bundler or paid build credits required.

## Project files

```text
public/               index.html, app.js, social.js, styles.css, social.css, sw.js, favicon.svg
worker/index.js        Student data + AI endpoints
worker/social.js       Feed, likes, comments, follows, DMs, moderation, R2 media, community AI
worker/oauth.js        Google/Microsoft OIDC + PKCE + account linking
migrations/            0001_init.sql, 0002_social_oauth.sql
wrangler.jsonc         Full config with R2 MEDIA bucket
wrangler-lite.jsonc    Text-only FREE starter without R2 (same frontend)
.dev.vars.example      Example for local server-side secrets
SECURITY.md            Safety, moderation and readiness notes
OAUTH_SETUP.md         Google and Microsoft developer-console setup
SOCIAL_FEATURES.md     Feature summary, realistic constraints and API routes
PROMPT_FOR_AI.md       Ready-to-paste prompt for another code assistant
```

## Quick start: no R2 subscription required

You need Node.js 20+, npm, a Cloudflare account, and a Gemini or Groq API key if you want AI features. **To avoid activating R2 billing, start with the text-only lite config.**

```bash
npm install
npx wrangler login
npx wrangler d1 create classcircle-db
```

The D1 creation command returns a `database_id`. Replace the all-zero placeholder in **both** `wrangler.jsonc` and `wrangler-lite.jsonc` if you plan to switch modes later.

```bash
npx wrangler d1 migrations apply classcircle-db --local -c wrangler-lite.jsonc
cp .dev.vars.example .dev.vars
# On Windows use: copy .dev.vars.example .dev.vars
```

Edit `.dev.vars` with your *private* provider key. Select `AI_PROVIDER` in `wrangler-lite.jsonc` (either `gemini` or `groq`). Then:

```bash
npm run dev:lite
```

Open the localhost URL Wrangler prints, typically `http://localhost:8787`. Test signup/login, assignments, course circles, text posts, likes and comments. For **local Google/Microsoft OAuth**, you must separately register `http://localhost:8787/api/oauth/google/callback` and/or `/api/oauth/microsoft/callback` with the identity provider; Secure cookies on localhost can behave differently in browsers, so prefer testing OAuth on HTTPS staging first.

### Deploy the text-only version

```bash
npx wrangler d1 migrations apply classcircle-db --remote -c wrangler-lite.jsonc
npx wrangler secret put GEMINI_API_KEY -c wrangler-lite.jsonc
# OR
npx wrangler secret put GROQ_API_KEY -c wrangler-lite.jsonc
npm run deploy:lite
```

If AI is optional during early testing you can omit both keys; study calendars, posts and saved data still work, and the server will tell users AI isn't configured. **Keys must never be copied into `public/app.js` or committed to GitHub.**

## Enable photos, PDFs and videos (optional R2 mode)

Cloudflare R2 includes a monthly no-cost usage allowance, but Cloudflare says you need an **R2 subscription** and must complete its checkout flow to enable it. This can require payment details even when you expect to stay under the free allowance. If you cannot do that, keep `wrangler-lite.jsonc`; it fully supports text-based posts, social features and AI study content without R2.

Once you're ready:

```bash
npx wrangler r2 bucket create classcircle-media
npx wrangler d1 migrations apply classcircle-db --remote
npx wrangler secret put GEMINI_API_KEY
# or npx wrangler secret put GROQ_API_KEY
npm run deploy
```

`wrangler.jsonc` includes `"r2_buckets": [{ "binding": "MEDIA", "bucket_name": "classcircle-media" }]`. The browser detects when R2 isn't bound and hides attachments. Uploaded files are stored privately and served only by authenticated Worker routes; PDFs are sent as download attachments, with content-type and signature checks. Limit: 5 MB per image, 10 MB per PDF, 15 MB per video, 20 uploads per account per day. There is **no transcoding, antivirus scanning, copyright verification or global content scanning** yet; don't open uploads to the public until those risks are addressed.

## Google & Microsoft sign-in

These buttons are implemented in this independent edition, **but won't appear or work until you supply the OAuth client credentials and redirect URIs**. Read [OAUTH_SETUP.md](OAUTH_SETUP.md). For production, register your actual `.workers.dev` or custom-domain callback URL with each provider, and add the secrets:

```bash
npx wrangler secret put GOOGLE_CLIENT_ID -c wrangler-lite.jsonc
npx wrangler secret put GOOGLE_CLIENT_SECRET -c wrangler-lite.jsonc
npx wrangler secret put MICROSOFT_CLIENT_ID -c wrangler-lite.jsonc
npx wrangler secret put MICROSOFT_CLIENT_SECRET -c wrangler-lite.jsonc
```

For R2 mode omit `-c wrangler-lite.jsonc` in these commands. You can start with Google only, then add Microsoft. They are separate developer registrations; your **Gemini/Groq key cannot also act as a Google/Microsoft login client**.

## Moderation setup

For a private owner/moderator account, set a verified, known admin email allowlist *as a secret*:

```bash
npx wrangler secret put ADMIN_EMAILS -c wrangler-lite.jsonc
```

Enter one or more lowercase emails separated by commas. The admin gets a moderation queue under **Settings** to dismiss reports or remove reported posts/comments. This is a minimal human moderation tool, **not** a substitute for copyright handling, safeguarding, appeals and abusive-content response workflows.

## Testing

```bash
npm run check
npm test
```

The test suite uses Node's built-in `node:sqlite` to simulate D1. It checks the migration and most essential social authorization workflows. A local browser test was also performed against simulated API responses. This is **not** a substitute for a real Cloudflare deployment, an actual Google/Microsoft OAuth login, an AI provider call, video streaming on R2, or security review.

## Cost and operational limits

Cloudflare Workers and D1 have free-plan allowances, but quotas can be exhausted. The R2 subscription is separate from Workers and may require billing. Gemini/Groq free API usage is account-, model-, region- and rate-limited. The app caps AI pack generation and tutoring, and campus social AI shares the tutor quota; these are **soft database quotas and not a guarantee against concurrent abuse**. A large social network with videos will outgrow the free tiers.

The feed's "For You" uses a **simple recency and engagement score**, not a sophisticated learned recommender. Study posts are user-generated and unverified; AI answers are educational drafts, not trusted exam answer keys. The account system does not yet include email verification, forgotten-password email flows, deletion/export of all account data or push notifications. See SECURITY.md before opening this to campuses.

## How to give it to another AI developer

Upload the whole ZIP and the file `PROMPT_FOR_AI.md` to Gemini, Codex or another coding assistant. Ask it to run migrations and tests before changing the architecture. The original Floot database and Floot-specific code are **not** included; any Floot user data must be separately, carefully exported and migrated.

## Rights

Independent original code generated for your ClassCircle project; you can edit, run, share with developers and host it yourself. Third-party service terms and user-uploaded materials have separate rules.
