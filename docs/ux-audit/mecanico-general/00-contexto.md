# 00 · Contexto y acceso — Lightning Shop, pantallas del Mecánico General (Standard)

**Fecha:** 2026-10-07 · **Auditor:** Claude (skill audit-ux) con el dueño del producto
**slug:** mecanico-general

## 1. Producto
- **Qué es:** el espacio del mecánico Standard dentro de Lightning Shop, la app del
  taller de camiones de Lightning Transport. El mecánico ve solo los Jobs que el
  Manager le asignó, arranca su reloj, completa cada Job, avisa si algo lo detiene y
  deja notas o pide trabajo extra (J6, J7, J8; HU-ME1 a HU-ME6).
- **Usuarios objetivo:** mecánicos Standard (capacidad `mechanic.standard`). Un
  mecánico puede tener Jobs en varios camiones a la vez (D2) y ser ayudante en el Job
  de otro (D23).
- **Contexto de uso:** en el taller, de pie junto al camión, con el teléfono en una
  mano y a veces con guantes (`docs/USER_FLOWS.md` §1). Abre la app al llegar, al
  cambiar de camión, al terminar un Job y cuando algo lo detiene.
- **Plataformas:** web responsive e instalable (PWA). Objetivo principal: teléfono a
  375–390 px. Secundario: computadora.
- **Idioma(s) de la interfaz:** inglés y español, los dos completos (el taller los
  mezcla).

## 2. Repositorio
- **Ruta local:** `/Users/cristianperez/LTL SHOP : ADMIN : MECHANICS/LTL_Shop`
  (worktree `.claude/worktrees/bold-shirley-def32d`, rama `claude/qc-screen-proposal`).
- **Estructura relevante:** `apps/web` (Next.js 15), `apps/api` (NestJS + Prisma),
  `packages/shared`.
- **Stack de frontend:** React 19, Tailwind 3, primitivas propias en
  `apps/web/src/components/ui.tsx` (estilo Etapa 8), SWR para los datos. Design system en
  `docs/design-system/`.
- **Dónde viven:**
  - Inicio "My Assigned Work": `/mechanic/standard` → `apps/web/src/app/page.tsx`
    (la ruta reexporta la página raíz).
  - Pestañas "My work · Trucks · Completed": `apps/web/src/components/mechanic-tabs.tsx`,
    dentro de `HomeTopBar` (`ui.tsx:650`).
  - Buscar unidad: `/mechanic/standard/trucks` → `components/mechanic-trucks-page.tsx`;
    historial `/trucks/[id]/history`.
  - Completados: `/mechanic/standard/completed` → `components/mechanic-completed-page.tsx`.
  - `/mechanic/standard/new` → `app/work-orders/new/page.tsx`: para el Standard solo dice
    "Ask your Shop Manager to create a Work Order" (el formulario se quitó en LTR-180).
  - Detalle del Work Order: `/work-orders/[id]` → `app/work-orders/[id]/detail-client.tsx`
    (Your Jobs, Other work, Start/Continue, Complete job, Report Blocker, bloqueos
    activos) y `components/work-order-notes-thread.tsx` (notas y Request Work).
  - Textos: `apps/web/src/lib/locale-context.tsx` (EN desde la línea ~375, ES desde ~710).
  - Datos: `apps/web/src/lib/shop-data.ts` (lista cada 30 s, detalle cada 15 s).
  - Tokens: `apps/web/src/app/globals.css`, `apps/web/tailwind.config.js`.

## 3. Acceso a la app corriendo
- **Local con datos demo (principal):** base `ltl_shop_demo`; web en
  `http://127.0.0.1:3052`, API en `http://127.0.0.1:3151` (`qc-demo-web`, `qc-demo-api`
  en `.claude/launch.json`). Se entra en `/login` con el email y "Dev login (local
  bypass)". Cuentas en `apps/api/prisma/seed.ts` (líneas 10–36). No se escriben
  contraseñas aquí.
- **Cuenta auditada:** Anthony (mecánico Standard). Verificado el 2026-10-07: su inicio
  muestra Air Leak en curso en WO-004 (Truck 604), Air Bag Replacement bloqueado
  "Waiting for Parts" en WO-005 (Truck 605) y dos Work Orders listos para iniciar:
  WO-012 (Truck 922, con un Job de ayudante de Alejandro 2) y WO-013 (Truck 931).
