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
| **Shop Manager** | `manager` | `admin.access`, `work_orders.manage`, `yard.operations.manage` | Crea y planea WOs, inspecciona, asigna, pausa, resuelve bloqueos, hace QC como respaldo de Safety en `/qc` (D29), arma los equipos de cada paso (D28), cierra, Return to Service. **Da de alta al personal** (Standard, PM, Safety), lo desactiva/reactiva y reinicia contraseñas (D22). **Mantiene el catálogo de Jobs** (D25, D30): categorías, Jobs y aliases; los Jobs y categorías del flujo del taller están protegidos. |
| **System Admin** | `admin` | `admin.access` (+ las demás que necesite) | Lo mismo que el Manager (el roster y el catálogo de Jobs los abre por rol, aunque solo tenga `admin.access`). |
| **Mecánico Standard** | `mechanic` | `mechanic.standard` (+ `inspection.perform` si el Manager lo enciende) | Ejecuta sus Jobs asignados. Con "Can inspect trucks" también inspecciona (D41). |
| **Mecánico PM** | `mechanic` | `mechanic.pm` (+ `inspection.perform` si el Manager lo enciende) | Hace el PM de los camiones. Con "Can inspect trucks" también inspecciona (D41). |
| **Safety (Quality Check)** | `mechanic` | `quality_check.perform` | Revisa los camiones terminados: los aprueba o los devuelve con una nota (D19). Dos personas. |

| Capability | Da acceso a |
|---|---|
| `admin.access` | Entrar a `/admin`. Reabrir WO, corregir tiempos, reabrir Job cancelado, Return to Service. **El Manager también la tiene**, así que puede hacer todo esto. |
| `work_orders.manage` | Crear WO, agregar/cancelar Jobs, asignar, prioridad, notas, pausar/reanudar, completar/cancelar WO, resolver bloqueos, editar Shop workflow. Con `admin.access`, también el **roster** (`POST/PATCH /api/admin/mechanics`, reset-password; D22) y el **catálogo** (`/api/admin/catalog/jobs`, `/categories`, `/jobs/:id/aliases`, `GET /search`; D25, D30). Mecánicos y Safety reciben 403. |
| `yard.operations.manage` | Registrar la inspección del Truck (con `work_orders.manage`, guardar la hoja y agregar defectos: `/api/admin/trucks/:id/inspection`). |
| `inspection.perform` | D41: un mecánico Standard o PM inspecciona con la hoja: "To inspect" en My work y `/api/inspections/*`. Sus defectos crean Jobs **sin dueño** (única excepción a "el mecánico no agrega Jobs"). Se da en People → Extra permissions; Safety no la recibe y pasar a Safety la quita. |
| `mechanic.standard` | Pantallas y acciones del mecánico Standard. |
| `mechanic.pm` | Pantallas y acciones del mecánico PM. |
| `quality_check.perform` | La pantalla de Safety (`/qc`): tomar, aprobar o devolver el Quality Check. Nada más. |

El mecánico **nunca** crea WOs, cambia prioridad, agrega Jobs, pausa el WO ni
la termina. La API responde 403. Única excepción (D41): con `inspection.perform`
los defectos de su inspección crean Jobs sin dueño.

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
- **Quitar del Shop (D31, LTR-199):** `POST /api/admin/mechanics/:id/remove` pone `active = false`, `removed_at` y `removed_by_id` y saca a la persona de todos los equipos. Se niega con `MECHANIC_HAS_OPEN_WORK` igual que desactivar. Una persona quitada no entra, no aparece en ninguna lista (solo con `?status=removed`) y no se reactiva (`PERSON_REMOVED`). `DELETE /api/admin/mechanics/:id` la borra de verdad solo si no tiene ningún historial (Jobs, WOs, notas, tiempo, bloqueos, Activity Log, eventos del camión); si no, `PERSON_HAS_HISTORY`. `POST /api/admin/mechanics/:id/send-to-queue` devuelve a su cola los Jobs que vinieron de una cola de equipo (no con su reloj corriendo en ese camión).
- **Cambiar de tipo (D-SET2, D-SET3):** con Jobs pendientes o tiempo corriendo se niega (`MECHANIC_HAS_OPEN_WORK`); si no, la persona sale de los equipos que ya no puede hacer.
- **Trabajo abierto (ME1):** en la lista y en el detalle se cuenta por los Jobs
  `to_do` de la persona en WOs abiertos (la misma regla que bloquea
  desactivar), no por `mechanic_assignments`. Así el PM y Safety también
  cuentan. El detalle trae además `pendingJobs`, `runningSession` y
  `defaultOwnerOfSteps`. Con eso, el diálogo de desactivar muestra el bloqueo
  antes de confirmar (ME2), y cambiar el tipo avisa de qué pasos es dueña y
  cuántos Jobs le quedan; el primer Save solo muestra el aviso (SW3). "Work
  Orders cerrados recientes" son los WOs cerrados donde completó un Job (ME4).
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
  (revisión en la bandeja, abajo).

### Bandeja de Custom Jobs (LTR-57 / D25)
- **Job Catalog → Custom Jobs to review** (`/admin/catalog/review`; el catálogo
  muestra "N Custom Jobs to review" cuando hay). Lee los Jobs con `is_custom` y
  `review_status = pending_review` (o vacío, los viejos).
- **Grupos:** misma categoría y mismo nombre sin mayúsculas, tildes ni espacios
  (`normalizeCatalogText`). Cada grupo dice cuántas veces se usó, en qué Work
  Orders, las notas y los Jobs del catálogo parecidos (nombre o alias igual o
  contenido, la misma categoría primero). El nombre del grupo es la forma más
  usada (la más prolija si empatan).
