# Runbook — Flujo v3 (D11–D18)

**Clasificación:** IMPLEMENTATION PLAN
**Fecha:** 2026-09-27
**Épica Linear:** LTR-149 (ver "Issues" abajo)
**Fuente de producto:** [`../ux/FLUJOS_Y_MEJORAS_2026-09-27.md`](../ux/FLUJOS_Y_MEJORAS_2026-09-27.md) — §4 y §12 son las decisiones; §11 la revisión contra código; §5 el flujo objetivo; §6 los cambios por pantalla.

Prompts listos para ejecutar **un PR por sesión** con un modelo de menor costo. Cada prompt es autocontenido: objetivo, decisiones que aplica, archivos de partida, criterios de aceptación y verificación. No empezar un PR hasta que el anterior esté mergeado, salvo que la tabla diga que no depende.

---

## Cómo usar este runbook

1. Abrir un chat nuevo. Pegar el **preámbulo común** y luego **un solo** prompt de PR.
2. El modelo trabaja en la rama que Linear sugiere para el issue (`cristian/ltr-XX-…`), abre PR contra `main` y **no mergea**.
3. Revisar el PR (Vercel Preview + smoke del caso) y mergear.
4. Marcar el issue Done y pasar al siguiente.

Si el modelo encuentra una contradicción entre este runbook y el código, debe **parar y reportarla**, no decidir solo. Las decisiones de producto están cerradas en §12 del doc UX; no se reabren en un PR.

---

## Preámbulo común (pegar al inicio de cada prompt)

```
Estás implementando UN PR del "Flujo v3" del monorepo Lightning Shop (LTL_Shop).
Antes de editar, lee:
- docs/ux/FLUJOS_Y_MEJORAS_2026-09-27.md: §4, §5, §11, §12 completos, y la parte de §6 que toque tu PR.
- docs/CURRENT_PRODUCT_STATUS.md: secciones "Yard Operations and readiness", "Standard mechanic work orders" y "Work Order ownership and permissions".
- docs/AGENT_WORKFLOW.md (task framing y verificación).
- El issue de Linear indicado en el prompt.

Reglas no negociables:
- Un PR = un issue. No mezcles PRs. No toques nada fuera del alcance indicado.
- Migraciones: solo en el PR marcado como migración. Prisma es la única autoridad
  (apps/api/prisma/migrations). Aditivas: columnas nullable o con default; enums de
  Postgres se agregan, nunca se borran. Nunca escribas SQL bajo supabase/.
- Autorización y reglas de negocio en la API, no solo en la UI.
- No rompas: auth, capabilities, Work Sessions, Pause Events, Activity Log,
  historial de WO/Repair, PM legacy, Admin shell, experiencia móvil del mecánico.
- Paridad EN/ES: cada string nuevo va en apps/web/src/lib/admin-messages.ts (Admin)
  o apps/web/src/lib/locale-context.tsx (mecánico), en ambos idiomas. Los nombres
  de catálogo (Detailing, Quality Check, Alignment) no se traducen.
- Reglas bloqueadas (doc 03 / README): 1 WO abierta por truck; Create ≠ Start;
  completar Job ≠ completar WO; WO Completed ≠ Ready to Go ≠ Return to Service;
  timers desde timestamps persistidos.
- Si algo del prompt contradice el código o el doc, PARA y repórtalo. No decidas producto.

Entorno:
- La ruta del workspace tiene espacios y dos puntos. Invoca binarios por ruta
  absoluta entre comillas o haz cd al paquete. No agregues node_modules/.bin al PATH.
- Deps faltantes: NODE_ENV=development npm install --include=dev
- Compila shared antes de los tests de API: npm run build --workspace=@ltl-shop/shared
- Flags locales: YARD_WORK_PLAN_SLICE1=true YARD_WORK_PLAN_SLICE2=true
  WORK_PLAN_PM_PHASE=true (hasta que el PR 0 las retire).
- E2E con fixture (LTR-163): Playwright hace un build de producción (`.next-e2e`) y lo
  sirve en 3010, con la API fixture en 3101. La suite completa tarda ~7 min, corre sin
  reintentos y con un solo worker. Usa esos puertos: no corras dos suites a la vez en
  la misma máquina.

Definition of done:
- Todos los criterios de aceptación del prompt.
- Pasa:
  npm run lint --workspace=@ltl-shop/api
  npm run lint --workspace=@ltl-shop/web
  npm run test --workspace=@ltl-shop/shared
  npm run test --workspace=@ltl-shop/api
  npm run test --workspace=@ltl-shop/web
  npm run build
  git diff --check
  ADMIN_E2E_FIXTURE=1 npm run test:e2e --workspace=@ltl-shop/web  (al menos los specs listados en el prompt)
- Test primero para lógica: un test que reproduce el caso (rojo) antes del fix (verde).
  Las funciones de derivación / timing son puras: se prueban sin DB.
- Actualiza docs/CURRENT_PRODUCT_STATUS.md en el mismo PR (solo la sección afectada).
- Screenshots antes/después en la descripción del PR si cambia layout (móvil 375 px
  para pantallas de mecánico).
- Commit con mensaje "<qué> (LTR-XX)". PR contra main. No mergear.
- No incluyas .cursor/, supabase/.temp/ ni archivos de entorno en el commit.
```

