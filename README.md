# Lightning Shop

Operational Shop, Yard, and fleet-readiness application for Lightning
Transport.

## Documentation authority

Read in this order before implementation:

1. [`docs/LIGHTNING_SHOP_MASTER_PRD.md`](docs/LIGHTNING_SHOP_MASTER_PRD.md) —
   canonical TARGET product and domain.
2. [`docs/CURRENT_PRODUCT_STATUS.md`](docs/CURRENT_PRODUCT_STATUS.md) — behavior
   implemented now.
3. [`docs/ENGINEERING_PRACTICES.md`](docs/ENGINEERING_PRACTICES.md) — technical
   rules.
4. [`docs/DOCUMENTATION_INDEX.md`](docs/DOCUMENTATION_INDEX.md) — classification
   of all other documents.

Historical PRDs and plans do not override these sources.

## Stack

- **Web:** Next.js + Tailwind (`apps/web`)
- **API:** NestJS + Prisma (`apps/api`)
- **Shared:** Domain types / Zod schemas (`packages/shared`)
- **DB / Auth:** Supabase Postgres + Supabase Auth (local Postgres via Docker for development)
- **Ninox:** Runtime adapter is still a stub (`DATA_SOURCE=supabase`). Monday
  fleet load is a **one-shot** CLI (`npm run prisma:seed-ninox-trucks`) that
  GETs TrucksDB `E` and upserts Shop rows by VIN + `truckNumber` (`E.CG` / `E.A`).
  It never writes Ninox and will not query Ninox again after a completed run.
  See [`docs/NINOX_TRUCK_SEED.md`](docs/NINOX_TRUCK_SEED.md).
- **Yard Phase 1 cards:** Incoming Trucks, Upcoming Departures, and Work
  location are proxied by Nest `GET /api/admin/yard/data-boundary` from
  Lightning `agent-reporting`. The agent key is API-only
  (`AGENT_REPORTING_KEY`, never `NEXT_PUBLIC_*`). See
  [`docs/YARD_DATA_BOUNDARY.md`](docs/YARD_DATA_BOUNDARY.md).

## Locked product rules

1. **Create Work Order ≠ Start Work.** Mechanic must tap **Start Work** to open the first work session and begin Active Labor.
   - **PM exception (legacy, flag off):** a user with `mechanic.pm` creates a PM service already in progress. The system assigns that user, creates one work session, and records creation/start events atomically.
   - **PM in the Work Plan (`WORK_PLAN_PM_PHASE=true`, LTR-141):** superseded the exception above. PM is a mandatory **Job** inside the truck's single Work Order (`Inspection → Shop Work → PM → Alignment → Detailing → QC`). Every new truck Work Order gets PM A, Alignment, Detailing and Quality Check; the PM mechanic starts and finishes only the PM job (mileage + parts) and "Create PM service" joins the truck's open Work Order. See [`docs/CURRENT_PRODUCT_STATUS.md`](docs/CURRENT_PRODUCT_STATUS.md).
2. Timers are computed from persisted session / pause timestamps (never client-only counters).
3. Completing a Job does not pause or finish the Work Order.
4. One open Work Order per Truck.
5. A normal Work Order requires at least one job. Duplicate catalog jobs and duplicate custom-job names are rejected in both the UI and API.
6. A normal Work Order cannot be paused when it has no remaining jobs. PM work is controlled by its PM Service requirements instead.

## Work Order domain direction

- **CURRENT/legacy-compatible:** `primaryCategoryId` remains required as the
  **Initial/Primary Category** for backward compatibility. Every
  `WorkOrderJob` owns its Category.
- **CURRENT:** a Work Order is the complete service intervention for one Truck.
  Standard creation and Add Job permit multiple non-PM Job Categories without
  removing legacy readers or `primaryCategoryId`.