- **Producción:** no se abrió.
- **Roles para probar:** solo el mecánico Standard. WO-003 (Truck 603) se usó para
  ver qué pasa al abrir un Work Order sin Jobs propios.
- **Datos que la auditoría cambió en la demo (todo con la cuenta de Anthony):**
  1. Start en WO-012 desde la lista (su reloj pasó de 604 a 922) y Continue en WO-004.
  2. Request Work en WO-004: "Rear mud flap bracket is cracked, needs replacement."
  3. Complete job de Air Leak en WO-004, con nota de cierre.
  4. Report Blocker "Waiting for Parts" en Brake Inspection de WO-012.
  5. Los errores (500, 401, 409, 403, sin conexión, demoras) se provocaron
     interceptando la API con Playwright; no cambiaron datos.
  No se tocó WO-016 (Truck 968) ni la cuenta de Daniel (otra auditoría corre en la
  misma base).

## 4. Flujos críticos (en orden de importancia)
1. **Ver lo que me toca y saber dónde corre mi reloj** (HU-ME1, HU-ME5, HU-ME6, J6):
   inicio → tarjetas por camión → detalle. Ruta `/mechanic/standard`.
2. **Trabajar y terminar** (HU-ME2, J7): Start / Continue → Complete job (con nota) →
   "You finished your part". Ruta `/work-orders/[id]`.
3. **Avisar que algo me detiene** (HU-ME3, J8): Report Blocker → motivo → nota al
   bloqueo → espera al Manager → "Resolved · tap Continue". Ruta `/work-orders/[id]`.
4. **Dejar notas y pedir trabajo** (HU-ME4): nota o Request Work en el detalle.
5. **Buscar una unidad y ver lo hecho** (Trucks y Completed).

## 5. Alcance
- **Incluido:** las rutas del punto 2 con la cuenta de Anthony, en teléfono (375 px)
  y computadora (1366 px), claro y oscuro, inglés y español.
- **Excluido:** el espacio del mecánico PM (`mecanico-pm`), Safety (`safety-qc`) y las
  pantallas del Manager. El historial del camión (`/trucks/[id]/history`) solo se miró
  como destino de Trucks.
- **Restricciones:** no reiniciar la base ni los servidores; no actuar con la cuenta
  de Daniel ni sobre WO-016.

## 6. Lo que ya se sabe
- **Reglas que no se reportan como hallazgos:**
  - D11: cada Job tiene un dueño; el mecánico completa solo los suyos y ve "Other
    work" en solo lectura.
  - D12: el mecánico no pausa; solo bloquea. La pausa oficial es del Manager.
  - D17: el bloqueo es de un Job, uno a la vez; solo el Manager lo resuelve; el
    mecánico agrega notas. Break, End of Shift y otro camión no son motivos.
  - D18: el tiempo es por mecánico y se detiene al terminar o bloquear su último Job
    disponible; vuelve a correr con Start/Continue.
  - D20: el día se cierra solo a las 5:00 p.m.; al día siguiente toca Continue.
  - D21: el reloj corre en un solo camión; Start/Continue en otro cierra el anterior.
  - D23: el ayudante tiene su propio Job "· helper".
  - D8: las notas solo se agregan; Request Work llega al Dashboard del Manager.
  - Un Standard no crea Work Orders (LTR-180).
- **Trabajo previo:** recorrido de pantallas del 2026-09-29 (W11–W13 arreglados en
  LTR-189: Completed lista Jobs, "Complete job" visible, ayuda del bloqueo arriba).
  `docs/OPEN_ISSUES.md` §1d.

## 7. Pendientes
- **Supuesto:** el mecánico usa la app en inglés o español según la persona; se
  revisó en los dos. Confirmar con el dueño qué idioma usa cada mecánico.
- **Supuesto:** la señal en el taller es irregular (como en el patio para Safety).
  Confirmar con el dueño.
- WO-009 (pausa oficial) y WO-015 (cancelada) no son de Anthony: el estado "Paused by
  the Manager" con datos no se vio con esta cuenta.
