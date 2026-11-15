-- 0001_init：账号、会话、用户设置（docs/data-model.md §3）
-- session.id 存 Cookie token 的 sha256 hex；Cookie 值本身是 32 字节随机 base64url。

CREATE TABLE IF NOT EXISTS user (
  id            TEXT PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,              -- argon2id PHC 格式
  created_at    INTEGER NOT NULL            -- Unix 毫秒
);

CREATE TABLE IF NOT EXISTS session (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  expires_at  INTEGER NOT NULL,             -- Unix 毫秒
  created_at  INTEGER NOT NULL,
  user_agent  TEXT
);

CREATE TABLE IF NOT EXISTS setting (
  user_id         TEXT PRIMARY KEY REFERENCES user(id) ON DELETE CASCADE,
  exam_name       TEXT NOT NULL DEFAULT '考研初试',
  exam_date       TEXT,                     -- YYYY-MM-DD，NULL=未设置
  phase_start     TEXT,
  daily_goal_min  INTEGER NOT NULL DEFAULT 360,
  week_starts_on  INTEGER NOT NULL DEFAULT 1,   -- 1=周一
  focus_min       INTEGER NOT NULL DEFAULT 50,
  break_min       INTEGER NOT NULL DEFAULT 10,
  theme           TEXT NOT NULL DEFAULT 'graphite',
  updated_at      INTEGER NOT NULL
);