- **Acciones sobre todo el grupo** (Manager y System Admin):
  - **Tie** a un Job del catálogo: `review_status = mapped`, `mapped_catalog_job_id`,
    y el nombre del grupo queda como alias de ese Job (si el alias está libre).
  - **Add to catalog**: crea el Job (categoría activa, nombre que no exista:
    `CATALOG_JOB_EXISTS` propone ligar) y le liga el grupo (`added`).
  - **Keep as one-off**: `kept`, sin tocar el catálogo.
  - **Undo** en la pestaña Reviewed: vuelve a `pending_review` (el Job o el alias
    creados quedan).
- Los Work Orders **no cambian**: el Job conserva su nombre y sigue siendo Custom;
  el lazo está en `mapped_catalog_job_id`. Historial: `custom_jobs_reviewed`.
- **Catálogo con protecciones (D30, LTR-198):**
  - Los Jobs del sistema (`catalog_jobs.system_key`: `pm_a`, `pm_b`, `alignment`, `detailing`, `quality_check`) no se desactivan ni se borran (`SYSTEM_JOB_LOCKED`); se pueden renombrar. Cada Job de un WO hecho de ellos copia la clave (`work_order_jobs.system_key`, trigger `work_order_jobs_copy_system_key`), y `classifyWorkPlanLane` la lee antes que el nombre.
  - Las categorías del sistema (PM, Detailing, Quality Check; `job_categories.system_key`) no se renombran, desactivan ni borran (`SYSTEM_CATEGORY_LOCKED`): la app lee "PM" por nombre en muchos lugares. Una categoría con un Job del sistema (Suspension & Steering) no se desactiva (`CATEGORY_HAS_SYSTEM_JOB`).
  - Borrar: un Job solo si ningún WO lo usó (`CATALOG_JOB_IN_USE` con `workOrderCount`); una categoría solo vacía y nunca usada (`CATALOG_CATEGORY_IN_USE`). Si no, se desactiva.
  - Aliases: `alias_norm = normalizeCatalogText(texto)` (sin tildes ni mayúsculas). Un alias repetido responde `CATALOG_ALIAS_EXISTS` con el Job y la categoría que ya lo tienen. El nombre del Job siempre es alias. Renombrar conserva el nombre viejo como alias salvo `keepOldNameAsAlias: false` (D-SET4).
  - Una categoría inactiva guarda su motivo (`inactive_reason`, D-SET9).
  - `applyJobCatalog` (cada publicación) solo crea lo que falta; reconoce lo que ya creó por `seed_key` y nunca renombra, reactiva ni reasigna aliases.
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

### Inspección (D41: la hoja)
- Es la hoja de inspección del taller (`inspection_checklist_items`, editable en
  Setup → Inspection checklist; la lista base son los 53 puntos del papel y se
  carga en cada publicación junto al catálogo, solo agrega lo que falta). Cada
  punto apunta al Job del catálogo que crea un defecto, o al paso Detailing.
- Guardar (`truck_inspections`, `truck_inspection_items`, `tire_readings`) pide
  todos los puntos, la nota de cada defecto y las 10 llantas (PSI y tread). Cada
  defecto crea su Job; los del mismo Job van en uno; si el Job ya está en la WO
  solo se suma la nota; la limpieza va a Detailing; una llanta en "fix" crea
  Flat Repair (presión) o Tires (tread). Cada hallazgo queda ligado a su Job en
  `work_order_job_sources` (varios por Job; también lo usará Samsara S-6). El
  resultado (Issues found / No issues found) sale de la hoja y se guarda en el
  mismo requirement de readiness.
- Lo guardado no se edita: "Add defects" solo pasa un punto OK / N/A a defecto.
  Para quitar un defecto se cancela su Job en la WO.
- Umbrales (`inspection_settings`): 110 / 95 PSI, tread mínimo 4/32 y 2/32,
  vigilar a ±10 %, arreglar a ±20 % (`tireReadingStatus` en shared).
- Hace falta una WO abierta que no sea de PM.
- Antes de D41 se registraba con "No issues found" / "Issues found"; esas
  inspecciones viejas quedan como estaban. La inspección **pertenece a
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

### Partes y proveedores (`parts`, `part_fitments`, `vendors`; LTR-200 / D32, PC-1)
- **El catálogo de partes es el del PM.** Admin → Parts & costs → **Parts**
  (`/admin/parts/catalog`) lo muestra por las 9 categorías del PM con su costo
  de referencia (`unit_cost_cents`, centavos; "No cost yet" si falta), su
  proveedor habitual y **Sirve para** (`part_fitments`: sin filas = todos los
  camiones; si no, marca y/o modelo). La misma regla (`partFitsTruck`, en
  `packages/shared`) decide qué partes ofrece el PM.
- **El PM no ve costos ni proveedores** (D-PC7): `GET /work-orders/:id/pm` no
  cambia.
- **Una parte elegida en un PM en curso** (su Job de PM sin terminar y el WO
  abierto) no se puede desactivar ni quitarle la marca de ese camión:
  `PART_IN_OPEN_PM`, con el camión. Así el siguiente guardado del mecánico no
  falla. Al terminar el PM, sí.
- Una parte nunca se borra (los PM viejos la muestran); se desactiva.
  `source` = `seed` (lista base) o `app` (la creó el Manager).
- **La lista base** (`applyPmParts`, `apps/api/prisma/pm-parts.ts`, la usa el
  seed) solo agrega las partes que faltan: no apaga, no reactiva y no cambia
  marcas, costos ni proveedores.
