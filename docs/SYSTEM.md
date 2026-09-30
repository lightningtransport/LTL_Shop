# Cómo funciona Lightning Shop hoy

**Actualizado:** 2026-09-29 (código en `main` `69aa63c`; comprobado con la auditoría LTR-174)
**Regla:** este documento describe solo lo que el código hace hoy. Un PR que
cambia comportamiento lo actualiza en el mismo PR. Las decisiones y su
historia están en [`DECISIONS.md`](DECISIONS.md); lo que falta o está mal, en
[`OPEN_ISSUES.md`](OPEN_ISSUES.md).

Los nombres del dominio se quedan en inglés, igual que en la app: Truck,
Work Order (WO), Job, Manager, Ready to Go, Return to Service.

---

## 1. Qué es

Lightning Shop es la aplicación del taller de Lightning Transport. Organiza el
trabajo sobre cada camión desde que llega hasta que vuelve a servicio:

1. El **Manager** abre un Work Order para el Truck.
2. Inspecciona el camión y agrega el trabajo extra que encuentra (Hallazgos).
3. Cada **mecánico** hace solo los Jobs que le asignaron.
4. El Manager resuelve los bloqueos, hace el Quality Check y cierra el WO.
5. El Truck queda **Ready to Go** hasta que el Manager lo marca **Return to
   Service**.

**Stack:** Next.js (`apps/web`), NestJS + Prisma (`apps/api`), tipos y
reglas compartidas (`packages/shared`), Supabase Postgres + Supabase Auth.
Todas las reglas de negocio y permisos se validan en la API (servicios
NestJS). La base de datos no tiene triggers ni funciones.

---

## 2. Roles y permisos

Los permisos son **capabilities** guardadas en `user_capabilities`. El rol
(`users.role`: `mechanic | manager | admin`) solo clasifica al usuario, decide
su pantalla inicial y separa al System Admin.

| Persona | Rol | Capabilities | Qué hace |
|---|---|---|---|
| **Shop Manager** | `manager` | `admin.access`, `work_orders.manage`, `yard.operations.manage` | Crea y planea WOs, inspecciona, asigna, pausa, resuelve bloqueos, hace QC, cierra, Return to Service. |
| **System Admin** | `admin` | `admin.access` (+ las demás que necesite) | Lo mismo que el Manager, más altas de Jobs de catálogo y mecánicos (solo por API). |
| **Mecánico Standard** | `mechanic` | `mechanic.standard` | Ejecuta sus Jobs asignados. |
| **Mecánico PM** | `mechanic` | `mechanic.pm` | Hace el PM de los camiones. |
| **Safety (Quality Check)** | `mechanic` | `quality_check.perform` | Revisa los camiones terminados: los aprueba o los devuelve con una nota (D19). Dos personas. |

| Capability | Da acceso a |
|---|---|
| `admin.access` | Entrar a `/admin`. Reabrir WO, corregir tiempos, reabrir Job cancelado, Return to Service. **El Manager también la tiene**, así que puede hacer todo esto. |
| `work_orders.manage` | Crear WO, agregar/cancelar Jobs, asignar, prioridad, notas, pausar/reanudar, completar/cancelar WO, resolver bloqueos, editar Shop workflow. |
| `yard.operations.manage` | Registrar la inspección del Truck. |
| `mechanic.standard` | Pantallas y acciones del mecánico Standard. |
| `mechanic.pm` | Pantallas y acciones del mecánico PM. |
| `quality_check.perform` | La pantalla de Safety (`/qc`): tomar, aprobar o devolver el Quality Check. Nada más. |

El mecánico **nunca** crea WOs, cambia prioridad, agrega Jobs, pausa el WO ni
la termina. La API responde 403.

**Usuarios hoy (roster de prueba, LTR-160):** Crixcrox (admin), Cristian
(manager), MG (Standard), MPM (PM), MD (Standard, dueño de Detailing), MA
(Standard, dueño de Alignment). El roster real todavía no existe (ver
`OPEN_ISSUES.md`).

