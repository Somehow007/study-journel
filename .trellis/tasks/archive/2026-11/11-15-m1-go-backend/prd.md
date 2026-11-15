# 11-15-m1-go-backend

## 问题 / 目标

按 `docs/roadmap.md` M1 任务卡落地 Go 后端骨架与仓库重构：前端平移 `apps/web`，新建 `apps/server`（chi + modernc sqlite + argon2id + Cookie session），迁移 runner 与三张基础表（user/session/setting），verify.sh 升级为全工作区验证。本卡命中 AGENTS §2「鉴权与会话 / 数据模型与迁移 / 契约」，先记方案再动手。

## 消费点（命中 AGENTS §2 时必填）

- **鉴权/会话（新增面，旧前端不动）**：新端点 `POST /api/v1/auth/login`、`POST /api/v1/auth/logout`、`GET /api/v1/auth/me`；Cookie `sj_session`。现有前端仍走博客 JWT（`src/lib/http.ts`、`src/lib/auth.ts`），本卡不改 `src/`，M3 才切换。
- **数据迁移**：新增 `apps/server/db/migrations/0001_init.sql`（user/session/setting，字段以 `docs/data-model.md` §3 为准）。roadmap M1-4 写的 `token_hash` 与 data-model 的 `session.id`（=Cookie token 的 sha256）语义一致，此处以 data-model 为准：`session.id` 存 token 散列，不再单设 token_hash 列。
- **契约/包络**：成功 `{code:"0",data}`；失败 `{code:"<非0>",message}`（对齐现 `ApiResult` 与 architecture §6；roadmap M1-2 的 `{error:{...}}` 与 architecture §6 冲突，取后者以降低 M3 迁移成本，错误码枚举留待 M2 在 data-model §4 末补齐）。
- **仓库平移（M1-1）**：
  - `scripts/verify.sh`：改为 pnpm workspace + Go 验证（本卡同步升级，见 M1-6）。
  - mysite `deploy/server-deploy.sh` `step_build_journal`/`step_deploy_journal`：**会失效**——服务器上 `cd $JOURNAL_DIR && npm install && npm run build` + 校验 `dist/index.html`，平移后产物在 `apps/web/dist` 且需 pnpm。M1–M4 期间前端冻结不上线，部署脚本改造归 M4-2；**owner 在此窗口内不要跑 server-deploy.sh**（会因手帐构建失败中断整个部署）。已在 CHANGES.md 留痕。
  - `docs/MAP.md` §2/§3 命令与目录：随平移同步更新。
  - `design/verify-*.mjs`：引用 `localhost:5173` 早已漂移（实际 5174），本就不可用，不动。
  - `package.json` 改名 `study-journal`→`web`：仅 workspace 过滤需要，无代码消费 `name` 字段。
- **依赖**：新增 Go 依赖 chi/v5、modernc.org/sqlite、golang.org/x/crypto(argon2)、golang.org/x/term（仅 create-user 读密码）；前端依赖不变（pnpm-lock 由 importer `.`→`apps/web` 重排，版本不动）。

## 方案

1. **M1-1 平移**：`git mv` `src public index.html package.json vite.config.ts tsconfig*.json postcss.config.js tailwind.config.js` → `apps/web/`；`pnpm-lock.yaml` 留根；新建根 `pnpm-workspace.yaml`（`apps/web`）与根 `package.json`（name `study-journey`，scripts 委托 `pnpm -F web …`）；apps/web `package.json` name 改 `web` 并补 `typecheck` script；`.gitignore` 补 `apps/server/bin`、`*.db`、`*.db-wal`、`*.db-shm`。`pnpm install` 重排 lockfile，`pnpm -F web build` 验证。
2. **M1-2 骨架**：`apps/server` `go mod init journal`；chi 路由 `/api/health`（`{code:"0",data:{ok:true}}`）+ `/api/v1` 分组；slog JSON 请求日志 + recover（错误走统一包络）；404/405 也回 JSON。
3. **M1-3 migrate**：`db/migrations/*.sql` 经 `db/migrations/embed.go`（`//go:embed *.sql`）注入；`internal/migrate` 按文件名数字前缀版本、`PRAGMA user_version` 跟踪，单事务执行迁移 SQL + 写版本号，重复启动幂等。
4. **M1-4 迁移**：`0001_init.sql` 建 user/session/setting（data-model §3 原样；`session.id` = token sha256 hex，Cookie 值为 32B 随机 base64url）。
5. **M1-5 auth**：argon2id（自描述 PHC 格式 `$argon2id$t$m$p$salt$hash`，常量时间比较；登录对不存在用户也跑一次 dummy verify 防枚举/时序）；session 30 天、滑动不做（M1 绝对过期）；登录限流 5 次/10min/IP 内存桶；session 中间件解析 user_id 入 context；`create-user` 子命令（`-username` 必填，`-password` 缺省时终端隐藏输入）。
6. **M1-6 verify.sh**：`pnpm install`（缺 node_modules 时）→ `pnpm -F web typecheck` + `pnpm -F web build` → `cd apps/server && gofmt -l`（须空）+ `go vet ./...` + `go test ./...`。
7. **M1-7**：本机无 Go → `brew install go`（后台并行）。

