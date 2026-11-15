# 手帐 · 项目地图（现状，2026-11-15）

> 仓库位置：`/Users/somehow/dev/code/Java/GitHub/study-journey`，与 mysite 仓库平级（`../mysite`）。
> 描述**当前**代码的真实状态（剥离前，后端仍在 `../mysite` 的 `io.github.somehow.mysite.journal`）。目标形态见 `architecture.md`；冲突时以代码为准，并顺手修本文件。

## 1. 一句话

学习手帐（原名「花期 Blossom」，v6 起转向考研场景）：React 18 SPA，部署在博客域名子路径 `/journal/`；后端仍在 mysite 仓库（`../mysite`）（`io.github.somehow.mysite.journal`，`/api/journal/*`，MySQL `sj_*` 7 表），登录复用博客 JWT。**M1 起 `apps/server` 已有 Go 骨架**（chi + SQLite + 独立账号，`:8090`，尚未接管流量）。剥离计划见 `separation-plan.md`。

## 2. 目录

| 路径 | 内容 |
|---|---|
| `apps/web/src/main.tsx` `apps/web/src/App.tsx` | 入口；`BrowserRouter basename="/journal"`；登录/403/加载动画闸门 |
| `apps/web/src/pages/` | 9 页：MonthView(`/`) TodayDetail(`/day/:date`) PlanView(`/plan`) GoalDetail(`/plan/:goalId`) Memory Stats AnnualReview Search Settings |
| `apps/web/src/components/` | 业务组件（LearningFormModal、GoalFormModal、DiaryEditor、MoodSelector、DateCard…）+ `ui/`（Sheet、Pressable、ConfirmDialog） |
| `apps/web/src/lib/http.ts` | fetch 封装：`/api/journal` 前缀、博客 `Result{code,data}` 解包、401 自动 `/v1/auth/refresh` |
| `apps/web/src/lib/api.ts` `apps/web/src/lib/goalApi.ts` | 记录/心情/导入导出 与 目标/子任务/打卡 接口函数 |
| `apps/web/src/lib/auth.ts` | 解析博客 JWT 判定 ADMIN |
| `apps/web/src/lib/db.ts` | Dexie（IndexedDB）——仅用于「迁移本地旧数据」兜底 |
| `apps/web/src/lib/theme.ts` `apps/web/src/styles/themes/` | 复用博客 8 套主题（`data-theme`，key `mysite_theme_v2`）；`index.css` 把博客变量别名为 `--paper/--ink/--brand…` |
| `apps/web/src/lib/constants.ts` | `MOOD_CONFIGS`（6 心情三档色）、`SUBJECT_COLORS` |
| `apps/web/src/context/AppContext.tsx` | 当前月份、主题、`dailyGoalMin`（localStorage） |
| `apps/server/` | Go module `journal`（M1 骨架）：`cmd/journal-server`（serve + `create-user` 子命令）、`internal/{httpapi,auth,db,migrate,id}`、`db/migrations/*.sql`（embed） |
| `design/` | `mockup.html`（v5 走查稿）、`concepts/`（来源不明的早期草稿 data.js，未跟踪）、**`concepts-v6/`（考研向 UI 概念稿 A/B/C + SPEC，2026-11-15）** |
| `docs/` | 本目录：MAP / architecture / data-model / separation-plan / roadmap |
| 根目录两份中文 md | `🌸…开发设计文档 v5.0.md`（花期视觉规范，**已被 v6 取代，仅作历史**）、`📔…MySQL 存储方案 v2.0.md`（第二期后端化方案，**将被 data-model v3 取代**） |

## 3. 命令

| 命令 | 说明 |
|---|---|
| `pnpm dev`（=`pnpm -F web dev`） | Vite 5174，`/api`→8081、`/v1`→8081（需本地 mysite 后端 + localStorage 放博客 token） |
| `pnpm build`（=`pnpm -F web build`） | `tsc && vite build`，产物 `apps/web/dist/`（base `/journal/`） |
| `./scripts/verify.sh` | web typecheck+build + server `gofmt`/`go vet`/`go test` |
| `cd apps/server && go run ./cmd/journal-server` | Go 服务 `127.0.0.1:8090`；先 `go run ./cmd/journal-server create-user -username <名>` 建账号 |

## 4. 部署（现状）

由 **mysite** `deploy/server-deploy.sh` 顺带完成：服务器 `~/project/study-journey` git pull → `npm install && npm run build` → rsync 到 `/var/www/journal/`；nginx `location /journal/` alias 静态目录，`/api/` 反代 mysite 8081。

## 5. 已知漂移 / 坑

- **M1–M4 期间不要跑 mysite `deploy/server-deploy.sh`**：其手帐段 `cd $JOURNAL_DIR && npm install && npm run build` + 校验 `dist/index.html` 与新布局（pnpm workspace、`apps/web/dist`）不兼容，会让整个部署中断；改造归 M4-2。前端在此窗口冻结不上线。
- Go 模块下载：本机直连 `proxy.golang.org` 超时，已 `go env -w GOPROXY=https://goproxy.cn,direct`；新环境需同样设置。
- `apps/web/package.json` 仍含 `vite-plugin-pwa` 依赖，但 vite 配置已移除 PWA（子路径 SW 冲突）。
- 前端零测试；`playwright` 已装仅用于 `design/verify-*.mjs` 截图（脚本内 `localhost:5173` 已漂移，实际 dev 端口 5174）。
- 远端仓库名拼写为 `study-journel`（GitHub `Somehow007/study-journel`），本地目录名 `study-journey`。
