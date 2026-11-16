# M6：B 格纸 UI 落地（默认主题换装）

> 路线图：`docs/roadmap.md` M6；设计源：`design/concepts-v6/README.md` + `SPEC-B.md` + `b-notebook.html` + `shots/b-notebook/`。
> 范围：**只做换装**（token → 组件 → 12 页对照截图）；新功能（倒计时/科目预设/热力图/「正」字统计数据等 §4 项）归 M7，不在本任务。
> 前置：M4-3 切流已完成（11-16）；D5=B 格纸先行已定。

## 问题 / 目标

手帐剥离上线后仍是花期时代的旧版式 + 复用博客 8 套主题。M6 把默认主题换成 B 格纸（米白纸面/墨蓝字/红笔批注/宋体/印章/「正」字），主题存服务端 `setting.theme`，与博客 key 完全脱钩。考研节奏：11 月底前上线。

## 关键决策（开工定案）

1. **主题 id**：`setting.theme` 存概念短 id（`notebook` / `notebook-dark`，对齐 `data-model.md` 注释 `graphite|notebook|midnight(+ -light/-dark)`）；DOM `data-theme` = `journal-${id}`（`journal-notebook` / `journal-notebook-dark`，对齐 SPEC-A/B/C 的 `journal-graphite|notebook|midnight` 约定）。DB 默认 `graphite`（A 版未做）等未知值 → 回落 `notebook`（B 即默认）。
2. **博客 8 主题移除**：`theme.ts` registry/picker、`index.css` 8 个 @import、`styles/themes/` 下 classic/aurora/rose-garden/ocean-breeze/warm-sunset/liquid-glass/glow.css 全部删除。理由：剥离后手帐自有主题体系，博客主题是花期时代临时复用；B 换装后组件按 journal 设计实现，博客主题只剩半成品观感。消费点已列（仅 index.css 引用 + theme.ts + Settings.tsx picker）。
3. **存储**：`setting.theme` 服务端为准（`GET/PATCH /settings` 已就绪，字段已在 `Setting`/`SettingsPatch` 类型中）。localStorage `study-journal-theme` 降级为**登录前首帧缓存 + settings 不可用兜底**；写盘顺序 = cache → transitionTheme → state → `updateSettings.mutate({theme})`。未知服务端值只回落不回写（避免登录即写库）。
4. **状态色**：SPEC-B §2 给内置 6 态精确 solid/ink/tint（明暗两套）。v3 只存 `state.color` 主色（seed 已与 SPEC solid 对齐），`stateUtils` 增加**主题感知调色板**：`builtinKey` 命中且当前主题有 SPEC 表 → 用表值（含 dark.solid/dark.ink/dark.tint），否则 `generateMoodPalette` 兜底（自定义态）。表结构按 `Record<themeId, Record<builtinKey, palette>>` 预留，M10 其他主题复用。
5. **科目色**：`SUBJECT_COLORS` 前 4 位改 SPEC-B §1.2（`#1E4FA3/#2F6B4F/#B07A12/#D23B22`），后 4 位保留作自定义扩展；bootstrap seed 已一致无需动。
6. **组件类**：新建 `src/styles/journal-b.css`，B 版专属类统一 `nb-` 前缀全局定义（gridbg/spread/page/date/sec/table/meter/btn/field/chip/kv/note/todo/box/states/cal/zheng/stamp/scrim/card…），只用主题别名变量（`--ink/--card/--brand…`），暗色随 token 自动切换。字体：`--font-title`（宋体栈）/`--font-num`（等宽）进 journal-notebook.css；tailwind `fontFamily.serif` 改宋体栈（当前 tsx 零 font-serif 使用，安全）。
7. **ThemeWrapper 去重**：`App.tsx` 内联重复 applyTheme（还带 `theme==='aurora'` 特判）→ 删除，统一由 `AppContext` effect + `lib/theme.ts applyTheme` 负责。

## 消费点（命中 AGENTS §2.3，已 rg 核对）

- `lib/theme.ts` 导出消费方：`context/AppContext.tsx`、`pages/Settings.tsx`（picker）；`App.tsx` ThemeWrapper 内联复写（本任务删除）。
- `lib/stateUtils.ts` hooks/函数消费方：`DateCard / MoodSelector / StateEditModal / TodayDetail / MonthView / Search / AnnualReview / Stats / Memory`（9 文件）——调色板签名变化须全兼容（新增 theme 感知走 hook 内部 `useApp()`，纯函数加可选参数，不改调用方）。
- `SUBJECT_COLORS` 消费方：`GoalFormModal / LearningFormModal / StateEditModal`（取色板下标，改前 4 色值不改结构）。
- `setting.theme`：服务端 `internal/httpapi/meta.go` + `internal/db` 已通；前端 `Setting.theme`/`SettingsPatch.theme` 类型已存在。
- 主题 css 消费方：仅 `index.css` @import 链。

