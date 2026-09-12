# Truck identity and mileage — CURRENT

**Classification:** CURRENT STATE / AUDIT
**Audited commit:** latest `main` plus this Prisma/DTO display alignment
**Date:** 2026-09-12
**Owner:** Product (Cristian) for keep-working constraint; Engineering for
path facts
**Status:** CURRENT. Shop-owned Postgres is the live path. Samsara / McLeod /
Dispatch APIs are **not** called. Do not implement those integrations from
this document.

Cristian constraint: **keep truck search and truck information working.**
He sees miles, owners, VIN, and last-reported address in the UI. Miles and
owners are Shop columns. VIN / location / last-connected are also Shop
Postgres columns that were already populated (historically Samsara-fed).
They are **display-only** and are **not** Yard Presence.

---

## 1. One-page CURRENT map

1. **Source of truth** is `public.trucks` in Supabase PostgreSQL
   (`schema.prisma` model `Truck`). The UI never calls Samsara, McLeod,
   Dispatch, or Ninox for identity or miles.
2. **Search is Shop-local.** Mechanic pickers load `GET /api/trucks` and
   filter `truckNumber` in the browser. Admin Trucks / Admin New WO search
   `GET /api/admin/trucks?search=`. Yard searches
   `GET /api/admin/yard-operations?search=`. Search ranking is unchanged
   (truck number / make / model / company as before). Location is
   **display-only**.
3. **Truck Information** is `toTruckDto()` from those same columns:
   make, model, year, mileage, company, owner, plus read-only `vin`,
   `location` (from `samsara_truck_location`), and `locationUpdatedOn`
   (from `samsara_last_connected_date`). Miles, owners, VIN, and last
   reported location appear on mechanic create/detail/history and Admin
   Truck Detail / Admin WO Detail — not on the Admin Trucks list or Yard
   cards.
4. **Who writes identity today:** there is **no Admin truck editor**.
   Make/model/year/company/owner/VIN/location are not writable through the
   running Shop API. Production rows were loaded historically (159 of 162
   have `ninox_external_id`). Local `prisma/seed.ts` upserts three demo
   numbers only.
5. **Who writes mileage today:** only **PM Work Order complete**, when
   saved observed mileage differs from `trucks.mileage`. That writes
   `trucks.mileage`, `truck_mileage_adjustments`, and Activity Log
   `truck_mileage_corrected`. Draft observed mileage lives on
   `pm_services` and does **not** move the truck until finish.
6. **V3 stays deferred.** Presence is always `UNKNOWN`. Incoming /
   Departures are unavailable. A stored address string must **never** be
   labeled “in yard” or used as Phase / Presence. Wiring Samsara or
   McLeod into search, miles, owners, or presence is out of scope until
   an approved V3-001 contract.

---

## 2. End-to-end surfaces

| UI | Route | API | What the user searches / sees |
|---|---|---|---|
| Mechanic / PM New WO picker | `/work-orders/new`, `/mechanic/standard/new`, `/mechanic/pm/new` (same page) | `GET /api/trucks` (full list, any authenticated Shop user) then client `rankTruckResults` | Search **truck number only** (strips `#`, prefix then contains, max 20). After select: Make / Model / Year / Mileage / Company / Owner / VIN / Last reported location / Last reported on from `TruckDto`. Then `GET /api/trucks/:id/open-work-order`. |
| Admin New WO picker | `/admin/work-orders/new` | `GET /api/admin/trucks?search=` (`admin.access`) | Server contains on **truckNumber, make, model, company**. Result shows `#number · make model`. Does **not** search owner, year, mileage, VIN, or location. |
| Admin Trucks list | `/admin/trucks` | same `GET /api/admin/trucks` | Same search. Table: number, year/model subtitle, operational status, make, company, open WO. **No miles, owner, VIN, or location.** |
| Yard board / list | `/admin/yard-operations` | `GET /api/admin/yard-operations?search=` | Contains on truckNumber, make, model, plus open-WO displayId / category / mechanic. **Not** owner, company, VIN, or location. Cards show number + year/make/model. Phase/blockers are **derived**; they do not store identity. Presence stays `UNKNOWN`. |
| Admin Truck Detail | `/admin/trucks/[id]` | `GET /api/admin/trucks/:id` (Yard detail) | Overview **does** show number, make, model, year, mileage, company, owner, VIN, last reported location, last reported on, plus derived operational status and `UNKNOWN` presence. |
| Admin WO Detail | `/admin/work-orders/[id]` | Admin WO detail (`truck: toTruckDto`) | Truck Details: number, make, model, year, mileage, company, owner, VIN, last reported location, last reported on. |
| Mechanic WO Detail | `/work-orders/[id]` | `GET /api/work-orders/:id` (`truck: toTruckDto`) | Truck Information panel: make, model, year, mileage, company, owner, VIN, last reported location, last reported on. |
| Mechanic / Admin repair history | `/trucks/[id]/history`; Admin Truck Detail history | `GET /api/trucks/:id/repair-history` and `GET /api/admin/trucks/:id/repair-history` | Header uses current `TruckDto` (including VIN / location). Per-item mileage is `pmService.observedMileage ?? trucks.mileage`. |
| Admin WO / History / Mechanic lists | various | WO summaries | Usually **truckNumber** (and sometimes make/model/year). Not a second identity store. |

