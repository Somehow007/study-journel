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
