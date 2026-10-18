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

## Ronda 2026-10 (segunda) — over-fetching en API, bundle web y limpieza (PF15–PF26, LTR-237)

Segunda ronda de velocidad después de PF1–PF14.
Solo toca código de producto; la demo está congelada desde 2026-10-16.
Se divide en tres PR acotados: PR-A API (LTR-238), PR-B índice QC (LTR-239) y PR-C bundle web y limpieza (LTR-240). `getAttention` solo se midió (LTR-241).
Cada cambio ocupa un commit, se mide antes y después y se revierte si no mejora. La base es `perf/optimizacion-sin-demo`, creada desde `main` en `66ab98a`.

### Línea base — 2026-10-17 (local)

El API se compiló con `nest build` y se ejecutó con `node dist/src/main.js` contra la base Postgres local `ltl_shop`, después de `prisma migrate deploy`. Había 9 Work Orders, 41 Jobs, 9 Trucks, 11 usuarios, 0 hallazgos QC y 90 filas de actividad. Se usaron `AUTH_DEV_BYPASS=true`, `AUTH_USER_CACHE_TTL_MS=0` y tokens `dev:`; así cada petición paga las 2 consultas de autenticación.

TTFB es la mediana de 5 ejecuciones de `curl -w` después de una de calentamiento. Las consultas Prisma por petición se contaron con un script pequeño que instancia el servicio Nest con un `PrismaClient` contador; se usó el mismo método en todas las mediciones. El conjunto de datos es pequeño, por lo que el número de consultas es la métrica principal y TTFB solo es indicativo.

| Endpoint | Consultas/petición | TTFB mediana | Bytes |
| --- | ---: | ---: | ---: |
| `GET /api/work-orders` (mecánico) | 23 | 0.026 s | 23 520 |
| `GET /api/admin/dashboard` (Manager) | 141[^dashboard-yard] | 0.069 s | 18 406 |
| `GET /api/admin/work-orders/:id` | 24 | 0.027 s | 4 011 |
| `GET /api/team-queue` (mecánico) | 3 | 0.005 s | 2 (vacío para este usuario) |
| `GET /api/work-orders/:id/pm` | 15 | 0.023 s | 7 580 |
| `GET /api/admin/parts-costs/stock` | 4 | 0.006 s | 51 (vacío) |

[^dashboard-yard]: Una primera medición dio 87 porque el servicio Yard no estaba conectado en el script. El valor 141 usa `YARD_READY_TO_GO_SINCE` como en `.env`. Subconsultas: `getAttention` 60, `getDashboardQueue` 30, `countReadyToGoTrucks` 41, seis conteos 6, work requests 1 y hallazgos QC 1.

Las pruebas unitarias pasaron: shared 79, api 682 y web 271. `tsc` quedó limpio en los tres workspaces. `next build` reportó First Load JS de 187 kB compartidos, `/login` 316 kB, `/admin` 346 kB, `/admin/work-orders` 345 kB, `/admin/work-orders/[id]` 385 kB, `/admin/trucks/[id]` 411 kB, `/admin/yard-operations` 335 kB, `/qc` 344 kB, `/work-orders/[id]` 351 kB, `/mechanic/standard` 329 kB y middleware 100 kB.

`test:real` pasó 32 archivos y 176 pruebas en la rama de PR-A. Playwright e2e en modo fixture no pudo ejecutarse dentro del sandbox del agente porque Chrome terminó con `SIGABRT`; solo prueba la web y queda diferido a PR-C.

El `EXPLAIN` de la consulta de hallazgos QC del Dashboard sobre la tabla vacía mostró `Bitmap Index Scan` sobre `qc_findings_work_order_id_resolved_at_idx` (`resolved_at IS NULL`) y filtro por `created_at`; tardó 0.15 ms. El índice se añade en PR-B.

### PR-A — la API deja de cargar de más (LTR-238)

**ID:** PF15
**Qué cambió:** En `work-order.mapper.ts`, el nuevo `workOrderSummaryInclude` exportado deriva de `workOrderDetailInclude` sin `noteEntries` y, por Job, sin `sources`, `purchaseLines`, `stockMovements` ni `tireChanges`; `listForMechanic` lo usa.
**Por qué:** Home del mecánico consulta esta lista cada 30 s y `toWorkOrderSummary` no lee esas relaciones.
**Cómo se midió:** Conteo Prisma, TTFB local y comparación con el archivo dorado.
**Antes → Después:** 23 → 17 consultas; 0.026 → 0.027 s; JSON idéntico, 23 520 bytes.
**Cómo revertir:** `git revert e491529`

