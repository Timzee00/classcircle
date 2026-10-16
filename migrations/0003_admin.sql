-- BrainBox secure administrative control plane (D1 SQLite).
CREATE TABLE IF NOT EXISTS admin_roles(user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,role TEXT NOT NULL CHECK(role IN ('student','support','moderator','admin')),granted_by TEXT REFERENCES users(id) ON DELETE SET NULL,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS admin_restrictions(user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,suspended_until TEXT,reason TEXT NOT NULL,updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS admin_hidden_posts(post_id TEXT PRIMARY KEY REFERENCES social_posts(id) ON DELETE CASCADE,reason TEXT NOT NULL,hidden_by TEXT REFERENCES users(id) ON DELETE SET NULL,hidden_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS admin_settings(key TEXT PRIMARY KEY,value TEXT NOT NULL CHECK(value IN ('true','false')),updated_at TEXT NOT NULL,updated_by TEXT REFERENCES users(id) ON DELETE SET NULL);
CREATE TABLE IF NOT EXISTS admin_audit(id TEXT PRIMARY KEY,actor_id TEXT REFERENCES users(id) ON DELETE SET NULL,action TEXT NOT NULL,target_id TEXT NOT NULL DEFAULT '',detail TEXT NOT NULL DEFAULT '{}',created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS admin_audit_recent ON admin_audit(created_at DESC);
CREATE TABLE IF NOT EXISTS admin_job_runs(id TEXT PRIMARY KEY,name TEXT NOT NULL,period TEXT NOT NULL,status TEXT NOT NULL,summary TEXT NOT NULL,started_at TEXT NOT NULL,UNIQUE(name,period));
CREATE TABLE IF NOT EXISTS admin_review_queue(id TEXT PRIMARY KEY,post_id TEXT NOT NULL UNIQUE REFERENCES social_posts(id) ON DELETE CASCADE,reason TEXT NOT NULL,created_at TEXT NOT NULL);