- **Vendors** (`/admin/parts/vendors`): nombre único sin importar mayúsculas
  (`VENDOR_NAME_TAKEN`), vende partes y/o hace reparaciones afuera, teléfono,
  correo, número de cuenta, notas. No se borra; se desactiva.
- **Quién:** solo el Shop Manager y el System Admin, también para leer
  (`/api/admin/parts-costs/*` con `ManagerWritesGuard`). El grupo del menú
  no aparece para nadie más.

### Compras de partes (`part_purchases`, `part_purchase_lines`, `attachments`, `truck_cost_entries`; LTR-200 / D32, PC-2)
- **Purchases** (`/admin/parts/purchases`): una compra = proveedor, fecha y
  número de factura, líneas (parte del catálogo u "Other" con descripción;
  cantidad con 2 decimales; costo unitario), impuesto, flete, notas y la
  factura adjunta (opcional, D-PC10).
- **Dinero en centavos.** La API calcula cada total de línea (cantidad × costo,
  al centavo) y el total; si el que manda la pantalla no cuadra responde
  `TOTAL_MISMATCH`.
- **Factura repetida** (D-PC8): mismo proveedor y número (sin espacios,
  guiones ni mayúsculas: `invoice_norm`) entre las no anuladas → 409
  `DUPLICATE_INVOICE` con la que ya existe. Un candado por proveedor en la
  transacción y un índice parcial único lo aseguran. La pantalla avisa al salir
  del campo (`GET /invoices/check`).
- **Doble envío** (A59): `POST` exige el encabezado `Idempotency-Key` (uno por
  formulario abierto); la misma clave devuelve la misma compra.
- **El libro de costos de cada camión** (`truck_cost_entries`): una compra
  escribe una fila por camión = sus líneas + su parte del impuesto y el flete,
  repartidos según las líneas (el centavo que sobra al grupo más grande,
  `allocateExtra`, D-PC2). Las líneas sin camión no cuentan en ningún camión
  (D-PC5). Las filas **no se editan ni se borran**: corregir escribe la reversa
  de cada fila viva y las nuevas **solo si cambió algo que llega al libro**
  (proveedor, número, fecha, líneas, camiones, impuesto, flete; PCA6); cambiar
  solo el archivo o las notas no toca el libro. Anular (con motivo) escribe
  solo reversas. Nada se borra; una compra anulada queda tachada y libera su número.
- **El archivo adjunto por separado** (PCA6): `PATCH /purchases/:id/attachment` y
  `PATCH /outside-repairs/:id/attachment` (`{ attachmentId | null }`) agregan,
  reemplazan o quitan el archivo sin pasar por Edit; en pantalla, "Add invoice
  file" / "Replace file" en el detalle.
- **"Charged to Finance"** (PCA4): el detalle de la compra y de la reparación trae
  `chargedOn` (las facturas internas, borradores incluidos, que cobran sus filas
  vivas) y cada movimiento de Truck → Costs trae el suyo. Editar o anular algo que
  ya está en una factura enviada avisa que la corrección cae como crédito en la
  factura siguiente del camión.
- **Facturas adjuntas**: Supabase Storage, bucket **privado** `invoices`
  (se crea solo la primera vez, con tipos PDF/JPG/PNG/HEIC y límite de 10 MB).
  El navegador sube directo a una URL firmada; se abre con un enlace de 5
  minutos. Sin `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` el campo no aparece
  y la API responde `FILES_NOT_CONFIGURED`.
- **Último pagado** (D-PC6): Parts lo muestra por parte; la compra nueva parte
  del último precio pagado a ese proveedor, o del costo de referencia. El
  costo de referencia solo lo cambia el Manager.
- `attachments.owner_type` y los valores `labor` / `internal_invoice` del libro
  quedan para las etapas siguientes (§8 de la propuesta).

### Reparaciones externas (`outside_repairs`; LTR-200 / D32, PC-3)
- **Outside repairs** (`/admin/parts/outside-repairs`): camión (obligatorio),
  proveedor, fecha y número de factura, qué se hizo, monto, factura adjunta y
  notas; opcionalmente **el Job enviado a taller externo** (D24).
- **Los Jobs que se ofrecen** (`GET /external-jobs?truckId=`): los del camión que
  están afuera ahora y los que salieron alguna vez, sin límite de tiempo (del Activity Log,
  `job_sent_external` / `job_returned_external`; PCA3). En el Work Order, cada Job trae
  `wentExternal`, y el que volvió sin factura muestra "Returned · no invoice yet" con la
  acción "Add outside repair invoice". Un Job de otro camión responde
  `JOB_NOT_ON_TRUCK`; uno que nunca salió, `JOB_NEVER_EXTERNAL`. Se guarda una copia
  de qué salió (pieza o camión).
- **"Enviar a taller externo" y "Regresó" no cambian**: la reparación guarda el id
  del Job, así sigue ligada aunque "Regresó" borre el estado externo.
- En el Work Order, el `…` del Job afuera tiene **"Add outside repair invoice"**
  (abre el formulario con el camión y el Job ya elegidos) y el Job muestra
  "Invoice $1,840.00 · Diesel Pro". Solo el Manager y el System Admin ven
  montos: `GET /admin/work-orders/:id` quita `outsideInvoices` a los demás.
- **Factura repetida entre compras y reparaciones** (D-PC8): mismo proveedor y
  número entre las no anuladas de las dos tablas (`invoice-registry.ts`, mismo
  candado por proveedor); el aviso dice si la existente es compra o reparación.
- **Libro de costos**: una fila `outside_repair` en el camión, con su Work Order;
  corregir y anular escriben reversas como en las compras.

