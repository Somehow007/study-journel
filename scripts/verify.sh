#!/usr/bin/env bash
# 手帐一键验证。现阶段 = 类型检查 + 构建；M1 后扩展为全工作区 lint/typecheck/test/build（见 docs/roadmap.md M1-6）。
set -euo pipefail
cd "$(dirname "$0")/.."
if [ ! -d node_modules ]; then
  echo "▶ 安装依赖"; npm install
fi
echo "▶ 类型检查 + 构建（npm run build = tsc && vite build）"
npm run build
echo "✓ verify 通过"