`GET /api/trucks/search?q=` exists (`TrucksService.search`) and is covered
by unit tests. **No current web client calls it.** Keep `@Get('search')`
registered **before** `@Get(':id')` or `/search` will be parsed as an id.

DTO used everywhere identity is shown:

`id`, `truckNumber`, `make`, `model`, `year`, `mileage`, `company`, `owner`,
`vin`, `location`, `locationUpdatedOn`

(`toTruckDto` in `apps/api/src/trucks/trucks.service.ts`).
`ninoxExternalId` and `samsaraId` stay in the database and are **not**
sent to the UI.

Copy for the address field is **Last reported location / Ubicación
reportada**. It is a human address string (for example
“West Main Street, Woodville, OH, 43469”), not lat/lng, and it is not
yard presence.

---

## 3. Field ledger

| Field | DB column | Source of truth | Who writes it | When it updates |
|---|---|---|---|---|
| `truckNumber` | `trucks.truck_number` UNIQUE + indexed | Shop | Historical load / seed upsert. **No API writer.** | Search, WO create (`truckId`), and one-open-WO rules all key off this. Changing uniqueness or the number blanks pickers. |
| `make` | `trucks.make` | Shop | Historical load / seed. **No API writer.** | Shown in Truck Information; PM part fitment matches normalized make/model. |
| `model` | `trucks.model` | Shop | Same | Same. Cascadia-style fitment needs this string. |
| `year` | `trucks.year` | Shop | Same | Display only. Not searchable. |
| `mileage` | `trucks.mileage` nullable int | Shop current odometer | **PM complete only** in the running app (`work-orders.service.complete` and `admin.service` complete). Seed upsert can overwrite locally. | Draft: `pm_services.observed_mileage`. Finish: copy onto `trucks.mileage` if different; append `truck_mileage_adjustments`; log `truck_mileage_corrected`. History rows prefer that PM’s observed miles. There is **no** monotonic guard (production has recorded a decrease). |
| `company` | `trucks.company` | Shop | Historical load / seed. **No API writer.** | Display + Admin/Admin-create search. Production companies observed 2026-09-12: CTC, CDT, LTL, Lightning. |
| `owner` | `trucks.owner` | Shop (person/label string, not a User FK) | Historical load / seed. **No API writer.** | Display on Truck Information / Admin Detail. **Not searchable** on any current list. |
| `vin` | `trucks.vin` | Shop (historically Samsara-fed) | **No API writer.** Not mutated by Shop. | Display-only on Truck Information surfaces. 159/162 production rows populated (2026-09-12). |
| `location` | `trucks.samsara_truck_location` | Shop (historically Samsara-fed human address) | **No API writer.** Shop does not call Samsara. | Display-only as “Last reported location / Ubicación reportada”. **Not** lat/lng. **Not** Yard Presence. 158/162 populated; 38 share one Tampa/Orient Park address. |
| `locationUpdatedOn` | `trucks.samsara_last_connected_date` | Shop date column | **No API writer.** | Display-only ISO date (`YYYY-MM-DD`). 158/162 populated (example 2026-09-11). Does not change Presence. |
| `samsaraId` | `trucks.samsara_id` numeric | Shop | **No API writer.** | Prisma-only. 159/162 populated. **Omitted from `TruckDto`.** |
| `ninoxExternalId` | `trucks.ninox_external_id` | Import leftover | Not read or written by live adapters | Traceability only. Ninox client is a stub (`DATA_SOURCE=supabase`). |
| Operational status | latest `truck_service_status_events` | Shop events | Returned to Service (`in_service`) | Not identity. Unknown if no event. Off Duty has no mutation yet. |
| Presence | always `UNKNOWN` | none | nobody | Yard Phase 1. **Not** derived from `samsara_truck_location`. |

