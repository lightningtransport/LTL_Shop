# Propuesta: rediseño de las pantallas del Mecánico de PM

**Clasificación:** PROPUESTA — no es el estado actual de la app.
**Fecha:** 2026-10-07 · **Rama:** `claude/mechanic-pm-proposal` · **Esperando la aprobación del dueño.**
**Pantallas:**
- Detalle del PM (`/work-orders/[id]?view=pm`): `apps/web/src/components/pm-job-detail.tsx` y `pm-service-card.tsx`.
- Inicio (`/mechanic/pm`): `apps/web/src/app/page.tsx` en modo PM.
- Create PM service (`/mechanic/pm/new`): `apps/web/src/app/work-orders/new/page.tsx`.
- Completed (`/mechanic/pm/completed`): `components/mechanic-completed-page.tsx`.

**Reglas que no cambian:** J9 y [HU-PM1](../../USER_FLOWS.md) (y su tabla), y `SYSTEM.md`:
- un PM a la vez;
- el PM se une al Work Order abierto del camión, o crea el Work Order completo;
- el millaje no puede bajar, y un salto de más de 50 000 pide confirmar;
- Finish exige el millaje y al menos una pieza;
- un PM terminado es solo lectura;
- PM A ↔ PM B cambia el mismo Job;
- el PM no tiene pausa: si algo lo detiene, se reporta un bloqueo y lo resuelve el Manager.

Hallazgos en [`OPEN_ISSUES.md` §1l](../../OPEN_ISSUES.md) (PM1–PM6), en la auditoría
[`docs/ux-audit/mecanico-pm/`](../../ux-audit/mecanico-pm/00-contexto.md) (skills audit-ux 0, 1, 4, 6 y 7)
y en el [resumen de los roles de campo](../../ux-audit/RESUMEN-roles-de-campo.md) §3 y §4 (bloque B).

## 1. Cómo verla

Abre [`mockup.html`](mockup.html) en el navegador (un solo archivo, sin instalar nada). Arriba: teléfono o
computadora, claro u oscuro, **Go offline / Go online** (corta y devuelve la conexión) y **Demo**, con un
botón por situación:

- PM en curso (sin piezas todavía);
- salto de millaje sin confirmar;
- listo para terminar;
- sin conexión (una pieza quedó en el teléfono);
- bloqueado;
- PM terminado (solo lectura);
- inicio sin PM en curso;
- inicio con un PM en curso;
- vacío;
- Create PM service (búsqueda "57");
- Create PM service con un PM en curso;
- Completed;
- cargando;
- error.

Todo funciona con datos de ejemplo: escribir el millaje (se valida al salir del campo), activar piezas,
cambiar PM A ↔ PM B y deshacer, escribir una nota, reportar un bloqueo, terminar el PM, empezar el
siguiente camión, crear un PM desde la búsqueda y ver Completed.

## 2. Para qué sirven las pantallas

Daniel es el único que hace PM. Está de pie junto al camión, con el teléfono, y la señal se corta
dentro del taller. Las pantallas responden tres preguntas:

- **En el PM:** ¿qué me falta para terminar este PM?
- **En el inicio:** ¿qué camión sigue?
- **En Completed:** ¿cuándo le hice el PM a este camión y con qué millaje?

## 3. Lo que está mal hoy (después del bloque A)

