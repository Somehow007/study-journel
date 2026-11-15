# 11-15-m3-frontend-api

## 问题 / 目标

按 `docs/roadmap.md` M3 五张任务卡，把 `apps/web` 前端从旧「Spring `/api/journal` + 博客 JWT + IndexedDB」切换到新 Go `/api/v1` + Cookie 会话 + 服务端 settings + v3 数据模型：

- M3-1 `lib/types/api.ts`（按 data-model.md §3/§4 手写镜像）+ `lib/api.ts`/`goalApi.ts` 重写；`http.ts` 改 Cookie 模式（`credentials:'include'`，去 JWT refresh）
- M3-2 `auth.ts` 改 `/auth/me` 判定；登录页用户名密码；登出清 session
- M3-3 移除 Dexie/`db.ts`（旧数据走 M4 服务端迁移）；`VITE_API_BASE` 接入
- M3-4 TanStack Query 接入（records/goals/settings），页面逐个迁移；乐观更新保留
- M3-5 `src/lib/domain.ts` 展示预览纯函数 + vitest 跑 `testdata/domain-cases.json`

命中 AGENTS §2「鉴权与会话 / 契约与领域层 / 依赖（TanStack Query、vitest、移除 dexie）」，先记方案再动手。

## 消费点（rg 全量清单）

**被改/被删文件的全部消费方：**

| 文件 | 消费方 |
|---|---|
| `lib/http.ts`（JWT→Cookie） | `App.tsx`（FORBIDDEN_EVENT/getToken）、`LoginPage`（loginWithPassword）、`lib/api.ts`、`lib/goalApi.ts`、`lib/auth.ts` |
| `lib/auth.ts`（JWT decode→/auth/me） | `App.tsx`（isJournalAdmin）、`SiteTopBar`（getDisplayName） |
| `lib/api.ts`（records/moods→days/entries/states） | `TodayDetail`、`MonthView`、`Memory`、`Stats`、`AnnualReview`、`Search`、`Settings`、`MoodEditModal`、`useDataIO`、`moodUtils` |
| `lib/goalApi.ts` | `MonthView`、`PlanView`、`GoalDetail`、`TodayGoalsSection`、`GoalFormModal`（previewCountSplit） |
| `lib/db.ts`（Dexie） | `useDataIO`（exportLocalData）、`lib/api.ts`（仅注释） |
| `lib/useApiQuery.ts` + `journalEvents.ts` | 8 个页面/组件（TodayGoalsSection、MonthView、TodayDetail、PlanView、GoalDetail、Memory、Stats、AnnualReview、Search、Settings） |
| `lib/moodUtils.ts` + `lib/constants.ts`（MOOD_CONFIGS） | `DateCard`、`MoodSelector`、`MoodEditModal`、`MonthView`、`TodayDetail`、`Memory`、`Stats`、`AnnualReview`、`Search` |
| `lib/streak.ts`（computeStreak） | `TodayDetail` |
| `types/index.ts` + `types/goal.ts` | 全部页面/组件（DayRecord/LearningItem/MoodConfig/CustomMoodConfig/Goal*） |
| `components/MoodEditModal.tsx` | `Settings` |
| `vite.config.ts` proxy | `/api`→8081（旧 Spring）、`/v1`→8081（博客 JWT 登录） |

**契约源（只读）：** `apps/server/internal/httpapi/*.go` DTO、`internal/domain/*.go`、`docs/data-model.md` §3–§5、`docs/architecture.md` §6。

## 方案

### A. 契约层（commit 1，纯新增不破坏现状）

1. `src/lib/types/api.ts`：手写镜像全部 Go DTO（Subject/State/Setting/DayMark/DayDetail/Entry/Task/Checkin/GoalSummary/GoalDetail/GoalMonth/TodayGoals/Stats*/SearchResult/Export/ImportStats/User）。可空字段按 Go `*T`/`omitempty` 标 `| null`/`?`。
2. `src/lib/domain.ts`：`internal/domain` 全量镜像（日期/周期/周/进度/分解/考试倒计时/streak/taskRelevantOn），UTC 日历日运算与 Go `time.Parse` 语义对齐（含 2/30 非法日期拒绝）。
3. `src/lib/domain.test.ts`：vitest 读 `testdata/domain-cases.json`，复刻 Go `domain_test.go` 的 fn 分发 + batch input + 1e-4 容差比较。
4. `package.json`：+`vitest`（dev）、+`@tanstack/react-query`；script `test: vitest run`；`verify.sh` 加 `pnpm -F web test`。

