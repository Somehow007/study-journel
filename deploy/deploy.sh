#!/usr/bin/env bash
# 学习手帐独立部署（本机 → 服务器）。服务器零依赖：Go/Node 产物全部本地构建后推送。
#
# 用法（JOURNAL_SERVER 必填，不写进仓库；需免密 sudo，与 mysite deploy 同约定）：
#   JOURNAL_SERVER=user@host ./deploy/deploy.sh              # 全量
#   JOURNAL_SERVER=user@host ./deploy/deploy.sh --skip-web   # 只推 Go 服务（切换前置）
#   JOURNAL_SERVER=user@host ./deploy/deploy.sh --skip-go    # 只推前端（nginx 切流后）
#
# 切换顺序见 deploy/CUTOVER.md：先 --skip-web 让 Go 服务就绪并迁移数据，
# nginx 加 /journal/api/ 后再 --skip-go 推新前端（新前端依赖新 API）。
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SERVER="${JOURNAL_SERVER:?请先设置 JOURNAL_SERVER=user@host}"
SKIP_WEB=0
SKIP_GO=0
for arg in "$@"; do
  case "$arg" in
    --skip-web) SKIP_WEB=1 ;;
    --skip-go)  SKIP_GO=1 ;;
    *) echo "未知参数: $arg" >&2; exit 2 ;;
  esac
done
if [ "$SKIP_WEB" = 1 ] && [ "$SKIP_GO" = 1 ]; then
  echo "--skip-web 与 --skip-go 不能同时使用" >&2; exit 2
fi

REMOTE_BIN=/opt/journal
REMOTE_WEB=/var/www/journal

log() { printf '[deploy] %s\n' "$*"; }
die() { printf '[deploy] ERROR: %s\n' "$*" >&2; exit 1; }

need() { command -v "$1" >/dev/null || die "缺少命令: $1"; }
need pnpm; need go; need rsync; need ssh; need scp

# ---------- Go：交叉编译静态二进制（CGO_ENABLED=0，服务器无需 Go） ----------
if [ "$SKIP_GO" = 0 ]; then
  log "构建 Go 二进制（linux/amd64, CGO_ENABLED=0）"
  mkdir -p "$ROOT/apps/server/bin"
  (cd "$ROOT/apps/server" && \
    CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -trimpath -o bin/journal-server ./cmd/journal-server && \
    CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -trimpath -o bin/import-mysite ./cmd/import-mysite)
  ls -lh "$ROOT/apps/server/bin/" | awk '{print "  " $5, $9}'

  log "推送二进制 → $SERVER:$REMOTE_BIN/"
  ssh "$SERVER" "sudo mkdir -p $REMOTE_BIN && sudo mkdir -p /var/lib/journal && sudo chown -R www-data:www-data /var/lib/journal"
  rsync -az --rsync-path="sudo rsync" \
    "$ROOT/apps/server/bin/journal-server" \
    "$ROOT/apps/server/bin/import-mysite" \
    "$SERVER:$REMOTE_BIN/"
  ssh "$SERVER" "sudo chmod 755 $REMOTE_BIN/journal-server $REMOTE_BIN/import-mysite"

  log "安装/更新 systemd 单元并重启"
  scp "$ROOT/deploy/journal.service" "$SERVER:/tmp/journal.service"
  ssh "$SERVER" "sudo install -m 644 /tmp/journal.service /etc/systemd/system/journal.service \
    && sudo systemctl daemon-reload \
    && sudo systemctl enable journal \
    && sudo systemctl restart journal"
  sleep 1
  ssh "$SERVER" "systemctl is-active --quiet journal" || die "journal.service 未运行（journalctl -u journal -n 50）"

  log "健康检查 127.0.0.1:8090/api/health"
  ssh "$SERVER" "curl -sf http://127.0.0.1:8090/api/health" || die "Go 服务健康检查失败"
  log "Go 服务 OK"
fi

# ---------- Web：生产构建（必须 VITE_API_BASE=/journal/api，否则打到旧后端） ----------
if [ "$SKIP_WEB" = 0 ]; then
  log "构建前端（VITE_API_BASE=/journal/api，base=/journal/）"
  (cd "$ROOT" && VITE_API_BASE=/journal/api pnpm -F web build)

  log "备份现有前端 → /var/www/journal.bak-<ts>.tar.gz"
  ssh "$SERVER" "sudo tar -czf /var/www/journal.bak-\$(date +%Y%m%d-%H%M%S).tar.gz -C /var/www journal 2>/dev/null || true"

  log "推送前端 → $SERVER:$REMOTE_WEB/"
  ssh "$SERVER" "sudo mkdir -p $REMOTE_WEB"
  rsync -az --delete --rsync-path="sudo rsync" \
    "$ROOT/apps/web/dist/" "$SERVER:$REMOTE_WEB/"
  ssh "$SERVER" "sudo chown -R www-data:www-data $REMOTE_WEB"
  log "前端 OK（$(ssh "$SERVER" "find $REMOTE_WEB -type f | wc -l") 个文件）"
fi

log "完成。nginx /journal/api/ 切流步骤见 deploy/CUTOVER.md"