---

## Orden y dependencias

| # | PR | Issue | Depende de | Migración |
|---|---|---|---|---|
| 0 | Flags como único modo | LTR-150 | — | no |
| 1 | Errores rápidos (§8) | LTR-151 | — | no |
| 2 | Vocabulario EN/ES (§7) | LTR-152 | 1 | no |
| 3 | Migración A: labor por mecánico + bloqueo por job | LTR-153 | 0 | **sí** |
| 4 | Dueño de cada job (D11, D18) | LTR-154 | 2, 3 | no |
| 5 | Reglas del bloqueo (D12, D17) | LTR-155 | 4 | no |
| 6 | Migración B: flujo del taller | LTR-156 | 0 | **sí** |
| 7 | Flujo del taller + crear WO simple (D13, D15, D16) | LTR-157 | 4, 6 | no |
| — | **Boceto de pantallas aprobado** (gate) | LTR-158 | 5, 7 | — |
| 8 | Truck como lugar de trabajo (D14, LTR-123) | LTR-158 | boceto | no |
| 9 | Coherencia Dashboard / Yard | LTR-159 | 8 | no |

PR 0, 1 y 6 pueden correr en paralelo entre sí. PR 3 puede correr en paralelo con 1 y 2.

---

## PR 0 — Flags como único modo

**Issue:** LTR-150 · **Depende de:** nada.

**Objetivo.** `YARD_WORK_PLAN_SLICE1`, `YARD_WORK_PLAN_SLICE2` y `WORK_PLAN_PM_PHASE` pasan a ser el único comportamiento. Se retira el código del modo "flag off" (Phase 1 seis gates, Mark Ready explícito, WO sin jobs obligatorios). Producción ya corre con las tres encendidas.

**Archivos de partida.**
- `apps/api/src/admin/yard-work-plan-flag.ts` (las tres funciones).
- Llamadores: `apps/api/src/work-orders/work-orders.service.ts`, `mandatory-jobs.ts`, `apps/api/src/admin/{admin.controller,admin.service,yard-work-plan.service,yard-work-plan-derivation,yard-operations.service}.ts`, `apps/api/src/trucks/trucks.service.ts`, `apps/web/src/components/{admin-truck-work-plan,work-plan-add-work,admin-truck-detail}.tsx`, `apps/web/src/lib/yard-operations-routing.ts`.
- `YARD_READY_TO_GO_SINCE` (`apps/api/src/admin/yard-ready-window.ts`) **se conserva** como configuración; documentarla.

**Criterios de aceptación.**
1. Las tres funciones desaparecen o devuelven siempre `true`; ninguna rama del código depende del valor de la variable de entorno.
2. Se elimina la UI de seis gates y "Mark Ready to Go" de `admin-truck-detail.tsx` (ramas cuando `workPlan` está ausente). Los endpoints de mutación de gates pueden quedar hasta un PR de limpieza; márcalos `@deprecated`.
3. Tests y e2e que fijaban las flags dejan de hacerlo; los que probaban el modo off se eliminan con nota en el PR.
4. `docs/CURRENT_PRODUCT_STATUS.md`: quitar "default off" y describir un solo modo.
5. E2E verdes: `admin-truck-work-plan`, `yard-work-plan-board-cutover`, `pm-workflow`, `admin-truck-detail`, `yard-operations`.

