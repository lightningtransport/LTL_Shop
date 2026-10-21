# Components

**Classification:** CURRENT STATE · **Updated:** 2026-10-21 (LTR-273: shared feature components up to D54; TARGET gaps reviewed)
**Source:** `apps/web/src/components/ui.tsx`,
`apps/web/src/components/admin-shell.tsx`,
`apps/web/src/components/app-frame.tsx`

All new screens must reuse these exports. Do not copy prototype CSS.

## `ui.tsx` primitives

| Export | CURRENT use |
|---|---|
| `Button`, `buttonVariants` | CVA variants (`buttonVariants` styles a link as a button) `default`, `secondary`, `outline`, `ghost`, `destructive`, with one disabled look for all of them (muted fill and text, AA in both themes; LTR-169); sizes `default`, `sm`, `lg`, `icon`; `asChild` Slot. Touch / mobile controls stay `min-h-11` (44px). Desktop chrome may use `sm`. Do not use deprecated `.btn-*` classes |
| `Input` | Text fields (`.field`) |
| `Textarea` | Notes and reasons |
| `Label` | Programmatically associated labels |
| `Select` | Native `<select>` with Lucide chevron |
| `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter` | Grouped content. Never put a Card (or any bordered box) inside another Card; split it with `SectionBlock` or dividers (LTR-168). `CardDescription` is one line at most, or left out when the title says it |
| `DataTable` | The Admin list table (LTR-169): a real table from `md`; on phones each row is a card with the `primary` column as its title and the rest as labeled fields. One DOM with explicit ARIA roles. `hideOnMobile` leaves secondary columns out of the card |
| `AdminFilterToolbar` | Search + filters for Admin lists (LTR-169); see the composition rules below |
| `CollapsibleSection` | A folded section with one surface: the title is an `h2` inside the summary, optional one-line description, chevron. Use it for context the user does not act on (summaries, truck data, history, audit, rare actions); it starts closed |
| `SectionBlock` | One block inside a `Card` or `CollapsibleSection`: `h3.group-title`, optional description, content; blocks are separated by `divide-y` on the parent |
| `InlineAlert` | Assertive inline error |
| `Badge` | Single chip primitive. Variants `default`, `secondary`, `outline`, `destructive`, `success`, `warning`. Status / priority / phase chips use this only — no ad-hoc `<span>` chips. 12px semibold, sentence case (LTR-166) |
| `Dialog`, `DialogTrigger`, `DialogClose`, `DialogContent`, `DialogTitle`, `DialogDescription` | Radix dialog (sheet-like on mobile, centered on `sm+`) |
| `MultiSelect` | Accessible checkbox multi-select dialog |
| `Modal` | Focus-managed dialog wrapper used by mechanic flows |
| `PriorityBadge` | `Badge` wrapper. Variant from `priorityVariant` (`low=secondary`, `normal=outline`, `high=warning`, `critical=destructive`). Always pass a catalog label (never raw / UPPERCASE enum) |
| `WorkOrderStatusBadge` | `Badge` wrapper. `created=outline`, `in_progress=default`, `waiting_paused=warning`, `completed=success`, `cancelled=secondary` |
| `JobStatusBadge` | `Badge` wrapper. `to_do=outline`, `completed=success`, `cancelled=secondary` |
| `PhaseBadge` | `Badge` wrapper. Color by `ReadinessPhase` only (`needs_evaluation=warning`, mid-gates=`outline`, `ready_for_approval=warning`, `ready_to_go=success`). Blockers are text/icon, not chip color |
| `AppHeaderActions` | The profile button (LTR-167): 44px round initials; its menu holds the full name, email, Language (English / Español), Theme (Light / Dark / Auto), and Sign out as an outline action at the end. Language and theme are not header buttons |
| `HomeTopBar` | Mechanic header (`.app-topbar`): logo + profile button, sticky, 56px row like the Admin header; its background covers the status bar in the installed app |
| `WorkspaceNav` | Standard / PM / Back to Shop Admin |
| `AuthBrandHeader` | Login / access-denied brand block |
| `PageHeader` | The one page header (LTR-166): `.page-title`, optional subtitle, meta, badges, actions, and a mechanic icon back button (`backHref`). No eyebrow, no outer margin |
| `AdminBackLink` | Labeled back navigation with icon and 44px target. Detail screens (Work Order, Truck) use the breadcrumb instead (Stage 8) |
| `SectionCard`, `CountChip` | Stage 8 (mockups): a card with a header row (`h2` 16px semibold, optional count chip, an action on the right) and full-bleed content. Jobs, Notes, Work Plan, Truck, Priority, Repair history, the Dashboard queue |
| `DialogActions` | Stage 8: the dialog footer — "Back" and the confirmation, `flex-col-reverse` on phones, right-aligned from `sm`, buttons not stretched |
| `Modal` `description` | Stage 8: one line under the title, in the dialog header |
| `Badge` `dot` | Stage 8: a colored dot before the label (status chips). Tinted variants: `border-x/40 bg-x/10 text-x`; `warning` is amber |

