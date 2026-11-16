# S6 计划页：清单型目标展开子任务

## 问题 / 目标
概念稿 plan 右页：每个清单型目标 = 标题行（科目 + 宋体标题 + 右侧 `19 / 32 章`）+ 子任务勾选列表（右侧小字截止日）+ 红字「+ 加一条子任务」。现状右页清单目标复用 `GoalRow`，只有进度条，看不到任何任务。

## 改动范围
- `apps/web/src/pages/PlanView.tsx`（新增文件内组件 `ChecklistGoalBlock`，右页改用它）
- `apps/web/src/pages/GoalDetail.tsx`（只做一件事：把文件顶部 `taskWhen` 函数移出去后改为 import）
- `apps/web/src/lib/dateUtils.ts`（接收 `taskWhen`，改名导出 `taskWhenLabel`，**逻辑原样搬运**；其中的时区问题留给 S8）

## 消费点
- `useGoal(id)`（`lib/queries.ts` L87）返回 `GoalDetail`，含 `tasks: GoalTask[]`；GoalDetail 页已在用。每个清单目标一个请求（通常 ≤4 个），可接受。
- 任务完成流程参照 `components/TodayGoalsSection.tsx` L60-115（`GoalCompleteSheet` mode=`task` → `completeGoalTask`；取消 → `uncompleteGoalTask`）。写后失效：`invalidateAll(qc)` + `qc.invalidateQueries({ queryKey: qk.goal(goal.id) })` + `qk.goals(period)`。
- 数量型左页 `GoalRow` 不动。

## 方案
1. 搬 `taskWhen` → `dateUtils.ts` 的 `export function taskWhenLabel(task: Pick<GoalTask,'dueDate'|'weekStart'>): string`；GoalDetail 改 import，行为不变。
2. PlanView 新增 `ChecklistGoalBlock({ goal, subjectColor, period })`：
   - 标题行：复用 `GoalRow` 的科目 + 标题 `Link` + `.nb-goal-val`（`actualValue / totalValue 项`）结构；**不渲染 Meter**（概念稿右页无进度格）。
   - 任务列表：`useGoal(goal.id)` 的 `tasks`，按现有 `sort` 顺序；每行 `<button className={`nb-todo${t.done ? ' on' : ''}`}>`，内含 `<span className={`nb-box${t.done ? ' on' : ''}`} />`、`<span>{t.title}</span>`、`<em>{taskWhenLabel(t)}</em>`（`.nb-todo em` 已有右对齐浅色样式）。
   - 点击：未完成 → 打开 `GoalCompleteSheet`（mode `task`，`title=t.title`，`unit=null`，`defaultDurationMin=0`，`defaultNote=t.reflection ?? ''`），确认后 `completeGoalTask(t.id, { durationMin, reflection: note, createEntry, date: todayLocal() })`；已完成 → 直接 `uncompleteGoalTask(t.id)`。失败 toast，与 TodayGoalsSection 一致。不做乐观更新（简单起见，等失效后刷新）。
   - 加载中：标题行照常显示，列表处显示 2 行 `bg-[var(--hairline)]` 骨架（照抄 TodayGoalsSection L127-131 的写法）。
   - 列表下方：`<Link to={`/plan/${goal.id}`} className="nb-sec-side red">+ 加一条子任务</Link>`（决策 5：跳详情页，不内联新建）。
   - 块与块之间用与 `.nb-goal` 相同的虚线分隔。
3. 右页 `checklistGoals.map(... GoalRow ...)` 改为 `ChecklistGoalBlock`。

## 验收
- `./scripts/verify.sh` 全绿。
- `./scripts/visual.sh plan`：右页「王道 408 一轮 2 / 5 项」下 5 条任务（前 2 条红勾删除线），「精讲精练 · 马原 1 / 2 项」下 2 条；每块末尾红字「+ 加一条子任务」。
- 手动（`pnpm dev` 或 visual.sh 起的 5176 不行——它跑完就关；用 `pnpm dev` + 自己的测试账号）：勾一条 → 弹「记下完成」→ 确认后该行变删除线、标题行计数 +1；再点取消完成恢复。目标详情页任务列表的截止日文案与改前一致。

