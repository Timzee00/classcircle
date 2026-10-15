PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS users (
 id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
 password_hash TEXT NOT NULL, salt TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS sessions (
 token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 expires_at TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);
CREATE TABLE IF NOT EXISTS courses (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 code TEXT NOT NULL, name TEXT NOT NULL, lecturer TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE(user_id,code)
);
CREATE INDEX IF NOT EXISTS idx_courses_user ON courses(user_id);
CREATE TABLE IF NOT EXISTS tasks (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 course_id TEXT REFERENCES courses(id) ON DELETE SET NULL, title TEXT NOT NULL,
 due TEXT NOT NULL, priority TEXT NOT NULL DEFAULT 'medium', kind TEXT NOT NULL DEFAULT 'assignment',
 notes TEXT NOT NULL DEFAULT '', done INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_tasks_user_due ON tasks(user_id,due);
CREATE TABLE IF NOT EXISTS classes (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
 day INTEGER NOT NULL CHECK(day BETWEEN 0 AND 6), start_time TEXT NOT NULL,
 end_time TEXT NOT NULL, room TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_classes_user ON classes(user_id,day);
CREATE TABLE IF NOT EXISTS grades (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 course_id TEXT REFERENCES courses(id) ON DELETE SET NULL,
 semester TEXT NOT NULL DEFAULT 'Current semester', units INTEGER NOT NULL CHECK(units BETWEEN 1 AND 10),
 grade TEXT NOT NULL CHECK(grade IN ('A','B','C','D','E','F')),
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_grades_user ON grades(user_id);
CREATE TABLE IF NOT EXISTS circles (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
 code TEXT NOT NULL UNIQUE, owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS circle_members (
 circle_id TEXT NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('owner','member')),
 joined_at TEXT NOT NULL DEFAULT (datetime('now')), PRIMARY KEY(circle_id,user_id)
);
CREATE INDEX IF NOT EXISTS idx_circle_members_user ON circle_members(user_id);
CREATE TABLE IF NOT EXISTS posts (
 id TEXT PRIMARY KEY, circle_id TEXT NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 content TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_posts_circle ON posts(circle_id,created_at);
CREATE TABLE IF NOT EXISTS packs (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 topic TEXT NOT NULL, content TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_packs_user ON packs(user_id,created_at);
CREATE TABLE IF NOT EXISTS attempts (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 pack_id TEXT NOT NULL REFERENCES packs(id) ON DELETE CASCADE,
 answers TEXT NOT NULL, score INTEGER NOT NULL,
 total INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_attempts_user ON attempts(user_id,created_at);
CREATE TABLE IF NOT EXISTS ai_usage (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 kind TEXT NOT NULL CHECK(kind IN ('pack','coach')), created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ai_usage_user ON ai_usage(user_id,kind,created_at);
