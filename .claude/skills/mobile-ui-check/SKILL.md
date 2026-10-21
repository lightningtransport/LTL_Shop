---
name: mobile-ui-check
description: Review the Shop Admin panel, the mechanic apps (General and PM) and Safety /qc on a phone (iPhone WebKit and Android Chromium) with evidence, before fixing mobile UI. Use when the owner says something looks cut, a menu does not open, buttons or spacing look off on mobile, or before shipping a screen that the Manager uses on the phone.
---

# Mobile UI check (Shop Admin, mechanics, Safety)

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
- **Mechanic, PM and Safety screens:** `MOBILE_WALK=field`. They need real data, so the fixture API is not enough:
  - seed `ltl_shop_test` with the helpers in `apps/api/test-real/harness.ts` (a temporary row, not committed): a Work Order in progress with a blocker, a PM running, trucks waiting for QC, one returned and one approved;
  - start the built API against `ltl_shop_test` with `AUTH_DEV_BYPASS=true` on port 3211 (or set `MOBILE_WALK_API`);
  - start a production build of the web with `NEXT_PUBLIC_E2E_DEV_LOGIN=1`, `NEXT_PUBLIC_API_URL=http://127.0.0.1:3211` and `NEXT_DIST_DIR=.next-walk` on port 3010;
  - run with `PLAYWRIGHT_SKIP_WEBSERVER=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:3010 -g field`.
  The field apps scroll the window on purpose (sticky header, fixed bottom tabs), so `doc > inner` is expected there. A page entry with a third value opens that button first (a dialog, the QC review sheet).
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

## 6. Tablet (iPad Pro 11", LTR-259)
- Admin, plus the mechanic and PM apps since D54 and Safety (`/qc`) since LTR-272 (they use the width with `.app-shell-wide`: cards two per row, Work Order in two columns). Only login and reset stay a phone column. The walk also opens New purchase / New outside repair and walks every mechanic screen (General and PM: home, Trucks, Completed, New, a Work Order, a Truck's history) and Safety's Quality Check (To review, Returned, Done, the review sheet; the fixture serves `/api/qc`); `gutter` flags a `main` that is much narrower than the window (more than 48 px of empty band on a mechanic screen).
- **Safari on an iPad asks for the desktop site by default and lays the page out about 980 px wide** (LTR-271: the owner's iPad Pro 11" in portrait). At 980 px `md` applies but `lg` does not, so a `md:max-w-*` cap leaves an empty band on each side. Never judge an iPad screen only at 834 px.
- Run `TABLET_WALK=1 ADMIN_E2E_FIXTURE=1 node ../../node_modules/@playwright/test/cli.js test e2e/tablet-walk.spec.ts` in `apps/web`. `TABLET_WALK=1` swaps the projects for `ipad-portrait` (834×1194, no sidebar) and `ipad-landscape` (1194×834, sidebar at `lg`, about 954 px of content) and `ipad-desktop-mode` (980×1403, Safari's default on an iPad). `TABLET_WALK_ONLY=trucks,purchases` walks a subset.
- `report.json` per screen: `overflow` (`main` scrolls sideways), `overlap` (two controls cover each other), `gutter` (capped boxes or content that stops 120 px short of the column), `lonely` (a card alone on a row of a two-column grid, the other half empty), `error` (the page did not load, or the fixture has no route for it), `copy` (text over 120 characters or team words: D34, LTR-, Vercel, GitHub, npm, token, Activity Log).
- Date fields (`date`, `month`, `time`, `datetime-local`) can shrink to their column (LTR-264: iOS gives them a built-in minimum width); checkboxes have one look everywhere (`globals.css`). Put a filter field with a date in `min-w-[9.5rem] flex-1`, and grid cells in `min-w-0`.
- **Dark mode too** (`TABLET_WALK_DARK=1`): the owner's iPad is dark. LTR-274: a ghost "View" and fixed-width buttons passed every number in light and read as text in dark. The walk now reports `actions` (a card's action bar whose buttons do not fill the card, or a button there with no fill and no border).
- **Look at the screenshots for consistency, not only the numbers:** the same kind of card has the same kind of action on every screen (mechanic, PM, Safety); every button looks like a button. Rules in `docs/design-system/components.md` (Field card actions).
- Mechanic cards: use `.card-grid` (two per row from `md`, a card alone on its row takes the whole row; `.card-grid-lead` when the first card is the next one up and takes its own row). The mechanic page itself (`.app-shell-wide`) has no cap on a tablet, only margins.
- House rules for tablet: filter bars wrap before they overlap (`flex-wrap`, search `flex-1 min-w-…`, no `whitespace-nowrap shrink-0` around controls); side columns of detail pages start at `xl`; no `max-w-2xl` forms or fixed-width Kanban columns inside list pages.
