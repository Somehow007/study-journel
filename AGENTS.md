# AGENTS.md — 学习手帐（study-journey）工程约定 v1

> 2026-11-15 建立。手帐从 mysite 博客剥离后，**本文件是本仓库唯一的 agent 约定来源**；不再受 mysite `AGENTS.md` / `CLAUDE.md` / `.cursor/rules/journal.mdc` 约束（剥离完成前，若改动涉及 mysite 侧后端（`../mysite`），额外遵守其 `AGENTS.md` 约定）。
> 只放最小约定集；新纪律先跑通再沉淀。

## 0. 先读哪

1. `.trellis/CHANGES.md` 补课：新会话/无法确定最后活跃时点 → 全文读；旧会话恢复 → 从最后活跃时点增量补（`tail -30` 只是起点）；「进度/某功能做没做」类状态问题查状态源（`docs/roadmap.md` 里程碑状态、任务档案、git log）——事件流里没有 ≠ 没做过
2. `docs/MAP.md`（现状地图）
3. 按任务读：`docs/architecture.md`（栈与架构）、`docs/data-model.md`（数据）、`docs/separation-plan.md`（剥离）、`docs/roadmap.md`（任务卡）、`design/concepts-v6/README.md` + `SPEC-<X>.md`（UI）

## 1. 验证命令（动代码前必须能跑）

```bash
./scripts/verify.sh      # 现阶段：tsc 类型检查 + vite build
```

- M1 之后升级为全工作区 `lint + typecheck + test + build`（见 roadmap M1-6），本节同步更新。
- 涉及页面的改动：额外用浏览器在 1440 与 390 宽各看一遍；有概念稿的页面对照 `design/concepts-v6/shots/`。

## 2. 改动纪律（命中任一条：先在任务 prd 写方案 / 列消费点，再动手）

1. 鉴权与会话（登录、Cookie/Token、401/403 处理、`http.ts`/`auth.ts` 或未来 `apps/server/src/auth/`）。
2. 数据模型与迁移（`db/migrations`、sqlc `db/queries`、导入导出格式、`cmd/import-mysite`）。
3. 契约与领域层：`testdata/domain-cases.json` 对齐用例、API client/types、主题变量与 `index.css` 别名；服务端领域逻辑唯一权威在 `apps/server/internal/domain`。
   → 先 `rg` 全部调用方，把消费点列进方案。
4. 部署与生产：`deploy/`、nginx、systemd、服务器上的任何操作。
5. 依赖：新增依赖需说明理由；不升级大版本（单独任务）。
6. 一次改动只做一个关注点（修 bug / 改名 / 换皮 / 升依赖 分开 commit）。

## 3. 硬约束

- **数据安全第一**：任何会删改用户数据的脚本必须先备份、可 dry-run、输出对账；生产数据操作需 owner 明确同意。
- **日期 = `YYYY-MM-DD` 字符串（用户本地日历日），禁止任何时区转换；时间戳 = Unix 毫秒整数。**
- **所有数据按 `user_id` 隔离**，user_id 只从会话解析，请求体/路径不接收。
- ID 用 `nanoid(21)`；进度、连续天数、合计等派生值读时计算，不落库。
- 业务计算服务端唯一权威在 `apps/server/internal/domain`；前端 `src/lib/domain.ts` 仅展示预览，两侧用 `testdata/domain-cases.json` 同一组用例对齐。
- 颜色只存主色，tint/ink/深色由主题派生；组件内禁止硬编码色值（科目/状态色走配置）。
- **密钥零入库**：只走环境变量 / 本地 `.env`（已 gitignore）；文档、prd 中不写真实 IP、口令。提交前 `git diff --cached | rg -i 'key|secret|password|token'` 自查。
- **commit 作者 = 用户本人，message 禁止 `Co-authored-by`**；一次 commit 一个关注点；commit 前跑 §1。
- 不 push，除非用户明确要求。

## 4. 留痕约定（trellis 轻量版，与 mysite 同构但独立）

- 任务级：`.trellis/tasks/<MM-DD>-<名>/prd.md`，记「问题 / 方案 / 验证结论 / 后续方向」；roadmap 任务卡直接复制模板（`docs/roadmap.md` §3）。
- 广播位：`.trellis/CHANGES.md` 尾部追加 `- 日期 | 事件 | → 指针`，不写细节。
- 归档：完成后把任务目录移到 `.trellis/tasks/archive/<YYYY-MM>/`，prd 末尾补 `## Resolution`。
- **跨仓库**：影响 mysite 的步骤（剥离方案 S3 切换、S4 清理）在 mysite `.trellis/CHANGES.md` 也追加一行指针；其余手帐事务只记本仓库。
- 经验沉淀：踩坑 → 最小规则进本文件。

## 5. 明确不做

- 不格式化全仓、不批量改名、不顺手重构与任务无关的代码。
- 不删未读过的文件；删除前列消费点（例如 `design/concepts/` 来源不明，保留）。
- 不在 owner 拍板前（`docs/architecture.md` §6）开工 M1。
- 不同时实现多套 UI 概念；先做选定的一套。
