# 手帐 · 从 mysite 剥离方案

> 状态：提议（2026-11-15）。目标：手帐成为**独立仓库 + 独立后端 + 独立数据 + 独立规范**的产品，博客只保留一个入口链接。
> 原则：**先并行、后切换、再清理**；任何一步都能回滚到「mysite 后端仍在服务」的状态。

## 1. 剥离范围

| 维度 | 现状（耦合点） | 剥离后 |
|---|---|---|
| 代码 | 前端在本仓库；后端在 mysite `io.github.somehow.mysite.journal`（47 文件） | 前后端都在本仓库 `apps/web` `apps/server` |
| 数据 | mysite MySQL `sj_*` 7 表 | `/var/lib/journal/journal.db`（SQLite） |
| 鉴权 | 博客 JWT（`/v1/auth/login|refresh`、localStorage `mysite_access_token`、`mysite_user_role`） | 本仓库 Cookie Session |
| 部署 | mysite `deploy/server-deploy.sh` 顺带拉/构建/rsync 本仓库 | 本仓库 `deploy/deploy.sh` + `journal.service` |
| nginx | mysite `deploy/nginx/mysite.conf` 中 `/journal/` 块；`/api/` 反代 8081 | 新增 `/journal/api/` → 8090；`/journal/` 静态不变 |
| 规范 | 受 mysite `AGENTS.md`、`.cursor/rules/journal.mdc`、`CLAUDE.md` 约束；广播写 mysite `.trellis/CHANGES.md` | 本仓库 `AGENTS.md` + `.trellis/`（2026-11-15 已建立） |
| 备份 | mysite `deploy/backup-mysql.sh` 连带 `sj_*` | `journal-server backup` 子命令（`VACUUM INTO`）+ cron 每日 |

## 2. 阶段与步骤

> 每步一个 trellis 任务（`.trellis/tasks/<MM-DD>-<名>/prd.md`），完成写 CHANGES。对应 `roadmap.md` 的 M 编号。

### S0 立约（✅ 2026-11-15 完成）
- 本仓库 `AGENTS.md`、`.trellis/CHANGES.md`、`.trellis/tasks/`、`docs/*`、`scripts/verify.sh` 建立。
- 自此：**手帐相关任务的留痕写本仓库 `.trellis/`**；mysite `.trellis/CHANGES.md` 只在「影响 mysite 的步骤」（S4/S5）写一行指针。

### S1 新后端并行建设（M1–M3，不碰生产）
- 单仓改造、Go + SQLite 后端、数据模型 v3、domain 契约与单测、迁移工具。
- 前端数据层切到新 API（开发环境 vite proxy `/journal/api` → `localhost:8090`）。
- **mysite 不做任何改动**；生产继续用旧接口。

### S2 迁移演练（M4）
1. 本地：用 mysite 本地库（或生产库只读快照）跑 `import-mysite`，对账报告逐项相等。
2. 服务器：**无需装任何运行时**：本地 `CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build` 出单静态二进制，scp 到 `/opt/journal/`（服务器不装 Node/Go/Java 新版本）。
3. 部署 `journal.service`（`127.0.0.1:8090`，`MemoryMax=160M`），空库启动 → `create-user.ts` 建账号。
4. 服务器上对生产 MySQL 只读跑迁移 → 对账 → 用临时 nginx 路径（如 `/journal-next/`）手动验收全部页面。
5. 记录 `free -m` 前后对比，确认内存预算（目标 RSS < 80M）。

### S3 切换（M4 末，选一个不学习的时段，≈15 分钟）
1. 公告冻结：切换前不再在旧手帐写数据。
2. 最终迁移：清空新库 → 再跑一次迁移 → 对账通过。
3. 部署新前端产物到 `/var/www/journal/`（新前端只认新 API + Cookie 登录）。
4. nginx 增加 `location /journal/api/ { proxy_pass http://127.0.0.1:8090/api/; }` → `nginx -t` → reload。
5. 冒烟：登录 / 今日页 / 记一条 / 日历 / 计划 / 打卡 / 导出。
6. mysite 旧接口 **保留只读 14 天**（不删代码，作为回滚底座）。

**回滚**：nginx 去掉 `/journal/api/` 块 + 回放旧前端产物（切换前备份 `/var/www/journal.bak-<日期>.tar.gz`）→ 旧系统原样恢复。切换后新增数据可用新系统 `/export` v3 导出，必要时手工补回。

