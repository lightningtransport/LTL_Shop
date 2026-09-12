# Design system

**Classification:** CURRENT STATE
**Updated:** 2026-09-12

This folder inventories the Lightning Shop UI that exists in `apps/web` today.
It is not a target kit and does not invent primitives.

Product TARGET still lives in `LIGHTNING_SHOP_MASTER_PRD.md`. When this folder
says TARGET, it only marks Master PRD primitives that are **not** implemented
yet (Table / Tabs / Sheet). Do not treat those as current exports.

## Read order

1. `foundations.md` — tokens from `apps/web/src/app/globals.css` and
   `apps/web/tailwind.config.js`
2. `components.md` — `apps/web/src/components/ui.tsx` exports and shells
3. `patterns.md` — loading, failure, and empty states
4. `glossary-en-es.md` — English / Spanish domain terms
5. `patterns.md` — Location vs Presence display rule (LTR-13)

Spanish operators should use `glossary-en-es.md` for Shop language. Admin and
mechanic catalogs already ship bilingual copy; this glossary records the
CURRENT terms, not new translations.

## Authority

- CURRENT UI: tested code in `apps/web`
- CURRENT product behavior: `../CURRENT_PRODUCT_STATUS.md`
- TARGET product: `../LIGHTNING_SHOP_MASTER_PRD.md` §33 Design System
- Theme audit evidence: `../audit/ux-theme/README.md`
