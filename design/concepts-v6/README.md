# 手帐 v6 概念稿 · 考研向（A 石墨 / B 格纸 / C 夜读）

> 给后续实现者（含便宜模型）的入口文档。整体开发顺序以 `docs/roadmap.md` 为准（UI 换装 = M6）。先读本文件，再读选中版本的 `SPEC-<X>.md`。
> 概念稿是 **静态 HTML 原型**，不是可直接拷贝的 React 代码；实现时按 SPEC 的 token + 组件规则改写现有组件。

## 1. 目录

```
design/concepts-v6/
├── README.md            ← 本文件：共享约定、数据映射、页面清单、新功能、实现顺序
├── SPEC-A.md / SPEC-B.md / SPEC-C.md   ← 各版 token、组件、逐页布局
├── data.js              ← 全部假数据（考研场景），三版共用
├── a-graphite.html      ← ?page=<id> 切换页面
├── b-notebook.html
├── c-midnight.html
├── index.html           ← 总览（按版本分组看截图）
├── shot.mjs             ← 截图：node design/concepts-v6/shot.mjs a-graphite b-notebook c-midnight
└── shots/<concept>/<page>-desktop.png | <page>-mobile.png
```

预览：`cd design/concepts-v6 && python3 -m http.server 5190`，打开 `http://127.0.0.1:5190/`，
单页如 `a-graphite.html?page=goal`。截图需本机 Chrome（playwright `channel:'chrome'`）。

## 2. 页面清单（三版通用 page id → 现有源文件）

| page id | 页面 | 现有源文件（`study-journey/src/`） | 数据来源（已有 API） | 手机稿 |
|---|---|---|---|---|
| `today` | 今日 / 单日详情 | `pages/TodayDetail.tsx` + `LearningRecordCard` `MoodSelector` `DiaryEditor` `TodayGoalsSection` | `getRecordByDate` `getTodayGoals` `getStreak` `getGoalsByPeriod` | ✓ |
| `calendar` | 月历 | `pages/MonthView.tsx` + `DateCard.tsx` | `getRecordsByMonth` + `getGoalsByPeriod().dayMarks` | ✓ |
| `plan` | 月计划 | `pages/PlanView.tsx` + `GoalProgressBar` | `getGoalsByPeriod` `carryOverGoal` | ✓ |
| `goal` | 目标详情 | `pages/GoalDetail.tsx` + `GoalCompleteSheet` | `getGoal` `upsertCheckIn` `deleteCheckIn` `completeGoalTask` | ✓ |
| `memory` | 时光 | `pages/Memory.tsx` | `getRecordsByYear` | — |
| `stats` | 统计（月） | `pages/Stats.tsx` | `getRecordsByMonth` | ✓ |
| `annual` | 年度回顾 | `pages/AnnualReview.tsx` | `getRecordsByYear` | — |
| `search` | 搜索 | `pages/Search.tsx` | `searchDiary` | — |
| `settings` | 设置 | `pages/Settings.tsx` + `MoodEditModal` | `getCustomMoods` 等 + `exportAllData` `importData` | — |
| `login` | 登录 | `components/LoginPage.tsx` | 现有 auth | — |
| `learn-form` | 记一条（弹层） | `components/LearningFormModal.tsx` | `upsertRecord` | ✓（底部 Sheet） |
| `goal-form` | 新建目标（弹层） | `components/GoalFormModal.tsx` | `createGoal` `previewCountSplit` | — |
| `focus` | 专注计时（**仅 C**） | 无，需新建 `pages/Focus.tsx` | 结束时 `upsertRecord` 追加 learning | ✓ |

外壳：`components/Layout.tsx`（桌面侧栏/顶栏 → `Sidebar.tsx` / `SiteTopBar.tsx`；手机 → `BottomNav.tsx`）。
无手机稿的页面：沿用对应版本手机外壳 + 单列堆叠桌面卡片即可。

## 3. 数据映射（不改后端）

- **心情 → 状态**：`MoodType` key 不变，只改 `lib/constants.ts` `MOOD_CONFIGS` 的 `label` 与三档色（每版色值见各 SPEC §2）。
  | key | 新 label |
  |---|---|
  | `inspired` | 专注 |
  | `happy` | 顺利 |
  | `calm` | 平稳 |
  | `tired` | 疲惫 |
  | `anxious` | 焦虑 |
  | `sad` | 低落 |
  `flower` 字段改为可选并不再展示；`emoji` 不在主界面展示。
- **学习条目**：`LearningItem{subject,durationMin,note,color}` 不变。
  - `subject` = 科目名（预设：数学一 / 408 / 英语一 / 政治，可自定义）。
  - 原型里的「标题 + 副行」= `note` 的**第一行**作标题，其余行作副行；表单里「内容」「备注」两个输入框保存时用 `\n` 拼进 `note`。
  - `color` = 科目色（各 SPEC 给出 4 科默认色，写入 `SUBJECT_COLORS` 前 4 位）。
