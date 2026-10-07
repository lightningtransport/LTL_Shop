# 07 · Formularios e interacción — Lightning Shop, pantallas del Mecánico General (Standard)

**Fecha:** 2026-10-07 · **Alcance:** los formularios del detalle del Work Order (Complete job, Report Blocker, nota al bloqueo, Notas / Request Work), Start Work en el inicio y la búsqueda de Trucks, con Anthony, teléfono 375 px (también en modo táctil) · **Método:** código + navegador (demo local, recorrido con Playwright; errores provocados interceptando la API)
**Resumen:** 7 hallazgos, ninguno de severidad 3. No hay riesgo de doble envío: todos los botones se deshabilitan y cambian de texto mientras se envía. La fricción está en **Report Blocker**: el motivo es un select nativo de 7 opciones, la nota solo aparece con "Other" y, con "Other" vacío, el botón queda gris sin decir por qué. Lo otro que se repite es que **lo escrito se borra** al cerrar un diálogo.

## Inventario de formularios

| Formulario | Ruta | Flujo | Patrón | Revisado |
|---|---|---|---|---|
| Start Work / Continue | `/mechanic/standard` (tarjeta) y `/work-orders/[id]` | 2 · Trabajar | botón con `busy`, sin formulario | completo |
| Complete job (hoja con nota opcional) | `/work-orders/[id]` | 2 · Trabajar | `Modal` + `Textarea` con `Label`, estado local, `onClick` | completo: feliz, 500, 409, sin conexión, 401, cerrar y reabrir |
| Report Blocker (motivo + detalle si "Other") | `/work-orders/[id]` | 3 · Bloqueo | `Modal` + `Select` nativo + `Textarea`, `onClick` | completo: feliz, vacío, "Other" vacío, cerrar |
| Nota al bloqueo | `/work-orders/[id]` (sección "Active blockers") | 3 · Bloqueo | `<form onSubmit>` + `Textarea` con `aria-label` | muestreo (vacío, código) |
| Notas / Request Work | `/work-orders/[id]` (sección "Notes") | 4 · Notas | `Textarea` con `Label` oculta + dos botones `type="button"` | feliz (Request Work), sin conexión en ES |
| Buscar unidad | `/mechanic/standard/trucks` | 5 · Trucks | `Input type="search"` con `Label` visible, filtra al escribir | completo |

No hay librería de formularios ni validación de esquema: cada formulario guarda su estado con `useState` y valida deshabilitando el botón.

## Hallazgos

### Sistémicos

### UX-7-001 · Los campos de nota no tienen etiqueta visible
- **Dónde:** Notas · `apps/web/src/components/work-order-notes-thread.tsx:71-75` (`Label className="sr-only"` y `placeholder`); nota al bloqueo · `apps/web/src/app/work-orders/[id]/detail-client.tsx:304-307` (`aria-label` y `placeholder`)
- **Evidencia:** `evidencia/01-detalle-605.jpg` (observado): dentro del bloqueo, un campo con "For example: the part arrived." y el botón "Add note to blocker"; en Notas, "Write a note, or describe additional work the Truck needs". Al escribir, el texto de ayuda desaparece y queda un campo sin nombre.
- **Criterio:** etiquetas y ayuda (el placeholder no es etiqueta)
- **Severidad:** 1 · Cada campo está solo en su sección y el botón dice qué hace; no confunde, pero con el teclado abierto en el teléfono el título de la sección queda fuera de la vista.
- **Recomendación:** etiqueta visible encima de cada campo: "Note for the Manager" en el bloqueo y "Note or work request" en Notas (ES "Nota para el Manager", "Nota o pedido de trabajo"); el ejemplo puede quedar como placeholder.
- **Esfuerzo:** S

### UX-7-002 · La nota de cierre y la del bloqueo se borran al cerrar el diálogo
- **Dónde:** `detail-client.tsx:404` (abrir "Complete job" pone `setFinishNotes('')`), `:492-496` (cerrar también la vacía) y `:419-420` (abrir "Report Blocker" vacía motivo y detalle)
- **Evidencia:** pasos (observado): 1) Complete job en 604, 2) escribir "Replaced the leaking air line fitting at the rear axle.", 3) Esc (o tocar fuera de la hoja), 4) Complete job otra vez → el campo está vacío (`note after reopen: ""`). Con la sesión vencida pasa lo mismo y además vuelve al inicio (UX-6-008).
- **Criterio:** valores por defecto y persistencia (lo escrito no se pierde)
- **Severidad:** 2 · Un toque fuera de la hoja, de pie y con una mano, borra lo que el Manager iba a leer. La nota de cierre es opcional, así que el mecánico tiende a no reescribirla.
- **Recomendación:** guardar el borrador por Job mientras la pantalla siga abierta (y en `sessionStorage` para UX-6-008); limpiarlo solo al enviar con éxito.
- **Esfuerzo:** S

### Report Blocker

### UX-7-003 · Report Blocker solo deja escribir una nota cuando el motivo es "Other"
- **Dónde:** `detail-client.tsx:594-607` (el `Textarea` solo se muestra con `PauseReason.OTHER`)
- **Evidencia:** `evidencia/07-bloqueo-dialogo.jpg` (observado): con "Waiting for Parts" la hoja tiene el motivo y los botones, nada más. HU-ME3 dice "elige el motivo, nota opcional", y el bloqueo de la demo en 605 sí trae una nota inicial ("Falta la bolsa de aire trasera del lado del conductor.").
- **Criterio:** estructura (pedir lo necesario en el momento en que se sabe) · Nielsen H2
- **Severidad:** 2 · Para decir qué pieza falta, el mecánico reporta y después busca "Add note to blocker" en la sección de bloqueos; el Manager recibe primero un bloqueo sin detalle.
- **Recomendación:** el campo "What is missing? (optional)" siempre visible debajo del motivo; obligatorio solo con "Other".
- **Esfuerzo:** S

