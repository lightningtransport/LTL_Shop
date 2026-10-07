# Propuesta: rediseño de las pantallas del Mecánico General (Standard)

**Clasificación:** PROPUESTA — no es el estado actual de la app.
**Fecha:** 2026-10-07 · **Rama:** `claude/mechanic-standard-proposal` · **Sin aprobar; sin construir.**
**Pantallas:**
- Inicio "My Assigned Work": `/mechanic/standard` → `apps/web/src/app/page.tsx`.
- Detalle del camión: `/work-orders/[id]` → `apps/web/src/app/work-orders/[id]/detail-client.tsx` y `components/work-order-notes-thread.tsx`.
- Trucks: `components/mechanic-trucks-page.tsx`.
- Completed: `components/mechanic-completed-page.tsx`.
- Pestañas: `components/mechanic-tabs.tsx`.

**Reglas que no cambian:**
- D11: cada Job tiene un dueño; lo de otros se ve en solo lectura.
- D17: el bloqueo es de un Job, uno a la vez, y solo el Manager lo resuelve.
- D18: el tiempo es por mecánico y se detiene al terminar o bloquear su último Job.
- D20: el día se cierra solo a las 5:00 p.m.
- D21: el reloj corre en un solo camión.
- D23: el ayudante tiene su propio Job "· helper".
- [J6, J7, J8 y HU-ME1 a HU-ME6](../../USER_FLOWS.md).

Hallazgos en [`OPEN_ISSUES.md` §1k](../../OPEN_ISSUES.md) (MG1–MG9), en la auditoría
[`docs/ux-audit/mecanico-general/`](../../ux-audit/mecanico-general/00-contexto.md) (skills audit-ux 0, 1, 4, 6
y 7) y en el [resumen de los roles de campo](../../ux-audit/RESUMEN-roles-de-campo.md) §2 y §4 (bloque B).
Es la maqueta del bloque B para el Mecánico General.

## 1. Cómo verla

Abre [`mockup.html`](mockup.html) en el navegador (un solo archivo, sin instalar nada; necesita internet
para Tailwind y los iconos). Arriba: teléfono o computadora, claro u oscuro, y **Demo**, con un botón
por situación:

- **Normal:** el reloj corre en el 922; el 604 espera Continue; dos camiones listos para empezar; uno
  bloqueado; uno con mi parte terminada.
- **Clock on another Truck:** el detalle del 604 mientras el reloj corre en el 922.
- **Clock stopped:** el reloj no corre en ninguno.
- **With a blocker:** el detalle del 605 con su Job bloqueado.
- **Report blocker:** la hoja de bloqueo abierta.
- **My part done:** el detalle del 922 después de completar mis dos Jobs.
- **Blocker resolved:** el Manager resolvió el bloqueo del 605 ("Resolved · tap Continue").
- **Day closed:** el cierre de las 5:00 p.m. ("Yesterday's work is still open · tap Continue").
- **Paused by Manager:** aparece la sección de pausados.
- **Trucks** y **Completed**.
- **Empty**, **Loading**, **Error**, **Offline** y **Work Order gone** (ya no tengo Jobs ahí).

Todos los botones funcionan con datos de ejemplo: Start, Continue, Complete job, Report blocker, Add note
(al bloqueo y al camión), Request work, la búsqueda de Trucks y abrir un camión desde Trucks o Completed.

## 2. Para qué sirven las pantallas

El mecánico está de pie junto al camión, con el teléfono en una mano. Abre la app al llegar, al cambiar
de camión, al terminar un Job y cuando algo lo detiene. Las preguntas que la app tiene que contestar
de un vistazo son:

- *¿Dónde corre mi reloj?*
- *¿En qué camión trabajo ahora?*
- *¿Qué me toca aquí y qué hago cuando algo me detiene?*

## 3. Lo que está mal hoy (auditoría del 2026-10-07, después del bloque A)

