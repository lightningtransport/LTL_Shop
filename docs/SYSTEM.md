# Cómo funciona Lightning Shop hoy

**Actualizado:** 2026-10-05 (LTR-188: Job de ayudante (D23) y taller externo (D24); LTR-174: detalle del Truck y del Work Order reorganizados; LTR-187: el Manager da de alta al personal)
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
| **Shop Manager** | `manager` | `admin.access`, `work_orders.manage`, `yard.operations.manage` | Crea y planea WOs, inspecciona, asigna, pausa, resuelve bloqueos, hace QC, cierra, Return to Service. **Da de alta al personal** (Standard, PM, Safety), lo desactiva/reactiva y reinicia contraseñas (D22). **Mantiene el catálogo de Jobs**: agrega, renombra y activa Jobs de catálogo; las categorías no cambian (D25). |
| **System Admin** | `admin` | `admin.access` (+ las demás que necesite) | Lo mismo que el Manager (el roster y el catálogo de Jobs los abre por rol, aunque solo tenga `admin.access`). |
| **Mecánico Standard** | `mechanic` | `mechanic.standard` | Ejecuta sus Jobs asignados. |
| **Mecánico PM** | `mechanic` | `mechanic.pm` | Hace el PM de los camiones. |
| **Safety (Quality Check)** | `mechanic` | `quality_check.perform` | Revisa los camiones terminados: los aprueba o los devuelve con una nota (D19). Dos personas. |

| Capability | Da acceso a |
|---|---|
| `admin.access` | Entrar a `/admin`. Reabrir WO, corregir tiempos, reabrir Job cancelado, Return to Service. **El Manager también la tiene**, así que puede hacer todo esto. |
| `work_orders.manage` | Crear WO, agregar/cancelar Jobs, asignar, prioridad, notas, pausar/reanudar, completar/cancelar WO, resolver bloqueos, editar Shop workflow. Con `admin.access`, también el **roster** (`POST/PATCH /api/admin/mechanics`, reset-password; D22) y los **Jobs de catálogo** (`POST/PATCH /api/admin/catalog/jobs`; D25). Mecánicos y Safety reciben 403. |
| `yard.operations.manage` | Registrar la inspección del Truck. |
| `mechanic.standard` | Pantallas y acciones del mecánico Standard. |
| `mechanic.pm` | Pantallas y acciones del mecánico PM. |
| `quality_check.perform` | La pantalla de Safety (`/qc`): tomar, aprobar o devolver el Quality Check. Nada más. |

El mecánico **nunca** crea WOs, cambia prioridad, agrega Jobs, pausa el WO ni
la termina. La API responde 403.

**Usuarios hoy (roster de prueba, LTR-160):** Crixcrox (admin), Cristian
(manager), MG (Standard), MPM (PM), MD (Standard, dueño de Detailing), MA
(Standard, dueño de Alignment). El roster real lo arma el Manager desde la
app (**Personal**, abajo).

### Personal (D22, LTR-187)

- **Alta:** Admin → Mecánicos → **Agregar persona**: nombre, correo y tipo
  (Standard, PM o Safety). La API crea la fila en `users` (`role: mechanic`,
  una sola capacidad) **y** la cuenta en Supabase Auth con una **contraseña
  temporal** (14 caracteres legibles) que devuelve **una sola vez**; no se
  guarda ni se registra. La cuenta nace con `app_metadata.must_change_password
  = true`, así que la app obliga a cambiarla al entrar; al cambiarla, la web
  llama `POST /api/auth/password-changed` y la API apaga la marca (solo la
  service role puede). Si Supabase falla, no se crea nada
  (`AUTH_ACCOUNT_CREATE_FAILED`); si la fila del Shop falla, la API borra la
  cuenta recién creada. Correo repetido: `MECHANIC_EMAIL_EXISTS` (409).
- **Sin service key** (local con `AUTH_DEV_BYPASS`, pruebas de flujo): no se
  crea cuenta y la respuesta trae `temporaryPassword: null`; la app dice
  "Cuenta de acceso no creada en este entorno".
- **Reiniciar contraseña:** `POST /api/admin/mechanics/:id/reset-password`
  genera otra temporal, la devuelve una vez y vuelve a obligar el cambio.
  Sin cuenta de Supabase: `AUTH_ACCOUNT_MISSING` (409).
