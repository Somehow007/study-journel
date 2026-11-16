# S8 细节杂项（依赖 S1；逐条做，可多个小 commit）

S1 之后先跑一次 `./scripts/visual.sh` 全量，**已经自然消失的条目直接标「S1 已解决」跳过**。每条独立、改动很小；建议按「一条一 commit」，最少也要按下面分组（同组一 commit）。

## 组 1：防竖排兜底（CSS）
- `journal-b.css`：`.nb-date-num`、`.nb-kv b`、`.nb-sec`（小节标题）、`.nb-subj`（科目标签）、`.nb-table .nb-k`（表格首列——Stats/AnnualReview「学科分布」科目名实测逐字竖排：数学一/英语一/政治）加 `white-space: nowrap;`。`.nb-kv b` 另加 `overflow: hidden; text-overflow: ellipsis;`，防止窄屏数字互相压。`.nb-table .nb-k` 若 nowrap 后挤压 meter 列，给该列加 `min-width`（如 `6em`）或 `width: 1%` 让表格优先保名列，执行时截图确认两列都不挤。
- 验收：把浏览器宽度拉到 1024 看统计 / 年度 / 目标详情，无逐字竖排；`./scripts/visual.sh stats,annual` 确认科目名单行；390 无横向溢出（visual.sh 会报）。
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
- 设置页日期输入原生 picker 图标：`rg -n 'type="date"' apps/web/src` 找到 Settings 初试日期 input；评估 `appearance: none` 去图标可行性——若会伤害移动端选日期体验则放弃并在执行记录写明（概念稿是纯文本样式，优先级低）。
- 验收：`./scripts/visual.sh goal-form,learn-form,settings`：色块 26px 方块一排；目标数量输入无上下箭头。
- 提交：`fix(web): 表单数字框去 spinner+色块恢复 26px`

## 组 5：QueryLoading / QueryError 通栏兜底（S1 遗留）
- 各页 loading/error 是 early return，在 `.nb-book` 之外直接渲染进 Layout 容器；S1 后容器最宽 1600px，骨架块（`h-40`/`h-24` 无宽度约束）与错误 `.card` 会通栏。瞬态但观感差。
- `components/QueryState.tsx` 给三个组件根节点各加语义 class（如 `journal-query`），`journal-b.css` 加 `max-width`（建议 560–720px 区间取可读值）+ `margin-inline: auto`。QueryEmpty 已在 `.nb-book` 内，不动。
- 消费点：`rg -ln "QueryLoading|QueryError|QueryEmpty" apps/web/src` 列出全部页面——只加 class，不改逻辑，风险低。
- 验收：`./scripts/visual.sh` 无法触发 loading 态，靠 verify + 人工把 devtools 网络节流看一眼 loading/error 外观；截图确认不通栏。
- 提交：`fix(web): 加载/错误态限宽居中——S1 宽容器下不再通栏`

## 执行记录

执行：2026-11-16 · SWE-2 Max（Devin）。验证环境 = 手动复刻 visual.sh（8091 临时库 + 概念稿种子 + 5176 vite），探针 `apps/web/scripts/visual/probe-s8-*.tmp.mjs`（用后已删）；截图 `/tmp/sj-s8.qQX5T2/`。

### 组 1（commit e70040e）
- 加了 4 处兜底：`.nb-date-num`、`.nb-sec`、`.nb-table .nb-k` 各 `white-space:nowrap`；`.nb-kv b` 加 `nowrap+overflow:hidden+text-overflow:ellipsis`。`.nb-subj` 已有 nowrap（L470），跳过。
- `.nb-k` 未加 min-width：`td:has(> .nb-meter){width:100%}` 才是挤压源，nowrap 后 min-content=全名宽，66px 名列不动、meter 列不挤（1024 截图确认）。
- **卡外同一关注点 1 处**：`.nb-date` 原只在 ≤767px 有 `flex-wrap`；1024 实测 `.nb-date-meta`（统计「2026年11月按学习时长」、年度「年度回顾 ANNUAL REVIEW」）被挤成逐字竖排，属本组验收「无逐字竖排」覆盖范围 → 基础规则补 `flex-wrap:wrap;row-gap:10px`（与手机媒体查询同款；date-num nowrap 后挤压更甚，不修不行）。1440 无视觉变化。
- 验收：1024px stats/annual/goal 截图——科目名单行、meta 横排、chips/pager 折行自然；shot.mjs `stats,annual` 1440/390 零 pageerror/零横向溢出；390 stats KV 两列全显。探针 `nb-k h>40` 为误报（td 高=行高），断言改用 whiteSpace/截图。
- 观察项：`.nb-kv b` 省略号在 1024 触发（`86h…`），是卡面设计的兜底非缺陷。

