# Foundations

**Classification:** CURRENT STATE · **Updated:** 2026-10-21 (LTR-273: type scale matches the code, shadows, PWA safe areas, mechanic shells on phone and tablet)
**Source:** `apps/web/src/app/globals.css`, `apps/web/tailwind.config.js`,
`apps/web/src/app/layout.tsx`

Lightning Shop uses one OKLCH semantic theme (light + `.dark`) and Tailwind 3.
Do not add a second token set.

## Color tokens (`:root` / `.dark`)

Defined as CSS custom properties in `apps/web/src/app/globals.css`:

| Token | Role |
|---|---|
| `--background`, `--foreground` | Page canvas and body text |
| `--card`, `--card-foreground` | Cards / panels |
| `--popover`, `--popover-foreground` | Dialogs |
| `--primary`, `--primary-foreground` | Primary actions (LTL blue) |
| `--primary-text` | Blue text on a blue tint: `Badge default` ("In progress", "New", "Yours", "Ready to close"), selected chips (`border-primary bg-primary/15 text-primary-text`), stepper pills, a blue link on `hover:bg-accent`. Light `oklch(0.48 0.14 248)` (5.0:1 on `primary/15` over the card); dark = `--primary`. UX-2-002 (2026-10-15) |
| `--secondary`, `--secondary-foreground` | Secondary / success-leaning actions |
| `--muted`, `--muted-foreground` | Quiet surfaces and helper text |
| `--accent`, `--accent-foreground` | Hover / selected chrome |
| `--destructive`, `--destructive-foreground` | Danger fills (buttons, the critical badge) |
| `--destructive-text` | Danger text on the page, a card, or a `destructive/10` tint (`text-destructive-text`). Errors use this, never `text-destructive` |
| `--border` | Hairlines and separators (cards, table rows, chips). Not for controls |
| `--input` | Borders of controls: `.field` (Input, Select, Textarea), search labels, an unchecked `MultiSelect` box (`border-input`). Its own value, ≥ 3:1: light `oklch(0.64 0.02 256)`, dark `oklch(0.55 0.035 257)`. UX-2-001 (2026-10-15); before, it equaled `--border` (1.2:1) and nothing used it |
| `--ring` | Focus ring |
| `--success` | Positive status |
| `--warning`, `--warning-foreground`, `--warning-surface` | Caution banners (Yard Phase 1) |
| `--sunken` | A step below the card: table headers, folded groups (R6) |

Other `:root` tokens, not colors: `--shadow-2xs` … `--shadow-xl` (and `--shadow`), stronger in `.dark`; Tailwind `shadow-soft` is `var(--shadow-lg)`. Since Stage 8 cards and fields carry no shadow, so shadows are for floating things (toasts, menus). `--font-serif` exists only as an alias of `--font-sans`.

Tailwind maps these 1:1 in `apps/web/tailwind.config.js` (`background`,
`primary`, `destructive`, `warning-surface`, `sunken`, and so on). Each one
is `color-mix(in oklch, var(--x) calc(<alpha-value> * 100%), transparent)`, so
an opacity modifier works: `bg-primary/10`, `border-destructive/30`. Before R9
(2026-10-06) those classes produced no CSS.

In dark mode `--muted` (0.31) and `--accent` (0.33) sit above `--card` (0.2795),
so quiet surfaces and hovers show on cards (R6; they used to be the card color).

### Contrast (LTR-166)

Text meets WCAG AA (4.5:1; 3:1 at 24px, or 18.66px bold) in light and dark.
LTR-166 darkened the light `--muted-foreground` / `--shop-muted` (0.5544 → 0.5),
`--destructive` / `--shop-danger` (0.6368 → 0.55), `--success` / `--shop-success`
(0.57 → 0.48), and `--shop-accent` (0.5358 → 0.5), and added `--destructive-text`,
because `text-destructive` in dark mode measured 1.78:1. `--primary` is unchanged
(white on it is 5.1:1). Check a new pair with `npm run ui-audit` (see
`apps/web/e2e/ui-audit/README.md`).

### State → color role (UX-4-110, 2026-10-15)

