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
收尾轮：S8 + S9 之后——走查补记未决项 + 各卡遗留统一处理
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

## 走查补记（2026-11-16 · S0+S1 后全量目检）

对照 `/tmp/sj-visual.qVEf09/report.html`（12 桌面 + 6 手机）：

**S1 已修复确认**：统计/年度/目标详情/搜索/设置/时光整页铺开（1440 书宽 1368 实测），各页大标题单行、KV 不折行、数字不重叠；盖章圈恢复近圆。

**原清单逐项仍在（等卡处理）**：S2 手机仍为「桌面放卡」（纸有边框+margin，品牌头是纸外白条；概念稿整屏格纸、头在纸内）；S3 日历日期号垂直居中、状态字独占一行，390 下状态字/日号/时长三重叠（截图可见 8.0h 压 11）；S4 日历格状态字与图例仍每态色（平稳蓝等）；S5 本月待办 3/52（种子仅 7 子任务）；S6 计划清单型无子任务行/无「+加一条子任务」，右页空旷；S7 今日待办进度块+完成/取消大按钮、清单目标显示「0/0 项今日任务」、日记「写/看」浮压正文（截图可见）、条目×常显；S8 周标签仍「第N周」、盖章圈个别微椭圆；S9 节奏提示缺（现为「还差 458 题」，概念稿「落后 18 题/按计划」）。

**原清单外新发现（2026-11-16 已分流）**：
1. **学科分布标签列过窄**：stats/annual 两页共享 `nb-table`，「数学一/英语一/政治」逐字竖排折行（基线即有）→ **已并入 S8 组1**。
2. **手机日历底部块差异**：概念稿日历下有「11.15·今天 5h45m + 科目」当日小计块；实现右栏降为底部「本月小计」，无当日块（MonthView 渲染差异，非纯 CSS）→ **留收尾轮**，届时定夺按概念稿补 or 维持。
3. **搜索页语义差异**：过滤 tabs 为 全部/日记/学习记录（概念稿 全部/学科/日记/备注），结果类型标「条目·408」（概念稿「学科·408」）→ **留收尾轮**（产品决策：对齐概念稿 or 记录为有意简化）。
4. **目标详情缺「编辑」入口**：已核实 `lib/goalApi.ts` 有 `PATCH /goals/:id`，纯 UI 缺口（需定入口位置、复用 GoalFormModal）→ **留收尾轮**。
5. 设置页日期输入带原生 date-picker 图标 → **已并入 S8 组4**（评估项，可放弃）；外观选项 2 个（概念稿 3 个）→ M10 范围，不在本任务。
6. 时光页 14672px 整页长滚 → 暂判可接受，**收尾轮复核**。
7. **S1 执行遗留**：`QueryLoading`/`QueryError` 在 `.nb-book` 外、宽容器下通栏 → **已并入 S8 组5**。
8. **768–855px 视口带全页横向溢出 ~88px**（S3 后走查发现）：`.nb-topnav-right`（255px）+ `.nb-stamp`（156px）桌面顶栏右簇固定宽度，视口 < ~856px 放不下，媒体断点 767 → 窄桌面/平板带全页横滚。所有页面一致 → **留收尾轮**（收拢顶栏 / 提前断点 / 接受）。
9. **长状态名边界**（S3 后走查发现）：`.nb-cal-state` 无 `nowrap`/宽限，>4 字自定义状态在窄格（today 86px）换行垂入格内可能压时长。内置状态均 2 字，低优先 → **留收尾轮**（可选 `nowrap`+`max-width`）。

**收尾轮（S9 之后统一做）**：所有 S 卡完成后，汇总①本节未决项（2/3/4/6）②各卡「执行记录」里的遗留问题③执行中新发现——一次走查 + 逐项定夺（修 or 记录为有意差异），修完补 prd `## Resolution` 并归档。收尾轮同样一条一 commit。

### 走查补记（2026-11-16 · S4 后全量目检）

