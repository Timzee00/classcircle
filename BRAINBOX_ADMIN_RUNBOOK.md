# ClassCircle BrainBox — platform control plane

Version: 0.1 (October 2026). **This is the site-wide administrator control plane, not the student-facing CourseBrain feature.**

## Important: two different codebases

The GitHub version (`Timzee00/classcircle`) is a standalone Cloudflare Worker frontend, API and database. It supports D1 or Neon. The original Floot ClassCircle is a separate React/Floot platform with a separate database and cannot execute this Cloudflare Worker or D1 migration directly. This update targets the **GitHub edition** only. The Floot edition must receive a native Floot endpoint, React admin view and PostgreSQL schema equivalent when its build allowance is available. Do not claim shared accounts, shared databases or automatic synchronization between the two.

## Production-safe deployment checklist (mandatory)

1. **Do not deploy the admin API before its migration.** Back up the database, then apply `migrations/0003_admin.sql` to existing D1, or `migrations/0003_admin_postgres.sql` to Neon. Avoid executing *both* on the same database. Use Neon SQL Editor or D1 migrations for its matching database; do not run a SQLite script against Neon.
2. Add `SUPERADMIN_EMAILS` as a **private Worker secret** containing exact comma-separated email addresses of the platform owners. Example command with the *correct Wrangler config*: `npx wrangler secret put SUPERADMIN_EMAILS -c wrangler-neon.jsonc`. Do **not** add your address or any credential to a public repository config file. An owner must already be a registered ClassCircle user and sign in with that exact email.
3. Deploy the Worker from GitHub only after the above steps, e.g. `npm run deploy:neon` or `npm run deploy:lite`. For a Neon Worker, set `DATABASE_URL` with `wrangler secret put DATABASE_URL -c wrangler-neon.jsonc`. Never commit DB URLs, Gemini/Groq keys or OAuth client secrets.
4. Open the logged-in student application. A **BrainBox Admin** navigation item appears only for a server-recognized staff account. Its *absence* does not mean the server is secure; permissions are checked again for every API action.
5. Test a non-admin session against `/api/admin/dashboard` (must return 403), then verify an owner session against `/api/admin/me` (must return `superadmin`). Test feature toggles and maintenance rollback with a staging account before rollout.
6. The `wrangler*.jsonc` files install a 03:00 UTC scheduled cleanup. Cloudflare cron timing is UTC. Check the account's Cron Trigger support and permissions after deploying.
7. Create a restore point and record the deployment commit, DB backup, owner email verification and a second admin who can respond to incidents.

### Current admin roles

| Role | Permissions |
| --- | --- |
| Student | No access to BrainBox admin |
| Support | Read-only status, user search, audit history |
| Moderator | Support plus reports and reversible content hiding |
| Admin | Moderator plus account suspension, feature switches and manual jobs |
| Superadmin | Admin plus staff role assignment (only email allowlist can be superadmin) |

Staff cannot suspend themselves or a superadmin. Roles cannot be elevated to superadmin through the dashboard.

### Available functionality

- Platform status: active accounts, total social posts, pending reports, suspended accounts and AI calls in the last 24 hours.
- Role-based user search by display name or email. Time-limited suspension (1–2160 hours) revokes active sessions, and access can be restored.
- Reversible post hiding/unhiding, visibility suppression in the feed and attachment route, student reports and a human-review queue.
- Flags: `maintenance_mode`, `registration_enabled`, `ai_enabled`, `social_posting_enabled`, `automation_cleanup`, `automation_triage`.
- Append-only **at the API level** audit history for staff actions, and records for background jobs. Database administrators can still alter database records—append-only here is not tamper-proof logging.
- Daily cleanup of expired sessions, expired OAuth states, AI usage records beyond 45 days and completed temporary account suspensions.
- Multi-report triage that flags posts with 3+ unresolved reports for manual review. No AI moderation is allowed to auto-ban accounts.

### What is NOT yet included

- Floot admin implementation / 1:1 parity; same account identities or cross-platform data sync.
- Fully managed moderation appeals, self-service account recovery, safety incident paging, legal data retention workflows, media antivirus, CSAM scanning and trusted-organization account verification.
- Push/SMS/email notification delivery (no outbound credentials are assumed), real background AI classification or automatic removal of user-created content.
- Billing/payment controls, AI provider invoices, money balances, analytics warehouse, support ticket inbox or automated staff scheduling.

### Platform automation policy

**Automate low-risk, reversible operational tasks first.** Cleanup performs only retention housekeeping; it does not remove social content. Triage escalates to a staff queue. Changes to student roles, account bans, public-facing opportunity verification, payments or deletions must require authorized human action and audit history.

### Operating procedures

**Abuse complaint:** Verify post and report context → hide if necessary → inform users through separate notification workflow (not built) → record resolution and provide appeal path → restore if overturned. A report is not proof of wrongdoing.

**Unexpected provider costs:** Disable AI requests in BrainBox → inspect provider dashboards directly → lower shared quotas in code if needed. The `ai_enabled` flag prevents the app's existing study AI routes from issuing further AI calls; it does not disable AI outside this Cloudflare Worker.

**Safety incident:** Set maintenance mode if the site must be temporarily read-only, preserve forensic logs, rotate compromised credentials in the provider console, then remove maintenance once resolved. BrainBox admin endpoints remain available to authorized staff in maintenance mode.

**Database failure:** The dashboard relies on the same DB as the public app, so maintain out-of-band access to Cloudflare/Neon. Never depend solely on BrainBox for database recovery.

## Functional parity contract for Floot

Use the same meaning for RBAC and flags across both platforms: `superadmin` (owner allowlist), `admin`, `moderator`, `support`, `student`; protected route `/admin` or `/brainbox-admin`, always server-authorized. Floot should implement native `endpoints/admin/*`, `pages/admin.tsx`, `pages/admin.pageLayout.tsx`, `cc_admin_roles`, `cc_admin_audit`, `cc_admin_settings`, `cc_admin_suspensions`, `cc_admin_job_runs`, and automated tasks compatible with Floot's scheduler. **Do not transplant Cloudflare DB bindings or auth cookies into Floot**. A shared JSON contract and tests can verify behavior without forcing identical hosting-specific code.

### Planned future automations, not implemented here

- Notification digests for due assignments with opt-in and timezone limits;
- Weekly AI cost/usage reports and rate budget anomaly alerts;
- Duplicate resource detection and legitimate-content review workflows;
- Periodic broken opportunity-link checks and expiration;
- Low-data CDN cache improvement and performance monitoring;
- Dormant-account reminder only after explicit consent;
- Cross-platform parity smoke-test workflow on CI.

No pressure-based streaks or notification spam. The retention strategy should help students achieve real outcomes.
