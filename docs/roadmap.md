# 开发路线图：从现状到独立上线（M0–M10）

> 配套：`architecture.md`（栈已定：Go + SQLite + 独立账号）、`data-model.md`（v3 数据模型）、`separation-plan.md`（剥离步骤）、`design/concepts-v6/`（UI）。
> 原则：**每个里程碑可独立验证、可独立上线/回滚**；任务卡是给执行模型（含便宜模型）的最小工作单元。

## 1. 里程碑总览

| # | 里程碑 | 产出 | 依赖 | 前置决策 |
|---|---|---|---|---|
| M0 | 立约 | 本仓库规范 + 设计文档（已完成 2026-11-15） | — | — |
| M1 | Go 后端骨架 | `apps/server` 可跑、auth、CI、目录重构 | M0 | ✅ 已定 |
| M2 | 数据层 v3 | 全部表 + domain + API（对旧接口平齐） | M1 | — |
| M3 | 前端换 API | web 调新后端，IndexedDB 下线 | M2 | — |
| M4 | 迁移与切换 | 数据迁入、nginx 切流、旧接口只读 | M2 M3 | M4-1/2 ✅（11-15），**M4-3 ✅ 切流完成（11-16）**，M4-4 回滚组件验证过、live drill 待 owner 定 |
| M5 | mysite 清理 | journal 模块下线（14 天稳定后）；任务卡已备：mysite `.trellis/tasks/11-15-remove-journal-module`（2026-11-15 消费点复核完） | M4 | — |
| M6 | **B 格纸 UI 落地** | 默认主题换装上线 ✅（11-16，P1–P5 完成，task 已归档） | M4 | ✅ B 已定 |
| M7 | 新功能补齐 | ✅ 已完成（11-16）：科目预设管理/热力图/状态与科目归档恢复/每周起始/修改密码；倒计时、正字统计、快捷时长 M6 已落地 | M6 | — |
| M8 | 稳定期 | 观察 + 小修 | M7 | — |
| M9 | 收尾 | 归档 + 广播 | M8 | — |
| M10 | **A/C 扩展主题** | 石墨/夜读作为可选主题上线 | M8 稳定后 | 设计已定稿 |

> 考研节奏：若 2026-12 初试，则 **M6 必须在 11 月底前上线**，M7/M10 视备考状态排期；考试前 2 周冻结非必要改动。

## 2. 任务卡（按里程碑）

### M1 Go 后端骨架 + 仓库重构

| 卡 | 内容 | 验收 |
|---|---|---|
| M1-1 | `git mv src apps/web/src` 等平移（不改代码），根 `package.json` 留 web 脚本；`.gitignore` 补 `apps/server/bin`、`*.db` | `pnpm -F web build` 通过；git log 显示 rename |
| M1-2 | `apps/server`：`go mod init journal`，chi 路由，`GET /api/health` → `{code:"0",data:{ok:true}}`，统一 `{error:{code,message}}` 中间件，slog JSON 日志，`/api/v1` 前缀 | `go run ./cmd/journal-server` 起服务，curl health 200 |
| M1-3 | migrate runner：`PRAGMA user_version` + `db/migrations/*.sql` 嵌入（`embed.FS`），启动自动执行未应用迁移 | 重复启动不报错；`user_version` 递增 |
| M1-4 | 三张基础表迁移：`user`（id/username/password_hash/created_at）、`session`（token_hash/user_id/expires_at）、`setting`（key/value JSON） | 迁移文件可重复执行 |
| M1-5 | auth：`POST /api/v1/auth/login`（argon2id 校验 + 限流 + Set-Cookie）、`POST /auth/logout`、`GET /auth/me`；session 中间件解析 user_id 注入 context；`cmd/journal-server -create-user` 子命令建账号 | curl 登录→me→带 cookie 访问受保护路由 200；错误密码 401 |
| M1-6 | `scripts/verify.sh` 升级：web typecheck+build + server `gofmt -l`/`go vet`/`go test` | 脚本全绿 |
| M1-7 | 本地 Go 环境确认（`go version` ≥1.23；未装则 `brew install go`） | — |

### M2 数据层 v3 + API

| 卡 | 内容 | 验收 |
|---|---|---|
| M2-1 | 全部 v3 表迁移（`data-model.md` §2，11 张） | 迁移幂等；外键生效（单测插孤儿失败） |
| M2-2 | `internal/domain`：纯函数（`computeGoalProgress`/`computeStreak`/`splitCountPreview`/日期工具）+ `testdata/domain-cases.json` 用例 + `go test` | 用例全绿；用例文件与前端 vitest 共用 |
| M2-3 | sqlc 接入：`db/queries/*.sql` 覆盖 records/moods/goals/search/import-export/settings 全资源 | `sqlc generate` 产物入库；编译通过 |
| M2-4 | 路由按资源分组实现，**对齐现有 `/api/journal` 行为**（upsert patch 语义、进度读时算、import/export v2 兼容、carry-over） | httptest 集成测试覆盖每端点 happy+主要错误路径 |
| M2-5 | `setting` 读写 API + 默认值注入（exam_date/subjects/theme/daily_goal…） | GET/PUT 往返一致 |