- 覆盖：`visual.sh` 全量 12 页×1440 + 6 页×390（报告 `/tmp/sj-visual.uqoSxf/report.html`）**零 pageerror / 零横向溢出**；playwright DOM 探针 18 项断言全过（本模型无视觉，以 computed-style/DOM 几何断言代替目检，截图留 `impl/` 供 owner 复核）。
- **S4 验证**：状态色极性规则全表面一致——日历格（16 处）、状态图例（6 态）、今日迷你日历、时光（16 条）、统计状态记数（6 行）：专注/顺利/平稳 = brand 红笔、疲惫/焦虑/低落 = ink-faint 浅墨（亮 `#D23B22`/`#8D919A`，暗 `#FF7A5C`/`#6E7686`，polarity 取自 `/api/v1/states` 服务端权威逐一比对）；MoodSelector 未选中浅墨/选中红圈不变，日详情页选中态红笔。
- **回归**：S3 日历日期号顶部定位（offset=6px）、手机 `.nb-cal-state` `display:none`、`.nb-cal-dur small` 隐藏均保持；plan/annual/search/settings 页面正常渲染；暗色主题抽查（calendar 图例 + memory）通过，测后已还原 notebook。
- **新发现**：无。S4 为纯颜色重构，无版式改动；AnnualReview「最常状态」标签不着色为既有设计（不在本卡范围，概念稿未要求）。

### 走查补记（2026-11-16 · S5 后走查）

- 覆盖：临时库补种子（10 月 COUNT-only / 9 月 CHECKLIST 1/3 / 8 月空 CHECKLIST）+ DOM 探针 14 项断言全过——当月 3/7、COUNT-only 月 0/0、非当月 CHECKLIST 1/3、空清单 0/0、跨年 pager 正确、加载显「—」不闪 0、计划页合计一致、1440/390/暗色/活数据重取全过、零 pageerror。
- **新发现 1 条 → 留收尾轮**：`/goals?period=` 查询失败时「本月待办」降级显示「完成 0 / 0 项」（错误被显示成真 0，略有歧义）；次要查询、卡面未要求错误态，可选改「—」或接受现状。

### 走查补记（2026-11-16 · S6 后走查）

- 覆盖：`visual.sh` 全量 12 页×1440 + 6 页×390 **零 pageerror / 零横向溢出**（报告 `/tmp/sj-visual.wf3Zmg/report.html`）；DOM 探针 25 项断言全过 + 0 任务边界补充探针（探针 `probe-s6-walk/empty.tmp.mjs` 用后已删，截图 `/tmp/sj-s6-walk/`）。
- **S6 验证**：任务行顺序 = API `sort` 序逐字一致；「+ 加一条子任务」x 坐标 = 任务行左缘（左对齐，同概念稿，非右对齐）；加载期每清单块各出 `.animate-pulse` 骨架且标题行先渲染；`taskWhenLabel` 三分支全覆盖——dueDate→`MM/DD`（种子）、weekStart→`11/16–11/22` 区间、无绑定→`本月随时`；活数据链路——API 直接完成王道一任务，重载计划页 `3 / 5 项` done=3（非陈旧缓存）；暗色主题 `data-theme=journal-notebook-dark`+`.dark`，computed 色精确命中（+子任务 `rgb(255,122,92)`=#FF7A5C、勾选框边 `rgb(228,230,234)`=#E4E6EA、完成行 `rgb(110,118,134)`=#6E7686、计数 `rgb(169,176,189)`=#A9B0BD），零横向溢出；手机 390 任务行/em/链接 bounding box 全可见，零溢出。
- **观察项（不改，记录）**：真·0 任务清单目标 val 显示「0%」（`totalValue=0` → percent 回退分支），与改前 `GoalRow` 清单分支同口径，非回归；块仍正常渲染 0 任务 + 「+ 加一条子任务」。每清单目标一次 `/goals/:id` 请求（卡面已认可 ≤4）。
- 遗留：无新增；收尾轮未决项不变。

### 走查补记（2026-11-16 · S7 后走查）

