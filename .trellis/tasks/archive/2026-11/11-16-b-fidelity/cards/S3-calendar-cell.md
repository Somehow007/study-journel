# S3 日历格子：日期号回到左上角 + 手机精简

## 问题 / 目标
SPEC-B §3 日历：「格内：左上日期、右上状态字、左下大时长 + 时长横线」。现状日期号是 `<button>` 里的裸文本节点，button 天生把内容垂直居中 → 日期号落在格子中部；390 宽下与时长数字重叠。概念稿手机日历不显示状态字。

## 改动范围
- `apps/web/src/components/CalGrid.tsx`（L66-74 附近，`{d.day}` 裸文本）
- `apps/web/src/pages/GoalDetail.tsx`（L345-369 附近：打卡日历同样是 `{Number(d.dateStr.slice(8))}` 裸文本 + `nb-stamp-circle`）
- `apps/web/src/styles/journal-b.css`（`.nb-cal-*` 段，L338-510 附近）

## 消费点
- `CalGrid` 调用方：`rg -n "CalGrid" apps/web/src` → MonthView（日历页 h112）、TodayDetail 右页小月历。两处都要截图确认。
- GoalDetail 打卡日历用同一套 `.nb-cal-cell` 样式但自己渲染格子。

## 方案
1. 新增 CSS：
   ```css
   .nb-cal-d { position: absolute; left: 8px; top: 6px; line-height: 1; }
   ```
   （与 `.nb-cal-state` 的 `top: 6px` 对齐，字体继承 `.nb-cal-cell` 的等宽 12px。）
2. CalGrid：`{d.day}` → `<span className="nb-cal-d">{d.day}</span>`。空白占位格（月初偏移）若也有 `.nb-cal-cell`，不受影响。
3. GoalDetail 打卡格：两处都包进 `<span className="nb-cal-d">`——L350 附近未来日/不可点的 `<div>` 格，和 L366 附近可点 `<button>` 格。
4. 手机（767px 媒体查询内，L355 附近已有 `--nb-cal-h: 56px` 的规则旁边）：
   ```css
   .nb-cal-state { display: none; }
   .nb-cal-dur { font-size: 12px; left: 4px; bottom: 6px; }
   .nb-cal-dur small { display: none; }   /* 「h」单位小字，手机省掉，与概念稿一致 */
   .nb-cal-bar { left: 4px; }
   .nb-cal-d { left: 4px; top: 4px; font-size: 11px; }
   ```
   `.nb-cal-dur small` 当前是内联 style（`fontSize:10`），`display:none` 的 CSS 能覆盖，因为内联没写 display。
5. 不改格子高度档（h60/h72/h86/h112）。

## 验收
- `./scripts/verify.sh` 全绿。
- `./scripts/visual.sh calendar,today,goal`：
  - 1440：日期号在左上、状态字在右上且同一基线；时长在左下；今天格红框不变。
  - 390：日历格无任何文字重叠，无状态字；目标详情打卡格日期号在左上、盖章圈不压日期号（压了就把 `.nb-stamp-circle` 的 `inset` 顶部值调到 ≥ 日期号高度，记录在执行记录里）。

## 提交
`fix(web): 日历格日期号定位左上——button 内容默认垂直居中导致错位；手机隐藏状态字`

## 执行记录

2026-11-16 执行（Devin）：

**改动**（3 文件，均在卡范围内）：
- `apps/web/src/components/CalGrid.tsx`：`{d.day}` → `<span className="nb-cal-d">{d.day}</span>`。
- `apps/web/src/pages/GoalDetail.tsx`：打卡日历两处日期号（future `<div>` 格、可点 `<button>` 格）同样包 `<span className="nb-cal-d">`。
- `apps/web/src/styles/journal-b.css`：
  - `.nb-cal-state` 前新增 `.nb-cal-d`（absolute `left:8px top:6px line-height:1`，字体/颜色继承 `.nb-cal-cell`）。
  - `.nb-cal-state` 补 `line-height: 1`（卡外一行，验收「同一基线」需要：实测两文本底边差 3px → 0）。
  - `@media(max-width:767px)` 末尾块（与 `.nb-cal-checkin`/`.nb-stamp-circle` 手机规则同处）追加：`.nb-cal-state{display:none}`、`.nb-cal-dur{font-size:12px;left:4px;bottom:6px}`、`.nb-cal-dur small{display:none}`、`.nb-cal-bar{left:4px}`、`.nb-cal-d{left:4px;top:4px;font-size:11px}`；`.nb-stamp-circle` 手机 inset 顶 `14px`→`18px`。

