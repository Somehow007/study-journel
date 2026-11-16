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
