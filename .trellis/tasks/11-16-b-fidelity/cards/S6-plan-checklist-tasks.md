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
