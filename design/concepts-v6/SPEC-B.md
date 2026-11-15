# SPEC-B · 格纸 Notebook

> 关键词：方格本对开页 / 米白纸 / 墨蓝字 / 红笔批注 / 宋体标题 / 印章 / 「正」字计数。
> 原型：`b-notebook.html?page=<id>`；截图：`shots/b-notebook/`。共享约定见 `README.md`。

## 1. Token

### 1.1 博客层变量映射（`[data-theme="journal-notebook"]`）

| 博客变量 | 米白（默认） | 夜间墨蓝（`journal-notebook-dark`） | 用途 |
|---|---|---|---|
| `--bg-primary` | `#F3F1EA` | `#141B29` | 桌面底（纸外） |
| `--bg-elevated` | `#FBFAF6` | `#1B2336` | 纸面 `--card`（叠方格背景） |
| `--bg-code` | `#EEEBE2` | `#222B40` | 表头/星期栏 |
| `--text-primary` | `#1B2433` | `#E4E6EA` | 墨色 `--ink` |
| `--text-secondary` | `#4A5363` | `#A9B0BD` | `--ink-soft` |
| `--text-muted` | `#8D919A` | `#6E7686` | `--ink-faint` |
| `--border` | `#CFCABB` | `#2E3850` | 实线格线 / 页缝 `--keyline` |
| `--border-subtle` | `#E4E1D6` | `#222B3E` | 方格线 `--hairline` |
| `--accent` | `#D23B22` | `#FF7A5C` | 红笔 `--brand` |
| `--accent-hover` | `#B32F19` | `#FF9478` | |
| `--accent-subtle` | `#D23B2233` | `#FF7A5C33` | 荧光笔高亮底 |
| `--success` | `#2F6B4F` | `#6FBF94` | 按计划 / 领先 |

### 1.2 专有变量

```css
--font-title: "Songti SC","Noto Serif SC","STSong",serif;   /* 页标题、小节标题、标签、按钮、状态 */
--font-num: "SF Mono",Menlo,monospace;                       /* 日期、时长、计数 */
--rule-dash: #BDB8A9;           /* 行间虚线（夜间 #36405A） */
--margin-line: #E8A090;         /* 时光页左侧红色页边线 */
--blue-pen: #1E4FA3;            /* 打卡盖章圈 */
--subject-math:#1E4FA3; --subject-cs:#2F6B4F; --subject-eng:#B07A12; --subject-pol:#D23B22;
--grid-size: 20px;
```

方格背景（纸面通用 class）：
```css
background-color: var(--card);
background-image: linear-gradient(var(--hairline) 1px,transparent 1px), linear-gradient(90deg,var(--hairline) 1px,transparent 1px);
background-size: 20px 20px; background-position: -1px -1px;
```

- 圆角：几乎为 0（纸张 4–6px、手机壳除外）；**不用胶囊圆角**。
- 阴影：纸张 `0 12px 30px #0000000f`；弹层卡片用硬阴影 `8px 8px 0 var(--ink)`。
- 线：标题下 1.5px 实线 `--ink`；行间 1px 虚线 `--rule-dash`。

## 2. 状态（MOOD_CONFIGS）色值

B 版状态主要用**文字颜色**区分：积极态红笔、消极态灰色。

| key | label | solid | ink | tint | dark.solid | dark.ink | dark.tint |
|---|---|---|---|---|---|---|---|
| inspired | 专注 | `#D23B22` | `#9C2814` | `#F8E1DB` | `#FF7A5C` | `#FFC2B3` | `#3A1F1A` |
| happy | 顺利 | `#C2571A` | `#8A3C10` | `#F7E6D8` | `#F29A5E` | `#F8D2B5` | `#38261A` |
| calm | 平稳 | `#1E4FA3` | `#163A78` | `#DEE6F4` | `#7FA2E6` | `#C9D7F4` | `#1C2740` |
| tired | 疲惫 | `#8D919A` | `#5C616B` | `#ECEBE6` | `#8A92A2` | `#C9CDD5` | `#252B38` |
| anxious | 焦虑 | `#B07A12` | `#7A540C` | `#F4EAD2` | `#E0B356` | `#F1DCAE` | `#352C18` |
| sad | 低落 | `#5E5A8C` | `#403D63` | `#E6E4EF` | `#A29DD6` | `#D3D0EE` | `#262438` |

日历/时光里的状态文字：`inspired/happy/calm` 用红笔色，`tired/anxious/sad` 用 `--ink-faint`。

## 3. 组件规则