---

## 3. Entidades y sus estados

Esquema: `apps/api/prisma/schema.prisma`. Tipos compartidos:
`packages/shared/src`.

### Truck
- Se carga por seed/Ninox (`NINOX_TRUCK_SEED.md`). **No hay pantalla para
  crear o editar camiones.**
- **Estado de servicio:** eventos `truck_service_status_events`
  (`in_service | off_duty`), solo se agregan. Sin evento = `Unknown`.
  Return to Service escribe `in_service`. `off_duty` existe pero nada lo
  escribe.
- **Presencia física** (en el patio o fuera): siempre `UNKNOWN`. La
  "ubicación reportada" que viene de Ninox es solo informativa, no es
  presencia.
- El millaje oficial solo cambia al terminar un PM (con registro de auditoría
  en `truck_mileage_adjustments`).

### Work Order
Un WO es **toda la intervención de un Truck**. Solo puede haber **un WO
abierto por Truck**.

```
created ──(Start del mecánico, arranque del PM o Job completado por el Manager)──▶ in_progress ◀──▶ waiting_paused (pausa oficial del Manager)
                                   │
                                   ├──(Manager: Close, sin Jobs pendientes)──▶ completed
   cualquier estado abierto ──(Manager: Cancel con motivo)──▶ cancelled
   completed / cancelled ──(admin: Reopen con motivo)──▶ in_progress (o created si nunca empezó)
```

- `created` → `in_progress`: cuando empieza el trabajo, sea quien sea:
  un mecánico Standard toca Start/Continue, el mecánico PM arranca el PM, o
  el Manager completa un Job desde Admin (LTR-175). El Manager no tiene
  botón de Start; no le hace falta.
- Un WO que sigue en `created` sin ningún Job pendiente también se puede
  cerrar (por ejemplo, uno reabierto que nunca tuvo Start).
- Close exige `in_progress` (o `created`) y ningún Job en `to_do`.
- Reopen (quien tenga `admin.access`, Manager incluido) solo si el Truck no
  tiene otro WO abierto.
- Completar un Job **no** completa el WO. WO `completed`, Ready to Go y
  Return to Service son tres cosas distintas.
- Cada cambio usa `version` (bloqueo optimista) e `idempotencyKey`.
- `primaryCategoryId` sigue existiendo por compatibilidad; se deriva solo.

### Job (`work_order_jobs`)
- Estado guardado: `to_do → completed | cancelled`. Cancelled → `to_do`
  (reabrir, admin). **Completed no se puede reabrir.**
- Estado mostrado: **Pending**, **In progress** (el dueño tiene su sesión
  abierta) o **Blocked** (tiene un bloqueo activo).
- **Un dueño por Job** (`assigned_mechanic_id`) o *Unassigned*. Un Job sin
  dueño no lo puede ejecutar nadie; aparece en "Needs attention".
- El Job trae su categoría (`categoryId`). Un WO puede mezclar categorías.
- Los Jobs de catálogo no se repiten; los Custom Jobs no repiten nombre
  (normalizado). Los Custom Jobs quedan con `review_status = pending_review`.
- **Quality Check no tiene dueño por defecto** (D15). Solo una persona de
  Safety puede ser su dueño: lo toma desde su pantalla (D19). El Manager
  conserva "Mark complete" como respaldo.

### Inspección
- Se registra en el Truck ("No issues found" / "Issues found") y **pertenece a
  la visita**: cuando se abre un WO nuevo, la inspección anterior se cierra y
  el WO nuevo empieza con la inspección pendiente. Cancelar el WO también la
  cierra; reabrirlo la devuelve (LTR-177).
- Por dentro sigue guardada en la evaluación de readiness del Truck (código
  heredado, ver §11).

