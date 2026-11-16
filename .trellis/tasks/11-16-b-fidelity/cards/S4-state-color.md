# S4 状态色统一为「按极性」（已拍板）

## 问题 / 目标
决策 1（见 prd）：B 主题下状态文字色只看 polarity——`>= 0` 红笔 `var(--brand)`，`< 0` `var(--ink-faint)`。现状两套规则并存。收口为一个 helper，后续 A/C 主题只改 helper。

## 改动范围
- `apps/web/src/lib/stateUtils.ts`：新增 helper
- `apps/web/src/components/CalGrid.tsx` L76（`style={{ color: cfg.ink }}`）
- `apps/web/src/pages/MonthView.tsx` L166（状态图例 `color: cfg.ink`）
- `apps/web/src/pages/Memory.tsx` L174/206、`apps/web/src/pages/Stats.tsx` L265/272（现有 polarity 内联判断 → 改用 helper，行为不变）

## 消费点（AGENTS §2.3 主题相关，必须列全）
执行前先跑并把结果贴进执行记录：
```bash
rg -n "cfg\.ink|\.ink\b|polarity" apps/web/src --glob '*.tsx'
```
已知（2026-11-16）：CalGrid L76、MonthView L166 用 `cfg.ink`；Memory、Stats 用 polarity。`StateEditModal`/`Settings` 里的 `polarity` 是编辑字段、`state.color` 是色块展示——**不改**。`MoodSelector`（今日状态选择）选中态已是红字红圈（SPEC-B「状态选择」），确认它未选中时为灰、选中为红即可，不改。

## 方案
1. `stateUtils.ts` 新增并导出：
   ```ts
   /** B 格纸：状态文字色按极性——积极/中性=红笔，消极=浅墨（SPEC-B §2）。A/C 主题接入时在此分支。 */
   export function stateTextColor(cfg: Pick<StateConfig, 'polarity'>): string {
     return cfg.polarity < 0 ? 'var(--ink-faint)' : 'var(--brand)';
   }
   ```
2. CalGrid、MonthView 图例：`cfg.ink` → `stateTextColor(cfg)`。图例里的「正」字列保持红色不变（SPEC-B「正字计数：宋体 700 红色」）。
3. Memory、Stats：把 `neg ? 'var(--ink-faint)' : 'var(--brand)'` 换成 `stateTextColor(cfg)`；`cfg` 可能为 undefined 的地方保持原有兜底（原逻辑 `cfg ? … : false` → 无 cfg 时视为非负 → 红笔），行为必须完全一致。
4. 不删 `StateConfig.ink/tint/dark` 字段（暗色主题与未来主题仍用）。

## 验收
- `./scripts/verify.sh` 全绿。
- `./scripts/visual.sh calendar,today,memory,stats`：日历格、图例中 专注/顺利/平稳 = 红，疲惫/焦虑/低落 = 浅灰；时光、统计与修改前像素级一致（只是重构）。
- 暗色主题手动切一次（设置 → 外观 → 夜间墨蓝），日历状态字仍可读（`--brand` 暗色为 `#FF7A5C`）。

## 提交
`refactor(web): 状态文字色收口 stateTextColor——全站按极性红笔/浅墨（SPEC-B §2）`

## 执行记录

2026-11-16 执行（Devin）：

**消费点 grep**（卡要求先跑）：`rg -n "cfg\.ink|\.ink\b|polarity" apps/web/src` —— `cfg.ink` 仅 CalGrid L76、MonthView L166 两处；内联 polarity 仅 Memory L174/206、Stats L265/272；`StateEditModal`/`Settings` 的 polarity 为编辑字段、`state.color` 为色块（不改）；`MoodSelector` 用 `.nb-state`/`.on` CSS 类（未选中继承 `--ink-faint` 灰、选中 `--brand` 红+椭圆圈，SPEC-B 符合），零改动。

**改动**（5 文件，均在卡范围内）：
- `apps/web/src/lib/stateUtils.ts`：新增 `stateTextColor(cfg)`。
- `CalGrid.tsx` / `MonthView.tsx`：`cfg.ink` → `stateTextColor(cfg)`（图例「正」字列 `.nb-zheng` 未动，仍红）。
- `Memory.tsx` / `Stats.tsx`：删 `neg` 中间变量，内联三元 → `stateTextColor(cfg)`。

**与卡面的一处偏差（如实记录）**：卡建议签名 `cfg: Pick<StateConfig,'polarity'>`；实际放宽为 `| null | undefined`——Stats 的 `stateCfgById.get()` 可 undefined，卡又要求「无 cfg 视为非负→红笔」兜底，收进 helper 一处表达（`cfg != null && cfg.polarity < 0 ? faint : brand`），四处调用点零三元。行为与原 `cfg ? … : false` 完全一致。

**验收实测**：
- `./scripts/verify.sh` 全绿（tsc + vitest 46 + build + go vet/test + sqlc 一致性）。
- `./scripts/visual.sh calendar,today,memory,stats`：**零 pageerror / 零横向溢出**（报告 `/tmp/sj-visual.9IBhf9/report.html`）。
- 截图无法目检（本模型无视觉），改用 playwright computed-style 探针直读渲染色（比目检更强）：亮色主题下日历格 16 处 + 图例 6 态 + 时光 17 条 + 统计状态记数——专注/顺利/平稳 = `rgb(210,59,34)`（#D23B22 brand 红笔），疲惫/焦虑/低落 = `rgb(141,145,154)`（#8D919A ink-faint 浅墨），全中；`PATCH settings theme=notebook-dark` 后重测——`rgb(255,122,92)`（#FF7A5C）/ `rgb(110,118,134)`（#6E7686）暗色可读，测后已还原 notebook。
- 注意：探针跑在 S3 遗留的临时实例（`/tmp/sj-visual.DppOZ1`，8091/5176 仍在监听，非本卡进程、未动）上——同一工作区源码 + 同款种子，结论有效；本卡自起的 server/vite 因端口被占 bind 失败已自行退出，无残留。

遗留：无。提示——8091/5176 被旧实例占用，下一张卡跑 `visual.sh` 前需先释放（`kill` 对应 pid 或重启该实例）。