## 提交
`feat(web): 计划页清单型目标展开子任务——勾选复用完成 Sheet，+加子任务跳详情`

## 执行记录

**2026-11-16 实施**：

- `dateUtils.ts` 新增 `taskWhenLabel(task: Pick<GoalTask,'dueDate'|'weekStart'>)`，逻辑自 `GoalDetail.taskWhen` 原样搬运（`new Date(weekStart)` 时区问题按卡留 S8）；`GoalDetail.tsx` 删本地函数改 import，详情页行为不变。
- `PlanView.tsx`：抽出 `GoalTitle`（科目 + 标题 Link，`GoalRow`/`ChecklistGoalBlock` 共用，渲染输出不变）；新增文件内组件 `ChecklistGoalBlock({goal, subjectColor, period})`——复用 `.nb-goal` 网格（虚线分隔 + `1fr 110px`）与 `.nb-goal-val`（`actual/total 项`，totalValue=0 时回退 percent%，与 GoalRow 清单分支同口径），不渲染 Meter；任务列表 `useGoal(goal.id)` 取 `tasks` 原序渲染 `button.nb-todo`（nb-box + 标题 + `em` 截止标签），加载中 2 行 hairline 骨架（照抄 TodayGoalsSection）；未完成点击开 `GoalCompleteSheet`（mode=task / unit=null / defaultNote=reflection），确认走 `completeGoalTask(..., date: todayLocal())`，已完成直接 `uncompleteGoalTask`，失败 invalidateAll + toast；写后 `invalidateAll` + `qk.goal(id)` + `qk.goals(period)` 三层失效；块末 `a.nb-sec-side.red`「+ 加一条子任务」跳 `/plan/:id`。右页 `checklistGoals.map` 由 `GoalRow` 换 `ChecklistGoalBlock`，左页数量型不动。
- 卡外零改动：未碰 CSS（`.nb-todo em` 右对齐样式已存在）、后端、其他页面。

**验证**：

- `./scripts/verify.sh` 全绿（tsc + vite build + gofmt/vet/test + sqlc 一致性）。
- `./scripts/visual.sh plan`：**零 pageerror / 零横向溢出**（报告 `/tmp/sj-visual.7NteKK/report.html`，截图 `impl/` 供 owner 复核）。
- 截图无法目检（本模型无视觉），改用 playwright DOM 探针（复用 visual 产物临时库 8091 + vite 5176 同实例，种子同款；探针 `probe-s6.tmp.mjs` 用后已删）**28/28 PASS**：
  - 结构：右页清单块=2；王道 `2 / 5 项` + 5 行任务（2 个 `.on`）、每行 `em` 均为 `MM/DD`；马原 `1 / 2 项` + 2 行（1 个 `.on`）；每块恰 1 个 `a.nb-sec-side.red`「+ 加一条子任务」href 含 `/plan/`；左页仍 2 个 GoalRow 各带 Meter、零 `nb-todo`；块 `border-bottom` = dashed；清单块内零 Meter。
  - 交互（桌面）：点未完成行 → `[role=dialog]` 弹出且副标题=任务名 → 提交「完成」→ 该行 `.on`、val `2 / 5→3 / 5 项`、done=3；再点该行 → 直接取消完成 → 回 `2 / 5 项`、done=2（无 Sheet）。
  - 回归：`/plan/:id` 详情页 `.nb-taskmeta` 5 条时间标签格式不变（`taskWhenLabel` 搬运无行为差）。
  - 手机 390：7 条任务行 + 7 个截止 `em` 全渲染，零横向溢出、零 pageerror。
- 探针首轮 2 FAIL 均为探针自身问题（href 带 `/journal` base 前缀、详情页 URL 拼接重复 base），修正后全过，非应用问题。

遗留：`useGoal` 失败时清单块静默显示空列表 + 「+ 加一条子任务」（无错误态，卡面未要求）；每清单目标一次详情请求（卡面已认可 ≤4）。临时实例 8091/5176 已 kill，端口已释放；探针脚本与 `/tmp/sj-s6-probe/` 截图留本机供复核。