**与卡面的两处偏差（如实记录）**：
1. 卡说手机规则放「`--nb-cal-h:56px` 媒体块旁边」——该块源码序**早于**基础 `.nb-cal-*` 规则，同优先级后写者胜，`left/top/bottom/font-size` 全部被基础规则覆盖（`display:none` 侥幸生效因基础规则未写 display）。已把元素级覆盖移到文件尾部既有 `@media(max-width:767px)` 块；`--nb-cal-h` 保留原位。
2. `.nb-stamp-circle` 手机 inset 顶按卡的预案 14→18px：日期号底边 ≈15px，14px 时 goal 页 14 个格子 stamp 与日期号 bounding box 相交（椭圆视觉擦边）。

**验收实测**（临时库 8091 + vite 5176，visual.sh 同口径；探针 `/tmp/sj-s3/measure.mjs` 逐格 getBoundingClientRect + Range 文本底边）：
- `./scripts/verify.sh` 全绿；`./scripts/visual.sh calendar,today,goal`：**零 pageerror / 零横向溢出**（报告 `/tmp/sj-visual.DppOZ1/report.html`，截图 `impl/`）。
- 1440：calendar/today/goal 三页 30 格 `.nb-cal-d` 全部 top=6/left=8（最大偏差 0）；`.nb-cal-state` 右上与日期号**文本底边差 0**（同一基线）；`.nb-cal-dur` 左下；格内元素两两相交 0；`.today` 红框 `2px solid` brand 不变。
- 390：`.nb-cal-state` 全隐藏（16/16）、`.nb-cal-dur small` 全隐藏（16/16）；`.nb-cal-d` top=4/left=4/fs=11、`.nb-cal-dur` bottom=6、`.nb-cal-bar` left=4；goal 打卡格 stamp 与日期号相交 0（修复前 14 处）；无文字重叠。
- worst 统计中 ±1px 项（sRight/durBot）为格子 1px border 使 border-box 与 padding-box 差 1px 的测量口径，非布局问题。
- 截图无法目检（本模型无视觉），以 DOM 几何逐格断言代替；截图留 `/tmp/sj-visual.DppOZ1/impl/` 供 owner 复核。

遗留：无。

**S3 后走查（2026-11-16，同实例 8091+5176；探针 `/tmp/sj-s3/walk.mjs`、`walk-goal.mjs`；格子局部图 `/tmp/sj-s3/cells/`）**：

- **结构完整性**：calendar/today/goal 三页 30/30/30 格每格恰好 1 个 `.nb-cal-d`，格内裸文本节点 0，`.nb-cal-d` 无格格外泄漏；plan/memory/stats/annual/search/settings 六页 `.nb-cal-cell` 与 `.nb-cal-d` 均为 0（无回归面）。
- **断点边界**：768px 走桌面规则（state 显示、dur 带「h」、d 在 8/6）；767px 切手机规则（state 隐藏、dur 「5.0」无 h、d 在 4/4）——`max-width:767px` 边界行为正确。
- **goal 打卡格复测**（新库 id `u__jvlzDE2-j_lmlbhlj7`）：桌面 stamp 顶与日期号底净空 4px、手机 3px，相交 0；today 格红框不变。
- **像素确认**（PIL）：calendar-desktop 格左上区有墨（日期）、中央区 0 墨（旧 bug 的中部位置已空）；goal-stamp-* 三尺寸顶部条带蓝墨 0（圆环不侵日期号）、环体在位。
- **交互**：桌面/手机点首日格均正确跳 `/day/2026-11-01`；`.nb-cal-d` 在 button 内不吞事件。
- **暗色**：切 `journal-notebook-dark` 后 `.nb-cal-d` 颜色 = 格色（继承 `--ink-soft` 暗色值），格边框翻暗，零 pageerror。
- **其他页面回归**：六页零 pageerror / 零横向溢出（1440 与 390）。

**走查新发现（与 S3 无关，已分流）**：
1. **768px 全页横向溢出 ~88px**：元凶 `.nb-topnav-right`（宽 255px）+ `.nb-stamp`（156px）桌面顶栏右簇固定宽度，视口 < ~856px 放不下；媒体断点 767 → 768–855 平板窄桌面带全页横滚。所有页面一致，为存量问题 → 记入 prd 走查补记，留收尾轮定夺（收拢顶栏 / 提前断点 / 接受）。
2. **长状态名边界**：`.nb-cal-state` `white-space:normal` 无宽限，>4 字自定义状态在窄格（today 86px）会换行垂入格内、可能压时长。种子全是 2 字内置状态；存量边界，低优先，留收尾轮（可选 `nowrap`+`max-width` 或容忍）。

**执行中新发现（本卡相关，已在本卡内处理）**：卡面建议的手机覆盖位置实际不生效（源码序早于基础规则），已记录于上方执行记录——后续写 `.nb-cal-*` 手机覆盖时注意：必须放文件尾部媒体块。
