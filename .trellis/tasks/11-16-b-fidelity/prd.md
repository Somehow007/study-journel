# 11-16-b-fidelity — B 格纸 UI 还原度修复（M8 稳定期小修）

## 问题 / 目标

2026-11-16 用概念稿同款种子数据在 1440 / 390 两档逐页对照 `design/concepts-v6/shots/b-notebook/`，结论：
组件层（token、nb-* 原子、弹层、登录）还原 85–90%，**整页版式只有 50–60%**。M6/M7 走查只断言 DOM 存在 + 零 pageerror，没看版式，所以没发现。

目标：把整页还原度拉到 ≥85%，并留下一个可重复的视觉对照脚本，避免再退化。

评审证据（本机临时文件，不入库）：`/tmp/sj-review/impl/*.png`、`/tmp/sj-visual/report.html`。

## 根因与问题清单（按影响排序）

| # | 问题 | 根因 / 位置 | 卡 |
|---|---|---|---|
| 1 | 统计 / 年度 / 目标详情 / 搜索 / 设置 / 时光整页被挤到 500–720px，标题逐字竖排、KV 数字重叠、盖章圈变椭圆 | `components/Layout.tsx` L12-17 旧 UI 遗留按路由 `maxWidth`（1240/880/720），再叠 `px-7` + `.nb-book` margin 36px 双重留白 | S1 |
| 2 | 手机端是「桌面上放一张卡」，顶部浪费 ~130px，左右各少 ~30px；概念稿是整屏方格纸 | `styles/journal-b.css` L50 `@media(max-width:767px) .nb-book{margin:16px 12px 24px}` + Layout 容器 padding + `.nb-mhead` 在纸外 | S2 |
| 3 | 日历日期号垂直居中而非左上角；390 宽下与时长数字重叠 | `components/CalGrid.tsx` L66-74：日期号是 `<button>` 的裸文本节点，button 天生垂直居中内容 | S3 |
| 4 | 状态色规则两套：日历格 / 图例用每态自有色（平稳蓝、焦虑黄），时光 / 统计用红笔-灰两色 | `CalGrid.tsx` L76、`MonthView.tsx` L166 用 `cfg.ink`；`Memory.tsx` L174/206、`Stats.tsx` L265/272 用 polarity | S4 |
| 5 | 日历右栏「本月待办 3 / 54」数字错（种子只有 7 个任务） | `MonthView.tsx` L73-79 把每天 `taskTotal` 求和；后端 `TaskRelevantOn` 让未完成过期任务在之后每天都 relevant → 重复计数 | S5 |
| 6 | 计划页清单型目标不展开子任务、无「+ 加一条子任务」 | `PlanView.tsx` 清单型复用 `GoalRow`（只有进度条）；`GoalSummary` 不含 tasks | S6 |
| 7 | 今日页待办 = 目标进度块 + 完成/取消大按钮，比概念稿平铺勾选清单重；无今日任务的清单目标还显示「0 / 0 项今日任务」；日记「写/看」浮在正文上；条目 × 常显 | `components/TodayGoalsSection.tsx`、`components/DiaryEditor.tsx` L101-143、`components/LearningRecordCard.tsx` L36-43 | S7 |
| 8 | 细节：周进度标签「第 N 周」（概念稿为日期段）、盖章圈非正圆、number 原生 spinner、色块被 `pressable-icon` 撑大、大字标题无 nowrap 兜底 | 见 S8 | S8 |
| 9 | 缺进度节奏提示「落后 18 题 / 按计划 / 领先 1 章」 | 前后端都没有该派生值；属契约 + 领域层改动 | S9（可选） |

## 已拍板的决策（owner 授权 agent 定夺，2026-11-16）

1. **状态色 = 按极性，不按每态自有色**（SPEC-B §2 原文）。B 主题下状态文字色：`polarity >= 0` → `var(--brand)`（红笔），`polarity < 0` → `var(--ink-faint)`。
   - 理由：B 的视觉语义是「红笔批注 = 好的一天」，一眼可读；时光 / 统计已这么做，统一即可；自定义状态天然有 polarity，无需新配置。
   - 每态主色 `color` 仍保留并用于：设置页色块、StateEditModal 预览、未来 A/C 主题。收口成一个 helper，主题切换时只改 helper。
