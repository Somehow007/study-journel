# 11-15-m4-migration-cutover

## 问题 / 目标

roadmap M4「迁移与切换」：把 mysite MySQL `sj_*` 6 表迁到 SQLite v3，交付部署与切换物料。
M4-3/M4-4 是服务器侧操作，本任务交付可执行脚本 + runbook，实际切流由 owner 在服务器执行（或另开会话带 SSH 执行）。

## 消费点（命中 AGENTS §2：数据迁移 + 部署 + 契约/领域层）

- `internal/httpapi/journal.go` `ensureBootstrap`：抽出 `builtinStates`/`seedSubjects` 到 `internal/bootstrap`，HTTP 行为不变（`journal_test.go TestBootstrapSeeds` 兜底）。
- `internal/httpapi/{days,import,goals,meta,misc}.go`：`entryTitle`/`validColor` 移入 `internal/domain` 导出（`EntryTitle`/`ValidColor`），12+3 处调用点机械改名，同包内改动。
- `internal/importer`（新包）：读 MySQL `sj_{day_record,learning_item,custom_mood,goal,goal_task,goal_checkin}` → 写 SQLite v3；映射规则 = `docs/data-model.md` §6。
- `cmd/import-mysite`（新）：迁移 CLI，支持 `-dry-run` / `-force`（先 `VACUUM INTO` 备份再清业务表）。
- `cmd/journal-server`：新增 `backup` 子命令（`VACUUM INTO` 时间戳文件），供切换前备份与每日 cron。
- `deploy/`（新）：`deploy.sh`（本地交叉编译 + 推服务器）、`journal.service`、`nginx/journal-api.conf`、`CUTOVER.md`（M4-3 首发 + M4-4 回滚命令）。

## 方案要点（评审请重点看）

1. **ID 保全**：`entry.id = sj_learning_item.client_id`（nanoid）；`goal/task/checkin/mood` id 原样保留 → `learning_client_id` 直接等于对应 `entry.id`，`goal_task.entry_id`/`goal_checkin.entry_id` 校验存在后回填；`carried_from` 恒 NULL（旧 carry-over 是复制新行，无链接）。
2. **心情**：`mood` ∈ 6 内置 key → `state.builtin_key`；否则 = `sj_custom_mood.id` → 同 id `state` 行（只留 `solid`→`color`，丢 emoji/ink/tint/dark）。未解析 mood → `state_id=NULL` + warn（不丢整天）。
3. **科目**：`subject` trim 去重，color 取「最近使用」（record.date, item.id 最大者）；空名 → `未命名` + warn。**不种子 4 个默认科目**（data-model §6 无此映射行；有数据则 ensureBootstrap 的 `sc>0` 跳过种子——保持迁移保真）。
4. **目标→科目**：`sj_goal.color` 归一化后与科目色相等 → `subject_id`（多科目同色取 sort 最小），`color=NULL`；否则 `color` 保留（非法色 → NULL + warn）。
5. **entry.title/note**：与 `importRecords` 一致——`title=EntryTitle("",note,科目名)`（首行/科目名兜底），`note` 存全文（前端展示去重已在 M3 处理）。`source='import'`。`created/updated_at` 用父 record 时间戳（条目无独立时间戳，最优代理）。
6. **done/done_at**：`done=1` → `done_at=coalesce(done_at,updated_at)`；`done=0` → NULL。`due_date`+`week_start` 同存 → 保留 due_date、week_start 置 NULL + warn（v3 CHECK 互斥）。
7. **用户**：`-user` 指定新库用户名；缺省且全库仅 1 用户时自动取。`sj_*.user_id` 多值 → 必须 `-source-user-id`（防合并两用户数据撞 `day` 复合主键）。
8. **对账**：天数/条目数/总分钟/逐日分钟 map/科目数/状态数/目标/子任务/打卡数/打卡量合计，逐项 old vs new；任一不等 exit 1。
9. **deploy.sh**：`VITE_API_BASE=/journal/api pnpm -F web build`（生产必须，否则 API 打到 8081 旧后端）；`CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build`；rsync web→`/var/www/journal/`、binary→`/opt/journal/`；`systemctl restart journal`；健康检查 `/api/health`。服务器地址走 `JOURNAL_SERVER` 环境变量（不写真实 IP 进仓库）。
10. **nginx**：`/journal/api/ → 127.0.0.1:8090/api/` 片段需同时进 mysite.conf 的 443 与 8080 两个 server 块（两块都有 `/journal/` alias）；`proxy_pass` 带 URI 重写 `/api/`。

