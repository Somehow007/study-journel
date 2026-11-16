# S2 手机整屏纸面（依赖 S1）

## 问题 / 目标
SPEC-B §3「手机：整屏方格纸」。现状 390 宽：手机头在纸外（桌面底色），`.nb-book` 有 `margin:16px 12px 24px` + 边框 + 阴影，顶部浪费 ~130px、左右各少 ~30px；各页 64px 大标题在手机上折行（「十一月计/划」）。

## 改动范围
- `apps/web/src/styles/journal-b.css`：`@media (max-width: 767px)` 块（L50 附近）与 `.nb-mhead` 手机样式（桌面 L823 `display:none`；手机规则在 L873 附近的媒体查询内）。
- `apps/web/src/components/Layout.tsx`（仅当需要给 main 加纸面底色 class 时）。

## 方案（纯 CSS 为主）
1. 767px 以下：
   - `.nb-book` → `margin: 0; border: 0; box-shadow: none;`
   - 手机下整个 `main` 背景要是纸面方格（与 `.nb-gridbg` 相同的 `--card` + 方格 background），让 MobileHead 与书页连成一张纸。优先在 CSS 里给 `.nb-mhead` 与 `main` 设方格背景；若 `main` 无可用 class，在 Layout 的 `<main>` 加 `nb-mobile-paper` class，只在 767px 媒体查询内生效。
   - `.nb-mhead`：去掉与纸面割裂的边框/底色，底部一条 `1.5px solid var(--ink)` 墨线（与概念稿手机头一致），左右 padding 与 `.nb-page` 手机 padding（20px）对齐。
   - `.nb-date-num` 手机 → `font-size: 40px`（已有 `.nb-date-num.sm` 为 40px，可复用同值）；保证「十一月计划」「二〇二六」单行。
2. 不改 MobileHead 的内容（决策 3：不按页显示标题）。
3. 底部 Tab（`.nb-tabbar`）不动。

## 验收
- `./scripts/verify.sh` 全绿。
- `./scripts/visual.sh calendar,today,plan,goal,stats,learn-form`：
  - 390 下书页左右贴边（`.nb-book` 宽 = 390），手机头与书页之间无桌面底色缝隙；
  - 首屏可见内容比修改前多 ≥100px（对比修改前截图里「今日学习」的 y 坐标）；
  - 所有大标题单行；零横向溢出；
  - learn-form 底部 Sheet 仍正常（顶部 1.5px 墨线）。
- 1440 截图与 S1 后相比无变化。

## 提交
`fix(web): 手机整屏方格纸——去书页外边距/边框，手机头并入纸面，大标题 40px`

## 执行记录

2026-11-16 执行（Devin）：

**改动**（2 文件，均在卡范围内）：
- `apps/web/src/styles/journal-b.css`
  - L49 `@media(max-width:767px)`：`.nb-book`/`.nb-side300` → `margin:0; border:0; box-shadow:none`；新增 `.nb-page.nb-gridbg{background:none}`（页底透明，露出 main 连续方格，避免逐页格线错位）；末尾新增 `.nb-page .nb-date-num{font-size:40px}`（必须带 `.nb-page` 前缀——裸 `.nb-date-num` 与 L98 基础规则同优先级但源码序在前，会被 64px 覆盖，首版踩过）。
  - L878 同媒体块：新增 `.nb-mobile-paper`（与 `.nb-gridbg` 同款 `--card`+方格 background，复制声明而非复用类——`nb-gridbg` 直接挂 main 会在桌面也生效）；`.nb-mhead` padding `14px 22px 12px`→`14px 20px 12px`（对齐 `.nb-page` 20px），新增 `border-bottom:1.5px solid var(--ink)`。
- `apps/web/src/components/Layout.tsx`：`<main>` 加 `nb-mobile-paper` class（无其他改动；桌面端该类无任何样式声明，不生效）。

