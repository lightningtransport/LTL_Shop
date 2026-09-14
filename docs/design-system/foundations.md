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
| `--destructive`, `--destructive-foreground` | Danger |
| `--border`, `--input`, `--ring` | Hairlines, fields, focus ring |
| `--success` | Positive status |
| `--warning`, `--warning-foreground`, `--warning-surface` | Caution banners (Yard Phase 1) |

Tailwind maps these 1:1 in `apps/web/tailwind.config.js` (`background`,
`primary`, `destructive`, `warning-surface`, and so on).

## Shop channel tokens

Tailwind 3 opacity utilities need channel-only values. The same file defines
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
| Page title | `font-display text-3xl font-bold tracking-wide` (`ScreenHeader`) |
| Section label | `.section-label` — 12px, semibold, uppercase, `0.14em` tracking |
| Body / helper | `text-sm text-muted-foreground` or `text-shop-muted` |

Admin pages use the same hierarchy everywhere: `.section-label` eyebrow, one
`text-3xl font-bold` page title, then a `text-sm` description. Do not switch
between title case/uppercase eyebrows or `text-2xl font-semibold` page titles
for convenience on individual screens.

## Spacing and radius

| Token | CURRENT value |
|---|---|
| `--radius` | `0.375rem` |
| Card | `.card` — `rounded-xl`, `p-4` |
| Stack gaps | typically `space-y-3` / `space-y-5` / `mb-6` |
| Page gutters | `.app-shell` `px-4`; Admin `px-4 md:px-5 xl:px-6` |

## 44px control baseline

Interactive controls use Tailwind `min-h-11` (2.75rem / 44px):

- `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-danger`
- `Button` default / icon sizes (`size-11`)
- `.field`, `Input`, `Select`, `Textarea` (`min-h-11` / `min-h-28`)
- MultiSelect option rows (`min-h-11`)

Do not ship new tappable controls below 44px. The 2026-09-01 UX audit recorded
this as a CURRENT rule (`docs/audit/ux-theme/README.md`).

Buttons also use `whitespace-nowrap`; if an action group does not fit, the
group wraps or stacks. Individual action labels must never be allowed to form
an accidental two-line button.

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
