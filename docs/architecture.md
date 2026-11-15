# 架构决策：技术栈与目标形态（ADR-001）

> 2026-11-15 建立，**同日 owner 拍板定稿**：
> - **D1 后端 = Go**（弃用原 Hono/TS 全栈推荐）
> - **D2 数据库 = SQLite**（`modernc.org/sqlite` 纯 Go 驱动）
> - **D3 鉴权 = 手帐独立账号**（不再复用博客 JWT）
> - **D5 UI = B 格纸先落地为默认主题**；A 石墨 / C 夜读保留概念稿，上线稳定后作为扩展主题做
>
> 执行细节以 `roadmap.md` 任务卡为准；本文是决策依据。

## 1. 现状事实（2026-11-15 核验）

| 事实 | 证据 |
|---|---|
| 手帐 = 独立仓库 `../study-journey`（平级兄弟仓库），前端 React18+Vite+TS+Tailwind，9 页 | `git remote -v`、`docs/MAP.md` |
| 后端仍在 mysite：`io.github.somehow.mysite.journal`，`/api/journal/*`，MySQL `sj_*` 7 表，仅 ADMIN | `docs/MAP.md` §1 |
| 服务器 ~1.9G 内存，Phase1 处置后 available≈550M；MySite JVM `-Xmx512m`；qqbot harness 用系统 Node 18 | mysite `.trellis` 11-14 任务、SSH 实测 |
| 服务器已有 `node v18.19.1`（apt） | SSH 实测 |
| 手帐 API 现状：记录 CRUD/导入导出/搜索/连续/streak、心情（含自定义）、月目标（COUNT/CHECKLIST）+子任务+打卡+结转 | mysite journal 模块 |

## 2. 技术栈定稿

**单仓双运行时：`apps/web` React SPA + `apps/server` Go 单静态二进制 + SQLite 单文件。**

| 层 | 选型 | 理由 |
|---|---|---|
| 前端框架 | React 18 + Vite + TS + Tailwind（**保留**） | 现有 9 页/30+ 组件可平移；概念稿已按此出图 |
| 前端数据层 | TanStack Query 5（M3 引入） | 服务端状态缓存/失效/乐观更新 |
| 后端语言 | **Go**（go.mod `go 1.23` 起步，CI 用稳定版） | 单二进制部署、RSS <30M、2G 服务器友好、并发模型简单 |
| HTTP 路由 | `github.com/go-chi/chi/v5` | 轻量、贴近 stdlib、中间件生态成熟 |
| 数据访问 | `database/sql` + **sqlc**（`db/queries/*.sql` → 生成类型安全 Go） | SQL 显式可审计；便宜模型不容易写出 ORM 魔法 bug |
| SQLite 驱动 | **`modernc.org/sqlite`**（纯 Go） | `CGO_ENABLED=0` → `GOOS=linux GOARCH=amd64 go build` 出单文件二进制，服务器**零运行时依赖**（不装 Node/Java） |
| 迁移 | `db/migrations/NNNN_name.sql` 编号文件 + `PRAGMA user_version` runner（自研 ~60 行） | 无外部依赖；迁移可重复执行 |
| 鉴权 | `golang.org/x/crypto/argon2`（argon2id）+ `session` 表 + Cookie | 独立账号；`HttpOnly; SameSite=Lax; Secure`；登录限流内存桶 |
| 校验 | handler 内显式校验（字段少）或 `go-playground/validator` | 统一 `{error:{code,message}}` |
| ID | nanoid 兼容：`crypto/rand` 取 21 字符 | 与旧 `sj_*` 数据格式一致，迁移无需转 ID |
| 日志 | `log/slog` JSON | 标准库 |
| 测试 | `go test`（httptest + 临时 SQLite 文件）+ 前端 vitest | 领域计算双端共用 `testdata/domain-cases.json` |
| Lint | `gofmt -l` + `go vet`（verify.sh 统一入口） | 零额外依赖起步 |

**前后端契约**：`docs/data-model.md` §3 字段表是唯一契约源；Go struct `json` tag 与前端 `src/lib/types/api.ts` 手写镜像；server 集成测试钉 JSON 形状防漂移。**不引 OpenAPI codegen**（单人项目成本>收益，需要时再加）。

**领域计算归属**：服务端 `apps/server/internal/domain` 是唯一权威实现（进度/连续天数/合计/拆分预览）；前端 `src/lib/domain.ts` 只保留展示预览所需纯函数。两语言不能共享代码，用 `testdata/domain-cases.json` 同一组用例对齐（Go test + vitest 双跑）。

## 3. 备选与放弃理由（存档）

| 方案 | 结论 | 理由 |
|---|---|---|
| ~~Hono + Drizzle（TS 全栈）~~ | 原推荐，**被 Go 取代** | 同样轻，但 Go 单二进制部署更省（连 Node 都不用装），且 owner 拍板 Go |
| Spring Boot 轻量化 | 放弃 | JVM `-Xmx512m` 起步，2G 机放不下第二个 JVM |
| Go + gorm | 放弃 | ORM 魔法多（零值更新/N+1/hook），sqlc 更显式 |
| Go + ent | 放弃 | 重，codegen 产物庞大 |
| `mattn/go-sqlite3` | 放弃 | 需 cgo/gcc，交叉编译麻烦；modernc 纯 Go 更适合 |
| echo / gin | 备选未选 | chi 更贴近 stdlib；若 M1 觉得 chi 中间件啰嗦可换，路由层可替换 |
| 全栈独立域名 | 暂缓 | 需 DNS/证书；`/journal/` 子路径已够用，域名以后再说 |

