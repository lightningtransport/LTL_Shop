# Pendientes: defectos, limpieza y salida en vivo

**Actualizado:** 2026-09-29

Una sola lista de lo que falta. Cuando algo se arregla, se borra de aquí
(el historial queda en git y en Linear). El orden es el orden de trabajo.

## 1. Defectos: flujos que se atoran

| # | Problema | Qué pasa | Dónde |
|---|---|---|---|
| 1 | **WO atorado en `created`** — **confirmado en producción** (WO-009, Truck 607, 2026-09-29) | Solo el Start del mecánico Standard pasa el WO de `created` a `in_progress`. `startPmJob` y `completePmJobInTx` marcan el Job de PM pero no cambian el WO ni abren sesión; completar Jobs desde Admin tampoco. Resultado: si el único que trabajó fue el mecánico de PM y el Manager completó el resto, el WO queda en `created` con todos los Jobs `completed`. El siguiente paso muestra "Close Work Order", pero la API responde 400 *"Work Order must be in progress to finish"* y la tarjeta de cierre del detalle ni aparece. Tampoco se puede hacer Start (no hay Jobs pendientes). Sin salida salvo cancelar. Efecto extra: el tiempo de trabajo del PM queda en 0. **WO-009 necesita un ajuste manual en producción** después del arreglo. | `apps/api/src/work-orders/work-orders.service.ts` (`startPmJob` ~l. 1469, `completePmJobInTx`), `apps/api/src/admin/admin.service.ts` (~l. 1042), `apps/web/src/components/admin-work-order-detail.tsx` (`canCompleteWorkOrder` ~l. 115), `packages/shared/src/truck-next-step.ts` (l. 112) |
| 2 | **Bloqueos huérfanos** | Cancelar el WO o el Job no resuelve el bloqueo de ese Job. Si el Manager completa un Job bloqueado, el bloqueo sigue activo y el siguiente paso se queda en "Resolve". | `AdminService.cancelWorkOrder`, `cancelJob`, `completeJob` |
| 3 | **Custom Jobs sin revisión** | Quedan en `review_status = pending_review` para siempre; nada los mapea al catálogo (ver P5 en `DECISIONS.md`). | `work-orders.service.ts` (l. 367, 951) |
| 4 | **Inspección que se hereda** *(sin verificar de punta a punta)* | Cancelar un WO no cierra la evaluación donde se guarda la inspección; solo Return to Service la cierra. El resultado podría pasar al siguiente WO del mismo Truck. | `yard-operations.service.ts`, `yard-work-plan.service.ts` |
| 5 | **"Mechanic note: undefined"** *(sin confirmar en producción)* | Reportado en la revisión de UX del 27-sep; posiblemente cerrado por LTR-86 / LTR-172. Verificar. | — |
| 6 | **Texto de QC contradice D15** | `workPlanQcHint` y `workPlanReadyAutomatic` dicen que Quality Check es opcional; QC siempre es obligatorio. En ES además dice "Quality Check" en lugar de "Control de calidad". | `apps/web/src/lib/admin-messages.ts` (EN ~l. 712/731, ES ~l. 1449/1468; también `truckNextStepQc`) |


## 1b. Defectos menores de la UI móvil (LTR-165, revisión 2026-09-29)