### Bloqueo (blocker)
- Siempre es de **un Job** (D17). Lo reporta el dueño del Job, con un motivo
  de `BlockerReason`. Solo uno activo por Job.
- **Devolución de Safety:** cuando Safety devuelve un camión, queda como un
  bloqueo del Job de Quality Check con motivo `quality_check_failed` y la nota
  de lo que encontró. Ese motivo solo lo escribe Safety; a los mecánicos no se
  les ofrece.
- Se guarda en `pause_events` con `is_official_pause = false`, `job_id` y
  `blocker_reason`. No cambia el estado del WO ni el tiempo de espera.
- El mecánico solo puede **agregar notas**. **Solo el Manager resuelve**
  (nota opcional). El Job vuelve a Pending y el tiempo del mecánico corre de
  nuevo solo cuando toca Continue.
- Un Job bloqueado no se puede completar desde la vista del mecánico.
- Si el Manager cancela el WO, cancela el Job o completa el Job él mismo, el
  bloqueo se resuelve solo y queda en el historial con el motivo (LTR-176).

### Pausa oficial
- Solo el Manager pausa y reanuda el WO (`waiting_paused`). Cierra todas las
  sesiones abiertas; al reanudar se reabren las de los mismos mecánicos.
- Es la herramienta para problemas de todo el camión (esperar una parte,
  camión no disponible).

### Tiempo de trabajo (`work_sessions`)
- **Una sesión por mecánico** (`user_id`) (D18). El tiempo del WO es la
  suma de las sesiones.
- Un mecánico Standard puede tener sesiones abiertas en varios WOs a la vez
  (D2); el mecánico PM solo un PM en curso.
- Arrancar el PM abre la sesión del mecánico PM y terminarlo la cierra
  (LTR-175): el tiempo del PM se registra como el de cualquier mecánico.
- Se abre con Start/Continue mientras el mecánico tenga un Job pendiente.
- Se cierra cuando el mecánico completa, pierde o bloquea su último Job
  disponible en ese WO ("Terminaste tu parte").
- El admin puede corregir una sesión o pausa cerrada, con motivo. Cada sesión
  dice de qué mecánico es y el detalle Admin muestra el tiempo por mecánico
  (LTR-184).

### PM service (`pm_services`, `pm_service_parts`)
- Borrador (millaje observado, partes, notas) mientras el PM está abierto;
  solo lectura al terminar.
- Millaje: nunca menor que el del Truck; un salto de más de 50 000 pide
  confirmación (D10).
- Partes: catálogo de 9 categorías filtrado por marca/modelo del Truck; se
  exige al menos una.

### Notas (`work_order_notes`)
- Solo se agregan, nunca se editan (D8). Tipos: `note` y `work_request`
  ("Pedir trabajo": el mecánico avisa de trabajo extra).
- El Manager marca un `work_request` como atendido. No se aceptan notas en
  WOs cerrados.

### Shop workflow (`shop_workflow_steps`)
- Un renglón por paso obligatorio (`pm`, `alignment`, `detailing`,
  `quality_check`) → Job de catálogo, responsable por defecto, orden, activo.
- Se edita en Admin → Setup → Shop workflow. Solo aplica a WOs nuevos.

### Activity Log (`activity_logs`)
- Historial de auditoría de todo cambio, solo se agrega. Se muestra en el
  detalle Admin del WO.

---

## 4. Flujos por rol

Resumen. El detalle paso a paso, con casos límite y estado comprobado, está
en [`USER_FLOWS.md`](USER_FLOWS.md).

### Manager

**M01 — Llega un camión**
1. `/admin/work-orders/new`: elige **solo el Truck** (más prioridad y nota).
2. El WO nace en `created` con **PM A, Alignment, Detailing y Quality
   Check**, cada uno con su dueño por defecto (si está activo; si no, queda
   Unassigned).
3. En el Truck (`/admin/trucks/[id]`) registra la inspección:
   **No issues found** o **Issues found**. Con Issues found agrega los Jobs
   extra y elige "¿Quién lo hace?" en cada uno (D14).

