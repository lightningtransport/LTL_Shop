#!/usr/bin/env bash
# D36: the local demo (docs/reference/DEMO.md). API on :3141 against ltl_shop_demo, web on :3042 with Dev Login
# and the Demo panel. Build the data first: npm run prisma:demo-local --workspace=@ltl-shop/api
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

DEMO_DATABASE_URL="${DEMO_DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/ltl_shop_demo}"
DEMO_API_PORT="${DEMO_API_PORT:-3141}"
DEMO_WEB_PORT="${DEMO_WEB_PORT:-3042}"
case "$DEMO_DATABASE_URL" in
  *localhost*|*127.0.0.1*) ;;
  *) echo "DEMO_DATABASE_URL must point at localhost" >&2; exit 1 ;;
esac
case "$DEMO_DATABASE_URL" in
  *demo*) ;;
  *) echo "DEMO_DATABASE_URL must name a database with 'demo' in it" >&2; exit 1 ;;
esac

echo "Freeing ports $DEMO_API_PORT / $DEMO_WEB_PORT..."
for port in "$DEMO_API_PORT" "$DEMO_WEB_PORT"; do
  pids=$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)
  if [[ -n "${pids}" ]]; then
    kill -9 ${pids} || true
  fi
done
sleep 1

echo "Building shared package and API..."
npm run build:shared
npm run build --workspace=@ltl-shop/api

echo "Starting demo API (:$DEMO_API_PORT, $DEMO_DATABASE_URL) and demo web (:$DEMO_WEB_PORT)..."
echo "Open http://localhost:$DEMO_WEB_PORT/login (localhost, not 127.0.0.1: the dev server redirects to localhost)."
ulimit -n 10240 2>/dev/null || true
exec ./node_modules/.bin/concurrently -n demo-api,demo-web -c blue,magenta \
  "cd apps/api && DATABASE_URL='$DEMO_DATABASE_URL' DIRECT_URL='$DEMO_DATABASE_URL' PORT=$DEMO_API_PORT CORS_ORIGIN=http://127.0.0.1:$DEMO_WEB_PORT,http://localhost:$DEMO_WEB_PORT AUTH_DEV_BYPASS=true DATA_SOURCE=supabase YARD_READY_TO_GO_SINCE=2000-01-01T00:00:00Z NODE_ENV=development node dist/src/main.js" \
  "cd apps/web && NEXT_DIST_DIR=.next-demo NEXT_PUBLIC_API_URL=http://127.0.0.1:$DEMO_API_PORT NEXT_PUBLIC_E2E_DEV_LOGIN=1 NEXT_TELEMETRY_DISABLED=1 next dev --hostname 127.0.0.1 --port $DEMO_WEB_PORT"
