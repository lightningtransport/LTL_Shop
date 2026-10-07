# 00 · Contexto y acceso — Lightning Shop, pantallas del Mecánico de PM

**Fecha:** 2026-10-07 · **Auditor:** Claude (skill audit-ux) con el dueño del producto
**slug:** mecanico-pm

## 1. Producto
- **Qué es:** las pantallas del mecánico de mantenimiento preventivo (PM) dentro de
  Lightning Shop, la app del taller de camiones de Lightning Transport. El mecánico
  de PM elige un camión, anota el millaje que ve en el odómetro, marca las piezas que
  cambió y termina el PM (J9, HU-PM1). El Work Order del camión sigue abierto para los
  demás pasos.
- **Usuarios objetivo:** Daniel, el único que hace PM (capacidad `mechanic.pm`; "MPM"
  en la demo). Sin Daniel, los camiones esperan en el paso PM.
- **Contexto de uso:** en el taller, de pie junto al camión, con el teléfono
  (`docs/USER_FLOWS.md` §1). La señal se puede cortar dentro del taller. Un PM a la vez.
- **Plataformas:** web responsive e instalable (PWA). Objetivo principal: teléfono a
  375–390 px. Secundario: computadora.
- **Idioma(s) de la interfaz:** inglés y español, los dos completos.

## 2. Repositorio
- **Ruta local:** `/Users/cristianperez/LTL SHOP : ADMIN : MECHANICS/LTL_Shop`
  (worktree `.claude/worktrees/bold-shirley-def32d`, rama `claude/qc-screen-proposal`).
- **Estructura relevante:** `apps/web` (Next.js 15), `apps/api` (NestJS + Prisma),
  `packages/shared` (regla de millaje en `packages/shared/src/pm-mileage.ts`).
- **Stack de frontend:** React 19, Tailwind 3, SWR, primitivas propias en
  `apps/web/src/components/ui.tsx`.
- **Dónde viven:**
  - Inicio (`/mechanic/pm`): `apps/web/src/app/page.tsx` en modo PM
    (`app/mechanic/pm/page.tsx` lo reexporta).
  - Create PM service (`/mechanic/pm/new`): `apps/web/src/app/work-orders/new/page.tsx`
    (`app/mechanic/pm/new/page.tsx` lo reexporta).
  - Trucks (`/mechanic/pm/trucks`): `components/mechanic-trucks-page.tsx`.
  - Completed (`/mechanic/pm/completed`): `components/mechanic-completed-page.tsx`.
  - Detalle del PM (`/work-orders/[id]?view=pm`): `app/work-orders/[id]/detail-client.tsx`
    → `components/pm-job-detail.tsx` (Service type, Start/Continue, Finish, Report
    blocker) y `components/pm-service-card.tsx` (millaje, piezas, guardado automático).
  - Notas: `components/work-order-notes-thread.tsx`.
  - Pestañas: `components/mechanic-tabs.tsx`. Textos: `apps/web/src/lib/locale-context.tsx`.
  - Formularios: estado de React a mano, sin librería; validación de millaje compartida
    con la API (`checkPmObservedMileage`).

## 3. Acceso a la app corriendo
- **Local con datos demo (principal):** base `ltl_shop_demo`. Web `http://127.0.0.1:3052`,
  API `http://127.0.0.1:3151` (ya corriendo; no se reiniciaron). Se entra en `/login`
  con "Dev login (local bypass)" y la cuenta PM del seed (`apps/api/prisma/seed.ts`,
  líneas 34 y 102).
- **Roles para probar:** Mecánico de PM. No se usó ninguna otra cuenta: otro agente
  audita al mecánico general en la misma base al mismo tiempo.
- **Datos de prueba usados:**
  - WO-016 / Truck 968: PM de Daniel en curso, millaje 210,000 cargado, sin piezas.
  - WO-003 / Truck 603: PM por empezar.
  - WO-006 / Truck 606: PM terminado (solo lectura).
  - WO-009 / Truck 609: Work Order en pausa del Manager con el PM por empezar.
  - Truck 957: sin Work Order abierto (para Create PM service).