**M02 — Asignar**
- Un dueño por Job, desde el Work Plan del Truck o el detalle Admin del WO.
- El equipo del WO se deriva de los dueños de sus Jobs (D11).
- Un Job pendiente sin dueño aparece en "Needs attention" del Dashboard.

**M03 — Camión bloqueado**
- El Manager ve "Blocked · motivo" (quién y cuándo) en el Dashboard, el
  Truck, el Yard y el WO.
- Toca **Resolve** (nota opcional) desde el Dashboard, el Truck o el WO.
- Si el problema es de todo el camión, usa la pausa oficial.

**M04 — Cerrar**
1. Todos los Jobs resueltos → el Manager hace **Mark complete** en Quality
   Check.
2. Fase **Ready to close** → **Close Work Order** desde el Truck.
3. El Truck pasa a **Ready to Go** y se queda así hasta Return to Service.
4. **Return to Service** (motivo opcional) desde el Truck, el WO o la tarjeta
   del Yard. El camión sale del tablero.

Además el Manager puede cancelar el WO o un Job (con motivo), reabrir
(admin), cambiar la prioridad (las notas solo se agregan) y corregir tiempos
(admin). En la tarjeta "Jobs" cada Job pendiente muestra una fila de acciones
(Marcar completado —primario solo en Quality Check—, Asignar / Quitar
asignación, o el selector de servicio en el PM); "Cancelar Job…" y "Reabrir
Job…" son enlaces discretos que abren un diálogo donde se escribe el motivo
(LTR-189, W1).

### Mecánico Standard

**MECH01 — Ver mi trabajo:** inicia sesión → "My Assigned Work" (solo sus
Jobs, agrupados por Truck) → abre el WO: ve "Your Jobs" y, en solo lectura,
"Other work on this truck".

**MECH02 — Trabajar:** Start/Continue abre su sesión → cada Job suyo es una
tarjeta con dos botones debajo, **Completar Job** (primario) y **Reportar
bloqueo** (LTR-189 W12) → al terminar el último ve "Terminaste tu parte" y su
tiempo se detiene.

**MECH03 — Bloqueo:** reporta un bloqueo en uno de sus Jobs → si no le queda
otro Job disponible, su tiempo se detiene → solo puede agregar notas → el
Manager resuelve → ve "Resolved · tap Continue".

También puede dejar notas y **pedir trabajo** extra para que el Manager lo
agregue.

### Mecánico PM

1. Elige el Truck → **Create PM service**. Se une al WO abierto del Truck
   (agrega PM A si falta) o crea el WO completo. El PM se le asigna y arranca.
2. Registra el millaje observado.
3. Elige las partes (filtradas por marca/modelo; al menos una). Las notas se
   guardan solas.
4. **Finish**: actualiza el millaje del Truck y escribe la auditoría.
   **No** completa el WO; el resto de los pasos sigue.

- Arrancar el PM pone el WO en curso y abre el reloj del mecánico PM;
  Finish lo detiene.
- Un solo PM en curso por mecánico PM (D2).
- Puede cambiar PM A ↔ PM B ("Tipo de servicio") y bloquear su PM (lo
  resuelve el Manager). Deja notas y pide trabajo como cualquier mecánico
  (LTR-189 W15).
- El PM dentro del WO no tiene pausa; mientras un PM esté en curso, los demás
  se ven ("Ver trabajo") pero no se inician (D2, LTR-189 W14).

### Safety (Quality Check)

1. Entra y cae en **Quality Check** (`/qc`): solo los camiones donde todo lo
   demás ya está hecho (PM, Alignment, Detailing y hallazgos completados o
   cancelados, sin bloqueos).
2. **Tomar**: el Job de QC pasa a ser suyo; el otro de Safety lo ve tomado.
   Gana el primero.