### 组 2（commit c826821）
- `.nb-stamp-circle` 按卡面改固定正圆（`left/top 50%+6px + translate(-50%,-50%) + width:min(100%-12px, cal-h-30px) + aspect-ratio:1`），transform 含 `rotate(var(--rot,0deg))`；手机媒体查询删掉旧 inset 覆盖（否则打回拉伸矩形），保 `font-size:12px;border-width:1.5px`。
- GoalDetail：`<span nb-stamp-circle>` 加 `style={{ '--rot': (d.day*37%21)-10 }}`——用 `d.day`（getCalendarDays 的日号）；类型断言用 `import type { CSSProperties }`（文件无 React 命名空间导入，`as React.CSSProperties` 不可达）。
- 周进度 `第N周` → `{weekStart.slice(5)···}–{weekEnd.slice(5)···}`（WeekProgress 两字段纯字符串，未 new Date）；`idx` 参数随之删除。
- 验收：1440 截图 14 圈全正圆带 ±10° 旋转、不压日期号；390 DOM 断言 14/14 正圆（|w-h|≤1）+ 全带 matrix transform + 与 `.nb-cal-d` 零几何重叠 + 零溢出 PASS。

### 组 3（commit 81ca781）
- `taskWhenLabel` weekStart 分支 `new Date+setDate` → `addDays(task.weekStart,6)`（domain.ts UTC 零点运算）；dateUtils 新 import `addDays`（domain 无出向依赖，无环）。
- **同类写法盘点**（卡面要求）：`rg "new Date\("` 全仓 42 处，唯一 `new Date(YYYY-MM-DD)` 违例即本修复点。其余合法：无参（当前时刻）、`new Date(ms)` 时间戳（`task.doneAt`）、`new Date(y,m,d)` 数字参本地日历构造（`parseDate`/`getCalendarDays`/PlanView/MonthView/Stats/AnnualReview/TodayDetail L73——与 parseDate 同语义，本就按用户本地日工作）、domain.ts 内部 UTC 实现。无另开卡必要。
- 验收：verify.sh 全绿；临时库给王道 408 造 weekStart=2026-11-16 任务，GoalDetail `.nb-taskmeta` 渲染 `11/16–11/22` 与改前一致（东八区）。探针任务留于一次性库随环境销毁（DELETE 路径 404 未清理，无影响）。

### 组 4（commit 441fc2a）
- number spinner：`rg type="number"` 7 处全带 `nb-field`（Settings `nb-set-num`、GoalFormModal、GoalCompleteSheet ×3、LearningFormModal ×2）→ `.nb-field[type='number']` 加 appearance 三行。
- 色块：`.pressable`（default）也有 `min-height:var(--hit-min)=44px`，卡面 fallback 命中 → GoalFormModal/StateEditModal/SubjectEditModal/LearningFormModal 4 处 `Pressable variant="icon"` 改普通 `<button type="button">`（Pressable import 保留：modal 壳与取消钮仍在用）。预览里的 `<span class="nb-swatch">`×3 未动。
- date picker 图标：取最保守方案 `.nb-field[type='date']::-webkit-calendar-picker-indicator{display:none}`——只藏图标不 `appearance:none`，Chrome 点字段本身仍可唤起、iOS/Android 无该 indicator 不受影响。覆盖 Settings 初试日期 + GoalDetail 任务绑定日期两处。Firefox 可能仍显示图标（无等价伪元素），低优先记录。
- 验收：verify.sh 全绿；shot.mjs `goal-form,learn-form,settings` 零 pageerror/零溢出；截图——goal-form 色块 8 枚 26px 一排、数量框 300 无箭头；settings 初试日期无日历图标、自定义分钟框无箭头；learn-form h/m 无箭头。LearningFormModal 色块未截图（在「其他…」分支内）——与已验三处同代码同 CSS，风险忽略。

### 组 5（commit 495bc42）
- QueryLoading/QueryError 根节点加 `journal-query`；QueryEmpty 按卡面不动（均在 `.nb-book` 内）。CSS `max-width:640px;margin-inline:auto`（560–720 区间取 640）。
- 消费点 `rg` 11 处：QueryLoading 8 页 + QueryError 9 处全为早退渲染在 Layout 容器，只加 class 无逻辑改动。
- 验收：shot.mjs 无法触发 → 探针强造两态：`/plan/no-such-goal` 出 QueryError、`route` 延迟 days API 截 QueryLoading——均 w=640、left=400 居中，截图观感正常。
- 全量回归：shot.mjs 全 11 桌面 + 6 手机 零 pageerror/零横向溢出（报告 `/tmp/sj-s8.qQX5T2/report.html`），today/calendar 页面 `.nb-date` wrap 无回归。

### 遗留 → 收尾轮
- `.nb-date-meta` 未加 nowrap（靠 `.nb-date` wrap 兜底）；极端长 meta 单独成行时仍可折行——设计内。
- Firefox date 输入可能仍显示原生日历图标（webkit 伪元素不覆盖），低优先。
- 组4 新发现记录：`<button class="nb-swatch">` 失去 pressable-icon 的 active 缩放反馈，仅靠边框变色示意选中；如需按压反馈收尾轮可加 `.nb-swatch:active{transform:scale(.96)}`。
