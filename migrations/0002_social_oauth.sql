-- ClassCircle community, secure social logins and media resources.
-- Existing email/password accounts are not automatically linked to an OAuth identity.
CREATE TABLE IF NOT EXISTS oauth_identities (
  provider TEXT NOT NULL CHECK(provider IN ('google','microsoft')),
  subject TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY(provider,subject)
);
CREATE INDEX IF NOT EXISTS oauth_identities_user ON oauth_identities(user_id);
CREATE TABLE IF NOT EXISTS oauth_states (
 state_hash TEXT PRIMARY KEY, provider TEXT NOT NULL, verifier TEXT NOT NULL,
 nonce TEXT NOT NULL, expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS profiles (
 user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 bio TEXT NOT NULL DEFAULT '', school TEXT NOT NULL DEFAULT '', course TEXT NOT NULL DEFAULT '',
 level TEXT NOT NULL DEFAULT '', is_private INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS follows (
 follower_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 followed_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 CHECK(follower_id <> followed_id), PRIMARY KEY(follower_id,followed_id)
);
CREATE INDEX IF NOT EXISTS follows_followed ON follows(followed_id);
CREATE TABLE IF NOT EXISTS user_blocks (
 blocker_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 blocked_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 CHECK(blocker_id <> blocked_id), PRIMARY KEY(blocker_id,blocked_id)
);
CREATE TABLE IF NOT EXISTS social_posts (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 body TEXT NOT NULL DEFAULT '', kind TEXT NOT NULL DEFAULT 'discussion' CHECK(kind IN ('discussion','cheatsheet','revision','resource','question')),
 tag TEXT NOT NULL DEFAULT '', media_id TEXT, shared_post_id TEXT REFERENCES social_posts(id) ON DELETE SET NULL,
 created_at TEXT NOT NULL DEFAULT (datetime('now')), edited_at TEXT,
 CHECK(length(body)>0 OR media_id IS NOT NULL OR shared_post_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS social_posts_recent ON social_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS social_posts_kind ON social_posts(kind,created_at DESC);
CREATE INDEX IF NOT EXISTS social_posts_author ON social_posts(user_id,created_at DESC);
CREATE TABLE IF NOT EXISTS social_likes (
 post_id TEXT NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 created_at TEXT NOT NULL DEFAULT (datetime('now')), PRIMARY KEY(post_id,user_id)
);
CREATE TABLE IF NOT EXISTS social_bookmarks (
 post_id TEXT NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 created_at TEXT NOT NULL DEFAULT (datetime('now')), PRIMARY KEY(post_id,user_id)
);
CREATE TABLE IF NOT EXISTS social_comments (
 id TEXT PRIMARY KEY, post_id TEXT NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 parent_id TEXT REFERENCES social_comments(id) ON DELETE SET NULL,
 body TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS social_comments_post ON social_comments(post_id,created_at);
CREATE TABLE IF NOT EXISTS social_comment_likes (
 comment_id TEXT NOT NULL REFERENCES social_comments(id) ON DELETE CASCADE,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 PRIMARY KEY(comment_id,user_id)
);
CREATE TABLE IF NOT EXISTS conversations (
 id TEXT PRIMARY KEY, member_a TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 member_b TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 CHECK(member_a < member_b), UNIQUE(member_a,member_b)
);
CREATE INDEX IF NOT EXISTS conversations_b ON conversations(member_b);
CREATE TABLE IF NOT EXISTS direct_messages (
 id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
 sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 body TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS messages_conversation ON direct_messages(conversation_id,created_at DESC);
CREATE TABLE IF NOT EXISTS social_reports (
 id TEXT PRIMARY KEY, reporter_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 post_id TEXT REFERENCES social_posts(id) ON DELETE CASCADE,
 comment_id TEXT REFERENCES social_comments(id) ON DELETE CASCADE,
 reported_user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
 reason TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS media_objects (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 filename TEXT NOT NULL, mime TEXT NOT NULL, size_bytes INTEGER NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','ready')),
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS media_owner ON media_objects(user_id,status);
CREATE TABLE IF NOT EXISTS social_ai_usage (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS social_ai_usage_user ON social_ai_usage(user_id,created_at);
CREATE TABLE IF NOT EXISTS follow_requests (
 id TEXT PRIMARY KEY,
 requester_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 target_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','declined')),
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 CHECK(requester_id <> target_id), UNIQUE(requester_id,target_id)
);
CREATE INDEX IF NOT EXISTS follow_requests_target_status ON follow_requests(target_id,status,created_at DESC);
ALTER TABLE oauth_states ADD COLUMN link_user_id TEXT REFERENCES users(id) ON DELETE CASCADE;