- **Cambios hechos en la demo durante la auditoría** (todos revertidos):
  - WO-016: el millaje se borró una vez (quedó guardado vacío) y se volvió a 210,000.
  - WO-016: se eligió una pieza de "Oil Filter 1 Unit" y se volvió a "No part used".
  - WO-016: Service type pasó a PM B y volvió a PM A (deja rastro en el historial).
  - WO-003 "Start PM service" y Create PM service en 957: la API respondió 409 (ya hay
    un PM en curso); no se creó ni se empezó nada.
  - No se terminó ningún PM: para crear uno nuevo había que terminar WO-016, que es
    un escenario de la demo.
- **Navegador:** Playwright desde Node, contextos 375×812 y 1366×900, claro y oscuro,
  inglés y español. Los fallos se provocaron interceptando la API (`page.route`) y con
  `context.setOffline(true)`.

## 4. Flujos críticos (en orden de importancia)
1. **Registrar el PM de un camión** (HU-PM1, J9): detalle del PM → millaje observado →
   piezas → Finish. Ruta `/work-orders/[id]?view=pm`. Rol: PM.
2. **Empezar un PM**: Create PM service → elegir Truck → crear o unirse al WO; o
   "Start PM service" desde una tarjeta del inicio. Rutas `/mechanic/pm/new` y
   `/mechanic/pm`. Rol: PM.
3. **Saber qué tengo y qué sigue**: inicio con el PM en curso, los que esperan y los
   pausados. Ruta `/mechanic/pm`. Rol: PM.
4. **Avisar que algo lo detiene**: Report blocker y notas. Detalle del PM. Rol: PM.
5. **Consultar lo que ya hice**: Completed y Trucks (historial). Rol: PM.

## 5. Alcance
- **Incluido:** las cinco rutas de arriba con la cuenta de PM, en teléfono y
  computadora, claro y oscuro, inglés y español.
- **Excluido:** el detalle del Work Order del Manager (auditoría `admin-truck-wo`),
  el mecánico general (`mecanico-general`) y Safety (`safety-qc`).
- **Restricciones:** no reiniciar la base; no tocar WO-004 ni WO-005; solo la cuenta de PM.

## 6. Lo que ya se sabe
- **Reglas que no se reportan como hallazgos** (`docs/USER_FLOWS.md` §4,
  `docs/SYSTEM.md` "PM service" y "Mecánico PM"):
  - Un solo PM en curso a la vez (D2); los demás se ven pero no se inician.
  - Create PM service se une al WO abierto del camión o crea el WO completo.
  - El millaje no puede ser menor que el del camión; un salto de más de 50 000 pide
    confirmar (D10).
  - Finish exige millaje y al menos una pieza.
  - Las piezas se filtran por marca y modelo del camión.
  - El PM no tiene pausa (D17); si algo lo detiene, se reporta un bloqueo y lo
    resuelve el Manager.
  - Cambiar PM A ↔ PM B cambia el mismo Job.
  - Un PM terminado es solo lectura.
- **Trabajo previo:** W14 (Iniciar primario con otro PM activo) y W15 (pausa, "Guardado"
  escondido) arreglados el 2026-09-30 (`docs/OPEN_ISSUES.md` §1d).

## 7. Pendientes
- **Notas:** HU-PM1 paso 3 dice "Las notas se guardan solas", pero en la pantalla las
  notas se publican con "Add Note" (hilo del WO, D8) y no hay campo de notas del PM.
  Confirmar con el dueño cuál es el comportamiento buscado y corregir el documento o
  la pantalla.
- **Supuesto:** Daniel usa sobre todo el teléfono y la señal falla dentro del taller.
  Confirmar con el dueño.
- **Éxito de Finish:** no se observó (ver §3). Queda para una corrida con un camión
  propio después de terminar WO-016.