### Costos del camión (Truck → Costs; LTR-200 / D32, PC-4)
- El detalle del camión tiene pestañas **Overview · Costs** (`?tab=costs`), solo
  para el Manager y el System Admin (D-PC7). La API es
  `GET /admin/parts-costs/trucks/:id/costs?from=&to=` (mismo guard).
- **Solo lee el libro** (`truck_cost_entries`): totales de partes, de
  reparaciones externas y total en el período (por fecha de factura), una barra
  por mes, y cada movimiento con su WO y el enlace a su compra o reparación. Las
  reversas salen en negativo, marcadas **Voided** (anulada) o **Corrected**
  (corregida), y bajan los totales.
- Período: este mes, últimos 3 meses (por defecto), este año, todo.
- **Labor** (D34, LB-1): las horas de las sesiones **cerradas** de los WO del
  camión en el período (D18, D21) y, con tarifa, su monto; sin tarifa, solo horas
  y "Set a labor rate". **Charge to Finance** (D34, LB-2): la tarjeta abre
  Internal invoices (2026-10-10; antes decía "coming later", OPEN_ISSUES DM4).
- "Add purchase" y "Add outside repair" abren el formulario con el camión elegido.
- Terminar un PM no escribe nada en el libro (D-PC4).

### Mano de obra (`labor_rates`; LTR-201 / D34, LB-1)
- **Setup → Labor rate** (`/admin/parts/labor-rate`; en el menú va en Setup desde PCA8): **una tarifa por hora
  para todo el taller**, desde una fecha (una por fecha: `LABOR_RATE_DATE_TAKEN`).
  Nunca se edita una tarifa: se agrega otra. Solo Manager y System Admin.
- **Antes de guardar** (PCA7): `GET /labor-rates/preview?effectiveFrom=` dice cuántos
  WO completados se recalculan desde esa fecha y cuántos ya están en una factura
  enviada; la pantalla lo muestra debajo del formulario.
- **Quitar la última tarifa** (PCA7): `DELETE /labor-rates/:id`, solo la más reciente
  (`LABOR_RATE_NOT_LATEST`) y solo mientras ninguna factura enviada o aceptada cobre
  mano de obra valorada con ella (`LABOR_RATE_IN_USE`); los WO vuelven a la tarifa
  anterior con reversas. La lista marca `deletable` en la que se puede quitar.
- **Mano de obra de un Work Order** = minutos de sus sesiones **cerradas** × la tarifa
  vigente el día en que empezó cada sesión (`laborAmount`, `packages/shared`). Las
  sesiones de antes de la primera tarifa cuentan horas pero no monto. Solo los WO
  **completados**; un WO cancelado no cobra mano de obra.
- **Se escribe en el libro del camión** (`truck_cost_entries`, `kind = labor`,
  `source_type = work_order_labor`, con su WO y la fecha de cierre) con
  `syncWorkOrderLabor` (`apps/api/src/parts-costs/labor-ledger.ts`), que corre al
  completar, reabrir, cancelar y corregir tiempos de un WO, y al poner una tarifa
  (recalcula los WO completados con trabajo desde esa fecha). Compara lo que hay con
  lo que debería haber y, si cambió, escribe reversas y la fila nueva.
- **Truck → Costs**: la tarjeta **Labor** muestra el monto y las horas; sin tarifa,
  solo las horas y "Set a labor rate". Las barras por mes suman partes, reparaciones
  y mano de obra.

### Factura interna a Finanzas (`internal_invoices`, `internal_invoice_lines`; LTR-201 / D34, LB-2)
- **Parts & costs → Internal invoices** (`/admin/parts/internal-invoices`): una por
  **camión y mes**. Finanzas no entra a la app.
- **Cierre del mes** (PCA16, D37): arriba de la lista, "Month close" muestra, para un mes,
  cada camión con costos sin cobrar hasta fin de mes y su factura del mes
  (`GET /internal-invoices/month?month=`), y "Create drafts for all" arma los borradores que
  faltan (`POST /internal-invoices/create-all`); salta los camiones que ya tienen factura viva.
  Send, número y PDF siguen por camión.
- **Borrador:** trae las filas del libro del camión con fecha **hasta el fin del mes**
  que ninguna otra factura (no anulada) cobra: partes al costo, reparaciones externas y
  mano de obra. Así, una corrección hecha después de enviar una factura cae en la
  siguiente. Una fila y su reversa, ambas sin cobrar, se cancelan y no entran.
  Lo anterior al mes se muestra aparte, en pantalla y en el PDF, como **"Carried over
  from earlier months"** con su subtotal, y el diálogo de Send avisa cuánto es (PCA5).
  Una línea negativa que corrige algo ya facturado dice de qué factura viene
  (`correctsInvoice`, PCA4). Un solo
  borrador por camión y mes (`INTERNAL_INVOICE_DRAFT_EXISTS`); sin nada pendiente,
  `NOTHING_TO_CHARGE`.
- En el borrador se puede **sacar** una línea (queda sin cobrar para una factura
  posterior; "Bring them in" no la vuelve a traer) y **volver a ponerla**; "Bring them
  in" agrega lo nuevo.
- **Send:** recibe el número `SHOP-AAAA-NNNN` (consecutivo por año, con candado) y se
  congela (`INVOICE_NOT_DRAFT` para cualquier cambio). **Download PDF** abre el diálogo
  de impresión con una página propia (bloque `#invoice-print`, negro sobre blanco):
  "Guardar como PDF" y se manda a Finanzas.
- **Mark accepted** cuando Finanzas la acepta. **Void** (con motivo) libera sus líneas
  para otra factura; el número no se reusa. Un borrador se borra, no se anula.
