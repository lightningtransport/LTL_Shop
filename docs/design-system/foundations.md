# Foundations

**Classification:** CURRENT STATE
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
| `--secondary`, `--secondary-foreground` | Secondary / success-leaning actions |
| `--muted`, `--muted-foreground` | Quiet surfaces and helper text |
| `--accent`, `--accent-foreground` | Hover / selected chrome |
| `--destructive`, `--destructive-foreground` | Danger fills (buttons, the critical badge) |
| `--destructive-text` | Danger text on the page, a card, or a `destructive/10` tint (`text-destructive-text`). Errors use this, never `text-destructive` |
| `--border`, `--input`, `--ring` | Hairlines, fields, focus ring |
| `--success` | Positive status |
| `--warning`, `--warning-foreground`, `--warning-surface` | Caution banners (Yard Phase 1) |
| `--sunken` | A step below the card: table headers, folded groups (R6) |

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
| Page title | `.page-title` | 24px bold, 30px from `md` | The one `h1`, only through `PageHeader` |
| Section title | `.section-title` | 18px semibold | A page section (`CardTitle` uses it) |
| Card title | `.card-title` | 16px semibold | A card or list item heading |
| Group title | `.group-title` | 14px semibold | A group inside a card ("Notes", "Your Jobs") |
| Body | `text-sm` | 14px | Default text |
| Secondary | `text-sm text-muted-foreground` | 14px | Descriptions, helper text |
| Meta | `text-xs text-muted-foreground` | 12px | Timestamps, counts, badges |

Rules:

- Nothing under 12px. No `text-[10px]` / `text-[11px]`.
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

## Installed app (LTR-171)

Mechanics and managers install the web app on the phone's home screen.

- **Name**: "Lightning Shop" (`name`), "LTL Shop" under the icon (`short_name`); one app for every role.
- **Icon**: the green bolt from `public/ltl-logo.png` on white (the wordmark is unreadable at 60pt).
  `apps/web/scripts/generate-app-icons.mjs` writes `icon-192.png`, `icon-512.png`,
  `icon-maskable-512.png` (bolt inside the 80% safe circle), `apple-touch-icon.png` and
  `favicon-32.png`; rerun it if the logo changes.
- **Colors**: `background_color` / `theme_color` `#ffffff` (light `--background`); the
  `theme-color` meta follows the system theme (`#ffffff` / `#0f172a`, the dark `--background`).
  In standalone mode `html` paints `var(--background)`, so opening the app never flashes the
  other theme.

## Layout shells

| Surface | Constraint |
|---|---|
| Mechanic / auth (`.app-shell`) | `max-w-md` mobile, `md:max-w-xl` desktop; safe-area padding |
| Admin (`AdminShell` main) | `max-w-[1500px]`; sidebar from `md` |

Mechanic remains mobile-first. The `md:max-w-xl` widen is a cheap desktop
polish only; do not turn mechanic Home into an Admin-density layout.

## Focus

`:focus-visible` uses `2px solid var(--ring)` with 2px offset.
`#main-content[tabindex='-1']:focus-visible` stays outline-free so
`PathScrollReset` can land there without a focus ring.
