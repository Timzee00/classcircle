# Campus social system — current implementation

## The three discovery modes (plus bookmarks)

- **For You:** recent posts with a lightweight score for likes, comments and recency. It is **not AI-ranked** and does not yet learn individual course interests.
- **Following:** posts from accounts you follow.
- **Discover:** search posts (text, author or tag), filter post types, see topics and suggested public student creators.
- **Saved:** resources bookmarked for quick access when online. Files must still be retrieved from the server; do not promise they are offline.

Students may publish educational discussion, study aids, revision outlines, course resources or a question. Don't use this platform to leak active exam papers, impersonate lecturers, or infringe content owners' rights. Content is not verified by lecturers.

### Social interactions

- Likes, comments and one-level replies (through parent-linked comments), comment likes, share links, reposts and saved posts.
- Follow public accounts, or request approval to follow private accounts; block harmful interactions.
- Direct messages only where at least one student follows the other. Messages are stored server-side in D1 and are **not end-to-end encrypted**; there is no reliable live typing, delivery receipt, read receipt or push notification system.
- In-app notifications are computed on request for follows, likes, comments and messages; manually refresh the page for updates.
- Reports are stored in D1; emails added to `ADMIN_EMAILS` can inspect pending reports and dismiss them or remove the offending post/comment. Missing: moderator appeals, automatic bans, spam scoring and audit trails.
- User profile: school, course, level, biography, and post-visibility preference.
- Resource media attachment requires optional R2. Text posts need only Workers + D1. Images/videos are bandwidth-conscious: `loading="lazy"` for images, and videos use `preload="none"` with tap-to-play controls.

### AI around the community

- A student can ask AI to explain a text-rich post or write a short practice quiz from it.
- The composer can ask AI to polish a text draft and must **explicitly accept the result**; AI does not post on its own.
- The dashboard can generate a seven-day study plan using stored courses and incomplete assignments.
- Exam Lab supports an AI study pack, custom CBT-style tests and a guided tutor.
- All provider calls happen in the Worker and cost requests/tokens; server-side quotas apply. An image/video-only post cannot be explained automatically by community AI until richer media processing is added, so a student must include descriptive text.

## Key endpoints

```text
GET    /api/auth/providers
GET    /api/auth/identities         (signed-in)
GET    /api/oauth/{google|microsoft}/start
GET    /api/oauth/{google|microsoft}/callback
GET    /api/community/settings
GET    /api/community/feed?tab=foryou|following|discover|saved&kind=&q=&offset=
GET    /api/community/discover
GET    /api/community/me
PATCH  /api/community/me
GET    /api/community/people?q=TEXT
POST   /api/community/users/:id/follow
POST   /api/community/users/:id/block
POST   /api/community/follow-requests/:id/accept|decline
POST   /api/community/posts
GET    /api/community/posts/:id
DELETE /api/community/posts/:id
POST   /api/community/posts/:id/like
POST   /api/community/posts/:id/save
GET    /api/community/posts/:id/comments
POST   /api/community/posts/:id/comments
DELETE /api/community/comments/:id
POST   /api/community/comments/:id/like
POST   /api/community/posts/:id/report
POST   /api/community/comments/:id/report
POST   /api/community/media      (binary, when R2 exists)
GET    /api/community/media/:id  (auth + post visibility)
GET    /api/community/chats
GET    /api/community/chat/:other_user_id
POST   /api/community/chat/:other_user_id
GET    /api/community/notifications
POST   /api/community/ai
GET    /api/community/moderation/reports
POST   /api/community/moderation/reports/:id/dismiss|remove
POST   /api/ai/planner
```

### Not yet in this edition

True chat realtime infrastructure, notifications pushed to devices, video processing/encoding, academic citation checking, PDF text extraction specifically for feed uploads, AI image/video interpretation on feed, content recommendation machine learning, automatic moderation at scale, voice/video calls, file virus scanning, robust account verification/password resets and automatic cloud-to-offline sync.

The supplied source deliberately avoids representing these as implemented. Features and access checks need a full production security review before hosting public student uploads or admitting minors.
