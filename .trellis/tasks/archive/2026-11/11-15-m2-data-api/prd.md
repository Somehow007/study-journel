# 11-15-m2-data-api

## 问题 / 目标

按 `docs/roadmap.md` M2 五张任务卡落地数据层 v3 与 `/api/v1` 业务 API：

- M2-1 全部 v3 表迁移（`data-model.md` §3，0001 之后补 9 张）
- M2-2 `internal/domain` 纯函数 + `testdata/domain-cases.json` 双端对齐用例
- M2-3 sqlc 接入（`db/queries/*.sql` → `internal/db` 生成代码入库）
- M2-4 路由按资源分组，对齐现有 `/api/journal` 行为
- M2-5 settings 读写 + 默认值 + 首次种子

命中 AGENTS §2「数据模型与迁移 / 契约与领域层 / 鉴权会话（session 中间件复用）」，先记方案再动手。

## 消费点

- **旧 API 行为来源（只读参照，不改 mysite）**：`../mysite …/journal/` 的 Controller/ServiceImpl/DTO/Mapper XML——upsert patch 语义、进度读时算、carry-over、import v1/v2、streak、search LIKE、today 聚合。新实现按 `data-model.md` §4 新资源面重写，**语义对齐、路径/形状按 v3**。
- **前端消费点（本卡不改 `apps/web`，M3 才切）**：`apps/web/src/lib/{api,goalApi,http,streak,useDataIO}.ts`、`types/{index,goal}.ts`——新端点形状按 data-model §3/§4 设计，JSON 沿用 camelCase 与旧字段名（durationMin/targetValue/dayMarks…）降低 M3 成本。
- **契约源**：`docs/data-model.md` §3（表）§4（端点）§5（领域函数）；`docs/architecture.md` §6（包络/鉴权/日期约定）。
- **错误码**：architecture §6 指向「data-model.md §4 末」的错误码枚举——该节缺失，本卡补齐（沿用旧 `JOURNAL_*` 语义改 STRING code）。
- **依赖**：新增工具依赖 `sqlc`（`go install`，代码生成器不进 go.mod）；运行时零新依赖。

## 方案

### M2-1 迁移 `db/migrations/0002_v3.sql`

按 §3 建 `subject / state / day / entry / focus_session / goal / goal_task / goal_checkin / score` 9 张 + 索引，全部 `IF NOT EXISTS`（与 0001 风格一致；runner 本身按 user_version 保证只跑一次）。`entry.subject_id`、`day.state_id`、`goal.subject_id`、`goal_task/goal_checkin/focus_session.entry_id` 等外键按 §3 原样（ON DELETE CASCADE/SET NULL）。

### M2-2 `internal/domain`（纯函数，无 IO）

- 日期：`ParseDate/ValidateDate`（YYYY-MM-DD）、`ParsePeriod/ValidatePeriod`（YYYY-MM）、`AddDays`、`DaysBetween`、`DateInPeriod`、`NextPeriod`、`PeriodOf`、`DaysInMonth`、`WeekStartOf(date, weekStartsOn)`、`WeeksIntersecting(period, weekStartsOn)`、`AsOfForPeriod`、`RemainingDays`、`RemainingWeeks`、`ShiftDateToPeriod`、`Today()`（服务器本地日历日）。
- 计算：`DayTotal`（Σ duration_min）、`CountStreak(recorded, today)`、`Percent`、`SuggestedQuota`、`ComputeGoalProgress`（COUNT=Σqty/target、CHECKLIST=done/total、reached=达标）、`PreviewCountSplit`、`BuildWeeks`（每周实际 vs 计划）、`ExamCountdown`、`PhaseFraction`、`PhaseTicks`。
- **与旧实现的两处有意差异**（以 data-model §5 为准）：① streak「今天无记录则从昨天起算」（旧实现今天缺失返回 0）；② `PreviewCountSplit` 的周数用 `WeeksIntersecting`（旧前端 `ceil(days/7)` 是近似）。用例 JSON 钉死。
- `testdata/domain-cases.json`：`{cases:[{fn,input,want}]}`，Go test 解析执行；M3-5 前端 vitest 复用同一文件。