### B. 切换层（commit 2，原子切换）

5. `lib/http.ts` 重写：`API_BASE = VITE_API_BASE ?? '/api'`；`apiFetch` 走 `${API_BASE}/v1` + `credentials:'include'`；包络 `{code,message,data}` 解包；401（非 /auth/*）→ POST /auth/logout 后 `location.assign(BASE_URL)`（去重）；删除 JWT/refresh/FORBIDDEN_EVENT/读 storage。
6. `lib/auth.ts` 重写：`fetchMe()`→`/auth/me`（401→null）、`login()`、`logout()`、模块级缓存 username 供 `getDisplayName()`（SiteTopBar）。
7. `lib/api.ts`/`goalApi.ts` 重写：days/entries/subjects/states/settings/search/stats/streak/export/import + goals/tasks/checkins 全部映射到真实路由；返回新 DTO；写操作不再 emit 事件（RQ invalidate 取代）。
8. `lib/queries.ts`（新）：queryKey 常量 + useQuery 薄封装（settings/states/subjects/day/dayMarks/goals/goal/todayGoals/search/stats/streak/me）+ `invalidateAll(qc)`。
9. `AppContext`：`dailyGoalMin` 改读 settings 查询；`setDailyGoalMin` → PATCH /settings 乐观更新；首登把 localStorage 旧值上报一次（flag `study-journal-settings-migrated`）；theme 维持 localStorage（M6 才入 setting.theme）。me 查询放 provider，`enabled` 门禁防登录页误请求。
10. `App.tsx`：会话门禁改 `useApp().user`（undefined=初始化中→loader；null→LoginPage）；删 FORBIDDEN/ForbiddenPage；`main.tsx` 加 QueryClientProvider。
11. `lib/stateUtils.ts`（moodUtils 改名重写）：`State→StateConfig`（solid=state.color，ink/tint/dark=generateMoodPalette 派生）；`useStateConfigs/useStateConfig/useCustomStateConfigs`；constants.ts 的 MOOD_CONFIGS/MOOD_LIST 删除（内置态来自服务端种子），SUBJECT_COLORS/WEEKDAY/MONTH_LABELS 保留。
12. 组件迁移：MoodSelector→按 stateId 选；MoodEditModal→StateEditModal（label/color/polarity，无 emoji）；LearningFormModal→科目下拉（subjects）+可新建科目（name+color→先 POST /subjects）；LearningRecordCard→entry 形状；DateCard→stateId+stateConfig+diaryPreview；TodayGoalsSection→新 task/checkin DTO + complete/uncomplete/createEntry；GoalFormModal→+subjectId 选择 + previewCountSplit 新签名（weekStartsOn）；GoalCompleteSheet→syncLearning→createEntry；useDataIO→仅 export/import（v3 原生 + 服务端兼容 v1/v2），删 migrate-local；LoginPage→/auth/login。
13. 页面迁移：MonthView=`/days?from&to` 单请求（含 taskDone/taskTotal）；TodayDetail=`/days/{date}` + entry/state/diary 变更；PlanView=`/goals?period`；GoalDetail=`/goals/{id}`（weeks 服务端给）；Memory/AnnualReview=`/export` 客户端派生（整史视图避免 N+1）；Stats=`/stats/month` + `/days` 区间取每日 state 染色；Search=`/search?q`（days+entries 两组）；Settings=theme/dailyGoalMin/自定义状态 CRUD/数据 IO/退出登录。
14. 删除：`lib/db.ts`、`lib/journalEvents.ts`、`lib/useApiQuery.ts`、`lib/streak.ts`、`lib/constants.ts`（MOOD 部分）、`types/index.ts`、`types/goal.ts`、`components/ForbiddenPage.tsx`；`vite.config.ts` `/api`→`http://localhost:8090`，`/v1` 保留→8081（SiteTopBar 博客标题，catch 兜底）；package.json 移除 dexie/dexie-react-hooks。
15. `pnpm -F web typecheck` 过 → commit 2；跑 `./scripts/verify.sh` → 手动 1440/390 检查 → MAP/CHANGES/归档 → commit 3（docs）。

### 关键取舍

- **乐观更新**：day patch（state/diary）、entry 增删、goal task/checkin 沿用 setQueryData 乐观 + rollback；其余写后 `invalidateAll`（对齐旧 emitJournalChanged 全量刷新语义）。
- **stats/整史页**：`/stats/month` 覆盖 Stats；Memory/AnnualReview 用 `/export`（单用户数据量小，避免逐日 N+1）。
- **streak 语义变化**：v3「今天无记录从昨天起算」与旧实现不同，以 `/streak` 服务端值为准，`computeStreak` 删除。
- **自定义状态无 emoji**：v3 state 只有 label/color/polarity；UI emoji 位移除，预览色由 generateMoodPalette 派生。
- **entry.title 服务端派生**：表单只给 subject/duration/note，title 留空由服务端 entryTitle 生成（可显式传）。
- **主题**：M3 不动主题体系（仍 blog theme localStorage + BLOG_THEME_KEY 共享）；setting.theme 上线切换留 M6。

## 验证

- `pnpm -F web test`：domain-cases.json 全用例通过（Go/TS 同文件）。
- `./scripts/verify.sh`：typecheck + build + gofmt/vet/test + sqlc 一致性。
- 手动：起 `go run ./cmd/server`(:8090) + `pnpm -F web dev`(:5174)，登录→9 页面走查；1440/390 各看一遍；grep 无 dexie/JWT 残留。

## 后续方向（不在本卡）

- M4：mysite sj_* → v3 迁移 + 部署切换；IndexedDB 兜底已删，旧数据只走服务端迁移。
- M6：B 格纸 UI + setting.theme 三主题切换。
- M7：focus_session/score、settings 考试信息 UI、科目预设进 goal。

## Resolution

**状态：代码完成并提交（`e3a503a` 契约层 + `d374daa` 原子切换），自动化验证全绿；1440/390 视觉走查待 owner 确认后归档。**

### 验证结论

- `pnpm -F web typecheck`：通过（补 `src/vite-env.d.ts` 提供 `import.meta.env` 类型）。
- `pnpm -F web test`：vitest 46 用例全过（`testdata/domain-cases.json` 双端同文件）。
- `pnpm -F web build`：通过（`tsc && vite build`，产物 764KB gzip 227KB）。
- `./scripts/verify.sh`：全绿（web typecheck+build + server gofmt/vet/test + sqlc 一致性）。
- 运行时冒烟：`journal-server -db /tmp/journal-smoke.db`(:8090) + `pnpm dev`(:5175) → `vite proxy /api→8090` 端到端验证：`/journal/` 200、`/` 302→`/journal/`、`POST /api/v1/auth/login` 种 Cookie、`GET /auth/me`、`/settings`、`/days?from&to` 均返回 `{code:"0",data}` 包络。
- 残留检查：`rg` 无 `DayRecord|LearningItem|getRecordsBy|useApiQuery|journalEvents|customMoods|moodUtils|from './db'` 引用（仅 `legacyIdb.ts`/`useDataIO.ts` 迁移路径与 api.ts 注释）；localStorage 仅剩主题 key、diary-only UI 偏好、settings 迁移 flag。

### 与方案的偏差

- Dexie 已删；`legacyIdb.ts`（原生 IndexedDB 读取，非 Dexie）保留作一次性迁移兜底——比方案更保守，旧数据不丢。
- `vite-plugin-pwa` 仍在 devDeps 未用（vite.config 早已移除）；清理留作独立小任务。
- commit 拆分与方案一致：A=契约层（`e3a503a`）、B=原子切换（`d374daa`）；docs/归档随走查确认后补。

### 待办（走查后）

- owner 在 1440/390 宽度走查 9 页面 + 登录/登出/导入导出。
- 归档本任务目录 → `.trellis/tasks/archive/2026-11/`，CHANGES 补归档行。