---

## PR 1 — Errores rápidos (§8)

**Issue:** LTR-151 · **Depende de:** nada.

**Alcance.** Puntos de §8 **excepto** 1, 2 y 12. El 1 ("Mechanic note: undefined") no es reproducible en `main`: verificar en prod y cerrarlo si no aparece. El 2 (estado "In Progress" en pasos pendientes) se resuelve en PR 4. El 12 (WOs viejas) en PR 8.

**Archivos de partida y qué hacer.**
- 8.3 "Current Work" muestra WO completada: `apps/web/src/components/admin-truck-detail.tsx`; filtrar por estado abierto.
- 8.4 Mecánicos en el picker: la API filtra por capability (`apps/api/src/admin/admin.service.ts` ~96–100, ~1920–1936), no por rol. Agregar filtro `role !== 'admin'` en el listado usado por los pickers **y** paginar `useAdminMechanics` (`apps/web/src/lib/admin-data.ts` ~109–120, hoy solo trae 25).
- 8.5 "Complete job" ofrecido al Standard sobre el PM de otro: `apps/web/src/app/work-orders/[id]/detail-client.tsx`; no ofrecer si el job es PM y el usuario no es su assignee.
- 8.6 Selects sin etiqueta: `apps/web/src/components/admin-work-order-detail.tsx`; `aria-label` con el nombre del job.
- 8.7 Texto de Return to Service: `apps/web/src/lib/admin-messages.ts` (`returnToServiceDescription`, EN ~514 y ES ~1242). Debe decir que el truck **sale** de Ready to Go y pasa a In Service.
- 8.8 "1 Jobs pending": `yardCardJobsPending` (~241 y su par ES); plural correcto.
- 8.9 Métricas del Dashboard sin nombre accesible: `apps/web/src/components/admin-dashboard*.tsx`; `aria-label` con métrica y valor.
- 8.10 "Not recorded" vs "No mechanics assigned": unificar en `noMechanicsAssigned` para la lista de mecánicos.
- 8.11 "Saved" antes de escribir en PM: `apps/web/src/components/pm-service-card.tsx` o equivalente; mostrar solo tras un guardado real.

**Criterios de aceptación.** Cada punto con su test unitario o e2e (`ui-consistency`, `ux-regressions`, `admin-truck-detail`, `mechanic-flow`, `pm-workflow`). Paridad EN/ES.

---

## PR 2 — Vocabulario EN/ES (§7)

**Issue:** LTR-152 · **Depende de:** PR 1.

**Alcance.** Solo strings y el glosario. Los **estados reales de los jobs** (Pendiente / En curso) los introduce PR 4; aquí se preparan las claves.

**Qué hacer.**
- Aplicar la tabla de §7 en `admin-messages.ts` y `locale-context.tsx`. Claves nuevas: `jobStatusPending`, `jobStatusInProgress`, `jobStatusBlocked`, `woStatusPaused`, `jobUnassigned`, `inspectionStep`.
- Eliminar de la UI: "inherits the Work Order team" (todas sus variantes), "Mandatory for every yard Truck", "operational status from recorded service-status events…", "Under review" si queda algún resto.
- Actualizar `docs/design-system/glossary-en-es.md` con la tabla de §7 y citar LTR-118.

**Criterios de aceptación.** `grep -ri "inherit" apps/web/src` sin resultados en UI; spec de paridad (`admin-routing.spec.ts` / `locale-context.spec.ts`) verde; e2e `ui-consistency`.

---

## PR 3 — Migración A: labor por mecánico + bloqueo por job

**Issue:** LTR-153 · **Depende de:** PR 0. **Solo esquema, sin cambio de comportamiento.**