### UX-7-004 · Con "Other" y sin detalle, "Report Blocker" queda gris sin decir por qué
- **Dónde:** `detail-client.tsx:609` (la ayuda solo se muestra si no hay motivo) y `:622` (el botón también se deshabilita con "Other" y el detalle vacío)
- **Evidencia:** `evidencia/07-bloqueo-otro-vacio.jpg` (observado). Al elegir "Other" desaparece "Choose a reason to report the blocker." y aparece un campo "Additional details" con el placeholder "Reason required for Other". El botón sigue gris; lo único que explica por qué es el placeholder, que se va al empezar a escribir.
- **Criterio:** botones y envío (botón primario deshabilitado sin explicación)
- **Severidad:** 2 · Pasa cada vez que el motivo no está en la lista; el mecánico toca el botón gris y no pasa nada.
- **Recomendación:** dejar el botón activo y, al tocarlo vacío, mostrar debajo del campo "Say what is stopping you." (ES "Di qué te detiene."); etiqueta "What is stopping you?" en lugar de "Additional details".
- **Esfuerzo:** S

### UX-7-005 · El motivo del bloqueo es un select nativo de 7 opciones
- **Dónde:** `detail-client.tsx:579-592` (`<Select>` con "Select an option" y `MECHANIC_BLOCKER_REASONS`)
- **Evidencia:** `evidencia/07-bloqueo-dialogo.jpg` (observado). Las opciones: Waiting for Parts, Approval, Vendor, Equipment / Tool, Bay, Driver, Other. En el teléfono el select abre la rueda o la lista del sistema: un toque para abrir, scroll, un toque para elegir y otro para cerrar, sin ver las opciones antes.
- **Criterio:** tipo de entrada (opciones fijas y pocas: visibles, una por toque) y móvil
- **Severidad:** 2 · Es el formulario de J8, que se usa con prisa y a veces con guantes; tres o cuatro toques en lugar de uno.
- **Recomendación:** lista de opciones visibles (radio grandes de 44 px o chips) en la misma hoja, con "Waiting for Parts" primero; "Other" al final abre el campo.
- **Esfuerzo:** S

### Notas / Request Work

### UX-7-006 · Nota y Request Work comparten el campo, el primario es Request Work y lo enviado no se corrige
- **Dónde:** `work-order-notes-thread.tsx:83-99` ("Add Note" `secondary`, "Request Work" primario; los dos envían el mismo texto)
- **Evidencia:** `evidencia/07-pedir-trabajo-enviado.jpg` (observado): el texto se escribe y después se elige qué es. Request Work llega al Dashboard del Manager ("Waiting for Manager"); una nota no. Las notas solo se agregan (D8): un pedido enviado como nota no se puede convertir.
- **Criterio:** prevención de errores (la acción más visible no es la más frecuente) · Nielsen H5
- **Severidad:** 2 · Si el mecánico pide trabajo con "Add Note", el Manager no lo ve en su cola y el Job no se agrega; si avisa algo con "Request Work", ensucia la cola del Manager.
- **Recomendación:** dos entradas separadas: "Add note" como acción principal de la sección y "Request work" como botón con su propia hoja ("What does the Truck need?"), que explica que llega al Manager.
- **Esfuerzo:** S

### Buscar unidad

### UX-7-007 · Buscar unidad abre el teclado de letras para un número
- **Dónde:** `apps/web/src/components/mechanic-trucks-page.tsx:37-44` (`type="search"`, sin `inputMode`)
- **Evidencia:** (inferido del código) el placeholder pide "Truck number, e.g. 905"; sin `inputMode="numeric"` el teléfono abre el teclado completo.
- **Criterio:** tipo de entrada y móvil (teclado adecuado por campo)
- **Severidad:** 1 · Un cambio de teclado por búsqueda.
- **Recomendación:** `inputMode="numeric"` si los números de camión son solo dígitos (en la demo lo son: 601–968); si no, dejarlo como está.
- **Esfuerzo:** S

## Lo que funciona bien
- **Sin doble envío:** Start, Continue, Complete job, Report Blocker, nota al bloqueo y Notas se deshabilitan y cambian de texto mientras envían ("Starting…", "Completing…", "Reporting…", "Saving…") (`evidencia/01-iniciar-desde-lista.jpg`, `evidencia/07-completar-enviando.jpg`).
- **Los diálogos conservan lo escrito ante un error del servidor o sin conexión** y muestran el error dentro de la hoja (`evidencia/06-completar-error.jpg`).
- **Botones táctiles de 44 px** en el teléfono (medido en modo táctil; 36 px solo con mouse, `apps/web/src/components/ui.tsx:27`) y campos de texto a 16 px (no hacen zoom en iOS).
- **Las hojas cierran con Esc y devuelven el foco** al botón que las abrió (`returnFocusRef`, `detail-client.tsx:497` y `:572`).
- **La nota al bloqueo usa `<form onSubmit>`** y su botón se activa solo con texto; el borrador vive por bloqueo (`noteDrafts`).

## Fuera de alcance / no verificado
- **Teclado físico y orden de Tab:** no se recorrió (skill 2).
- **Nota al bloqueo con error del servidor:** no se provocó; usa el mismo `run` que Complete job.
- **iOS real:** el select nativo y el teclado se describieron por el comportamiento del sistema, no se probaron en un iPhone.