## 验收

- `./scripts/verify.sh` 全绿（含 importer 新单测）。
- 本地演练：scratch MySQL 库（`sj_rehearsal`）造覆盖性数据 → `import-mysite` → 对账逐项相等 + 抽查映射正确。
- `deploy/` 产物齐全；CUTOVER.md 含 M4-3 步骤与 M4-4 一键回滚命令（≤5min）。
- 服务器实切（M4-3/M4-4 执行）不在本任务内，留待 owner/下个会话。

## 后续方向

- M4-3 执行后：mysite 侧 `/api/journal` 保留只读 14 天；观察期记录 RSS/备份 cron。
- `journal-server backup` 接 cron 每日（CUTOVER.md 给命令）。

## Resolution（2026-11-15）

### 已交付

- `internal/importer`（source/convert/reconcile/importer 四文件 + 测试）：读 MySQL `sj_*` 6 表 → v3 SQLite；ID 保全、心情/科目/目标映射、逐项对账（9 指标 + 逐日分钟）。`Apply` 单事务写入，非空目标拒绝，`-force` 先 `VACUUM INTO` 备份再清业务表（user/session/setting 不动）。
- `cmd/import-mysite`：`-dry-run`（只读+试算）、`-force`、`-source-user-id`（多 user_id 强制指定）、`-mysql-dsn` 或分项+`JOURNAL_MYSQL_PASSWORD`；对账差异 exit 1。
- `journal-server backup`：`VACUUM INTO` 时间戳快照（不覆盖已存在文件）。
- 重构：`internal/bootstrap`（首登种子单一事实源，HTTP 与 importer 共用）、`internal/domain/text.go`（`ValidColor`/`NormalizeColor`/`EntryTitle`，12+3 处调用点机械改名，行为不变）。
- `deploy/`：`deploy.sh`（本地交叉编译 CGO_ENABLED=0 + rsync，`--skip-web`/`--skip-go` 分阶段）、`journal.service`（www-data, 127.0.0.1:8090, MemoryMax=160M）、`nginx/journal-api.conf`（`/journal/api/`→`127.0.0.1:8090/api/`，443+8080 两块都要加）、`CUTOVER.md`（M4-3 五阶段 + M4-4 回滚 ≤5min + cron 备份）。

### 验证

- `./scripts/verify.sh` 全绿（typecheck / vitest 46 / build / gofmt / vet / go test 含 importer / sqlc 一致）。
- 本地演练①：scratch MySQL `sj_rehearsal` 造脏数据 → dry-run 正确报告 skipped/warnings；实迁对账差异 → exit 1 ✓。
- 本地演练②：真实本地 `mysite` MySQL（2 day / 1 item / 11 goal / 39 task / 1 checkin）→ `/tmp/journal-real.db` 迁移，9 项对账 + 逐日分钟**全部相等**，exit 0；抽查 goal→subject 按色匹配、checkin `entry_id` 回填正确。

### 未做（移交）

- **M4-3 首发 / M4-4 回滚演练**：服务器侧操作，物料已备好在 `deploy/CUTOVER.md`，需 owner 确认后按阶段执行（建账号→mysqldump 冷备→dry-run→实迁→nginx→推前端→冒烟）。
- Cookie `Path=/`（实现早于 separation-plan 的 `/journal` 设想；博客鉴权走 localStorage 无冲突，暂保留）。
