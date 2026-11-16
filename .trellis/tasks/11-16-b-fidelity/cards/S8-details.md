# S8 细节杂项（依赖 S1；逐条做，可多个小 commit）

S1 之后先跑一次 `./scripts/visual.sh` 全量，**已经自然消失的条目直接标「S1 已解决」跳过**。每条独立、改动很小；建议按「一条一 commit」，最少也要按下面分组（同组一 commit）。

## 组 1：防竖排兜底（CSS）
- `journal-b.css`：`.nb-date-num`、`.nb-kv b`、`.nb-sec`（小节标题）、`.nb-subj`（科目标签）加 `white-space: nowrap;`。`.nb-kv b` 另加 `overflow: hidden; text-overflow: ellipsis;`，防止窄屏数字互相压。
- 验收：把浏览器宽度拉到 1024 看统计 / 年度 / 目标详情，无逐字竖排；390 无横向溢出（visual.sh 会报）。
- 提交：`fix(web): 大字标题/KV 数字/小节标题 nowrap 兜底`

## 组 2：目标详情盖章圈正圆 + 周进度日期段
- `.nb-stamp-circle`（`journal-b.css` 搜该类，含手机版）：改为固定正圆——`inset: auto; left: 50%; top: calc(50% + 6px); transform: translate(-50%, -50%); width: min(calc(100% - 12px), calc(var(--nb-cal-h) - 30px)); aspect-ratio: 1;`。当前实现**没有**旋转（2026-11-16 核实），SPEC-B 要求「按日期伪随机旋转 ±10°」：CSS 写 `transform: translate(-50%, -50%) rotate(var(--rot, 0deg));`，GoalDetail L368 的 `<span className="nb-stamp-circle">` 加 `style={{ '--rot': `${(day * 37) % 21 - 10}deg` } as React.CSSProperties}`（day = 日号数字），不要用内联 transform（会覆盖 translate）。
- `pages/GoalDetail.tsx` L276 `第 {idx + 1} 周` → `{MM.DD}–{MM.DD}`：用 `week.weekStart` / `week.weekEnd`（`WeekProgress` 已有两个字段）`.slice(5).replace('-', '.')`。纯字符串处理，**不要 new Date**。
- 验收：`./scripts/visual.sh goal` 1440/390 盖章圈为正圆、不压日期号；周进度标签为日期段。
- 提交：`fix(web): 目标打卡盖章正圆+周进度改日期段标签`

## 组 3：taskWhenLabel 去时区转换（硬约束违例）
- S6 搬到 `lib/dateUtils.ts` 的 `taskWhenLabel` 里有 `new Date(task.weekStart)` + `setDate`——违反 AGENTS §3「日期 = YYYY-MM-DD 字符串，禁止任何时区转换」（`new Date('YYYY-MM-DD')` 按 UTC 解析，西半球会差一天）。
- 改为 `addDays(task.weekStart, 6)`（`lib/domain.ts` L74，纯字符串日历运算），输出格式不变。
- 顺手 `rg -n "new Date\(\w+\.(dueDate|weekStart|date)" apps/web/src` 列出同类写法写进执行记录，**本卡只修 taskWhenLabel**，其余另开卡。
- 验收：`./scripts/verify.sh`；目标详情周任务截止文案与改前一致（东八区）。
- 提交：`fix(web): taskWhenLabel 改字符串日期运算——去掉 new Date 时区解析`

## 组 4：表单小件
- 数字输入去原生 spinner：`journal-b.css` 加
  ```css
  .nb-field[type='number'] { -moz-appearance: textfield; appearance: textfield; }
  .nb-field[type='number']::-webkit-inner-spin-button,
  .nb-field[type='number']::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
  ```
  先 `rg -n "type=\"number\"" apps/web/src` 确认这些 input 都带 `nb-field` class；不带的记录下来，不顺手改。
- 色块被撑大：`GoalFormModal.tsx` L201 附近 `<Pressable variant="icon" className="nb-swatch">`——`pressable-icon` 有最小触控尺寸，盖过了 `.nb-swatch` 的 26px。`rg -n "nb-swatch" apps/web/src` 找到所有用法：可点的 `Pressable` 在 GoalFormModal L206、StateEditModal L151、SubjectEditModal L134、LearningFormModal L138（Settings 与两处 Modal 预览里的是纯 `<span>`，不动）；这 4 处的 `variant="icon"` 改为 `variant="default"`（先读 `components/ui/Pressable.tsx` 确认 default 不加最小尺寸，否则改用普通 `<button type="button">`），确认 `.nb-swatch` 26×26 生效；手机端触控面积靠 gap 保证即可。
- 验收：`./scripts/visual.sh goal-form,learn-form`：色块 26px 方块一排；目标数量输入无上下箭头。
- 提交：`fix(web): 表单数字框去 spinner+色块恢复 26px`

## 执行记录
