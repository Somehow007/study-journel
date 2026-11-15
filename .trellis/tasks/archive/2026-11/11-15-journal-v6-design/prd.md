# 11-15 手帐 v6：考研向 UI 概念稿 + 独立剥离设计

## 问题存档

- **时间**：2026-11-15
- **来源**：owner 需求三连——①花期风格不符合审美（男生 / 学生 / 后续记录考研日常）→ 重做 UI 概念；②保留 A/B/C 三版并补全页面，便于便宜模型开发；③手帐要从博客剥离：单独的约束/广播/trellis，重新设计数据结构、迭代方案、评估换栈，最后归档广播。
- **边界**：只产出设计与规范，**未改任何业务代码**，未动 mysite 后端，未动生产。

## 怎么解决的

1. **UI 概念稿** → `design/concepts-v6/`：A 石墨 Graphite（深色仪表盘）/ B 格纸 Notebook（方格本对开页）/ C 夜读 Midnight（玻璃夜空 + 专注计时）；每版 12 页（C 13 页，含专注）+ 6–7 张手机稿，共 56 张截图；`README.md`（页面→源文件/API、数据映射、新功能、主题接入）+ `SPEC-A/B/C.md`（token 映射、状态色值、组件规则、逐页要点）。D 瑞士版按 owner 要求删除。
2. **剥离与重构设计** → `docs/`：
   - `MAP.md` 现状地图；
   - `architecture.md` ADR-001：推荐 TS 全栈单仓（React 保留 + Hono + SQLite/Drizzle + Zod 共享契约 + Cookie Session），依据 = 2G 服务器 available≈550M 不能再加 JVM、单用户数据量小、便宜模型友好；备选 Go / Java 轻框架；6 个待拍板决策点 D1–D6；
   - `data-model.md` v3：列出现模型 10 个问题（科目自由文本、条目无标题、心情混存、颜色三档入库、目标↔条目双向回写等），给出 11 表 SQLite schema、API 资源表、shared 派生计算、旧→新映射与迁移脚本规则（v2 导出不含目标 → 迁移直读 MySQL）；
   - `separation-plan.md`：S0 立约 → S1 并行建设 → S2 演练 → S3 切换（可一步回滚，旧接口只读 14 天）→ S4 mysite 清理（15 项消费点清单，实测 rg）→ S5 收尾；
   - `roadmap.md`：M0–M9 里程碑 + 任务卡（含模板）+ 考研期节奏（考前 2 个月冻结）。
3. **独立规范**：本仓库 `AGENTS.md`（验证/改动纪律/硬约束/留痕/不做）、`.trellis/CHANGES.md`、`.trellis/tasks/`、`scripts/verify.sh`。

## 验证结论

- `./scripts/verify.sh`（tsc + vite build）通过。
- 概念稿：56 张截图逐张拼图目检，修复裁切/遮挡/换行问题；总览页三版图片 0 损坏（playwright 检查）。
- 事实核验：服务器 `node v18.19.1`、`free -m` available 554M（2026-11-15 SSH 实测）；mysite journal 消费点 `rg -il` 实测；导出 DTO 确认 v2 不含目标。

## Key Decisions

- 规范落点 = 本仓库（手帐已是独立 git 仓库）；mysite `.trellis` 只留一行指针，避免双份事实。
- 先剥离（新后端 + 迁移 + 切换）再换 UI：新数据模型改变 API，UI 只做一次。
- 旧根目录两份中文设计文档不删不移，在 MAP 标注「历史 / 将被取代」。

## 后续方向

1. **owner 拍板** `docs/architecture.md` §6：D1 栈、D2 库、D3 鉴权（M1 前置）；D5 选定 UI 版本（M6 前置）。
2. 拍板后按 `docs/roadmap.md` 从 M1-1 开卡。
3. 本次产物尚未 commit（owner 未要求）；建议分 3 个 commit：概念稿 / docs 设计 / 规范（AGENTS+trellis+verify）。

## Resolution

- **日期**：2026-11-15 归档。设计与规范全部落地，待 owner 决策后进入 M1。