2. **桌面容器**：格纸页面不再按路由限宽；外层统一 `max-width: 1600px` 居中，留白只由 `.nb-book` 的 margin 负责（与概念稿 1440 下书宽 ≈1370px 一致）。
3. **手机**：整屏纸面（`.nb-book` 去 margin / 边框 / 阴影），手机头放进纸面内；**不**改为按页显示标题（会与各页大标题重复），保持品牌 + 搜索 / 设置 + 印章。
4. **本月待办口径** = 当月清单型目标的子任务去重计数，直接用 `useGoalsByPeriod` 的 CHECKLIST `actualValue / totalValue` 求和，不改后端。
5. **计划页子任务**：右页逐个清单目标展开子任务（勾选交互复用 TodayGoalsSection 的完成 Sheet 流程）；「+ 加一条子任务」跳转 `/plan/:id`（详情页已有表单），不在计划页内联新建。
6. **今日待办**：改平铺清单——清单任务一行一个勾选框；数量目标也一行（勾选 = 今日已打卡）；右侧小字为目标名；无今日任务的清单目标不显示。
7. **节奏提示（S9）做，但排最后、可选**：服务端 domain 计算 + `domain-cases.json` 双端对齐 + API 新字段，属 AGENTS §2.3 契约改动。建议由较强模型执行或 owner 复核 diff 后再合。

## 执行顺序与依赖

```
S0 视觉对照脚本 ──┬─> S1 桌面容器 ──> S2 手机整屏纸面
                  ├─> S3 日历格子（含手机隐藏状态字）
                  ├─> S4 状态色统一
                  ├─> S5 本月待办计数
                  ├─> S6 计划页子任务
                  ├─> S7 今日页待办 / 日记工具条 / 删除悬停
                  └─> S8 细节杂项（建议在 S1 之后，很多细节在宽度修好后自然消失）
S9（可选）节奏提示：S6、S7 之后
```

S0 必须最先做；S1 第二。S3–S7 互不依赖，可任意顺序，但**一次只做一张卡**。

## 执行者守则（便宜模型必读）

1. 开工前读：本 prd → 对应 `cards/Sx-*.md` → 卡里列出的源文件（全文读，不要只读片段）。仓库约定见根目录 `AGENTS.md`。
2. **一张卡 = 一个 commit**；只改卡里「改动范围」列出的文件。发现还需要改别的文件，先停下，把原因写进该卡末尾「执行记录」，不要自行扩大范围。
3. 卡里的前提与代码不符（行号漂移可以，逻辑不符不行）→ 停下记录，不要猜。
4. 每张卡收尾必须：
   - `./scripts/verify.sh` 全绿；
   - S0 之后：`./scripts/visual.sh <卡里列的页面>`，打开 `report.html` 逐图对照，**并读截图确认**（不能只看脚本输出）；报告顶部必须是「零 pageerror / 零横向溢出」；
   - 在卡末尾「执行记录」写：改了什么、验收结果、遗留问题；
   - `.trellis/CHANGES.md` 尾部追加一行 `- 日期 | 事件 | → .trellis/tasks/11-16-b-fidelity/cards/Sx-*.md`。
5. 禁止：改后端（S9 除外）、改 `db/`、改 `deploy/`、加依赖、全仓格式化、顺手重构、删未读过的文件、碰 8090 端口的服务或 `apps/server/journal.db`。
6. 提交：作者 = 用户本人（不改 git config），message 用卡里给的建议标题，**禁止 `Co-authored-by`**；提交前 `git diff --cached | rg -i 'key|secret|password|token'` 自查（种子里的 `visual1234` 是一次性临时库口令，允许）。不 push。
7. 全部卡完成：本 prd 末尾补 `## Resolution`，目录移到 `.trellis/tasks/archive/2026-11/`，CHANGES 追加归档行。

## 验收（整体）

- 12 页 × 1440 与 6 页 × 390 对照报告：无竖排折行、无数字重叠、无横向溢出、零 pageerror。
- 日历「本月待办」与计划页清单子任务总数一致。
- 状态色全站同一规则（日历格、图例、时光、统计、今日状态选择）。

## Resolution

（全部卡完成后填写）