## 分期（每期独立可验证）

| 期 | 内容 | 验收 |
|---|---|---|
| **P1 基础层**（本期） | journal-notebook.css（SPEC-B §1 全 token 明暗）+ journal-b.css 组件类 + theme.ts/AppContext 服务端主题 + stateUtils SPEC 调色板 + SUBJECT_COLORS + 删博客主题 | verify.sh 绿；dev 起后 data-theme=journal-notebook、米白底红字生效；设置页主题切换写服务端 |
| P2 外壳 | Layout/Sidebar/SiteTopBar/BottomNav → 顶部导航（考研手记+STUDY LOG+文字链接+印章 D-xxx）/手机 Tab 宋体+红下划线；删 SiteTopBar 博客联动条 | 1440/390 截图对照；导航激活态正确 |
| P3 原子组件 | Sheet/Pressable/ConfirmDialog/QueryState 换 nb- 规则（直角/墨线/硬阴影/横线纸） | 组件走查 |
| P4 页面逐页 | today → calendar → plan → goal → learn-form → goal-form → stats → memory → annual → search → settings → login，按 README §6 顺序；每页对照 shots/ | 每页 1440+390 截图对照 |
| P5 收尾 | verify.sh full 口径自查、MAP.md/README 同步、归档 | 归档 task |

> 页面里原型有但 M7 才做的功能（倒计时 D-xxx、科目预设、热力图、正字统计）：**先按现有数据渲染**，原型对应位置留现有内容或最小占位，不引入新数据流。

## 验证

- `./scripts/verify.sh`（tsc + vite build + gofmt/vet/test）
- dev 冒烟：`pnpm dev` + :8090 起后登录，检查 `data-theme`、`--paper` 等变量、设置页切换 notebook↔notebook-dark 写 `setting.theme`
- 页面期：1440/390 截图对照 `design/concepts-v6/shots/b-notebook/`（shot.mjs 同款 playwright chrome）

## 进度日志

- 2026-11-16 开工：prd 建档，P1 实施中。
- 2026-11-16 **P1 完成（未提交）**：
  - 新增 `styles/themes/journal-notebook.css`（SPEC-B §1 全 token：米白+夜间墨蓝两套，含 journal 专有变量/科目色/暗色提亮科目色）
  - 新增 `styles/journal-b.css`（SPEC-B §3 全组件类 nb- 前缀：gridbg/book/page/date/sec/table/sum/hl/todo/box/note/states/cal/meter/goal/btn/field/flab/chip/kv/zheng/mark/stamp/scrim/card/serif/num）
  - `lib/theme.ts` 重写：ThemeId=`notebook|notebook-dark`，registry 仅 2 项，`data-theme=journal-${id}`，存储=setting.theme 服务端 + `study-journal-theme` localStorage 首帧缓存
  - `AppContext`：theme 初值=cache，settings 到达后服务端同步（未知值回落不回写），setTheme/toggleTheme 写 cache+PATCH；storage 监听换 cache key
  - `App.tsx` 删 ThemeWrapper（内联重复 applyTheme 且带 aurora 特判）
  - `index.html` 内联 pre-paint 脚本改 journal- 前缀 + **顺手修掉它 `removeItem('study-journal-theme')` 清缓存的 bug**（冒烟实测抓到）
  - `stateUtils`：CONCEPT_STATE_PALETTES[SPEC-B §2 六态明暗 ink/tint/dark]，builtinKey 命中用表值否则 generateMoodPalette 兜底；hooks 内部 useApp().theme，纯函数加可选 theme 参（9 个消费文件零改动）
  - `constants.ts` SUBJECT_COLORS 前 4 → SPEC-B 科目色；tailwind fontFamily.serif → 宋体栈
  - 删除博客 8 主题 css（classic/aurora/rose-garden/ocean-breeze/warm-sunset/liquid-glass/glow，git rm 已暂存）
  - `Settings.tsx` 主题说明文案「本机浏览器」→「账号跨设备同步」
  - **验证**：verify.sh 全绿；playwright 冒烟 data-theme=journal-notebook(-dark)、paper/ink/brand 变量正确、暗色缓存持久化生效
  - **下一步 P2**：外壳 Layout/Sidebar/SiteTopBar/BottomNav 换装（顶部导航+印章+手机 Tab）