- **Desactivar:** `PATCH … { active: false }` se rechaza con
  `MECHANIC_HAS_OPEN_WORK` (409) mientras la persona tenga Jobs `to_do`
  asignados en WOs abiertos o una sesión de trabajo abierta; el cuerpo lista
  `pendingJobs` (WO, camión, Job) y `runningSession`. Desactivada, no entra
  (403 al iniciar sesión) ni aparece para asignar; su historial se conserva.
  **Reactivar** no tiene regla.
- Quién puede: Manager (`admin.access` + `work_orders.manage`) y System
  Admin (por rol). Mecánicos y Safety: 403.

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
  (normalizado). Los Custom Jobs quedan con `review_status = pending_review`
  (la bandeja para revisarlos va después, LTR-57).
- **"Agregar también al catálogo"** (D25): al agregar un Job personalizado en
  el Work Plan, el Manager puede marcarlo (apagado por defecto). El Job entra
  primero al catálogo de esa categoría y al WO como **Job de catálogo**
  (`catalogJobId`, no personalizado). Si el nombre ya está en la categoría
  (sin importar mayúsculas ni espacios; `CATALOG_JOB_EXISTS`), la app lo dice
  y elige el Job que ya existe.
- **Quality Check no tiene dueño por defecto** (D15). Solo una persona de
  Safety puede ser su dueño: lo toma desde su pantalla (D19). El Manager
  conserva "Mark complete" como respaldo.
- **Job de ayudante** (D23, LTR-188): `helper_of_job_id` apunta al Job que
  ayuda. Copia catálogo, categoría, nombre y `is_custom` del principal y su
  dueño es el ayudante; el sufijo "· ayudante / · helper" no se guarda, lo pone
  la web. Solo en un Job `to_do` de un WO Standard abierto, nunca en el PM, el
  Quality Check, otro Job de ayudante ni un Job en taller externo; el ayudante
  es un mecánico Standard activo distinto del dueño, y un solo Job de ayudante
  por mecánico y principal. Fuera de eso es un Job normal: Start/Continue,
  reloj, bloqueo, completar, cancelar y reabrir. Bloquear o cancelar el
  principal **no** toca el del ayudante. La regla de "Job repetido" ignora los
  Jobs de ayudante. Endpoint `POST /admin/work-orders/:id/jobs/:jobId/helper`.
- **Taller externo** (D24, LTR-188): `external_since`, `external_kind`
  (`part` | `truck`), `external_note` y `external_by_id`. Un Job está afuera
  mientras `external_since` tiene valor; su estado sigue `to_do`. Enviarlo
  (`POST …/jobs/:jobId/external`, nota obligatoria) le quita el dueño, cierra
  el reloj de ese mecánico en el WO si no le queda otro Job disponible ahí y
  resuelve su bloqueo con una nota. No aplica al Quality Check. Mientras está
  afuera nadie lo puede asignar ni arrancar (`JOB_AT_EXTERNAL_SHOP`); no cuenta
  como "sin asignar" ni como trabajo del taller. **Regresó**
  (`POST …/external/return`) limpia las cuatro columnas y lo completa (como
  el Manager) o se lo asigna a un mecánico con las mismas reglas de Asignar.
  Cancelar o completar un Job afuera también limpia las columnas. Como sigue
  `to_do`, el WO no se puede cerrar ni el Truck quedar Ready to Go.

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
  Lo mismo al enviar el Job a un taller externo (D24).

### Pausa oficial
- Solo el Manager pausa y reanuda el WO (`waiting_paused`). Cierra todas las
  sesiones abiertas; al reanudar se reabren las de los mismos mecánicos.
- Es la herramienta para problemas de todo el camión (esperar una parte,
  camión no disponible).

### Tiempo de trabajo (`work_sessions`)
- **Una sesión por mecánico** (`user_id`) (D18). El tiempo del WO es la
  suma de las sesiones.
- **Un solo reloj por mecánico (D21, LTR-186).** Un mecánico Standard puede
  tener Jobs en varios WOs (D2), pero su reloj corre en uno solo: Start /
  Continue en otro WO (también arrancar o continuar el PM) cierra su sesión
  abierta en cualquier otro WO con `ended_at = ahora` y
  `end_reason = switched_truck`. Ese WO no cambia (sus Jobs siguen como
  estaban). Al volver, el mecánico ve "Tu reloj está en la unidad … · toca
  Continuar" y Continue cierra el reloj del otro. Reanudar una pausa oficial
  no le reabre el reloj a quien ya lo tiene corriendo en otro WO.
