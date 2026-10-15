# ClassCircle Open — security, privacy and launch-readiness (v0.2)

**This is a working prototype/starter with automated tests, not a security-audited, scaled campus product.** Use a staging site and invited adult testers before allowing open registration, student uploads or paid subscriptions.

## Safeguards implemented

- Passwords are stored as salted PBKDF2-HMAC-SHA-256 derivations; raw passwords are not stored. OAuth-only accounts have deliberately blank password hash and salt fields and cannot authenticate with arbitrary passwords.
- Session tokens are random 256-bit values, hashed in D1; cookies are HttpOnly, Secure, SameSite=Lax. Signed-in endpoints check sessions, and D1 queries check user ownership.
- Google and Microsoft use authorization-code flow with PKCE, server-side client secrets, state matching and short-lived OAuth state entries. OAuth provider subjects, not email matching, bind identities to user accounts; existing accounts can explicitly connect providers while already signed in.
- Restricted social access: private study-circle membership; owner-only post deletion; only approved followers see private profiles' posts; permission checks on uploaded-media reads; access control on DMs and account blocks; moderator allowlist on report actions.
- File uploads to optional private R2 are content-type and signature checked and bounded (5 MB images, 10 MB PDFs, 15 MB video). Unattached files are not accessible from the public media GET endpoint. Files remain private and require an authenticated post-visible request.
- SQL is executed with bound parameters. User content is HTML-escaped in the browser (including offline HTML packs). PDF attachments are served as downloads rather than rendered as application HTML.
- AI API keys, OAuth secrets and moderator allowlist are stored in Worker secrets, never public JS. AI calls have timeouts, account usage limits and a global soft quota. Text-only mode can run without an R2 subscription.
- Cross-origin state-changing requests with an Origin from another domain are rejected; no permissive CORS headers.
- User reports and admin moderation queue are present. Blocking severs follows and prevents posts and direct messages between blocked accounts.

## Critical steps before a broad public launch

1. **Authentication defense:** add strong registration and login rate limits, suspicious IP handling, Cloudflare Turnstile/bot controls, email verification, recovery/password reset emails, session/device revocation and full data export/account deletion. Password comparison should be constant-time; review PBKDF2 vs platform CPU allowances on Workers Free (10 ms CPU/request).
2. **Social safety:** add a publish-time content review pipeline for illegal content, bullying, fraud, self-harm, pornography, exam leaks and copyright violations. Support appeals, suspensions, report escalations, evidence retention, moderation logs and contact pathways for user safety. Human moderation queue alone is insufficient for a large network.
3. **Youth safeguards:** a student social network may attract minors. Establish age policies, youth privacy rules and protections before collecting profiles, messages or personal media; audit in accordance with applicable Nigerian regulations and target markets.
4. **Uploads:** add malware scanning, transcode/remux/re-encode of images/videos, file metadata stripping where needed, explicit removal of media orphans, CDN cache controls, video/content moderation, abuse reporting and storage lifecycle cleanup. Validate media signatures but **do not** treat that as a malware guarantee.
5. **Messaging:** DMs are **not end-to-end encrypted**. Add conversation deletion/restriction controls, unread/read receipts if appropriate, realtime via authorized WebSockets/Durable Objects, blocks and abusive-message reporting before wider launch. Avoid exposing minors to uncontrolled unsolicited contact.
6. **OAuth:** perform full Google and Microsoft live sign-in tests on each exact HTTPS redirect URI. Review ID token / issuer validation, Microsoft personal/organization account variations, secure account linking and callback error handling. Code currently uses trusted HTTPS UserInfo endpoint and OAuth state/PKCE instead of manually validating identity-token signatures.
7. **Privacy:** do not publish unpublished learning materials or exams without permission. Obtain informed consent for use of third-party AI APIs; check their content/data-retention rules. Set data-retention/deletion policies and backup recovery procedures.
8. **Rate limiting and cost control:** per-account/global AI usage limits here are **soft**; simultaneous requests can race. Public use requires stronger account and IP budget enforcement, anti-bot controls and Cloudflare billing alerts. Videos can exceed R2 operation/storage free allowances and lead to charges after included usage.
9. **AI reliability:** student-generated educational content is unverified. AI notes, flashcards and plans can be wrong. Add answer reporting, citation/source checking, OCR quality controls, and human educator review. Prompt-injection filtering cannot guarantee correctness.
10. **Platform limits:** Cloudflare Workers Free 10ms CPU/request and daily quotas may not support intensive authentication/video processing at scale. Test on staging and re-evaluate architecture if deployment or performance fails.
11. **OAuth account recovery:** user with a password account must sign in using their original method before linking a social provider. No automatic merging based on an email; this avoids trivial account takeover, but support should have a vetted account-recovery process.
12. **Accessibility and performance:** real devices, keyboard navigation, screen readers, contrast audits, large-text support, reduced motion, 2G/3G profiling and offline-state handling still need formal testing.

## Offline data

The cached public app shell is separate from authenticated API data. Saved study packs/focus sessions in local browser storage are not encrypted, may be deleted when storage is cleared and may be visible to people sharing the same device/browser profile. Downloaded HTML files likewise are not encrypted. **Do not** treat a bookmarked PDF as offline unless the file was actually downloaded.

## Current test coverage

Node `node:sqlite` tests exercise social authorization, private follow requests, direct messaging prerequisites, media access, notification permissions, a mocked Google login, mocked Microsoft account linking, moderator allowlisting and web security guards. The responsive feed has also been browser-rendered using **simulated API responses**. These do **not** prove a live Cloudflare deployment, real AI generation, file streaming on R2, signed-in payment flows or an independent security audit.

## Secrets and incident response

Keep `.dev.vars` out of version control; no real secrets belong in the ZIP. Use `wrangler secret put` and rotate credentials if they leak. Back up D1 securely and restrict who can access Cloudflare, GitHub and the external AI provider dashboards. Monitor usage and API errors from day one.