- 覆盖：`visual.sh` **全量 18 组合**（12 页×1440 + 6 页×390，报告 `/tmp/sj-visual.dBoOOK/report.html`）零 pageerror / 零横向溢出；卡面探针 48 项 + 走查探针 24 项断言全过（临时库同 visual.sh 口径，两轮探针用后已删）。
- **S7 验证**：待办 4 行平铺（2 COUNT 已记 + 408 两任务一勾一未勾，任务行 em=目标名；马原 0 行不出行）；头部「3 / 4」与 DOM 勾选行数一致；无 `nb-goal`/`nb-meter`/`nb-btn`/「项今日任务」；日记工具条 computed `position:static` 置于文本区上方、编辑/预览 `paddingRight=2px`；删除钮桌面 `opacity 0→tr:hover 1→移开 0`、390 常显 1；交互四项全过（任务行出「记下完成」Sheet 副标题=任务名、已勾任务取消去 `on`、COUNT 取消打卡「已记→今日」再点出 Sheet 副标题=目标名）。
- **走查补充（边界/主题）**：暗色 `journal-notebook-dark` computed 色精确——行文字 `rgb(228,230,234)`(#E4E6EA)、em/完成行字 `rgb(110,118,134)`(#6E7686)、删除线与 `.nb-chip.on` `rgb(255,122,92)`(#FF7A5C)、`.nb-box` 边同 ink；删除钮暗色下 hover/focus-within/blur 显隐均正确。空态（2026-10-15 无目标月）：`今天没有待办任务`+「去制定 →」+0 行，桌面/手机一致。未来日 2026-11-18（对照 `TaskRelevantOn` 语义）：恰 4 行——两 COUNT 未打卡「今日 36 题/今日 1 套」、`7.4 课后选择题` 带「过期」标记、`7.5 散列表` 无标记；已完成/未到期任务均不出行，头部「0 / 4」。learn-form「+ 补一条」弹层正常打开。
- **观察项（不改，记录）**：COUNT 行勾选态整行删除线含目标名（`nb-todo.on` 统一口径）；`rows=0` 空态已由走查覆盖（上月无目标日实测通过）。

### 走查补记（2026-11-16 · S8 后走查）

- 覆盖：shot.mjs 全量 11 桌面 + 6 手机**零 pageerror / 零横向溢出**（报告 `/tmp/sj-s8-walk/report.html`）；综合探针 `probe-s8-walk.tmp.mjs` + 补验 `probe-s8-walk2.tmp.mjs`（用后已删，截图 `/tmp/sj-s8-walk/`）。
- **组1**：1440/1024/390 三档 stats/annual/goal `.nb-date-num/.nb-sec/.nb-k/.nb-kv b` computed `white-space:nowrap` 全在；`.nb-kv b` overflow+ellipsis 在；`.nb-k` Range 逐字行数=1（科目名单行实证非仅靠样式）；`.nb-sec` 高<30、`.nb-date-num` 高<70；`.nb-date-meta` 1440/1024 均横排（metaH<50，1024 chips/pager 折行自然）；390 KV 两列全显、零溢出。
- **组2**：1440/390 `.nb-stamp-circle` 全正圆（|w-h|≤1px bbox、painted 圆更稳）、transform matrix 存在、旋转角实测 ∈[-11,11]°（含 sign 双向）、`.nb-cal-d` 几何零重叠（390 实测）；`.nb-ww` 全为 `MM.DD–MM.DD`（6 行正则全过）且 390 scrollWidth≤clientWidth。截图人工目检：圈居中、不压日号、有手写盖章感。
- **组3**：清单目标详情 `.nb-taskmeta` 实测渲染 `11/16–11/22`（weekStart=2026-11-16，addDays 口径与旧实现东八区输出一致）。
- **组4**：goal-form 8 枚色块全 `BUTTON` 26×26、点击第 2 块 borderColor 由 ink→brand 实证选中态；learn-form「其他…」分支同型断言过；number 输入 computed `appearance=textfield`（goal-form + settings 自定义分钟框）；settings `type=date` 存在且 webkit 图标隐藏（截图无图标）。
- **组5**：强造 QueryError（404 goal）与 QueryLoading（route 延迟 days API）均 w≤640、left≈400 居中；截图观感正常。
- **暗色抽查**：`PATCH /settings theme=notebook-dark`（curl 直调 API——ctx.request 未带登录 cookie 首试失败，非产品问题）→ data-theme=`journal-notebook-dark`，盖章圈 computed 色 `rgb(127,162,230)`（暗色蓝笔）、`.nb-kv b` nowrap 保持、周标签日期段保持、圈尺寸正常；测后还原 notebook。
- **3 个初 FAIL 全部澄清（非缺陷）**：
  1. 「压日期号」1440 探针 7 格报 FAIL——`getBoundingClientRect` 量的是**旋转后方盒 bbox**（±10° 让 56px 方盒角外扩 ~3px），painted 圆（border-radius 50% 内切于方盒、旋转不变）顶边距日号底 ~3px，截图人工确认无视觉重叠。探针口径记录在案，不改代码。
  2. settings `.nb-swatch`=0——种子无自定义状态/归档科目，该页 span 色块条件渲染为空属正常；临时建「走查临时」状态后实测 `SPAN` 26×26 PASS，已 archive 清理。
  3. `ctx.request.patch` theme 失败——Playwright request context 未带登录 cookie；改 curl 带 cookie 直调 API 成功，非产品问题。
- **新发现**：无。S8 全为 CSS/展示层小修，无版式回归。
- 遗留照旧：收尾轮未决项（手机日历底部块、搜索页语义、目标编辑入口、时光页长滚、768–855px 顶栏、长状态名边界）+ S8 卡内 3 条（`.nb-date-meta` nowrap、Firefox date 图标、`.nb-swatch:active` 反馈）。

### 终验（2026-11-16 · S1–S8 完成，S9 延后）

> 同日追记：S9 已完成（`db9822d` + `1bbba50`），见 `cards/S9-pace-hint.md` 执行记录；剩收尾轮。

- **范围合规**：`e20167f..HEAD` 共 26 commit，作者均为用户本人、零 `Co-authored-by`；改动仅 `apps/web/src`、`apps/web/scripts/visual`、`scripts/visual.sh`、`.trellis`，另 `vite.config.ts`（S0 visual 用 env 覆盖代理/关自动打开，默认行为不变）与 `AGENTS.md`（S0 登记 visual.sh）；未动后端/`db/`/`deploy/`、无新依赖、无硬编码色值新增；`new Date('YYYY-MM-DD')` 违例已清零。
- **验证**：`./scripts/verify.sh` 全绿（web tsc+build、server gofmt/vet/test、sqlc 一致）；`./scripts/visual.sh` 全量 12×1440 + 6×390 **零 pageerror / 零横向溢出**（`/tmp/sj-visual.JXOtPz/report.html`）。
- **目检（本轮由有视觉的模型逐图看过，补此前「无视觉、以 DOM 断言代替」的缺口）**：
  - 验收 1 无竖排/重叠/溢出：统计、年度（「二〇二六」单行）、目标详情（盖章正圆、周标签日期段）、搜索、设置整页铺开；手机整屏方格纸、头在纸内、KV 两列正常 ✓
  - 验收 2 日历「本月待办 3 / 7」= 计划页 408「2 / 5」+ 马原「1 / 2」✓；计划页清单子任务展开 + 「+ 加一条子任务」✓
  - 验收 3 状态色全站极性一致（日历格/图例/今日选择/统计记数：专注顺利平稳红笔，疲惫焦虑低落浅墨）✓
  - S3 日期号左上、手机隐藏状态字无重叠 ✓；S7 今日待办平铺、日记写/看在文上方 ✓；S8 表单色块 26px ✓
- **截图口径说明**：手机今日页仅末行显示删除 ×——shot.mjs 的 390 context 未设 `hasTouch`，Chromium 仍匹配 `(hover: hover)`，× 显示的是鼠标所在行的悬停态；真机触屏走 `hover: none` 常显。非缺陷，可选在收尾轮给 mobile context 加 `hasTouch/isMobile` 让截图贴近真机。
- **新发现 → 留收尾轮**：统计页「近 26 周学习热力」首列月份标签与次列相撞（「5月6月」粘连，1440/390 均现）；M7 存量，非本任务回归。
- **结论**：S1–S8 验收通过，整页还原度达到 prd 目标。任务**不归档**——待 S9（可选，较强模型或 owner 复核契约 diff）与收尾轮完成后再补 `## Resolution` 并归档。

## 验收（整体）

- 12 页 × 1440 与 6 页 × 390 对照报告：无竖排折行、无数字重叠、无横向溢出、零 pageerror。
- 日历「本月待办」与计划页清单子任务总数一致。
- 状态色全站同一规则（日历格、图例、时光、统计、今日状态选择）。

## Resolution

**2026-11-16 完成并归档。** S0–S9 全部落地 + 收尾轮 18 项逐项定夺。整页还原度从 50–60% 拉到与组件层同档（逐图目检三条整体验收全过），并留下 `scripts/visual.sh` 防退化。

### 收尾轮定夺（owner 授权 agent 按 UI 设计角度定夺 4 项产品取舍）

| # | 项 | 定夺 | commit |
|---|---|---|---|
| 1 | S9 节奏期望含当天份额 | **改**：只算到昨天（今天未结束不计入；与清单型「今天到期不算逾期」同口径），domain + 双端用例 8 条同步 | `4af03c5` |
| 2 | 热力图月份标签粘连（终验新发现） | **修**：相距 <3 列时让位新月 | `7b92a1c` |
| 3 | 暗色 `--grid-size` 缺失（S2） | **修**：暗色块补 20px（消费方仅 journal-b.css 两处 background-size） | `0d517a6` |
| 4 | 768–855px 顶栏全页横滚（S3） | **修**：≤1023 收起品牌/印章副文案、收紧间距；768–1024×5 页零溢出 | `ffeeeb3` |
| 5 | 长状态名折行压时长（S3） | **修**：单行省略 + title 全名；格宽 <54px（容器查询）同手机隐藏状态字——768–1440 九档实测无 2 字截断、无贴日期号 | `7294256` `aafe647` |
| 6 | 本月待办查询失败显 0/0（S5） | **修**：加载与失败都显「—」 | `3f26b09` |
| 7 | 清单子任务加载失败静默空列表（S6） | **修**：提示 + 重试 | `c1f6eda` |
| 8 | 目标详情缺「编辑」（未决 4） | **补**：按概念稿放「结转下月」前；GoalFormModal 编辑模式——类型锁定、颜色只在改动时提交（不把「随科目色」固化） | `a518bf7` |
| 9 | 手机日历当日小计块（未决 2） | **补**：手机上看日历最常问「今天学了多少」；日历下「MM.DD · 今天 + 时长 + 当日科目」，点按进今日；本月小计保留其后；桌面不显示 | `81531da` |
| 10 | 搜索语义（未决 3） | **部分对齐**：保留 全部/日记/学习记录 三 tab（日记玩法保留，owner 要求）；结果标签「条目」改「学习记录」与 tab 同名；概念稿「学科/备注」分 tab 需改搜索契约，收益低，记为有意差异 | `c40ee93` |
| 11 | `.nb-swatch` 无按压反馈（S8） | **修**：`:active` scale(.92) | `d28b392` |
| 12 | 截图手机档非触屏（终验新发现） | **修**：visual 手机 context `hasTouch/isMobile`，命中 `hover:none` 与真机一致 | `20f6e35` |
| 13 | COUNT 行勾选删除线含目标名（S7） | **维持**：与清单任务同口径，「做完了」信号最清楚 | — |
| 14 | 时光页整页长滚（未决 6） | **接受**：时光是按时间倒序的回看流，长滚即其形态；无性能问题 | — |
| 15 | `.nb-date-meta` 未 nowrap（S8） | **接受**：靠 `.nb-date` wrap 兜底，设计内 | — |
| 16 | Firefox date 原生图标（S8） | **接受**：低优先，不影响功能 | — |
| 17 | 0 任务清单目标 val 显 0%（S6） | **接受**：与改前同口径，非回归 | — |
| 18 | 节奏字 390 下折到第二行（S9） | **接受**：右对齐可读、零溢出 | — |

### 收尾轮验证

- `./scripts/verify.sh` 每 commit 全绿（Go domain/httpapi + vitest 双端 54 条）。
- `./scripts/visual.sh` 全量 12×1440 + 6×390 零 pageerror / 零横向溢出（`/tmp/sj-visual.A4wiwB/report.html`），逐图目检：手机日历当日块同概念稿、热力图标签不粘连、详情「编辑」按钮、触屏截图每行 × 常显、搜索标签、节奏「领先 42 题」（542 − ⌊1000×15/30⌋）。
- 一次性探针（独立 8091/5176 临时库，用后已删）：顶栏 768/800/855/900/1023/1024 × 5 页零溢出；长状态名 9 档宽度断言；编辑预填/保存/颜色未固化；色块按下 matrix(0.92)；暗色 background-size 20px；本月待办 500 显「—」；清单块 500 显提示、重试恢复；触屏命中 hover:none；手机当日块可见可点、桌面隐藏；全程零 pageerror。

### 后续方向

- 上线：本任务含后端改动（pace 字段 + 节奏口径），部署需全量 `deploy.sh`（先 Go 后 web）。
- 概念稿「学科/备注」分 tab 若日后要做，单开任务改搜索契约。

