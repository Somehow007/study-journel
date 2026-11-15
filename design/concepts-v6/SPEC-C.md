# SPEC-C · 夜读 Midnight

> 关键词：深海夜空 / 玻璃拟态 / 冷青辉光 / 专注计时为首屏 / 沉静。
> 原型：`c-midnight.html?page=<id>`；截图：`shots/c-midnight/`。共享约定见 `README.md`。

## 1. Token

### 1.1 博客层变量映射（`[data-theme="journal-midnight"]`）

| 博客变量 | 夜读（默认） | 晨读浅色（`journal-midnight-light`） | 用途 |
|---|---|---|---|
| `--bg-primary` | `#070B14` | `#F3F6FA` | `--paper`（其上叠背景渐变） |
| `--bg-elevated` | `rgba(255,255,255,.035)` | `rgba(255,255,255,.72)` | 玻璃卡 `--card` |
| `--glass-border` | `rgba(255,255,255,.07)` | `rgba(15,30,60,.08)` | 玻璃描边 |
| `--glass-blur` | `20px` | `20px` | |
| `--bg-code` | `rgba(255,255,255,.04)` | `#E9EEF5` | 输入/小统计块 |
| `--text-primary` | `#E6ECF5` | `#0E1726` | `--ink` |
| `--text-secondary` | `#9AA7BB` | `#4A5A72` | `--ink-soft` |
| `--text-muted` | `#5C6880` | `#8794A8` | `--ink-faint` |
| `--border` | `#1B2436` | `#DCE3EC` | 分隔线 `--keyline` |
| `--accent` | `#5EEAD4` | `#0FA897` | `--brand` |
| `--accent-hover` | `#7AF0DE` | `#0B8A7C` | |
| `--accent-subtle` | `#5EEAD414` | `#0FA89714` | |
| `--text-inverse` | `#04201C` | `#FFFFFF` | 青色主按钮文字 |
| `--warning` | `#F2C66D` | `#C98A12` | 落后 / 目标线 |

### 1.2 专有变量

```css
--accent-2: #7AA2FF;                       /* 渐变第二色（圆环、柱、进度） */
--grad-accent: linear-gradient(120deg,#7AA2FF,#5EEAD4);
--glow: 0 0 8px #5EEAD488;                 /* 辉光：激活点、进度条、圆环 drop-shadow */
--sky: radial-gradient(900px 500px at 20% -10%,#14305a,transparent 60%),
       radial-gradient(700px 500px at 100% 100%,#0d3b44,transparent 60%), var(--paper);
--font-num: "SF Mono",Menlo,monospace;     /* 计时器 200 字重，统计 500 */
--subject-math:#7AA2FF; --subject-cs:#5EEAD4; --subject-eng:#F2C66D; --subject-pol:#F08AA0;
```

- 星点背景：`<svg>` 绝对定位，90 个 0.6–1.1px 白点、透明度 .15–.47；坐标用 `sin` 哈希伪随机（**不要**用 `i*常数 % 100`，会排成竖线）。浅色版关闭星点。
- 圆角：玻璃卡 20px，按钮 12px，输入 12px，日历格 14px，弹层 24px，chip 999px。
- 动效（实现时补）：计时圆环每秒推进；激活点 2s 呼吸辉光；进入页 200ms fade-up。

## 2. 状态（MOOD_CONFIGS）色值

| key | label | solid | ink | tint | dark.solid | dark.ink | dark.tint |
|---|---|---|---|---|---|---|---|
| inspired | 专注 | `#0FA897` | `#0A6E63` | `#DDF6F2` | `#5EEAD4` | `#BDF6EC` | `#0F2A2A` |
| happy | 顺利 | `#5BA72E` | `#3B6E1D` | `#E7F4DD` | `#9BE15D` | `#D5F3B8` | `#1C2A14` |
| calm | 平稳 | `#3F6FE0` | `#284A99` | `#E3EBFC` | `#7AA2FF` | `#CCDAFF` | `#151F38` |
| tired | 疲惫 | `#6E7A90` | `#47505F` | `#EBEEF2` | `#8892A6` | `#CDD3DE` | `#1A2030` |
| anxious | 焦虑 | `#C98A12` | `#835A0B` | `#F8EED8` | `#F2C66D` | `#F8E3B5` | `#2C2614` |
| sad | 低落 | `#7A62D9` | `#4F3F92` | `#ECE7FB` | `#B39DFF` | `#DDD3FF` | `#201B36` |

## 3. 组件规则

