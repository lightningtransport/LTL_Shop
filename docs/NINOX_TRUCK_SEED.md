# One-shot Ninox → Shop truck seed

**Classification:** ENGINEERING / LAUNCH
**Updated:** 2026-09-20
**Writes:** Supabase/`public.trucks` only
**Reads:** Ninox TrucksDB `E` once
**Never:** write back to Ninox; query Ninox after a completed run

This is the Monday-launch ETL. It is a CLI, not the running Shop API.
Runtime `NinoxClient` stays a ping stub. `DATA_SOURCE` stays `supabase`.

## Already mapped (declared catalog + launch brief)

| Ninox | Meaning | Shop column |
|---|---|---|
| `E.A` | truck number | `truckNumber` (unique upsert key) |
| `E.OF` | odometer_miles | `mileage` |
| `E.X1` | yard_location | `yardLocation` (not Presence) |
| `E.AN` | location fallback | `yardLocation` if `E.X1` empty |
| `E.TA` | mechanic_status | `ninoxMechanicStatus` (not Yard phase) |
| `E.Y1` | mechanic_status fallback | `ninoxMechanicStatus` if `E.TA` empty |
| `E.DG` | make / make-model display | `make` |
| `E.IJ` | model_year | `year` |
| `E.VF` | owner | `owner` |
| `E.CG` | vin | `vin` |
| `E.PF` | last_known_address | `samsaraTruckLocation` |
| `E.SF` | samsara_last_connected_at | `samsaraLastConnectedDate` |
| `E.BM` | samsara_vehicle_id | `samsaraId` |
| `E.YF` | dispatcher | `dispatcher` |
| `E.Y4` | insurance (CTC/CDT/LTL/…) | `insurance` and first-insert `company` |
| `E.HJ` | license_plate | `licensePlate` |
| record `id` | Ninox row id | `ninoxExternalId` (trace only) |

IDs come from MappingTool `config/declared-catalog.json` plus the launch
brief (`E.AN`, `E.Y1`). No other field IDs are used.

## Missing / incomplete

| Gap | Status |
|---|---|
| Shop `model` | No declared Ninox field. Left null. `E.DG` stays on `make`. |
| UC trailer | Unresolved in Ninox. Out of scope. |
| Existing Shop trucks | **Not updated.** Insert NEW `truckNumber` rows only so PM miles stay intact. |
| Live / recurring sync | Out of scope. After the first completed run the job will not call Ninox. |
| Yard Presence / Work Plan | Not seeded. `E.TA` is stored as raw text only. |
| Ninox credentials in this repo | Never committed. Ops must set `NINOX_*` once. |

## How to run (once)

1. Apply Prisma migration `20260920020000_ninox_truck_seed` via the approved
   release path (`docs/DEPLOY.md`).
2. Set server-only env: `NINOX_BASE_URL`, `NINOX_TOKEN`, `NINOX_TEAM_ID`,
   `NINOX_DATABASE_ID`, plus `DATABASE_URL` / `DIRECT_URL`.
3. Optional dry-run (still reads Ninox, writes nothing):

```bash
npm run prisma:seed-ninox-trucks --workspace=@ltl-shop/api -- --dry-run
```

4. Real insert:

```bash
npm run prisma:seed-ninox-trucks --workspace=@ltl-shop/api
```

5. A completed row in `ninox_truck_seed_runs` is the lock. Later invocations
   print `already-completed` and **do not query Ninox**.
6. Unset `NINOX_TOKEN` after success.

Do not set `NINOX_TRUCK_SEED_ALLOW_RERUN=1` for Monday. That flag is an
emergency only; it still never writes to Ninox and still skips existing
truck numbers.

Do not run `npm run db:seed` against production. That demo upsert overwrites
CTC `905` / `922` / `968`.