- 2026-11-16 **P2 完成（未提交）**：
  - 新增 `components/NotebookNav.tsx`：`TopNav`（桌面：考研手记+STUDY LOG·VOL.{年} / 5 文字链接 / 右侧 搜索·设置+印章 D-xxx）+ `MobileHead`（手机页头：品牌+搜索/设置+印章，P4 起换各页 mTop 标题）+ 共享 `ExamStamp`（examDate 空不渲染，负值显示 D+n）
  - `journal-b.css` 追加外壳类：`.nb-topnav/.nb-brand/.nb-navlink/.nb-topnav-right/.nb-mhead/.nb-tabbar`（激活=600+2px 红下划线用透明 border 防位移；Tab 宋体文字+红下划线 box-shadow 同款）；响应式一律走 `@media (max-width:767px)`（unlayered CSS 压过 tailwind 响应式工具类）
  - `Layout.tsx`：删 SiteTopBar+Sidebar+flex 侧栏布局 → TopNav + MobileHead(仅手机) + 主区
  - `BottomNav.tsx` 重写：图标 Tab+「更多」Sheet → 5 宋体文字 Tab（今日/计划/日历/时光/统计），保留 `journal-bottom-nav` 类（Sheet 遮挡 CSS 依赖）
  - 删除 `SiteTopBar.tsx`（含 `/v1/site/config` 博客残留调用）+ `Sidebar.tsx`（功能全部已被 Settings 覆盖：主题/导出/导入/版本）；`index.css` `--journal-bottom-nav` 4.5rem→4rem 对齐新 Tab 高
  - **手机端无入口页核对**：搜索/设置=页头链接、年度=Stats 页按钮（与桌面一致）、表单=页内 Modal——无孤儿路由
  - **验证**：verify.sh 绿；playwright 冒烟 27 项全过（1440/390：顶栏/Tab 显隐、7 链接序、激活态红下划线 rgb(210,59,34)、印章 D-34+考研 rotate(-2deg)、宋体 Tab、零 pageerror）
  - **下一步 P3**：原子组件 Sheet/Pressable/ConfirmDialog/QueryState 换 nb- 规则
- 2026-11-16 **P3 完成（未提交）**：
  - `index.css` `.journal-sheet-panel`：手机=顶部 1.5px 墨线+直角+无阴影（对齐原型 .sheet）；桌面≥768=540px 直角纸卡 1.5px 墨线+`8px 8px 0` 硬阴影（原 28rem/圆角20px/软阴影）；`.journal-sheet-backdrop` 底色收进 CSS（`rgba(27,36,51,.33)` 同 nb-scrim），JSX 去掉 bg-black/40
  - `Sheet.tsx`：拖拽柄 rounded-full→方条 `bg-ink`
  - `journal-b.css` 新增 `.nb-dialog-h`（宋体20px/700+1.5px 墨线下划）
  - `ConfirmDialog`：标题→nb-dialog-h；按钮→`nb-btn`（取消）/`nb-btn p`（确认）/`nb-btn r`（danger），去 rounded-full/rounded-md/内联色
  - `QueryState`：骨架块去圆角、错误卡去 rounded-xl、重试→`nb-btn p`、空态虚线框改方框+标题 nb-serif
  - **Pressable 不动**：行为原语（scale/触达），视觉由消费方类名决定，圆角残留归 P4 页面期逐个清
  - **横线纸不动**：四组件无笔记面；`.diary-paper`/`.diary-content` 行高对齐归 P4 页面期
  - **验证**：verify.sh 绿；playwright 冒烟 14 项全过（Sheet 桌面 540px/墨线/硬阴影、手机贴底无阴影、遮罩色、ConfirmDialog 宋体标题+墨线+双 nb-btn 墨底确认钮）
  - **下一步 P4**：页面逐页换装（today→…→login 对照 shots/）