- Cada fila del libro está en una sola factura no anulada: `active` en la línea más un
  índice único parcial.

### Notas (`work_order_notes`)
- Solo se agregan, nunca se editan (D8). Tipos: `note` y `work_request`
  ("Pedir trabajo": el mecánico avisa de trabajo extra).
- El Manager marca un `work_request` como atendido. No se aceptan notas en
  WOs cerrados.

### Shop workflow (`shop_workflow_steps`, `shop_workflow_step_members`)
- Un renglón por paso obligatorio (`pm`, `alignment`, `detailing`,
  `quality_check`) → Job de catálogo, orden, activo, y su **equipo**
  (`shop_workflow_step_members`, LTR-197 / D28). `default_mechanic_id` queda
  como espejo de un equipo de uno, para versiones viejas; ya no se lee.
- **Quién puede estar en el equipo:** PM → `mechanic.pm`; Alignment y
  Detailing → `mechanic.standard`; Quality Check → `quality_check.perform`
  (D-SET7). Nunca una fila con rol `admin`. Alguien que se desactiva queda en
  el equipo marcado y no recibe Jobs; cambiar de tipo lo saca de los equipos
  que ya no puede hacer (D-SET2).
- **Un WO nuevo:** si el equipo tiene una persona que puede, el Job nace suyo.
  Con dos o más (y siempre en Quality Check), nace sin dueño en la **cola del
  equipo** (`work_order_jobs.workflow_step_key`); un Job en la cola no cuenta
  como "sin asignar" en el siguiente paso ni en el Dashboard. Sin nadie, nace
  sin dueño y el Manager lo asigna.
- **La cola:** `GET /api/team-queue` lista los Jobs de los pasos del mecánico;
  `POST /api/team-queue/:jobId/take` (gana el primero, `JOB_ALREADY_TAKEN`) y
  `/release` (no con su reloj corriendo en ese camión,
  `JOB_RELEASE_CLOCK_RUNNING`). Los dos quedan en el Activity Log
  (`job_taken_from_team_queue`, `job_released_to_team_queue`).
- **Quality Check:** Safety ve la cola solo si está en el equipo de QC
  (`onTeam: false` si no). El Shop Manager y el System Admin usan `/qc` como
  respaldo (D29); lo que aprueban o devuelven queda con
  `actor: 'manager_backup'`.
- Se edita en Admin → Setup → Shop workflow. Solo aplica a WOs nuevos.
- Guardar manda solo los pasos cambiados, y la API no vuelve a revisar un
  dueño que no cambia (SW1). Un dueño que ya no puede hacer el paso
  (inactivo o de otro tipo) sigue a la vista, marcado (`defaultMechanic.eligible`),
  y los WOs nuevos dejan ese paso sin asignar. Un paso cuyo Job o categoría
  está inactivo se marca (`catalogJob.active = false`), porque los WOs nuevos
  lo saltan (SW2). El Job de un paso activo no se puede desactivar
  (`CATALOG_JOB_IN_WORKFLOW`, 409), y un Job de una categoría inactiva no se
  puede activar (`CATALOG_CATEGORY_INACTIVE`, 400). Salir con cambios sin
  guardar pide confirmar (SW4).

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
3. En el Truck (`/admin/trucks/[id]`) toca **Start inspection** y llena la
   hoja (`/admin/trucks/[id]/inspection`, D41): los puntos, las 10 llantas y
   Review, donde elige "¿Quién lo hace?" en cada Job nuevo. Al guardar, cada
   defecto es un Job. Para trabajo que no salió de la inspección sigue **Add
   work**; un Job personalizado puede entrar también al catálogo (D25).

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

