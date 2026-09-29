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
read kit rows from the board list. `workLocation`, `incomingTrucks`, and
`upcomingDepartures` on that page stay
`{ status: 'unavailable', reason: 'integration_not_connected', items: [], total: 0 }`.
The web reads this endpoint through `AdminYardDataBoundaryCards`, mounted in
`admin-yard-operations.tsx` (Movement tab). The list path does not call
agent-reporting. Schedule_Teams is not part of this proxy.

```
GET /api/admin/yard/data-boundary
Authorization: Bearer <session>
```

Shared TypeScript contract: `YardDataBoundaryDto` and PD-locked EN/ES copy
`YARD_DATA_BOUNDARY_COPY` in `@ltl-shop/shared`.

HTTP status is **200** for missing config and upstream failures so the Phase 1
card can stay on screen. Read `status` per section.

## PD-locked card copy (FE catalog)

Import `YARD_DATA_BOUNDARY_COPY`. Nest does **not** send labels, empty copy, or
the badge. Optional `message` is English only, and only for `unavailable` /
`error`.

Canonical English in ES UI (same as nav): **Work Order**, **Jobs**,
**Incoming Trucks**. Presence stays out of scope.

| Card | EN label | ES label | EN empty (`ok`, 0 rows) | ES empty |
| --- | --- | --- | --- | --- |
| Work location | Work location | Ubicación de trabajo | No work location yet. | Aún no hay ubicación de trabajo. |
| Incoming Trucks | Incoming Trucks | Incoming Trucks | No incoming trucks. | No hay Incoming Trucks. |
| Upcoming Departures | Upcoming Departures | Salidas próximas | No upcoming departures. | No hay salidas próximas. |

Unavailable / error (both locales, both `status` values):

- EN: `Data unavailable.` Badge `UNAVAILABLE`
- ES: `Datos no disponibles.` Badge `NO DISPONIBLE`

FE wiring: `ok` + items → list; `ok` + empty items → `empty`; `unavailable` or
`error` → `unavailable` + badge. Locale from the Admin catalog, not from Nest.

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

Returned when `AGENT_REPORTING_KEY` is unset. Items are empty. `message` is the
English PD string (FE still localizes from `YARD_DATA_BOUNDARY_COPY`).

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
    "message": "Data unavailable."
  },
  "incomingTrucks": {
    "status": "unavailable",
    "items": [],
    "message": "Data unavailable."
  },
  "upcomingDepartures": {
    "status": "unavailable",
    "items": [],
    "message": "Data unavailable."
  }
}
```

### Example — upstream failure (`status: 'error'`)

Sections fail independently. A failed section has empty `items` and the same
PD `message` (no key, no upstream body). `ok` with zero rows has **no**
`message` — FE uses `YARD_DATA_BOUNDARY_COPY.*.empty`.

```json
{
  "workLocation": {
    "status": "error",
    "items": [],
    "message": "Data unavailable."
  },
  "incomingTrucks": {
    "status": "ok",
    "items": []
  }
}
```

UI recommendation: `unavailable` / `error` use the UNAVAILABLE badge plus
`Data unavailable.` / `Datos no disponibles.`; `ok` with rows renders the
compact list; `ok` with zero rows uses the empty copy above.

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
`NEXT_PUBLIC_AGENT_REPORTING_KEY`. Ops sets `AGENT_REPORTING_KEY` on Vercel
separately from this PR.