**验收实测**（临时库 8091 + vite 5176，同 visual.sh 口径；measure.mjs 量 DOM + PIL 读截图像素）：
- `./scripts/verify.sh` 全绿。
- shot.mjs 跑 `calendar,today,plan,goal,stats,learn-form`：**零 pageerror / 零横向溢出**（overflow=0 ×5 页）。
- 390 下 `.nb-book` = left:0 / width:390 / top:61.5（原 12/366/76.5）；`main` 计算样式含方格 background；`.nb-page` 底透明；`.nb-mhead` 底边 `1.5px solid var(--ink)`（computed 报 1px 为浏览器取整，与 `.nb-topnav` 同表现）。
- 像素验证：6 页手机截图顶部 y=0 起即 SHEET+20px 方格节奏连续（无 PAPER 色带、无接缝错位），y≈61 全宽墨线 = mhead 下边框；learn-form 底部 Sheet 顶部墨线仍在（y=283，scrim 变暗属正常遮罩）。
- 大标题：`.nb-date-num` 全部 40px / 高 36px 单行（calendar 十一月 117.6px、today 11.16 79.8px、plan 十一月计划 196px、stats 统计 78.4px，均 << 350px 内容宽）。
- **桌面回归**：6 页 1440 截图与 S1 后基线 `/tmp/sj-visual.qVEf09` **逐像素 diff 为空**（完全一致）。

**与验收标准的偏差（如实记录）**：「今日学习」sec y 坐标 227.1 → 198.5，仅 **+28.6px**，未达卡内 ≥100px 期望值。原因：~130px「顶部浪费」估算把手机头（60.5px）计入，但决策 3 明确保留品牌头不改内容；实际可回收的只有书页 margin/边框（-15px）+ 大标题降字号（-13.6px 净）。纸面本身上移 77px（SHEET 从 y≈77 提到 y=0），可视纸面面积增量约 +77px。若 owner 认为还不够，剩余空间在 mhead 内容/留白（属决策 3 范围，需另行拍板）。

**S2 后走查（2026-11-16 补记）**：9 路由 ×390 全过 + 弹层/空态/暗色/错误态——零 pageerror、零横向溢出、书页全 390 贴边、各页顶部方格自 y=0 连续、tabbar `--paper` 区与概念稿一致、登录页不受影响（Layout 外）、goal-form 底部 Sheet 墨线正常、暗色 mhead 墨线正常。
- **修复 1 处（本卡引入的回归）**：`main` 仅 `flex-1`（父容器非 flex，无效）→ 短内容页（QueryError/QueryLoading/空搜索结果）`main` 高度 < 视口，方格纸面在中途截断、下方露出 `body --paper` 接缝。修法：`.nb-mobile-paper` 加 `min-height:100vh`（仅 ≤767 生效）。验证：错误态 `main` 293.5→844，像素/elementFromPoint 确认铺满。
- 附带说明：`search` hit-card 量得 351px > 内容 350px，为卡片 rotate(±0.6deg) 后 getBoundingClientRect 几何放大，非布局溢出（overflow=0）。

**执行中新发现（超出卡范围，留收尾轮/owner 定夺）**：
- `--grid-size` 只在 `[data-theme='journal-notebook']`（明色）定义，`journal-notebook-dark` 未定义 → 暗色下 `background-size` 失效为 auto，`.nb-gridbg` 方格不平铺（computed 验证 `auto`）。**存量问题**：M6 起桌面暗色页内方格即缺失，非本卡引入；`.nb-mobile-paper` 与 `.nb-gridbg` 行为一致无回归。修法是在暗色块补 `--grid-size: 20px`（一行，但属主题 token，超出 S2 范围）。
- `QueryLoading`/`QueryError` 在 mobile 下现在落在方格纸面上（原为 `--paper` 底），视觉更统一；其通栏宽度问题仍归 S8 组5。

遗留：无。