**MECH-INSP — Inspeccionar (con "Can inspect trucks", D41):** My work →
"To inspect" → Start → la misma hoja (`/mechanic/{standard,pm}/inspect/[truckId]`).
Sus Jobs nacen sin dueño; el Manager los asigna.

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
| `/admin` | Dashboard: responde "¿qué hago ahora?" (D26). Cuatro contadores (Blocked or paused, Ready to close, Ready to Go, Unassigned) que filtran una cola "Needs you" con todo lo que espera al Manager —WOs abiertas y Trucks Ready to Go, agrupadas por acción—, cada fila con su acción ahí mismo (Resolve con nota a pedido, Resume, **Close Work Order de un toque** — decisión P5 del 2026-10-06; se reabre desde el WO —, Return to Service con su diálogo, Assign, **inspección con dos botones**: "No issues found" se registra ahí e "Issues found" se registra y abre el Truck con Add work — P3 —, Mark QC complete); "Sale pronto y no está listo" (salidas de Dispatch cruzadas con WOs abiertas, hoy y el siguiente día hábil); pedidos de trabajo con "Mark handled" y el enlace al Truck. La historia (abiertas, completadas hoy y en 7 días) es una línea de enlaces a la lista filtrada. Etapa 8 (igual a la maqueta): encabezado con "Live", la cola en una tarjeta con los grupos sobre fondo hundido, filas "Truck 918" de dos líneas (qué pasa y el detalle: quién y cuándo en un blocker, "Desde" en una pausa, "Los N Jobs están hechos", "Dispatch: sale …" en Ready to Go) y botones con icono a la derecha. Los accesos a las pantallas de mecánico (**Workspaces**) ya no están en el Dashboard: son un grupo al final del menú lateral, solo para quien también es mecánico (P4). |
| `/admin/yard-operations` | "¿Dónde está cada camión?" (Etapas 6 y 8). Encabezado con "Live". Pestaña **Shop**: búsqueda (Truck, Work Order o mecánico) y, en la misma fila, filtros rápidos que se aplican al tocar, con su conteo: Todos, Bloqueados (pausa o blocker, D5), **Sale pronto** (Dispatch: hoy o el siguiente día hábil; la web manda `soonTrucks` y la API cuenta y filtra en todas las páginas), Prioridad alta, Fuera del taller (`outOfShop`, D24). Sin "More filters" (decisión del dueño, Etapa 8); la URL sigue aceptando `readiness`, `phase`, `workOrderStatus` y `priority` desde enlaces. Debajo, "N camiones en el taller" o "Mostrando N de M" (la API cuenta sobre el filtro, D6; se refresca cada 30 s). En computadora, un **tablero Kanban** (D33): una columna vertical por paso (Inspection … Ready to Go) con su cuenta (`byPhase`) y las tarjetas apiladas; como Trello: cada columna mide lo que sus tarjetas y luego las desplaza por dentro, y el tablero se desplaza de lado dentro de sí mismo (la página no); un paso vacío es una columna igual con "No trucks". Botón **Full screen** (Esc o el mismo botón sale) que deja búsqueda, filtros y tablero ocupando toda la pantalla. En el teléfono, un paso plegable por grupo y los vacíos ocultos. La tarjeta: número, prioridad si es alta, vehículo · WO · edad, **la alerta o el siguiente paso** con icono y tono (bloqueado, en pausa, fuera del taller · Job, sale pronto con Jobs pendientes, nadie en un Job), barra verde, avatares; Ready to Go tiene Return to Service dentro (diálogo). Pestaña **Dispatch** (`?tab=movement`): 3 columnas — Incoming Trucks y Upcoming Departures como filas (el camión, dónde lo tiene el taller: "En el taller · paso", Ready to Go o "No está en el taller", "N jobs pendientes" si sale pronto sin estar listo, y la fecha) y Dispatch status (chips por lugar; una llave marca WO abierta) — y un aviso cuando Dispatch dice Outside y el taller tiene una WO abierta. Si Dispatch no responde: "Dispatch no respondió" y Reintentar. |
| `/admin/trucks`, `/admin/trucks/[id]` | Lista de camiones con siguiente paso; **el Truck es el lugar de trabajo del Manager** y responde "¿puede salir y, si no, qué lo frena?" (ver abajo). |
| `/admin/work-orders`, `/admin/work-orders/[id]` | Lista con filtros; cada tarjeta y, en computadora, la columna **Siguiente** de la tabla dicen el mismo siguiente paso que el Truck, la lista de Trucks y el Yard (`nextStep` de la API; un camión Ready to Go dice "Return to Service", no "4 Jobs · all done"; DM1). Detalle del WO (ver abajo). |
| `/admin/work-orders/new` | Crear WO (solo Truck, prioridad, nota). |
| `/admin/history` | WOs completados y cancelados. |
| `/admin/mechanics`, `/admin/mechanics/[id]` | Roster. Manager y System Admin: Agregar persona (con contraseña temporal), nombre y tipo, Desactivar / Reactivar, Reiniciar contraseña (D22). El filtro "Show" (Active / Active and inactive / Removed) refleja la URL: Apply escribe `includeInactive=true` o `status=removed`, y un enlace con `?status=all` (o `all_in_shop`, `inactive`) también se lee como "Active and inactive" (DM2). |
| `/admin/catalog`, `/admin/catalog/categories/[id]` | Catálogo de Jobs. Manager y System Admin: Agregar Job a una categoría activa, Renombrar y Activar (D25); un nombre repetido en la categoría no se acepta. Las categorías son de solo lectura. |
| `/admin/setup/workflow` | Shop workflow: el **equipo** de cada paso (chips, "Add", qué pasa con un WO nuevo, nota de QC como respaldo del Manager; D28, D29). |
| `/admin/setup/workflow/hours` | **Shop hours**: hora del cierre del día y días hábiles, con su propio Save (D20, D-SET5). |

**Detalle del Truck** (`/admin/trucks/[id]`), de arriba abajo (LTR-174, Etapa 4;
igual a la maqueta desde la Etapa 8, 2026-10-06; en computadora la columna
principal y una lateral de 340 px, en el teléfono una sola en el mismo orden):
- **Migas de pan** arriba: "Yard Operations › 601" (o la pantalla de origen);
  en el teléfono, "‹ origen" para volver.
- **Encabezado:** "Truck 601", **un solo chip** de estado con punto ("Not
  Ready · PM" nombra el paso que lo frena; Ready to close en ámbar; Ready to
  Go; In Service; "Sin Work Order abierto"), el vehículo y la empresa, y el
  **chip del WO** con icono, número, estado en su color y prioridad si no es
  normal. A la derecha **+ Add work** y el menú **…** (hoja en el teléfono):
  abrir el WO, **Pause Work Order…** (solo con el WO In progress), **New Work
  Order** (diálogo) y **Copy link**. En solo lectura: "Solo lectura…" y sin
  botones.
- **Tarjeta de pasos:** píldoras de color (hecho verde, pendiente ámbar con
  número, bloqueado, taller externo azul, falta en rojo, no aplica, Close en
  espera neutro o listo) con flechas entre ellas; a la derecha "N jobs
  pendientes" y los avatares con "N mecánicos". Sin WO: "El Work Plan empieza
  con la inspección de llegada". Cada píldora lleva a su paso.