| 组件 | 规则 |
|---|---|
| **顶栏**（桌面，无侧栏） | 左：青色辉光点 +「夜读」；导航文字 专注/今日/计划/日历/时光/统计，激活 = `--ink` + 下方 2px 青色辉光线；右：⌕ 搜索 / 设置 / 等宽 `23:41 · D-398` |
| **玻璃卡 Glass** | `--card` 底 + 1px `--glass-border` + `backdrop-filter: blur(20px)`，20px 圆角；卡标题 13px/500 `--ink-soft`，右侧 `--ink-faint` |
| **圆环 Orb** | 渐变描边 `#7AA2FF→#5EEAD4`，圆头，`drop-shadow(var(--glow))`；槽 `#ffffff0d`；尺寸：专注 380/6px，详情 240/7px，今日 120/6px，小 56/4px |
| **计时器** | 等宽 84px/200 字重；下方科目点 + 任务名 15px |
| **Chip（状态提示）** | 青色 1px 描边 55% + 青色 7% 底 + 青色呼吸点 |
| **Pill（选择）** | 999px，1px 玻璃描边；选中：青色描边 + 青字 + 8% 青底 |
| **按钮** | 主：青底深字 600 + `0 0 24px #5EEAD455` 外发光；次：1px 白 12% 描边 |
| **科目 Sub** | 999px 小胶囊，科目色字 + 10% 底 |
| **复选框** | 18px/6px 圆角；选中 = 青色实心 + 辉光，无对勾也可 |
| **进度 Track** | 4–8px，槽 `#ffffff10`，填充科目色 + 同色辉光 |
| **今日分布条** | 10px 高圆角条，按科目时长 flex 分段（2px 间隔），剩余到目标部分 `#ffffff12` |
| **日历格** | 14px 圆角玻璃格；底部径向辉光 = 状态色，透明度随时长 16%→56%；右上状态点带辉光；今天 = 青色描边 + 外发光 |
| **折线图（统计）** | 青色 2.5px 折线 + 辉光 + 青色渐隐面积；今天点放大实心；目标线 = 黄色虚线 |
| **环形图（学科）** | 16px 粗分段圆环，段间 3px 空隙，中心总时长 |
| **弹层 Modal** | 520px，24px 圆角，`rgba(14,20,34,.92)`；遮罩 `#02040acc` + `blur(6px)` |
| **手机 Tab** | 5 项：今日 / 计划 / **专注（中间 44px 青色悬浮圆钮）** / 日历 / 统计 |

## 4. 逐页要点

- **focus（新页面，桌面默认首页候选）**：左区垂直居中 = 状态 chip / 380 圆环 + 计时器 + 科目任务 / 暂停·完成并记录·放弃 / 说明；左区底部 4 KPI（今日已学/连续/本周/状态）。右栏 400px = 倒计时卡（渐变数字）/ 今日分布 / 「接下来专注」待办。
  - 行为：从待办或科目选一项开始；默认时长取设置；`完成并记录` → 当天 `learnings` 追加 `{subject, durationMin: 实际分钟, note: 任务名, color}`；计时状态存 localStorage；切页面不中断。
- **today**：标题 `11 月 15 日` + 前一天/后一天/＋记一条。左：今日环 + 时长 + 分布条 ｜ 学习记录列表 ｜ 想法；右 400px：状态 pills ｜ 待办 ｜ 本月目标。
- **calendar**：4 KPI + 7 列辉光日历（格高 96）+ 图例。
- **plan**：完成度横幅（大圆环 + 每目标小圆环）；2 列玻璃目标卡（数量型 3 个小统计块；清单型子任务列表）。
- **goal**：左 340px = 240 圆环（大数字）/ 2×2 KPI（按剩余追赶为青色）/ 备注；右 = 打卡日历（蓝色深浅）+ 每周进度双柱（虚线 = 计划，实心渐变 = 实际，达成变青）。
- **memory**：居中竖轴（青→蓝渐隐），卡片左右交替，轴上状态色辉光点。
- **stats**：4 KPI；每日折线；学科环形图 + 列表 ｜ 状态横条（带辉光）。
- **annual**：大横幅「今年你一共学了 1046h」（96px 渐变细体数字）+ 3 统计；月度渐变圆角柱（最高月发光）｜ 学科进度。
- **search**：居中 880px；18px 圆角大输入（聚焦态）；类型 pills；玻璃结果卡，命中文字青色 + 辉光。
- **settings**：玻璃节卡（左 240px 标题）；比 A/B 多一节「专注时长」（25/45/50/90 + 休息/提示音）。
- **login**：无顶栏；中央 200 圆环显示 D-398 + 「夜读」+ 标语 + 玻璃登录卡。
- **learn-form**：底部提示「也可以 开始专注 自动计时」（跳 focus）。