3. **Aprobar**: el QC queda completado a su nombre; el camión pasa a "listo
   para cerrar" para el Manager. Safety no registra tiempo.
4. **Devolver** (nota obligatoria): el camión sale de su lista y pasa a
   "Devueltos, esperan al Manager". El Manager lo ve como bloqueo "Devuelto
   por Safety" en Dashboard, Truck y WO, agrega el trabajo desde el Truck y
   resuelve. Cuando ese trabajo se completa, el camión vuelve a la lista de
   Safety, para cualquiera de los dos.

Safety no puede hacer nada más (403 en Admin y en las rutas del mecánico).
Aparece en el roster del Manager como "Safety (Quality Check)"; el selector
de mecánicos para Jobs no la ofrece.

### System Admin
- Todo lo del Manager.
- Por API (sin pantalla): crear, renombrar y activar/desactivar Jobs de
  catálogo (`POST/PATCH /api/admin/catalog/jobs`); crear y activar mecánicos
  (`POST/PATCH /api/admin/mechanics`). El Manager recibe 403 en esas rutas.
- Las cuentas de Supabase Auth se crean en el dashboard de Supabase.

---

## 5. Work Plan y "Siguiente paso"

**Work Plan** (fase del Truck, calculada, nunca guardada):

```
Inspection → Shop Work → PM → Alignment → Detailing → Quality Check → Ready to close → Ready to Go
```

- PM, Alignment, Detailing y QC siempre son obligatorios. Un paso con todos
  sus Jobs cancelados cuenta como "no aplica".
- El orden **se muestra, no se obliga**: los mecánicos trabajan en paralelo.
- **Ready to Go** = todos los pasos resueltos **y** el WO `completed` (D1).
  Si el WO sigue abierto, la fase es **Ready to close**.
- Código: `apps/api/src/admin/yard-work-plan-derivation.ts`.

**Siguiente paso** (una sola regla para Dashboard, Truck, Yard, lista y
detalle de WO; `packages/shared/src/truck-next-step.ts`). Gana la primera que
aplique:

| Orden | Paso | Botón |
|---|---|---|
| 1 | `resolve_blocker` | Resolve (nota opcional) |
| 2 | `resume` | Resume |
| 3 | `inspect` | Ir a la inspección |
| 4 | `add_missing_steps` | Agregar pasos que faltan (WOs viejos) |
| 5 | `assign` | Asignar el Job sin dueño |
| 6 | `qc` | Esperando a Safety (Manager: Mark QC complete como respaldo) |
| 7 | `close` | Close Work Order |
| 8 | `return_to_service` | Return to Service |
| 9 | `work` | (los mecánicos están trabajando) |
| — | `create_work_order` | Truck sin WO abierto |

Un test de contrato verifica que todas las pantallas devuelven el mismo paso,
también para un Truck Ready to Go ("Return to Service") mientras dure
`YARD_READY_TO_GO_SINCE` (LTR-182).

---

## 6. Pantallas

### Manager / Admin (`/admin`, protegido por `middleware.ts`)

| Ruta | Qué es |
|---|---|
| `/admin` | Dashboard: métricas, "Needs attention" con el siguiente paso, pedidos de trabajo abiertos. |
| `/admin/yard-operations` | Tablero del patio por fase. Pestaña `?tab=movement`: tarjetas de agent-reporting (solo lectura). |
| `/admin/trucks`, `/admin/trucks/[id]` | Lista de camiones con siguiente paso; **el Truck es el lugar de trabajo del Manager**: siguiente paso, inspección, Work Plan, trabajo actual. La fase solo aparece como distintivo en el encabezado; datos del Truck e historial de reparaciones van plegados. |
| `/admin/work-orders`, `/admin/work-orders/[id]` | Lista con filtros; detalle del WO (ver abajo). |
| `/admin/work-orders/new` | Crear WO (solo Truck, prioridad, nota). |
| `/admin/history` | WOs completados y cancelados. |
| `/admin/mechanics`, `/admin/mechanics/[id]` | Roster (solo lectura). |
| `/admin/catalog`, `/admin/catalog/categories/[id]` | Catálogo de Jobs (solo lectura). |
| `/admin/setup/workflow` | Shop workflow: responsable por defecto de cada paso (Save debajo de la lista). |

