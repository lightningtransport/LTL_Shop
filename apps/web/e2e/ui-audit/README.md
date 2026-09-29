# UI audit (LTR-172)

Screenshots and measurements for UI reviews (LTR-165). These scripts are **not** part of the Playwright
suite: they assert nothing and only leave evidence in `e2e/ui-audit/output/` (ignored by git).

- `audit.mjs` crawls every screen a role can reach and saves a full-page screenshot per screen, plus
  `report.json` with WCAG AA text contrast, clipped text, touch targets under 44px, text under 12px, and
  fields under 16px (iOS zooms into those on focus). It ends with the findings grouped by screen count.
- `states.mjs` captures what the crawl does not reach: menus, dialogs, sheets, toasts, loading with a slow
  API, and long names injected into API responses.

## Run

Three terminals from `apps/web`. The web server uses its own build folder so it does not collide with a
running `next dev`.

```bash
node e2e/fixtures/admin-api.mjs
```

```bash
NEXT_DIST_DIR=.next-ui-audit NEXT_PUBLIC_API_URL=http://127.0.0.1:3101 ../../node_modules/.bin/next dev --hostname 127.0.0.1 --port 3030
```

```bash
npm run ui-audit
npm run ui-audit -- --locale=en --scheme=dark --roles=mechanic,manager
npm run ui-audit -- --engine=chromium --device=desktop --roles=manager
npm run ui-audit:states
```

`audit.mjs` options: `--roles` (fixture accounts, `<role>@lightning.local`; default all five),
`--locale` (`es` | `en`), `--scheme` (`light` | `dark`), `--device` (`iphone` | `tablet` | `desktop`),
`--engine` (`webkit` | `chromium`), `--tag` (output folder name), `--base` (web URL).
`states.mjs` takes `--locale`, `--scheme`, `--base`, and `--api` (fixture API URL, used to slow down or
rewrite responses).

`states.mjs` resets the fixture API before it starts, because it adds a note and completes WO-0102.

## Limits

- Contrast is measured against the nearest solid background. Text over a gradient is approximate.
- Emulation does not cover the installed app on a real iPhone (status bar, home indicator, keyboard).
  Check those in the iOS Simulator: Safari → Share → Add to Home Screen, then open it from the icon.
