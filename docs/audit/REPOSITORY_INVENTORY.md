# Repository inventory

**Classification:** REFERENCE
**Audited commit:** `2a77d4e`
**Updated:** 2026-09-11

## Application

### `apps/web`

- Next.js 15 App Router and React 19.
- Mechanic workspaces: `/mechanic/standard`, `/mechanic/pm`, Work Order create,
  detail, Truck history, login, and password reset.
- Admin workspace: dashboard, Work Orders, Manager Work Order creation/detail,
  Trucks/Truck Detail, Mechanics, History, read-only Catalog, and Yard
  Operations.
- Shared UI primitives and semantic tokens are local to the app; Radix,
  Tailwind, `class-variance-authority`, Lucide, SWR, Sentry, Speed Insights,
  Supabase Auth, and PostHog are configured.
- Typed EN/ES catalogs reuse common component trees.

### `apps/api`

- NestJS modules for auth/users, Work Orders, Trucks, Admin, Yard readiness,
  Job Catalog, PM parts, Activity Log, observability, release safety, and the
  placeholder integration surface.
- Domain validation, authorization, concurrency, idempotency, and audit rules
  remain server-side.
- Sentry HTTP handling and request timing instrumentation are present.

## Shared

### `packages/shared`

- Domain enums, DTOs, and Zod request/query schemas shared by web and API.
- Includes capabilities, Work Order/Job/readiness contracts, Manager create,
  Job assignment, and blocker contracts.
- Built output under `packages/shared/dist` is generated and ignored.

## Data

- PostgreSQL datasource configured by `DATABASE_URL` and `DIRECT_URL`.
- Prisma schema: `apps/api/prisma/schema.prisma`.
- Prisma migration history: 15 ordered migrations under
  `apps/api/prisma/migrations`, from initial schema through Manager ownership
  capability, Job assignment, and blocker persistence.
- Seed: `apps/api/prisma/seed.ts`; PM catalog fixture:
  `apps/api/prisma/pm-parts.ts`.
- Local development uses PostgreSQL 16. Supabase PostgreSQL is the operational
  hosted database.
- `supabase/migrations/20260825140000_init_domain.sql` is a legacy copy of the
  initial domain schema. It is preserved but must not be applied or extended;
  it is not migration authority.

## Source-of-truth verification

| Concern | Authority |
|---|---|
| Product TARGET | `docs/LIGHTNING_SHOP_MASTER_PRD.md` |
| Product CURRENT | Tested code and `docs/CURRENT_PRODUCT_STATUS.md` |
| Database schema history | Prisma migrations only |
| Operational runtime data | Supabase PostgreSQL |
| Authentication | Supabase Auth |
| Backend domain | NestJS |
| Frontend | Next.js |
| UI | Existing Lightning Shop design system and shadcn-style primitives |

Ninox is not operational and must not be reactivated from historical
documentation. The legacy Supabase SQL snapshot likewise does not establish a
second migration history.

## Documentation

- Canonical/current/engineering documents are listed first in
  `docs/DOCUMENTATION_INDEX.md`.
- The dated 2026-09-09 package, original P0 PRD, old Admin/ownership plans,
  prompts, and handoffs are preserved but non-authoritative.
- Audit output lives in `docs/audit`; older point-in-time implementation audits
  remain in `docs/audits` to avoid destructive moves during this iteration.

## Tests

| Layer | Location | Runner | Inventory |
|---|---|---|---|
| Shared unit | `packages/shared/src/*.spec.ts` | Vitest | 1 file / 11 tests |
| API unit/service | `apps/api/src/**/*.spec.ts` | Vitest | 17 files / 109 tests |
| Web unit | `apps/web/src/**/*.spec.ts` | Vitest | 6 files / 19 tests |
| E2E | `apps/web/e2e/*.spec.ts` | Playwright | 6 files / 86 project cases across Chromium and WebKit |

The E2E suite covers mechanic Standard, PM, Admin, Truck Detail/readiness, Yard
Operations, responsive behavior, and UX regressions. Its current baseline is
not fully green; see `BASELINE_VERIFICATION.md`.

## Tooling

- npm workspaces: `apps/*`, `packages/*`.
- Root scripts: dev, build, lint, test, Prisma generate/migrate/seed.
- “Lint” is TypeScript `--noEmit` in all three workspaces; no separate ESLint
  configuration is present.
- CI uses Node 22 and PostgreSQL 16, applies Prisma migrations, runs API tests
  and typecheck, and builds web.
- Release Safety is manually dispatched and gates production Prisma status,
  optional approved migration deploy, and API probes.
- Vercel deploys web and API separately; API is configured for `pdx1`.
- Cursor Cloud configuration provisions local PostgreSQL and exposes ports 3000
  and 3001.

## Local artifact audit

Correctly ignored outputs observed after verification:

- `.env`;
- root/workspace `node_modules`;
- `apps/api/dist`;
- `apps/web/.next`;
- `apps/web/test-results`;
- `apps/web/tsconfig.tsbuildinfo`;
- `packages/shared/dist`.

No tracked build output, test report, log, editor artifact, or local database
file was found. `.gitignore` covers these categories. Its duplicate `.env`
patterns are harmless and need no normalization-only edit.
