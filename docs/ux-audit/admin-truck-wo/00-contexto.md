# 00 · Contexto y acceso — Lightning Shop Admin (Truck y Work Order)

**Fecha:** 2026-10-05 · **Auditor:** Claude (skill audit-ux) con el dueño del producto
**slug:** admin-truck-wo

## 1. Producto
- **Qué es:** Admin de Lightning Shop, la app del taller de camiones de Lightning
  Transport: recibir camiones, repartir y seguir el trabajo, destrabar y devolver
  a servicio.
- **Usuarios objetivo:** Shop Manager (rol principal de esta auditoría). Administrador
  con los mismos permisos. System Admin y otros roles con acceso de solo lectura al Admin.
- **Contexto de uso:** el Manager usa el teléfono caminando por el taller y la
  computadora en la oficina (`docs/USER_FLOWS.md` §1). Interrupciones frecuentes;
  necesita saber de un vistazo qué frena a cada camión.
- **Plataformas:** web responsive e instalable (PWA). Escritorio Chrome/Safari, iPhone
  Safari e iPad.
- **Idioma(s) de la interfaz:** inglés y español, los dos completos (LTR-181).

## 2. Repositorio
- **Ruta local:** `/Users/cristianperez/LTL SHOP : ADMIN : MECHANICS/LTL_Shop`
  (esta auditoría se hace en el worktree `.claude/worktrees/ui-screen-improvement-baa9cf`,
  rama `claude/ui-screen-improvement-baa9cf`).
- **Estructura relevante:** `apps/web` (Next.js 15, frontend), `apps/api` (NestJS),
  `packages/shared` (tipos, enums y la regla única del siguiente paso).
- **Stack de frontend:** React 19, Tailwind 3, primitivas propias estilo shadcn en
  `apps/web/src/components/ui.tsx` (CVA y Radix vía `radix-ui`). Design system en
  `docs/design-system/`.
- **Dónde viven:**
  - Rutas: `apps/web/src/app/admin/trucks/[id]`, `apps/web/src/app/admin/work-orders/[id]`.
  - Pantallas: `components/admin-truck-detail.tsx` (+ `admin-truck-work-plan.tsx`,
    `admin-truck-next-step.tsx`, `admin-readiness-tracker.tsx`, `work-plan-add-work.tsx`,
    `category-job-list.tsx`) y `components/admin-work-order-detail.tsx`
    (+ `admin-job-table.tsx`, `admin-blocker-resolve.tsx`).
  - Textos: `apps/web/src/lib/admin-messages.ts` (catálogos EN y ES).
  - Siguiente paso: `packages/shared/src/truck-next-step.ts`.
  - Tokens: `apps/web/src/app/globals.css`, `apps/web/tailwind.config.js`.

## 3. Acceso a la app corriendo
- **Producción:** `https://ltl-shop-web.vercel.app`, con la sesión admin que el dueño
  abrió en el panel del navegador. **Solo lectura:** se abren pantallas y paneles, no se
  envía ningún formulario ni se pulsa ningún botón que cambie datos. Verificado el
  2026-10-05: Trucks 601 (WO-004 en progreso) y 282 (Ready to Go).
- **Local con datos falsos:** API de fixture `node apps/web/e2e/fixtures/admin-api.mjs`
  (puerto 3101) y web con
  `NEXT_DIST_DIR=.next-uisi NEXT_PUBLIC_API_URL=http://127.0.0.1:3101 next dev --port 3030`.
  Se entra con "Dev login" y una cuenta de la fixture (los correos están en
  `admin-api.mjs`, líneas 3-75). Limitación: todos los Trucks empiezan con el Work Plan
  vacío; los estados ricos se simulan como en `e2e/admin-truck-work-plan.spec.ts`.
- **Roles para probar:**
  - Manager y Admin: todo.
  - System Admin: solo lectura.
  - Mecánico, PM y Safety: no usan estas pantallas.
- **Datos de prueba:** producción tiene WOs reales de prueba (WO-001…WO-010).

## 4. Flujos críticos (en orden de importancia)
Salen de los jobs to be done de `docs/USER_FLOWS.md`:

1. **Recibir e inspeccionar un camión** (J1, HU-M1/M2): saber qué hay que hacerle y
   cargar el trabajo. Truck → inspección → Add work. Rol: Manager.
2. **Repartir el trabajo** (J2, HU-M3, HU-M10): dueño por Job, ayudante. Work Order (y
   asignar en el Truck). Rol: Manager.
3. **Destrabar** (J3, HU-M4, HU-M11): blocker → Resolve, Pause/Resume, taller externo.
   Truck, Work Order y Dashboard. Rol: Manager.
4. **Cerrar y devolver a servicio** (J4, HU-M5): QC (respaldo), Close, Return to Service.
   Truck y Work Order. Rol: Manager.
5. **Corregir sin romper el historial** (J10, HU-A1): tiempos, cancelar o reabrir.
   Work Order. Rol: Manager o Admin.

## 5. Alcance
- **Incluido:** `/admin/trucks/[id]` y `/admin/work-orders/[id]`, Manager y solo
  lectura, escritorio y teléfono. La pregunta central es **qué tarea vive en cada
  pantalla y si el reparto tiene lógica**.
- **Excluido:**
  - Dashboard, Yard y listas: se mencionan solo como puntos de entrada.
  - Pantallas del mecánico, PM y Safety.
- **Restricciones:** producción solo en lectura. Sin cambios de código de la app: la
  auditoría alimenta las propuestas en `docs/proposals/`.

## 6. Lo que ya se sabe
- **Definición vigente** (`docs/SYSTEM.md` §6):
  - El Truck es el lugar de trabajo del Manager y responde "¿puede salir y, si no, qué
    lo frena?".
  - El detalle de la WO es donde se reparte y ejecuta el trabajo.
  - El siguiente paso es una sola regla para todas las pantallas (LTR-159).
- **Decisiones que no se reportan como hallazgos:**
  - D6: los Jobs se agregan desde el Truck.
  - D14: la inspección la hace el Manager en el Truck.
  - D11: un dueño por Job.
  - D23: el ayudante es otro Job.
  - D24: taller externo.
  - D1: Ready to Go necesita la WO cerrada.
- **Trabajo previo:**
  - Propuesta de rediseño de WO Detail aprobada en dirección visual:
    `docs/proposals/wo-detail-redesign/` y `docs/OPEN_ISSUES.md` §1e.
  - Inventario completo del Truck Detail (acciones, estados, textos), hecho el
    2026-10-05 al preparar esta auditoría.

## 7. Pendientes
- Validar con el dueño, después de `05-navegacion-ia.md`, el reparto de tareas entre
  Truck y Work Order (punto de control del plan).
- No hay métricas de uso (qué pantalla abre más el Manager). Supuesto: el Manager
  llega al Truck desde Yard o Dashboard y a la WO desde el Truck o la lista. Se
  confirma con el dueño.