### M3 前端换 API

| 卡 | 内容 | 验收 |
|---|---|---|
| M3-1 | `lib/types/api.ts`（按 data-model.md §3 手写镜像）+ `lib/api.ts`/`goalApi.ts` 重写为 fetch 新端点；`http.ts` 改 Cookie 模式（`credentials:'include'`，去 JWT refresh） | 类型检查通过 |
| M3-2 | auth.ts 改 `/auth/me` 判定；登录页改用户名密码表单；登出清 session | 登录/登出/刷新保持登录态 |
| M3-3 | 移除 Dexie/db.ts（IndexedDB 迁移兜底已无必要——旧数据走 M4 服务端迁移）；`VITE_API_BASE` 接入 | grep 无 dexie 引用 |
| M3-4 | TanStack Query 接入（records/goals/settings），页面逐个迁移；乐观更新保留 | 9 页功能与旧版一致（人工走查清单） |
| M3-5 | `src/lib/domain.ts`：展示预览纯函数 + vitest 跑 `domain-cases.json` | 双端用例一致 |

### M4 迁移与切换

| 卡 | 内容 | 验收 |
|---|---|---|
| M4-1 | `cmd/import-mysite`：读 MySQL `sj_*`（SSH 隧道或只读账号）→ 写 SQLite v3；对账报告（逐日 learning 时长合计、goal 数、checkin 数） | 本地演练对账逐项相等 |
| M4-2 | `deploy/deploy.sh`：web build + `GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build` + rsync web→`/var/www/journal/` + binary→`/opt/journal/` + systemctl；nginx 片段 `location /journal/api/ → 127.0.0.1:8090/api/` | 服务器部署成功，`/journal/api/v1/auth/me` 401（未登录） |
| M4-3 | 首次上线：建账号 → 跑迁移 → 核对 → 切流（nginx reload）；旧 `/api/journal` 保留只读 | 线上手帐可用，数据完整 |
| M4-4 | 回滚预案演练：nginx 改回旧 upstream 一键回滚（记录命令） | 回滚 ≤5 分钟验证 |

### M5 mysite 清理（M4 稳定 14 天后）

- 按 `separation-plan.md` §S4 清单删 journal 模块（47 java 文件 + MapperScan + WebSecurityConfig + ErrorCode + 测试 + schema + deploy 脚本引用 + 文档）。
- mysite `.trellis` 记一行；`.cursor/rules/journal.mdc` 删除或改为历史说明。

### M6 B 格纸 UI 落地（默认主题）

- 按 `design/concepts-v6/SPEC-B.md` + `README.md` 执行：token 层 → 组件换肤 → 12 页逐页对照 `shots/`。
- 主题存 `setting.theme`（服务端），与博客 key 完全脱钩。
- 验收：1440/390 截图对照概念稿；`./scripts/verify.sh` 全绿。

### M7 新功能补齐（B 版内）

- 倒计时/科目预设/热力图/正字统计等（SPEC-B 已定义）；专注计时**不做**（那是 C 版特性，归 M10 再评估）。
- 每功能一个任务卡，先写 prd 列消费点。

### M8 稳定期

- **B 还原度修复**（2026-11-16 对照评审：组件 85–90%、整页 50–60%）：S0 视觉对照脚本 → S1 桌面去限宽 → S2 手机整屏纸 → S3–S8 逐项 → S9 节奏提示（可选，契约改动）。✅ 2026-11-16 完成（S0–S9 + 收尾轮 18 项），已归档：`.trellis/tasks/archive/2026-11/11-16-b-fidelity/`。

### M10 A/C 扩展主题（上线稳定后）

- A 石墨、C 夜读作为 `setting.theme` 可选主题；先做 token/排版层，组件变体（A 的 rail 布局、C 的专注页）按性价比拆卡评估。
- 触发条件：M7 上线 ≥4 周且无重大 bug。

## 3. 任务卡模板（复制即用）

```markdown
# <MM-DD>-<slug>

## 问题 / 目标
<一句话>

## 消费点（命中 AGENTS §2 时必填）
- 调用方：`rg` 结果列表
- 影响面：文件清单

## 方案
<最小实现步骤>

## 验收
- `./scripts/verify.sh`
- <专项检查/截图/对账>
```

## 4. 排期建议（考研场景）

- 2026-11-15 → 11-30：M1–M4（剥离上线，UI 暂不动仍是旧版式）
- 2026-12-01 → 12-15：M6 B 格纸换装（赶在初试前）
- 初试后：M7/M10 按状态排