| 组件 | 规则 |
|---|---|
| **顶部导航** | 左「考研手记」宋体 20px/700 + 等宽小字 `STUDY LOG · VOL.2026`；文字链接，激活 = 600 + 2px 红色下划线；右侧 搜索/设置 + **印章** |
| **印章 Stamp** | 2px 红色描边、红字等宽 700、`rotate(-2deg)`，内容 `D-398` + 小字考试名 |
| **对开页 Spread** | 两列 1fr 1fr；左页右侧 1px 页缝线 + 内阴影 `inset -18px 0 24px -20px #0002`，右页对称；单页面用 `.single` |
| **日期大标题** | 宋体 64px/700 + 右侧等宽两行小字；下方 1.5px 墨线 |
| **小节标题** | 宋体 15px/700，前置 8×8 墨色实心方块；右侧 12px 灰字操作，强调操作用红字 |
| **表格行** | 第 1 列科目（宋体 12px 科目色）· 内容（14px/600 + 12px 灰副行）· 右侧等宽时长；行间虚线 |
| **荧光笔** | 合计数字等重点：文字下方 9px 高 `--accent-subtle` 色块 |
| **复选框** | 15px 方框 1.5px 墨线；勾选 = **红色手写勾**（旋转 L 形）；完成文字删除线颜色为红 |
| **格子进度 Meter** | N 个等宽小方格（1px 墨线），已完成格涂实墨色；常用 N=20/25/40 |
| **状态选择** | 一排宋体文字，选中 = 红字 700 + 红色椭圆圈 |
| **Chip** | 直角 1.5px 描边（未选 `--rule-dash`），选中红边红字 700 |
| **按钮** | 宋体 13px/600，1.5px 墨线直角；主按钮墨底纸色字；危险/强调红边红字 |
| **输入 Field** | 无框，仅 1.5px 底线；聚焦底线变红 |
| **横线纸 Note** | 日记/备注区域：`repeating-linear-gradient(transparent 0 29px, var(--keyline) 29px 30px)`，宋体 15px/30px |
| **KV 统计条** | 上下 1.5px 墨线，内部 N 列虚线分隔；小字宋体 + 大字等宽 22–26px |
| **「正」字计数** | 宋体 700 红色；`正`×⌊n/5⌋ + 余数 `['','一','丅','下','止']` |
| **日历** | 上 1.5px 墨线，格线实线 `--keyline`；星期栏 `--bg-code` 底；格内：左上日期、右上状态字、左下大时长（等宽 15px）+ 时长横线；今天：白底 + 2px 红框 |
| **打卡盖章** | 打卡日历的数量 = 蓝色圆圈印（2px `--blue-pen`，按日期伪随机旋转 ±10°） |
| **弹层 Card** | 540px 直角纸卡，1.5px 墨线 + 8px 硬阴影；标题宋体 20px 下划墨线；遮罩 `#1b243355` |
| **手机** | 整屏方格纸；Tab 为宋体文字 + 红色下划线；Sheet 为纸面 + 顶部 1.5px 墨线 |

## 4. 逐页要点

- **today**：左页 = 日期标题（右侧状态选择）/ 今日学习表 / 合计（荧光笔）/ 待办 / 横线纸小结；右页 = 「十一月」小月历 + 本月目标格子进度。
- **calendar**：左大页月历（格高 112）+ 右窄页 300px「本月小计」表 / 状态图例（带「正」字）/ 本月待办完成数。
- **plan**：左页 = 标题 + 完成度框（大百分比 + 25 格）+ 数量型目标列表 + 红色虚线结转横幅；右页 = 清单型目标（子任务复选框 + 日期）。
- **goal**：左页 = 标题 / 72px 大数字 + 印章百分比 / 40 格进度 / KV 四格 / 每周进度表 / 备注 / 编辑·结转·删除；右页 = 盖章打卡日历 + 底部「今日打卡 [30] 题 [盖章]」。
- **memory**：单页；左侧 150px 处红色页边线，左栏右对齐大日期 + 星期，右栏状态/时长/科目 + 横线纸日记；无日记显示灰色「（这天没写想法）」。
- **stats**：左页 KV + 墨色柱状图（今天红柱、红色虚线目标）；右页学科分布表（格子进度）+ 状态「正」字表。
- **annual**：左页「二〇二六」+ KV + 月度柱（最高月红色）+ 学科表；右页 12 个迷你月历（3×4，深浅 = 时长）。
- **search**：「查：」+ 下划线大输入；类型 chips；结果为微旋转的纸质索引卡（3 列）。
- **settings**：单页表单行（左 260px 宋体标题 + 说明，右侧下划线输入/chips/按钮）。
- **login**：墨蓝布面封面（左侧书脊内阴影），中间白色标签纸含标题 / 姓名 / 口令 /「翻开」按钮，右下角印章 D-398。
