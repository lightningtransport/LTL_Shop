# 00 · Contexto y acceso — Yard Operations → Dispatch

**Fecha:** 2026-10-19 · **Auditor:** Claude (skills audit-ux) con el dueño del producto
**slug:** admin-yard-dispatch-2026-10

El producto, el stack, los usuarios y el acceso son los mismos que en
[`../admin-dashboard-yard/00-contexto.md`](../admin-dashboard-yard/00-contexto.md). Aquí solo va
lo que cambia.

## 1. Por qué ahora
El 2026-10-19 el dueño revisó la pestaña Dispatch en producción, antes de mergear el PR 378 (D49:
"In yard" / "In shop" desde Samsara). Dijo: "no sé si me está dando la información bien… unos
camiones salen en blanco y no se les puede dar clic, no entiendo". Captura en
`evidencia/00-dispatch-prod-2026-10-19.webp`.

## 2. Dónde vive
- Pantalla: `/admin/yard-operations?tab=dispatch`, armada en
  `apps/web/src/components/admin-yard-operations.tsx` (L60, L226-244).
- Tarjetas: `apps/web/src/components/admin-yard-data-boundary-cards.tsx` (`MovementRows`,
  `WorkLocationItems`, `ChipList`, `shopChip`).
- Funciones de apoyo: `apps/web/src/lib/yard-card.ts` y `apps/web/src/lib/yard-data-boundary.ts`.
- Textos: `apps/web/src/lib/admin-messages-catalog.ts` y
  `packages/shared/src/yard-data-boundary-copy.ts`, que el spec fija.
- Datos: `GET /api/admin/yard/data-boundary`, en
  `apps/api/src/admin/yard-data-boundary.service.ts` y `yard-data-boundary.ts`.
  - Incoming y Departures salen del reporte `driver_pay` de agent-reporting.
  - Dispatch status sale del reporte `trucks`, campo `yard_location`. Es texto que Dispatch
    escribe a mano en Ninox.
  - El lado del taller (`shopSide`) trae la WO abierta y la fase, y empareja por `truckNumber`
    exacto.

## 3. Acceso
- **Producción:** la captura del dueño. No hay sesión en el panel del navegador; no se entra con
  contraseñas.
- **Fixture local:** `apps/web/e2e/fixtures/admin-api.mjs` (trae "301 Yard", 277, Y-103).

## 4. Flujo crítico
**Cruzar Dispatch con el taller** (J5, HU-M7): el Manager quiere saber qué camión llega, qué
camión sale y dónde está cada uno: en el shop, en la yard o afuera.

## 5. Alcance
- **Incluido:** solo la pestaña Dispatch. Dimensiones: usabilidad (01) y contenido (03).
- **Decisiones que no se reportan como hallazgos:**
  - D49: In yard por los geofences de nuestra yard; In shop = yard + WO abierta.
  - D43: nuestra base es la fuente; los terceros solo se consultan.
  - D44: los camiones los crea una persona.

## 6. Pendientes
- Ninguno bloqueante. Las respuestas del dueño del 2026-10-19 están en `01-usabilidad.md` §Decisiones.
