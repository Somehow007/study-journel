# S5 日历「本月待办」计数修正（bug）

## 问题 / 目标
`MonthView.tsx` L73-79 把 `useDayMarks` 每天的 `taskDone/taskTotal` 相加。后端 `days.go` 用 `domain.TaskRelevantOn` 计算每天相关任务，未完成的过期任务在之后**每一天**都相关 → 同一任务被重复计数。种子 7 个任务显示「3 / 54」。概念稿口径：本月子任务完成数 / 总数（去重）。

## 改动范围
- `apps/web/src/pages/MonthView.tsx`（只改这一处计数来源）

## 消费点
- `taskDone/taskTotal`（日维度，`lib/api.ts` L34 DayMark）2026-11-16 时前端只有 MonthView 月合计在用；字段保留——**不要动后端、不要动 `useDayMarks`**。执行前 `rg -n "taskTotal|taskDone" apps/web/src` 列出调用方，确认只改 MonthView 的月合计。

## 方案
1. MonthView 引入 `useGoalsByPeriod(period)`（`lib/queries.ts` L83；period 格式 `YYYY-MM`，用 `lib/goalApi.ts` L96 的 `formatPeriod(year, monthIndex)`，与 PlanView 同写法，monthIndex 为 0 基）。
2. `taskTotals` 改为：
   ```ts
   const checklist = (goalMonth?.goals ?? []).filter((g) => g.type === 'CHECKLIST');
   done = sum(g.actualValue), total = sum(g.totalValue)
   ```
   （CHECKLIST 的 `actualValue/totalValue` 即已完成/全部子任务数，见 `domain.goalProgressChecklist`。）
3. 加载中显示「—」，不要闪 0。
4. 删除不再使用的旧求和逻辑。

## 验收
- `./scripts/verify.sh` 全绿。
- `./scripts/visual.sh calendar,plan`：种子数据下日历右栏显示「完成 3 / 7 项」，与计划页清单型两目标「2 / 5 项」「1 / 2 项」之和一致。
- 切到上个月（无目标）显示「完成 0 / 0 项」或保持现有空态文案，不报错。

## 提交
`fix(web): 日历本月待办改按目标子任务去重计数——原按天求和把过期任务重复计入`

## 执行记录
