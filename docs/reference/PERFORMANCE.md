# Production performance

This document records repeatable performance measurements and the changes made
to the production critical path. Never add tokens, credentials, or database
connection strings here.

For the engineering rules that apply these findings to future features, see
[ENGINEERING_PRACTICES.md](./ENGINEERING_PRACTICES.md).

## Targets (P75)

- Usable application: under 2 seconds.
- Authenticated navigation: under 1 second.
- Warm API response: under 500 milliseconds.

## Baseline — 2026-08-28

Measured from the US East Coast with five sequential `curl` requests per URL.
These timings cover DNS, TLS, server response, and transfer, but not browser
hydration or authenticated database queries.

| Target | Deployment | Region | Observed total time |
| --- | --- | --- | --- |
| Web `/` | `ltl-shop-web.vercel.app` | `iad1` | 0.13–0.23 s normally; one 0.75 s outlier |
| Web `/login` | `ltl-shop-web.vercel.app` | `iad1` | 0.12–0.17 s |
| API `/api/health` cold | `ltl-shop-api.vercel.app` | `iad1` | 1.72 s |
| API `/api/health` warm | `ltl-shop-api.vercel.app` | `iad1` | 0.13–0.15 s |
| API `/api/auth/me` without token | `ltl-shop-api.vercel.app` | `iad1` | 0.13–0.15 s (expected 401) |

The frontend is served from Vercel's cache and is not the dominant baseline
bottleneck. The API shows a roughly 1.57 second cold-to-warm delta before an
authenticated database query is included.

### Infrastructure finding

- The API deployment originally executed in Vercel `iad1` (`us-east-1`).
- The configured Supavisor pooler is in AWS `us-west-2`.
- `DATABASE_URL` already uses transaction mode on port `6543`; credentials were
  not printed or stored during verification.
- The API is therefore pinned to Vercel `pdx1` (`us-west-2`) for Preview and the
  subsequent production promotion.

## Instrumentation

- Vercel Speed Insights reports real-user Web Vitals per frontend route.
- Every NestJS response includes `Server-Timing: app;dur=<milliseconds>`.
- API runtime logs include request ID, method, path without query parameters,
  status, duration, cold-start flag, and instance age.
- Logs intentionally exclude headers, request bodies, query values, tokens,
  credentials, and database URLs.

## Reproduce

Run each probe several times so the first response can be compared with warm
responses:

```bash
curl -sS -o /dev/null -w 'status=%{http_code} ttfb=%{time_starttransfer}s total=%{time_total}s\n' \
  https://ltl-shop-api.vercel.app/api/health
```

Authenticated endpoint measurements will be added from a Preview deployment
without storing the token used to collect them.

## Local verification — 2026-08-28

- All workspace production builds pass. The web bundle remains 133–135 kB on
  authenticated routes after adding SWR; replacing the remote font import did
  not increase it further.
- API and shared unit suites pass: 11 tests total.
- Type checks pass for API, web, and shared workspaces.
- Playwright passes all 5 critical-flow tests, including non-blocking profile
  restoration, cache reuse during navigation, and a usable shell while work
  orders are loading.
- The workspace test command excludes Playwright specifications from Vitest,
  and the workspace lint command runs non-interactively in CI.

## Preview status — 2026-08-28

After authenticating GitHub as an authorized repository administrator and
creating the branch head with that identity, both projects built successfully:

- Web: `https://ltl-shop-web-git-codex-performance-optimization-ltl8.vercel.app`
  (`READY`). Its login page became usable in approximately 1.37 seconds during
  an external browser check, with no browser console warnings or errors.
- API: `https://ltl-shop-api-performance-preview.vercel.app` (`READY`). The
  generated NestJS function is 9.2 MB and runs in `pdx1`, next to the Supabase
  `us-west-2` pooler as intended.

Vercel deployment protection remains enabled. The installed CLI does not support
authenticated `vercel curl`, and direct API navigation is blocked by the browser
security client, so cold/warm Preview endpoint timings were deferred until the
production promotion.

