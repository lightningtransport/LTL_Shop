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
