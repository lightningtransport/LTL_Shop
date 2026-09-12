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

Admin Work Order detail already used the CompactEmpty visual for in-card
slots; the helper now lives in `ui.tsx` so Yard and Admin share it.

### Rule going forward

1. Page / section empty → `EmptyState`.
2. In-card or Kanban-column empty → `CompactEmpty`.
3. Fetch failure → `LoadFailure` (Retry required).
4. Missing capability on an otherwise valid route → `EmptyState` with a
   destination, not a skeleton.
5. Do not invent a third dashed style.

## Access and permission chrome

- Catalog remains a read-only view (`catalogDescription`). There is no
  Catalog write CTA. Leave that copy.
- Work Order **list** stays a read-only table/list. `New Work Order` is a
  separate, capability-gated action (`work_orders.manage`). Do not stamp
  the list “writable.”
- Work Order **detail** is a Manager/Admin operational surface. Do not label
  it `Read only` while mutation controls render. Use the Shop Admin eyebrow.
  Mechanic, History, and Catalog details that truly cannot mutate may still
  show a `Read only` badge.

## Loading that must end

A `PageSkeleton` is only legal while `sessionLoading` or the first authorized
fetch is in flight. If the session is ready and the user cannot use the
route, show `EmptyState` or `LoadFailure`. Redirects may still run; the
visible exit must exist before navigation finishes.