## Production verification — 2026-08-29

- The API Preview was promoted to production as deployment
  `dpl_H7bgiLGWW8KchqMqgSZzDrTgGhGT`.
- `ltl-shop-api.vercel.app` now resolves to the 9.2 MB NestJS function in `pdx1`;
  the previous `iad1` deployment remains available for rollback.
- Five sequential `/api/health` probes measured 0.55 seconds on the first request
  and 0.24–0.29 seconds on the following requests. All returned HTTP 200.
- The production response includes `Server-Timing` and identifies the execution
  path as `iad1::pdx1`; the application portion of the sampled request was 1.1 ms.
- `/api/auth/me` without a token returns the expected HTTP 401, and production
  CORS allows `https://ltl-shop-web.vercel.app`.
- Runtime logs show the structured `request_completed` event and no unexpected
  HTTP 500 during verification.
- The Vercel API project is connected to `lightningtransport/LTL_Shop`, with
  `apps/api` as its root and `main` as its production branch.

No environment variables were changed during promotion or verification.

## LTR-19 — PWA iOS home-screen hang (2026-09-14)

Cristian (iPhone): Add to Home Screen left the app on loading. Chrome web was
sometimes slow. Warm API `/api/health` is 170–180 ms TTFB and does not explain
an indefinite hang.

### Repro

1. iOS Safari → Share → Add to Home Screen (manifest `start_url` is `/`).
2. Open the home-screen icon (standalone). Unauthenticated or with a saved
   `ltl_shop_token` whose profile request never completes.
3. Desktop Chrome: open `/` or `/login` with a cold JS bundle and no token.

There is **no service worker** in `apps/web`. Stale SW cache was ruled out.

### What actually blocked the shell

- `/` rendered an indefinite “Restoring session” skeleton while
  `router.replace('/login')` ran. iOS standalone often never finishes that
  client redirect, so the splash/skeleton never cleared.
- Login hid the form for `sessionLoading || (token && !sessionError)`, so a
  hung `/api/auth/me` or `/api/admin/session` (no timeout on the session POST)
  looked like a permanent hang.
- Session init awaited Supabase before painting login when no local token
  existed (up to two 5 s deadlines).
- Home treated `token && !user` as a profile failure while `/api/auth/me` was
  still in flight.

Cold-start API 2–5 s after idle can still delay *data*, but the shell must not
wait on it. This change stays in `apps/web`.

### What changed

- Login paints immediately when there is no token.
- `/` shows a Sign in control (full `<a href="/login">`) if the session is
  empty, instead of only a client redirect.
- Standalone/home-screen uses `location.replace` for auth redirects.
- Profile restore and `/api/admin/session` have an 8 s deadline; retry
  replaces an indefinite skeleton.
- Manifest/icons/`viewport-fit=cover` so iOS splash matches the navy shell.
  No service worker was added.

## Línea base — 2026-10-12 (revisión de velocidad y "feel")

Hallazgos y plan en `docs/OPEN_ISSUES.md` §1s (PF1–PF14, P19–P22). Esta
sección guarda las medidas de partida para comparar cada PR.

### Producción, desde la red del dueño (`curl -w`, mañana del 2026-10-12)

La red local era ruidosa esa mañana (`google.com` 0.4–0.9 s, un `connect` de
35 s a Vercel), así que los absolutos no son comparables con 2026-08; sirven
los relativos y las cabeceras.

| Sonda | Observado |
| --- | --- |
| API `/api/health`, conexión nueva cada vez | 1.3–1.9 s total; `Server-Timing: app;dur=0.4` (la app tarda < 1 ms; el resto es red y enrutamiento `iad1::pdx1`) |
| API `/api/health`, 4 peticiones por la misma conexión | 0.40–0.49 s las cuatro (≈ 0.1 s cada una tras el primer handshake) |
| API `/api/auth/me` sin token (401 esperado) | 1.4–3.3 s |
| Web `/login` | 0.75–1.2 s total, ttfb 0.72–0.78 s |
| `OPTIONS /api/work-orders` (preflight CORS) | 204 en ≈ 1.0 s; **sin `Access-Control-Max-Age`** → el navegador lo repite cada ~5 s (PF8) |