### S4 mysite 清理（M5，在 mysite 仓库执行，按 mysite AGENTS.md 流程开任务）

14 天观察期无问题后，在 mysite 开任务「移除 journal 模块」，**一次一个关注点拆 commit**。消费点清单（2026-11-15 `rg -il "journal|sj_|手帐"` 实测）：

| 序 | mysite 文件 | 动作 |
|---|---|---|
| 1 | `src/main/java/io/github/somehow/mysite/journal/**`（47 文件）+ `src/main/resources/mapper/SjDayRecordMapper.xml` | 删除 |
| 2 | `MysiteApplication.java` `@MapperScan` 中 `…journal.dao.mapper` | 移除该包 |
| 3 | `config/WebSecurityConfig.java:173-175` `/api/journal/**` 规则 | 删除 |
| 4 | `commons/framework/errorcode/ErrorCode.java:125-137` `JOURNAL_*`（A11 段） | 删除（确认无其他引用） |
| 5 | `config/PrimaryDataSourceConfig.java:64-67` 注释中的 journal 事故说明 | 改为通用表述（注释保留事故教训） |
| 6 | `src/test/.../journal/service/impl/CustomMoodServiceImplTest.java` | 删除 |
| 7 | `src/test/.../support/TestTableInfo.java` 中 6 个 `Sj*DO` | 移除 |
| 8 | `docker/init/schema.sql` §14–19、`docker/init/journal-schema.sql` | 删除建表；生产 `sj_*` 表**先 `mysqldump` 归档再 DROP**（单独一步，需 owner 确认） |
| 9 | `deploy/server-deploy.sh` `JOURNAL_*` 变量与 `step_*_journal`、健康检查 344–366 行 | 删除（手帐由本仓库部署） |
| 10 | `deploy/nginx/mysite.conf` `/journal/` 块 | **保留**，并补 `/journal/api/` 块（与服务器同步） |
| 11 | `deploy/backup-mysql.sh` 注释 | 去掉 sj_* 描述 |
| 12 | `mysite-frontend/.../AppHeader.vue`、`DashboardSidebar.vue` 「手帐」链接 | **保留**（博客唯一入口；可去掉 `isAdmin` 条件或保持） |
| 13 | `AGENTS.md`（§3 journal 约束、§5 study-journey 条款）、`CLAUDE.md`（手帐段落/表）、`.cursor/rules/journal.mdc`、`.cursor/rules/mysite-architecture.mdc`（三子系统 → 两子系统） | 改为「手帐已独立，见 study-journey 仓库」一句指针；删 `journal.mdc` |
| 14 | `docs/MAP.md`、`docs/DESIGN.md`、`docs/study-journey-integration.md` | MAP 更新子系统表；integration 文档顶部标注「已于 <日期> 剥离，历史文档」 |
| 15 | `.gitignore` 的 `study-journey/` | 保留（本地仍可能嵌套检出） |

验收：mysite `./scripts/verify.sh quick` 绿；`rg -i "journal|sj_" src/` 无业务命中；生产 `/v1/*` 回归 200。

### S5 收尾
- mysite `.trellis/CHANGES.md` 记一行「手帐剥离完成 → study-journey `.trellis/`」。
- 本仓库 `docs/MAP.md` 去掉「mysite 内后端」相关描述。
- 观察 30 天：备份文件每日生成、`journal.service` 无重启、RSS 稳定。

## 3. 风险

| 风险 | 缓解 |
|---|---|
| 迁移丢数据 / 时长对不上 | 对账报告逐日比对总分钟；不通过不切换；旧库保留 14 天 + mysqldump 永久归档 |
| 2G 机内存再紧 | Node 服务 `MemoryMax=160M` + 实测；SQLite 无常驻进程；必要时 `--max-old-space-size=96` |
| 服务器无 Go/Node 运行时 | 交叉编译 `CGO_ENABLED=0` 静态二进制；systemd `ExecStart=/opt/journal/journal-server`，服务器零依赖 |
| Cookie 与博客冲突 | Cookie `Path=/journal`，名字带前缀 `sj_sid` |
| 换栈学习成本 / 模型写错 | 先做 `internal/domain` 领域逻辑 + 单测，再写路由；每个 PR 小于 400 行 diff；`verify.sh` 必绿 |
| 切换后发现严重 bug | 14 天内可 nginx 一步回滚 |