El bloque A ya está construido y fusionado (PR #256):
- las piezas esperan a que se confirme el salto de millaje (PM2);
- el millaje vacío no se guarda (PM3);
- lo que no se envió queda en el teléfono, con "Not saved", y se manda al volver la conexión (PM1);
- "You have a PM service in progress on Truck 968" con "Continue PM on Truck 968" en el inicio, en
  Create PM service y en el otro camión (PM5);
- los errores de guardado tienen texto propio;
- un Work Order que ya no existe lleva a "Back to My work".

El borrador de las notas también quedó en el teléfono (PR #257, PM6). Lo que sigue abierto:

| # | Qué pasa | Efecto |
|---|---|---|
| PM4 · UX-4-001 | **"Finish Work" queda a casi dos pantallas** (y = 1480 px a 375 px), después de "Service type", tres campos y nueve selects. | Daniel baja dos pantallas en cada PM para terminar. |
| UX-7-005 · UX-4-003 | **Nueve selects iguales**, todos en "No part used", sin conteo ni marca de los elegidos. | Para revisar antes de Finish lee las nueve filas; cada pieza es abrir un select y leer códigos. |
| UX-4-002 | **"Current truck mileage" y "Last completed PM" parecen campos** (mismo borde, fondo y alto que el campo que se llena). | Toca el primero, no pasa nada, y busca dónde escribir. |
| UX-7-002 | **"No puede ser menor" sale desde el primer dígito** y esconde las piezas mientras escribe. | Cada tecla le dice que está mal y la pantalla salta. |
| UX-7-006 | **Finish gris con un único texto fijo** ("Finish requires a saved observed mileage and at least one part.") aunque falte otra cosa: el salto sin confirmar, la conexión o un bloqueo. | No entiende por qué no puede terminar. |
| UX-7-007 | **La confirmación de Finish no muestra lo que queda registrado** ("This will complete the PM service."). | Es la última vez que puede ver un error antes de que quede fijo. |
| UX-1-006 | **PM A ↔ PM B se aplica al tocar**, sin aviso ni deshacer, y "Service type" es lo primero de la pantalla. | Un toque cambia el servicio sin que lo note. |
| UX-6-005 | **Mientras carga el PM, Finish ya sale gris con su requisito**, y al llegar los datos todo salta 1000 px. | Lee un requisito que no aplica. |
| UX-1-004 · UX-4-004 | **"Ready to Start" no ayuda a elegir el siguiente camión:** no hay prioridad, antigüedad ni último PM, y el WO sale dos veces por tarjeta. Las 7 tarjetas miden lo mismo. | Para saber cuál urge pregunta al Manager o abre uno por uno. |
| UX-1-005 | **"Paused PM services" siempre visible**, con un texto que promete reanudar. Daniel no reanuda: lo hace el Manager. | Espacio y una acción que no tiene. |
| UX-1-007 | **Completed no dice cuándo ni con qué millaje** se hizo cada PM. El subtítulo es el del mecánico general. | Para responder "¿cuándo le hice el PM al 606?" abre cada tarjeta. |
| UX-7-008 | **Dos textos fijos en inglés** en Create PM service: "No truck starts with #57…" y "Truck #… already has an open Work Order assigned to another mechanic." (`work-orders/new/page.tsx:342` y `:425`). | En español sale en el otro idioma. |
| UX-7-009 | **"Report Blocker" queda gris** hasta elegir el motivo, sin decirlo. Con "Other", el campo aparece después. | No sabe qué falta. |
| UX-4-005 | **En la computadora el formulario usa 576 px de 1366.** | Alarga el scroll. |
| UX-6-002 | **Si vence la sesión, vuelve al inicio, no al camión.** El borrador ya queda en el teléfono (bloque A), pero tiene que buscar el camión. | Busca el camión otra vez. |
| Estilo | **El estilo es el de antes de la Etapa 8.** El PM no usa `SectionCard`, `CountChip` ni `PriorityBadge` (está oculto para PM), y el botón principal desactivado se ve igual al secundario. | No se parece al resto de la app. |

## 4. Qué cambia (la maqueta)

### 4.1 Detalle del PM en curso (la pantalla principal)

1. **Encabezado:** "Truck 968", el vehículo y el WO en letra mono. A la derecha, **"Service type"** como
   chip editable: **"PM A ▾"**.
   - Al tocarlo se abre una hoja corta con PM A y PM B: "Changes this same Job. The mileage and the parts
     stay."
   - Después del cambio, un toast: **"Changed to PM B Service · Undo"**.
2. **Resumen arriba**, dice qué falta: **"Mileage 210,000 mi ✓ · Parts 1 of 9"**.
   - Cada parte en verde cuando está, y en ámbar o rojo cuando falta ("Mileage · confirm it").
   - A la derecha, el guardado: "Saved", "Saving…" o **"1 on this phone · not sent"**.
3. **Millaje**:
   - **"Truck now 210,000 mi"** y **"Last PM 160,120 mi · Jun 12"** como texto con etiqueta, no como campos.
   - Debajo, el único campo: **"Odometer reading"** (16 px, 44 px de alto, teclado numérico).
   - La validación sale **al salir del campo** (o con Enter), nunca desde el primer dígito:
     - menor: "Can't be lower than the truck (210,000 mi). Check the odometer.";
     - vacío: "Enter the mileage. The last saved one (210,000 mi) stays until then.";
     - salto de más de 50 000: un aviso ámbar con **"It's right"** (principal) y **"Fix it"**.
4. **Piezas** ("Parts used · 1", con `CountChip`): una fila por categoría, con un **interruptor**
   (en lectores de pantalla, "Oil Filter 1 Unit changed").
   - Al activarlo, queda elegida **la pieza más usada para ese modelo**, con "Most used on this model ·
     11 of 12 PMs". Un select permite cambiarla.
   - Si el modelo no tiene historial, no se elige ninguna: "Choose which part".
   - Una categoría sin piezas para el camión queda apagada: "No parts listed for this truck".
   - Mientras el millaje falta, es menor o espera confirmación, las piezas quedan bloqueadas con el
     motivo (lo del bloque A, ahora en una franja).
5. **Finish fijo abajo**, en una barra pegada:
   - **"Report blocker"** con borde y **"Finish PM"** como botón principal.
   - Encima, el **motivo exacto** cuando no se puede terminar:
     - "Add at least one part";
     - "Choose the part for Desiccant Filter";
     - "Enter the mileage above", "Check the mileage above" o "Confirm the mileage above";
     - "Waiting to save… (offline)";
     - "Blocked · waiting for the Manager".
   - Cuando se puede: "Ready to finish · 210,000 mi · 1 part".
   - El botón desactivado tiene otro estilo (borde punteado, gris), no el del secundario.
6. **Confirmación de Finish con el resumen:** "Finish PM A on Truck 968? Check it now: after this the PM is
   read-only."
   - Mileage 210,000 mi ("The truck stays at 210,000 mi" o "The truck goes from 210,000 mi to 212,345 mi").
   - Parts: "Oil Filter 1 Unit — 21707132".
   - Botones **Back** y **Finish PM**. Después, toast y vuelta al inicio.
7. **Report blocker:**
   - Las razones son opciones grandes, en lugar del select.
   - "What is missing?" siempre visible (obligatorio solo con "Other").
   - El botón siempre activo; si falta algo, dice qué ("Choose a reason", "Say what is stopping you").
8. **Bloqueado:** una tarjeta ámbar arriba, "Blocked · Waiting for Parts":
   - quién y cuándo lo reportó;
   - las notas del bloqueo;
   - un campo para agregar otra nota.

   Daniel puede seguir anotando el millaje y las piezas. Finish dice por qué no.
9. **Notas** (PM6, decidido el 2026-10-07): el hilo del Work Order.
   - El borrador queda en el teléfono: "Draft · kept on this phone until you tap Add Note".
   - Se publica con **Add Note**. Al lado, **Request Work**.
   - Sin conexión, Add Note espera y el borrador sigue ahí.
10. **Truck information** plegada al final, con "Repair history". Sin cambios.
11. **En la computadora** (≥ 1024 px): resumen, millaje y notas a la izquierda; piezas a la derecha;
    la barra de Finish abajo, a todo el ancho.

### 4.2 Inicio (PM Mechanic)

1. **El PM en curso arriba**, en una tarjeta con borde primario:
   - "Truck 968 · PM A · Started 8:05 AM";
   - el mismo resumen ("Mileage 210,000 mi ✓ · Parts 1 of 9");
   - **Continue PM**.

   Debajo, "Create PM service opens when Truck 968 is finished. One PM at a time." Con un PM en curso,
   **nada ofrece empezar otro**.
2. **"Waiting for PM"** (antes "Ready to Start"), ordenado por **prioridad y después por antigüedad**:
   - tarjetas compactas: "Truck 605", `PriorityBadge`, "waiting 3 d";
   - "PM A · WO-005 · 2022 Volvo VNL 760";
   - **"Last PM: 196,400 mi · May 30"** (o "No PM on record");
   - **View**.
3. **Sin PM en curso**, la primera tarjeta lleva "Next up" y **"Start PM on Truck 605"** como único botón
   principal. "Create PM service" queda con borde, arriba (D-PM3).
4. **"Paused by the Manager"** solo si hay alguno, con la razón, desde cuándo y la nota del Manager
   ("Waiting for Parts · paused yesterday · Cristian: fuel filters arrive Thursday"). Se puede ver, no empezar.
5. **Vacío:** "No trucks waiting for PM. When the Manager plans a PM, the truck shows up here." con
   **Create PM service**.
6. **Cargando:** esqueletos, y Create PM service sin acción hasta saber si hay un PM en curso (como hoy).

### 4.3 Detalle de un camión que espera

- "Before you start": el millaje de hoy y el último PM, la prioridad y desde cuándo espera.
- **Start PM service** fijo abajo.
- Con otro PM en curso: el aviso del bloque A, "You have a PM service in progress on Truck 968 (WO-016).
  Finish it before starting another.", con **Continue PM on Truck 968**. Start queda desactivado:
  "One PM at a time · finish Truck 968 first".
- Pausado por el Manager: el aviso con la razón y Start desactivado.

### 4.4 Create PM service

- **Búsqueda de camión con todos los textos en los dos idiomas**, incluidos "No truck starts with #57.
  Showing numbers that contain it." y el del Work Order de otro mecánico (UX-7-008).
- Cada resultado dice si tiene WO abierto ("Open WO-010") o si es "Your PM".
- Al elegir el camión, dice qué va a pasar y el botón lo nombra:
  - sin Work Order: "Create PM service";
  - WO sin PM: **"Add PM to WO-010"** (el PM se une);
  - WO con PM: "Start PM on WO-014";
  - el mío: "Continue PM on Truck 968".
- **Con un PM en curso**, el aviso va arriba con "Continue PM on Truck 968", y el botón de abajo queda
  desactivado con el motivo.

### 4.5 Completed

- Subtítulo propio: "PM services you finished, newest first."
- **Agrupado por día** ("Today · 1", "Yesterday · 2", "Mon, Oct 5 · 1").
- Cada fila: "Truck 606 · PM A · WO-006" y **"Oct 7 · 154,300 mi · 1 part"**, con chevron.
- Al tocarla se abre el PM terminado (solo lectura): "PM finished Oct 7, 11:40 AM. It is read-only now.
  The Shop Manager closes the Work Order.", el millaje, el PM anterior y las piezas.

### 4.6 Estados

- **Cargando el PM:** esqueleto con la forma del formulario (resumen, millaje, filas de piezas), **sin
  Finish** (UX-6-005).
- **Error del servidor:** el encabezado se queda.
  - Texto propio: "The PM on Truck 968 did not load. The Shop did not answer. It is not something you did.
    What you entered is still on this phone."
  - Botones **Try again** y **Back to My work**.
- **Sin conexión:** una sola franja arriba, "**Offline** · your changes are kept on this phone and will be
  sent when you're back online" (bloque C).
  - La fila cambiada lleva "On this phone".
  - El resumen dice "1 on this phone · not sent".
  - Finish dice "Waiting to save… (offline)".
  - Al volver: "Back online · your changes were sent".
- **Salto de millaje sin confirmar**, **bloqueado** y **PM terminado**: descritos arriba.

### 4.7 Estilo de la Etapa 8

- Las mismas primitivas que la propuesta de Safety: tarjetas con título (`SectionCard`), `CountChip`,
  chips con punto, `PriorityBadge`, botones con icono y hojas inferiores.
- Claro y oscuro.
- Teléfono de 375 px como principal: toques de 44 px y textos de 16 px en los campos.

## 5. Qué necesita la API (todo aditivo)

Revisado en `apps/api/src/work-orders/work-orders.service.ts` y `packages/shared/src/types.ts`. **Ya existe
y no se pide:**

- `priority`, `createdAt` (para "waiting 3 d") y `currentPauseReason` en `WorkOrderSummaryDto`;
- `pmJob.completedAt` (la fecha de Completed);
- `lastCompletedPm` (millaje y fecha) en `PmServiceDto`;
- cambiar PM A ↔ PM B (`POST /work-orders/:id/jobs/:jobId/pm-service`, que también sirve para "Undo");
- los bloqueos y sus notas.

| Cambio | Para qué |
|---|---|
| En `PmPartCategoryDto`: `mostUsedPartId` y `mostUsedCount` / `pmCountForModel` (PM terminados de camiones de la misma marca y modelo) | Elegir la pieza al activar el interruptor y decir "Most used on this model · 11 of 12 PMs" (D-PM1). Se calcula con `PmServicePart` de los PM terminados; `null` sin historial. |
| En `WorkOrderSummaryDto.pmJob` (solo en modo PM): `observedMileage` y `partsCount` | El resumen de la tarjeta en curso y la línea de Completed ("Oct 7 · 154,300 mi · 1 part"). |
| En `WorkOrderSummaryDto` (solo en modo PM): `lastPm: { observedMileage, completedAt } \| null` | "Last PM: 196,400 mi · May 30" en Waiting for PM, sin abrir cada camión. |
| En `WorkOrderSummaryDto`, para los pausados: `pausedAt` y la última nota de la pausa | "paused yesterday · Cristian: fuel filters arrive Thursday". |

Ningún campo existente cambia. Las reglas (un PM a la vez, millaje, salto, al menos una pieza, solo
lectura) siguen en la API como hoy.

## 6. Decisiones pendientes del dueño

| # | Pregunta | Recomendación |
|---|---|---|
| D-PM1 | **¿Al activar una categoría se elige sola la pieza más usada para ese modelo?** | **Sí, con el número a la vista** ("Most used on this model · 11 of 12 PMs") y el select para cambiarla. Ahorra abrir un select en cada pieza. Sin historial para el modelo, no se elige nada y hay que escogerla; Finish lo dice. La confirmación de Finish muestra lo elegido antes de que quede fijo. |
| D-PM2 | **¿Una sola pieza por categoría, como hoy?** | **Sí.** Los dos filtros de aceite ya son categorías distintas ("Oil Filter 1 Unit" y "2 Unit"). Si un día cambian dos piezas distintas de la misma categoría, se ve con Daniel; no hace falta para esta pantalla. |
| D-PM3 | **Sin PM en curso, ¿el primer camión de "Waiting for PM" lleva "Start PM" directo?** | **Sí, solo el primero** ("Next up"). Los demás llevan "View". Así hay un solo botón principal y el orden por prioridad sirve para algo. Create PM service queda con borde, para un camión que no está en la lista. |
| D-PM4 | **¿Cómo se ordena "Waiting for PM"?** | **Prioridad y después lo que más tiempo espera.** Cuando se construya "Leaves today" de Dispatch para Safety (D-QC5), se suma arriba como en Quality Check. |
| D-PM5 | **¿Cambiar PM A ↔ PM B pide confirmar?** | **No: toast con "Undo".** Es reversible y no toca el millaje ni las piezas; una confirmación le agrega un paso a algo raro, y el toast lo hace visible (UX-1-006). |

La decisión de las notas ya está tomada (PM6, 2026-10-07): el borrador queda en el teléfono y la nota se
publica con **Add Note**. La maqueta la muestra así.

## 7. Plan de implementación (cuando el dueño apruebe)

Un commit por etapa, cada una con sus pruebas: unitarias, e2e de las pantallas del PM
(`apps/web/e2e/pm-workflow.spec.ts`) y `test:real` para la API. Cada etapa se compara con la maqueta usando
capturas en teléfono y computadora, claro y oscuro.

1. **API:**
   - la pieza más usada por modelo;
   - `observedMileage` y `partsCount` en el resumen;
   - `lastPm` en la lista;
   - `pausedAt` y la nota de la pausa.
2. **Detalle del PM:**
   - el encabezado con el chip de Service type y su toast con Undo;
   - el resumen;
   - el millaje como texto y la validación al salir del campo;
   - las piezas con interruptor;
   - Finish fijo con el motivo y la confirmación con el resumen;
   - Report blocker con opciones grandes;
   - el esqueleto;
   - las dos columnas en la computadora.
3. **Inicio:**
   - el PM en curso;
   - Waiting for PM con el orden, las tarjetas compactas y Next up;
   - Paused by the Manager solo si hay;
   - el vacío.
4. **Create PM service** (los textos a `locale-context.tsx` en los dos idiomas y el botón que nombra lo que
   pasa) y **Completed** (por día, con fecha, millaje y piezas).
5. **Verificación final:**
   - la franja única de sin conexión (bloque C, común con Safety y el Mecánico General);
   - `ui-audit` con la cuenta de PM, en inglés y español, claro y oscuro, teléfono y computadora;
   - docs: `USER_FLOWS` HU-PM1, `SYSTEM.md`, `design-system` y `OPEN_ISSUES` §1l.

## 8. Notas de la maqueta

- Los datos son de ejemplo:
  - camiones 968 (el PM en curso, WO-016), 605, 603, 944 y 612 (esperan), y 609 (pausado por el Manager);
  - Completed: 606, 607, 931 y 602;
  - las piezas son de un Volvo VNL, tomadas de `apps/api/test/fixtures/pm-parts.csv`.
- "Hoy" es el 7 de octubre de 2026. El mecánico es Daniel ("MPM").
- La maqueta está en inglés. La app sigue con los dos idiomas completos.
- Las acciones cambian la maqueta sin guardar nada. "Reset" la vuelve al principio.
- Los colores (tokens) son los mismos que en la propuesta de Safety, las maquetas del Admin y `globals.css`.
- No se muestran, porque no cambian:
  - "Your clock is stopped · tap Continue" del PM (D20, D21);
  - la pestaña Trucks, que es la misma del Mecánico General.
- **Para el próximo PR de docs:** `OPEN_ISSUES.md` §1l todavía dice "Pendiente" en PM1, PM2, PM3 y PM5,
  que el PR #256 ya arregló, y en PM6, que arreglaron #256 y #257.
