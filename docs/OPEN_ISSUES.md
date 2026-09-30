# Pendientes: defectos, limpieza y salida en vivo

**Actualizado:** 2026-09-29 (Fase A hecha; cuestionario de operación)

Una sola lista de lo que falta. Cuando algo se arregla, se borra de aquí
(el historial queda en git y en Linear). El orden es el orden de trabajo.

## 0. Cómo terminamos esto (plan de cierre)

**Linear:** épica [LTR-173](https://linear.app/ltransl/issue/LTR-173). Cada fase y cada defecto B/C tiene su issue hijo; el número va en su fila.

### Por qué siguen apareciendo defectos

No es mala suerte ni datos corruptos. Son tres causas, y las tres se
arreglan con método, no con más trabajo:

1. **Nunca se revisó el sistema completo de una vez.** Cada revisión miró
   un ticket (una pantalla, un texto, un botón). Los defectos que quedan son
   de **flujo**: pasan cuando dos partes se combinan (el PM arranca, el
   Manager completa, nadie hizo Start). Eso no lo ve una revisión por ticket.
2. **Las pruebas no prueban el sistema real.** Las 16 pruebas e2e corren
   contra una API falsa. "Pasa las pruebas" hoy no significa "funciona".
3. **Cada defecto nuevo se sentía como empezar de cero**, porque no había
   una lista cerrada. Ahora la hay: este documento. Un defecto nuevo se
   anota aquí, se clasifica y se sigue con el plan. No se reinicia nada.

### Reglas mientras cerramos

- **Alcance congelado.** No entra ninguna función nueva hasta terminar la
  Fase C. Lo nuevo va a §6 y espera.
- **Todo defecto se clasifica** al anotarlo:
  **B** bloqueante (un flujo no se puede terminar o deja datos mal),
  **C** confuso (se puede terminar, pero el usuario no sabe cómo),
  **E** estético. Antes de salir en vivo se arreglan B y C. Los E, después.
- **Un flujo está "terminado" solo cuando su fila de la matriz dice PASA
  contra el sistema real** (`npm run test:real`). No cuando "se ve bien".
- Un PR que arregla un defecto trae su prueba y borra la fila de aquí.

### Fase A — Auditoría única de flujos — LTR-174 — **HECHA (2026-09-29)**

Se recorrieron todas las historias de [`USER_FLOWS.md`](USER_FLOWS.md) una
vez, contra el sistema real (API real + base de datos local, no la API
falsa). Quedó como prueba repetible:

```bash
npm run test:real:setup --workspace=@ltl-shop/api   # una vez: crea y carga la base ltl_shop_test
npm run test:real --workspace=@ltl-shop/api         # corre todo y escribe la matriz
```

**Resultado (al cierre de la Fase A):** 56 comprobaciones · 43 funcionan ·
11 fallan · 2 no aplican. **Hoy:** 61 comprobaciones · **59 funcionan · 0 fallan** · 2 no aplican
(defectos #1, #2, #4 y #7 arreglados: LTR-175, 176, 177, 182; Quality Check
de Safety construido: LTR-185). Matriz completa: `apps/api/test-real/results/matrix.md`. Las 11
fallas son 5 defectos:

| Defecto | Filas que fallan | Clase | Ticket |
|---|---|---|---|

Con esto **la lista de defectos de flujo está cerrada**. Lo que aparezca
después se anota en §1 con su clase y su fila de prueba, pero no cambia el
plan.

**Lo que la auditoría no cubre** (se revisa en pantalla, `USER_FLOWS.md` §7):
inicio de sesión real, idioma, tema, app instalada, textos y pantallas
vacías/de error.

**Fila A28 (Work Orders de PM del modelo viejo):** no aplica. Ya no se pueden
crear y en producción no queda ninguno abierto (consulta de solo lectura del
2026-09-29: 0). El código de pausa / reanudar / terminar del mecánico PM se
puede borrar en la limpieza (§3).

### Fase B — Arreglar bloqueantes (B) y confusos (C), uno por PR — **SIGUE**

Orden: ~~#1~~ ~~#2~~ ~~#4~~ ~~#7~~ hechos (LTR-175, 176, 177, 182) → ~~#9 (LTR-184)~~ ~~#6 (LTR-178)~~ hechos → recorrido de
pantallas hecho (§1d, LTR-189) → los C de §1d (~~W1~~ ~~W2~~ ~~W4~~ ~~W11~~ ~~W12~~ ~~W14~~ ~~W15~~ ~~W17~~ ~~W9~~ ~~W5~~ hechos; ~~W16~~ hechos; quedan W3, W6, W7, W8, W10, W13) → los de §1b
(LTR-179). El #8 pasó a LTR-185 (D19: solo Safety puede ser dueño de QC).

**Hecho:** el Quality Check de Safety (D19, LTR-185). D20 y P7, P8, P11 se
deciden antes de la Fase D. Cada PR: arreglo + su fila en `test-real/` pasa a
PASA + `USER_FLOWS.md` pasa a ✅ + fila borrada de aquí.

### Fase C — Limpieza (§3, LTR-180) e idioma (§4, LTR-181)

Borrar el código heredado y unificar los textos, para que nadie vuelva a
construir sobre algo muerto.

### Fase D — Salir en vivo (§5) — LTR-45

Roster real, Auth real, bypass apagado, prueba con un Manager y un mecánico
reales. **El uso real es lo que confirma que está terminado.**

### Cómo saber que terminamos

- Todas las filas de `apps/api/test-real/results/matrix.md` dicen PASA o
  NO APLICA.
- Todas las historias de `USER_FLOWS.md` están en ✅ (o 👁 revisadas a mano).
- §1 y §1b no tienen ningún B ni C.
- Hay usuarios reales trabajando un día completo sin un defecto B.

Todo lo demás es mejora, y va a §6 hasta que se decida.

## 1. Defectos: flujos que se atoran

| # | Problema | Qué pasa | Dónde |
|---|---|---|---|
| 3 | **Custom Jobs sin revisión** — C, pendiente de P5 | Quedan en `review_status = pending_review` para siempre; nada los mapea al catálogo (ver P5 en `DECISIONS.md`). | `work-orders.service.ts` (l. 367, 951) |
| ~~5~~ | ~~"Mechanic note: undefined"~~ — cerrado | No se reproduce en el recorrido de pantallas del 2026-09-29 (§1d). | — |


## 1c. Huecos de operación (cuestionario del 2026-09-29)

No son defectos: es trabajo del taller que la app no cubre. Cada uno
necesita su decisión en `DECISIONS.md` antes de construirse. Las historias
están en `USER_FLOWS.md` §6.

| # | El taller | La app hoy | Clase | Ticket |
|---|---|---|---|---|
| G2 | El tiempo olvidado debe detenerse solo a cierta hora; el tiempo se usa para costear | Corre hasta que alguien lo corrige a mano | C | LTR-186 |
| G3 | A veces dos mecánicos trabajan en la misma tarea | Un dueño por Job; el tiempo del ayudante se pierde | C | LTR-188 (P7) |
| G4 | A veces se manda trabajo a un taller externo | No existe | C | LTR-188 (P8) |
| G5 | El Manager da de alta camiones y mecánicos | Sin pantalla; el Manager no tiene permiso | C | LTR-187 |
| G6 | El taller también trabaja trailers | Solo camiones | por decidir cuándo | LTR-188 (P11), LTR-56 |
| G7 | El reloj debe correr en un solo camión a la vez — **decidido (D21)** | Corre en los dos (D2 viejo) | C | LTR-188 (P9) |

**Efecto en los defectos:**

## 1b. Defectos menores de la UI móvil (LTR-165, revisión 2026-09-29) — LTR-179

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

## 1d. Recorrido de pantallas (2026-09-29, teléfono, EN/ES, API real) — LTR-189

Recorrido completo de las historias de `USER_FLOWS.md` con los 9 escenarios de
demo (`reset-demo-work-orders --local --apply`) contra la API real, en un
viewport de 375 px, en español y con muestreo en inglés. Ningún flujo se atora:
todo lo que falla aquí es **C (confuso)** o **E (estético)**, salvo W4 que
lanza un error real en consola. Se arreglan en este orden, uno o dos por PR,
empezando por W1 (el que reportó el dueño).

| # | Clase | Rol | Problema | Dónde |
|---|---|---|---|---|
| ~~W1~~ | C | Manager | ~~Tarjeta "Jobs" del Work Order sin jerarquía~~ — **hecho** (2026-09-30): fila de acciones por Job y diálogo con motivo para cancelar/reabrir. | `admin-work-order-detail.tsx` |
| ~~W2~~ | C | Manager | ~~"Completar Work Order" visible con error antes de tiempo~~ — **hecho** (2026-09-30): la tarjeta solo existe cuando el Work Order ya puede cerrarse. | `admin-work-order-detail.tsx` |
| W3 | C | Manager | Panel: el mismo Work Order muestra "Atención: Prioridad crítica" y "Siguiente paso: Bloqueado…" a la vez. Una sola línea: el paso siguiente. | `admin-dashboard.tsx`, `lib/status-chips.ts` |
| ~~W4~~ | C | Manager | ~~Error de hidratación de React en la lista de Trucks~~ — **hecho** (2026-09-30): el badge va en un `<div>`. | `admin-trucks-list.tsx` |
| ~~W5~~ | C | Manager | ~~"Estado operacional: Unknown — no hay un evento…"~~ — **hecho** (2026-09-30): dice "Sin registro" / "Not recorded". | `admin-messages.ts` |
| W6 | E | Manager | Lista de Trucks: el placeholder de búsqueda se corta en el teléfono; "Aplicar filtros" sale como botón primario en una lista que solo tiene búsqueda. | `admin-trucks-list.tsx`, `admin-messages.ts:906` |
| W7 | C | Manager | Detalle de Truck → Work Plan: "Marcar completado" sale primario en Detailing y no en el paso siguiente; "Trabajo actual" muestra "Categoría: Inspection" (categoría legacy del Work Order). | `components/admin-truck-detail.tsx` ~l. 79 |
| W8 | C | Manager | Lista de Work Orders: la tarjeta repite "N Jobs · Siguiente: X" dos veces; el subtítulo "Vista operacional de solo lectura de todos los Work Orders del Shop" es jerga. | `components/admin-work-order-item.tsx`, `admin-messages.ts:890` |
| ~~W9~~ | C | Manager | ~~Setup → Shop workflow: QC dice "Manager, sin asignación"~~ — **hecho** (2026-09-30): "Safety (Control de calidad) lo toma de la cola". | `admin-messages.ts` |
| W10 | E | Manager | El subtítulo del Work Order dice "Work Order WO-005 · Inspection" (categoría legacy). Sobra. | `admin-work-order-detail.tsx` |
| ~~W11~~ | C | Mecánico | ~~"Completados" solo listaba Work Orders cerrados~~ — **hecho** (2026-09-30): lista los Jobs que el mecánico completó, en Work Orders abiertos o cerrados. | `mechanic-completed-page.tsx`, `lib/my-completed-jobs.ts` |
| ~~W12~~ | C | Mecánico | ~~Sin botón "Completar" visible en el detalle~~ — **hecho** (2026-09-30): cada Job mío es una tarjeta con "Completar Job" (primario) y "Reportar bloqueo" al lado. | `app/work-orders/[id]/detail-client.tsx` |
| W13 | E | Mecánico | Diálogo "Reportar bloqueo": el texto de ayuda ("Selecciona un motivo…") queda debajo de los botones y detrás del botón flotante. | diálogo de bloqueo |
| ~~W14~~ | C | PM | ~~Cinco "Iniciar servicio PM" primarios con otro PM activo~~ — **hecho** (2026-09-30): con un PM en curso, las tarjetas "Listos para iniciar" ofrecen "Ver trabajo" (secundario) y el aviso dice "Termina WO-xxx antes de iniciar otro". | `app/page.tsx` |
| ~~W15~~ | C | PM | ~~Sin pausa ni notas; "Guardado" escondido; dos tarjetas "Servicio de PM"~~ — **hecho** (2026-09-30): el PM no pausa (D17: reporta bloqueo) y el aviso ya no lo promete; hilo de notas en el detalle; "Guardado automáticamente" junto al título; la primera tarjeta se llama "Tipo de servicio". | `pm-job-detail.tsx`, `pm-service-card.tsx` |
| ~~W16~~ | E | Safety | ~~"Tomar" secundario~~ — **hecho** (2026-09-30): "Tomar" es primario. El aviso antes del refresco de la tarjeta queda como está (es SWR, medio segundo). | `quality-check-page.tsx` |
| ~~W17~~ | C | Safety | ~~Dice "Truck" donde el mecánico dice "Unidad"; etiquetas del diálogo Devolver~~ — **hecho** (2026-09-30): "Unidad 968 es tuya", "Devolver unidad 968", campo "Qué encontraste", botón "Cancelar". | `lib/locale-context.tsx`, `quality-check-page.tsx` |

Confirmado en el recorrido: U9 (Nuevo Work Order dice "Unidad"). El defecto #5
("Mechanic note: undefined") **no se reproduce**: la nota del mecánico se ve
bien en el Admin ("Mechanic note: Batería nueva instalada.") y en el detalle
del mecánico; queda cerrado.

## 2. Pruebas

- **Pruebas de flujo contra el sistema real** (`apps/api/test-real/`, LTR-174):
  56 comprobaciones, una por fila de `USER_FLOWS.md`. Son la definición de
  "funciona". No corren en `npm test` ni en CI todavía (necesitan Postgres);
  ponerlas en CI es parte de la Fase B (el CI ya levanta Postgres y corre
  `prisma migrate deploy`, así que solo falta el seed y el paso).
- Las 16 pruebas e2e de la web corren **solo contra la API falsa**
  (`apps/web/e2e/fixtures/admin-api.mjs`). Sirven para la pantalla, no para
  saber si el flujo funciona.
- La API falsa responde con una lista a cualquier `POST /api/work-orders*`
  que no conoce (mismo error que arregló LTR-172 para notas).
- Sin prueba de pantalla: marcar un pedido de trabajo como atendido, "Add
  missing steps", `/reset-password`, `/access-denied`, tarjetas de las listas
  en el teléfono, padding seguro del menú lateral, idioma de
  `global-error.tsx`.

## 3. Limpieza de código — LTR-180

Código que confunde porque ya no es parte del flujo (ver `SYSTEM.md` §11):

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
  En producción no queda ninguno abierto (2026-09-29), así que se puede
  quitar ese código y la vista `PmWorkOrderDetail`.
- Columna `pmAuthorized`.
- Comentarios viejos: `schema.prisma` en `ShopWorkflowStep` ("runtime still
  reads MANDATORY_WORK_PLAN_JOBS") y la migración `20260928030000`.
- `supabase/migrations/20260825140000_init_domain.sql`: copia congelada;
  borrarla o dejarle un README que lo diga.

## 4. Idioma — LTR-181

- 62 textos `locale === 'es' ? … : …` escritos directo en 13 archivos, fuera
  de los catálogos (más en `reset-password`, `trucks/[id]/history`,
  `ui.tsx`). LTR-167 agregó 5 en el menú de perfil (Idioma, Tema, Claro,
  Oscuro, Auto) aunque la clave `language` ya existe en el catálogo.
- Textos solo en inglés en pantallas de PM legacy y nuevo WO ("Resume Work",
  "Change Pause Reason", "Jobs To Do", "Create failed", "Action failed"…).
- 29 lugares leen `.message` de errores de la API (siempre en inglés) y lo
  muestran al usuario, también en español. `app/error.tsx` y
  `global-error.tsx` ya están traducidos (LTR-170).

## 5. Para salir en vivo — LTR-45

Detalle en [`GO_LIVE_CHECKLIST_ES.md`](GO_LIVE_CHECKLIST_ES.md).

- Roster real y `work_orders.manage` para los Managers reales (P6), más las
  dos cuentas de Safety con `quality_check.perform` (hoy "Safety 1" y
  "Safety 2" en el seed local).
- Usuarios reales en Supabase Auth; `AUTH_DEV_BYPASS` apagado en producción.
- Carga única de camiones de Ninox, si la flota de producción no está completa.
- Smoke con un Manager y un mecánico reales, incluido Safari en un iPhone real.
- Validar en datos de producción: Truck Detail (LTR-59) y Ready vs Complete
  vs Return to Service (LTR-60, LTR-123). Cerrar la épica LTR-149.

## 6. Fuera de alcance (no se construye hasta decidirlo)

- Presencia física en el patio (Samsara), McLeod, Dispatch, Schedule_Teams.
- Off Duty (decidido: se lanza sin eso), sincronizar con Ninox (P4).
- Trailers como activos: el taller los necesita; falta decidir cuándo (P11).
- Pantallas para escribir catálogo, categorías y permisos (hoy solo por API
  o nada). Alta de camiones y mecánicos **sí** entra: LTR-187.
- Rendimiento por Job, tiempos por Job, espera por motivo.
- Espacios de trabajo de Detailing, Body Shop, Trailer e Inspector.
- Notificaciones push (decidido: solo dentro de la app).
