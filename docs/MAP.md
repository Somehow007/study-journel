# 手帐 · 项目地图（现状，2026-11-16）

> 仓库位置：`/Users/somehow/dev/code/Java/GitHub/study-journey`，与 mysite 仓库平级（`../mysite`）。
> 描述**当前**代码的真实状态。目标形态见 `architecture.md`；冲突时以代码为准，并顺手修本文件。

## 1. 一句话

学习手帐（原名「花期 Blossom」，v6 起转向考研场景）：React 18 SPA，部署在 `/journal/` 子路径；**M3 起前端已切到 `apps/server` Go 服务**（chi + sqlc + SQLite，`/api/v1`，Cookie 会话 `sj_session`，独立用户名/密码账号，`:8090`）。**M4-1/M4-2 已交付** MySQL `sj_*`→SQLite 迁移器（`cmd/import-mysite` + `internal/importer`，逐项对账）与独立部署物料（`deploy/`），M4-3 首发切流待 owner 按 `deploy/CUTOVER.md` 执行。**M6 B 格纸 UI 已落地**（P1–P5，11-16）：默认主题换成 `journal-notebook` 明暗双主题（米白/夜间墨蓝），`nb-` 组件类全量页面格纸化。旧链路（mysite Spring `/api/journal/*` + 博客 JWT + Dexie IndexedDB）已整体移除，仅保留 `legacyIdb.ts` 供一次性迁移旧本地数据。剥离计划见 `separation-plan.md`。

## 2. 目录

| 路径 | 内容 |
|---|---|
| `apps/web/src/main.tsx` `apps/web/src/App.tsx` | 入口；`BrowserRouter basename="/journal"`；登录/403/加载动画闸门 |
| `apps/web/src/pages/` | 9 页：MonthView(`/`) TodayDetail(`/day/:date`) PlanView(`/plan`) GoalDetail(`/plan/:goalId`) Memory Stats AnnualReview Search Settings |
| `apps/web/src/components/` | 业务组件（LearningFormModal、GoalFormModal、DiaryEditor、MoodSelector(按 stateId)、StateEditModal、NotebookNav(顶栏/页头/印章)、CalGrid(月历格共享)、LoginPage…）+ `ui/`（Sheet、Pressable、ConfirmDialog）；全部页面已 nb- 格纸化，设计源 `design/concepts-v6/SPEC-B.md` |
| `apps/web/src/lib/http.ts` | fetch 封装：`${VITE_API_BASE ?? '/api'}/v1` 前缀、`credentials:'include'`、`{code,data}` 包络解包、401→logout+回登录页 |
| `apps/web/src/lib/auth.ts` | `/auth/me` 会话判定、login/logout、username 缓存 |
| `apps/web/src/lib/api.ts` `apps/web/src/lib/goalApi.ts` | v3 days/entries/subjects/states/settings/search/stats/streak/export/import 与 goals/tasks/checkins 接口函数 |
| `apps/web/src/lib/queries.ts` | TanStack Query queryKey + useQuery 薄封装 + `invalidateAll` |
| `apps/web/src/lib/stateUtils.ts` | v3 `JournalState`→`StateConfig` 适配（色板派生自 state.color） |
| `apps/web/src/lib/domain.ts` + `domain.test.ts` | `internal/domain` TS 镜像 + vitest（`testdata/domain-cases.json` 双端同用例，46 条） |
| `apps/web/src/lib/legacyIdb.ts` | 读旧 Dexie `StudyJournalDB`（仅 `useDataIO` 一次性迁移用） |
| `apps/web/src/lib/theme.ts` `apps/web/src/styles/themes/journal-notebook.css` | M6 起仅 `journal-notebook`/`journal-notebook-dark` 两主题（`data-theme=journal-<id>`）；`index.css` 把主题变量别名为 `--paper/--ink/--brand…` + `--font-title/--font-num/--rule-dash/--margin-line/--nb-desk/--nb-cover`；`journal-b.css` 为 nb- 组件类全量样式 |
| `apps/web/src/styles/journal-b.css` | B 格纸组件类（`nb-book/nb-page/nb-date/nb-sec/nb-table/nb-meter/nb-kv/nb-note/nb-chip/nb-field/nb-btn/nb-cal/nb-goal/nb-todo/nb-zheng/nb-stamp/nb-pager/nb-bars/nb-heat/nb-set/nb-search/nb-hit/nb-login…`），只消费主题别名变量，暗色自动切换 |
| `apps/web/src/lib/constants.ts` | `SUBJECT_COLORS`、`WEEKDAY`/`MONTH_LABELS`（MOOD 配置已删，内置状态由服务端种子下发） |
| `apps/web/src/context/AppContext.tsx` | 会话门禁（user undefined/null）、主题（服务端 `settings.theme` 为准+localStorage `study-journal-theme` 首帧缓存）、settings 查询（dailyGoalMin/examName/examDate/theme）+ `setDailyGoalMin`/`patchSettings` 通用写入 + 首登旧值上报 |
| `apps/server/` | Go module `journal`（M2 数据层+API）：`cmd/journal-server`（serve + `create-user` + `backup`）、`cmd/import-mysite`（M4-1 MySQL sj_*→SQLite 迁移 CLI）、`internal/{httpapi,auth,db(domain 生成码+Open),domain,migrate,id,bootstrap(首登种子),importer(M4-1)}`、`db/migrations/*.sql`（embed，0001 账号三表 + 0002 业务九表）、`db/queries/*.sql`（sqlc 输入）、`sqlc.yaml` |
| `deploy/` | M4-2 部署物料：`deploy.sh`（本地交叉编译+推送，`--skip-web/--skip-go` 分阶段）、`journal.service`、`nginx/journal-api.conf`（`/journal/api/`→`127.0.0.1:8090/api/`）、`CUTOVER.md`（M4-3 首发 + M4-4 回滚 runbook） |
| `design/` | `mockup.html`（v5 走查稿）、`concepts/`（来源不明的早期草稿 data.js，未跟踪）、**`concepts-v6/`（考研向 UI 概念稿 A/B/C + SPEC，2026-11-15）** |
| `docs/` | 本目录：MAP / architecture / data-model / separation-plan / roadmap |
| 根目录两份中文 md | `🌸…开发设计文档 v5.0.md`（花期视觉规范，**已被 v6 取代，仅作历史**）、`📔…MySQL 存储方案 v2.0.md`（第二期后端化方案，**将被 data-model v3 取代**） |

