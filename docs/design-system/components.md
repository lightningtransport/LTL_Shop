# Components

**Classification:** CURRENT STATE
**Source:** `apps/web/src/components/ui/`,
`apps/web/src/components/admin-shell.tsx`,
`apps/web/src/components/app-frame.tsx`

All new screens must reuse these exports. Do not copy prototype CSS.

## Official primitives and product compositions

Primitive source files live in `apps/web/src/components/ui/` and are imported
from their direct `@/components/ui/*` modules. Product-level compositions live
in `@/components/ui/composites`; that module does not reexport primitives.
There is no compatibility barrel.

| Export | CURRENT use |
|---|---|
| `Button` | CVA variants `default`, `secondary`, `outline`, `ghost`, `destructive`; sizes `default`, `sm`, `lg`, `icon`; `asChild` Slot. Touch / mobile controls stay `min-h-11` (44px). Desktop chrome may use `sm`. Do not use deprecated `.btn-*` classes |
| `Input` | Text fields with the existing 44px branded control treatment |
| `Textarea` | Notes and reasons |
| `Label` | Programmatically associated labels |
| `NativeSelect` | Native `<select>` with Lucide chevron; preserve the mobile picker |
| `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter` | Grouped content; preserve full semantic composition when a title or actions exist |
| `InlineAlert` | Assertive inline error |
| `Badge` | Single chip primitive. Variants `default`, `secondary`, `outline`, `destructive`, `success`, `warning`. Status / priority / phase chips use this only — no ad-hoc `<span>` chips |
| `Dialog`, `DialogTrigger`, `DialogClose`, `DialogContent`, `DialogTitle`, `DialogDescription` | Radix dialog (sheet-like on mobile, centered on `sm+`) |
| `Sheet` | Navigation and filter surfaces that complement the current screen |
| `Table` | Semantic Admin data tables with a horizontal overflow boundary |
| `ScrollArea` | Bounded supplemental regions where a native page scroll is not sufficient |
| `Skeleton`, `Separator` | Loading geometry and visual separation |
| `MultiSelect` | Accessible checkbox multi-select dialog |
| `Modal` | Focus-managed dialog wrapper used by mechanic flows |
| `PriorityBadge` | `Badge` wrapper. Variant from `priorityVariant` (`low=secondary`, `normal=outline`, `high=warning`, `critical=destructive`). Always pass a catalog label (never raw / UPPERCASE enum) |
| `WorkOrderStatusBadge` | `Badge` wrapper. `created=outline`, `in_progress=default`, `waiting_paused=warning`, `completed=success`, `cancelled=secondary` |
| `JobStatusBadge` | `Badge` wrapper. `to_do=outline`, `completed=success`, `cancelled=secondary` |
| `PhaseBadge` | `Badge` wrapper. Color by `ReadinessPhase` only (`needs_evaluation=warning`, mid-gates=`outline`, `ready_for_approval=warning`, `ready_to_go=success`). Blockers are text/icon, not chip color |
| `ThemeToggle` | Light / dark |
| `AppHeaderActions` | Theme + profile |
| `HomeTopBar` | Mechanic logo, locale, profile |
| `WorkspaceNav` | Standard / PM / Back to Shop Admin |
| `AuthBrandHeader` | Login / access-denied brand block |
| `ScreenHeader` | Title, subtitle, optional back control |
| `AdminPageHeader` | Admin eyebrow, page title, description, metadata, badges, and actions |
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

- Every Admin page uses `AdminPageHeader`; do not hand-roll a second eyebrow/title hierarchy.
- Use `AdminBackLink` for labeled back navigation. Keep the icon, label, and target area together.
- Primary and filter actions use `Button`; labels remain on one line. Action groups wrap as a group at narrow widths rather than allowing individual buttons to become two-line controls.
- Search and filter controls live in a bordered surface with consistent padding. Simple forms may omit the mobile modal, but they must preserve the same control heights and action alignment.
- For list metadata, use a left column with `min-w-0 flex-1` and a right metadata column with `shrink-0 text-right`. Do not use an unbounded `justify-between` row with wrapping content.

## Adding or updating a primitive

Run the shadcn CLI from `apps/web`. Inspect `shadcn add --dry-run` and
`shadcn diff` before editing, then preserve the documented brand tokens and
44px mobile targets. Add a render/variant test and extend the browser
accessibility baseline when the component changes interaction or layout.