**Detalle Admin del WO** (`/admin/work-orders/[id]`), de arriba abajo:
- **Confirm completion** arriba cuando el WO está listo para cerrar (antes la
  tarjeta no existe: el paso siguiente dice qué falta, LTR-189 W2); una barra
  fija aparece solo al pasar ese botón con el scroll.
- Jobs con dueño, bloqueos reportados (Resolve), notas y pedidos de trabajo
  (marcar atendido).
- **Controls:** prioridad y Pause/Resume (Pause no trae motivo preseleccionado).
- Plegados: **More actions** (Cancel / Reopen), **History and audit**
  (tiempos, corrección de tiempos, pausas, Activity Log), resumen operativo,
  datos del Truck e historial de reparaciones.
- Los avisos de éxito son solo toasts.

**Listas** (Trucks, Mechanics, Catalog, History): en el teléfono cada fila es
una tarjeta. Mechanics e History tienen un panel **Filters** con el número de
filtros activos. Mechanics muestra las capabilities por nombre (Standard, PM,
Shop Admin, Yard, Work Orders).

### Mecánico

| Ruta | Qué es |
|---|---|
| `/` (= `/mechanic/standard`, `/mechanic/pm`) | Inicio: mi trabajo. Cada rol ve su versión. |
| `/qc` | Safety: camiones por revisar (Tomar, Aprobar, Devolver) y devueltos. |
| `/work-orders/[id]` | Detalle del WO para el mecánico (Standard, o el PM job dentro del WO con `?view=pm`). |
| `/mechanic/pm/new` | Create PM service. |
| `/mechanic/{standard,pm}/trucks`, `/trucks/[id]/history` | Buscar camión e historial de reparaciones. |
| `/mechanic/{standard,pm}/completed` | Pestaña "Completados": Standard lista los Jobs que ese mecánico completó (el Work Order puede seguir abierto); PM lista los servicios de PM terminados (LTR-189 W11). |

### Todos
`/login`, `/reset-password`, `/access-denied`.

**Encabezado (todos los roles):** logo y un botón redondo con las iniciales.
Ese menú de perfil tiene idioma (English / Español), tema (Light / Dark /
Auto, que sigue al sistema), cambio de contraseña y, al final, Sign out. Si
la política exige cambiar la contraseña, el menú abre igual y muestra un aviso
con el botón que abre la hoja (LTR-179 U6).

La interfaz está en inglés y español (catálogos en
`apps/web/src/lib/admin-messages.ts` y `apps/web/src/lib/locale-context.tsx`;
reglas de términos en `design-system/glossary-en-es.md`). En español:
**el Work Order** (masculino); el Admin dice "Trucks" y la app del mecánico
"unidad"; los pasos se llaman Alineación, Detallado y Control de calidad.

**App instalada (PWA):** una sola app para todos los roles, nombre "Lightning
Shop" ("LTL Shop" bajo el ícono), ícono verde con rayo (incluye versión
maskable 512, generada por `apps/web/scripts/generate-app-icons.mjs`) y
colores de arranque claros. *(LTR-171, pendiente de fusionar.)*

---

## 7. Reglas fijas

1. Un WO abierto por Truck. El trabajo encontrado durante la misma
   intervención se agrega a ese WO.
2. Crear un WO **no** arranca el trabajo; el mecánico toca Start.
3. Completar un Job no pausa ni completa el WO.
4. WO completed ≠ Ready to Go ≠ Return to Service.
5. Los tiempos se calculan de sesiones y pausas guardadas, nunca de
   contadores del navegador.
