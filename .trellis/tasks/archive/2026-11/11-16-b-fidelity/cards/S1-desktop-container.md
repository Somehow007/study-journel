# S1 桌面容器去限宽（P0，影响最大）

## 问题 / 目标
`Layout.tsx` 按路由限宽（`/`、`/day/*`、`/plan` 1240px，`/memory` 720px，其他 880px）是旧 UI 遗留；再叠容器 `px-5 md:px-7 py-7` 与 `.nb-book{margin:28px 36px 36px}` 双重留白。结果 1440 下统计 / 年度 / 目标详情 / 搜索 / 设置的书只有 ~500–720px，标题逐字竖排、KV 数字重叠。概念稿：书在桌面上铺满，四周只有 `.nb-book` 的 margin（1440 下书宽 ≈1370px）。

## 改动范围
- `apps/web/src/components/Layout.tsx`
- `apps/web/src/styles/journal-b.css`（仅 `.nb-book` 相关，若需要）

## 消费点
- `Layout` 是所有登录后页面的外壳（App.tsx 路由 L48-57 全部嵌在它下面）。`LoginPage` 不经过 Layout，不受影响。
- 所有页面根节点都是 `.nb-book`（M6 已全量格纸化）；QueryLoading / QueryError / QueryEmpty 也在此容器内渲染——确认它们在更宽容器里仍居中可读。

## 方案
1. 删除 `maxWidth` 的 `useMemo`（含 `useMemo` import，若不再使用）。
2. 容器 `<div className="mx-auto px-5 py-7 md:px-7 md:pb-10" style={{ maxWidth }}>` 改为 `<div className="mx-auto" style={{ maxWidth: 1600 }}>`——留白完全交给 `.nb-book` 的 margin（桌面 `28px 36px 36px`）。手机端留白在 S2 处理，本卡不动 767px 媒体查询。
3. 检查 `.nb-book` 在 1600 以上屏（用 1920 宽手动看一次）居中、两侧桌面底色正常。

## 验收
- `./scripts/verify.sh` 全绿。
- `./scripts/visual.sh`（全部页面）：
  - 1440 下每页书宽 ≈1368px（`document.querySelector('.nb-book').getBoundingClientRect().width`，允许 ±4）。
  - 统计「统计」、年度「二〇二六」、目标标题、计划「十一月计划」**单行**；KV 四格数字不折行、不重叠；目标打卡盖章圈接近正圆（S8 再精修）。
  - 时光页时间线铺满书宽（概念稿 memory 即全宽）。
  - 390 截图与修改前相比无回退（本卡不该影响手机）。
- 报告顶部零 pageerror / 零横向溢出。

## 提交
`fix(web): 去掉 Layout 按路由限宽——书页按概念稿铺满桌面（统计/年度/目标页竖排折行根治）`

## 执行记录

2026-11-16 执行（SWE-2 Flash）：

- `Layout.tsx`：删 `maxWidth` useMemo（连带 `useMemo` import），容器改 `mx-auto` + `maxWidth: 1600`，留白全交 `.nb-book` margin。`journal-b.css` 未动（桌面 margin 已是 `28px 36px 36px`，无需改）。
- 验收：`./scripts/verify.sh` 全绿。临时实例 + playwright 探针实测：**1440 下 9 页 `.nb-book` 全为 1368px**（验收 ±4 内）；**1920 下全为 1528px**（=1600−2×36），mx-auto 居中、两侧桌面底色正常。标题折行启发式抽查未检出多行（统计/年度/目标/计划标题在宽容器下不再逐字竖排）。`visual.sh` 全量：零 pageerror / 零横向溢出。
- 截图对比（无法目检，按尺寸/体积代理）：stats 1086→960px、annual 1208→1006px、settings 1498→1235px、goal 1168→960px——内容不再被挤成高窄列，方向正确；memory 时间线仍全页长图（符合概念稿）。
- **对手机的实际影响（与卡面「不该影响手机」的预期有出入，如实记录）**：容器 `px-5` 移除后，390 下书页左右各只剩 `.nb-book` 的 12px margin（原 20+12=32px），书页变宽 ~40px。截图体积普遍 +5~20%，无横向溢出/报错，属向 S2 整屏纸面过渡的预期变化，非回退。
- 遗留：`QueryLoading`/`QueryError` 在 `.nb-book` 之外（各页 early return），宽容器下骨架块/错误卡会通栏——瞬态且文字居中可读，先记录，S8 细节卡再评估是否要限宽；移动端余 12px margin 由 S2 处理。