**Cambios en `apps/api/prisma/schema.prisma` + migración.**
1. `work_sessions.user_id` UUID **nullable**, FK a `users`. Índice `(work_order_id, user_id)`.
2. `pause_events.job_id` UUID **nullable**, FK a `work_order_jobs`.
3. Enum Postgres nuevo `blocker_reason`: `waiting_for_parts`, `waiting_for_approval`, `waiting_for_vendor`, `waiting_for_equipment`, `waiting_for_bay`, `waiting_for_driver`, `other`. Columna `pause_events.blocker_reason` **nullable**. `PauseReason` no se toca (lo sigue usando la pausa oficial).
4. Enum TS `BlockerReason` en `packages/shared/src/enums.ts` con etiquetas EN/ES.

**Criterios de aceptación.** `prisma migrate dev` limpio; `npm run prisma:release-status --workspace=@ltl-shop/api` OK; Prisma Client regenerado; ningún endpoint cambia de contrato; tests actuales verdes. Documentar en `CURRENT_PRODUCT_STATUS.md` como "columnas aditivas, sin uso hasta PR 4/5".

---

## PR 4 — Dueño de cada job (D11, D18)

**Issue:** LTR-154 · **Depende de:** PR 2, PR 3.

**Decisiones que aplica (§12).** D11 equipo derivado; D18 labor por mecánico; regla de estado del job.

**Regla de estado del job (sin nueva columna).** `completed` / `cancelled` como hoy. Si no: **En curso** cuando su assignee tiene una sesión de labor abierta en esa WO; **Pendiente** en cualquier otro caso. Esto arregla §8.2 ("In Progress · 1" con jobs pendientes).

**API.**
- `POST /work-orders/:id/start`: la sesión se crea con `userId` del actor. Un mecánico tiene a lo sumo una sesión abierta por WO.
- Cierre de sesión (`apps/api/src/work-orders/labor-session.ts`): se cierra la sesión **del mecánico** cuando completa su último job pendiente en la WO (no el último de la WO). Labor total de la WO = suma de sesiones. `laborRunning` en el DTO pasa a ser por actor.
- Asignación (`admin.service.ts` `assignJob` / `unassignJob`): al asignar, upsert en `mechanic_assignments`; al desasignar, si el mecánico no queda con ningún job en la WO, se desactiva su fila. No hay más "equipo" editable.
- Crear WO: `mechanicIds` deja de aceptarse (ignorar con warning de deprecación); el equipo sale de `jobs[].assignedMechanicId`.
- Lista y detalle del mecánico (`GET /work-orders`, `GET /work-orders/:id`): solo WOs donde tiene ≥1 job asignado; en el detalle, `myJobs` y `otherJobs` separados. `otherJobs` es solo lectura.
- Permisos: completar un job exige ser su assignee (o Manager). Se elimina la regla Q10 de "cualquier miembro del equipo".

**Web.**
- Admin WO detail: quitar la tarjeta "Assignments" (equipo). El assignee se cambia por job.
- Truck Work Plan: mostrar responsable por job y permitir cambiarlo ahí (`admin-truck-work-plan.tsx`).
- Mecánico Home: solo sus jobs, agrupados por truck, con el que sigue marcado. Cards muestran "Truck N · X jobs tuyos".
- Mecánico WO: sección "Tus jobs" con texto "Toca un job para completarlo"; abajo "Otro trabajo en este truck" sin botones. Al completar el último suyo: banner **"Terminaste tu parte en el Truck N"** y el tiempo se detiene.
- Estado del job con la regla de arriba en Truck, WO Admin y WO mecánico.

**Criterios de aceptación.**
1. Test: dos mecánicos en una WO; A completa sus jobs → la sesión de A se cierra, la de B sigue; labor de la WO = suma.
2. Test: job sin assignee no aparece en el Home de ningún mecánico y el Dashboard lo marca como "Sin asignar" (motivo `unassigned` en `packages/shared/src/attention.ts`, antes de `open_over_24h`).
3. Test: intentar completar un job ajeno → 403.
4. E2E `mechanic-flow`, `ownership-cutover`, `admin-truck-work-plan`, `blocker-lifecycle` actualizados.
5. `CURRENT_PRODUCT_STATUS.md` y Decision Log del PRD (`docs/LIGHTNING_SHOP_MASTER_PRD.md`, nueva entrada 2026-09-27: D11 reemplaza Q10/Q17; D18 reemplaza D7).

