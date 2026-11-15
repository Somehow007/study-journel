# 手帐 · 数据模型 v3（重构方案）

> 状态：提议（2026-11-15），对应 ADR-001 决策点 D6。
> 现状模型 = mysite MySQL `sj_*` 7 表（定义见 mysite `docker/init/schema.sql` §14–19 + `journal-schema.sql`）。
> 目标：SQLite（modernc.org/sqlite 纯 Go 驱动，CGO_ENABLED=0 单静态二进制），**为考研场景与 v6 UI 服务**，同时修掉现有结构缺陷。

## 1. 现状模型的问题（为什么要重构）

| # | 问题 | 现状 | 后果 |
|---|---|---|---|
| P1 | 科目是自由文本 | `sj_learning_item.subject VARCHAR` + 每条 `color` | 「数学一」「数学 一」「高数」被统计成不同科目；改名/改色要批量改历史；科目预设无处存 |
| P2 | 条目没有标题字段 | 只有 `subject + note` | v6 UI 的「标题 + 副行」只能靠解析 note 第一行 |
| P3 | 条目必须挂在「日记录」下 | `sj_learning_item.record_id → sj_day_record.id` | 加一条学习要先 upsert 整天；导入/同步逻辑复杂（现 `JournalServiceImpl` 400 行多为此） |
| P4 | 心情字段混存两种语义 | `mood` = 内置枚举 **或** 自定义 nanoid | 每处读取都要判断；内置心情不能改名/改色 |
| P5 | 颜色三档写进数据库 | `sj_custom_mood.solid/ink/tint/dark_colors` | 外观（主题）问题污染数据；换 UI（v6 三套主题）后存的色全部失效 |
| P6 | 目标与学习条目「同步」靠回写 ID | `goal_task.learning_client_id`、`goal_checkin.learning_client_id` | 双向同步易不一致（改条目时长不会回到打卡）；是现在最复杂的逻辑 |
| P7 | 主键风格混杂 | 日记录/条目自增 BIGINT，目标/心情 nanoid | 前端乐观更新要区分；导入导出要转换 |
| P8 | 用户设置只在浏览器 | `dailyGoalMin` 等在 localStorage | 换设备丢；考研倒计时/科目预设/专注时长需要服务端存 |
| P9 | 完成状态冗余 | `goal_task.done` + `done_at` | 两字段可不一致 |
| P10 | 无专注会话、无成绩记录 | — | v6 C 版专注计时、考研真题成绩追踪无处落 |

## 2. 设计原则

1. **单一事实来源**：学习时长只存在 `entry`；目标进度来自 `goal_checkin` / `goal_task`，二者通过 `entry_id` **单向**引用条目（条目被删 → 引用置空，不反向回写）。
2. **外观不入库**：科目/状态只存一个主色 `color`，tint/ink/深色由前端主题函数派生。
3. **全部主键 `nanoid(21)` TEXT**，客户端可生成（乐观更新、离线队列友好）。
4. **日期 = `YYYY-MM-DD` TEXT**（用户日历日，无时区语义）；**时间戳 = Unix 毫秒 INTEGER**。沿用现约定。
5. **保留 `user_id`**：当前单用户，但所有业务表带 `user_id` 并在查询中强制过滤（低成本保留多用户能力）。
6. **软删除只用于「字典」**（科目、状态用 `archived_at`，避免历史条目悬空）；业务记录硬删除。
7. 派生值（进度、连续天数、日合计）**读时计算**，不落库。

## 3. 表结构（SQLite）

