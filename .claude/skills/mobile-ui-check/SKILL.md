---
name: mobile-ui-check
description: Review the Shop Admin panel on a phone (iPhone WebKit and Android Chromium) with evidence, before fixing mobile UI. Use when the owner says something looks cut, a menu does not open, buttons or spacing look off on mobile, or before shipping a screen that the Manager uses on the phone.
---

# Mobile UI check (Shop Admin)

Goal: find what is really wrong on a phone, with evidence, and never guess. Every finding needs a screenshot, a measurement or a `file:line`.

## 1. Ask what the code cannot say
- Which part of the app: Admin panel, mechanic, Safety `/qc` or login.
- Which phone and browser. iPhone Chrome and iPhone Safari are both WebKit. Android Chrome is Chromium.
- Browser or installed app (PWA). If only the browser looks wrong, suspect the screen height: browser bars, `100vh` vs `100dvh`, or a document taller than the screen.

## 2. Walk every screen (measured, not judged)
`apps/web/e2e/mobile-walk.spec.ts` is off by default. Run it against the fixture build:

```bash
cd apps/web && MOBILE_WALK=1 MOBILE_WALK_OUT=/tmp/walk ADMIN_E2E_FIXTURE=1 ../../node_modules/.bin/playwright test e2e/mobile-walk.spec.ts --project=mobile-webkit --reporter=line
```

- Use `--project=mobile-chromium` for Android.
- For every screen, it scrolls `main` (the Admin page scrolls inside `main`, not the window) and saves screenshots. It opens the menu and saves a screenshot after the open animation (900 ms). A screenshot taken during the animation shows a transparent sheet, and that is not a bug.
- It writes `report.json` for each screen with these fields:
  - `doc` vs `inner`: a document taller than the screen means the whole page scrolls in a phone browser. The header and its menu button then go out of view, and the bottom looks cut.
  - `cut`: the first box that runs past the right edge, outside a horizontal scroller.
  - `small`: tap targets under 44 px that are not `.tap-inline` (WCAG 2.5.8 / Apple HIG 44 pt).
  - `truncated`: text cut with an ellipsis or overflow (`sr-only` is skipped).
  - `plurals`: visible "1 Jobs", "1 purchases"…
- Look at every screenshot yourself as well. Content, hierarchy and spacing issues need eyes, not only numbers.

## 3. Confirm before you fix
- When `doc > inner`, find the element: absolute or fixed elements whose `offsetParent` is not `main`, usually an `sr-only` label. The fix belongs to the scroller (`position: relative`), not to the label.
- A finding from emulation alone does not prove a real-device bug. Emulation has no browser bars. Say so, and ask the owner to check the Vercel preview on the phone.

## 4. Fix with the house rules
- **Touch size:** 44 px on touch screens (`[@media(pointer:coarse)]:h-11` or `size-11 lg:size-8`). Compact on desktop.
- **Inline links:** use `tap-inline`.
- **Counts:** use `{count} {count:Job|Jobs}` in `admin-messages-catalog.ts`, through `fillPlaceholders`. Never write `'{count} Jobs'`. Fix EN and ES.
- **Page actions:** `PageHeader` actions wrap (`max-w-full`). Do not add `shrink-0` wrappers around groups of buttons.
- **Follow-ups:** keep `docs/ux-audit/<slug>/` findings in the audit format (`audit-ux-4`, `audit-ux-8`). Record defects in Linear first, as the repo rules ask.

## 5. Verify
- `apps/web/e2e/mobile-frame.spec.ts`: the document is never taller than the screen, and the Parts header actions stay on screen. Run it on both projects.
- Re-run the walk. Then run `npm test` and `tsc` in `apps/web`.
