# Ninox ↔ Shop mapping (verified)

**Classification:** CURRENT STATE / INTEGRATION BOUNDARY
**Updated:** 2026-09-20
**Authority:** MappingTool live scan of `lightningtransport.ninoxdb.com` plus
Shop code. This document does **not** authorize a live Ninox client, dual-write,
or invented field IDs.

Code constants live in `apps/api/src/integrations/ninox/ninox.mapping.ts`.
The Spanish go-live list is `GO_LIVE_CHECKLIST_ES.md`.

## Answer: can the shop launch after the MappingTool scan?

**Yes, from mapper discovery.** The Shop does not call Ninox at runtime. The
only business key needed to relate a Shop truck to Ninox later is already
known: `truckNumber` ↔ `E.A`. Remaining launch work is Shop product,
engineering, auth, seed/ops, and environment — not another MappingTool scan
— unless product later requires trailers as first-class Ninox assets (UC
target still unresolved). `E.TA` / `E.Y1` are not live board/Ready sync.

## Verified IDs only

Declared-catalog TrucksDB fields (MappingTool) plus Monday-launch fallbacks
`E.AN` / `E.Y1`. Full persist map: `docs/NINOX_TRUCK_SEED.md`.

| Ninox path | Meaning | Shop counterpart |
|---|---|---|
| Table `E` | TrucksDB (117 fields; workspace has 163 tables) | `public.trucks` |
| `E.A` | truck number | `truckNumber` (ops key; upsert with VIN) |
| `E.CG` | vin | `vin` when present |
| `E.OF` | odometer | `mileage` |
| `E.X1` / `E.AN` | last-reported location | `samsaraTruckLocation` / date-shaped `samsaraLastConnectedDate` — **not** Presence |
| `E.Y1` | Shop Status | optional `ninoxMechanicStatus` — **not** Ready or board phase |
| `E.TA` / `E.T5` | OutWork / optional | not written onto operational Shop columns |
| `E.DG` | make display | `make` (`model` unresolved — no Ninox ID) |

Do not add other table or field IDs until a new live scan confirms them.

## Unresolved

| Target | Status | Why it is not invented |
|---|---|---|
| UC trailer table / field | **Unresolved in Ninox** | MappingTool did not close a trailer ID. Shop Trailer is a **Job Category**, not a Ninox-backed asset table. |

## What the Shop does today

- Source of truth is Supabase PostgreSQL via Prisma. `DATA_SOURCE=supabase`.
- `NinoxClient` is a ping stub (`GET /api/integrations/ninox/status`). It
  does not read `NINOX_*` secrets and does not write Ninox.
- Prisma stores optional `ninox_external_id` leftovers on several models.
  Those columns are **not** table IDs and are **not** the join key.
- Yard Phase / Work Plan phases are derived in Shop. They are **not** `E.TA`.
- There is no truck editor API. Production truck numbers were loaded
  historically. Local `prisma/seed.ts` upserts only `905`, `922`, `968` and
  must not run against production.

## Join rule (future sync, if approved)

```
Shop truckNumber  ==  trucks.truck_number  ==  Ninox E.A
```

Do not use the Ninox record id as Shop identity. Do not treat `ninox_external_id`
as the operational join. Do not map Yard columns to `E.TA`.

## Hard dependency check

No further mapper discovery is required to open the Shop to real users for
trucks, Work Orders, PM, Admin, or Yard Phase 1. A later Ninox adapter is
gated product/engineering work (token, value vocabulary for `E.TA`,
reconciliation of `E.A` formats, optional trailer IDs).