```sql
-- 账号与会话 -------------------------------------------------------------
CREATE TABLE user (
  id            TEXT PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,              -- argon2id
  created_at    INTEGER NOT NULL
);
CREATE TABLE session (
  id          TEXT PRIMARY KEY,             -- 随机 32 字节 base64url，Cookie 值的 sha256 存这里
  user_id     TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  expires_at  INTEGER NOT NULL,
  created_at  INTEGER NOT NULL,
  user_agent  TEXT
);

-- 用户设置（一人一行） ----------------------------------------------------
CREATE TABLE setting (
  user_id         TEXT PRIMARY KEY REFERENCES user(id) ON DELETE CASCADE,
  exam_name       TEXT NOT NULL DEFAULT '考研初试',
  exam_date       TEXT,                     -- YYYY-MM-DD，NULL=未设置（隐藏倒计时）
  phase_start     TEXT,                     -- 阶段刻度起点，NULL=取首条记录日期
  daily_goal_min  INTEGER NOT NULL DEFAULT 360,
  week_starts_on  INTEGER NOT NULL DEFAULT 1,   -- 1=周一
  focus_min       INTEGER NOT NULL DEFAULT 50,
  break_min       INTEGER NOT NULL DEFAULT 10,
  theme           TEXT NOT NULL DEFAULT 'graphite',  -- graphite|notebook|midnight(+ -light/-dark)
  updated_at      INTEGER NOT NULL
);

-- 字典：科目、状态 ----------------------------------------------------------
CREATE TABLE subject (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,                -- 数学一 / 408 / 英语一 / 政治 / 自定义
  color       TEXT NOT NULL,                -- #RRGGBB 主色
  sort        INTEGER NOT NULL DEFAULT 0,
  archived_at INTEGER,                      -- 归档后不在选择器出现，历史仍可显示
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  UNIQUE (user_id, name)
);
CREATE TABLE state (                        -- 原「心情」，内置 6 个 + 自定义统一一张表
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  builtin_key TEXT,                         -- inspired|happy|calm|tired|anxious|sad；自定义为 NULL
  label       TEXT NOT NULL,
  color       TEXT NOT NULL,
  polarity    INTEGER NOT NULL DEFAULT 0,   -- 1 积极 / 0 中性 / -1 消极（B 版红笔/灰笔、统计用）
  sort        INTEGER NOT NULL DEFAULT 0,
  archived_at INTEGER,
  created_at  INTEGER NOT NULL,
  UNIQUE (user_id, builtin_key)
);

-- 每日：状态 + 想法（可选存在） ---------------------------------------------
CREATE TABLE day (
  user_id     TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  date        TEXT NOT NULL,                -- YYYY-MM-DD
  state_id    TEXT REFERENCES state(id) ON DELETE SET NULL,
  diary       TEXT NOT NULL DEFAULT '',     -- Markdown
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  PRIMARY KEY (user_id, date)
);

-- 学习条目：时长的唯一来源（不依赖 day 行存在） --------------------------------
CREATE TABLE entry (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  date         TEXT NOT NULL,
  subject_id   TEXT NOT NULL REFERENCES subject(id),
  title        TEXT NOT NULL,               -- 「多元函数微分学」
  note         TEXT NOT NULL DEFAULT '',    -- 「张宇 18 讲 第 9 讲…」
  duration_min INTEGER NOT NULL CHECK (duration_min > 0 AND duration_min <= 1440),
  source       TEXT NOT NULL DEFAULT 'manual',  -- manual | focus | goal
  sort         INTEGER NOT NULL DEFAULT 0,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);
CREATE INDEX idx_entry_user_date ON entry(user_id, date);
CREATE INDEX idx_entry_user_subject ON entry(user_id, subject_id, date);

-- 专注会话（C 版；A/B 也可复用） ----------------------------------------------
CREATE TABLE focus_session (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  subject_id  TEXT NOT NULL REFERENCES subject(id),
  title       TEXT NOT NULL,
  planned_min INTEGER NOT NULL,
  started_at  INTEGER NOT NULL,
  paused_ms   INTEGER NOT NULL DEFAULT 0,   -- 累计暂停毫秒
  ended_at    INTEGER,
  status      TEXT NOT NULL DEFAULT 'running',  -- running | paused | done | abandoned
  entry_id    TEXT REFERENCES entry(id) ON DELETE SET NULL,  -- done 时生成的条目
  task_id     TEXT REFERENCES goal_task(id) ON DELETE SET NULL
);
CREATE INDEX idx_focus_user_status ON focus_session(user_id, status);

-- 月计划 --------------------------------------------------------------------
CREATE TABLE goal (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  period       TEXT NOT NULL,               -- YYYY-MM
  subject_id   TEXT REFERENCES subject(id), -- 颜色默认取科目色
  title        TEXT NOT NULL,
  type         TEXT NOT NULL CHECK (type IN ('COUNT','CHECKLIST')),
  target_value INTEGER,                     -- COUNT 必填 >0
  unit         TEXT,                        -- 题 / 套 / 词 / 章
  color        TEXT,                        -- 覆盖色，NULL=用科目色
  note         TEXT NOT NULL DEFAULT '',
  sort         INTEGER NOT NULL DEFAULT 0,
  status       TEXT NOT NULL DEFAULT 'ACTIVE',  -- ACTIVE | ARCHIVED
  carried_from TEXT REFERENCES goal(id) ON DELETE SET NULL,  -- 结转来源
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);
CREATE INDEX idx_goal_user_period ON goal(user_id, period);

CREATE TABLE goal_task (
  id          TEXT PRIMARY KEY,
  goal_id     TEXT NOT NULL REFERENCES goal(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  due_date    TEXT,                         -- 二选一：某天
  week_start  TEXT,                         --         或某周周一
  done_at     INTEGER,                      -- NULL=未完成（替代 done 布尔）
  reflection  TEXT NOT NULL DEFAULT '',
  entry_id    TEXT REFERENCES entry(id) ON DELETE SET NULL,  -- 完成时可选生成条目
  sort        INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  CHECK (due_date IS NULL OR week_start IS NULL)
);
CREATE INDEX idx_task_goal ON goal_task(goal_id);
CREATE INDEX idx_task_due ON goal_task(due_date);

CREATE TABLE goal_checkin (
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

-- 考研扩展（roadmap M8，表先建好不暴露 UI） -------------------------------------
CREATE TABLE score (                        -- 真题 / 模拟卷成绩
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  subject_id   TEXT NOT NULL REFERENCES subject(id),
  paper        TEXT NOT NULL,               -- 「2012 英语一」「李林 6 套卷 #3」
  score        REAL NOT NULL,
  full_score   REAL NOT NULL,
  taken_on     TEXT NOT NULL,               -- YYYY-MM-DD
  duration_min INTEGER,
  note         TEXT NOT NULL DEFAULT '',
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);
CREATE INDEX idx_score_user_subject ON score(user_id, subject_id, taken_on);
```

