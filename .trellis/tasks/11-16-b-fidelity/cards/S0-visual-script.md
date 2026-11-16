# S0 视觉对照脚本（工具，先于一切）

## 问题 / 目标
现有走查只断言 DOM，看不出版式问题。做一个一键脚本：临时库 + 概念稿同款种子 + 1440/390 截图 + 左概念/右实现并排报告 + 横向溢出自检。之后每张卡都用它验收。

## 改动范围（只许改这些）
- 新增 `apps/web/scripts/visual/seed.mjs`、`apps/web/scripts/visual/shot.mjs`：**直接复制** `../ref/seed.mjs`、`../ref/shot.mjs`（2026-11-16 已实测跑通），不要重写逻辑。放在 `apps/web` 下是为了让 `import 'playwright'` 能从 `apps/web/node_modules` 解析。
- 新增 `scripts/visual.sh`（编排）。
- 改 `apps/web/vite.config.ts`：仅开发代理两处可被环境变量覆盖（见方案 2）。
- 改 `AGENTS.md` §1：补一行 visual.sh 用法。

## 消费点
- `vite.config.ts` 只影响 `pnpm dev`；生产走 nginx，不受影响。默认值必须与现在完全一致（5174 / 8090 / 自动打开 `/journal/`）。

## 方案
1. 复制两个 ref 脚本到 `apps/web/scripts/visual/`。
2. `vite.config.ts`：
   - `proxy['/api'].target` → `process.env.JOURNAL_API_TARGET ?? 'http://localhost:8090'`
   - `server.open` → `process.env.JOURNAL_VISUAL ? false : '/journal/'`
   - 端口不改（脚本用 CLI `--port` 覆盖）。
3. `scripts/visual.sh`（`set -euo pipefail`，从仓库根运行）：
   ```bash
   TMP=$(mktemp -d /tmp/sj-visual.XXXXXX)
   (cd apps/server && go build -o "$TMP/journal-server" ./cmd/journal-server)   # 必须先 build：go run 的子进程杀不干净
   "$TMP/journal-server" create-user -db "$TMP/j.db" -username visual -password visual1234 >/dev/null
   "$TMP/journal-server" -db "$TMP/j.db" -addr 127.0.0.1:8091 >"$TMP/server.log" 2>&1 & S=$!
   JOURNAL_API_TARGET=http://localhost:8091 JOURNAL_VISUAL=1 \
     apps/web/node_modules/.bin/vite --config apps/web/vite.config.ts --port 5176 --strictPort >"$TMP/vite.log" 2>&1 & V=$!
   trap 'kill $S $V 2>/dev/null || true' EXIT
   # 等待：curl -sf http://127.0.0.1:8091/api/health 与 curl -sf http://localhost:5176/journal/ 都通（各最多 30 次 × 0.5s，超时打印 log 退出 1）
   GOAL=$(API=http://127.0.0.1:8091/api/v1 node apps/web/scripts/visual/seed.mjs)
   GOAL=$GOAL WEB=http://localhost:5176/journal OUT="$TMP" PAGES="${1:-}" node apps/web/scripts/visual/shot.mjs
   echo "报告：$TMP/report.html"
   ```
   - 第一个参数可选：逗号分隔页面名（`calendar,today,plan,goal,memory,stats,annual,search,settings,login,learn-form,goal-form`），空 = 全部。`PAGES` 为空字符串时 shot.mjs 要当作全部（检查 ref 里 `process.env.PAGES ?` 的判断，空串为 falsy，已满足）。
   - 8091 / 5176 被占用时直接报错退出，**不要**杀占用进程。
   - vite 用 `--config apps/web/vite.config.ts` 时 root 会是 apps/web（vite 以 config 所在目录为 root）；若实测 root 不对，改为 `(cd apps/web && node_modules/.bin/vite --port 5176 --strictPort) &` 并记录。
4. `chmod +x scripts/visual.sh`。
5. AGENTS.md §1 「涉及页面的改动」那条后补：`./scripts/visual.sh [页面,...]` → 临时库 + 种子 + 1440/390 并排报告（`/tmp/sj-visual.*/report.html`），看图验收，不能只看脚本输出。

## 验收
- `./scripts/verify.sh` 全绿。
- `./scripts/visual.sh` 跑完打印「零 pageerror / 零横向溢出」或列出问题（当前基线允许有问题，S1 之后应清零）；`report.html` 能看到 12 + 6 组并排图。
- 跑完 `lsof -iTCP:8091 -sTCP:LISTEN` 与 `:5176` 均无残留进程。
- `pnpm dev` 行为不变（仍 5174、仍代理 8090、仍自动打开）。
- `git status` 无临时文件（`/tmp` 外不落任何产物）。

## 提交
`chore(web): 视觉对照脚本 visual.sh——临时库+概念稿同款种子+1440/390 并排报告`

## 执行记录

2026-11-16 执行（SWE-2 Flash）：

- ref 两脚本原样复制到 `apps/web/scripts/visual/`；`vite.config.ts` 按方案加 `JOURNAL_API_TARGET` / `JOURNAL_VISUAL` 两处环境变量覆盖（默认值不变）；新增 `scripts/visual.sh`（chmod +x）；AGENTS.md §1 补用法一行。
- **两处与卡面方案的偏差（已实测记录）**：
  1. `vite --config apps/web/vite.config.ts` 从仓库根跑会把 vite root 解析到仓库根（`Failed to resolve dependency: react`，`/journal/` 探活超时）→ 改用卡内备选方案 `(cd apps/web && vite --port 5176 --strictPort)`，已在脚本注释注明。
  2. 该 subshell 形态下 `$!` 是子 shell 而非 vite，trap kill 后 vite 成孤儿（5176 残留实测复现）→ 加 `exec env ...` 让子 shell 直接 exec 成 vite，复测端口干净。
  3. `tsc --noEmit` 报 `process` 未定义（本包无 @types/node，且禁止加依赖）→ `vite.config.ts` 顶部加模块级 `declare const process`。
- 验收：`./scripts/verify.sh` 全绿（typecheck/test/build + gofmt/vet/test + sqlc 一致性）。`./scripts/visual.sh` 全量跑通：12 desktop + 6 mobile 截图，报告「零 pageerror / 零横向溢出」；`/tmp/sj-visual.*/impl/*.png` 尺寸/体积正常（memory-desktop 1440×14873 全页时间线）。执行环境无图像读取能力，截图以尺寸+体积+零报错代理确认，建议人工抽看 report.html。
- 遗留：`apps/web/m3-interact.tmp.mjs`、`design/concepts/`、`.claude/` 为既有未跟踪文件，未动。
