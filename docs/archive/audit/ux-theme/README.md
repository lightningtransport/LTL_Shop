> **ARCHIVADO (2026-09-29).** Documento histórico: no describe el sistema actual y no manda sobre el código. La fuente vigente es [`docs/README.md`](../../../README.md).

# UX Theme and Accessibility Audit

Date: 2026-09-01  
Branch: `codex/ux-theme-accessibility`

## Outcome

The mechanic P0 flow now uses a semantic OKLCH theme in light and dark modes, retains the existing Tailwind 3 build, and adds accessible controls without changing API contracts, DTOs, business rules, or English product copy.

## Verified flow

| Step | State | Evidence | Health |
| --- | --- | --- | --- |
| 1. Sign in | Dev Login with the local auth bypass | `01-login-dark-390x844.png`, `02-login-light-390x844.png`, `03-login-light-320x568.png`, `04-login-dark-320x568.png` | Healthy |
| 2. Home | Empty active and paused work-order states | `05-home-light-390x844.png`, `06-home-dark-390x844.png` | Healthy |
| 3. Select truck | Keyboard-capable combobox, truck `905`, verified open-work-order state | `07-new-order-light-390x844.png`, `10-new-order-dark-320x568.png` | Healthy |
| 4. Add job | Labeled category select, stable chevron, focus-managed dialog | `08-add-job-dialog-light-390x844.png` | Healthy |
| 5. Select mechanics | Accessible checkbox multiselect and compact summary | `09-working-with-light-390x844.png`, `11-working-with-dark-320x568.png` | Healthy |
| 6. Brand shell | Responsive LTL logo and Inter headings in both themes | `12-home-light-logo-390x844.png`, `13-home-dark-logo-390x844.png` | Healthy |

## Corrections covered

- Route changes and Back navigation reset the viewport to the top while preserving query-string behavior.
- Theme follows the system preference until the user explicitly chooses light or dark, then persists that preference.
- Select controls use a single Lucide chevron with consistent spacing and no native-chevron overlap.
- Dialogs have an accessible title, initial focus, Escape handling, focus containment, and trigger focus restoration.
- Labels are programmatically associated with form controls; validation and request failures use alert semantics.
- Truck search exposes combobox, listbox, option, expanded, selected, and live-result states.
- Working With uses an accessible mobile dialog with checkboxes instead of a native multi-select.
- Priority choices expose pressed state and reflow from two columns to four.
- Interactive controls meet the 44px touch-target baseline, browser zoom remains enabled, and decorative icons are hidden from assistive technology.

## Automated verification

- Web lint: passed.
- Web unit test command: passed; no unit test files are currently defined.
- Web production build: passed.
- Playwright: 12 passed, including the existing mechanic-flow suite and 7 deterministic UX regression cases.
- API health against local PostgreSQL seed: passed.
- `git diff --check`: passed.

## Evidence limits

- Visual evidence was captured from the integrated local browser against the seeded local API and PostgreSQL database.
- The small circular `N` visible in some images is the Next.js development indicator; it is not part of the production UI.
- The audit covers the mechanic P0 flow in the requested mobile viewports. It does not claim full WCAG conformance or coverage of future backend/integration states.

## Repeating the audit (LTR-172)

The 2026-09-28 mobile UI review (LTR-165) used the scripts in `apps/web/e2e/ui-audit/`. They crawl every
screen per role against the e2e fixture, save screenshots, and measure contrast, clipped text, touch targets,
text size, and field size. See `apps/web/e2e/ui-audit/README.md` to run them.
