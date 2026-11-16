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

2026-11-16 执行（Devin）：

**消费点 grep**（卡要求先跑）：`rg -n "taskTotal|taskDone" apps/web/src` —— `DayMark.taskDone/taskTotal` 仅 MonthView 月合计消费（旧 L73-79 求和 + L180-182 渲染）；`TodayGoalsSection.tsx` L143 的 `taskDone` 是同名局部变量（`todayTasks.filter`），与 DayMark 无关；`types/api.ts` L56-57 为类型定义、`api.ts` L34 为注释。确认只改 MonthView，后端与 `useDayMarks` 未动，字段保留。

**改动**（单文件 `apps/web/src/pages/MonthView.tsx`）：
- 引入 `useGoalsByPeriod(period)`（period 复用既有 `formatPeriod(year, month)`，month 0 基，与 PlanView 同写法）。
- `taskTotals` 改为 `(goalMonth?.goals ?? []).filter(g => g.type === 'CHECKLIST')` 后 `sum(actualValue)/sum(totalValue)`——服务端 `GoalProgressChecklist` 口径 = done 任务数 / 任务总数（`httpapi/goals.go` L114-125 → `actualValue/totalValue`），天然去重。
- 加载中（`goalsPending && !goalMonth`）本月待办显示「—」，不闪 0；目标查询报错时退化为 0/0（次要查询，与卡面一致未加额外错误态）。
- 删除按天 `taskDone/taskTotal` 求和旧逻辑。

**验收实测**：
- `./scripts/verify.sh` 全绿（tsc + vitest 46 + build + go vet/test + sqlc 一致性）。
- `./scripts/visual.sh calendar,plan`：**零 pageerror / 零横向溢出**（报告 `/tmp/sj-visual.Pysm0f/report.html`，截图 `impl/` 供 owner 复核）。
- 截图无法目检（本模型无视觉），改用 playwright DOM 探针断言（复用本卡 visual 产物的临时库 8091 + vite 5176 重启同一实例，种子同款；探针 `apps/web/scripts/visual/probe-s5.tmp.mjs` 用后已删）：
  - 日历右栏「本月待办」=`完成 3 / 7 项`（修复前种子下为 3/54 量级）；
  - 计划页清单型两目标 `.nb-goal-val` = `2 / 5 项`、`1 / 2 项`，合计 3/7 与日历一致；
  - 翻上个月（2026-10 无目标）=`完成 0 / 0 项`，无报错；
  - 全程零 pageerror。

遗留：无。探针用的临时实例（8091/5176）已 kill，端口已释放。

**S5 后走查（2026-11-16，同实例 8091+5176 复用 `/tmp/sj-visual.Pysm0f`；补充种子 `/tmp/s5-extra-seed.mjs`：10 月 COUNT-only / 9 月 CHECKLIST 1/3 / 8 月空 CHECKLIST；探针 `probe-s5-walk{,2}.tmp.mjs` 用后已删）**：

- **口径边界全过**：当月 3/7；上月 COUNT-only → 0/0（CHECKLIST 过滤生效，COUNT 不计入）；两月前 CHECKLIST → 1/3（非当月同样正确）；三月前空 CHECKLIST（0 任务）→ 0/0 不报错；下月/跨年 2027-01 → 0/0，pager `2026.12→2027.01` 跨年格式正确，回退正常。
- **加载/降级**：route 延迟 `/goals?period=` 2s 轮询——渲染期先见「—」、全程未见 0 闪现，数据到达后 3/7；`/goals` 返 500 → RQ 重试耗尽后降级「完成 0 / 0 项」，零 pageerror 无崩溃（**观察项**：错误被显示成 0/0 略有歧义，次要查询降级，卡面未要求错误态，留收尾轮定夺是否改「—」）。
- **一致性/回归**：计划页清单型 `2 / 5 项|1 / 2 项` 合计=日历 3/7；日历格 30（=11 月天数）、图例 6、小计 5 行、1440/390 零横向溢出；暗色主题（notebook-dark）3/7 颜色可读；手机 390 3/7 正常。
- **活数据链路**：API 直接完成 g2 一个任务 → 重载日历 4/7（查询失效/重取正常，非陈旧缓存）。
- **全程零 pageerror**。
- 走查中探针自身两处脚本错误（cells 期望误写 42、翻月步数多算 2）已修正复测，非应用问题；种子库 E1 后 g2 为 3/5（临时库，后续 visual.sh 自建新库不受影响）。

遗留：仅上述 goals-500 降级显 0/0 观察项 → 收尾轮定夺。
