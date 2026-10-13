#!/usr/bin/env bash
# D39 (DP3): creates the two Vercel projects of the published demo (team ltl8) and deploys them from main.
# docs/reference/DEMO.md → Demo publicada, steps 4–5. Run it once, from any folder.
# It asks for the three secret values (they are typed, never printed):
#   DATABASE_URL  demo Supabase pooler, transaction mode (port 6543) + ?pgbouncer=true
#   DIRECT_URL    demo Supabase pooler, session mode (port 5432)
#   DEMO_ACCESS_CODE  the code you will send along with the link
set -euo pipefail

SCOPE=ltl8
REPO=lightningtransport/LTL_Shop
API=ltl-shop-demo-api
WEB=ltl-shop-demo-web
API_URL="https://${API}.vercel.app"
WEB_URL="https://${WEB}.vercel.app"
TMP="$(mktemp -d)"; chmod 700 "$TMP"; trap 'rm -rf "$TMP"' EXIT

read -rsp "DATABASE_URL (demo, port 6543 ?pgbouncer=true): " DATABASE_URL; echo
read -rsp "DIRECT_URL (demo, port 5432): " DIRECT_URL; echo
read -rsp "DEMO_ACCESS_CODE: " DEMO_ACCESS_CODE; echo
for v in "$DATABASE_URL" "$DIRECT_URL"; do
  if [[ "$v" == *mjlfynzqmxoezanvyniw* ]]; then echo "That is the production database. Stopping."; exit 1; fi
done

DATABASE_URL="$DATABASE_URL" DIRECT_URL="$DIRECT_URL" DEMO_ACCESS_CODE="$DEMO_ACCESS_CODE" \
ADMIN_PROFILE_SECRET="$(openssl rand -hex 32)" API_URL="$API_URL" WEB_URL="$WEB_URL" REPO="$REPO" \
python3 - "$TMP" <<'EOF'
import json, os, sys
d = sys.argv[1]; e = os.environ; t = ["production", "preview"]
def var(k, v, kind="plain"): return {"key": k, "value": v, "type": kind, "target": t}
common = {"installCommand": "cd ../.. && npm install --include=dev", "gitRepository": {"type": "github", "repo": e["REPO"]}}
api = dict(common, name="ltl-shop-demo-api", framework="nestjs", rootDirectory="apps/api",
  buildCommand="cd ../.. && npm run build:shared && cd apps/api && npx prisma generate && npx nest build",
  environmentVariables=[
    var("DATABASE_URL", e["DATABASE_URL"], "sensitive"), var("DIRECT_URL", e["DIRECT_URL"], "sensitive"),
    var("DEMO_ACCESS_CODE", e["DEMO_ACCESS_CODE"], "sensitive"),
    var("AUTH_DEV_BYPASS", "true"), var("DEMO_HOSTED", "1"), var("DATA_SOURCE", "supabase"),
    var("YARD_READY_TO_GO_SINCE", "2000-01-01T00:00:00Z"), var("CORS_ORIGIN", e["WEB_URL"])])
web = dict(common, name="ltl-shop-demo-web", framework="nextjs", rootDirectory="apps/web",
  buildCommand="cd ../.. && npm run build:shared && npm run build --workspace=@ltl-shop/web",
  environmentVariables=[var("NEXT_PUBLIC_DEMO_HOSTED", "1"), var("NEXT_PUBLIC_API_URL", e["API_URL"]),
    var("ADMIN_PROFILE_SECRET", e["ADMIN_PROFILE_SECRET"], "sensitive")])
for name, body in (("api", api), ("web", web)):
  with open(os.path.join(d, name + ".json"), "w") as f: json.dump(body, f)
EOF

REPO_ID="$(gh api "repos/$REPO" --jq .id)"
for p in api web; do
  name=$([ "$p" = api ] && echo "$API" || echo "$WEB")
  echo "→ Creating $name"
  vercel api /v11/projects -X POST --input "$TMP/$p.json" --scope "$SCOPE" >/dev/null
  printf '{"name":"%s","project":"%s","target":"production","gitSource":{"type":"github","repoId":%s,"ref":"main"}}' \
    "$name" "$name" "$REPO_ID" > "$TMP/deploy-$p.json"
  echo "→ Deploying $name from main"
  vercel api /v13/deployments -X POST --input "$TMP/deploy-$p.json" --scope "$SCOPE" >/dev/null
done

echo
echo "Done. In 3–5 minutes:"
echo "  API: $API_URL/api/health"
echo "  Web: $WEB_URL"