- **Siguiente paso:** un aviso con tono e icono por tipo (`NextStepCallout`);
  actúa en el Truck (D26). Inspección: "No issues found" y **"Issues found"**
  (principal); Assign abre el selector; el blocker se resuelve ahí con nota
  opcional; Close y Return to Service confirman en un diálogo (D27); "Mark QC
  complete" con borde; New Work Order es un diálogo. Después de "Issues
  found" sin WO, primero **Add work**. `external` lleva a la fila del Job en
  el WO. Sin permiso, el aviso dice por qué.
- **Work Plan:** una tarjeta ("Jobs on WO-004"); una fila por paso con su
  icono de color y resumen ("1 pendiente", "Issues found · Oct 4, 9:12 AM");
  Inspección y Close nunca se pliegan; los terminados empiezan plegados. Sus
  Jobs son de **solo lectura**: nombre, dueño con avatar (QC: Safety; taller
  externo: Part out / Truck out), estado con icono y **↗** (abre el WO en esa
  fila, resaltada). Solo un Job **sin dueño** tiene **Assign** con borde
  punteado. La inspección registrada tiene **Change** (enlace, menú con las
  dos opciones). Los errores salen bajo el encabezado con **Reload Truck**.
- **Add work:** panel de 460 px a la derecha (hoja de 92 vh en el teléfono):
  categorías como botones (la primera elegida), búsqueda, Jobs como chips
  (los que ya están en el plan, apagados con "· en el plan"), Job
  personalizado, "Por agregar (N)" con "¿Quién lo hace?" y un pie fijo con
  Cancel y "Add to Work Plan (N)". `#add-work` lo abre desde el WO. Se abre
  solo al registrar "Issues found" sin Jobs, salvo que el siguiente paso pida
  antes cerrar, Return to Service, un blocker o una pausa.
- **Contexto:** tarjeta **Truck** (vehículo, millaje en mi, VIN con copiar,
  empresa y dueño, estado operativo, ubicación con su fecha) y **Repair
  history** con el filtro por categoría en la cabecera y **Load more**.

**Detalle Admin del WO** (`/admin/work-orders/[id]`), de arriba abajo (LTR-174;
igual a la maqueta desde la Etapa 8, 2026-10-06; columna principal y una
lateral de 340 px en computadora, una columna en el teléfono):
- **Migas de pan:** "Work Orders › WO-010", o "Trucks › 601 › WO-010" si llegó
  desde el Truck (`#job-<id>` resalta esa fila); en el teléfono, "‹ padre".