## 3. 命令

| 命令 | 说明 |
|---|---|
| `pnpm dev`（=`pnpm -F web dev`） | Vite 5174，`/api`→`localhost:8090`（Go 手帐服务）、`/v1`→8081（仅顶栏博客站点名，可选） |
| `pnpm -F web test` | vitest：`lib/domain.test.ts` 跑 `testdata/domain-cases.json` 全部用例 |
| `pnpm build`（=`pnpm -F web build`） | `tsc && vite build`，产物 `apps/web/dist/`（base `/journal/`） |
| `./scripts/verify.sh` | web typecheck+build + server `gofmt`/`go vet`/`go test` |
| `cd apps/server && go run ./cmd/journal-server` | Go 服务 `127.0.0.1:8090`；先 `go run ./cmd/journal-server create-user -username <名>` 建账号 |
| `go run ./cmd/journal-server backup -db <path>` | `VACUUM INTO` 一致性快照（默认 `<db>.bak-<ts>`，已存在则拒绝） |
| `go run ./cmd/import-mysite -db <sqlite> -mysql-dsn '...' [-dry-run]` | M4-1 迁移：MySQL `sj_*`→SQLite v3 + 对账报告（差异 exit 1）；详见 `cmd/import-mysite` 头注释与 `deploy/CUTOVER.md` |
| `JOURNAL_SERVER=user@host ./deploy/deploy.sh [--skip-web\|--skip-go]` | M4-2 部署：本地构建（web `VITE_API_BASE=/journal/api` + Go 交叉编译 CGO_ENABLED=0）→ rsync `/var/www/journal/` + `/opt/journal/` + systemctl；需免密 sudo |
| `cd apps/server && ~/go/bin/sqlc generate` | 重新生成 `internal/db`（sqlc v1.30.0，`sqlc.yaml`）；verify.sh 会校验生成物与仓库一致 |

## 4. 部署（现状）

**目标形态已交付，尚未切流**：`deploy/deploy.sh` 在本机完成 web 生产构建（`VITE_API_BASE=/journal/api`）+ Go 交叉编译（`CGO_ENABLED=0`）→ rsync 前端到 `/var/www/journal/`、二进制到 `/opt/journal/` → `journal.service`（systemd，`127.0.0.1:8090`，SQLite `/var/lib/journal/journal.db`）。nginx 需在 mysite.conf 的 443+8080 两个 server 块加 `deploy/nginx/journal-api.conf` 的 `/journal/api/` 反代。**M4-3 首发与 M4-4 回滚步骤见 `deploy/CUTOVER.md`**；执行前线上仍是 mysite `deploy/server-deploy.sh` 的旧链路（Spring `/api/journal` + 静态前端）。

## 5. 已知漂移 / 坑

- **M4-3 切流完成前不要跑 mysite `deploy/server-deploy.sh`**：其手帐段 `cd $JOURNAL_DIR && npm install && npm run build` + 校验 `dist/index.html` 与新布局（pnpm workspace、`apps/web/dist`）不兼容，会让整个部署中断；且它会用旧前端覆盖 `/var/www/journal`。替代物是本仓库 `deploy/deploy.sh`（M4-2 已交付）。M5 清理 mysite 手帐段后此坑消除。
- Go 模块下载：本机直连 `proxy.golang.org` 超时，已 `go env -w GOPROXY=https://goproxy.cn,direct`；新环境需同样设置。
- `apps/web/package.json` 仍含 `vite-plugin-pwa` 依赖，但 vite 配置已移除 PWA（子路径 SW 冲突）。
- `lib/domain.ts` 仅作展示预览；业务计算唯一权威在 `apps/server/internal/domain`，两侧用 `testdata/domain-cases.json` 同一组用例对齐。
- ~~主题仍走博客主题体系~~ **M6 已解决**：`journal-notebook`/`journal-notebook-dark` 双主题，`data-theme=journal-<id>`，localStorage key `study-journal-theme` 仅作登录前首帧缓存，`settings.theme` 服务端为准；博客 8 主题已删除。
- 远端仓库名拼写为 `study-journel`（GitHub `Somehow007/study-journel`），本地目录名 `study-journey`。
