#!/bin/bash
# ============================================================================
# Script   : start.sh
# Purpose  : Chạy Personal Hub local + worker lịch/Telegram
# Version  : v1.3.0
# Created  : 15/05/2026
# Updated  : 15/05/2026
# Author   : Mr.Rom
# Changelog:
#   - v1.3.0: Raise ulimit + polling watcher để tránh EMFILE trên macOS
#   - v1.2.0: Khởi động hub-worker song song dev server
# ============================================================================
set -euo pipefail

# macOS dev: tránh "EMFILE: too many open files" khi Next/Turbopack scan project.
# Bật polling cho Watchpack/Chokidar — chậm hơn fs.watch nhưng ổn định.
ulimit -n 524288 2>/dev/null || ulimit -n 65536 2>/dev/null || true
export CHOKIDAR_USEPOLLING="${CHOKIDAR_USEPOLLING:-1}"
export WATCHPACK_POLLING="${WATCHPACK_POLLING:-true}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env.local ]] && [[ -f .env.example ]]; then
  echo "[!] Chưa có .env.local — copy từ .env.example nếu cần Telegram:"
  echo "    cp .env.example .env.local"
fi

WORKER_PID=""
cleanup() {
  if [[ -n "$WORKER_PID" ]] && kill -0 "$WORKER_PID" 2>/dev/null; then
    kill "$WORKER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

start_worker() {
  if [[ "${HUB_NO_WORKER:-}" == "1" ]]; then
    echo "[*] Bỏ qua hub-worker (HUB_NO_WORKER=1)"
    return
  fi
  echo "[*] Khởi động hub-worker (lịch + bot Telegram)..."
  node scripts/hub-worker.mjs &
  WORKER_PID=$!
}

if [[ "${1:-dev}" == "prod" ]]; then
  npm run build
  start_worker
  sleep 2
  npm run start
else
  start_worker
  npm run dev
fi
