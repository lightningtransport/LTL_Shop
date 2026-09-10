#!/usr/bin/env bash
# Idempotent Cloud Agent install: provisions a local Postgres, installs Node
# dependencies, and prepares the database (schema + seed) for local development.
set -euo pipefail
cd "$(dirname "$0")/.."

PG_VERSION="${PG_VERSION:-16}"

echo "==> Ensuring PostgreSQL ${PG_VERSION} is installed"
if ! command -v pg_ctlcluster >/dev/null 2>&1; then
  sudo apt-get update -qq
  sudo apt-get install -y -qq postgresql postgresql-contrib
fi

echo "==> Starting PostgreSQL cluster"
sudo pg_ctlcluster "${PG_VERSION}" main start 2>/dev/null || true
for _ in $(seq 1 30); do
  if sudo -u postgres pg_isready -q; then break; fi
  sleep 1
done

echo "==> Configuring postgres role and ltl_shop database"
sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD 'postgres';" >/dev/null
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='ltl_shop'" | grep -q 1; then
  sudo -u postgres psql -c "CREATE DATABASE ltl_shop;" >/dev/null
fi

echo "==> Writing local .env (if missing)"
if [ ! -f .env ]; then
  cat > .env <<'EOF'
NODE_ENV=development

DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ltl_shop
DIRECT_URL=postgresql://postgres:postgres@localhost:5432/ltl_shop

PORT=3001
CORS_ORIGIN=http://localhost:3000
DATA_SOURCE=supabase
AUTH_DEV_BYPASS=true

NEXT_PUBLIC_API_URL=http://localhost:3001

SENTRY_DSN=
NEXT_PUBLIC_SENTRY_DSN=
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
EOF
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

echo "==> Installing Node dependencies"
npm install

echo "==> Building shared package and generating Prisma client"
npm run build:shared
npm run db:generate

echo "==> Applying database migrations"
npm exec --workspace=@ltl-shop/api -- prisma migrate deploy

echo "==> Seeding database"
npm run db:seed

echo "==> Install complete"
