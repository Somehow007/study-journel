#!/usr/bin/env bash
# 手帐一键验证（M1 起全工作区）：web typecheck+build + server gofmt/vet/test。
# 见 docs/roadmap.md M1-6 与 docs/architecture.md §5。
set -euo pipefail
cd "$(dirname "$0")/.."

command -v pnpm >/dev/null || { echo "未找到 pnpm，请先安装"; exit 1; }
command -v go >/dev/null || { echo "未找到 go，请先安装（brew install go）"; exit 1; }

if [ ! -d apps/web/node_modules ]; then
  echo "▶ 安装依赖（pnpm install）"
  pnpm install
fi

echo "▶ web：typecheck"
pnpm -F web typecheck

echo "▶ web：build"
pnpm -F web build

echo "▶ server：gofmt / go vet / go test"
cd apps/server
test -z "$(gofmt -l .)" || { echo "gofmt 需要格式化:"; gofmt -l .; exit 1; }
go vet ./...
go test ./...

echo "✓ verify 通过"