6. Permisos y reglas de negocio solo en la API.
7. El historial (Activity Log, notas, eventos de servicio, auditoría de
   millaje) solo se agrega; no se borra ni se edita.
8. Prisma es la única fuente del esquema. Migraciones solo por el workflow
   de Release safety (`reference/DEPLOY.md`).

---

## 8. Integraciones

- **Ninox:** no es fuente operativa. Hubo una carga única de camiones
  (`reference/NINOX_TRUCK_SEED.md`). El cliente de la API es un stub
  (`DATA_SOURCE=supabase`).
- **agent-reporting:** la API expone `GET /api/admin/yard/data-boundary`
  (Incoming Trucks, Upcoming Departures, Work location), montado en la
  pestaña Movement del Yard. Necesita `AGENT_REPORTING_KEY` en la API
  (`reference/YARD_DATA_BOUNDARY.md`).
- **Samsara, McLeod, Dispatch:** no conectados. Presencia = `UNKNOWN`.

---

## 9. Operación y scripts

- Producción: `https://ltl-shop-web.vercel.app`. Variables y deploy en
  `reference/DEPLOY.md`.
- `YARD_READY_TO_GO_SINCE` (API): WOs completados desde esa fecha siguen en
  el tablero como Ready to Go hasta Return to Service.
- `npm run prisma:reset-test-roster --workspace=@ltl-shop/api` — deja activo
  solo el roster de prueba (dry-run por defecto; `-- --apply` escribe).
- `npm run prisma:reset-demo-work-orders --workspace=@ltl-shop/api` — borra
  los WOs y arma un Truck por escenario (M01–M04, MECH01–03, PM). Dry-run por
  defecto; no corre en producción si hay usuarios fuera del roster de prueba.
- **Nunca** correr `db:seed` en producción: pisa los camiones 905/922/968.
- Solo en desarrollo: `AUTH_DEV_BYPASS`, `NEXT_PUBLIC_E2E_DEV_LOGIN`.

---

## 10. Cómo se comprueba que funciona

- **Historias y casos límite:** [`USER_FLOWS.md`](USER_FLOWS.md). Cada fila
  tiene una prueba en `apps/api/test-real/` que corre contra la API real y
  una base de datos local aparte (`ltl_shop_test`; nunca la de desarrollo ni
  producción).
- `npm run test:real:setup --workspace=@ltl-shop/api` crea, migra y carga esa
  base (una vez, y después de cada migración nueva).
- `npm run test:real --workspace=@ltl-shop/api` compila la API, la levanta,
  corre todo y escribe `apps/api/test-real/results/matrix.md`.
- Un PR que cambia un flujo cambia su prueba y su fila en `USER_FLOWS.md`.

---

## 11. Código heredado que todavía existe

Existe en el código, pero no es parte del flujo actual. LTR-180 (2026-09-30)
quitó los endpoints de readiness, el equipo por WO, el "Add job" viejo, la
pausa/reanudar/terminar del mecánico PM legacy, el formulario Standard de
`work-orders/new`, la columna `pmAuthorized` y 117 textos de Admin sin uso.

- **WOs de PM legacy** (creados antes de LTR-141): ya no se pueden crear y en
  producción no queda ninguno abierto (2026-09-29). Si apareciera uno, el
  mecánico solo lo ve; lo cierra o cancela el Manager desde Admin.
- **Readiness assessments** (modelo viejo de 6 requisitos): sin pantalla ni
  endpoints de escritura. La inspección del Work Plan todavía se guarda en su
  requisito `inspection` (`YardOperationsService.startAssessment` /
  `updateRequirement` por dentro); desde LTR-177 la evaluación se abre y se
  cierra con cada visita. Truck detail y Yard la leen.
- **`mechanic_assignments`**: ya no es "el equipo"; es un caché de los
  dueños de Jobs.
- **`supabase/migrations/`**: copia congelada del esquema inicial (ver su
  `README.md`); las migraciones de Prisma son la fuente de verdad.