测试（随骨架带）：`internal/migrate` 幂等+user_version 递增；`internal/auth` hash/verify；`internal/httpapi` httptest 跑 login→me→logout 全流程 + 错误密码 401 + 限流 429。

## 验收

- `pnpm -F web build` 通过；`git log --follow`/`git show --summary` 可见 rename。
- `go run ./cmd/journal-server` 起服务：`curl :8090/api/health` → `{"code":"0","data":{"ok":true}}`；`create-user` 建号 → login 200 Set-Cookie → me 200 → 错误密码 401 → logout 后 me 401。
- 重复启动服务不报错；`PRAGMA user_version` = 1。
- `./scripts/verify.sh` 全绿（web + gofmt/vet/test）。
- `git diff --cached | rg -i 'key|secret|password|token'` 自查无密钥。

## 后续方向

- M2-1 在 `0002_*.sql` 补齐其余 8 张 v3 表；M2-3 sqlc 接入后 `internal/db` 生成代码落位。
- session 过期清理（cron/惰性删除）、Secure Cookie 生产开关（`JOURNAL_COOKIE_SECURE`）在 M4 部署卡启用。
- mysite `server-deploy.sh` 手帐构建段改造 → M4-2。

## Resolution

2026-11-15 M1 全部落地：

- **M1-1**：`src/`、`public/`、`index.html`、全部前端配置 `git mv` → `apps/web/`；`pnpm-workspace.yaml` + 根 `package.json`（scripts 委托 `pnpm -F web`）；web 包名改 `web` 并补 `typecheck` script；`.gitignore` 补 `apps/server/bin`、`*.db*`；`pnpm-lock.yaml` importer 重排 `.`→`apps/web`，依赖版本不变。
- **M1-2~5**：`apps/server`（module `journal`，go 1.27.4）——chi 路由 `/api/health` + `/api/v1/auth/{login,logout,me}`；slog JSON 日志 + recover + RealIP；统一包络 `{code:"0",data}` / `{code,message}`；`db/migrations/0001_init.sql`（user/session/setting）经 embed + `user_version` runner 幂等迁移；argon2id PHC 哈希 + 32B token Cookie（`sj_session`，库中存 sha256）+ 30 天 session + 登录限流 5 次/10min/IP；`create-user` 子命令（缺省密码走终端隐藏输入）。
- **M1-6**：`scripts/verify.sh` = pnpm install（按需）→ `pnpm -F web typecheck` + `build` → `gofmt -l`（须空）+ `go vet` + `go test`。
- **M1-7**：`brew install go` → go1.27.4；`go env -w GOPROXY=https://goproxy.cn,direct`（proxy.golang.org 直连超时）。

**验证结论**：`./scripts/verify.sh` 全绿；真实二进制冒烟通过——create-user 建号 → health `{code:"0",data:{ok:true}}` → login 200 Set-Cookie → me 200 → 错误密码 401 → logout → me 401；重复启动迁移幂等。

**踩坑**：session token 摘主要对 cookie 字符串本身算 sha256（首版误对原始字节），已修并加 httptest 回归。

**后续方向**：M2-1 起 `0002_*.sql` 补齐其余 8 表；session 定期清理、`JOURNAL_COOKIE_SECURE` 生产开启归 M4；mysite `server-deploy.sh` 手帐段 M4-2 改造（M1–M4 勿跑该脚本）。
