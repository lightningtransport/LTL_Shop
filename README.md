# Lightning Shop

Operational Shop, Yard, and fleet-readiness application for Lightning
Transport.

## Documentation

Start at [`docs/README.md`](docs/README.md). One source of truth per topic:

1. [`docs/SYSTEM.md`](docs/SYSTEM.md) — how the system works today (roles,
   flows, states, screens, rules).
2. [`docs/DECISIONS.md`](docs/DECISIONS.md) — product decisions D1–D18.
3. [`docs/OPEN_ISSUES.md`](docs/OPEN_ISSUES.md) — known defects, cleanup,
   go-live work, out of scope.
4. [`docs/reference/`](docs/reference) — engineering practices, deploy,
   performance, Ninox, Yard data boundary.

`docs/archive/` is history and never overrides these sources or the code.

## Stack

- **Web:** Next.js + Tailwind (`apps/web`)
- **API:** NestJS + Prisma (`apps/api`)
- **Shared:** Domain types / Zod schemas (`packages/shared`)
- **DB / Auth:** Supabase Postgres + Supabase Auth (local Postgres via Docker for development)
- **Ninox:** Runtime adapter is still a stub (`DATA_SOURCE=supabase`). Monday
  fleet load is a **one-shot** CLI (`npm run prisma:seed-ninox-trucks`) that
  GETs TrucksDB `E` and upserts Shop rows by VIN + `truckNumber` (`E.CG` / `E.A`).
  It never writes Ninox and will not query Ninox again after a completed run.
  See [`docs/reference/NINOX_TRUCK_SEED.md`](docs/reference/NINOX_TRUCK_SEED.md).
- **Yard Phase 1 cards:** Incoming Trucks, Upcoming Departures, and Work
  location are proxied by Nest `GET /api/admin/yard/data-boundary` from
  Lightning `agent-reporting`. The agent key is API-only
  (`AGENT_REPORTING_KEY`, never `NEXT_PUBLIC_*`). See
  [`docs/reference/YARD_DATA_BOUNDARY.md`](docs/reference/YARD_DATA_BOUNDARY.md).

## Locked product rules

Full list and rationale: [`docs/SYSTEM.md`](docs/SYSTEM.md) §7 and
[`docs/DECISIONS.md`](docs/DECISIONS.md).

1. One open Work Order per Truck.
2. Creating a Work Order does not start work; the mechanic taps Start.
3. Completing a Job does not pause or complete the Work Order.
4. Work Order Completed ≠ Ready to Go ≠ Return to Service.
5. Timers come from persisted sessions and pauses, never client counters.
6. Authorization and business rules are enforced by the API only.

## Quick start (local)

```bash
# 1) Install
npm install

# 2) Local Postgres
docker compose up -d

# 3) Env
cp .env.example .env
# For local Docker Postgres set:
# DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ltl_shop
# DIRECT_URL=postgresql://postgres:postgres@localhost:5432/ltl_shop
# AUTH_DEV_BYPASS=true

export $(grep -v '^#' .env | xargs)

# 4) Build shared + migrate + seed
npm run build:shared
npm run db:generate
npm exec --workspace=@ltl-shop/api -- prisma migrate deploy
npm run db:seed

# 5) Run (two terminals)
npm run dev:api
npm run dev:web
```

- Web: http://localhost:3000
- API: http://localhost:3001/api/health

On this Mac, the repo folder name contains `:` (`LTL SHOP : ADMIN : MECHANICS`), which breaks `PATH` lookups for `nest` / `next` / `prisma`. Prefer `./start-local.sh` (or `npm run start:local`). Scripts in `package.json` call those binaries by relative path so `npm run db:generate`, `db:seed`, and `dev` still work from this folder.

### Cursor Cloud Agents (Docker-less setup)

The repo ships a versioned Cursor environment in `.cursor/` so Cloud Agents boot
ready to run without manual setup:

- `.cursor/environment.json` — declares the `install`/`start` hooks, a `dev`
  terminal that runs `npm run dev`, and exposes ports 3000 (web) / 3001 (api).
- `.cursor/install.sh` — idempotent bootstrap: installs PostgreSQL 16, creates
  the `ltl_shop` database, writes a local `.env` (`AUTH_DEV_BYPASS=true`), then
  runs `npm install`, builds `@ltl-shop/shared`, generates the Prisma client,
  applies migrations, and seeds.
- `.cursor/start.sh` — per-boot: starts the Postgres cluster and re-applies
  migrations idempotently.

Cloud Agent VMs have no Docker, so these scripts provision Postgres directly on
the host using the **same** connection as `docker-compose.yml`
(`postgres:postgres@localhost:5432/ltl_shop`) — no app code or connection
strings change. Both scripts are safe to re-run. On a normal workstation you can
still use the Docker flow above, or run `bash .cursor/install.sh` to get the
same Docker-less setup. The generated `.env` is git-ignored and for local
development only; staging/production keep using the Supabase variables in
`.env.example`.

### Dev login

With `AUTH_DEV_BYPASS=true`, use **Dev Login** on `/login` with:

- `mechanic@lightning.local`
- `anthony@lightning.local`
- `manager@lightning.local`
- `admin@lightning.local`

The local seed also includes `daniel@lightning.local` with the PM-only capability and
`cristian@ltransl.com` with the standard-mechanic capability.

### Supabase Auth (staging/production)

1. Create a Supabase project.
2. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_JWT_SECRET` / JWKS.
3. Create Auth users whose emails match rows in `users`.
4. Point `DATABASE_URL` / `DIRECT_URL` at the Supabase Postgres connection strings.
5. Run Prisma migrations against Supabase.
6. Keep `DATA_SOURCE=supabase`. Leave `AUTH_DEV_BYPASS` unset or `false`.
7. Do **not** run `npm run db:seed` against production (it upserts demo trucks
   `905` / `922` / `968`). Use the approved catalog release path instead.

Shop trucks are **not** loaded from Ninox at runtime. If you later reconcile
the fleet with Ninox, match on `truckNumber` = Ninox `E.A` only.

## Apps

| Path | Role |
|------|------|
| `apps/web` | Mechanic mobile-first UI |
| `apps/api` | REST API + domain logic |
| `packages/shared` | Enums, DTOs, Zod contracts |
| `apps/api/prisma` | Prisma schema, migrations, and local seed; this is the only migration source |
| `/admin` | Server-authorized responsive shell for users with `admin.access` |
| `/admin/yard-operations` | Yard board by Work Plan phase; Movement tab with agent-reporting cards |
| `/mechanic/standard` | Standard mechanic workspace for users with `mechanic.standard` |
| `/mechanic/pm` | PM mechanic workspace for users with `mechanic.pm` |

## API overview

Endpoints live in the NestJS controllers under `apps/api/src`
(`work-orders/`, `admin/`, `trucks/`, `job-catalog/`, `users/`, `auth/`).
Which screen calls what, and who may call it, is in
[`docs/SYSTEM.md`](docs/SYSTEM.md). Deprecated endpoints still present are
listed in [`docs/OPEN_ISSUES.md`](docs/OPEN_ISSUES.md) §3.

## Tests

```bash
npm test --workspace=@ltl-shop/api
npm run test:e2e --workspace=@ltl-shop/web   # requires running app
```

## Deploy

- Frontend → Vercel (`apps/web`)
- Backend → Vercel Functions in `pdx1` (`apps/api`)
- Database → Supabase

## Deferred beyond the current release

See [`docs/OPEN_ISSUES.md`](docs/OPEN_ISSUES.md) §6.