## Stage 8 components (mockup fidelity, 2026-10-06)

| File | Use |
|---|---|
| `admin-breadcrumb.tsx` | `useAdminBreadcrumb([{ label, href }, { label }])`: a page names itself in the top bar ("Work Orders › WO-010"). Phones show only the parent, as a back link ("‹ T-102") |
| `responsive-menu.tsx` | `ResponsiveMenu`: every "…" menu. A dropdown on the card color with a header label, icons and dividers on desktop; a bottom sheet with a grab handle on phones. Items may be links |
| `mechanic-avatar.tsx` | `MechanicAvatar` / `MechanicAvatarStack`: initials in the mechanic's own tone (`lib/mechanic-tone.ts`, a hash of the id); decorative, the name is always next to it or in a label |
| `next-step-callout.tsx` | `NextStepCallout`: the Next step as one box — tone (`warning`, `primary`, `success`, `muted`, `danger`), icon tile, eyebrow, title, sub line, action on the right, optional footer. Work Order (`work-order-next-step.tsx`) and Truck (`admin-truck-next-step.tsx`) map the API's step to it |
| `work-order-metrics.tsx` | The Work Order strip: progress with a split bar (done, blocked, external), labor, waiting, age, mechanics; one compact card on phones |
| `mechanic-picker.tsx` | Search list of mechanics with avatars; popover on desktop, bottom sheet on phones; "Unassign" last |
| `side-sheet.tsx` | Add work: a 460px panel on the right; a 92vh bottom sheet on phones; the form brings its own sticky footer |

## Shared feature components (up to D54, 2026-10-21)

Reused across screens; use them instead of building a new one.

| File | Use |
|---|---|
| `kanban.tsx` | `KanbanBoard` / lanes (D33): Trello-like lists of 18 rem side by side with sideways scroll and drag-to-pan (LTR-227); on phones a foldable list per column, no sideways scroll. `fit` (D53, the Full screen tab for the TV): lists share the width with no scroll; a list whose cards don't fit gets `data-compact` and cards restyle with `group-data-[compact=true]/lane:` |
| `admin-yard-samsara-counters.tsx` | `YardSamsaraCounters` (D51): In shop / In yard without a Work Order above the Shop board; each opens Trucks with that filter |
| `admin-add-from-samsara.tsx` | `AddFromSamsaraDialog` (D50): creates and connects a truck Dispatch names but the app lacks |
| `return-to-service-dialog.tsx` | `ReturnToServiceDialog` (D7): confirm with optional reason, same on Dashboard, Yard, Truck; also for "Left the yard · Confirm Return to Service" (D52) |
| `close-work-order-dialog.tsx` | `CloseWorkOrderDialog`: closing confirms, the same on Truck, Work Order and Dashboard |
| `truck-stepper.tsx` | The steps to leave the shop as colored pills with chevrons (`STEP_TONE`, `TruckStepIcon`) |
| `action-toast.tsx` | `useActionToast` / `ActionToastProvider`: neutral toast with a colored icon and optional Undo (LTR-218); rises above bottom bars via `--toast-lift` |
| `offline-strip.tsx` | `OfflineStrip`: one no-connection notice on every field-role screen (phone or tablet) |
| `open-work-order-tag.tsx` | `OpenWorkOrderTag`: a search result says the truck already has an open WO |
| `mechanic-tabs.tsx` | `MechanicTabs`: My work · Trucks · Completed; at the bottom on phones (D-MG1), on top from `sm` |
| `team-queue-card.tsx` | `TeamQueueCard` (D28): unowned Jobs of my steps, Take to make one mine |
| `admin-job-tires-dialog.tsx` | `JobTiresDialog` (D45): confirm the tires a Tires Job needs; the Job shows which tire and why (D54) |
| `admin-work-order-item.tsx` | `AdminWorkOrderItem`, with a `compact` variant for lists inside a card |

