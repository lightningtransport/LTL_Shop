# Lightning Shop — Mechanic App (P0)

Greenfield monorepo for the Lightning Shop Mechanic Work Order experience.

## Stack

- **Web:** Next.js + Tailwind (`apps/web`)
- **API:** NestJS + Prisma (`apps/api`)
- **Shared:** Domain types / Zod schemas (`packages/shared`)
- **DB / Auth:** Supabase Postgres + Supabase Auth (local Postgres via Docker for development)
- **Ninox:** Deferred — adapter stub only (`DATA_SOURCE=supabase`)

## Locked product rules

1. **Create Work Order ≠ Start Work.** Mechanic must tap **Start Work** to open the first work session and begin Active Labor.
   - **PM exception:** a mechanic with `pmAuthorized` creates a PM service already in progress. The system assigns the PM mechanic, creates one work session, and records creation/start events atomically.
2. Timers are computed from persisted session / pause timestamps (never client-only counters).
3. Completing a Job does not pause or finish the Work Order.
4. One open Work Order per Truck.
5. A normal Work Order requires at least one job. Duplicate catalog jobs and duplicate custom-job names are rejected in both the UI and API.
6. A normal Work Order cannot be paused when it has no remaining jobs. PM work is controlled by its PM Service requirements instead.

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
npm exec --workspace=@ltl-shop/api -- prisma migrate dev --name init
npm run db:seed

# 5) Run (two terminals)
npm run dev:api
npm run dev:web
```

- Web: http://localhost:3000  
- API: http://localhost:3001/api/health  

### Dev login

With `AUTH_DEV_BYPASS=true`, use **Dev Login** on `/login` with:

- `mechanic@lightning.local`
- `anthony@lightning.local`
- `manager@lightning.local`

The local seed also includes `daniel@lightning.local` as the PM-authorized mechanic.

### Supabase Auth (staging/production)

1. Create a Supabase project.
2. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_JWT_SECRET` / JWKS.
3. Create Auth users whose emails match rows in `users`.
4. Point `DATABASE_URL` / `DIRECT_URL` at the Supabase Postgres connection strings.
5. Run Prisma migrations against Supabase.

## Apps

| Path | Role |
|------|------|
| `apps/web` | Mechanic mobile-first UI |
| `apps/api` | REST API + domain logic |
| `packages/shared` | Enums, DTOs, Zod contracts |
| `apps/api/prisma` | Prisma schema, migrations, and local seed; this is the only migration source |
| `docs/PRD_Lightning_Shop_Mechanic_P0.md` | Full PRD |
| `docs/CURRENT_PRODUCT_STATUS.md` | Implemented workflows, operating configuration, and explicit next steps |
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
- `GET|POST /api/work-orders`
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

## Out of P0

Manager UI, Ninox live integration, per-job timers, parts/purchasing, dual-write.