共 11 张业务表（含 user/session/setting）。SQLite 连接参数：`journal_mode=WAL`、`foreign_keys=ON`、`busy_timeout=5000`。

## 4. API 资源（`/api/v1`，全部需登录，user_id 来自 session）

| 资源 | 端点 | 说明 |
|---|---|---|
| 会话 | `POST /auth/login` `POST /auth/logout` `GET /auth/me` | 登录限流 5 次/10 分钟/IP |
| 设置 | `GET /settings` `PATCH /settings` | |
| 科目 | `GET /subjects` `POST /subjects` `PATCH /subjects/:id` `POST /subjects/:id/archive` | 首次登录种子 4 科 |
| 状态 | `GET /states` `POST /states` `PATCH /states/:id` `POST /states/:id/archive` | 首次登录种子 6 个内置 |
| 日 | `GET /days/:date`（含 entries、tasks、checkins 聚合） `PATCH /days/:date`（state/diary）`DELETE /days/:date`（连同当日 entries） | 「今日」页一次请求 |
| 日历 | `GET /days?from=&to=` → `[{date,stateId,totalMin,entryCount,diaryPreview,taskDone,taskTotal}]` | 月历/时光/热力图共用；按需聚合 |
| 条目 | `POST /entries` `PATCH /entries/:id` `DELETE /entries/:id` `POST /entries/reorder` | |
| 专注 | `GET /focus/current` `POST /focus` `POST /focus/:id/pause|resume|finish|abandon` | finish 事务内生成 entry（+可选完成 task） |
| 目标 | `GET /goals?period=` `POST /goals` `GET /goals/:id` `PATCH /goals/:id` `DELETE /goals/:id` `POST /goals/:id/carry-over` | 列表含 shared 计算的进度字段 |
| 子任务 | `POST /goals/:id/tasks` `PATCH /tasks/:id` `DELETE /tasks/:id` `POST /tasks/:id/complete`（body 可带 `{durationMin, reflection, createEntry}`）`POST /tasks/:id/uncomplete` | |
| 打卡 | `PUT /goals/:id/checkins/:date` `DELETE /goals/:id/checkins/:date` | |
| 统计 | `GET /stats/month?period=` `GET /stats/year?year=` `GET /stats/heatmap?from=&to=` | 服务端聚合，前端只画图 |
| 搜索 | `GET /search?q=&type=all|entry|diary` | SQLite FTS5（`entry.title/note`、`day.diary`） |
| 成绩 | `/scores` CRUD（M8） | |
| 数据 | `GET /export`（v3 全量 JSON）`POST /import`（v3；兼容 v2 文件） | 也是备份手段 |

错误码（`{code,message}`，HTTP 状态与 code 对应；前端按 code 分支）：

