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
