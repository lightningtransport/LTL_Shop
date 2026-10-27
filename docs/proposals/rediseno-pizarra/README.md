# Propuesta: la app como la pizarra del taller (rediseño de arquitectura de información)

**Estado (2026-10-27): dirección aprobada (D58).** El proyecto original queda en pausa y se sigue con esta versión. Las reglas se cierran con la COO, el Shop Manager y el manager de partes ([`preguntas-pendientes.md`](preguntas-pendientes.md)); hasta entonces no se construye nada. Punto de retorno: la rama `pausa-original-2026-10-27` (`main` en `0059c4b`).
**Antes (2026-10-24): propuesta, sin construir, sin decidir.** Solo documentación y un boceto
(`mockup.html`). No cambia código de la app ni el comportamiento en producción. Lo que está aquí
pasa a `DECISIONS.md` (D58) y a `USER_FLOWS.md` solo cuando el dueño lo apruebe.
**Rama:** `claude/rediseno-pizarra` (worktree propio; `main` no se toca).
**Origen:** la presentación del 2026-10-23 ("no funciona como lo declaré"), el prompt de auditoría
del PM y la conversación con el dueño del 2026-10-24. Base del código leída: `origin/main` `0e2f46a`.
**Pruebas de hoy:** `test:real` sobre `main`, 209 pasan y 2 se saltan a propósito (A27, A28).
Este rediseño parte de un motor que funciona.
**Task flows:** [Manager](task-flow-manager.md), [mecánicos](task-flow-mecanico.md) (general, Detailing en tablet, PM) y [Safety / QC](task-flow-safety.md), un día completo cada uno.
**Inventario (nada se pierde ni se rompe):** [`ia-inventario.md`](ia-inventario.md).
**Revisión de las sugerencias (qué está comprobado y qué es supuesto):** [`revision-sugerencias.md`](revision-sugerencias.md).
**Preguntas de esta semana (COO, Shop Manager, manager de partes):** [`preguntas-pendientes.md`](preguntas-pendientes.md). La primera hoja, [`preguntas-validacion.md`](preguntas-validacion.md), queda como historial.
**Boceto:** [`mockup.html`](mockup.html) (publicado en privado: https://claude.ai/artifact/RoLTBY4LTXWRy6r2moCLsE). Un archivo, sin código de la app, con datos de ejemplo
(901, 705, 804, 918, 944).

---

## 0. Qué es y qué no es

- **Es** un cambio de **arquitectura de información y contenido**: qué ve cada persona al entrar,
  cómo se agrupa, cómo se llaman las cosas, cuántos toques hay hasta terminar.
- **No es** reconstruir. Las reglas del API, el esquema, las colas, el reloj, Safety, las
  inspecciones, los costos y las 209 pruebas de flujo se quedan. Lo que se esconde **no se borra**:
  sigue en su ruta y en el menú **More** (§3.4).
- **Simplifica** quitando pantallas del camino. Junta lo que hoy está repartido en Dashboard, Yard,
  Truck y Work Order, y lo que el mecánico ve en 5 secciones y 2 colas.

---

## 1. Síntesis de investigación

**Método:** síntesis de fuentes ya existentes, sin entrevistas nuevas.
**Fuentes:**

| # | Fuente | Qué aporta |
|---|---|---|
| F1 | Prompt del PM (2026-10-24) | Cómo trabaja hoy el taller: Ninox, libreta, pizarra física, llaves, Safety |
| F2 | Conversación con el dueño (2026-10-24) | "Hay que cambiar la arquitectura de la información, mostrar el tablero como ellos lo usan, simplificar" |
| F3 | Cuestionario de operación, Cristian (2026-09-29), en `DECISIONS.md` | Reglas del taller ya decididas |
| F4 | D57 y su propuesta [`areas-en-paralelo/`](../areas-en-paralelo/README.md) | El dueño y el Shop Manager trabajando el 911 en iPad |
| F5 | Auditorías [`ux-audit/RESUMEN-roles-de-campo.md`](../../ux-audit/RESUMEN-roles-de-campo.md), [`admin-ia-2026-10/`](../../ux-audit/admin-ia-2026-10/09-informe-final.md), [`admin-yard-dispatch-2026-10/`](../../ux-audit/admin-yard-dispatch-2026-10/00-contexto.md) | 78 hallazgos de campo (Safety, General, PM); el menú del Manager con 21 entradas |
| F6 | Código en `origin/main` | Lo que la app hace de verdad (citado con archivo) |

**Límites:**
- No hay observación nueva en el taller ni voz directa de los mecánicos. F1 viene del PM y F2 del dueño.
- Las frases de abajo son de esas fuentes, no de entrevistas a mecánicos.
- **Primero hay que validar el boceto con el Shop Manager y dos mecánicos (§7).**

### Resumen

El taller organiza el día **por trabajo y por especialidad**: una pizarra con columnas, donde cada
número de camión aparece en todas las columnas en las que tiene algo. La app lo organiza **por
camión y por Work Order**: cada camión aparece una sola vez, en "la fase" en la que está.

Eso obliga al Manager a abrir camión por camión para saber qué hay que hacer, y al mecánico a
navegar 5 secciones para encontrar qué tomar. El motor ya sabe responder lo que el taller pregunta
(qué está libre, quién tiene qué, qué está bloqueado). Lo que falla es **cómo se muestra**, igual que
pasó con Parts & costs en la auditoría de octubre (F5: "el modelo de datos está bien, el problema
está en las pantallas y los nombres").

### Temas

#### T1 · El taller piensa en trabajos, la app en camiones
**Fuentes:** F1, F2, F4, F6.
- "El manager escribe los números de los camiones en diferentes columnas según los trabajos
  requeridos. Un mismo camión puede aparecer simultáneamente en varias columnas." (F1)
- "Mostrar el tablero como ellos lo usan." (F2)
- **Hoy:** el Kanban del Yard tiene una tarjeta por camión, en una sola columna
  (`yard-operations.service.ts:788`, un `phase` por camión). No existe ninguna vista con una
  tarjeta por Job.

**Implicación:** la pantalla principal del Manager tiene que ser la pizarra: columnas por
especialidad y una tarjeta por trabajo.

#### T2 · El mecánico elige; no le asignan
**Fuentes:** F1, F4, F6.
- "Los mecánicos consultan la pizarra, seleccionan libremente un trabajo de su especialidad." (F1)
- D57 §6: "los mecánicos generales toman solos los defectos". (F4)
- **Hoy:** el modelo de base es "cada Job tiene un dueño" (D11). La cola existe (D28, D57 §5), pero
  solo recibe Jobs en dos casos: equipos de dos o más personas, y defectos de la inspección. Un Job
  agregado con Add work sin mecánico queda "Unassigned" (P44).
- **Hoy:** el inicio del mecánico tiene "To inspect", "Team queue", "Available in the shop",
  "In Progress", "Ready to start", "Blocked", "Waiting on manager" y "Paused"
  (`apps/web/src/app/page.tsx:183`, `mechanic-home.tsx:89-129`).
- **Hoy:** son 4 toques de la cola a terminado: Take → Start → Complete → confirmar.

**Implicación:** por defecto, todo trabajo sin dueño está **disponible** para su especialidad. El
mecánico ve dos listas, "Disponibles para mí" y "Mis trabajos", y tomar un trabajo es empezarlo.

#### T3 · No todos los camiones recorren lo mismo
**Fuentes:** F1, F6.
- "Truck 705: Fuel Filter Replacement — Completed. QC — Not Required." (F1)
- "No permitir que un trabajo obligatorio desaparezca simplemente porque alguien decidió omitirlo." (F1)
- **Hoy:** toda WO nace con PM, Alignment, Detailing y QC (`mandatory-jobs.ts:93`). Un paso solo
  "no aplica" si se cancela a mano con motivo, y el QC no se puede cancelar
  (`QC_NOT_CANCELLABLE`, D55 R9).

**Implicación:** al abrir la visita se elige qué aplica, con una plantilla por tipo de visita. Lo
que no aplica queda **visible** como "Not required · motivo · quién".

#### T4 · Las llegadas se anticipan con datos que ya tenemos
**Fuentes:** F1, F6 y el diccionario de datos de Lightning.
- "Ninox contiene información que permite anticipar estas llegadas." (F1)
- **Hoy:** la pestaña Dispatch ya lista Incoming desde `driver_pay`, y Samsara ya avisa
  "Arrived · Needs a Work Order". Pero:
  - la copia de Ninox en Supabase está atrasada: no actualiza las filas que cambian, y por eso
    Incoming no coincide con Ninox (comparado el 26-oct, `docs/reference/NINOX_COPIA_SUPABASE.md`).
    El cálculo del Shop está bien; leer solo `driver_pay` es a propósito (LTR-254);
  - la llegada vive en una pestaña de un menú que el Manager no abre para trabajar.

**Implicación:** una pantalla **Llegadas** de primer nivel (Expected → Arrived → visita abierta),
que propone el tipo de visita.

#### T5 · El Manager no quiere ser el que registra
**Fuentes:** F1, F3.
- "La implementación no debe generar más trabajo administrativo del que elimina." (F1)
- "El manager debe revisar la pizarra y actualizar manualmente la información en Ninox." (F1)

**Implicación:** cada acción la registra quien la hace. El Manager solo ve **excepciones**:
bloqueado, sin datos, listo para liberar, llegada sin visita.

#### T6 · Demasiado menú, todo al mismo nivel
**Fuentes:** F5, F6.
- 15 entradas en el menú del Manager (`admin-shell.tsx:20-53`).
- El día a día (pizarra, llegadas, camión) pesa lo mismo que facturas internas, Samsara o tarifas.
- El Dashboard "Needs you" y el Yard responden preguntas parecidas desde dos pantallas.

**Implicación:** tres entradas de trabajo diario, y lo demás bajo **More**.

#### T7 · Las llaves son de la pizarra, no del sistema
**Fuentes:** F1.
- "Los mecánicos pueden perder tiempo buscando llaves." (F1)
- **Hoy:** no existe nada sobre llaves.

**Implicación:** un dato chico pegado al camión, que se pregunta en el momento natural (al tomar y
al terminar). No es un inventario.

### Insights → oportunidades

| Insight | Oportunidad | Impacto | Esfuerzo |
|---|---|---|---|
| T1: la unidad de trabajo es el Job, no el camión | Pizarra con una tarjeta por Job | Alto | Medio (pantalla nueva sobre datos que ya hay) |
| T2: tomar ≠ que te asignen | Todo sin dueño es "Disponible"; Take = empezar | Alto | Bajo |
| T3: lo que aplica depende de la visita | Plantillas por tipo; "Not required" visible | Alto | Bajo-medio |
| T4: las llegadas se pueden anticipar | Pantalla Llegadas con tipo propuesto | Medio | Bajo-medio |
| T5: el Manager gestiona excepciones | Franja "Necesita tu decisión" en la pizarra | Medio | Bajo (reusa el Dashboard) |
| T6: menú plano | 3 entradas + More | Medio | Bajo |
| T7: llaves perdidas | Estado de llaves en el camión | Medio | Medio (migración) |

### Personas

| Persona | Cuántos | Qué necesita | Dónde trabaja |
|---|---|---|---|
| Shop Manager | 1 | Planear, priorizar, destrabar, liberar | Computadora y teléfono en la yard |
| Mecánico general | 3–4 | Ver qué está libre de lo suyo, tomarlo, avisar si se traba, terminar | Teléfono propio; tablet compartida |
| Mecánico de especialidad (PM, Alignment, Detailing) | 2–3 | Lo mismo, filtrado a su especialidad | Teléfono; tablet |
| Safety | 2 | Ver qué camión está listo para QC, aprobar o devolver | Teléfono / iPad |
| Gerencia (Carlos) | 1 | Saber cómo va el taller sin preguntar | Computadora |
| Dispatcher | varios | Avisar que un camión pasa (P2) | Fuera del Shop hoy |

### Preguntas para validar (con el Shop Manager y dos mecánicos)

1. ¿Las columnas de la pizarra son PM · Repairs · Alignment · Detailing? ¿Inspection y QC van como columnas o aparte?
2. ¿El asterisco es "prioridad alta"? ¿Hay más de un nivel?
3. ¿Tomar un trabajo significa que ya empezaste? ¿O lo tomas y vas por las llaves?
4. ¿Un camión que tiene otro mecánico se ve en la pizarra ("con Juan") o desaparece?
5. ¿Lo tachado (terminado) se queda visible todo el día?
6. ¿El mecánico puede ver la pizarra completa, o solo su especialidad?

---

## 2. Principios del rediseño

1. **Una tarjeta = un trabajo.** El camión se repite en cada columna donde tiene algo; la entidad no se duplica.
2. **Disponible por defecto.** Un trabajo sin dueño está libre para su especialidad. Asignar es la excepción.
3. **Un toque para lo frecuente.** Take, Complete y Blocked están en la tarjeta, sin entrar a otra pantalla.
4. **Lo que no aplica se ve.** "Not required" con quién y por qué; nunca desaparece.
5. **El Manager ve excepciones, no registros.**
6. **Nada se pierde.** Lo que sale del camino diario se mueve a More, con su misma ruta.
7. **Mismos estados en todas partes:** Available · Taken · In progress · Blocked · Done · Not required.

---

## 3. Arquitectura de información

### 3.1 Manager: de 15 entradas a 3 de trabajo + More

El detalle de **cada** pantalla, grupo del Dashboard y acción, con lo que se rompería si no se
ajusta, está en [`ia-inventario.md`](ia-inventario.md).

| Hoy (menú) | Propuesta | Qué pasa con lo de hoy |
|---|---|---|
| Dashboard (`/admin`) | **Board** (`/admin`): la pizarra, y arriba "Needs your decision" | La cola "Needs you" pasa a esa franja; nada se pierde |
| Yard Operations → Shop | Board, botón **By truck** | El Kanban por camión queda como segunda vista |
| Yard Operations → Dispatch | **Arrivals** (entrada propia) | Misma fuente, mejor ordenada (§3.3) |
| Trucks | **Trucks** | La ficha cambia (§3.5) |
| Work Orders | Dentro del camión ("Visit") y en More → Visits history | La lista sigue en su ruta |
| Parts & costs (5), Setup (7), QC | **More** (plegado) | Mismas pantallas, mismas rutas |

### 3.2 Board (la pizarra)

- **Columnas:** PM · Repairs · Alignment · Detailing. Inspection y QC van como columnas angostas a
  los lados (pregunta 1). "Repairs" es una propuesta para "Shop Work" (P40, sin validar).
- **Tarjeta:**
  - número del camión (grande) y ★ si la prioridad es High o Critical;
  - el trabajo;
  - el estado con color e icono;
  - quién lo tiene;
  - "With Juan" si otro mecánico tiene el camión (D57 §3);
  - "Leaves Tue" si Dispatch dice que sale pronto.
- **Orden dentro de la columna:** Blocked arriba, luego ★, luego lo más viejo. Lo terminado hoy va
  tachado al pie, plegado.
- **Buscar "901"** resalta todas las tarjetas del 901 en todas las columnas.
- **Arriba:** "Needs your decision" con contadores (Blocked · Ready to release · Arrived without a
  visit · Not taken > 1 day). Cada uno filtra la pizarra.
- **TV:** el mismo modo Full screen de D53.

### 3.3 Arrivals (llegadas)

Tres grupos: **Expected** (fin de contrato, de `driver_pay` + `returns`) · **Arrived** (Samsara;
con el tipo propuesto: End of Contract si estaba en Expected, Passing Through si no) · **Cancelled /
didn't come**. Cada llegada tiene **Open visit**, que abre la hoja de la visita (§3.6).

### 3.4 More

Parts & costs, Purchases, Outside repairs, Internal invoices, Vendors, Jobs catalog, People, Shop
workflow, Shop rates, Inspection checklist, Samsara, Visits history, Quality Check (respaldo).
Plegado por defecto. Las rutas no cambian.

### 3.5 Camión: "¿puede salir?"

1. **Release checklist:** una fila por requisito, con su estado: **Done · Pending · Blocked · Not
   required (motivo, quién) · Required**. El QC es una fila más, con estado propio (§4).
2. **Trabajos de la visita**, agrupados como en la pizarra.
3. **Llaves** (P1): Office · With Juan · In truck · Unknown.
4. Botón principal: **Release truck** cuando todo está en verde. **Sin decidir (P56):** hoy Close y Return to Service son dos pasos a propósito (D1, D52: el camión puede estar listo y seguir en la yard). La opción segura es que Release haga solo Close y Return to Service siga como hoy.

Lo demás (Costs, Faults, Tires, historial) sigue en sus pestañas.

### 3.6 Abrir una visita (reemplaza New Work Order)

Camión → **tipo de visita** (propuesto por Arrivals) → la plantilla marca los trabajos → el Manager
quita o agrega → lo que quita pide motivo ("Not required · Passing through") → ★ prioridad →
**Open visit**. Los trabajos nacen **Available** en su columna.

### 3.7 Mecánico: una pantalla

- **Arriba, "My work":** lo que tengo, con **Complete** y **Blocked** en la tarjeta.
- **Abajo, "Available for me":** lo libre de mi especialidad (los equipos de Setup), ★ primero, con
  **Take job**. Tomar = empezar: el tiempo corre desde ahí (pregunta 3).
- Al completar: "¿Dónde quedan las llaves?" (P1).
- Completed, Trucks e Inspect siguen en las pestañas de abajo (D-MG1).

### 3.8 Safety y Gerencia

- **Safety:** no cambia su pantalla (`/qc`, ya rediseñada y probada, QC1–QC13). Cambia **cuándo**
  le llega un camión: solo si el QC se requiere.
- **Gerencia (Carlos):** **Shop today**, de solo lectura, con 7 números: trucks in shop, jobs in
  progress, available, blocked, done today, mechanics working, ready to release. Cada número dice
  qué cuenta. Sin tiempos ni productividad en esta versión.

---

## 4. Contenido y nombres

| Concepto | Hoy en pantalla | Propuesta | Por qué |
|---|---|---|---|
| La intervención del camión | Work Order (WO-026) | **Work Order** (se queda) + campo nuevo **Visit type** | Corregido el 2026-10-26: no hay evidencia de que el taller diga "visita"; "Work Order" es el término estándar y el prompt pide mantenerlo (P45) |
| Área de reparaciones | Shop Work | **¿Repairs?** (validar) | P40 sigue abierta; sin evidencia de cómo le dice el taller. Se valida con el Shop Manager |
| Job sin dueño | Unassigned / Team queue / Available in the shop | **Available** | Una palabra para lo mismo |
| Job con dueño sin empezar | Pending / Ready to start | **Taken · Juan** | Distingue de Available |
| Job empezado | In progress | **In progress · Juan** | Igual |
| Job bloqueado | Blocked · motivo | **Blocked · Waiting for parts** | Igual |
| Paso que no aplica | (Cancelled, con motivo) | **Not required · motivo · quién** | No es una cancelación, es una decisión |
| Estado del QC | — (siempre requerido) | **QC: Not required · To decide · Required · In review · Passed · Failed** | Separar QC de los trabajos (prompt §8.1 E) |
| Estado del camión | Not Ready · PM / Ready to close / Ready to Go | **Not ready · 3 left / Ready to release / Released** | Una pregunta: ¿puede salir? |
| Tipo de visita | — | **End of contract · Passing through · Other** | Nuevo |

En español: Visita, Reparaciones, Disponible, Tomado, En curso, Bloqueado, Hecho, No requerido,
Listo para liberar. Los textos finales pasan por la skill de UX copy y por el glosario antes de construir.

---

## 5. Historias de usuario

Cada historia dice qué se **reutiliza**, qué se **ajusta** y qué es **nuevo**, con el archivo que lo
respalda. Las horas son dev + prueba (probable). "API" quiere decir que cambia una regla y lleva su
fila en `test:real`.

### Manager

**HU-RD1 · Ver el taller como la pizarra** (P0 · 8 h)
> Como Shop Manager quiero ver todos los trabajos abiertos en columnas por especialidad, con el
> mismo camión en cada columna donde tiene algo, para saber de un vistazo qué falta y quién lo hace.
- **Acepto si:**
  - cada Job abierto de cada visita abierta es una tarjeta en la columna de su área;
  - un camión con 3 trabajos aparece 3 veces;
  - la tarjeta dice camión, trabajo, ★, estado (Available · Taken · In progress · Blocked) y quién;
  - Blocked va arriba con su motivo;
  - lo terminado hoy va tachado y plegado al pie;
  - buscar "901" resalta sus tarjetas;
  - se refresca solo cada 30 s;
  - entra en una TV sin scroll (D53).
- **Reutiliza:** `deriveWorkPlan`, `jobArea` / `workAreaOf` (`packages/shared/src/work-areas.ts`),
  `holdingJobs` (D57), `jobWorkStatus`, el layout de `kanban.tsx`.
- **Nuevo:** `GET /api/admin/board` (solo lectura) y la pantalla.

**HU-RD2 · Abrir una visita con lo que el camión necesita** (P0 · 6 h · API)
> Como Shop Manager quiero elegir el tipo de visita y que la app me proponga los trabajos, para no
> crear ni cancelar a mano lo que ese camión no necesita.
- **Acepto si:**
  - End of contract marca PM, Alignment, Detailing, QC = Required;
  - Passing through no marca pasos fijos y deja QC = To decide;
  - lo que desmarco pide motivo y queda "Not required · motivo · yo · hora", visible en el camión y
    en el Activity Log;
  - no aparece "Add missing steps";
  - el 705 se puede liberar con solo su Fuel Filter.
- **Reutiliza:** la creación de WO (`work-orders.service.ts:202`), "cancelado = no aplica"
  (`yard-work-plan-derivation.ts`, `mandatoryPhase`), Add work, el Activity Log.
- **Ajusta:** el `createWorkOrderSchema` acepta los pasos que no aplican con su motivo.
- **Nuevo:** las plantillas, en código (P1: editarlas en Setup).

**HU-RD3 · Decidir si el QC aplica** (P0 · 4 h · API · cambia D55 R9)
> Como Shop Manager quiero marcar el QC como Not required con motivo, para que un camión de paso no
> espere a Safety sin necesidad.
- **Acepto si:**
  - QC = To decide hasta que el Manager elige;
  - Not required pide motivo y deja quién y cuándo;
  - Required lo manda a Safety cuando lo demás está hecho (como hoy);
  - un camión con QC To decide **no** se libera;
  - un mecánico nunca puede tocarlo.
- **Reutiliza:** toda la cola de Safety (`quality-check.service.ts`), `QC_NOT_READY`.
- **Ajusta:** `QC_NOT_CANCELLABLE` (`admin.service.ts:1710`) deja pasar "Not required" del Manager;
  la fila de `journey-rules.real.spec.ts:49` cambia con la regla.

**HU-RD4 · Saber si el camión puede salir** (P0 · 5 h)
> Como Shop Manager quiero ver en el camión qué requisito falta y liberarlo con un toque cuando
> todo está, para no revisar trabajo por trabajo.
- **Acepto si:**
  - la checklist muestra cada requisito con Done · Pending · Blocked · Not required · Required;
  - Release truck solo se habilita en verde;
  - pide confirmar y hace Close + Return to Service.
- **Reutiliza:** el Work Plan, `truck-next-step.ts`, las reglas D55 de cierre, Return to Service.
- **Nuevo:** la presentación y el botón combinado (dos llamadas que ya existen).

**HU-RD5 · Llegadas anticipadas** (P1 · 5 h)
> Como Shop Manager quiero ver los camiones que vuelven por fin de contrato esta semana y los que
> llegaron sin estar previstos, para planear la pizarra antes de que lleguen.
- **Acepto si:**
  - Expected sale de `driver_pay` **y** `returns`, sin descartar Fired ni Early Broke Contract;
  - Arrived marca End of contract si estaba previsto y Passing through si no;
  - "Open visit" lleva el tipo ya elegido.
- **Reutiliza:** `yard-data-boundary.service.ts`, la presencia de Samsara (D49), Create WO.
- **Ajusta:** el mapper (`yard-data-boundary.ts:147`) y suma la fuente `returns`.

**HU-RD6 · Priorizar y destrabar desde la tarjeta** (P1 · 2 h)
> Como Shop Manager quiero poner ★ y resolver un bloqueo desde la tarjeta de la pizarra.
- **Reutiliza:** la prioridad de la WO y `resolve` del bloqueo.
- **Nuevo:** el menú de la tarjeta.

### Mecánico

**HU-RD7 · Ver lo mío y lo disponible en una pantalla** (P0 · 5 h)
> Como mecánico quiero ver arriba lo que tengo y abajo lo que está libre de mi especialidad, para
> elegir sin buscar.
- **Acepto si:**
  - "My work" con mis trabajos (In progress primero, Blocked en ámbar);
  - "Available for me" con lo libre de mis equipos y de Repairs si soy general, ★ primero;
  - un camión que tiene otro mecánico dice "With Juan" y no se puede tomar.
- **Reutiliza:** `GET /api/team-queue`, `myJobsOf`, `truckBusyFor`.
- **Ajusta:** el inicio (`apps/web/src/app/page.tsx`, `mechanic-home.tsx`) junta 8 secciones en 2.

**HU-RD8 · Tomar = empezar** (P0 · 3 h · API · pregunta 3)
> Como mecánico quiero que tocar Take job me lo dé y empiece mi tiempo, para no hacer dos pasos.
- **Acepto si:**
  - un toque toma y abre la sesión;
  - si otro lo tomó un segundo antes dice "Juan just took it" y la lista se refresca;
  - Release lo devuelve a Available.
- **Reutiliza:** `take` (`team-queue.service.ts:104`, seguro ante dos toques a la vez) y Start
  (`TRUCK_BUSY`, D21).
- **Nuevo:** las dos cosas en una sola transacción.

**HU-RD9 · Todo trabajo sin dueño está disponible** (P0 · 3 h · API · decide P44)
> Como Shop Manager quiero que lo que agrego sin elegir mecánico quede disponible para su
> especialidad, para no asignar uno por uno.
- **Reutiliza:** `workflow_step_key` y `SHOP_WORK_QUEUE_KEY` (D28, D57 §5).
- **Ajusta:** Add work y la creación de la visita mandan a la cola por defecto. "Assign to…" queda
  como opción.

**HU-RD10 · Bloquear con un toque** (P1 · 1 h)
> Como mecánico quiero elegir el motivo entre opciones grandes (Parts · Approval · Truck · Other) y
> volver a mi lista.
- **Reutiliza:** `blockers.ts` y `MECHANIC_BLOCKER_REASONS`.
- **Ojo:** "Waiting for truck" no existe a propósito (D17). Propuesta: usar Other con nota hasta
  decidirlo; agregarlo es una migración de enum.

**HU-RD11 · Dónde quedan las llaves** (P1 · 7 h · migración)
> Como mecánico, al tomar y al terminar, quiero decir dónde quedan las llaves con un toque (Office ·
> With me · In truck · Gave to…), para que el próximo no las busque.
- **Nuevo:** `truck_key_events`, solo se agrega (quién, estado, hora). En el camión se muestra lo
  último. Transferencia con confirmación: P2.

### Safety

**HU-RD12 · Solo los camiones que necesitan QC** (P0, incluido en HU-RD3)
> Como Safety quiero ver solo los camiones cuyo QC se requiere, para no revisar los de paso.
- **Reutiliza:** la pantalla `/qc` completa (D19, D46), los hallazgos y el Job correctivo (QC1–QC13).
- **Ajusta:** un QC "Not required" no entra a la cola.

### Gerencia

**HU-RD13 · Cómo va el taller hoy** (P1 · 4 h)
> Como gerente quiero 7 números que se puedan creer (en el taller, en curso, disponibles,
> bloqueados, hechos hoy, mecánicos trabajando, listos para liberar), para no preguntar.
- **Reutiliza:** `GET /api/admin/dashboard` (`admin.service.ts:374`), sesiones abiertas, la cola.
- **Ojo:** LTR-241 (el Dashboard ya hace 113 consultas): hay que sumar como mucho 1 o 2.
- **Rol:** Admin de solo lectura (ya existe).

### Dispatcher (P2)

**HU-RD14 · Avisar que un camión pasa** (P2)
> Como dispatcher quiero avisar que un camión entra por un trabajo puntual, para que el taller lo
> espere.
- Necesita un rol nuevo o un formulario sin sesión. Después del lunes.

---

## 6. Plan por partes

**Linear:** proyecto "Pizarra (versión simple)". Reglas: LTR-307 (COO), LTR-308 (Shop Manager), LTR-309 (partes), LTR-310 (Ninox). Reglas nuevas de la COO: LTR-319 (notas), LTR-320 (daños cosméticos), LTR-321 (Body Shop), LTR-322 (inspección con menos de 20).

Cada parte se puede mostrar sola y va en su PR, sin romper lo de hoy. Las horas son probables;
entre paréntesis, optimista y pesimista.

| Parte | Historias | Horas | Migración | Cuándo |
|---|---|---|---|---|
| **RP-0** (LTR-308) Validar el boceto con el Shop Manager y 2 mecánicos; ajustar | — | 1–2 | No | Sábado tarde |
| **RP-1** (LTR-311) Visita con lo que aplica + QC To decide / Not required + correctivo que nace de la devolución de Safety + Coming en `/qc` | HU-RD2, RD3, RD12 | 15 (11–22) | Probable (pequeña, aditiva → Release safety) | Sábado noche |
| **RP-2** (LTR-312) Todo disponible + Take = empezar + pantalla del mecánico + Detailing en tablet como equipo + PM sin visita (§9) | HU-RD7, RD8, RD9 | 20 (16–28) | Probable si P50 = nombre con un toque | Domingo mañana |
| **RP-3** (LTR-313) Board como inicio del Manager + "Needs your decision" + menú More | HU-RD1, (RD6) | 10 (8–16) | No | Domingo tarde |
| **RP-4** (LTR-314) Camión: checklist de liberación + Release truck | HU-RD4 | 5 (4–8) | No | Lunes si sobra; si no, después |
| **RP-5** (LTR-315) Arrivals de primer nivel y tipo propuesto (sin `returns`: el Shop ya calcula bien, LTR-254; depende de la copia de Ninox, LTR-310) | HU-RD5 | 5 (4–8) | No | Semana del 26 |
| **RP-6** (LTR-316) Shop today (Gerencia) | HU-RD13 | 4 (3–6) | No | Semana del 26 |
| **RP-7** (LTR-317) Llaves | HU-RD11 | 7 (5–11) | **Sí** | Semana del 26 |
| **RP-8** (LTR-318) Textos finales ES/EN, glosario, docs de lo construido | — | 3 | No | En cada PR |

**Para el lunes:** RP-0 a RP-3 son ~46 h probables (32 h, más 8–11 h de §9 y 5–7 h de Safety). Eso no entra completo en un fin de semana con
revisión del dueño. Recomiendo:
- **seguro:** RP-0, RP-1 y RP-2; los tres ejemplos (901, 705, 804) funcionando de punta a punta y la
  pantalla nueva del mecánico;
- **la pizarra (RP-3):** si llega el domingo antes de las 6 p.m., va; si no, se muestra el boceto
  validado y entra el martes.

---

## 7. Decisiones que necesita el dueño

| # | Pregunta | Recomendación |
|---|---|---|
| P45 | ¿"Visit" en pantalla en lugar de "Work Order"? | Sí; Work Order se queda en el historial y en el código |
| P46 | ¿El QC Not required lo decide solo el Manager? (cambia D55 R9) | Sí, con motivo obligatorio |
| P47 | ¿Take job empieza el tiempo? | Sí; un toque menos (pregunta 3 al Shop Manager) |
| P48 | ¿La pizarra muestra el camión ocupado ("With Juan") o lo esconde? | Mostrarlo, sin poder tomarlo (no contradice D57 §3: nadie más trabaja ese camión) |
| P44 | ¿Un trabajo sin mecánico va a la cola? | Sí, a la de su especialidad |
| P40 | ¿"Shop Work" se llama "Repairs"? | Validar con el Shop Manager (no hay evidencia) |
| P49 | ¿Las columnas son PM · Repairs · Alignment · Detailing, con Inspection y QC a los lados? | Validar con el Shop Manager |

---

## 9. Validación: mecánicos (dueño, 2026-10-26)

Lo que dijo el dueño (nota [`2026-10-26-mecanicos-tablet-detailing`](../../notas/2026-10-26-mecanicos-tablet-detailing.md)),
contrastado con el rediseño y con el código de hoy.

| Lo que dijo | ¿Encaja con el rediseño? | Qué choca con el código de hoy | Cambio | Horas |
|---|---|---|---|---|
| **Los detailers usan una tablet** | Sí. Las pantallas de mecánico ya usan el ancho del iPad (D54, LTR-271). La tablet muestra la columna Detailing: Available arriba, In progress abajo | Una tablet compartida necesita una sesión que no expire a mitad del día y que no pida cambiar la contraseña a cada rato (D22) | Cuenta de tablet de Detailing; PWA instalada (ya existe) | 1–2 |
| **No importa quién inicie** | Sí. El trabajo es del **equipo** Detailing, no de una persona. Ya existe la cola del equipo (D28) | **1.** Hoy solo el dueño del Job lo completa o lo bloquea (`work-orders.service.ts:1303`, `:613`). **2.** Un reloj por persona (D21): con una sola cuenta, empezar un segundo camión cierra el primero (P51). **3.** Saber quién lo hizo y sus horas (D18, D34) se pierde con una cuenta compartida (P50) | "Trabajo de equipo" solo para Detailing: cualquiera del equipo empieza, bloquea y completa. Con P50 = nombre con un toque, cada uno conserva sus horas | 5–7 |
| **Dos detailers en el mismo camión** | Sí, sin el "ayudante" (D23): el trabajo es del equipo | Un camión a la vez (D57 §3) no frena a otro del mismo equipo en el mismo Job | Tratar al equipo como un solo dueño en `truckBusyFor` | incluido |
| **El PM sigue igual** | Sí. Su pantalla no cambia (Waiting for PM → Start PM → millaje → partes → Finish). Start PM ya toma y empieza en un toque, el mismo modelo que "Take job" (P47). La columna PM de la pizarra lee esos Jobs | "Create PM service" en un camión sin visita hoy crea la WO con los 4 pasos obligatorios (`work-orders.service.ts`, `createOrJoinPm`). Con plantillas, nacería un camión con Alignment y Detailing que nadie pidió (P53) | Ese caso abre una visita "Other" solo con el PM y QC "To decide" | 2 |
| **El PM y las llaves** | Al terminar el PM no se pregunta por las llaves, para que su pantalla quede igual | — | Ninguno. Si se quiere, se agrega después como una pregunta opcional en Finish | 0 |

**Conclusión:** encaja. Hay que cambiar dos reglas para Detailing (dueño del Job y reloj por
persona) y una para el PM (qué nace sin visita). Todo es API y pantalla, sin migración si P50 es
"nombre con un toque" usando las personas que ya existen. Suma **8–11 h** a RP-2.

**En el boceto:** "My work" con Daniel dice que el PM conserva su pantalla; "Detailing" es la tablet
compartida y la pizarra dice "With Detailing" en el 918.

**Pendiente:** el task flow de un día de mecánico (general, Detailing en tablet y PM), igual al del
Manager.

## 8. Lo que no se toca

- El esquema y las 56 migraciones; las reglas de una visita abierta por camión, un reloj por
  mecánico, cierre de las 5 p.m., un camión a la vez.
- Safety (`/qc`), la inspección (D41), Parts & costs, costos, facturas, Samsara.
- Las rutas de hoy: lo que se mueve a More se abre en la misma URL.
- Las 209 pruebas de flujo: cambian solo las filas de las reglas que el dueño cambie (P46), y se
  agregan las nuevas.

---

## 10. Trabajo en paralelo (para otros agentes)

**Estado al 2026-10-27:** propuesta y boceto en la rama `claude/rediseno-pizarra` (solo `docs/`). El
código de la app no cambió. D58 aprueba la dirección. Las P abiertas (P45–P66) esperan las respuestas de
[`preguntas-pendientes.md`](preguntas-pendientes.md); **nada de RP-1 a RP-4 se construye antes**.

**Archivos de esta propuesta:**

| Archivo | Qué es |
|---|---|
| `README.md` | Síntesis, arquitectura, historias HU-RD1–HU-RD14, plan RP-0–RP-8 |
| `ia-inventario.md` | Dónde queda cada pantalla y acción; R-1 a R-8 (lo que se rompería) |
| `task-flow-manager.md`, `task-flow-mecanico.md`, `task-flow-safety.md` | Un día de cada rol |
| `revision-sugerencias.md` | Qué está comprobado, qué es supuesto y qué se corrigió |
| `preguntas-validacion.md` | Primera hoja (24–26 oct). **Reemplazada** por `preguntas-pendientes.md` |
| `validacion/` → `validacion-hoy.html` | **Se genera, no está en git** (trae datos reales de Ninox): `validacion/actualizar-validacion.py` consulta Ninox (los dos links de Ninox van en variables de entorno; están en data-reporting-kit) y arma la página; publicada en privado en https://claude.ai/artifact/A2ovHWUjopsnujphwDXohR. Página para validar con el manager con los datos de Ninox del día (Board, Kanban, Arrivals con Check in, mecánicos, tablet de Detailing, PM / Fuel filter, lo que no cuadra) |
| `ninox-hoy.md` | Qué muestra Ninox, qué se puede obtener y de dónde; la regla PM / Fuel filter; lo que no cuadra |
| `flujo-de-trabajo-coo.md`, `Flujo-de-trabajo-COO.pdf` | Para el COO: las reglas del taller que faltan definir (visitas, inspección, plantillas, PM / Fuel filter, quién hace qué, reparto, partes, Quality Check, salida, llaves, métricas). No es sobre pantallas |
| `respuestas-coo-2026-10-26.md` | El correo de la COO con equipos y reglas, qué cambia en la app, conflictos y el borrador de las preguntas de vuelta |
| `preguntas-pendientes.md`, `Preguntas-pendientes.pdf` | **Las preguntas de esta semana** (después del correo de la COO): correo de vuelta a la COO, Shop Manager y manager de partes y compras. Reemplaza a `preguntas-validacion.md` para las conversaciones |
| `rp1-plan-tecnico.md` | RP-1 archivo por archivo: condiciones para empezar, migración, API, web, pruebas, horas |
| `mockup.html` | Boceto navegable; publicado en privado en https://claude.ai/artifact/RoLTBY4LTXWRy6r2moCLsE |

**Frentes que se pueden trabajar a la vez, sin pisarse:**

| Frente | Archivos | Depende de | Quién |
|---|---|---|---|
| **A. Propuesta y boceto:** task flow del mecánico, aplicar las respuestas de la hoja, ajustar el boceto | Solo `docs/proposals/rediseno-pizarra/*` y las P de `DECISIONS.md` | Las respuestas del taller | Una sola sesión a la vez (el boceto es un archivo) |
| ~~B. Incoming completo~~ | — | Ya no hace falta: el Shop calcula bien; la copia en Supabase está atrasada y el pedido a Ninox ya se envió (PR 435, LTR-262) | — |
| ~~C. Diseño de la tablet de Detailing~~ | — | Ya no hace falta: el dueño decidió que no se identifican (P50–P52, 2026-10-26) | — |
| **D. RP-1 a RP-4** | API, shared y web | P45–P56 decididas y D58 escrita | Después |

**Reglas:**
- Cada sesión, en su worktree y su rama desde `origin/main` (`docs/reference/AGENT_WORKFLOW.md`).
- No tocar los archivos de otro frente.
- Lo que es supuesto se dice como supuesto (`revision-sugerencias.md`).
- El boceto se republica con el mismo link, desde la sesión que lo tiene abierto, o pasando la URL.