### M2-3 sqlc

- `apps/server/sqlc.yaml`：engine sqlite，schema=`db/migrations`（全量建表来源），queries=`db/queries/*.sql`，gen → `internal/db`（package `db`，与 `db.go` 共存），`emit_json_tags` + `emit_pointers_for_null_types`。
- `db/queries/`：settings / subjects / states / days / entries / goals / tasks / checkins / search / export-import 复用列表查询。user/session 仍走 `internal/auth` 手写 SQL（M1 已测，不动）。focus_session/score 建表但暂不写 queries（无 API，M7/M8 再加）。
- 生成产物 `internal/db/{models,querier,*}.sql.go` 入库；verify.sh 增加「sqlc 存在则 generate + git diff 校验」。

### M2-4 路由（全部挂 `/api/v1` + requireAuth + 首次种子）

``
GET/PATCH            /settings
GET/POST             /subjects   PATCH /subjects/:id   POST /subjects/:id/archive
GET/POST             /states     PATCH /states/:id     POST /states/:id/archive
GET                  /days?from&to          （日历聚合）
GET/PATCH/DELETE     /days/:date            （state/diary patch；删日连 entries）
POST                 /entries   PATCH/DELETE /entries/:id   POST /entries/reorder
GET                  /goals?period=         （含进度 + dayMarks，同旧 GoalMonthDTO）
GET                  /goals/today?date=     （保留旧 today 聚合，server 权威）
POST                 /goals   GET/PATCH/DELETE /goals/:id   POST /goals/:id/carry-over
POST                 /goals/:id/tasks   PATCH/DELETE /tasks/:id
POST                 /tasks/:id/complete|uncomplete   （complete 可 createEntry 生成 entry 并回填 entry_id）
PUT/DELETE           /goals/:id/checkins/:date         （同上 entry_id 单向引用）
GET                  /search?q=&type=all|entry|diary
GET                  /stats/month|year|heatmap   GET /streak
GET                  /export（v3 全量）   POST /import（v3 原生 + 兼容 v2{records,customMoods} + v1 数组）
```

要点：
- **patch 语义**：所有 PATCH/PUT 字段缺省=不改；`stateId`/`dueDate` 等可空字段显式 null/空串=清除（JSON 层用 RawMessage/指针区分缺省与 null）。
- **进度读时算**：goal summary/detail 的 percent/reached/suggested*/weeks 全部由 domain 现算，不落库。
- **P6 修正**：task/checkin 完成可选 `createEntry` 生成真实 `entry` 行并写 `entry_id`；取消/删除只断引用（entry 保留），不再回写伪学习条目。
- **carry-over**：复制 goal 到下一 period；CHECKLIST 只带未完成任务并平移 dueDate/weekStart（沿用 `shiftDateToPeriod`，月份天数不足时截断）。
- **import**：v3 按主键幂等 upsert（保留 id）；subjects/states 建「文件 id → 库 id」映射重写引用，UNIQUE(name)/(builtin_key) 冲突时映射到既有行；v2 records→day+entry（note 首行→title，其余→note；subject 文本 get-or-create）、customMoods→state；心情值 builtin_key 直通、custom nanoid 须已存在否则整批回滚（同旧校验）。单事务。
- **export v3**：`{version:3,exportedAt,settings,subjects,states,days[+entries],goals[+tasks+checkins]}`；focus_session/score 暂无 API 不导出（M7/M8 再纳入）。
- **user_id** 只从 session principal 取；task/checkin 无 user_id 列，查询一律 JOIN goal 校验归属。
- 错误统一 `{code,message}`；码表补进 `data-model.md` §4 末（JOURNAL_* 语义沿用 + 通用码）。

### M2-5 settings + 种子

- `GET /settings`：无行则按列默认 INSERT 再读（幂等）；`PATCH` 读改写全量 upsert（单行资源）。
- 校验：daily_goal_min 1–1440、week_starts_on 1–7、focus/break_min 1–240、exam_date/phase_start YYYY-MM-DD 或 null、theme/exam_name 长度上限。
- **首次种子**（requireAuth 后的 ensure 中间件，幂等）：state 表 `INSERT OR IGNORE` 6 个内置（builtin_key=inspired/happy/calm/tired/anxious/sad）；subject 表 count=0 时种 4 科（数学一 #1E4FA3、408 #2F6B4F、英语一 #B07A12、政治 #D23B22，取自 SPEC-B §1/§3）。
- 内置状态（label 取考研语义，color 取 SPEC-B §2 solid，polarity 按 §6）：inspired→专注 #D23B22 +1；happy→顺利 #C2571A +1；calm→平稳 #1E4FA3 0；tired→疲惫 #8D919A -1；anxious→焦虑 #B07A12 -1；sad→低落 #5E5A8C -1。sort 按专注/顺利/平稳/疲惫/焦虑/低落序。
- `setting.theme` 默认值沿用 0001 的 `graphite` 占位，真实主题 id M6 定稿时再调（本卡不改）。

## 验收

- `./scripts/verify.sh` 全绿（含 sqlc generate diff 校验）。
- `go test ./...`：migrate 幂等+孤儿外键失败；domain 用例全绿；httpapi httptest 覆盖每端点 happy + 主要错误路径（401 未登录、404、400 校验、409 冲突、patch 语义、进度读时算、carry-over、import v1/v2/v3）。
- 手工冒烟：`go run ./cmd/journal-server` → create-user → login → POST subjects/states 之外走种子 → 记一天（PATCH day + POST entry）→ GET /days/:date 聚合正确 → 建 COUNT 目标打卡 → 进度字段正确 → export→import 往返一致。
- `git diff --cached | rg -i 'key|secret|password|token'` 自查。

## 后续方向

- M3：前端 `lib/api.ts/goalApi.ts/http.ts/types` 换 `/api/v1` + Cookie；`src/lib/domain.ts` 镜像跑同一 `domain-cases.json`（vitest）。
- M4-1 `cmd/import-mysite`：MySQL `sj_*` → SQLite v3，复用本卡 import 的映射思路（§6）。
- FTS5 搜索、focus_session/score API、derivePalette 服务端化：按需后置。

## Resolution（2026-11-15 完成）

- M2-1：`db/migrations/0002_v3.sql` 建齐 subject/state/day/entry/focus_session/goal/goal_task/goal_checkin/score 9 表+索引，`migrate_test` 覆盖幂等重跑与孤儿外键失败。
- M2-2：`internal/domain` 落地全部纯函数（dates/progress/streak/stats/exam/tasks），`testdata/domain-cases.json` 45 用例 go test 全绿；`TaskRelevantOn` 为 isTodayTask 的服务端移植。
- M2-3：`sqlc.yaml` + `db/queries/*.sql` 七组查询；生成产物入库。**坑**：sqlc sqlite 解析器不吃查询文件里的中文注释、`LIKE ... ESCAPE`、`UNION`、`json_each(sqlc.arg())`——已分别改为英文注释、`instr()`、拆查询、period 维度联查。
- M2-4：`/api/v1` 全资源路由（journal.go 注册 + meta/days/goals/tasks/checkins/misc/import 七个 handler 文件）；patch 三态语义用泛型 `optional[T]`；进度/打卡/streak/日聚合读时算；carry-over 平移未完成任务；export 为裸 JSON 文件，import 单事务兼容 v3/v2/v1。
- M2-5：settings GET/PATCH + 列默认兜底 + requireAuth 后 ensureBootstrap 种子（6 内置状态 polarity ±1/0、4 科目）。
- 已知取舍：goal period 不可 PATCH（用 carry-over）；DELETE /goals 与 /archive 均为软删（status=ARCHIVED）；archive 目前单向；export 不含 focus_session/score（无 API，M7/M8）；stats/search 为 v3 新形状，M3 前端适配。
- 走查修复（84b616f）：`completeTask` 空 body EOF 路径双写响应（400+200 拼接）、`putCheckin` 建 entry 日期应落打卡日、statsMonth/computeSummary N+1、dayMark stateId 类型统一 null、import entry 主键碰撞兜底。
- 验证：`./scripts/verify.sh` 全绿（verify.sh 新增 sqlc generate 一致性校验）。