- **今日待办** = `getTodayGoals(date)` 的清单子任务；完成数 / 总数来自 `dayMarks`。
- **进度**：后端读时计算，前端只展示 `percent/actualValue/totalValue/suggestedDaily/remainingDays` 等现有字段。

## 4. 新功能（原型里出现、但现在没有的）

| 功能 | 出现在 | 实现建议 | 需要后端？ |
|---|---|---|---|
| 考研倒计时（名称 + 日期） | 三版首页 / 设置 / 登录 | `AppContext` 新增 `examName/examDate`，存 localStorage（同 `dailyGoalMin` 做法） | 否 |
| 阶段刻度（A 的 40 格） | A today | 纯前端：`(今天-起始)/(考试-起始)`，起始取首条记录日期 | 否 |
| 科目预设 | 设置 / 记一条 | localStorage 数组 `{name,color}`，默认 4 科 | 否 |
| 学习热力图 | A today / annual | `getRecordsByYear` 聚合 `totalDuration` | 否 |
| 本周时长柱 | A today | 当月 + 上月记录过滤本周 | 否 |
| 快捷时长 chips（25m/45m/1h/2h） | 记一条 | 纯前端填充时/分 | 否 |
| 专注计时（番茄） | **C** focus | 新页面；计时状态存 localStorage（防刷新丢失）；完成时向当天 `learnings` 追加一条 | 否（v1）|
| 外观切换为本版主题 | 设置 | 新增 journal 专属 `data-theme`，见 §5 | 否 |

**明确不做**：改 MySQL 表、改 `/api/journal` 接口、改 Snowflake/nanoid 规则。

## 5. 主题接入点（重要）

现状：手帐通过 `data-theme` 复用博客 8 套主题（`lib/theme.ts`，key `mysite_theme_v2`），`src/index.css` 把博客变量别名成手帐变量：

```
--paper←--bg-primary  --card←--bg-elevated  --ink←--text-primary  --ink-soft←--text-secondary
--ink-faint←--text-muted  --hairline←--border-subtle  --keyline←--border
--brand←--accent  --brand-ink←--accent-hover  --brand-soft←--accent-subtle  --pine←--success
```

接入方式：
1. 新建 `src/styles/themes/journal-<x>.css`，定义 `[data-theme="journal-<x>"]` 下的**博客层变量**（`--bg-primary` 等，值见 SPEC §1 映射表），并追加本版专有变量（科目色、状态色、字体等）。
2. `lib/theme.ts` 的 `ThemeId` / `THEME_REGISTRY` 加入 journal 专属 id；**不要写回博客 key**，否则博客读到未知主题。剥离前：journal-* 只存 `study-journal-theme`；剥离后（M3 起）：主题存服务端 `setting.theme`（`docs/data-model.md`），彻底与博客 key 脱钩。
3. 组件里只用 `var(--ink)` 这类别名，**禁止硬编码色值**（科目色/状态色例外，走 `MOOD_CONFIGS` / `SUBJECT_COLORS`）。
4. 字体：A/C 用系统等宽做数字；B 依赖宋体（`Songti SC`/`Noto Serif SC`），Windows/Android 无宋体时回退衬线即可，不引入 webfont。

## 6. 实现顺序（建议拆 PR，一次一个关注点）

1. 主题 css + `theme.ts` 注册 + `MOOD_CONFIGS` 换 label/色 → 全站换皮（不动布局）。
2. 外壳：`Layout` / `Sidebar` / `SiteTopBar` / `BottomNav`。
3. 原子组件：卡片、按钮、chip/tag、复选框、进度条、圆环、弹层/Sheet（SPEC §3）。
4. 页面按优先级：`today` → `calendar` → `plan` → `goal` → `learn-form` → `goal-form` → `stats` → `memory` → `annual` → `search` → `settings` → `login`。
5. 新功能（§4）：倒计时 → 科目预设 → 热力图 →（C）专注。

每步验收：`npm run build`（含 `tsc`）通过；用 `?page=` 对应截图在 1440 宽与 390 宽目视比对；深色/浅色（若有）都看一遍。

## 7. 偏差处理

- 原型数值为假数据，布局优先、像素其次；间距按 SPEC 的 4/8 栅格取整。
- 原型与现有交互冲突时（如日记 Markdown 预览、乐观更新、Toast），**保留现有交互**，只换皮。
- 原型里缺的状态（空态 / 加载 / 错误）：沿用 `QueryState.tsx`，按本版 token 换皮；文案见现有代码。