- 2026-11-16 | **P4-1 今日页完成**：TodayDetail 改 nb-book 对开（左=日期大标题+状态选择+今日学习 nb-table+nb-sum 荧光笔合计+待办+横线纸小结；右=本月 nb-cal 小日历 MiniMonthCal（新组件，useDayMarks 驱动，点格进当天）+本月目标 nb-goal 行）；联动换装 MoodSelector(nb-state)/LearningRecordCard(nb-table tr)/DiaryEditor(nb-note+nb-chip)/TodayGoalsSection(nb-goal+nb-todo，逻辑零改)/Layout /day/ 栏宽 1240px；journal-b.css 补 button.nb-sec-side/nb-cal-cell/nb-todo 重置+手机 nb-date 折行；diary-content 行高 32→30 对齐横线；每日一句+SproutBadge 卡片按 SPEC 移除（装饰性，streak 并入日期 meta）；verify.sh 绿+playwright 16 项全过（双页并排/单列/宋体/等宽/横线 30px/状态 .on 红椭圆） | → 本提交
- 2026-11-16 | **P4-2 日历页完成**：MonthView 改 nb-book.nb-side300 不对称对开（左=月份大标题+nb-pager ‹2026.11›+回到今天 nb-btn.r+h112 大月历+脚注；右 300px=本月小计 nb-table 五行[记录天数/时长/日均/达标天数/最长单日]+状态图例 nb-legend 正字 tally+本月待办 taskDone/taskTotal）；抽出共享 CalGrid（月历格渲染，today 页小日历同源，--nb-cal-h 高度档 h60/72/86/112+手机统一56px）；删孤儿 DateCard；Layout '/' 栏宽 1040→1240px；constants 加 EN_MONTHS；verify.sh 绿+playwright 18 项全过（格高 112/72/56、右栏 300px、翻页生效、today 回归零破坏） | → 本提交
- 2026-11-16 | **P4-3 计划页完成**：PlanView 改 nb-book 对开（有目标=左右双页/无目标=nb-single 空态单页）；左页=月份大标题+nb-pager ‹YYYY.MM›+回到今天+完成度框（大百分比 nb-pbox-num+25格 nb-meter+完成度小计）+数量型 COUNT 目标 nb-goal 行（科目色签/标题/actual/total unit/状态备注）；右页=结转横幅（carriedFrom 目标 nb-note 提示）+清单型 CHECKLIST 目标行；GoalRow 复用 progressCells(domain.ts 新共享，TodayDetail meterCells 收编)；修复重写时 hooks 顺序违规（subjectColorById useMemo 原在 isPending 早退之后→渲染崩溃，移到 hooks 区顶部）；Layout /plan 栏宽 880→1240px；verify.sh 绿+playwright 冒烟全过（种子 1 COUNT+1 CHECKLIST 目标验证双栏/值格式/手机单列/零 pageerror，测后已删） | → 本提交
- 2026-11-16 | **P4-4 目标详情页完成**：GoalDetail 改 nb-book 对开；左页=nb-back 返回链（‹ 计划 / 数量型|清单型）+nb-hero（宋体 40px 标题+mono 72px actualValue+/total unit+nb-stamp 百分比+40 格 nb-meter-hero）+nb-kv 四格（剩余/剩余天数/计划日均/按剩余追赶品牌红）+COUNT 每周进度 nb-table（周标签+15 格 meter+actual/planned ✓）+备注 nb-note 横线纸+nb-actions（结转下月 nb-btn / 删除目标 nb-btn.r）；右页 COUNT=nb-sec 打卡日历+nb-cal h86 自绘格（nb-cal-checkin：日期+nb-stamp-circle 旋转盖章圈显 quantity，future 淡色不可点，today 红框；点已打卡→确认取消，点空→GoalCompleteSheet）+nb-checkin-bar 今日快捷条（今日 M.D 打卡+num field 预填 suggestedDaily+单位+盖章 nb-btn.p 开 sheet）；CHECKLIST=nb-sec 小目标+nb-taskform（nb-field+三 nb-chip 绑定[本月随时/某日/某周]+条件日期 nb-field+添加 nb-btn.p）+nb-taskrow（nb-box 勾选→done 开 sheet/取消、划线标题、taskWhen+doneAt meta、reflection、Trash2 删除）；修复存量 bug：CHECKLIST 目标 checkins 服务端返回 null→checkinMap forEach 崩溃白屏（旧版 GoalDetail 同病，一并修）；GoalProgressBar/ArrowLeft/Plus/daysInPeriod 移除；journal-b.css +~180 行目标详情样式（含手机 767px 适配：hero 28/48px、stamp-circle 缩小、checkin 格 10px）；verify.sh 绿+playwright 30 项全过（COUNT/CHECKLIST 双页、40格、2盖章圈、点格弹确认/sheet、任务交互、手机纵向、零 pageerror，种子数据已清） | → 本提交
- 2026-11-16 | **P4-5 学习记录表单（learn-form）+ GoalCompleteSheet 完成**：LearningFormModal 按原型 formLearn 重写——Sheet 外壳沿用 P3 nb- 纸卡；内部 nb-dialog-h 标题（补一条学习/编辑学习记录）+科目 nb-chip 排（subjects.map+.on 选中态+nb-chip-dash 虚线「其他…」→展开新科目名 nb-field+8 色 nb-swatch 方块）+内容 nb-field（可选）+时长双 nb-field.num nb-dur（h/m）+25m/45m/1h 预设 nb-chip（点击直接填 hours/minutes）+备注 textarea.nb-note nb-note-input 横线纸（同 DiaryEditor 模式）+右下 取消 nb-btn/记下 nb-btn.p；逻辑零改（EntryDraft/NEW_SUBJECT/durationError/submitting 全保留）；GoalCompleteSheet 同批 nb- 化（不在页面清单但被 P4-4 目标页调用，不换会新旧混排）——nb-dialog-h 记下完成+副标题、数量 nb-field.num、时长 nb-dur h/m、感想 nb-note-input、完成 nb-btn.p；journal-b.css +~40 行（nb-chip-dash/nb-swatch/nb-dur/nb-note-input+手机适配）；verify.sh 绿+playwright 全过（Sheet 开合、flab×4、chip 选中/其他展开/预设 45m 填充、真提交条目行出现、GoalCompleteSheet 盖章提交、手机底部 Sheet、零 pageerror；测试条目/目标/打卡已清） | → 本提交
- 2026-11-16 | **P4-6 目标表单（goal-form）完成**：GoalFormModal 按原型重写——nb-dialog-h 标题带 period（月切片）；类型 nb-chip 双选（数量型·刷题/单词/套卷、清单型·章节/知识点，原 pill 按钮换 chip）；标题 nb-field；COUNT=grid 1fr/120px 目标数量 nb-field.num+单位 nb-field，CHECKLIST=nb-flab-hint 提示；科目 select 下拉→nb-chip 排（nb-chip-dash 不关联+现有科目，handleSubjectChange 联动 color 逻辑保留）；COUNT 拆分预览 plain caption→nb-split 虚线框（拆分：日均 <b class=nb-hl>plannedDaily</b> · 每周 plannedWeekly · 共 days 天，与原型一致）；说明 nb-field 保留（原型未画但功能在）；颜色圆点→nb-swatch 方块（选中 brand 描边）；按钮 取消 nb-btn/创建→立下 nb-btn.p；journal-b.css +~15 行（nb-split/nb-flab-hint）；verify.sh 绿+playwright 全过（标题文案、类型 chip、拆分预览数字正确[300词→日均10/周50/共30天]、CHECKLIST 无数量/拆分、科目不关联+6科目 chip、两种类型真提交均跳 /plan/:id、手机底部 Sheet、零 pageerror；走查目标已清） | → 本提交
- 2026-11-16 | **P4-7 统计页（stats）完成**：Stats.tsx 全量重写弃 recharts——左页 nb-date（统计+meta+月 on chip/年度 chip→/annual?year=+nb-pager ‹YYYY.MM›）+nb-kv 四格（总时长 formatDuration/学习天数/日均=totalMin÷daysRecorded/最长连续=marks 连续 totalMin>0 前端派生）+每日学习时长 nb-bars 纯 CSS 柱图（30 列 nb-bar-col button 全列可点→/day/:date；nb-bar ink 柱 min4%/today brand 红柱；nb-bars-goal 绝对定位红虚线 bottom=dailyGoalMin/scaleMax；scaleMax=max(goal,最大日)；nb-bar-label 每 1/5/10…天号）；右页 nb-sec 学科分布 nb-table（nb-k 彩字科目名+nb-meter 20格按 minutes/subjectTotal+small 占比%+nb-m 时长）+nb-sec 状态记数 nb-table（label serif 粗体 polarity<0→ink-faint 否则 brand+nb-zheng 正字+N 天，复用 useStates+findStateConfig polarity）；空数据→nb-single+QueryEmpty+nb-btn.p 去记第一天；journal-b.css +~90 行（nb-bars/nb-bar-col/nb-bar/nb-bars-goal/nb-bar-label/nb-mono+手机 KV 2列/柱高140）；删 useIsDark/recharts/MONTH_LABELS 等旧依赖（recharts 仍被 AnnualReview 用，依赖保留）；verify.sh 绿+playwright 30 项全过（种子 5 天数据验 KV=6h50m/5天/日均1h22m/连续5天、30 柱 5 有柱、3 学科行/2 状态行正字、点柱跳当天、年度 chip 跳 annual、2026-09 空月单页降级、手机 KV 两列+柱 140px+两页纵向、零 pageerror；种子已清） | → 本提交
