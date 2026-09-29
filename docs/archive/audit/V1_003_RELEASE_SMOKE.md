> **ARCHIVADO (2026-09-29).** Documento histórico: no describe el sistema actual y no manda sobre el código. La fuente vigente es [`docs/README.md`](../../README.md).

# V1-003 production release smoke

**Classification:** REFERENCE
**Task:** V1-003
**Probed:** 2026-09-11
**Production commit:** `3240020` (includes merged #73 V1-001, #74 V1-004, #75 V1-000 close docs)
**Status:** COMPLETE — deployments READY, health/root PASS, three temp-user
login landings PASS. Safari mobile remains OPERATOR_REQUIRED.

This record is non-destructive. No Work Order was created. No passwords, tokens,
or secrets are recorded here.

## Vocabulary

| Result | Meaning |
|---|---|
| PASS | Observed from this environment with evidence |
| FAIL | Observed unexpected 401/403/500 or a production defect |
| OPERATOR_REQUIRED | Needs a signed-in production session, mailbox, or real Safari device |
| NOT RUN | Intentionally skipped |

## Production deployments

Both current-`main` production deployments are READY and aliased to the public
hosts. Combined GitHub status for `3240020` is success (`test` CI run
`34631345463` plus both Vercel contexts).

| App | Current production id | SHA | State | Alias | Inspector |
|---|---|---|---|---|---|
| `ltl-shop-api` | `dpl_ZwYc3mDu7YnPU11GATCsL5e3dFvh` | `3240020` | READY | `ltl-shop-api.vercel.app` | https://vercel.com/ltl8/ltl-shop-api/ZwYc3mDu7YnPU11GATCsL5e3dFvh |
| `ltl-shop-web` | `dpl_9gxmixbKcrseL7smaQcqo8vdbSu4` | `3240020` | READY | `ltl-shop-web.vercel.app` | https://vercel.com/ltl8/ltl-shop-web/9gxmixbKcrseL7smaQcqo8vdbSu4 |

No runtime error clusters and no production 5xx logs were reported for either
project in the previous 24 hours.

## Rollback targets

Keep the immediately previous READY production deployments. Schema rollback is
not automatic; see `docs/DEPLOY.md`.

| App | Previous production id | SHA | Notes |
|---|---|---|---|
| `ltl-shop-api` | `dpl_GLvxijFjsZLMZqVUkH7FokoPuJX2` | `92e1b39` (#74) | Vercel `isRollbackCandidate: true` |
| `ltl-shop-web` | `dpl_9mv6ZE7jPtTZQjjJxkK3pcP3pwX4` | `92e1b39` (#74) | Vercel `isRollbackCandidate: true` |

The V1-000 redeploy `dpl_46ydTmr8ETSiLqnKysbh3Z7Vr7Td` (`436988f`) remains a
known-good earlier API artifact but is no longer the immediate rollback
candidate.

## Release gate

| Check | Result | Evidence |
|---|---|---|
| Approved Prisma release path | PASS | Release safety workflow `34626614809` applied the four pending migrations on `main` and verified API health/root. See `V1_000_DEPLOYMENT_INVESTIGATION.md`. |
| Prisma release gate still enforced | PASS | No new migrations landed after those four (`20260910180000`, `20260911120000`, `20260911130000`, `20260911140000`). PRs #73/#74/#75 did not add schema. The gate was not weakened. |
| GitHub CI on current `main` | PASS | `34631345463` success for `3240020` |
| Combined commit status | PASS | `Vercel – ltl-shop-api` and `Vercel – ltl-shop-web` both success |

## Health and unauthenticated reads

Probed 2026-09-11T18:22:22Z from this cloud environment.

| Check | Result | Evidence |
|---|---|---|
| `GET https://ltl-shop-api.vercel.app/api/health` | PASS | HTTP 200, `{"ok":true,"dataSource":"supabase",...}` |
| `GET https://ltl-shop-api.vercel.app/` | PASS | HTTP 200, `{"name":"Lightning Shop API","ok":true,...}` |
| `GET https://ltl-shop-web.vercel.app/` | PASS | HTTP 200 HTML; unauthenticated browser then lands on `/login` |
| `GET https://ltl-shop-web.vercel.app/login` | PASS | HTTP 200 |
| `GET https://ltl-shop-web.vercel.app/reset-password` | PASS | HTTP 200 |
| `GET https://ltl-shop-web.vercel.app/admin` | PASS | HTTP 307 → `/login?next=%2Fadmin` |
| `GET /admin/work-orders` | PASS | HTTP 307 → `/login?next=%2Fadmin%2Fwork-orders` |
| `GET /admin/work-orders/new` | PASS | HTTP 307 → `/login?next=%2Fadmin%2Fwork-orders%2Fnew` |
| `GET /admin/yard-operations` | PASS | HTTP 307 → `/login?next=%2Fadmin%2Fyard-operations` |
| `GET /api/auth/me` (no token) | PASS | HTTP 401 `Missing authorization token` |
| `GET /api/work-orders` (no token) | PASS | HTTP 401 |
| `GET /api/trucks` (no token) | PASS | HTTP 401 |
| `GET /api/admin/dashboard` (no token) | PASS | HTTP 401 |
| Unexpected 500 | PASS | None observed on these probes |

## Login landing (desktop Chromium + 390×844)

| Check | Result | Evidence |
|---|---|---|
| Login form renders | PASS | Heading `Sign in`, hint `Sign in with the email linked to the Shop.`, Email + Password fields, `Sign in` and `Reset password` buttons |
| Dev Login absent in production | PASS | No Dev Login control on the production form |
| Unauthenticated Home | PASS | `/` client-navigates to `/login` |
| Unauthenticated Standard workspace | PASS | `/mechanic/standard` lands on `/login` |
| Unauthenticated PM workspace | PASS | `/mechanic/pm` lands on `/login` |
| Unauthenticated Admin | PASS | `/admin` → `/login?next=%2Fadmin` |
| Invalid credentials (non-account email) | PASS | Form stays on `/login` and shows `Invalid login credentials`. Supabase Auth returned HTTP 400. No 500. |
| Reset page without recovery token | PASS | Heading `Recovery link unavailable` and `Back to sign in` → `/login` |
| Desktop Chromium login | PASS | Cloud Playwright against production |
| Cloud mobile viewport 390×844 | PASS | Same login landing; not a real device |
| Admin signed-in landing (`crixcrox@outlook.com` → `/admin`) | PASS | Operator production login: `login_ok` yes; final URL `/admin`; landed as Admin / Shop Operations. Signed out after. |
| Standard signed-in landing (`cristian240588@hotmail.com` → `/mechanic/standard`) | PASS | Operator production login: `login_ok` yes; final URL `/mechanic/standard`; landed as Mecánico General / My Assigned Work. One transient “Unable to reach the Shop” cleared on retry. Signed out after. |
| PM signed-in landing (`cristian@ltransl.com` → `/mechanic/pm`) | PASS | Operator production login: `login_ok` yes; final URL `/mechanic/pm`; landed as Mecánico PM / PM Mechanic. Signed out after. |

Expected post-login destinations from `postLoginPath`:

- `admin.access` → `/admin`
- `mechanic.standard` → `/mechanic/standard`
- `mechanic.pm` → `/mechanic/pm`

## Remaining operator row

| Check | Result | Operator note |
|---|---|---|
| Safari mobile real device | OPERATOR_REQUIRED | No real iPhone/Safari path in this cloud environment. Repeat one login landing plus a short Standard or PM day flow on a physical device. |

Deeper mutation flows (Manager planning/assignment/blocker, Admin correction,
readiness writes, password-reset mailbox) were not required to close V1-003
after the three login landings passed. If later exercised, use an approved
test Truck, record Work Order ids for cleanup, and do not write passwords.

## Temporary production test users

Provisioned by the operator for V1-002. Capabilities below are the intended
mapping; this agent did not re-read production Auth or capability tables.

| Email | Intended workspace | Intended capabilities |
|---|---|---|
| `crixcrox@outlook.com` | Admin | `admin.access` + `work_orders.manage` + `yard.operations.manage` |
| `cristian240588@hotmail.com` | Mecánico General | `mechanic.standard` |
| `cristian@ltransl.com` | Mecánico PM | `mechanic.pm` |

The real Shop roster is still pending a later operations pass.

## Non-blocking observation

`https://ltl-shop-web.vercel.app/favicon.ico` returns HTTP 404. It does not
block login or health and was not treated as a smoke failure.

## Cleanup

No production Work Order, readiness assessment, or user change was created by
this smoke. Nothing to clean up from the agent pass.

## Next action for Cristian

Repeat one login landing on a real Safari iPhone and append PASS/FAIL here.
Do not write passwords.
