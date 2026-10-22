# One-shot Ninox → Shop truck seed

**Classification:** ENGINEERING / LAUNCH
**Updated:** 2026-09-20
**Contract:** product owner 2026-09-20
**Writes:** Supabase `public.trucks` only
**Reads:** Ninox TrucksDB `E` once
**Never:** write Ninox; query Ninox after a completed run; import WO/jobs;
set Presence or Ready from Ninox

Shop Prisma `Truck` names are authority. Ninox only supplies values.
Runtime API stays on `DATA_SOURCE=supabase`. This is a CLI
(`prisma:seed-ninox-trucks`), not a live adapter.

## Upsert identity

Prefer **VIN + truckNumber**:

1. If `vin` (`E.CG`) is present and **exactly one** Shop row has that VIN,
   update that row.
2. Else match unique Shop `truckNumber` (`E.A`).
3. Else insert a new row keyed by `truckNumber`.
4. If the same VIN sits on two Shop rows and neither is this `truckNumber`,
   skip (ambiguous). Do not invent a merge.

`truckNumber` remains the only unique write key in Prisma.

## Must-have mappings

| Shop Prisma / DTO | Ninox value | Notes |
|---|---|---|
| `truckNumber` | `E.A` | Ops key. Skip the record if missing. |
| `vin` | `E.CG` | When present. |
| `make` | `E.DG` | When present. Read through `normalizeMakeModel` (LTR-113): a known make is spelled one way, "Mack Anthem" splits into Make + Model, and a model name in `E.DG` is read against the Model the truck already has. |
| `model` | from `E.DG` only | No Ninox Model field. Filled only when `E.DG` holds make and model together. |
| `year` | `E.IJ` | When present. |
| `licensePlate` | `E.HJ` | When present. Shop name is `licensePlate`, not `plate`. |
| `mileage` | `E.OF` | Odometer miles. |
| `samsaraTruckLocation` (DTO `location`) | `E.X1`, else text `E.AN` | Last-reported location. **Not** Presence. |
| `samsaraLastConnectedDate` (DTO `locationUpdatedOn`) | date-shaped `E.AN` / `E.X1` | Labels like `301 Yard` are not dates. |
| `company` | **unresolved** | No declared Ninox company field. `E.Y4` is insurance, not mapped here. |
| `owner` | `E.VF` | When present. |

## Must not

- Do **not** set Yard Presence / `IN_YARD` from `E.X1`. Presence stays
  `UNKNOWN` (see `docs/OPEN_ISSUES.md` §6).
- Do **not** sync `E.Y1` Shop Status or `E.TA` OutWork as board phases or Ready.
- `E.Y1` / `E.TA` / `E.T5` / `E.BM` are optional metadata only. `E.Y1` may
  land on `ninoxMechanicStatus`; `E.BM` may land on `samsaraId`. Neither is
  readiness authority. `E.TA` and `E.T5` are not written onto operational
  Shop columns.
- Do **not** import Work Order or job history.

## Already mapped vs still missing

**Mapped in code:** `E.A`, `E.CG`, `E.DG`, `E.IJ`, `E.HJ`, `E.OF`, `E.X1`,
`E.AN`, `E.VF`, plus optional `E.Y1` / `E.BM`.

**Missing (not invented):** Shop `model` field ID, Shop `company` field ID,
UC trailer, `locationUpdatedOn` unless `E.X1`/`E.AN` is date-shaped.

## How to run (once)

1. Apply Prisma migration `20260920020000_ninox_truck_seed` via `docs/reference/DEPLOY.md`.
2. Set server-only `NINOX_BASE_URL`, `NINOX_TOKEN`, `NINOX_TEAM_ID`,
   `NINOX_DATABASE_ID`.
3. Dry-run (reads Ninox, writes nothing):

```bash
npm run prisma:seed-ninox-trucks --workspace=@ltl-shop/api -- --dry-run
```

4. Upsert:

```bash
npm run prisma:seed-ninox-trucks --workspace=@ltl-shop/api
```

5. A completed `ninox_truck_seed_runs` row is the lock. Later runs do not
   query Ninox. Unset `NINOX_TOKEN`.
6. Do not run demo `db:seed` against production.

## Make / Model of trucks already saved (LTR-113)

The Ninox import, Samsara connect and the Shop's truck form all save Make / Model
through `normalizeMakeModel` (`packages/shared/src/vehicle.ts`). It turns swapped fields around, splits "Mack Anthem", spells each make one way and drops a make the Model repeats ("PETERBILT 579" → "579"). Since LTR-277 §4 it also reads a known misspelling as its make ("Kentworth" → Kenworth) and spells known models one way ("CASCADIA" → "Cascadia"); the script also fixes the parts' Fits and removes a Fit that becomes a repeat. For trucks saved
before that rule, one script lists what would change and writes only with `--apply`:

```bash
npm run prisma:normalize-truck-make-model --workspace=@ltl-shop/api
```

Against production, run it from GitHub → Actions → **Release safety** → Run workflow,
with **truck_make_model** = `list` first (writes nothing; the list is in the step log),
then `apply` with the owner's OK after reading the list. The workflow uses the
production secrets, so nobody copies the database password. A truck
the rule does not recognise (two makes, or an unknown make) stays as it is; the
Manager fixes it in Trucks → Edit.
