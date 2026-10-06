# 00 · Contexto y acceso — Lightning Shop Admin (Dashboard y Yard Operations)

**Fecha:** 2026-10-05 · **Auditor:** Claude (skill audit-ux) con el dueño del producto
**slug:** admin-dashboard-yard

Producto, repositorio, stack, usuarios y forma de acceso: los mismos que
[`../admin-truck-wo/00-contexto.md`](../admin-truck-wo/00-contexto.md) §1–§3. Aquí solo va lo
que cambia.

## 1. Producto (diferencias)
- **Usuarios:** Shop Manager. Abre el Dashboard al empezar el día y entre tareas; abre el Yard
  para ver el taller completo (J5). Usa el teléfono caminando por el patio y la computadora en
  la oficina.
- **Contexto:** son las dos pantallas de **entrada** del Admin. Deciden a qué camión va el
  Manager.

## 2. Dónde viven
- Dashboard: `apps/web/src/app/admin/page.tsx` → `components/admin-dashboard.tsx` y
  `components/admin-work-order-item.tsx` (ítems de Needs attention), `admin-blocker-resolve.tsx`.
  Datos: `GET /api/admin/dashboard` (`apps/api/src/admin/admin.service.ts:312-385`, lista de
  atención `:2097-2159`; orden en `packages/shared/src/attention.ts`). Se refresca cada 30 s.
- Yard: `apps/web/src/app/admin/yard-operations/page.tsx` → `components/admin-yard-operations.tsx`
  y `admin-yard-data-boundary-cards.tsx`. También `lib/yard-operations-routing.ts`,
  `lib/yard-card.ts` y `packages/shared/src/yard-data-boundary-copy.ts`.
  - Datos de readiness: `GET /api/admin/yard-operations`, 25 por página, sin refresco
    automático.
  - Datos de Dispatch: `GET /api/admin/yard/data-boundary`, que viene de agent-reporting
    (`docs/reference/YARD_DATA_BOUNDARY.md`) y se refresca cada 30 s.

## 3. Acceso
- **Producción:** `https://ltl-shop-web.vercel.app/admin` y `/admin/yard-operations`, con la
  sesión admin del dueño en el panel del navegador, **solo lectura**. Verificado el
  2026-10-05 a las 10:53 PM: 4 WOs abiertas y 5 camiones Ready to Go; la pestaña Movement tiene
  datos reales de Dispatch.
- **Fixture local:** `apps/web/e2e/fixtures/admin-api.mjs`. No trae `nextStep`, `readyToGo`,
  pedidos de trabajo, motivos de atención ni blockers, así que esos estados se juzgan en
  producción y en la maqueta.
- **Roles:** Manager y Admin (todo). `system-admin` de la fixture (solo lectura). Usuarios con
  las capacidades de mecánico (ven el bloque Workspaces).

## 4. Flujos críticos
1. **Empezar el día y saber qué atender** (J3, J4, HU-M4, HU-M7): Dashboard → Needs attention →
   actuar (Resolve, cerrar, return to service) o ir al camión.
2. **Ver el taller completo y priorizar** (J5, HU-M7): Yard → tablero por paso → camión.
3. **Devolver a servicio los camiones que salen** (J4, HU-M5): Yard (columna Ready to Go) o
   Dashboard (métrica Ready to Go).
4. **Cruzar con Dispatch** (D24, YARD_DATA_BOUNDARY): ¿qué camión llega o sale y cómo está en el
   taller? Yard → Movement.

## 5. Alcance
- **Incluido:** `/admin` y `/admin/yard-operations` (las dos pestañas), en escritorio y
  teléfono, con Manager y con solo lectura. Las listas de Trucks y de Work Orders entran solo
  como destino de los enlaces.
- **Excluido:** Truck Detail y WO Detail (ya auditados en `admin-truck-wo`).
- **Decisiones que no se reportan como hallazgos:**
  - D1: Ready to Go se calcula y dura hasta Return to Service.
  - D5: "Blocked" es una parada real.
  - D17: solo el Manager resuelve.
  - D24: "Fuera del taller" no cambia la fase.
  - La presencia física en el patio (geofence) está fuera de alcance (`YARD_DATA_BOUNDARY.md`).
- **Ya decidido** (2026-10-05, `admin-truck-wo`): el Next step actúa donde estás; el Truck
  responde "¿puede salir?" y la WO ejecuta.

## 6. Lo que ya se sabe
- `SYSTEM.md` §6:
  - Dashboard = "métricas, Needs attention con el siguiente paso, pedidos de trabajo abiertos".
  - Yard = "tablero del patio por fase" y la pestaña Movement de agent-reporting.
- `USER_FLOWS.md` J5: "ver cada camión, en qué paso va y qué le falta; decidir prioridades sin
  abrir camión por camión".
- `USER_FLOWS.md` HU-M7: orden de Needs attention, "Inspection + In the Shop + Ready to Go
  suman el tablero; Blocked es un subgrupo".
- Inventario completo del código hecho el 2026-10-05 al preparar esta auditoría.

## 7. Pendientes
- Confirmar con el dueño el reparto Dashboard / Yard / listas después de `05-navegacion-ia.md`.
- Confirmar con el dueño si los datos de Dispatch (Movement) son confiables día a día. En
  producción hay contradicciones: el 277 tiene una WO abierta y Dispatch dice "Outside".
