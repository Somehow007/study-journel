-- 0002_v3：业务表（docs/data-model.md §3）。user/session/setting 已在 0001。
-- 约定：ID 一律 nanoid(21) TEXT；日期 YYYY-MM-DD TEXT；时间戳 Unix 毫秒 INTEGER；
-- user_id 强制过滤；字典表（subject/state）软删用 archived_at，业务记录硬删。

-- 字典：科目 ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subject (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  color       TEXT NOT NULL,                -- #RRGGBB 主色
  sort        INTEGER NOT NULL DEFAULT 0,
  archived_at INTEGER,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  UNIQUE (user_id, name)
);

-- 字典：状态（原「心情」，内置 6 个 + 自定义统一） ----------------------------
CREATE TABLE IF NOT EXISTS state (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  builtin_key TEXT,                         -- inspired|happy|calm|tired|anxious|sad；自定义为 NULL
  label       TEXT NOT NULL,
  color       TEXT NOT NULL,
  polarity    INTEGER NOT NULL DEFAULT 0,   -- 1 积极 / 0 中性 / -1 消极
  sort        INTEGER NOT NULL DEFAULT 0,
  archived_at INTEGER,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  UNIQUE (user_id, builtin_key)
);

-- 每日：状态 + 想法（可选存在；entry 不依赖本行） ------------------------------
CREATE TABLE IF NOT EXISTS day (
  user_id     TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  date        TEXT NOT NULL,                -- YYYY-MM-DD
  state_id    TEXT REFERENCES state(id) ON DELETE SET NULL,
  diary       TEXT NOT NULL DEFAULT '',     -- Markdown
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  PRIMARY KEY (user_id, date)
);

-- 学习条目：时长的唯一来源 ----------------------------------------------------
CREATE TABLE IF NOT EXISTS entry (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  date         TEXT NOT NULL,
  subject_id   TEXT NOT NULL REFERENCES subject(id),
  title        TEXT NOT NULL,
  note         TEXT NOT NULL DEFAULT '',
  duration_min INTEGER NOT NULL CHECK (duration_min > 0 AND duration_min <= 1440),
  source       TEXT NOT NULL DEFAULT 'manual',  -- manual | focus | goal
  sort         INTEGER NOT NULL DEFAULT 0,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_entry_user_date ON entry(user_id, date);
CREATE INDEX IF NOT EXISTS idx_entry_user_subject ON entry(user_id, subject_id, date);

-- 月计划 ----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS goal (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  period       TEXT NOT NULL,               -- YYYY-MM
  subject_id   TEXT REFERENCES subject(id), -- 颜色默认取科目色
  title        TEXT NOT NULL,
  type         TEXT NOT NULL CHECK (type IN ('COUNT','CHECKLIST')),
  target_value INTEGER,                     -- COUNT 必填 >0
  unit         TEXT,
  color        TEXT,                        -- 覆盖色，NULL=用科目色
  note         TEXT NOT NULL DEFAULT '',
  sort         INTEGER NOT NULL DEFAULT 0,
  status       TEXT NOT NULL DEFAULT 'ACTIVE',  -- ACTIVE | ARCHIVED
  carried_from TEXT REFERENCES goal(id) ON DELETE SET NULL,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_goal_user_period ON goal(user_id, period);

CREATE TABLE IF NOT EXISTS goal_task (
  id          TEXT PRIMARY KEY,
  goal_id     TEXT NOT NULL REFERENCES goal(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  due_date    TEXT,                         -- 二选一：某天
  week_start  TEXT,                         --         或某周起始（week_starts_on）
  done_at     INTEGER,                      -- NULL=未完成
  reflection  TEXT NOT NULL DEFAULT '',
  entry_id    TEXT REFERENCES entry(id) ON DELETE SET NULL,
  sort        INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  CHECK (due_date IS NULL OR week_start IS NULL)
);
CREATE INDEX IF NOT EXISTS idx_task_goal ON goal_task(goal_id);
CREATE INDEX IF NOT EXISTS idx_task_due ON goal_task(due_date);

CREATE TABLE IF NOT EXISTS goal_checkin (
  id         TEXT PRIMARY KEY,
  goal_id    TEXT NOT NULL REFERENCES goal(id) ON DELETE CASCADE,
  date       TEXT NOT NULL,
  quantity   INTEGER NOT NULL CHECK (quantity > 0),
  note       TEXT NOT NULL DEFAULT '',
  entry_id   TEXT REFERENCES entry(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (goal_id, date)
);

-- 专注会话（表先建，API 在 M7/M10；依赖 goal_task 故放最后） ---------------------
CREATE TABLE IF NOT EXISTS focus_session (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  subject_id   TEXT NOT NULL REFERENCES subject(id),
  title        TEXT NOT NULL,
  planned_min  INTEGER NOT NULL,
  started_at   INTEGER NOT NULL,
  paused_ms    INTEGER NOT NULL DEFAULT 0,
  ended_at     INTEGER,
  status       TEXT NOT NULL DEFAULT 'running',  -- running | paused | done | abandoned
  entry_id     TEXT REFERENCES entry(id) ON DELETE SET NULL,
  task_id      TEXT REFERENCES goal_task(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_focus_user_status ON focus_session(user_id, status);

-- 考研扩展（表先建，API 在 M8） -------------------------------------------------
CREATE TABLE IF NOT EXISTS score (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  subject_id   TEXT NOT NULL REFERENCES subject(id),
  paper        TEXT NOT NULL,
  score        REAL NOT NULL,
  full_score   REAL NOT NULL,
  taken_on     TEXT NOT NULL,               -- YYYY-MM-DD
  duration_min INTEGER,
  note         TEXT NOT NULL DEFAULT '',
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_score_user_subject ON score(user_id, subject_id, taken_on);
