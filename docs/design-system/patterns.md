# Patterns

**Classification:** CURRENT STATE · **Updated:** 2026-10-21 (LTR-273: Location vs Presence after D49; action notices; TV board; phone and tablet)
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

## Counts with a noun (DM3, LTR-204)

A number followed by what it counts ("3 parts", "1 open Work Order") goes
through `adminCountLabel(count, messages.xOne, messages.xMany)` from
`apps/web/src/lib/admin-messages.ts`, with both forms in the EN and ES
catalogs (`pcLinesCountOne` / `pcLinesCount`, `truckMechanicsOne` /
`truckMechanicsMany`…). Never `locale === 'es'` or an `s` appended in a
component: "1 parts", "1 lines" and "1 open Work Orders" came from a single
`{count}` template.

## Location vs Presence (LTR-13, changed by D49)

Since D49 Presence comes from Samsara geofences: "In yard · since {time}" when
Samsara sees the truck inside one of our yard geofences, "In shop" when it is
also on an open Work Order. Without a Samsara reading, nothing is shown (never
`UNKNOWN`, never invented). The address typed in Dispatch (`location`) is a
different thing and never decides "In yard". Do not rename Presence → Ubicación.

| Field | CURRENT display | Do not |
|---|---|---|
| `location` / `locationUpdatedOn` | “Last reported location” / “Ubicación reportada”; in Dispatch "Dispatch: {location}" when it disagrees with Samsara | Use it to say "in yard" |
| Samsara presence (D49) | “In yard · since {time}” / “En la yard · desde {hora}”, “In shop” / “En el shop”; the city when outside | Presence UNKNOWN chips, “Presencia desconocida” rows |

Mechanic surfaces already show location only. Keep that. Copy catalogs live in
`apps/web/src/lib/admin-messages.ts` and `apps/web/src/lib/locale-context.tsx`.

## Notices that ask for an action (LTR-261, D51, D52)

When the app sees something the Manager must act on, it says what happened and
puts the action right there. It never acts alone.

- **Shape:** what happened + since when + one button. Examples: "Arrived · Needs a Work Order" · "In yard · since 9:00" · **Create WO**; "Left the yard 3:10 PM · Confirm Return to Service".
- **Order:** in the Dashboard queue and in Dispatch, what needs action goes first; done items (Left) go last.
- **Same words everywhere:** the next step text is shared by Dashboard, Truck, Work Order, Trucks and Yard (`nextStep` from the API).
- **Long lists:** show 5 and a "See all N in Trucks" link to the filtered list.
- **Confirm what moves a truck:** Return to Service and Close Work Order always open their dialog.

## Board on a TV (D53)

A screen nobody touches (the shop TV) must fit without scrolling: the Full
screen view (`?display=board`) splits the width among the columns, turns a
column that does not fit into compact cards and loads every truck (no "Load
more"). The in-app Yard keeps scrolling (D33). Use `KanbanBoard fit` for that.

## Phone and tablet (PWA, D54)

Mechanics install the app on their phone or their tablet, so every mechanic
and Safety screen is checked on both: one column on the phone, the full width
from 768px with `.app-shell-wide` and `.card-grid`, no empty side bands, no
half rows, no sideways scroll, portrait and landscape. Check with the
`mobile-ui-check` skill (iPhone WebKit, Android Chromium) and the tablet walk
before shipping a field screen.

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

## Phone keyboard (LTR-234)

The on-screen keyboard must never cover the field being typed in, nor the button that saves it.

- **`<KeyboardInset />`** is mounted once in `app/layout.tsx`. It reads `visualViewport` and sets two things:
  - `--keyboard-inset`: the pixels the keyboard covers, 0 without it.
  - `html[data-keyboard-open]`.
- **Android Chrome** resizes the page itself (`interactive-widget=resizes-content` in `viewport`), so the inset stays 0 there.
- **Bottom sheets** carry `data-sheet`: `DialogContent`/`Modal`, `SideSheet`, `ResponsiveMenu` and `mechanic-picker`.
  - On phones they stand on the keyboard (`bottom: var(--keyboard-inset)`) and shrink to what is left.
  - Their content scrolls; a sticky footer (`StickyFormFooter`, `data-sheet-footer`) stays visible.
  - A centered dialog (`data-sheet-center`) and a side panel (`data-sheet-side`) do the same on tablets.
- **Fixed bottom bars** carry `data-hide-on-keyboard`, or are tab bars with `data-bottom-tabs`. They hide while the keyboard is open, so they never sit over a field.
  - A bar that holds its own input must **not** carry it.
- **Focus brings the field into view:** `scrollIntoView({ block: 'nearest' })` once the keyboard has opened.
- **Toasts** rise above the keyboard.
- **New screens:** any new bottom sheet uses the shared primitives (or `data-sheet`), and any new `fixed bottom-0` bar gets `data-hide-on-keyboard`.
- **A sheet that steps through records** (the tire sheet) stays open and swaps its body, so the keyboard does not close and reopen.
- **Tests:** `e2e/mobile-keyboard.spec.ts` simulates the keyboard with a stubbed `visualViewport`. It is no replacement for checking on a real phone.

