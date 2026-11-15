# CHANGES — 手帐跨会话广播位

> 用法：开工先 `tail -30` 增量补课；落地即尾部追加 `- 日期 | 事件 | → 指针`，不写细节；只留最近 ~100 条。
> 2026-11-15 建立（手帐从 mysite 剥离立约）。此前历史见 mysite `.trellis/CHANGES.md` 与 `docs/study-journey-integration.md`。

- 2026-11-15 | 立约：手帐独立规范生效（AGENTS.md + .trellis + scripts/verify.sh），此后手帐事务留痕写本仓库 | → `AGENTS.md` §4
- 2026-11-15 | v6 考研向 UI 概念稿 A 石墨 / B 格纸 / C 夜读 全页面 + SPEC 落地（D 版已删） | → `design/concepts-v6/README.md`
- 2026-11-15 | 剥离设计提交：ADR-001 推荐 Hono+SQLite TS 全栈；数据模型 v3（11 表）；剥离 S0–S5；路线图 M0–M9 | → `docs/architecture.md` `docs/data-model.md` `docs/separation-plan.md` `docs/roadmap.md`
- 2026-11-15 | 待 owner 决策：D1 栈 / D2 库 / D3 鉴权（M1 前置），D5 UI 版本（M6 前置） | → `docs/architecture.md` §6
- 2026-11-15 | 任务归档：11-15-journal-v6-design | → `.trellis/tasks/archive/2026-11/11-15-journal-v6-design/prd.md`
- 2026-11-15 | 仓库搬迁：study-journey 从 mysite 工作目录移出，与 mysite 平级（../study-journey）；git/remote/未跟踪文件完整；预览服务已在新路径重启 | → 本 commit
- 2026-11-15 | owner 决策定稿：D1=Go(chi+sqlc+modernc sqlite 纯Go驱动) D2=SQLite D3=独立账号(argon2id+Cookie) D4=/journal/子路径 D5=B格纸先行(A/C上线后做扩展主题)；architecture/roadmap/data-model/separation-plan/AGENTS 已同步 | → `docs/architecture.md` §7 `docs/roadmap.md`
- 2026-11-15 | M1 完成：仓库平移 pnpm workspace（apps/web）+ Go 后端骨架（health/auth/migrate，:8090，go1.27.4）；verify.sh 升级全绿；⚠️ mysite server-deploy.sh 手帐段与新布局不兼容，M4 前勿跑 | → `.trellis/tasks/archive/2026-11/11-15-m1-go-backend/prd.md`
- 2026-11-15 | M2 完成：0002_v3 九表迁移 + internal/domain 纯函数（domain-cases.json 双端用例）+ sqlc 全资源查询 + /api/v1 业务 API（days/entries/subjects/states/goals/tasks/checkins/search/stats/streak/export/import v1-v3）+ settings 默认值与首登种子 | → `.trellis/tasks/archive/2026-11/11-15-m2-data-api/prd.md`
- 2026-11-15 | M2 走查修复：complete 空 body 双写响应等 7 处（commit 84b616f） | → `.trellis/tasks/archive/2026-11/11-15-m2-data-api/prd.md` Resolution
- 2026-11-15 | M3 开工：前端切换 Go /api/v1 + Cookie 会话 + TanStack Query + v3 类型/领域镜像 | → `.trellis/tasks/archive/2026-11/11-15-m3-frontend-api/prd.md`
- 2026-11-15 | M3 代码完成：前端切 Go /api/v1 + Cookie 会话 + v3 数据模型（commit e3a503a 契约层 + d374daa 原子切换）；typecheck/build/vitest46/verify.sh 全绿 + :8090 冒烟通过 | → `.trellis/tasks/archive/2026-11/11-15-m3-frontend-api/prd.md` Resolution
- 2026-11-15 | M3 走查+归档：Playwright 双视口 9 页+交互全过；修复条目 title/note 重复渲染与保存失败无 toast（commit 5285622）；console 仅预期 401 探测 | → `.trellis/tasks/archive/2026-11/11-15-m3-frontend-api/prd.md`
- 2026-11-15 | M4-1/M4-2 代码完成：internal/importer（MySQL sj_*→SQLite v3 + 逐项对账）+ cmd/import-mysite + journal-server backup + internal/bootstrap/domain 抽取 + deploy/（deploy.sh/journal.service/nginx 片段/CUTOVER.md）；verify.sh 全绿 + 真实本地 MySQL 演练对账全等；⚠️ M4-3 首发与 M4-4 回滚演练待 owner 按 deploy/CUTOVER.md 在服务器执行，期间勿跑 mysite server-deploy.sh | → `.trellis/tasks/archive/2026-11/11-15-m4-migration-cutover/prd.md`
- 2026-11-15 | M4-1 走查修复：force 清库改按 user_id 且并入事务、自定义状态 sort 避开内置位、备份默认落到库旁；二进制级走查（backup/-force 重迁/手插 session 过 API）全过 | → `apps/server` commit 42d25ca
- 2026-11-15 | M5 侧启动：mysite 已建任务卡 `11-15-remove-journal-module`（消费点复核+4 commit 方案+验收），执行仍待 M4-3/4 + 14 天闸门 | → mysite `.trellis/tasks/11-15-remove-journal-module/prd.md`
- 2026-11-16 | **M4-3 切流完成**：journal-server Go 服务上线（/opt/journal + systemd :8090）→ admin 账号创建 → sj_* 六表 mysqldump 归档（~/sj-mysql-backup-20261116-001803.sql.gz）→ import-mysite 迁移对账全等（8天/11条目/920分钟/11目标/38任务/2打卡）→ nginx /journal/api/ 双 server 块生效 → 新前端上线（旧前端备份 /var/www/journal.bak-20261116-004001.tar.gz）→ 冒烟全过（登录/迁移数据/导出/旧API 401仍在）→ SQLite 每日备份 cron 装好（03:15，/var/backups/journal，留14天）；回滚组件全验证（旧前端包+旧API+sj_*表+mysqldump）；M4-4 实操演练未做（组件级验证已过，live drill 待 owner 定）| → `deploy/CUTOVER.md` + mysite `.trellis/tasks/11-15-remove-journal-module`
- 2026-11-16 | 新增任务：auth 改密接口（上线临时简单凭据无自助改密途径） | → `.trellis/tasks/11-16-change-password/prd.md`
