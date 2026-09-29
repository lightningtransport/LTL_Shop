# Components

**Classification:** CURRENT STATE
**Source:** `apps/web/src/components/ui.tsx`,
`apps/web/src/components/admin-shell.tsx`,
`apps/web/src/components/app-frame.tsx`

All new screens must reuse these exports. Do not copy prototype CSS.

## `ui.tsx` primitives

| Export | CURRENT use |
|---|---|
| `Button` | CVA variants `default`, `secondary`, `outline`, `ghost`, `destructive`; sizes `default`, `sm`, `lg`, `icon`; `asChild` Slot. Touch / mobile controls stay `min-h-11` (44px). Desktop chrome may use `sm`. Do not use deprecated `.btn-*` classes |
| `Input` | Text fields (`.field`) |
| `Textarea` | Notes and reasons |
| `Label` | Programmatically associated labels |
| `Select` | Native `<select>` with Lucide chevron |
| `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter` | Grouped content. Never put a Card (or any bordered box) inside another Card; split it with `SectionBlock` or dividers (LTR-168). `CardDescription` is one line at most, or left out when the title says it |
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
| `AdminBackLink` | Consistent labeled back navigation with icon and 44px target |

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
| `apps/web/src/components/admin-shell.tsx` | Desktop sidebar + mobile nav grid; locale switcher; 44px nav buttons |

Feature screens (dashboard, Yard board, Work Order detail, catalog) compose
these primitives. They are not a second component library.

## Admin composition rules

- Every page uses `PageHeader`; do not hand-roll a second title hierarchy or add an eyebrow.
- Use `AdminBackLink` for labeled back navigation. Keep the icon, label, and target area together.
- Primary and filter actions use `Button`; labels remain on one line. Action groups wrap as a group at narrow widths rather than allowing individual buttons to become two-line controls.
- Search and filter controls live in a bordered surface with consistent padding. Simple forms may omit the mobile modal, but they must preserve the same control heights and action alignment.
- For list metadata, use a left column with `min-w-0 flex-1` and a right metadata column with `shrink-0 text-right`. Do not use an unbounded `justify-between` row with wrapping content.

## TARGET gaps (Master PRD §33 only)

The Master PRD lists primitives that are **not** standalone `ui.tsx` exports
today. Marked TARGET so nobody documents them as existing:

| PRD name | CURRENT substitute | TARGET |
|---|---|---|
| Table | Ad-hoc `<table>` in Admin list/catalog | Shared Table primitive |
| Tabs | Separate routes or view toggle buttons (Yard Board/List) | Shared Tabs |
| Sheet | `DialogContent` is bottom-sheet on small screens | Dedicated Sheet |
| Dropdown | Profile and MultiSelect use Dialog, not a menu | Shared Dropdown |
| Skeleton | `PageSkeleton` / `CardListSkeleton` | Already covered; no extra kit |

Do not build those TARGET primitives in a UI-only pass unless a queue task
asks for them.

When a task does, `apps/web/components.json` configures the shadcn CLI for this
Tailwind 3 setup. Run `npx shadcn@2.3.0 add <name>` from `apps/web` (newer CLI
versions target Tailwind 4); pick `--legacy-peer-deps` at the React 19 prompt.
Generated files land in `src/components/ui/` and import `@radix-ui/react-*`;
switch them to the `radix-ui` package the app already uses, and apply the type
scale above (no uppercase, nothing under 12px) before committing.
