# S9（可选）目标节奏提示「落后 N / 按计划 / 领先 N」

> **契约 + 领域层改动（AGENTS §2.3），建议较强模型执行，或便宜模型执行后由 owner 复核 diff 再合。** 依赖 S6、S7。

## 问题 / 目标
概念稿在计划页每个目标行右下、今日右页「本月目标」每行下方显示节奏：COUNT「落后 18 题 / 按计划 / 领先 3 题」，CHECKLIST「逾期 1 项 / 按计划」。考研场景里这是最有用的一句反馈。现在前后端都没有这个派生值。

## 规则（唯一权威在 Go `internal/domain`）
- COUNT：`elapsed = daysBetween(periodStart, asOf) + 1`（asOf 已由 `AsOfForPeriod` 钳制到本月内）；`expected = floor(target * elapsed / daysInMonth)`；`pace = actual - expected`。
- CHECKLIST：`overdue = 未完成且 dueDate < asOf 的任务数`（只有 weekStart 的任务：`weekStart + 6 < asOf` 算逾期；都没有的不算）；`pace = -overdue`。
- 派生值读时计算，不落库（AGENTS §3）。
- 前端展示：仅当 `period == 当前月` 且 `!reached` 时显示；`pace > 0` →「领先 N {unit}」`var(--success)`；`pace == 0` →「按计划」`var(--success)`；`pace < 0` → COUNT「落后 |N| {unit}」/ CHECKLIST「逾期 |N| 项」`var(--brand)`。

## 改动范围
1. `apps/server/internal/domain/progress.go`：新增 `PaceCount(target, actual int, period, asOf string) int`；`tasks.go` 新增 `OverdueTasks(...)`（参数照现有 `TaskRelevantOn` 风格）。单测写进 `domain_test.go` / `tasks_test.go`。
2. `testdata/domain-cases.json`：新增 `paceCount` 用例 ≥4 条（月初 / 月中领先 / 月中落后 / 月末）；`apps/web/src/lib/domain.ts` 加同名 `paceCount`，`domain.test.ts` 的 switch 加分支（参照 L82 `goalProgressCount`）。Go 侧读取 domain-cases 的测试同样加分支（`rg -n "domain-cases" apps/server` 找到入口）。
3. `apps/server/internal/httpapi/goals.go` `computeSummary`（L80）：`goalSummary` DTO 加 `Pace *int \`json:"pace"\``（COUNT 与 CHECKLIST 都填）；CHECKLIST 需要任务列表——确认 `computeSummary` 调用处是否已加载 tasks，没有则在 listGoals 里批量查一次（**不要 N+1**），这一点写进执行记录。`TodayGoalItem`（L723 附近）同样带出 `pace`。
4. `apps/web/src/lib/types/api.ts`：`GoalSummary`、`TodayGoalItem` 加 `pace: number | null`。
5. 展示：`PlanView.tsx` `GoalRow` 的 `nb-goal-meta` 末尾、`ChecklistGoalBlock` 标题行下；`TodayDetail` 右页「本月目标」每行下（`rg -n "本月目标" apps/web/src`）。抽一个 `PaceText({ pace, unit, type })` 小组件放 PlanView 同文件并导出，或放 `components/`，二选一写进执行记录。

## 消费点
- 执行前 `rg -n "computeSummary|goalSummary|GoalSummary|TodayGoalItem" apps` 全量列出并贴进执行记录。
- API 新增字段为向后兼容（只加不改）。

## 验收
- `./scripts/verify.sh` 全绿（含 Go test 与 domain-cases 双端）。
- `./scripts/visual.sh plan,today`：种子下 1000 题目标显示「落后/领先 N 题」且 N 与手算一致（写进执行记录：target 1000、actual、今天日号、当月天数 → expected）；408 目标在有逾期任务时显示「逾期 N 项」。
- 上个月 / 下个月不显示节奏。

## 提交（拆 2 个）
1. `feat(server): 目标节奏 pace 派生值——domain 规则+双端用例+summary 字段`
2. `feat(web): 计划/今日显示目标节奏 落后/按计划/领先`

## 执行记录
### 方案与消费点（2026-11-16，动手前）

