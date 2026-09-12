# Components

**Classification:** CURRENT STATE
**Source:** `apps/web/src/components/ui.tsx`,
`apps/web/src/components/admin-shell.tsx`,
`apps/web/src/components/app-frame.tsx`

All new screens must reuse these exports. Do not copy prototype CSS.

## `ui.tsx` primitives

| Export | CURRENT use |
|---|---|
| `Button` | CVA variants `default`, `secondary`, `outline`, `ghost`, `destructive`; sizes `default`, `sm`, `lg`, `icon`; `asChild` Slot |
| `Input` | Text fields (`.field`) |
| `Textarea` | Notes and reasons |
| `Label` | Programmatically associated labels |
| `Select` | Native `<select>` with Lucide chevron |
| `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter` | Grouped content |
| `InlineAlert` | Assertive inline error |
| `Badge` | Variants `default`, `secondary`, `outline`, `destructive`, `success`, `warning` |
| `Dialog`, `DialogTrigger`, `DialogClose`, `DialogContent`, `DialogTitle`, `DialogDescription` | Radix dialog (sheet-like on mobile, centered on `sm+`) |
| `MultiSelect` | Accessible checkbox multi-select dialog |
| `Modal` | Focus-managed dialog wrapper used by mechanic flows |
| `PriorityBadge` | Work Order priority chip |
| `ThemeToggle` | Light / dark |
| `AppHeaderActions` | Theme + profile |
| `HomeTopBar` | Mechanic logo, locale, profile |
| `WorkspaceNav` | Standard / PM / Back to Shop Admin |
| `AuthBrandHeader` | Login / access-denied brand block |
| `ScreenHeader` | Title, subtitle, optional back control |

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