## Loading, empty, failure (see `patterns.md`)

| Export | CURRENT use |
|---|---|
| `PageSkeleton` | Full-screen wait (`role="status"`) |
| `CardListSkeleton` | Card-shaped pulse list |
| `LoadFailure` | Section/page error with required Retry |
| `EmptyState` | Page or section empty (large dashed box) |
| `CompactEmpty` | In-card or in-column empty (small dashed box) |

## Shells

| File | CURRENT use |
|---|---|
| `apps/web/src/components/app-frame.tsx` | Mechanic/auth: `<main class="app-shell">`. Admin: unscoped `#main-content` wrapper so `AdminShell` owns layout |
| `apps/web/src/components/admin-shell.tsx` | Stage 8: full-height sidebar with the brand on top and the user at the bottom; top bar with the breadcrumb and the profile button; mobile nav in a sheet |

Feature screens (dashboard, Yard board, Work Order detail, catalog) compose
these primitives. They are not a second component library.

## Admin composition rules

- Every page has one `.page-title` (`PageHeader` on lists; the detail screens, the Dashboard and the Yard build their header from the mockups in a `<header>`); no eyebrow.
- Detail screens name themselves with `useAdminBreadcrumb`; the breadcrumb is the way back (Stage 8). `AdminBackLink` stays for screens without one.
- "…" menus use `ResponsiveMenu`; a section uses `SectionCard`; the Next step uses `NextStepCallout` (Stage 8).
- Primary and filter actions use `Button`; labels remain on one line. Action groups wrap as a group at narrow widths rather than allowing individual buttons to become two-line controls.
- Lists filter through `AdminFilterToolbar` (LTR-169): a search field; extra filters inline from `md` and, on phones, behind a "Filters" button with the active count that opens a sheet with Clear / Apply. Search-only lists keep Apply next to the field. Work Orders follows the same shape with its own fields. The Yard has only search and quick chips (Stage 8, owner decision); its URL still accepts the other filters.
- Lists render through `DataTable` (LTR-169): order columns by importance, mark the title column `primary`, and put secondary data last with `hideOnMobile`. Never a horizontally scrolling table on phones.
- A disabled button shows why, next to it or under the form (LTR-169), unless the reason is on screen already.
- For list metadata, use a left column with `min-w-0 flex-1` and a right metadata column with `shrink-0 text-right`. Do not use an unbounded `justify-between` row with wrapping content.

## TARGET gaps (Master PRD §33 only)

The Master PRD lists primitives that are **not** standalone `ui.tsx` exports
today. Marked TARGET so nobody documents them as existing:

| PRD name | CURRENT substitute | TARGET |
|---|---|---|
| Tabs | Hand-written `role="tablist"` in `admin-yard-operations.tsx` (Shop / Dispatch) and `admin-custom-jobs-review.tsx` | Shared Tabs |
| Sheet | `DialogContent` and `side-sheet.tsx` are bottom sheets on small screens | Dedicated Sheet |
| Dropdown | Done: `ResponsiveMenu` uses Radix `DropdownMenu` on desktop | — |
| Skeleton | `PageSkeleton` / `CardListSkeleton` | Already covered; no extra kit |

Do not build those TARGET primitives in a UI-only pass unless a queue task
asks for them.

When a task does, `apps/web/components.json` configures the shadcn CLI for this
Tailwind 3 setup. Run `npx shadcn@2.3.0 add <name>` from `apps/web` (newer CLI
versions target Tailwind 4); pick `--legacy-peer-deps` at the React 19 prompt.
Generated files land in `src/components/ui/` and import `@radix-ui/react-*`;
switch them to the `radix-ui` package the app already uses, and apply the type
scale above (no uppercase, nothing under 12px) before committing.