El bloque A ya está construido y fusionado (#256, #257):

| Arreglo | Qué hace hoy |
|---|---|
| MG2 | Aviso "Clock moved from Truck 604 to Truck 922". |
| MG3 | "Your clock is stopped · tap Continue" cuando el reloj no corre en ninguno. |
| MG4 | "Continue" en la tarjeta. |
| MG6 | "You have no Jobs on this Work Order anymore". |
| MG7 | Errores en los dos idiomas. |
| MG8 | La nota del bloqueo siempre se ofrece. |
| MG9 | Borradores que se conservan en el teléfono. |

La maqueta conserva todo eso. Lo que sigue abierto:

| # | Qué pasa | Efecto |
|---|---|---|
| MG1 (UX-1-001) | **El inicio no dice en qué camión corre el reloj**; solo avisa cuando se detuvo. | El mecánico cree que su tiempo se registra y no es así. Es el único hallazgo grave (3). |
| MG5 (UX-1-007) | **"Labor time · running" suma el tiempo de todos los mecánicos** del camión. | El mecánico lo lee como "mi tiempo". **Decidido el 2026-10-07:** ve solo el suyo; el total es del Manager. |
| UX-4-001 | **Cuatro botones primarios iguales** en el inicio ("View Work", "Start Work", "View Details"). Nada distingue el camión donde trabaja. | Lee cada tarjeta para saber adónde ir. |
| UX-1-005, UX-4-002 | **Un camión donde solo me queda un Job bloqueado sigue en "In Progress"**; el bloqueo es una línea gris de 12 px. | Abre el camión para descubrir que espera al Manager. |
| UX-4-003 | **El aviso del reloj es un chip al lado del título** y parte el número del Work Order. | Se lee mal. |
| UX-4-004 | **"Paused by the Manager" sale vacía siempre**, y "Normal" sale en cada tarjeta. | Ruido que diluye "Critical". |
| UX-4-005 | **"Other work" pesa lo mismo que "Your Jobs"** (la misma tarjeta), y los títulos de sección son más chicos que los Jobs. | Hay que buscar el Job propio; las notas quedan a más de 950 px. |
| UX-4-006, UX-1-009 | **Con un bloqueo, lo primero que se ve es un campo de texto vacío**, y "Your Jobs" queda bajo el pliegue. El bloqueo no dice desde cuándo. | El detalle de un camión bloqueado falla la prueba de 5 segundos. |
| UX-4-007 | **El resumen habla del camión** ("PM, Detailing, … · 1 of 6 jobs done"), no del mecánico. | Dos líneas que no ayudan a decidir. |
| UX-7-005 | **El motivo del bloqueo es un select nativo de 7 opciones**. | Tres o cuatro toques, a veces con guantes. |
| UX-7-006 | **Nota y Request Work comparten el campo**, y el botón principal es Request Work. | Un pedido enviado como nota no llega a la cola del Manager; una nota enviada como pedido ensucia la cola. |
| UX-7-001 | **Los campos de nota no tienen etiqueta visible** (solo el placeholder). | Con el teclado abierto no se sabe qué es el campo. |
| UX-1-008 | **El toast "Work started." tapa los botones de la hoja** "Complete job" durante 6 s. | Un toque apurado cae en el toast. |
| UX-6-004 | **El error de una hoja queda en la página** después de cerrarla. | El aviso rojo ya no corresponde a nada. |
| UX-6-007 | **La app no detecta que no hay conexión**; cada acción falla por separado. | El mecánico se entera al tocar. |
| UX-1-010, UX-7-007 | **Trucks:** "Open WO-004" no lleva al Work Order, y el campo abre el teclado de letras para un número. | Un camino corto que falta. |
| UX-6-001, UX-6-003 | **Trucks** no muestra nada mientras carga, y su error dice "Unable to load work orders". | No se sabe si la búsqueda funciona. |
| UX-1-011 | **Completed no dice cuándo se completó cada Job ni con qué nota**. | Para "¿cuándo cambié esa batería?" hay que abrir el Work Order. |
| UX-1-006 | **`/mechanic/standard/new` existe**, sin enlace, y se titula "New Work Order". | Solo con un marcador viejo. |
| UX-4-008 | **En la computadora se usan 576 de 1366 px**. | No estorba (el mecánico usa el teléfono). |

## 4. Qué cambia (la maqueta)

1. **Franja del reloj, fija debajo de la cabecera, en todas las pantallas del mecánico** (MG1).
   - **Corre:** punto verde y "Your clock · Truck 922 · since 10:45 AM". Al tocarla abre el camión.
   - **No corre:** "Your clock is stopped · tap Continue on a Truck".
   - **Después del cierre del día:** "Your clock stopped at 5:00 PM yesterday · tap Continue on Truck 922".
   - **Sin conexión:** la franja pasa a ser el único aviso, "Offline · your changes are not sent", con
     la hora de los datos que se muestran (UX-6-007). Los botones que envían algo quedan desactivados.
     Lo que se escribe sigue guardándose en el teléfono.
2. **Inicio (My work)**, por secciones con contador:
   - **In progress.** Primero la tarjeta donde corre el reloj: borde primario, marca verde **"Clock
     running"** y el único botón principal, **"View work"**. Las demás tarjetas llevan **"Continue"**
     con borde y "View", y el aviso del reloj va como una franja de ancho completo dentro de la tarjeta
     (UX-4-003), por ejemplo "Your clock is on Truck 922 · Continue moves it here", "Your clock is
     stopped · tap Continue", "Resolved · tap Continue" o "Yesterday's work is still open · tap
     Continue". Si el reloj no corre en ninguno, el botón principal pasa al **siguiente trabajo
     disponible**, en este orden: el bloqueo resuelto, el del cierre del día, la prioridad y, por
     último, "Ready to Start" (UX-4-001).
   - **Ready to Start.** "Start Work" con borde (principal solo si es el siguiente), lo más urgente
     primero.
   - **Blocked · waiting on the Manager**, en ámbar (UX-1-005, UX-4-002). Cada tarjeta dice el Job, el
     motivo, desde cuándo ("Since Oct 6, 2:10 PM · 1 day") y cuántas notas tiene. No lleva botón:
     la tarjeta entera abre el camión.
   - **Waiting on the Manager:** una fila por camión ("Your part is done · Alignment").
   - **Paused by the Manager:** solo si hay alguno (UX-4-004).
   - **Prioridad:** solo se muestra High y Critical.
   - **En cada tarjeta:** mis Jobs con su estado (punto, ✓ o ámbar) y "Next" en el que sigue.
3. **Detalle del camión:**
   - **Encabezado:** "← My work", "Truck 922", la prioridad si es alta, y el vehículo con el WO en letra
     mono.
   - **Resumen del mecánico** (UX-4-007, MG5): "Your Jobs **0 of 2 done**" y "Your time **1h 12m** ·
     running" (o "stopped"). Si el reloj no corre aquí, el resumen explica por qué ("Your clock is on
     Truck 922 · Continue moves it here") y lleva el botón **Continue** o **Start Work**. Cuando aplica,
     muestra también "You finished your part…", el bloqueo resuelto con la nota del Manager o la pausa
     del Manager.
   - **Bloqueo como aviso compacto** (UX-4-006, UX-1-009): "Air Bag Replacement · Waiting for Parts",
     "Since Oct 6, 2:10 PM · 1 day · reported by you. Only the Manager resolves it.", las notas con autor
     y hora, y el botón **"Add note"**, que abre el campo con su etiqueta "Note for the Manager". El
     campo no se muestra hasta que se pide.
   - **Your Jobs:**
     - Cada Job con su estado y "Next". La categoría sale solo si es distinta del nombre, y el Job de
       ayudante dice "Helping Alejandro 2".
     - **Complete job** y **Report blocker** debajo. Complete job es principal solo en el Job "Next";
       en los demás va con borde.
     - Sin el reloj aquí, Complete job está desactivado y debajo dice "Tap Continue to complete Jobs."
   - **Other work on this Truck** (UX-4-005): plegado por defecto, con el contador y los avatares de
     color. Abierto, muestra una línea por Job (avatar, Job, mecánico y estado como punto + texto: To do,
     In progress, Done) y "Other mechanics do this work. You can see it, not change it."
   - **Notes y Request work separados** (UX-7-006, UX-7-001):
     - El campo de nota tiene la etiqueta visible "Add a note" y su botón "Add note".
     - **"Request work"** es un botón en la cabecera de Notes con su propia hoja: "What does the Truck
       need?". La hoja explica que va al Dashboard del Manager, que decide si agrega un Job.
     - Los pedidos se ven en el hilo con "Work request · waiting for the Manager".
   - **Truck information** plegada: vehículo, millaje, VIN y "Repair history".
   - **En la computadora**, dos columnas: lo mío a la izquierda; Notes y el camión a la derecha
     (UX-4-008).
4. **Hojas** (abajo en el teléfono, centradas en la computadora). Abrir una hoja cierra el toast
   (UX-1-008); cerrarla limpia su error (UX-6-004).
   - **Complete job:**
     - El título es "Complete Air Dryer?".
     - Debajo dice si es el último Job ("your clock stops") o no ("Your clock keeps running").
     - "Closing note (optional)" guarda el borrador ("Draft kept on this phone", como en el bloque A).
   - **Report blocker:**
     - Los 7 motivos son **opciones grandes de 44 px** visibles de una vez (UX-7-005): "Waiting for
       Parts" primero y "Other" al final.
     - Debajo, siempre, "What is missing? (optional)". Con "Other" pasa a "What is stopping you?" y es
       obligatorio; si falta, el error sale junto al campo.
     - El botón nunca queda gris sin explicación.
     - Avisa si el reloj se va a detener.
   - **Request work:** el texto es obligatorio ("Say what the Truck needs.") y el botón dice "Send to
     Manager".
5. **Trucks:**
   - El campo "Truck number" usa `inputMode="numeric"` (UX-7-007).
   - Si tengo Jobs en el Work Order abierto, **"Open WO-004 ›"** lleva al detalle (UX-1-010). Si no,
     "Open WO-003" es solo una marca.
   - "Repair history ›" va en su propia fila.
   - Mientras carga: esqueletos. Error: "Unable to load trucks." (UX-6-001, UX-6-003).
6. **Completed:** agrupado en Today, Yesterday y Earlier. Cada Job lleva la fecha y hora de cierre a la
   derecha y su nota de cierre en una línea truncada, o "No closing note" (UX-1-011). Tocar la fila abre
   el camión.
7. **Estados:**
   - Vacío: "No Jobs assigned yet. When the Manager gives you a Job, it shows up here."
   - Cargando, con esqueletos, también en la franja.
   - Error, con "Try again".
   - Sin conexión (punto 1).
   - Work Order que ya no existe o sin Jobs míos: la cabecera, el mensaje y "Back to My work" (ya
     construido en el bloque A).
   - Bloqueo resuelto: "Resolved · tap Continue".
   - Día cerrado: "Yesterday's work is still open · tap Continue".
8. **Estilo de la Etapa 8:**
   - Las mismas primitivas que la propuesta de Safety: `SectionCard`, `CountChip`, `MechanicAvatar`,
     `PriorityBadge`, chips con punto, botones con icono y hojas inferiores.
   - Pestañas **abajo** en el teléfono, como en Safety (ver D-MG1); arriba en la computadora.
   - Claro y oscuro. Toques de 44 px y campos de 16 px en el teléfono.
9. **Fuera de esta maqueta:** `/mechanic/standard/new` redirige a `/mechanic/standard` (UX-1-006). No
   tiene pantalla.

## 5. Qué necesita la API (todo aditivo)

Verificado en `apps/api/src/work-orders/` y `packages/shared/src/types.ts` el 2026-10-07:

- El detalle ya trae `laborRunning` (mi sesión abierta), `myClockStopped`, `resolvedBlocker`,
  `myPartDone`, `activeBlockers` con notas y `noteEntries` con `kind` y `handledAt`.
- La lista ya trae `myClockStopped` por camión y `activeBlocker` por Job, con `reportedAt` y
  `reportedBy`.
- El servicio ya calcula dónde corre mi reloj (`LaborClockService.clockOf`), pero no lo manda en la
  lista y no trae la hora de inicio.
- `totalActiveLaborMs` es la suma de todos (`computeTotals` sobre todas las sesiones).

| Cambio | Para qué | Ya existe |
|---|---|---|
| En `GET /work-orders` (lista del mecánico): `myClock: { workOrderId, displayId, truckNumber, since } \| null` | La franja del reloj y la marca "Clock running" (MG1). | `clockOf(user.id)` ya se llama en la lista; falta devolverlo con `startedAt`. |
| En `GET /work-orders/:id` del mecánico: `myActiveLaborMs` (la suma de **mis** sesiones en ese Work Order) | "Your time" (MG5). `totalActiveLaborMs` no se toca: el Manager lo sigue viendo. | Las sesiones ya vienen con `userId` (LTR-184). |
| En los Jobs de la lista: `completedAt` y `completionNotes` | Completed con fecha y nota (UX-1-011). | Están en el detalle, no en el `Pick` del resumen. |

Lo que **no** necesita API:
- "Blocked · waiting on the Manager" y "desde cuándo": salen de `activeBlocker.reportedAt`.
- "Open WO-004 ›" en Trucks: la web cruza `truck.openWorkOrder` con mi lista.
- Sin conexión: `online`/`offline` del navegador y revalidar al volver.

Ningún campo existente cambia. Las reglas de la API (D11, D17, D18, D21) siguen iguales.

## 6. Decisiones del dueño

**Decididas el 2026-10-07: todas como la recomendación (D-MG1…D-MG5).** Se construye como dice la columna de la derecha.

Solo lo que cambia cómo trabaja el mecánico; el resto ya está decidido (MG5) o es de pantalla.

| # | Pregunta | Decisión |
|---|---|---|
| D-MG1 | **¿Pestañas abajo en el teléfono** (My work · Trucks · Completed), como en la propuesta de Safety? Hoy están arriba. | **Sí**, para el Mecánico General, el PM y Safety por igual: quedan al alcance del pulgar y los tres roles se ven igual. En la computadora siguen arriba. |
| D-MG2 | **¿"Your time" cuenta todo lo que llevo en ese Work Order** (todos los días) **o solo hoy?** | **Todo el Work Order**: contesta "cuánto tardé" (J7), y el cierre de las 5:00 p.m. ya separa los días para el Manager. |
| D-MG3 | **¿"Continue" en otro camión pide confirmar** que el reloj se mueve? | **No.** La tarjeta ya lo dice antes ("Your clock is on Truck 922 · Continue moves it here") y el aviso lo confirma después (MG2, bloque A). Confirmar sería un toque más en cada cambio de camión, que es frecuente (D21). |
| D-MG4 | **Request work: ¿texto libre o elegir un Job del catálogo?** | **Texto libre**, como hoy. El mecánico describe lo que vio y el Manager decide qué Job agrega y a quién (D11). |
| D-MG5 | **"Other work on this Truck": ¿plegado o abierto** por defecto? | **Plegado**, con el contador y los avatares a la vista. El mecánico entra por su Job; si lo abre, el teléfono lo recuerda. |

## 7. Plan de implementación (cuando el dueño apruebe)

Un commit por etapa, cada una con sus pruebas: e2e de la pantalla y, si toca la API, su fila de
`test:real`. Cada etapa se compara con la maqueta con capturas en teléfono y computadora, claro y
oscuro.

1. **API:**
   - `myClock` en la lista.
   - `myActiveLaborMs` en el detalle del mecánico.
   - `completedAt` y `completionNotes` en los Jobs de la lista.
2. **Franja del reloj y aviso sin conexión** (componente común, que después usan el PM y Safety, del
   bloque C).
3. **Inicio:**
   - Secciones (Blocked aparte y pausados solo si hay).
   - Un solo botón principal.
   - Tarjeta "Clock running".
   - Franjas de aviso dentro de la tarjeta.
   - Prioridad solo alta.
4. **Detalle del camión:**
   - Resumen "Your Jobs · Your time".
   - Aviso compacto del bloqueo con "Add note".
   - Your Jobs.
   - Other work plegable.
   - Notes y la hoja de Request work.
   - Dos columnas en la computadora.
5. **Hojas:** Report blocker con opciones grandes; el toast se cierra al abrir una hoja; el error se
   limpia al cerrarla.
6. **Trucks y Completed:**
   - `inputMode`, "Open WO ›", esqueletos y su error.
   - Fecha y nota por Job.
   - El redirect de `/new`.
7. **Pestañas abajo** (si D-MG1 es sí) para los tres roles de campo.
8. **Verificación final:**
   - `ui-audit` con la cuenta de Anthony, en inglés y español, claro y oscuro, teléfono y computadora.
   - Docs: `SYSTEM.md` (pantallas del mecánico), `USER_FLOWS` HU-ME1 a HU-ME4, `OPEN_ISSUES` §1k (MG1,
     MG5) y `design-system`.

## 8. Notas de la maqueta

- Los datos son de ejemplo: el mecánico es Anthony (AN); los camiones son 922, 604, 605, 931, 610 y
  607; los otros mecánicos son Alejandro 2, Mario Díaz, Marco PM y Miguel Ángel; el Manager es Cristian.
- "Hoy" es el 7 de octubre de 2026; las acciones usan las 11:58 AM.
- Las acciones cambian la maqueta sin guardar nada. "Reset" la vuelve al principio. Los borradores
  viven mientras la página esté abierta (en la app, en el teléfono, como en el bloque A).
- En inglés, como la app por defecto; los textos en español van en `locale-context.tsx` al construir.
- Usa los mismos colores (tokens) que la maqueta de Safety, las del Admin y `globals.css`.