- **Cierre del día (D20, LTR-186).** El taller trabaja lunes a viernes
  hasta las 5:00 p.m. (America/New_York). Una sesión abierta se cierra sola
  a las **5:00 p.m. del día en que arrancó** si ese día es hábil y arrancó
  antes de esa hora; si arrancó después o en un día no hábil, a las
  **11:59:59.999 p.m.** de ese día. Se guarda con `ended_at` = esa hora (no
  la hora en que alguien mira) y `end_reason = day_close`. Al día siguiente
  el mecánico toca Continue (su inicio dice "Ayer quedó en curso · toca
  Continuar"). El Manager ajusta el tramo con la corrección de tiempo si
  alguien se fue antes.
  - **Sin programador:** la API corre en Vercel Functions, así que no hay
    proceso de fondo. Cada lectura o escritura de tiempo (inicio y detalle
    del mecánico, Start/Continue, completar, bloquear, pausa/reanudar,
    acciones del Manager sobre el WO, detalle Admin, Work Plan, desactivar
    personal) primero cierra las sesiones vencidas (`LaborClockService.
    closeDue()`, `apps/api/src/work-orders/day-close.ts`). Es idempotente.
  - **Respaldo:** Vercel Cron llama `GET /api/internal/day-close` con
    `Authorization: Bearer $CRON_SECRET` lunes a viernes a las 21:05 y 22:05
    UTC (cubre 5:00 p.m. en horario de verano e invierno). Sin la variable
    o con otro secreto responde 503 / 401.
  - **Horario del taller** (`shop_settings`, una fila): hora de cierre
    (`day_close_minutes`, 17:00 por defecto) y días hábiles (`workdays`,
    ISO lunes = 1). El Manager o el System Admin los cambia en Setup → Shop
    workflow → Shop hours (`GET/PUT /api/admin/setup/shop-hours`); queda en
    el Activity Log y aplica desde ese momento.
- `end_reason` (`day_close`, `switched_truck`) solo lo pone la app; los
  demás cierres quedan sin motivo. El detalle Admin lo muestra junto a la
  hora de fin ("cierre del día" / "cambio de camión"); no es una alerta.
- El mecánico PM solo tiene un PM en curso (D2).
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
   extra y elige "¿Quién lo hace?" en cada uno (D14). Un Job personalizado
   puede entrar también al catálogo con "Agregar también al catálogo" (D25).

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

**M05 — Ayudante (D23):** `…` del Job → **Agregar ayudante** → elige al
mecánico. Se crea "<Job> · ayudante" con ese dueño; él lo ve en "Your Jobs".

**M06 — Taller externo (D24):** `…` del Job → **Enviar a taller externo** →
"Sale la pieza" o "Sale el camión" + nota. Cuando vuelve: **Regresó** →
Completar o Asignar a un mecánico. Todo queda en el Activity Log.

### Mecánico Standard

**MECH01 — Ver mi trabajo:** inicia sesión → "My Assigned Work" (solo sus
Jobs, agrupados por Truck) → abre el WO: ve "Your Jobs" y, en solo lectura,
"Other work on this truck".

**MECH02 — Trabajar:** Start/Continue abre su sesión → cada Job suyo es una
tarjeta con dos botones debajo, **Completar Job** (primario) y **Reportar
bloqueo** (LTR-189 W12) → al terminar el último ve "Terminaste tu parte" y su
tiempo se detiene. Su reloj corre en un solo camión (D21) y se cierra
solo a las 5:00 p.m. (D20); al volver toca Continue.

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
  Finish lo detiene. Si el cierre del día, otro camión o un bloqueo resuelto
  detuvo su reloj, el PM job muestra **Continue** (`POST …/pm/start` sobre
  un PM ya arrancado reabre su reloj; LTR-186).
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
- El roster (`POST/PATCH /api/admin/mechanics`, D22) y los Jobs de catálogo
  (`POST/PATCH /api/admin/catalog/jobs`, D25) los comparte con el Manager; la
  cuenta de Supabase Auth la crea la API al dar de alta. Las categorías no
  tienen escritura.

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
| 5 | `assign` | Asignar el Job sin dueño (un Job en taller externo no cuenta) |
| 6 | `external` | "En taller externo: <Job>" — lo único pendiente fuera de QC está afuera (D24); "Regresó" está en la fila del Job |
| 7 | `qc` | Esperando a Safety (Manager: Mark QC complete como respaldo) |
| 8 | `close` | Close Work Order |
| 9 | `return_to_service` | Return to Service |
| 10 | `work` | (los mecánicos están trabajando; los Jobs afuera no cuentan) |
| — | `create_work_order` | Truck sin WO abierto |

Un test de contrato verifica que todas las pantallas devuelven el mismo paso,
también para un Truck Ready to Go ("Return to Service") mientras dure
`YARD_READY_TO_GO_SINCE` (LTR-182).

---

## 6. Pantallas

### Manager / Admin (`/admin`, protegido por `middleware.ts`)

| Ruta | Qué es |
|---|---|
| `/admin` | Dashboard: responde "¿qué hago ahora?" (D26). Cuatro contadores (Blocked or paused, Ready to close, Ready to Go, Unassigned) que filtran una cola "Needs you" con todo lo que espera al Manager —WOs abiertas y Trucks Ready to Go, agrupadas por acción—, cada fila con su acción ahí mismo (Resolve con nota a pedido, Resume, Close con confirmación, Return to Service, Assign, inspección, Mark QC complete); "Sale pronto y no está listo" (salidas de Dispatch cruzadas con WOs abiertas, hoy y el siguiente día hábil); pedidos de trabajo con "Mark handled". La historia (abiertas, completadas hoy y en 7 días) es una línea de enlaces a la lista filtrada. |
| `/admin/yard-operations` | "¿Dónde está cada camión?" (Etapa 6). Pestaña **Shop**: búsqueda (Truck, Work Order o mecánico), **More filters** (preparación, paso, estado y prioridad de la WO actual, D11) y filtros rápidos que se aplican al tocar, con su conteo: Todos, Bloqueados (pausa o blocker, D5), Prioridad alta, Fuera del taller (`outOfShop`, D24). Debajo, "Mostrando N de M camiones · En vivo" (la API cuenta sobre el filtro, D6; se refresca cada 30 s). Un **carril por paso** de arriba abajo (Inspection … Ready to Go); un paso vacío es una línea. La tarjeta: número, prioridad si es alta, vehículo, **una línea de alerta** (bloqueado, en pausa, fuera del taller, sale pronto con Jobs pendientes según Dispatch, nadie en un Job), el siguiente paso, WO y edad, progreso y avatares; Ready to Go tiene Return to Service (diálogo). Pestaña **Dispatch** (`?tab=movement`): tarjetas de agent-reporting (solo lectura) cruzadas con el taller: los números abren el Truck, los que tienen WO abierta van marcados y hay un aviso cuando Dispatch dice Outside y el taller tiene una WO abierta. |
| `/admin/trucks`, `/admin/trucks/[id]` | Lista de camiones con siguiente paso; **el Truck es el lugar de trabajo del Manager** y responde "¿puede salir y, si no, qué lo frena?" (ver abajo). |
| `/admin/work-orders`, `/admin/work-orders/[id]` | Lista con filtros; detalle del WO (ver abajo). |
| `/admin/work-orders/new` | Crear WO (solo Truck, prioridad, nota). |
| `/admin/history` | WOs completados y cancelados. |
| `/admin/mechanics`, `/admin/mechanics/[id]` | Roster. Manager y System Admin: Agregar persona (con contraseña temporal), nombre y tipo, Desactivar / Reactivar, Reiniciar contraseña (D22). |
| `/admin/catalog`, `/admin/catalog/categories/[id]` | Catálogo de Jobs. Manager y System Admin: Agregar Job a una categoría activa, Renombrar y Activar (D25); un nombre repetido en la categoría no se acepta. Las categorías son de solo lectura. |
| `/admin/setup/workflow` | Shop workflow: responsable por defecto de cada paso (Save debajo de la lista) y **Shop hours** (hora del cierre del día y días hábiles, con su propio Save; D20). |

**Detalle del Truck** (`/admin/trucks/[id]`), de arriba abajo (LTR-174, rediseño
Etapa 4 del 2026-10-06; en computadora dos columnas ≈ 2:1, en el teléfono una
sola en el mismo orden):
- **Encabezado operativo:** número, vehículo y empresa, **un solo chip** de
  estado (Not Ready, Ready to close, Ready to Go, In Service o "Sin Work Order
  abierto") y el **chip del WO** ("WO-004 · In progress ↗"; completado dice
  "Completed"). A la derecha **Add work** y el menú **…**: abrir el WO,
  **Pause Work Order…** (lleva al WO con su diálogo de pausa; solo con el WO
  In progress), **New Work Order** (diálogo) y **Copy link**. Debajo, "N Jobs
  pendientes · M mecánicos".
- **Pasos para salir del taller:** una fila de píldoras (Inspection, Shop
  Work, PM, Alignment, Detailing, Quality Check, Close Work Order) con su
  estado: hecho, pendiente con número, bloqueado, en taller externo, falta,
  no aplica o listo para cerrar. Solo ordena lo que trae el Work Plan de la
  API. Cada píldora lleva a su paso. En el teléfono es una fila con scroll
  lateral.
- **Siguiente paso:** actúa en el Truck (D26). La inspección se registra en
  el mismo aviso; Assign abre el selector de mecánico; Resolve pide la nota
  al pedirla; Close y Return to Service confirman en un diálogo (D27); New
  Work Order es un diálogo (prioridad y nota) y el Manager se queda en el
  Truck. Después de "Issues found" sin WO, primero **Add work**.
  `external` lleva a la fila del Job en el WO.
- **Work Plan** (columna principal): un bloque por paso con icono, nombre y
  resumen; los terminados empiezan plegados. Debajo, sus Jobs de **solo
  lectura**: punto de estado, nombre, estado y dueño, y **↗ Manage in Work
  Order** (abre el WO en esa fila, resaltada, con "Back to Truck"). Solo un
  Job **sin dueño** tiene **Assign** (selector con búsqueda). La inspección
  registrada es texto con **Change**. Éxito = toast; los errores salen bajo
  el encabezado con **Reload Truck** cuando hubo conflicto.
- **Add work** abre un **panel lateral** (hoja en el teléfono). `#add-work`
  lo abre desde el WO. Se abre solo al registrar "Issues found" sin Jobs,
  salvo que el siguiente paso pida antes cerrar, Return to Service, un
  blocker o una pausa.
- **Sin Work Order abierto:** el Work Plan muestra **solo la Inspección**
  (D14) y, una vez registrada, el motivo que falta.
- **Contexto** (columna lateral, abierta): datos del Truck (millaje, empresa,
  dueño, VIN con copiar, estado operativo, ubicación) e historial de
  reparaciones con **Load more**.

**Detalle Admin del WO** (`/admin/work-orders/[id]`), de arriba abajo (LTR-174;
misma división 2:1 en computadora, una columna en el teléfono):
- **Encabezado operativo:** Truck (enlace), número del WO y vehículo,
  distintivos de prioridad y estado, "N Jobs pendientes · M mecánicos", el
  **siguiente paso** (mismo texto que el Truck; actúa aquí, D26; si el paso es
  resolver un bloqueo, el bloqueo vive en ese aviso y la nota se abre con
  Resolve) y a la derecha **Pause** / **Resume** (Pause abre un diálogo que
  pide el motivo, sin preselección) y el menú desplegable **…** con Return to
  Service, Reopen, **Corregir tiempo…** (abre Historial › Tiempos) y Cancel
  Work Order, cada uno en su diálogo con motivo. Si llegas desde el Truck, el
  enlace de vuelta dice "Volver al Truck N" y `#job-<id>` resalta esa fila.
- **Confirm completion** cuando el WO está listo para cerrar (antes la
  tarjeta no existe: el paso siguiente dice qué falta, LTR-189 W2); una barra
  fija aparece solo al pasar ese botón con el scroll.
- **Jobs** como tabla de columnas fijas `Job · Mecánico · Estado · Acción`
  (en el teléfono cada fila se apila; etapa 5): primero los abiertos, los
  bloqueados arriba con borde ámbar, los de taller externo después y QC al
  final; un ayudante va bajo su Job; los hechos y cancelados en un grupo
  plegado. El estado es un punto y una palabra. El selector de mecánico tiene
  búsqueda y "Quitar asignación" (QC no tiene selector: lo toma Safety);
  "Mark complete" es discreto y primario solo en QC; el PM job muestra su
  variante de servicio; Cancel / Reopen Job viven en el menú "…" de cada fila
  con su diálogo de motivo. El "…" también tiene **Agregar ayudante** (no en PM,
  QC ni en un Job de ayudante; D23) y **Enviar a taller externo** (no en QC;
  D24). Un Job de ayudante muestra "· ayudante" junto al nombre. Un Job afuera
  muestra "En taller externo · pieza|camión" (la nota como tooltip), el estado
  "En taller externo" y el botón **Regresó** (Completar / Asignar a). Los Jobs
  se agregan desde el Work Plan del Truck (D6). En el Work Plan del Truck esos
  Jobs se ven igual (estado `external`, sin selector de mecánico).
- **Bloqueos reportados:** los activos que no están ya en el siguiente paso,
  en un bloque de aviso con Resolve; los resueltos, plegados ("Bloqueos
  resueltos · N"). Nada si no hay.
- **Notas:** el hilo y, debajo, el campo siempre visible con **Publicar**;
  pedidos de trabajo con "Mark handled".
- **Contexto** (columna lateral, cada dato una vez): tarjeta **Truck**
  (vehículo, millaje, VIN, empresa, enlace), tiempos (labor, espera y una
  barra por mecánico), prioridad (selector + Update priority) e historial de
  reparaciones plegado.
- **History and audit** plegado al final, con pestañas: **Actividad** (por
  día, lo último primero, "Ver todo"), **Tiempos** (totales y una sola lista
  de tramos de trabajo y pausas, con "cierre del día" / "cambio de camión"
  cuando la app los cerró, D20, D21; cada tramo cerrado tiene **Corregir…**,
  un diálogo que valida fin > inicio y motivo) y **Pausas**.
- Los estados siempre son distintivos y las acciones siempre botones. Los
  avisos de éxito son solo toasts.

**Listas** (Trucks, Mechanics, Catalog, History): en el teléfono cada fila es
una tarjeta. Mechanics e History tienen un panel **Filters** con el número de
filtros activos. Mechanics muestra las capabilities por nombre (Standard, PM,
Shop Admin, Yard, Work Orders).

### Mecánico

| Ruta | Qué es |
|---|---|
| `/` (= `/mechanic/standard`, `/mechanic/pm`) | Inicio: mi trabajo. Cada rol ve su versión. |
| `/qc` | Safety: camiones por revisar (Tomar, Aprobar, Devolver) y devueltos. |
| `/work-orders/[id]` | Detalle del WO para el mecánico (Standard, o el PM job dentro del WO con `?view=pm`). Un Job de ayudante dice "· ayudante" (D23); un Job en taller externo aparece en "Other work on this Truck" en solo lectura con "En taller externo" y nunca es del mecánico (D24). |
| `/mechanic/pm/new` | Create PM service. |
| `/mechanic/{standard,pm}/trucks`, `/trucks/[id]/history` | Buscar camión e historial de reparaciones. |
| (aviso en el inicio y el detalle) | Si la app detuvo su reloj (cierre del día o cambio de camión) y le queda trabajo: "Ayer quedó en curso · toca Continuar" o "Tu reloj está en la unidad 944 · toca Continuar", junto al botón Continue de siempre. El PM job tiene su propio Continue (D20, D21). |
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
Todo texto de la UI vive en esos dos catálogos: ningún componente escribe
`locale === 'es' ? … : …` (las etiquetas `Intl` salen de `intlLocale()` en
`shop-locale.ts`). La API habla solo inglés; sus errores se muestran con
`apiErrorMessage()` (`lib/api-error-message.ts`), que mapea cada `code` de la
API a una frase EN/ES (`lib/api-error-copy.ts`, expuesto como `apiError` en
los dos catálogos), usa la copia de red/timeout y, si no hay código, cae al
respaldo del catálogo (el texto crudo solo se ve en inglés). Los errores de
Supabase Auth se mapean igual (`authErrorMessage()`). *(LTR-181.)*

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
- `SUPABASE_URL` (o `NEXT_PUBLIC_SUPABASE_URL`) + `SUPABASE_SERVICE_ROLE_KEY`
  (API, solo servidor): con las dos, la API crea y reinicia cuentas de
  Supabase Auth desde el roster (D22). Sin ellas, el roster funciona sin
  cuentas de acceso (`temporaryPassword: null`).
- `CRON_SECRET` (API, solo servidor): secreto con el que Vercel Cron llama
  `GET /api/internal/day-close` (respaldo del cierre del día, D20). Vercel lo
  manda solo en el encabezado `Authorization: Bearer …`.
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