### Build de producción (`next build`, rama de la revisión, antes de cambios)

| Ruta | First Load JS |
| --- | --- |
| Compartido por todas las páginas | **225 kB** (reportado por Next) · 343 kB gz sumando los chunks del layout |
| `/`, `/mechanic/*` | 342–348 kB |
| `/work-orders/[id]` | 419 kB |
| `/admin` | 413 kB |
| `/admin/work-orders` · `/admin/work-orders/[id]` | 411 · 441 kB |
| `/admin/trucks` · `/admin/trucks/[id]` | 389 · 448 kB |
| `/admin/yard-operations` | 401 kB |
| `/admin/parts/*` | 371–388 kB |
| Middleware | 99.6 kB |

Qué llena el compartido (gz): Sentry núcleo 130 kB + Sentry Replay 38 kB +
runtime 54 kB; chunk `773` 63 kB con código propio **incluidos los guiones del
demo** ("A day at the shop", PF11); chunk `8018` 51 kB con radix y lucide. El
chunk `336` (42 kB gz) que comparten las páginas admin lleva el catálogo
`admin-messages` en ambos idiomas (PF12). En 2026-08 una ruta autenticada
pesaba 133–135 kB.

### Viajes por interacción (leídos del código; a confirmar en el panel de red)

| Interacción | Hoy |
| --- | --- |
| Clic en la barra lateral del Admin | middleware → `GET /api/admin/access` (edge → pdx1) → RSC → hidratar → preflight + `GET` de la lista |
| Acción en un Work Order (Admin) | preflight + `POST` → **descarta la respuesta** → preflight + `GET` detalle → toast |
| Volver a una lista del Admin con datos en cache | esqueleto completo hasta que vuelve la lista |
| Abrir el Yard | boundary + lista sin `soonTrucks` → lista otra vez con `soonTrucks` (dos esqueletos) |
| Home del mecánico tras recargar | token → `/me` (y `POST /api/admin/session` que llama `/me` otra vez) → `GET /api/work-orders` |
| Cada lectura al API desde el navegador | preflight `OPTIONS` + `GET` (sin `max-age`) |

### Después de PR 6 (bundle) — mismo `next build`, 2026-10-12

| Ruta | Antes | Después |
| --- | --- | --- |
| Compartido por todas las páginas | 225 kB | **187 kB** |
| `/login` | 341 kB | 303 kB |
| `/mechanic/standard` | 348 kB | 309 kB |
| `/work-orders/[id]` | 419 kB | 381 kB |
| `/admin` | 413 kB | 375 kB |

Qué cambió: Sentry Replay (38 kB gz) ya no va en la primera carga, llega con
`lazyLoadIntegration` después de pintar; el proveedor y el panel del demo son un
chunk `next/dynamic` que producción no pide. `optimizePackageImports` para
`radix-ui` no movió la aguja (< 1 kB). Sigue pendiente el catálogo
`admin-messages` en el bundle cliente (PF12, 42 kB gz en las páginas admin).

### Después de PF12 (catálogo Admin fuera del bundle cliente) — `next build` sobre main sin PR 6, 2026-10-12

| Ruta | main | Con PF12 |
| --- | --- | --- |
| `/admin` | 413 kB | **371 kB** |
| `/admin/yard-operations` | 401 kB | 360 kB |
| `/admin/work-orders/[id]` | 441 kB | 399 kB |
| `/work-orders/new` (mecánico) | 387 kB | 345 kB |
| `/work-orders/[id]` (mecánico) | 419 kB | 376 kB |

Ningún chunk cliente contiene ya textos del catálogo (se buscó una cadena en y
una es en todos los `.js` del build). El ahorro se suma al de PR 6 (compartido
225 → 187 kB, arriba).
