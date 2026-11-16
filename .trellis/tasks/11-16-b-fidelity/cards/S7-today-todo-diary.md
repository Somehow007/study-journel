# S7 今日页：待办平铺 + 日记工具条 + 删除按钮悬停

## 问题 / 目标
概念稿 today 左页「待办」是平铺勾选清单（右侧小字科目/来源），总共 4 行。现状 `TodayGoalsSection` 每个目标一个块：标题 + 百分比 + 20 格进度 + 说明 + 「完成/取消」大按钮，4 个目标占掉半页；没有今日任务的清单目标还显示「0 / 0 项今日任务」。日记「写/看」两个 chip 绝对定位浮在正文右上，压字。条目行 × 删除常显。

**本卡三个子改动都在今日页，属同一关注点「今日页还原」，一次提交；若 diff 超过 ~200 行，拆成 S7a 待办 / S7b 日记+删除两个 commit。**

## 改动范围
- `apps/web/src/components/TodayGoalsSection.tsx`（只改渲染 JSX，L127-250 附近；状态、`handleConfirm`、`afterWrite`、乐观更新逻辑**一行不改**）
- `apps/web/src/components/DiaryEditor.tsx`（L101-143 工具条与 textarea/预览的 padding）
- `apps/web/src/components/LearningRecordCard.tsx`（L36-43 删除按钮）
- `apps/web/src/styles/journal-b.css`（如需新增 1-2 条规则）

## 消费点
- `TodayGoalsSection` 只被 `TodayDetail` 使用；`DiaryEditor` 只被 `TodayDetail` 使用（`rg -n "DiaryEditor|TodayGoalsSection" apps/web/src` 复核）。
- `LearningRecordCard`：`rg -n LearningRecordCard apps/web/src` 列调用方，确认改动对所有调用方都合理。

## 方案
### A. 待办平铺（决策 6）
- 头部「待办 · 来自月计划 done / total →」保留，但 done/total 改为**行**计数（见下），不是目标个数。
- 行的生成（保持 items 原顺序）：
  - `CHECKLIST`：每个 `todayTasks` 一行；`todayTasks.length === 0` 的目标**不出行**。
  - `COUNT`：一行，文案 `{title} · 今日 {suggestedToday} {unit}`；勾选态 = `todayCheckin != null`；已打卡时文案改为 `{title} · 已记 {todayCheckin.quantity} {unit}`。
- 每行结构统一：`<Pressable className={`nb-todo${on ? ' on' : ''}`}>` + `<span className={`nb-box${on ? ' on' : ''}`} />` + `<span>文案{过期标记}</span>` + `<em>{item.title 或 科目名}</em>`。CHECKLIST 行 em 显示目标名，COUNT 行 em 留空（标题已在文案里）。
- 点击行为**完全复用现有分支**：COUNT 未打卡 → `setSheet({ item, mode: 'count' })`；已打卡 → 现有「取消」按钮的 onClick 逻辑（删 checkin）；CHECKLIST 与现状一致。
- 删除：每目标的进度格 `nb-meter`、百分比、`<small>` 说明、完成/取消 `nb-btn`。（进度已在右页「本月目标」展示。）
- 空态「今天没有待办任务」：当行数为 0 时显示（包括所有清单目标今日都无任务的情况）。
### B. 日记工具条
- 去掉工具条的 `absolute right-1 top-1 z-10`，改为文本区**上方**一行 `flex justify-end gap-1 mb-1` 的普通流式布局；textarea 与预览去掉 `paddingRight: '4.5rem'`。
- 写/看 chip 尺寸不变。
### C. 条目删除按钮悬停显示
- 桌面（`@media (hover: hover)`）：删除按钮默认 `opacity: 0`，所在行 `tr:hover` / `:focus-within` 时 `opacity: 1`；触屏设备保持常显（不能让手机删不了）。给按钮加 class（如 `nb-row-del`）在 CSS 实现，不用 JS。

## 验收
- `./scripts/verify.sh` 全绿。
- `./scripts/visual.sh today,learn-form`：
  - 1440：待办区为平铺行——两个 COUNT 目标各 1 行（种子按日期轮换打卡量，勾选态以当天是否有 checkin 为准）+ 408 今日任务各 1 行（种子 dueDate=今天的 2 条，一条已勾）；马原无今日任务则不出行；**没有**「0 / 0 项今日任务」、没有大按钮；左页高度明显变短。
  - 日记首行文字不被任何按钮遮挡。
  - 条目行 × 默认不可见（截图里看不到）。
  - 390：同上逻辑；× 在手机截图中可见（hover:none）。
- 手动：COUNT 行点勾 → 弹记一笔 Sheet；已勾再点 → 取消打卡；任务行勾选/取消与改前一致。

## 提交
`feat(web): 今日页待办改平铺勾选清单+日记工具条移出正文+条目删除悬停显示`

## 执行记录
