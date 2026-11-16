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