| code | HTTP | 含义 |
|---|---|---|
| `0` | 200 | 成功（`data` 为负载；导出文件为裸 JSON 非包络） |
| `UNAUTHORIZED` | 401 | 未登录 / 会话失效 |
| `INVALID_CREDENTIALS` | 401 | 用户名或密码错误 |
| `RATE_LIMITED` | 429 | 登录限流（5 次/10 分钟/IP） |
| `NOT_FOUND` | 404 | 资源不存在或不属于当前用户 |
| `METHOD_NOT_ALLOWED` | 405 | 方法不允许 |
| `BAD_REQUEST` | 400 | 请求体非法 / 导入格式无法识别 |
| `VALIDATION` | 400 | 字段校验失败（日期/范围/必填/外键引用） |
| `CONFLICT` | 409 | 唯一约束冲突（同名科目、id 已存在） |
| `IMPORT_FAILED` | 400 | 导入内容校验失败（未知心情/状态、非法日期等，整批回滚） |
| `INTERNAL` | 500 | 服务器内部错误 |

## 5. 派生计算（服务端 `internal/domain` 唯一权威 + 前端 `src/lib/domain.ts` 展示镜像；双端共用 `testdata/domain-cases.json` 用例）

| 函数 | 输入 | 规则 |
|---|---|---|
| `dayTotal(entries)` | 当日条目 | Σ duration_min |
| `computeStreak(dates, today)` | 有条目的日期集合 | 从今天（今天无记录则从昨天）向前连续天数 |
| `goalProgress(goal, checkins, tasks)` | | COUNT：Σquantity/target；CHECKLIST：done/total；`reached = percent>=100` |
| `countSuggestion(goal, checkins, today)` | | `remaining/remainingDays`（含今天，向上取整）；`plannedDaily = ceil(target/daysInMonth)` |
| `previewCountSplit(target, period)` | | 日均/每周/天数（沿用现函数语义） |
| `weekProgress(goal, checkins, weekStartsOn)` | | 每周实际 vs 计划 |
| `examCountdown(examDate, today)` | | 天数；`phaseTicks(phaseStart, examDate, today, n=40)` |
| `derivePalette(color, theme)` | 主色 | 生成 solid/ink/tint/dark（替代 P5 的入库三档色） |

## 6. 旧 → 新映射与迁移

| 旧 | 新 | 规则 |
|---|---|---|
| `sj_day_record(user_id,date,mood,diary)` | `day` | `mood` 内置值 → `state.builtin_key` 对应 id；自定义 nanoid → 同 id 的 `state` 行 |
| `sj_learning_item(subject,duration_min,note,color,sort_order)` | `entry` + `subject` | `subject` 去首尾空格后去重建 `subject`（color 取该科目最近一次使用的颜色）；`note` 第一行 → `title`（空则用科目名），其余 → `note`；`date` 取所属 day_record |
| `sj_custom_mood(id,label,solid,…)` | `state`（builtin_key NULL） | 只保留 `solid` → `color`；`emoji/ink/tint/dark_colors` 丢弃 |
| 内置 6 心情 | `state` 6 行 | label 改为考研语义：专注/顺利/平稳/疲惫/焦虑/低落；polarity 1/1/0/-1/-1/-1 |
| `sj_goal` | `goal` | `color` 若与某科目同色则设 `subject_id`，否则留 `color` |
| `sj_goal_task(done,done_at,duration_min,reflection,learning_client_id)` | `goal_task` | `done=1` 且 `done_at` 空 → 用 `updated_at`；`learning_client_id` → 找到对应 entry 写 `entry_id`；`duration_min` 已体现在条目里，丢弃 |
| `sj_goal_checkin(learning_client_id,duration_min)` | `goal_checkin` | 同上 |
| localStorage `dailyGoalMin`/主题 | `setting` | 首次登录前端上报一次 |

**迁移工具** `apps/server/cmd/import-mysite`（Go，读 MySQL `sj_*` → 写 SQLite v3）：
1. 只读连接 mysite MySQL（经 SSH 隧道，账号走环境变量），读 `sj_*` 7 表 → 内存对象。（v2 导出 JSON **不含目标**，所以不用导出文件做主迁移。）
2. 按 §6 转换，单事务写入 SQLite；输出对账报告：天数、条目数、总分钟、目标数、打卡数、子任务数 —— **新旧必须逐项相等**（总分钟按日对比）。
3. 幂等：目标库非空时拒绝执行，除非 `--force` 且先自动备份。
4. 演练至少 2 次（本地一次、服务器一次）后才正式切换（见 `separation-plan.md`）。