Each state takes its role from `apps/web/src/lib/status-chips.ts` (or the screen's map that mirrors it), and
no state is told by color alone: there is always a word or an icon. What the code does today:

| State | Role → tokens | Sign besides the color |
|---|---|---|
| Created, To do, Cancelled, intermediate phases, Waiting for Safety, Inactive, Low / Normal | neutral → `outline` / `secondary` (`muted`, `muted-foreground`) | Text; empty circle for To do |
| In progress, External, Out of shop, Unassigned, "New", "Yours", "Proposed" | primary → `Badge default` (`bg-primary/10 text-primary-text`) | Text; icon where the screen has one (`Building2` for External) |
| **Ready to close** | primary → `Badge default` / stepper `ready` pill / `bg-primary/5` hint. Blue everywhere (UX-4-102, owner decision) | Text + `Flag` |
| Completed, Ready to Go, In service, tire OK | success → `text-success`, `bg-success/10` | Text; `Check` |
| Paused, Blocked, High priority, Leaving soon with work, Check engine / Warning, tire Watch, stale GPS, Needs evaluation, Ready for approval | warning → `warning-foreground` (light) / `warning` (dark) on `warning-surface` or `warning/10`; dots `bg-warning-foreground dark:bg-warning` | `OctagonPause` (Blocked), `Pause`, `CalendarClock`, `TriangleAlert`; tire `Eye` |
| Critical, STOP, missing required steps, tire Fix, errors | danger → `destructive-text` on `destructive/10–20`; dots and bars `bg-destructive-text` (the `destructive` fill is near black in dark, 1.46:1) | `OctagonAlert` / `CircleAlert` |
| Main action, link, selected filter or chip, focus | primary → `primary` (fills, links); `primary-text` on a primary tint | Links inside a sentence are always underlined (UX-2-006); `aria-pressed` on chips |

Not done yet (see `docs/ux-audit/responsive-color-a11y/04b-color-semantico.md`): an `info` role separate from
`primary` (UX-4-101), moving "your turn" states (Needs evaluation, Ready for approval) from warning to info
(UX-4-103), and the clock-running green (UX-4-104).

## Shop channel tokens

Older channel-only tokens (still used; the theme colors above also take an
opacity now). The same file defines
`--shop-bg`, `--shop-panel`, `--shop-border`, `--shop-accent`,
`--shop-accent-dark`, `--shop-muted`, `--shop-danger`, `--shop-success`.
Use them as `bg-shop-panel`, `text-shop-muted`, `border-shop-border`,
`text-shop-success`.

## Typography

| Token | CURRENT value |
|---|---|
| `--font-sans` / `font-body` | Inter via `--font-inter` (`layout.tsx`) |
| `font-display` | Same Inter family; used for titles |
| `--font-mono` / `font-mono` | JetBrains Mono |
| `--tracking-normal` | `-0.01em` on `body` |
### Type scale (LTR-166)

Six steps, defined in `globals.css` (`@layer components`). Use the class, not
ad-hoc size/weight combinations.

| Step | Class | Value | Use |
|---|---|---|---|
| Page title | `.page-title` | 24px semibold, 28px from `md` | The one `h1`, only through `PageHeader` |
| Section title | `.section-title` | 16px semibold | A page section (`CardTitle` uses it) |
| Card title | `.card-title` | 16px semibold | A card or list item heading |
| Group title | `.group-title` | 14px semibold | A group inside a card ("Notes", "Your Jobs") |
| Body | `text-sm` | 14px | Default text |
| Secondary | `text-sm text-muted-foreground` | 14px | Descriptions, helper text |
| Meta | `text-xs text-muted-foreground` | 12px | Timestamps, counts, badges |

Rules:

- Nothing under 12px. No `text-[10px]` / `text-[11px]`. Known leftovers are tracked in LTR-274.
- Sentence case. No `uppercase`, no wide tracking: eyebrows, form labels,
  badges, and nav group labels all read as normal text. `e2e/ui-consistency`
  fails if Admin list pages render uppercase text.
- Form labels use `Label` as is (14px medium). Do not restyle them as headings.
- No eyebrow above the page title. Admin pages dropped the "Shop Admin" eyebrow;
  where the user came from is the back link's job (`AdminBackLink`).
- Fields are 16px on every screen size (`.field`): iOS zooms into anything
  smaller on focus, and iPad is `md`.

## Spacing and radius

| Token | Value |
|---|---|
| `--radius` | `0.375rem` |
| Page gutters | `.app-shell` `px-4`; Admin `px-4 md:px-5 xl:px-6` |
| Page header → content | 24px: `space-y-6` on the page stack (Admin), or `mb-6` on `PageHeader` outside a stack (mechanic) |
| Between sections | 24px (`space-y-6` / `mb-6`) |
| Card padding | `.card` / `CardHeader` / `CardContent`: `p-4` mobile |
| Inside a card | 12px (`space-y-3`) between blocks, 8px (`gap-2`) between a label and its control or a title and its line |

`PageHeader` has no outer margin, so the page decides the gap. Nested cards
and per-screen spacing are cleaned up in LTR-168.

## 44px control baseline

Interactive controls use Tailwind `min-h-11` (2.75rem / 44px):

- `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-danger`
- `Button` default / icon sizes (`size-11`), and `sm` on touch screens: `sm` is 44px under `pointer: coarse` and 36px only with a mouse (LTR-167)
- Inline identifier links in lists (T-102, WO-0102): `.tap-inline` grows them to 44px tall without moving the text
- `PageSkeleton header={false}` when the real `PageHeader` is already shown, so loading does not show the title twice
- `.field`, `Input`, `Select`, `Textarea` (`min-h-11` / `min-h-28`)
- MultiSelect option rows (`min-h-11`)

Do not ship new tappable controls below 44px. The 2026-09-01 UX audit recorded
this as a CURRENT rule (`docs/archive/audit/ux-theme/README.md`).

Buttons also use `whitespace-nowrap`; if an action group does not fit, the
group wraps or stacks. Individual action labels must never be allowed to form
an accidental two-line button.

## Installed app (PWA, LTR-171)

Mechanics install the web app on **their phone or their tablet**; managers on the phone or iPad. One app
for every role, so every screen must work on both, portrait and landscape (the manifest fixes no
orientation), with no sideways scroll.

- **Mode**: `display: standalone`; `viewportFit: 'cover'` and `interactiveWidget: 'resizes-content'` in
  `layout.tsx` (Android shrinks the page for the keyboard; iOS uses `<KeyboardInset />`, LTR-234).
- **Safe areas**: `--app-safe-top/right/bottom/left` (`env(safe-area-inset-*)`, 0 without a notch). `.app-shell`
  derives `--app-shell-top/left/right` from them, so the first line sits 1rem below the status bar (LTR-167).
- **Bottom tabs**: on phones (under 640px) with the mechanic tab bar, `main` and toasts (`--toast-lift`) leave
  room above it (D-MG1).

- **Name**: "Lightning Shop" (`name`), "LTL Shop" under the icon (`short_name`); one app for every role.
- **Icon**: the green bolt from `public/ltl-logo.png` on white (the wordmark is unreadable at 60pt).
  `apps/web/scripts/generate-app-icons.mjs` writes `icon-192.png`, `icon-512.png`,
  `icon-maskable-512.png` (bolt inside the 80% safe circle), `apple-touch-icon.png` and
  `favicon-32.png`; rerun it if the logo changes.
- **Colors**: `background_color` / `theme_color` `#ffffff` (light `--background`); the
  `theme-color` meta follows the system theme (`#ffffff` / `#0f172a`, the dark `--background`).
  In standalone mode `html` paints `var(--background)`, so opening the app never flashes the
  other theme.

## Stage 8: mockup fidelity (2026-10-06)

The tokens already matched the mockups (Stage 7). Stage 8 changed how they are used:
- **Surfaces:** cards and fields without shadow; `bg-sunken` for group headers, column headers and lock
  bands; menus and dialogs on `bg-card` (not `bg-popover`, which is the page color in dark).
- **Buttons:** `rounded-md font-medium`, 44px on touch and 36px with a fine pointer; icons before the label.
- **Chips:** tinted (`border-x/40 bg-x/10 text-x`) with a dot for status; `warning` is amber, never the blue
  `shop-accent`.
- **Type:** `.page-title` 24/28px semibold; section titles 16px semibold; `.tnum` for numbers.
- **Motion:** `anim-sheet-in`, `anim-pop-in`, `anim-flash`, `anim-spin`, all off with reduced motion.
- **Segmented control:** `.seg` (`aria-checked` / `aria-pressed`) for Priority.
- **Mechanic tones:** sky, violet, emerald, rose, cyan, amber, slate (AA in both themes).
- **Avatar initials:** at most 3 characters; with 3 (role codes like "MPM", "MG1") the letter drops to 9 / 10 / 11 px for `sm` / `md` / `lg` with `tracking-tight` so it fits the circle (UX-4-008). The avatar is decorative (the name is beside it), the one exception to "nothing under 12px".

## Layout shells

| Surface | Constraint |
|---|---|
| Auth (`.app-shell`) | `max-w-md` mobile, `md:max-w-xl` from `md`; safe-area padding |
| Mechanic General and PM, and Safety `/qc` (`.app-shell .app-shell-wide`, LTR-272) | Phone: one column. From `md` (768px, every iPad, also Safari's ~980px desktop mode): no width cap, margins 1.5rem (2rem from `lg`), cap `90rem` only on `2xl` (D54, LTR-271). Cards in `.card-grid`: two per row, a card alone on its row takes the row; `.card-grid-lead` gives the first card a row of its own |
| Admin (`AdminShell` main) | Data screens (Dashboard, Yard, the lists) `max-w-none`; Work Order and Truck detail, Setup and forms `max-w-[1440px]` (`FULL_WIDTH_PATHS` in `admin-shell.tsx`, UX-4-003). Sidebar fixed from `lg` (1024 px); below, the header menu (UX-4-002) |

Mechanic screens are designed for the phone first and must also fill a tablet
(D54 replaced UX-4-008 "mechanics stay in a phone column"). Do not leave empty
bands at the sides or half rows; do not turn them into an Admin-density layout
either. Mechanics never see elapsed time (D54).

## Focus

`:focus-visible` uses `2px solid var(--ring)` with 2px offset.
`#main-content[tabindex='-1']:focus-visible` stays outline-free so
`PathScrollReset` can land there without a focus ring.