| # | Problema | Dónde |
|---|---|---|
| U1 | **Archivo de build en git:** `apps/web/.next-d14/trace` quedó en el repo (#207) y `.gitignore` no cubre `.next-d14`. | `.gitignore`, `apps/web/.next-d14/` |
| U2 | `next-env.d.ts` apunta a `./.next-e2e/types/routes.d.ts` (ruta local generada). | `apps/web/next-env.d.ts:3` |
| U3 | En el teléfono, las listas con solo búsqueda (Trucks) ya no tienen botón **Clear** (solo se muestra desde `md`). | `apps/web/src/components/ui.tsx` ~l. 862 |
| U4 | iPad con la app instalada: el bloque de nombre/rol del menú lateral queda debajo del indicador de inicio (se quitó el padding seguro del contenedor). *(LTR-171)* | `apps/web/src/components/admin-shell.tsx:62` |
| U5 | El color de la barra de estado sigue al tema del sistema, no al tema elegido en la app (sistema oscuro + app en Light = barra oscura sobre app blanca). *(LTR-171)* | `apps/web/src/app/layout.tsx:50` |
| U6 | Con cambio de contraseña pendiente, el botón de perfil abre primero la hoja de contraseña; para cambiar de idioma hay que cerrarla. | `apps/web/src/components/ui.tsx` ~l. 414 |
| U7 | `moreActionsHelp` dice que "More actions" incluye corrección de tiempos; ahora está en "History and audit". | `admin-messages.ts` (~l. 35 / 773) |
| U8 | Nueve textos del catálogo Admin quedaron sin uso al quitar descripciones (`completeWorkOrderDescription`, `jobsDescription`, `workRequestHint`, …). | `admin-messages.ts` |
| U9 | Admin en español todavía dice "unidad(es)" en algunos textos y en el selector de Truck de Nuevo Work Order (la regla de LTR-170 es "Trucks"). | `admin-messages.ts` (~l. 988, 1007, 1382–1393) |
| U10 | `POST …/work-plan/jobs`: si falla a mitad de camino, quedan Jobs agregados sin registro de idempotencia y el reintento recibe `VERSION_CONFLICT`; dos reintentos simultáneos con la misma clave chocan en el índice único. *(Existía antes de #206.)* | `apps/api/src/admin/yard-work-plan.service.ts` ~l. 255–290 |

## 2. Pruebas

- Las 16 pruebas e2e corren **solo contra la API falsa** (`apps/web/e2e/fixtures/admin-api.mjs`),
  nunca contra la API y la base de datos reales. Los defectos 1 y 2 no están
  cubiertos.
- La API falsa responde con una lista a cualquier `POST /api/work-orders*`
  que no conoce (mismo error que arregló LTR-172 para notas). Start y
  Complete Job solo funcionan en las pruebas que los interceptan.
- Sin prueba e2e: marcar un pedido de trabajo como atendido, "Agregar pasos
  que faltan", `/reset-password`, `/access-denied`.
- Sin prueba (LTR-165): tarjetas de las listas en el teléfono y su
  accesibilidad, barra de búsqueda en el teléfono, padding seguro del menú
  lateral, idioma de `global-error.tsx`, códigos de conflicto de idempotencia
  vs versión.
- Sin spec de API: `pauseWorkOrder` (admin), `closeAssessment`, controladores
  de users/trucks, `activity-log.service`.

## 3. Limpieza de código

Código que confunde porque ya no es parte del flujo (ver `SYSTEM.md` §10):

- Endpoints de readiness sin pantalla: `POST /admin/trucks/:id/readiness-assessments`,
  `PATCH /admin/readiness-assessments/:id/requirements/:type`, `…/mark-ready`,
  `…/close`. `deriveReadiness` (`yard-operations-derivation.ts`) ya no se
  llama. Textos `markReady*` sin usar en `admin-messages.ts`.
- Endpoints de equipo `POST/DELETE /admin/work-orders/:id/mechanics`
  (`@deprecated`).
- `POST /admin/work-orders/:id/jobs` (la UI usa `trucks/:id/work-plan/jobs`).
- `POST /work-orders/:id/jobs` del mecánico (siempre responde 403).
- Formulario Standard muerto en `apps/web/src/app/work-orders/new/page.tsx`
  (categoría, Jobs, "Select mechanics").
- Pausa/reanudar/terminar del mecánico: solo sirven para WOs de PM legacy.
  Decidir cuándo se cierran las que queden abiertas y quitar ese código.
- Columna `pmAuthorized`.
- Comentarios viejos: `schema.prisma` en `ShopWorkflowStep` ("runtime still
  reads MANDATORY_WORK_PLAN_JOBS") y la migración `20260928030000`.
- `supabase/migrations/20260825140000_init_domain.sql`: copia congelada;
  borrarla o dejarle un README que lo diga.

## 4. Idioma

- 62 textos `locale === 'es' ? … : …` escritos directo en 13 archivos, fuera
  de los catálogos (más en `reset-password`, `trucks/[id]/history`,
  `ui.tsx`). LTR-167 agregó 5 en el menú de perfil (Idioma, Tema, Claro,
  Oscuro, Auto) aunque la clave `language` ya existe en el catálogo.
- Textos solo en inglés en pantallas de PM legacy y nuevo WO ("Resume Work",
  "Change Pause Reason", "Jobs To Do", "Create failed", "Action failed"…).
- 29 lugares leen `.message` de errores de la API (siempre en inglés) y lo
  muestran al usuario, también en español. `app/error.tsx` y
  `global-error.tsx` ya están traducidos (LTR-170).

## 5. Para salir en vivo

Detalle en [`GO_LIVE_CHECKLIST_ES.md`](GO_LIVE_CHECKLIST_ES.md).

- Roster real y `work_orders.manage` para los Managers reales (P6).
- Usuarios reales en Supabase Auth; `AUTH_DEV_BYPASS` apagado en producción.
- Carga única de camiones de Ninox, si la flota de producción no está completa.
- Smoke con un Manager y un mecánico reales, incluido Safari en un iPhone real.
- Validar en datos de producción: Truck Detail (LTR-59) y Ready vs Complete
  vs Return to Service (LTR-60, LTR-123). Cerrar la épica LTR-149.

## 6. Fuera de alcance (no se construye hasta decidirlo)

- Presencia física en el patio (Samsara), McLeod, Dispatch, Schedule_Teams.
- Off Duty (P2), editor de camiones (P1), trailers como activos (P3),
  sincronizar con Ninox (P4).
- Pantallas para escribir catálogo, roster, categorías y permisos (hoy solo
  por API o nada).
- Rendimiento por Job, tiempos por Job, espera por motivo.
- Espacios de trabajo de Detailing, Body Shop, Trailer e Inspector.
- Notificaciones push (decidido: solo dentro de la app).
