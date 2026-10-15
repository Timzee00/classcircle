# Copy this prompt into Gemini, Codex, Cursor or another AI coding assistant

I have attached the independent source ZIP for **ClassCircle Open v0.2**, a mobile-first Nigerian student workspace built on **Cloudflare Workers, D1, optional R2**, and a **switchable server-side Gemini/Groq AI integration**. This is not a direct Floot export; it is a new independent app. Your job is to **continue and improve** this working starter, preserving its existing features and testing rather than rebuilding it from scratch.

Before coding, read `README.md`, `SECURITY.md`, `OAUTH_SETUP.md`, `SOCIAL_FEATURES.md`, `migrations/0001_init.sql` and `0002_social_oauth.sql`. Inspect `worker/index.js`, `worker/social.js`, `worker/oauth.js`, `public/app.js`, and `public/social.js`.

Product priorities:

1. Keep all working academic features: course/deadline planner, timetable conflict checks, CGPA projection, focus room, private study circles, AI Exam Lab with CBT practice, flashcards, weakness radar, guided tutor, and offline HTML study files.
2. Preserve the **three distinct community discovery modes**: `For You` (relevant posts), `Following`, `Discover`, plus a `Saved` shortcut for bookmarked resources. Support original study aids, revision papers, educational PDFs/photos/videos, helpful discussions, comments/replies, likes, reposts, bookmarks, profiles, follow approvals for private accounts, private messages, notifications and reporting.
3. Upgrade quality without faking capabilities: true realtime chats/notifications with access-controlled sockets or Durable Objects, full media upload moderation, better search/ranking with course relevance, student safety flows, professional UI and beautiful responsive transitions. No copying copyrighted active exam papers.
4. Keep and deepen AI **contextually**: turn notes or post text into explainers and original quizzes, support AI study schedule planning from real tasks, AI caption polish, Socratic tutoring, adaptive study plans, source-backed answers and explicit feedback for wrong answers. Only allow AI to post with user approval. Rate limit provider usage, handle errors and choose affordable available models. Never expose Gemini/Groq keys to the browser.
5. Google and Microsoft OAuth authorization-code flow plus explicit account linking is implemented in `worker/oauth.js`. Check live OAuth behavior, Microsoft personal-account email handling, account linkage, cookies, consent/configuration and error cases. These logins require developer client IDs and secrets separate from the Gemini key. Never auto-link accounts based on unverified email.
6. Optimize for Nigerian students: low-bandwidth video defaults, image compression, genuine offline materials, no massive autoplay downloads, accessible mobile UI and clear explanations. Avoid promising unlimited free storage/inference.
7. **Deployment goal:** build with Cloudflare's `wrangler-lite.jsonc` first (D1 + text posts; no R2 activation). Add `wrangler.jsonc` + R2 only after the owner decides to subscribe. R2 has a free allowance but may require billing setup; do not invent a zero-card setup.
8. Strengthen security for public launch: Cloudflare Turnstile, account verification/recovery/deletion, moderation workflows, spam controls, privacy for minors, virus scans and transcoding, notifications and audit logs. Consider Nigeria Data Protection Act and intellectual property rights. Test failure modes and quota exhaustion.
9. Preserve design language from existing styles: parchment neutral backgrounds, dark indigo, lilac, editorial headings and dense yet readable cards. Improve to production polish without making the Floot app appear identical or claiming source parity.

Start by running `npm run check` and `npm test`, installing dependencies, creating a temporary D1 database and running migrations locally. Verify signin and post/messaging CRUD with two test users, confirm media signatures, account privacy and profile behavior, then perform **actual** live Google/Microsoft/Gemini/Groq tests only once the owner connects credentials. Report what was verified and what was not. Avoid fake release metrics and fake test claims. Deliver an updated ZIP and explain changes.


## Neon compatibility added
The project also contains `wrangler-neon.jsonc`, `worker/neon-adapter.js`, and PostgreSQL SQL migrations. Validate any database-provider transition by running the relevant API integration tests against a disposable database. The Neon adapter has not been live-tested with real credentials. Do not mistake D1 SQL for executable PostgreSQL SQL.