**ID:** PF17
**Qué cambió:** En `admin.service.ts`, `openQcFindingsForDashboard` pasó al `Promise.all` existente de `dashboard()`.
**Por qué:** Esperaba a que terminara todo lo demás.
**Cómo se midió:** Conteo Prisma, TTFB local y comparación de JSON.
**Antes → Después:** 141 → 141 consultas, con una ida secuencial menos; 0.069 → 0.072 s, ruido; JSON idéntico salvo `generatedAt` y `windows.openOlderThan24h.before`.
**Cómo revertir:** `git revert 3ffa919`

**ID:** PF16
**Qué cambió:** En `yard-operations.service.ts`, `getWorkPlanBoardCounts` carga los mismos Trucks con los includes acotados `readyToGoCountTruckInclude` y `readyToGoCountWorkOrderInclude`; `attachReadyWorkOrders` acepta un include opcional, el board no cambia y se eliminó el contador muerto `blocked`.
**Por qué:** `countReadyToGoTrucks`, usado por el conteo Ready to Go del Dashboard, derivaba `deriveWorkPlan` cargando relaciones de tarjetas que no lee: truck, owners, team, pauses y blocker notes. El `counts.blocked` de Yard viene de `getCounts` y conserva sus especificaciones.
**Cómo se midió:** Conteo Prisma, TTFB local y comparación de las respuestas del Dashboard y Yard operations.
**Antes → Después:** `countReadyToGoTrucks` 41 → 13 consultas; Dashboard 141 → 113; 0.069 → 0.045 s; JSON idéntico y `readyToGo` 1 en ambos.
**Cómo revertir:** `git revert 359fb9a`

**ID:** PF19
**Qué cambió:** En `team-queue.service.ts`, el `shopWorkflowStep.findMany` que esperaba después del `Promise.all` se incorporó al mismo bloque porque solo depende de `stepKeys`.
**Por qué:** Era una ida secuencial innecesaria.
**Cómo se midió:** Copia temporal de la base con 3 miembros de equipo y 2 Jobs en cola; conteo del handler, TTFB y comparación para 4 usuarios.
**Antes → Después:** 9 → 9 consultas, con una ida secuencial menos; 16.7 → 13.2 ms, ruido; JSON idéntico para 4 usuarios.
**Cómo revertir:** `git revert 65dd9a8`

**ID:** PF20
**Qué cambió:** En `getPmService`, el `include` del catálogo PM pasó a un `select` de lo que muestra la hoja: id, slug y nombre de categoría; partNumber y displayName de la pieza; make y model del fitment.
**Por qué:** Las demás columnas no llegan a la respuesta. El filtrado de fitment sigue en memoria porque `partFitsTruck` normaliza make y model.
**Cómo se midió:** Conteo Prisma, TTFB local y comparación con el JSON dorado.
**Antes → Después:** 15 → 15 consultas, con menos columnas; 17.8 → 17.8 ms; JSON idéntico, 7 580 bytes.
**Cómo revertir:** `git revert e56f479`

#### Descartados en PR-A

- PF18, acotar `activityLogs` del detalle de WO del Admin: la web muestra toda la pestaña Activity Log en `work-order-history.tsx` y deriva estados de la lista completa en `work-order-view.ts`. El `select` ya coincide con lo que se mapea. Limitarlo cambiaría el comportamiento y no hay una mejora segura.
- PF21, filtrar `q` o `low` del stock en la base: la comparación en memoria normaliza NFD, quita diacríticos y caracteres no alfanuméricos, y busca en `displayName + partNumber + tireSize`. `contains` de Prisma no reproduce casos como `11r22.5` frente a `11R22.5`, `oil filter` frente a `Oil-Filter` ni la búsqueda cruzada `filter123`; `low` depende de un agregado. Se deja igual.

#### Medido, sin cambio: getAttention (LTR-241)

Usa 60 de las 141 consultas del Dashboard. Ejecuta seis `findMany` con `summaryInclude` sobre unas 10 filas cada uno; cada relación genera una consulta separada, seis veces. Candidato para la siguiente ronda: una consulta de Work Orders abiertos y ranking en memoria.

### PR-B — índice QC (LTR-239)

Pendiente; se completa al cerrar el PR.

### PR-C — bundle web y limpieza (LTR-240)

Pendiente; se completa al cerrar el PR.