- **CURRENT soft cutover:** a Manager with `admin.access` and
  `work_orders.manage` can create/plan Standard Work Orders, assign Jobs, and
  pause/resume. Standard mechanics see assignment-centered UI and can report
  blockers, while legacy Standard create and some pause/resume behavior remain.
  PM remains specialized. See
  [`docs/CURRENT_PRODUCT_STATUS.md`](docs/CURRENT_PRODUCT_STATUS.md).
- **TARGET:** the Manager normally plans and controls the Standard intervention;
  the mechanic executes assigned work. See the canonical Master PRD and
  [`docs/audit/CURRENT_VS_TARGET.md`](docs/audit/CURRENT_VS_TARGET.md).
- **LOCKED:** one open Work Order per Truck; a later visit or distinct service
  event creates a new Work Order. A Yard Phase is not a Category and never
  creates another Work Order.
- **LOCKED:** Standard Create remains different from Start. PM remains the
  specialized `mechanic.pm` exception. Completing a Job does not complete the
  Work Order, and Work Order `Completed` does not mean `Ready to Go` or
  `Returned to Service`.
- **DEFERRED:** Job-level timers, a configurable rules engine, unconfirmed
  external integrations, multiple open Work Orders per Truck, and removal of
  `primaryCategoryId`. Per-Job assignment exists and is pending operational
  validation.

Use the current
[`development roadmap`](docs/DEVELOPMENT_ROADMAP.md),
[`implementation queue`](docs/IMPLEMENTATION_QUEUE.md), and
[`CURRENT/TARGET audit`](docs/audit/CURRENT_VS_TARGET.md) for sequencing.

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
| `/admin/yard-operations` | Admin Yard Operations and readiness view; mutations require `yard.operations.manage` |
| `/mechanic/standard` | Standard mechanic workspace for users with `mechanic.standard` |
| `/mechanic/pm` | PM mechanic workspace for users with `mechanic.pm` |
| `docs/LIGHTNING_SHOP_MASTER_PRD.md` | Canonical product and domain TARGET |
| `docs/CURRENT_PRODUCT_STATUS.md` | Implemented workflows and operating configuration |
| `docs/GO_LIVE_CHECKLIST_ES.md` | Spanish Shop launch checklist (Ninox scan closed for trucks) |
| `docs/NINOX_SHOP_MAPPING.md` | Verified Ninox IDs only: `E` / `E.A` / `E.TA`; UC trailer unresolved |
| `docs/DOCUMENTATION_INDEX.md` | Authority and classification for every relevant document |
| `docs/DEVELOPMENT_ROADMAP.md` | NOW/NEXT/LATER sequencing |
| `docs/IMPLEMENTATION_QUEUE.md` | Scoped, ordered implementation tasks |
| `docs/pm-daniel.md` | PM authorization and future assignment-policy note |
| `docs/ENGINEERING_PRACTICES.md` | Data-flow, caching, mutation, and performance rules |
| `docs/PERFORMANCE.md` | Production measurements and performance targets |

## API overview

- `GET /api/auth/me`
- `GET /api/mechanics`
- `GET /api/trucks`
- `GET /api/trucks/search?q=`
- `GET /api/trucks/:id/open-work-order`
- `GET /api/trucks/:id/repair-history`
- `GET /api/catalog/categories|jobs`
- `GET /api/work-orders?mode=standard|pm`
- `POST /api/work-orders`
- `POST /api/work-orders/:id/start|pause|pause-reason|resume|complete`
- `POST /api/work-orders/:id/jobs`
- `POST /api/work-orders/:id/jobs/:jobId/complete`

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

Ninox live integration, per-Job timers, purchasing/costing, configurable
rules, unconfirmed Samsara/Dispatch/McLeod integrations, and permanent
dual-write. Per-Job assignment is already implemented and must be stabilized,
not rebuilt. MappingTool discovery for the truck number is **done**; a live
Ninox adapter is still deferred and is not a Shop launch blocker.
