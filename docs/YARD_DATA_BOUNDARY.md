# Yard data-boundary proxy (LTR-70)

**Classification:** CURRENT STATE / INTEGRATION BOUNDARY
**Updated:** 2026-09-21
**Capability:** `admin.access` (same as other Admin Yard reads)

Admin Yard Phase 1 cards — **Incoming Trucks**, **Upcoming Departures**, and
**Work location** — read Lightning `agent-reporting` through Nest. The
`x-agent-key` stays on the API. It must never appear in `apps/web`, browser
storage, or any `NEXT_PUBLIC_*` variable. **Presence / in-yard geofence is
out of scope** and remains `UNKNOWN`.

## FE wiring

Call this endpoint in parallel with `GET /api/admin/yard-operations`. Do not
wait for the board list DTO: `incomingTrucks` / `upcomingDepartures` on that
page remain `{ status: 'unavailable', reason: 'integration_not_connected' }`
until a later FE cutover.

```
GET /api/admin/yard/data-boundary
Authorization: Bearer <session>
```

Shared TypeScript contract: `YardDataBoundaryDto` in `@ltl-shop/shared`.

HTTP status is **200** for missing config and upstream failures so the Phase 1
card can stay on screen. Read `status` per section.

### Example — live data (`status: 'ok'`)

```json
{
  "asOf": "2026-09-21T16:00:00.000Z",
  "windows": {
    "timeZone": "America/New_York",
    "thisWeek": { "from": "2026-09-21", "to": "2026-09-27" },
    "nextWeek": { "from": "2026-09-28", "to": "2026-10-04" }
  },
  "workLocation": {
    "status": "ok",
    "summary": "301 Yard",
    "items": [
      { "truckNumber": "277", "location": "301 Yard" },
      { "truckNumber": "905", "location": "301 Yard" }
    ]
  },
  "incomingTrucks": {
    "status": "ok",
    "items": [
      {
        "truckNumber": "277",
        "returnDate": "2026-09-22",
        "window": "this_week",
        "drivers": ["Ana", "Luis"]
      }
    ]
  },
  "upcomingDepartures": {
    "status": "ok",
    "items": [
      {
        "truckNumber": "905",
        "outDate": "2026-09-23",
        "window": "this_week",
        "drivers": ["Kai"]
      }
    ]
  }
}
```

### Example — missing API key (`status: 'unavailable'`)

Returned when `AGENT_REPORTING_KEY` is unset. Items are empty. Message is safe
to show.

```json
{
  "asOf": "2026-09-21T16:00:00.000Z",
  "windows": {
    "timeZone": "America/New_York",
    "thisWeek": { "from": "2026-09-21", "to": "2026-09-27" },
    "nextWeek": { "from": "2026-09-28", "to": "2026-10-04" }
  },
  "workLocation": {
    "status": "unavailable",
    "items": [],
    "message": "AGENT_REPORTING_KEY is not configured on the API. Phase 1 cards stay disconnected until a server-only agent-reporting key is set."
  },
  "incomingTrucks": {
    "status": "unavailable",
    "items": [],
    "message": "AGENT_REPORTING_KEY is not configured on the API. Phase 1 cards stay disconnected until a server-only agent-reporting key is set."
  },
  "upcomingDepartures": {
    "status": "unavailable",
    "items": [],
    "message": "AGENT_REPORTING_KEY is not configured on the API. Phase 1 cards stay disconnected until a server-only agent-reporting key is set."
  }
}
```

### Example — upstream failure (`status: 'error'`)

Sections fail independently. A failed section has empty `items` and a generic
message (no key, no upstream body).

```json
{
  "workLocation": {
    "status": "error",
    "items": [],
    "message": "Yard movement data is temporarily unavailable."
  }
}
```

UI recommendation: `unavailable` keeps the existing Phase 1 UNAVAILABLE chip;
`ok` renders the compact list; `error` is a recoverable retry on this card
only.

## Mapping

Gateway: `GET https://aaqquwhdglueqlnbifvn.supabase.co/functions/v1/agent-reporting`
(`AGENT_REPORTING_URL` override). Auth header `x-agent-key`. Pagination follows
`next_offset` until `has_more=false`. Sensitive fields (Phone, CDL, VIN) are
never requested.

| Card | Report | Mapping |
| --- | --- | --- |
| Work location | `trucks` | Compact `{ truckNumber, location }` for trucks with non-empty `yard_location`. `summary` is set when one location is **strictly more than half** of those items (typical headline: `301 Yard`). This is Ninox `E.X1` text such as a yard or vendor — **not** Presence. |
| Incoming Trucks | `returns` | Driver-row grain collapsed to distinct `Truck`. `returnDate` is the earliest ISO date on that truck (`null` stays undated). Driver display names only. Default window: this Monday–Sunday, next week, plus undated. |
| Upcoming Departures | `driver_pay` | `out_from` = this Monday, `out_to` = next Sunday (`America/New_York`). Distinct `Truck_Number`. `outDate` from `Out Date`. Driver display names only. |

Weeks are Monday–Sunday in `America/New_York`. Optional item `window` is
`this_week` | `next_week` | `undated` so the FE can bucket without re-deriving
the calendar.

## Follow-up: Schedule_Teams

The data-reporting-kit also unions live Ninox **Schedule_Teams** (Out Schedule)
with `driver_pay` for current-week departure counts. No Schedule_Teams URL is
documented in this Shop repo, so this slice ships **driver_pay-only**. Do not
invent a Ninox share URL here.

## Env (API project only)

```
AGENT_REPORTING_KEY=
AGENT_REPORTING_URL=https://aaqquwhdglueqlnbifvn.supabase.co/functions/v1/agent-reporting
```

Set these on the Nest API host (Vercel `ltl-shop-api` prod + preview). Never
`NEXT_PUBLIC_AGENT_REPORTING_KEY`.
