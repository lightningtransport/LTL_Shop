# Production performance

This document records repeatable performance measurements and the changes made
to the production critical path. Never add tokens, credentials, or database
connection strings here.

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