- **Encabezado:** "Truck 918", estado y después prioridad ("Critical
  priority"); una línea con el WO en letra mono, vehículo, Opened y Updated;
  **Open Truck**, **Pause** / **Resume** (Pause abre un diálogo que pide el
  motivo, sin preselección) y el menú **…** "Work Order": **Correct time…**
  (abre History › Times), Reopen y Cancel Work Order, cada uno con su diálogo
  ("Back" y la confirmación). En solo lectura: "Solo lectura…".
- **Métricas:** progreso con barra (hechos, bloqueados, en taller externo),
  labor activa, espera, edad y avatares; en el teléfono una tarjeta compacta.
- **Siguiente paso** (`NextStepCallout`): primero el estado del WO
  (cancelado con su motivo, completado → **Return to Service** o devuelto, en
  pausa → Resume), después un blocker activo (el primero, "+N more"; se
  resuelve ahí con nota opcional de 2 filas) y luego el paso de la API
  (inspección, faltan pasos, asignar, taller externo con **Regresó**, QC,
  **Confirm completion** cuando está listo para cerrar, trabajo en curso).
  Los blockers resueltos se pliegan al pie del aviso. Una barra fija con
  Confirm completion aparece solo al pasar el aviso con el scroll.
- **Jobs** (tarjeta con su cuenta y "+ Add work in Work Plan"): columnas
  `Job · Mecánico · Estado · Acción` (200, 130 y 150 px; dos líneas en el
  teléfono); primero los abiertos, el bloqueado arriba y teñido, los de taller
  externo después y QC al final; un ayudante bajo su Job ("Ayuda a …"). El
  mecánico es un botón con avatar que abre el selector con búsqueda (sin
  dueño: "Asignar" punteado; QC: Safety; externo: Part out / Truck out y la
  nota). Estado con icono (Por hacer, Blocked, At external shop, Done hora,
  Cancelled). "Complete" discreto con icono, primario solo en QC; el PM cambia
  A ↔ B en un menú y se completa desde el servicio PM. El "…" de la fila
  (hoja en el teléfono): **Agregar ayudante** (D23), **Enviar a taller
  externo** (D24), Cancel / Reopen Job con su diálogo de motivo. Hechos y
  cancelados en un grupo **abierto** y apagado (con el motivo de
  cancelación). Sin permiso: una banda con candado dice por qué.
- **Notas:** hilo con avatar, nombre y hora; los pedidos de trabajo en su
  recuadro con "Mark handled"; el campo de una línea crece y tiene **Post**
  adentro.
- **Columna lateral:** **Truck** (Unit, Vehicle, millaje en mi, VIN con
  copiar, empresa · dueño, ubicación), **Priority** (botones segmentados;
  Update y Reset solo si cambió), **Labor by mechanic** y **Repair history**
  con el filtro en la cabecera.
- **History** siempre abierto, con las pestañas en su cabecera: **Activity**
  (línea de tiempo por día con icono y tono por evento, frases con los
  nombres en negrita, 7 eventos y "Ver los N"), **Times** (6 totales y un
  recuadro de tramos de trabajo y pausas, los más nuevos primero, con "Cierre
  del día" / "Cambio de camión" (D20, D21) y "Corregido"; cada tramo cerrado
  tiene **Corregir…**, un diálogo que valida ambos tiempos, fin > inicio y
  motivo) y **Pauses**.
- Los avisos de éxito son toasts (neutros, con icono, abajo a la derecha);
  un error queda entre el encabezado y el aviso con **Reload**.

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

**Loader de entrada** (pedido del dueño, 2026-10-06): antes de la pantalla de
inicio de sesión se ve el logo animado de Lightning (`public/lightning-loader.svg`)
sobre el azul de la marca (`#0f1a33`), a pantalla completa. Pasa el ciclo completo
(3,4 s, contado desde que carga el logo: rayo, letras, brillo y su desvanecido);
luego el fondo se desvanece y queda el formulario. Una vez por sesión del navegador (no
se repite al cerrar sesión), corto con "reducir movimiento", y nunca en las
pruebas automáticas; `?loader=1` lo fuerza y `?loader=0` lo salta
(`components/login-loader.tsx`, `lib/login-loader.ts`).

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

**Panel de demo (D36, solo local):** en un build con Dev Login y con el modo
encendido desde `/login` ("Enter demo mode"), el encabezado de los dos shells
muestra un botón **Demo** a la izquierda del perfil. Abre un panel flotante
(copia del panel de las maquetas) con las cuentas demo: tocar una cambia de
usuario sin cerrar sesión y carga su pantalla de inicio. En producción el
botón no existe (`lib/dev-login.ts`, `lib/demo/`, `components/demo-panel.tsx`).
Detalle en [`reference/DEMO.md`](reference/DEMO.md).

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
- **Samsara, McLeod, Dispatch:** no conectados. Presencia = `UNKNOWN`. Samsara (millaje de referencia, ubicación, fallas) y el alta de camiones propia están propuestos en [`proposals/samsara-trucks/`](proposals/samsara-trucks/README.md) (D35; las fallas se recomiendan como Jobs en Add work, D42), sin construir. **S-1 (2026-10-14):** Setup → Samsara lee los vehículos de Samsara con un token de solo lectura (`SAMSARA_API_TOKEN`, solo en el API) y muestra cuáles son nuestros camiones (por `samsara_id`, VIN o número); no escribe nada. `GET /api/admin/integrations/samsara/pairing`. **S-2 + S-3 (2026-10-14):** cada 15 min GitHub Actions llama a `POST /api/internal/samsara-sync` (secreto de cron) y la app guarda en cada camión emparejado las millas de Samsara (`samsara_odometer_*`, referencia; las oficiales siguen siendo las del PM), la ubicación (`samsara_address`, lat/lng, velocidad, hora) y las fallas en `truck_faults` (activa mientras `cleared_at` es nulo). Trucks muestra primero las luces del tablero del camión (STOP, advertencia/protección; J1939 las da por camión, no por código, S3-4), luego los códigos que encendieron check engine (`milStatus` 1), y la última ubicación; la ficha tiene la pestaña Faults (Manager y System Admin). Setup → Samsara tiene "Sync now" y el estado de la última corrida (`samsara_sync_state`).

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
- `npm run prisma:demo-local --workspace=@ltl-shop/api` — **demo local con
  toda la app en uso** (2026-10-09). Crea `ltl_shop_demo` en esta máquina,
  aplica las migraciones y el seed, y arma:
  - 23 Work Orders, uno por situación: los de las maquetas, más QC por
    Safety (por revisar, tomado, devuelto, aprobado), la cola del equipo y
    un reloj que quedó corriendo ayer. Algunos se crearon días atrás;
  - unos 4 meses de visitas cerradas, con horas reales, PM con millaje y
    QC de Safety;
  - Partes y costos: proveedores, precios, compras (una corregida y una
    anulada) y reparaciones externas;
  - tarifa de mano de obra ($95/h, luego $105/h este mes) y facturas
    internas a Finanzas (aceptadas, enviada, anulada y un borrador);
  - Custom Jobs en la bandeja de revisión (4 grupos por revisar y 2
    revisados).

  Volver a correrlo reinicia todo, incluido Partes y costos. Se niega a
  correr fuera de `localhost` o con una base cuyo nombre no diga "demo".
  Cuentas, guion por camión y lo que no se puede mostrar en local:
  [`reference/DEMO.md`](reference/DEMO.md).
- **Nunca** correr `db:seed` en producción: pisa los camiones 905/922/968.
- `SUPABASE_URL` (o `NEXT_PUBLIC_SUPABASE_URL`) + `SUPABASE_SERVICE_ROLE_KEY`
  (API, solo servidor): con las dos, la API crea y reinicia cuentas de
  Supabase Auth desde el roster (D22). Sin ellas, el roster funciona sin
  cuentas de acceso (`temporaryPassword: null`).
  Si una persona quedó sin cuenta (se creó sin esas variables), **Reset
  password** se la crea y muestra la contraseña temporal (G10, 2026-10-07).
- `CRON_SECRET` (API, solo servidor): secreto con el que Vercel Cron llama
  `GET /api/internal/day-close` (respaldo del cierre del día, D20). Vercel lo
  manda solo en el encabezado `Authorization: Bearer …`.
- `npm run start:demo` — levanta la demo local (`start-demo.sh`): la API
  en `:3141` contra `ltl_shop_demo` con `AUTH_DEV_BYPASS=true` y la web en
  `:3042` con Dev Login y el Panel de demo (D36). `DEMO_API_PORT`,
  `DEMO_WEB_PORT` y `DEMO_DATABASE_URL` cambian los valores por defecto.
- `GET /api/dev/demo/users` (D36): la lista de cuentas que el Panel de demo
  puede usar (activas, no quitadas). Solo existe con `AUTH_DEV_BYPASS=true`;
  si no, 404 (`src/dev-demo/`).
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