Production read (2026-09-12, Lightning Shop Supabase, read-only):
**162 trucks**; every row has make, model, year, mileage, company, and
owner; **159** have `ninox_external_id`, `samsara_id`, and `vin`; **158**
have `samsara_truck_location` and `samsara_last_connected_date`; **5**
`truck_mileage_adjustments` from PM complete. Three demo-shaped rows
(`9050`, `9220`, `9680`) have no Ninox id. Fleet numbers `905` / `922` /
`968` are **CTC** production rows, not the seed demo values.

Prisma models all four live identity-adjacent columns so a future
`prisma migrate` from an incomplete schema cannot casually `DROP` them.
The migration is additive (`ADD COLUMN IF NOT EXISTS`) and never rewrites
mileage/owner/company data.

---

## 4. Dead / misleading claims

Treat these as **not CURRENT** for search, miles, or presence:

| Claim | CURRENT fact |
|---|---|
| Samsara API supplies miles, live location, or search | Shop does **not** call Samsara. Miles stay Shop `trucks.mileage`. VIN / last-reported address / last-connected date are **already stored** on `public.trucks` and are display-only. Search is unchanged. |
| A stored address means the truck is in the yard | False. Presence is always Phase 1 `UNKNOWN`. Copy is “last reported location”, never “in yard”. |
| McLeod / Dispatch populate Incoming, Departures, or owners | Unavailable stubs on Yard list/detail. V3-001 is GATED. |
| Ninox is the live truck source | Adapter ping only (`apps/api/src/integrations/ninox`). `ninox_external_id` is leftover. |
| Admin Trucks search includes owner or location | Placeholder copy says “truck number, make, model, or company”. Owner, VIN, and location are **not** in `buildTruckWhere`. |
| `GET /api/trucks/search` is the mechanic picker | Unused by web. Picker uses the full list + local rank (see `ENGINEERING_PRACTICES.md` bounded reference data). |
| Historical P0 PRD “Ninox is P0 SoT for Trucks” | `docs/PRD_Lightning_Shop_Mechanic_P0.md` is HISTORICAL. Code + this audit win. |

---

## 5. What not to break

1. **Do not drop or null `owner` / `mileage` / `company` on `TruckDto` or
   `GET /api/trucks`.** Mechanic Truck Information would go blank even if
   Admin lists still render.
2. **Do not put `GET /api/trucks` behind `admin.access`.** PM/Standard
   pickers would 403.
3. **Do not filter the truck catalog by Yard Presence or derived Phase.**
   Presence is always `UNKNOWN`; that filter would hide the fleet.
4. **Do not run `prisma/seed.ts` against production.** Seed `upsert`s
   `905`, `968`, `922` with demo make/model/year/mileage/company/owner
   and would overwrite live CTC rows (including PM-updated miles).
5. **Do not add a second mileage writer** (Samsara poll, import overwrite,
   Admin silent PATCH) without an approved contract. PM complete +
   `truck_mileage_adjustments` is the only audited Shop write.
6. **Do not change `truck_number` uniqueness, rename the column, or
   require a telematics id for search.** Pickers and WO create use Shop
   `id` + `truckNumber`.
7. **Yard derivation / readiness mutations must not rewrite identity
   columns.** They lock the truck for assessment/WO races
   (`lockTruckMutation`); they should stay off make/owner/miles/VIN/
   location.
8. **Keep `ninox_external_id` and `samsara_id` until an approved
   cleanup.** Both are Prisma-modeled and omitted from `TruckDto`.
9. **Do not DROP `samsara_id`, `samsara_last_connected_date`,
   `samsara_truck_location`, or `vin`.** Production already has them.
   Migrations must stay additive (`IF NOT EXISTS`) and never rewrite
   mileage/owner/company.
10. **Do not label `samsara_truck_location` as yard / in-yard / presence.**
    Display it as last reported location only.

---

## 6. Queue note

V3-001 (Samsara / McLeod / Dispatch contracts) stays **GATED**. Any later
integration work must leave this CURRENT path green: Shop-owned
`trucks.*` identity, mechanic/Admin/Yard search as documented, PM
complete as the only app mileage writer, and last-reported address
remaining display-only (never Presence).
