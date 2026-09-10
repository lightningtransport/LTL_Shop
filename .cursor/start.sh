#!/usr/bin/env bash
# Per-boot startup: ensures Postgres is running and the schema is current.
# Dependency install and seeding live in install.sh, not here.
set -euo pipefail
cd "$(dirname "$0")/.."

PG_VERSION="${PG_VERSION:-16}"

echo "==> Starting PostgreSQL cluster"
sudo pg_ctlcluster "${PG_VERSION}" main start 2>/dev/null || true
for _ in $(seq 1 30); do
  if sudo -u postgres pg_isready -q; then break; fi
  sleep 1
done

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
  echo "==> Applying database migrations (idempotent)"
  npm exec --workspace=@ltl-shop/api -- prisma migrate deploy || true
fi

echo "==> Start complete"
