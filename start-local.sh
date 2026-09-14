#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

# Folder names that contain ':' split PATH, so npm cannot find nest/next/prisma.
ROOT="$(pwd -P)"
if [[ "$ROOT" == *:* ]]; then
  ln -sfn "$ROOT" /tmp/ltl-shop
  export PATH="/tmp/ltl-shop/node_modules/.bin:${PATH}"
else
  export PATH="${ROOT}/node_modules/.bin:${PATH}"
fi

echo "Freeing ports 3000 / 3001 / 3005..."
for port in 3000 3001 3005; do
  pids=$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)
  if [[ -n "${pids}" ]]; then
    kill -9 ${pids} || true
  fi
done
sleep 1

echo "Building shared package..."
npm run build:shared

echo "Starting API (:3001) and Web (:3000)..."
ulimit -n 10240 2>/dev/null || true
export WATCHPACK_POLLING=true
export CHOKIDAR_USEPOLLING=true
exec npx concurrently -n api,web -c blue,magenta \
  "npm run dev:api" \
  "NEXT_PUBLIC_API_URL=http://127.0.0.1:3001 WATCHPACK_POLLING=true npm run dev --workspace=@ltl-shop/web"
