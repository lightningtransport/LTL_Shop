# Design system

**Classification:** CURRENT STATE
**Updated:** 2026-10-21 (LTR-273: aligned with the code up to D54); before 2026-09-29 (docs reorganized)

This folder inventories the Lightning Shop UI that exists in `apps/web` today.
It is not a target kit and does not invent primitives.

When this folder says TARGET, it only marks primitives from the archived
Master PRD (`../archive/LIGHTNING_SHOP_MASTER_PRD.md` §33) that are **not**
implemented yet (Tabs / Sheet). Do not treat those as current exports.

## Read order

1. `foundations.md` — tokens from `apps/web/src/app/globals.css` and
   `apps/web/tailwind.config.js`
2. `components.md` — `apps/web/src/components/ui.tsx` exports and shells
3. `patterns.md` — loading, failure, empty states, Location vs Presence (D49), action notices, the TV board, phone and tablet
4. `glossary-en-es.md` — English / Spanish domain terms

The app map (menu, routes, who sees what) is [`../reference/IA_MAP.md`](../reference/IA_MAP.md).

Spanish operators should use `glossary-en-es.md` for Shop language. Admin and
mechanic catalogs already ship bilingual copy; this glossary records the
CURRENT terms, not new translations.

## Authority

- CURRENT UI: tested code in `apps/web`
- CURRENT product behavior: `../SYSTEM.md`
- Theme audit evidence (historical): `../archive/audit/ux-theme/README.md`