- **消费点**（`rg -n "computeSummary|goalSummary|GoalSummary|TodayGoalItem" apps`）：
  - server `httpapi/goals.go`：`goalSummaryDTO`（L16，被 `goalDetailDTO` 内嵌 → `/goals/:id` 也带出）、`computeSummary`（L80）三处调用——`listGoals` L204（asOf=today）、`goalDetail` L417（today）、`todayGoals` L714（asOf=查询日 date）；`todayGoals` 的局部 `item` 结构即 TodayGoalItem。
  - web `lib/types/api.ts` `GoalSummary`(L127)/`GoalDetail extends`/`TodayGoalItem`(L175)；读方 `PlanView.tsx`（GoalTitle/GoalRow/ChecklistGoalBlock）、`TodayGoalsSection.tsx`（TodayGoalItem，只读不展示 pace）、`TodayDetail.tsx` 右页「本月目标」（数据源是 `useGoalsByPeriod` 的 GoalSummary，不是 TodayGoalItem）。
  - 只加字段不改旧字段，向后兼容；旧前端忽略未知字段。
- **N+1**：`computeSummary` 已经拿到该目标的 tasks——三处调用方都先 `loadGoalBundle` 按 period 一次批量取 tasks+checkins（`ListTasksForUserPeriod`），CHECKLIST 逾期计数无需新增查询。
- **domain**：`progress.go` 加 `PaceCount(target, actual, period, asOf) (int, error)`，函数内部再 `AsOfForPeriod` 钳一次（与 `RemainingDays` 自钳同风格，防调用方漏钳）；`tasks.go` 加单任务谓词 `TaskOverdue(done, dueDate, weekStart, asOf) (bool, error)`（照 `TaskRelevantOn` 风格；卡面名 `OverdueTasks` 改为谓词形，计数在 httpapi 循环里做，与 TaskRelevantOn 用法一致）。dueDate 优先：有 dueDate 只看 dueDate，否则看 weekStart+6。
- **双端用例**：`domain-cases.json` 加 `paceCount` ≥4 条 + 前端 `domain.ts paceCount` + `domain.test.ts`/Go `runDomainCase` 分支；`TaskOverdue` 单测进 `tasks_test.go`（卡面未要求前端镜像，前端只展示服务端值）。
- **展示**：`PaceText` 放 `components/PaceText.tsx`（PlanView 与 TodayDetail 两处共用，避免页面间互相 import）；显示条件 `pace != null && period == 当前月 && !reached`。

### 执行记录（2026-11-16）

- **commit**：`db9822d feat(server)`（domain `PaceCount`/`TaskOverdue` + 单测、`domain-cases.json` 7 条 `paceCount`、前端 `domain.ts paceCount` + `domain.test.ts` 分支、`goalSummaryDTO.Pace`/today item `pace`、`api.ts` 两类型加 `pace`、httpapi 集成测试断言 COUNT pace=domain 值 / CHECKLIST 今日到期 pace=0 / today 接口每项带 pace）；`1bbba50 feat(web)`（`components/PaceText.tsx` + PlanView GoalRow meta 末尾右对齐 / ChecklistGoalBlock 标题行下 / TodayDetail「本月目标」small 行首）。
- **与卡面差异**：卡面 `OverdueTasks(...)` 实现为单任务谓词 `TaskOverdue`（同 `TaskRelevantOn` 风格），计数在 `computeSummary` 循环；`PaceCount` 内部自钳 asOf；`api.ts` 类型随 commit 1 提交（属契约镜像）。N+1：无新增查询（tasks 已由 `loadGoalBundle` 按 period 批量取）。
- **验证**：`./scripts/verify.sh` 全绿（含 Go domain/httpapi 测试与 vitest 双端 53 条）；`./scripts/visual.sh plan,today` 零 pageerror / 零横向溢出，目检截图位置同概念稿（右下、落后红/其余绿）。
- **手算对账**（种子，今天 11-16，11 月 30 天）：1000 题 actual 542，expected=⌊1000×16/30⌋=533 → 「领先 9 题」✓；英一 8/11，expected=⌊11×16/30⌋=5 → 「领先 3 套」✓；408 / 马原无逾期 → 「按计划」✓。
- **探针**（一次性，用后已删；独立 8091/5176 临时库）：给 408 加一条 dueDate=昨天的未完成任务 → API pace=-1，计划页/今日页「逾期 1 项」✓；色值 computed 逾期 `rgb(210,59,34)`=brand、领先 `rgb(47,107,79)`=success ✓；上月/下月各建 1 个 COUNT 目标，翻月后目标可见但无任何节奏字样 ✓；1440/390 双档零 pageerror、零横向溢出 ✓。
- **观察项**：390 下 COUNT 行节奏字因 meta 折行落到第二行右对齐，可读不溢出，接受。期望值含当天份额（elapsed 含今天），早上未打卡时会显示「落后一天份额」——卡面规则如此，记录待 owner 观感反馈。