---

## PR 5 — Reglas del bloqueo (D12, D17)

**Issue:** LTR-155 · **Depende de:** PR 4.

**Decisiones que aplica (§12).** D17 reemplaza a D3 (solo Manager resuelve; mecánico agrega nota); bloqueo siempre por job; D12 (motivos recortados; el mecánico no pausa); D18 (su tiempo se detiene cuando no le queda job disponible; vuelve con Continuar).

**API.**
- `POST /work-orders/:id/blockers`: body `{ jobId, reason: BlockerReason, notes? }`. `jobId` obligatorio y debe ser un job asignado al actor. Guarda `pause_events.job_id` + `blocker_reason`. Sigue sin cambiar el estado de la WO ni los waiting totals de la pausa oficial.
- Al reportar: si el mecánico no tiene otro job en esa WO que esté pendiente y no bloqueado, se cierra **su** sesión de labor.
- `POST /work-orders/:id/blockers/:blockerId/resolve` (mecánico): **se elimina**. Nuevo `POST /work-orders/:id/blockers/:blockerId/notes` (append-only, autor + hora) para "ya llegó la parte".
- `POST /admin/work-orders/:id/blockers/:blockerId/resolve`: sigue igual; nota opcional. Al resolver, el job vuelve a "asignado"; el tiempo **no** arranca solo.
- `POST /work-orders/:id/start` sirve como "Continuar": reabre la sesión del mecánico.
- Motivos disponibles para el mecánico: solo `BlockerReason` (sin Break, End of Shift, Working on Another WO, Truck Unavailable). `PauseReason` queda para la pausa oficial del Manager.
- Derivación: un job con blocker activo se muestra "Bloqueado · motivo" en Truck, Yard, WO y Home. `attention.ts`: el motivo `blocker` lleva `jobName`, `reason`, `reportedBy`, `reportedAt`.

**Web.**
- Mecánico WO: "Reportar bloqueo" por job (botón en el job, no global). Sin "Mark resolved". Job bloqueado con "Bloqueado · motivo" y campo de nota. "Continuar" visible cuando el Manager resolvió y el mecánico no tiene sesión abierta.
- Mecánico Home: sección "Paused" pasa a **"Pausada por el Manager"** (solo lectura, con motivo). Se quita cualquier control de pausa del Standard. PM legacy (`/mechanic/pm`) no se toca.
- Manager: botón **Resolver** con nota opcional en tres lugares: item de "Needs attention" del Dashboard, cabecera del Truck, tarjeta de bloqueos de la WO. Los tres muestran nota, quién y cuándo.

**Criterios de aceptación.**
1. Test: mecánico con jobs J1 y J2 bloquea J1 → sesión sigue; bloquea J2 → sesión se cierra.
2. Test: Manager resuelve → job vuelve a Pendiente, `laborRunning=false` hasta que el mecánico toca Continuar.
3. Test: `PauseReason.BREAK` como motivo de bloqueo → 400.
4. Test: mecánico intenta resolver → 404/403.
5. E2E `blocker-lifecycle` reescrito para el ciclo completo; `mechanic-flow`; `admin-shell` (Dashboard).
6. `CURRENT_PRODUCT_STATUS.md` (sección de blockers reescrita) y doc 16 de Linear: fila "D17 reemplaza a D3".

---

## PR 6 — Migración B: flujo del taller

**Issue:** LTR-156 · **Depende de:** PR 0. **Solo esquema.**

**Cambios.** Tabla `shop_workflow_steps`: `id`, `step_key` (enum TS: `pm`, `alignment`, `detailing`, `quality_check`; extensible), `catalog_job_id` FK, `default_mechanic_id` UUID nullable FK `users`, `sort_order` int, `active` bool, `updated_by`, `updated_at`. Seed: las 4 filas con los ids de catálogo que hoy usa `MANDATORY_WORK_PLAN_JOBS` y `default_mechanic_id = null`.

**Criterios de aceptación.** Igual que PR 3. Sin uso en runtime hasta PR 7.

---

## PR 7 — Flujo del taller + crear WO simple (D13, D15, D16)