## 4. 目标架构

```
浏览器 ──HTTPS──> nginx :443（mysite 现有实例内新增 location）
                   ├─ /journal/        → /var/www/journal/（apps/web 构建产物，SPA fallback）
                   ├─ /journal/api/*   → proxy_pass http://127.0.0.1:8090/api/  ← 新：Go 服务
                   └─ /v1/、/api/(旧journal) → 8081（过渡期保留）

journal-server（systemd: journal.service，单静态二进制，127.0.0.1:8090，MemoryMax=128M）
  ├─ chi 路由 /api/v1/*（session 鉴权、slog、recover）
  ├─ internal/domain 纯函数（进度/连续/合计/拆分预览）
  ├─ sqlc → modernc.org/sqlite → /var/lib/journal/journal.db（WAL）
  └─ 备份：`journal-server backup` 子命令 → VACUUM INTO（cron 每日）
```

- 前端 API base：`VITE_API_BASE`。生产 `/journal/api`（nginx 剥前缀转 `/api/`）；dev `/api`（vite proxy → 8090）。
- 过渡期：旧 `/api/journal/*`（mysite 8081）继续服务直到 S3 切换完成；前端 M3 起改调 `/journal/api/v1/*`。
- MemoryMax=128M（Go RSS 预期 <30M，比 Node 方案更宽松；mysite JVM 512m 不动）。

## 5. 仓库结构（目标）

```
study-journey/
├── apps/
│   ├── web/                    # 现 src/ 平移；React+Vite+TS+Tailwind
│   │   └── src/{pages,components,lib,styles}
│   └── server/                 # Go module `journal`
│       ├── cmd/
│       │   ├── journal-server/main.go      # HTTP 服务 + backup 子命令
│       │   └── import-mysite/main.go       # 一次性迁移（MySQL→SQLite）
│       ├── internal/
│       │   ├── httpapi/        # chi 路由、handler、中间件（auth/log/recover）
│       │   ├── db/             # sqlc 生成代码 + 手写辅助
│       │   ├── domain/         # 纯函数（唯一权威实现）+ *_test.go
│       │   ├── auth/           # argon2id、session、登录限流
│       │   └── migrate/        # user_version runner
│       └── db/
│           ├── migrations/     # 0001_init.sql …（编号 + 幂等守卫）
│           └── queries/        # sqlc 输入 .sql
├── testdata/domain-cases.json  # 领域计算双端对齐用例
├── design/concepts-v6/         # UI 概念稿（实现参照）
├── docs/                       # 本目录
├── deploy/                     # deploy.sh：web build + GOOS=linux go build + rsync + systemctl
└── scripts/verify.sh
```

- pnpm workspace 只含 `apps/web`（Go 不进 workspace）。
- `verify.sh`（M1 后）：`pnpm -F web typecheck && pnpm -F web build` + `cd apps/server && test -z "$(gofmt -l .)" && go vet ./... && go test ./...`。

## 6. API 约定（对齐现状，降低迁移成本）

- **服务端路由前缀 `/api/v1/*`**；对外经 nginx 为 `/journal/api/v1/*`。
- 鉴权：`POST /api/v1/auth/login {username,password}` → `Set-Cookie: sj_session=…`；`POST /api/v1/auth/logout`；`GET /api/v1/auth/me`。其余路由走 session 中间件，未登录 → 401。
- 成功响应沿用 `{code:"0", data}` 包络；失败 `{code:"<非0>", message}`，错误码枚举见 `data-model.md` §4 末。
- **user_id 只从 session 解析**，请求体/路径不接收；多用户预留但首版单用户。
- 日期 = `YYYY-MM-DD` 字符串（用户本地日历日），禁时区转换；时间戳 = Unix 毫秒整数。
- 资源路径与现有 `/api/journal` 一一对应（records/goals/moods/search/import/export/streak/settings/auth），仅前缀与包络微调。

## 7. 决策记录（全部已定）

| # | 问题 | 结论 | 备注 |
|---|---|---|---|
| D1 | 后端栈 | **Go**（chi + sqlc + modernc sqlite） | owner 拍板 |
| D2 | 数据库 | **SQLite 单文件** | owner 确认推荐项 |
| D3 | 鉴权 | **独立账号**（用户名+密码 → Cookie session） | 首版单用户，users 表预留多用户 |
| D4 | 访问路径 | 保留 `/journal/` 子路径 | 需独立域名时再议 |
| D5 | UI | **B 格纸 = 默认主题先行**；A/C 稳定后做扩展主题 | SPEC-A/C 保留 |
| D6 | 迁移窗口 | 旧接口只读 14 天后下线 | 见 separation-plan S3/S4 |
