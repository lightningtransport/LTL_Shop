# Patterns

**Classification:** CURRENT STATE
**Source:** `apps/web/src/components/ui.tsx` plus call sites in
`apps/web/src/app` and `apps/web/src/components`

Use this matrix before adding a new wait, error, or empty treatment.

## State matrix

| Situation | Use | Do not use |
|---|---|---|
| First paint / session restore / authorized route still resolving | `PageSkeleton` | Infinite pulse with no exit |
| List of cards still fetching | `CardListSkeleton` inside the list region | Full-page skeleton if the chrome is already up |
| Request failed and retry is possible | `LoadFailure` with `onRetry` | Red inline `<p role="alert">` without Retry |
| Authorized page or section has no rows | `EmptyState` | Plain paragraph |
| In-card or in-column slot is empty while siblings have content | `CompactEmpty` | Page-sized `EmptyState` that blows the column |
| User is signed in but lacks this workspace | `EmptyState` + link to `defaultWorkspacePath` (and redirect) | Skeleton that never ends |

## Screen chrome and responsive actions

- Every screen uses `PageHeader` for the title, description, metadata, badges,
  and header actions. There is no eyebrow above the title (LTR-166);
  individual pages must not introduce a second title scale or casing.
- Use `AdminBackLink` for labeled Admin back navigation. The control keeps a
  44px target and a non-wrapping label.
- Filter forms use a bordered surface and keep Clear / Apply as a `shrink-0`
  action group. On narrow screens the group may stack, but an individual
  button must not wrap its label.
- Rows that combine primary content and secondary metadata use
  `min-w-0 flex-1` for the primary column and `shrink-0 text-right` for the
  metadata column. This keeps mileage, dates, and statuses intentional on
  both desktop and mobile.

## CURRENT call sites

- Mechanic Home (`apps/web/src/app/page.tsx`, `/mechanic/standard`,
  `/mechanic/pm`): session skeleton, `LoadFailure` for session/profile/list
  errors, `EmptyState` for empty Active/Paused and for missing workspace
  access.
- Work Order detail (`apps/web/src/app/work-orders/[id]/detail-client.tsx`):
  `PageSkeleton` / `LoadFailure` / `EmptyState` for job groups.
- PM service card (`apps/web/src/components/pm-service-card.tsx`):
  `LoadFailure` + Retry for `/pm` read failures. Save errors stay inline
  next to the draft (retry on that save).
- Admin lists and details: `PageSkeleton` while SWR is loading;
  `LoadFailure` on fetch failure; `EmptyState` when a whole list is empty.

## CompactEmpty vs EmptyState

`EmptyState` is the large, centered, dashed region for “this whole list or
page has nothing.”

`CompactEmpty` is the small dashed slot for a quiet absence inside a card
(notes, pause history, activity) or a Yard board column.

### Recorded inconsistency (fixed in this inventory)

Yard Operations board columns used a one-off
`<p class="rounded-lg border border-dashed …">` with the filtered-list copy
(“No Trucks match these filters.”). That is now `CompactEmpty` +
`noTrucksInPhase`.

Admin Work Order detail, Truck detail (current work / readiness empty /
blockers / history), and Yard board columns use `CompactEmpty` for in-card
slots. The helper lives in `ui.tsx`.

### Rule going forward

1. Page / section empty → `EmptyState`.
2. In-card or Kanban-column empty → `CompactEmpty`.
3. Fetch failure → `LoadFailure` (Retry required).
4. Missing capability on an otherwise valid route → `EmptyState` with a
   destination, not a skeleton.
5. Do not invent a third dashed style.

## Status, priority, and phase chips (LTR-23)

Use the helpers in `apps/web/src/lib/status-chips.ts` plus the `Badge`
wrappers in `ui.tsx`. Do **not** call `humanize()` for status, priority,
pause reason, or activity event chips. Filter `<option>` labels use the
same catalog keys as the chips (singular Created/Creado … Paused/Pausado).

Activity Log lines are `eventType` → catalog label + timestamp + actor.
Never render `relevantValue` / `newValue` JSON to the operator.

## Location vs Presence (LTR-13)

CURRENT UI hides Yard Presence (`UNKNOWN`, “Presence unknown”,
“Presencia desconocida”) on Admin Truck detail and Yard cards/board stubs.
Show only last reported location (`location` / `locationUpdatedOn` from the
Truck DTO). Do not rename Presence → Ubicación: `location` ≠ Presence.

| Field | CURRENT display | Do not |
|---|---|---|
| `location` / `locationUpdatedOn` | “Last reported location” / “Ubicación reportada” | “in yard”, “en el yard”, Presence |
| Yard Presence | Hidden until a real geofence exists (TARGET V3) | Presence UNKNOWN chips, “Presencia desconocida” rows |

Mechanic surfaces already show location only. Keep that. Copy catalogs live in
`apps/web/src/lib/admin-messages.ts` and `apps/web/src/lib/locale-context.tsx`.

## Access and permission chrome

- Catalog remains a read-only view (`catalogDescription`). There is no
  Catalog write CTA. Leave that copy.
- Work Order **list** stays a read-only table/list. `New Work Order` is a
  separate, capability-gated action (`work_orders.manage`). Do not stamp
  the list “writable.”
- Work Order **detail** is a Manager/Admin operational surface. Do not label
  it `Read only` while mutation controls render.
  Mechanic, History, and Catalog details that truly cannot mutate may still
  show a `Read only` badge.

## Loading that must end

A `PageSkeleton` is only legal while `sessionLoading` or the first authorized
fetch is in flight. If the session is ready and the user cannot use the
route, show `EmptyState` or `LoadFailure`. Redirects may still run; the
visible exit must exist before navigation finishes.