**Issue:** LTR-157 · **Depende de:** PR 4, PR 6.

**Decisiones que aplica (§12).** D15 QC sin responsable; D16 pantalla en Setup; D13 crear WO solo con truck; responsable inactivo → Sin asignar; Create PM autoasigna al `mechanic.pm` que arranca.

**API.**
- `GET/PUT /admin/setup/workflow-steps` (capability `work_orders.manage`; System Admin también). Validación: un paso por `step_key`; `default_mechanic_id` debe tener la capability que corresponde (`mechanic.pm` para `pm`, `mechanic.standard` para los demás); **`quality_check` no admite responsable** (D15).
- `WorkOrdersService.create` (Manager): `jobs` pasa a ser opcional; si viene vacío, la WO nace solo con los pasos obligatorios. `MANDATORY_WORK_PLAN_JOBS` se reemplaza por la lectura de `shop_workflow_steps` activos, en `sort_order`, cada uno con `assignedMechanicId = default_mechanic_id` si ese usuario está activo; si no, `null`.
- `primaryCategoryId` se deriva: primer job de Shop Work si existe, si no, categoría PM. No se pide en el formulario. No se elimina la columna (PRD §9).
- PM: cuando un `mechanic.pm` arranca el PM job (`/pm/start`), se autoasigna si el job no tiene assignee o su assignee no es él (respetando D2).

**Web.**
- Admin → Setup → **"Flujo del taller"**: tabla paso → job de catálogo → responsable por defecto (select filtrado por capability; QC muestra "Manager, sin asignación"). Advertencia si el responsable está inactivo. Guardar con toast.
- Crear WO (`admin-new-work-order.tsx` y `work-orders/new`): solo truck, prioridad, nota. Sin categoría ni jobs. Texto: "La WO nace con PM, Alignment, Detailing y QC. Agrega trabajo extra desde el Truck después de la inspección".
- Listas de WO y cards (§12, pregunta 6): "Truck 922 · 5 jobs · Siguiente: PM" en lugar de la categoría.

**Criterios de aceptación.**
1. Test: crear WO sin jobs → 4 jobs con responsables por defecto; QC sin assignee.
2. Test: responsable por defecto inactivo → job `assignedMechanicId=null` y motivo `unassigned` en attention.
3. Test: PUT con QC + responsable → 400.
4. E2E `admin-new-work-order`, `admin-system-admin-writes` (Setup), `pm-workflow`.
5. `CURRENT_PRODUCT_STATUS.md`.

---

## Gate — Boceto de pantallas

Antes de PR 8, el ejecutor entrega en el issue LTR-158 un boceto (markdown/ASCII o imagen) de: Truck del Manager (con "Siguiente paso" arriba), Flujo del taller, inicio del mecánico, WO del mecánico. **Cristian aprueba en el issue** antes de que se escriba código de PR 8.

---

## PR 8 — Truck como lugar de trabajo (D14, LTR-123)

**Issue:** LTR-158 · **Depende de:** boceto aprobado, PR 5, PR 7.

**Decisiones que aplica (§12).** D14 inspección arriba y del Manager; D15 "Mark complete" primario solo en QC; WOs viejas con botón "Agregar pasos que faltan"; cerrar y Return to Service desde el Truck.

**Fuera de PR 8.** Elegir quién hace cada job al agregarlo en "Hallazgos" (D14) salió en un PR aparte: `POST /admin/trucks/:id/work-plan/jobs` respeta `assignedMechanicId` también con la WO abierta, y el formulario del Truck tiene "¿Quién lo hace?" por job. PR 8 no lo incluye.

**API.**
- `GET /admin/trucks/:id` devuelve `nextStep` calculado por **una** función nueva `deriveTruckNextStep` en `apps/api/src/admin/yard-work-plan-derivation.ts` (o módulo hermano): `{ kind: 'inspect' | 'assign' | 'resolve_blocker' | 'work' | 'qc' | 'close' | 'return_to_service' | 'none', jobId?, blockerId?, label }`. Orden de prioridad: bloqueo activo → inspección pendiente → job sin asignar → QC listo → listo para cerrar → Ready to Go pendiente de RTS → trabajo en curso.
- `POST /admin/trucks/:id/work-plan/backfill-mandatory`: agrega los pasos del flujo que falten a la WO abierta (solo para WOs anteriores a `WORK_PLAN_PM_PHASE`). Activity Log.
- Cerrar WO y Return to Service: se exponen también desde el Truck reutilizando los endpoints de Admin WO. Return to Service: **motivo opcional** (cambiar el schema en `packages/shared/src/schemas.ts` ~233–235 y la UI).

