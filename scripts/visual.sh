#!/usr/bin/env bash
# B 格纸视觉对照：一次性临时库 + 概念稿同款种子 + 1440/390 截图 + 并排报告。
# 用法：./scripts/visual.sh [页面,...]   空 = 全部 12 页（手机端自动只截 6 页）
# 页面名：calendar,today,plan,goal,memory,stats,annual,search,settings,login,learn-form,goal-form
# 产物在 /tmp/sj-visual.*/report.html；绝不碰 8090 服务与 apps/server/journal.db。
set -euo pipefail
cd "$(dirname "$0")/.."

S="" V=""
cleanup() {
  [ -n "$S" ] && kill "$S" 2>/dev/null || true
  [ -n "$V" ] && kill "$V" 2>/dev/null || true
}
trap cleanup EXIT

# 端口被占用直接报错，不杀别人的进程
for p in 8091 5176; do
  if lsof -nP -iTCP:$p -sTCP:LISTEN >/dev/null 2>&1; then
    echo "端口 $p 已被占用，请先释放后重试" >&2
    exit 1
  fi
done

TMP=$(mktemp -d /tmp/sj-visual.XXXXXX)
# 必须先 build：go run 的子进程杀不干净
(cd apps/server && go build -o "$TMP/journal-server" ./cmd/journal-server)

"$TMP/journal-server" create-user -db "$TMP/j.db" -username visual -password visual1234 >/dev/null
"$TMP/journal-server" -db "$TMP/j.db" -addr 127.0.0.1:8091 >"$TMP/server.log" 2>&1 & S=$!
# 必须 cd 进 apps/web：--config 从仓库根跑会把 root 解析到仓库根，react 依赖解析失败。
# exec 让子 shell 直接变成 vite 进程，$V 才是 vite 本身（否则 kill 只杀 shell、vite 成孤儿）
(cd apps/web && exec env JOURNAL_API_TARGET=http://localhost:8091 JOURNAL_VISUAL=1 \
  node_modules/.bin/vite --port 5176 --strictPort) >"$TMP/vite.log" 2>&1 & V=$!

wait_ready() {
  local url=$1 name=$2 log=$3
  for _ in $(seq 1 30); do
    curl -sf "$url" >/dev/null 2>&1 && return 0
    sleep 0.5
  done
  echo "$name 启动超时（30×0.5s），日志：" >&2
  cat "$log" >&2 || true
  exit 1
}
wait_ready http://127.0.0.1:8091/api/health journal-server "$TMP/server.log"
wait_ready http://localhost:5176/journal/ vite "$TMP/vite.log"

GOAL=$(API=http://127.0.0.1:8091/api/v1 node apps/web/scripts/visual/seed.mjs)
GOAL=$GOAL WEB=http://localhost:5176/journal OUT="$TMP" PAGES="${1:-}" \
  node apps/web/scripts/visual/shot.mjs
echo "报告：$TMP/report.html"