**Web (`admin-truck-detail.tsx`, `admin-truck-work-plan.tsx`).**
- Cabecera: estado + **Siguiente paso** con su botón (inspeccionar / asignar / resolver / cerrar / Return to Service). Cubre LTR-123 para el Truck.
- Inspección arriba, antes de los datos del truck. Datos del truck (11 campos) colapsados.
- Work Plan con responsable por job editable inline; "Mark complete" secundario salvo en QC.
- Botones "Cerrar Work Order" y "Return to Service" en el Truck. "Agregar pasos que faltan" cuando la WO abierta no tiene los pasos obligatorios.
- WO Admin: acciones raras (cancelar, reabrir, corregir tiempo) plegadas en un bloque "Más acciones".
- Mecánico PM: PM arriba, datos del truck plegados, una sola tarjeta "PM", sin mensajes de pausa, "Reportar bloqueo" disponible en el PM.

**Criterios de aceptación.**
1. Tests unitarios de `deriveTruckNextStep` para cada `kind`, incluida la WO vieja sin pasos.
2. Cerrar la WO desde el Truck deja el truck Ready to Go; Return to Service desde el Truck lo saca.
3. E2E `admin-truck-detail`, `admin-truck-work-plan`, `pm-workflow`, `ux-regressions`. Screenshots antes/después.
4. Cerrar LTR-123 y validar LTR-59 en el PR.

---

## PR 9 — Coherencia Dashboard / Yard

**Issue:** LTR-159 · **Depende de:** PR 8.

**Objetivo.** Una sola regla de "siguiente paso" en las cuatro superficies. Hoy hay cuatro: `yard-work-plan-derivation.ts` (API), `apps/web/src/lib/work-plan.ts` (Truck), `apps/web/src/lib/yard-card.ts` (Yard), `apps/web/src/lib/admin-next-step.ts` (WO, basado solo en el estado de la WO).

**Qué hacer.**
- Las tres funciones web consumen `nextStep` del servidor (PR 8) y se eliminan o quedan como adaptadores de presentación sin lógica.
- Dashboard "Needs attention": cada item muestra el **motivo** ya existente (`attention.ts`) más el **botón** de la acción (Resolver / Asignar / Cerrar) que navega o ejecuta inline. Métrica nueva: trucks Ready to Go (usar `yard-ready-window.ts`).
- Yard: la tarjeta muestra el mismo `nextStep` y, si hay bloqueo, "Bloqueado · motivo". Return to Service disponible desde la tarjeta de un truck Ready to Go.
- Lista de trucks: columna "Siguiente paso"; el estado "In Service" no se muestra si hay WO abierta.

**Criterios de aceptación.**
1. Test de contrato: para un mismo truck seed, Dashboard, Yard, Truck y WO devuelven el mismo `nextStep.kind`.
2. Caso 905 (WO vieja) coherente en las cuatro superficies.
3. E2E `yard-operations`, `yard-work-plan-board-cutover`, `admin-shell`.
4. Validar LTR-60 y cerrar la épica. `CURRENT_PRODUCT_STATUS.md` y `docs/audit/CURRENT_VS_TARGET.md`.

---

## Issues

Épica: [LTR-149](https://linear.app/ltransl/issue/LTR-149). Hijos, en orden: LTR-150 (PR 0), LTR-151 (PR 1), LTR-152 (PR 2), LTR-153 (PR 3, migración A), LTR-154 (PR 4), LTR-155 (PR 5), LTR-156 (PR 6, migración B), LTR-157 (PR 7), LTR-158 (PR 8, incluye el gate del boceto), LTR-159 (PR 9). Cada issue enlaza a su sección de este runbook. Al terminar PR 9 se validan LTR-59 y LTR-60 y se cierra LTR-123.
