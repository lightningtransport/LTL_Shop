# 07 · Formularios e interacción — Lightning Shop, pantallas del Mecánico de PM

**Fecha:** 2026-10-07 · **Alcance:** formularios del Mecánico de PM (Create PM service, millaje y piezas, Service type, Finish, Report Blocker, notas), teléfono 375 px, inglés y español · **Método:** código + navegador (demo local, WO-016 de Daniel; los errores se probaron sin terminar el PM)
**Resumen:** 9 hallazgos, 1 de severidad 3. Las reglas del millaje están todas (menor, salto, vacío, al menos una pieza), pero **la pantalla muestra datos que no están guardados**: con un salto sin confirmar, las piezas que elige no se guardan y nada lo dice; al borrar el campo se guarda vacío; las notas no se guardan solas como dice HU-PM1. El aviso de millaje menor sale desde el primer dígito.

## Inventario de formularios

| Formulario | Ruta | Flujo | Patrón | Revisado |
|---|---|---|---|---|
| Create PM service (buscar camión + crear) | `/mechanic/pm/new` | 2 · Empezar | combobox propio + botón fijo abajo, `useState` | completo |
| Millaje observado + piezas (guardado automático) | `/work-orders/[id]?view=pm` | 1 · Registrar | `useState` + cola de guardado a los 600 ms (`pm-service-card.tsx:143-147`) | completo |
| Service type (PM A ↔ PM B) | detalle del PM | 1 · Registrar | `<select>` que guarda al cambiar | completo |
| Finish (hoja de confirmación) | detalle del PM | 1 · Registrar | `Modal` | abrir y cancelar |
| Report Blocker | detalle del PM | 4 · Avisar | `Modal` con select + texto si "Other" | abrir, validar vacío, Esc |
| Notas (Add Note / Request Work) | detalle del PM | 4 · Avisar | `WorkOrderNotesThread` | escribir y salir |
| Nota en un bloqueo | detalle del PM bloqueado | 4 · Avisar | `<form onSubmit>` | código (no hay bloqueo en la demo) |

## Hallazgos

### Sistémicos

### UX-7-001 · Lo escrito que no se envió se pierde al salir, sin aviso
- **Dónde:** notas · `apps/web/src/components/work-order-notes-thread.tsx:25` (`useState('')`); millaje y piezas sin guardar · `pm-service-card.tsx:50-51`; motivo del bloqueo · `pm-job-detail.tsx:42-43`. No hay `beforeunload` en `apps/web/src` (grep: 0 resultados).
- **Evidencia:** pasos (observado): 1) en WO-016 escribir en Notas "Left rear tire worn, check next visit", 2) tocar la flecha atrás, 3) volver con el botón atrás del navegador → el campo está vacío. No se mostró ningún aviso. HU-PM1 paso 3 dice "Las notas se guardan solas"; en la pantalla se publican con "Add Note".
- **Criterio:** persistencia de lo escrito (criterio 4) · Nielsen H3
- **Severidad:** 2 · Daniel escribe con el teléfono en la mano y sale para buscar algo (historial, otra pestaña); al volver, la nota no está.
- **Recomendación:** guardar el borrador de la nota y del formulario del PM por WO en `localStorage` y restaurarlo al volver; si queda algo sin enviar, avisar al salir. Decidir con el dueño si la nota del PM se guarda sola (ver `00-contexto.md` §7) y alinear `USER_FLOWS.md`.
- **Esfuerzo:** S

### Millaje observado

### UX-7-002 · "No puede ser menor" aparece desde el primer dígito y esconde las piezas mientras escribe
- **Dónde:** `pm-service-card.tsx:90-94` (valida en cada tecla) y `:182` (`showParts` falso si es menor)
- **Evidencia:** `evidencia/07-error-al-escribir.jpg` (observado). Al escribir "21" de "215000" ya sale en rojo "Observed mileage cannot be lower than the truck's current mileage (210,000 mi). Check the odometer.", y las nueve categorías de piezas desaparecen; vuelven al llegar al sexto dígito. Con un valor menor completo (200000), el mismo mensaje (`evidencia/07-millaje-menor.jpg`).
- **Criterio:** validación: cuándo (no marcar error mientras se escribe por primera vez)
- **Severidad:** 2 · Pasa en cada PM al corregir el millaje: cada tecla le dice que está mal y la pantalla salta.
- **Recomendación:** validar al salir del campo (`onBlur`) o con 600 ms sin teclear, como el guardado; mantener las piezas visibles mientras se escribe.
- **Esfuerzo:** S

### UX-7-003 · Borrar el campo guarda el millaje vacío y esconde las piezas
- **Dónde:** `pm-service-card.tsx:29` (vacío → `observedMileage: null`) y `packages/shared/src/pm-mileage.ts:16-17` (`null` pasa la validación)
- **Evidencia:** `evidencia/07-millaje-borrado.jpg` (observado). Al borrar 210,000 y salir del campo, sale "Saved automatically" (dos veces) y "Enter the observed mileage to record parts used."; al recargar, el campo está vacío en la base. Las piezas ya elegidas quedan guardadas pero dejan de verse.
- **Criterio:** prevención de errores en el valor por defecto y la persistencia (criterio 4) · Nielsen H5
- **Severidad:** 2 · Borrar para reescribir es lo normal en el teléfono; si en ese momento sale de la pantalla, el millaje que ya había anotado se pierde.
- **Recomendación:** no guardar el campo vacío si había un millaje guardado; mostrar "Enter the mileage" junto al campo sin borrar lo anterior hasta tener un número válido.
- **Esfuerzo:** S

### UX-7-004 · Con un salto sin confirmar, las piezas que elige no se guardan y nada lo dice
- **Dónde:** `pm-service-card.tsx:137-138` (`persist` sale sin guardar si el salto no está confirmado) y `:182` (las piezas sí se muestran)
- **Evidencia:** `evidencia/07-salto-millaje.jpg` (observado). Pasos: 1) escribir 300,000 (camión en 210,000) → aviso ámbar con "Confirm mileage" y las piezas a la vista, 2) elegir una pieza → no aparece "Saving…" ni "Saved", ni error, 3) recargar → millaje 210,000 y sin pieza.
- **Criterio:** validación: cómo se muestra (no hay error invisible) · Nielsen H1 y H9
- **Severidad:** 3 · Pasa con un dedazo (un cero de más) y Daniel sigue eligiendo piezas porque la pantalla se lo permite; pierde todo sin aviso, y solo lo nota si Finish sigue gris.
- **Recomendación:** mientras el salto no esté confirmado, desactivar las piezas con el texto "Confirm the mileage first"; o guardar las piezas aunque el millaje espere confirmación. Poner "Confirm mileage" como botón principal del aviso.
- **Esfuerzo:** S

### Piezas

### UX-7-005 · Nueve selects nativos, uno por categoría, todos en "No part used"
- **Dónde:** `pm-service-card.tsx:260-294`
- **Evidencia:** `evidencia/01-detalle-pm-en-curso.jpg` (observado). Para marcar una pieza hay que abrir el select de su categoría y leer códigos como "WF10678 — Freightliner Short Fuel Filter"; Fuel Filter tiene 13 opciones. No se puede marcar dos piezas de la misma categoría. Para ver qué marcó hay que recorrer las nueve.
- **Criterio:** tipo de entrada y estructura (criterios 1 y 3) · Nielsen H7 (eficiencia)
- **Severidad:** 2 · Es la tarea de cada PM; funciona, pero cuesta más toques y lectura de lo necesario.
- **Recomendación:** lista de categorías con interruptor ("Oil filter changed") y, al activarla, la pieza más usada para ese modelo ya elegida; el select queda para cambiarla. Con un resumen "1 part" arriba (UX-4-003).
- **Esfuerzo:** M

### Finish

### UX-7-006 · Finish gris con un requisito fijo, aunque lo que falte sea otra cosa
- **Dónde:** `apps/web/src/components/pm-job-detail.tsx:59` (`finishBlocked` junta 7 condiciones) y `:153-154` · texto `apps/web/src/lib/locale-context.tsx:581`
- **Evidencia:** (observado) "Finish requires a saved observed mileage and at least one part." aparece igual sin pieza, sin red con pieza elegida (`evidencia/06-sin-conexion.jpg`), con el salto sin confirmar y mientras carga el PM. En ningún caso dice cuál de las condiciones falta.
- **Criterio:** botones y envío: botón primario desactivado sin decir por qué
- **Severidad:** 2 · En el caso común (falta la pieza) el texto es correcto; en los demás, Daniel revisa millaje y piezas y no entiende por qué no puede terminar.
- **Recomendación:** un texto por causa: "Add at least one part", "Confirm the mileage above", "Waiting to save… (offline)", "Blocked · waiting for the Manager".
- **Esfuerzo:** S

### UX-7-007 · La confirmación de Finish no muestra lo que queda registrado
- **Dónde:** `pm-job-detail.tsx:230-236` · texto `locale-context.tsx:673`
- **Evidencia:** `evidencia/07-confirmar-finish.jpg` (observado). Con el millaje igual al del camión, la hoja dice solo "This will complete the PM service." con "Cancel" y "Finish Work". Si el millaje cambia, dice "This will update the truck mileage from … to …" (inferido del código). Nunca lista las piezas. Después, el PM es solo lectura.
- **Criterio:** acciones con consecuencias: resumen antes de confirmar (criterio 11)
- **Severidad:** 2 · Es el último momento para ver un error (pieza equivocada, millaje) antes de que quede fijo; corregirlo después depende del Admin.
- **Recomendación:** "Finish PM A on Truck 968? Mileage 210,000 mi · Parts: Oil Filter 1 Unit — 21707132" y "Finish PM".
- **Esfuerzo:** S

### Create PM service

### UX-7-008 · Textos fijos en inglés en la búsqueda de camión
- **Dónde:** `apps/web/src/app/work-orders/new/page.tsx:335` y `:418`
- **Evidencia:** `evidencia/07-busqueda-es.jpg` (observado, en español): al buscar "57", "No truck starts with #57. Showing numbers that contain it." en inglés, debajo de "WO-010 abierto". La línea 418 ("Truck #… already has an open Work Order assigned to another mechanic.") también está escrita en el componente (inferido del código).
- **Criterio:** etiquetas y ayuda en el idioma del usuario
- **Severidad:** 2 · La app es bilingüe por decisión; el mensaje que explica la búsqueda sale en el otro idioma.
- **Recomendación:** mover los dos textos a `locale-context.tsx` (EN/ES), por ejemplo "Ningún número empieza con #57. Se muestran los que lo contienen.".
- **Esfuerzo:** S

### Report Blocker

### UX-7-009 · "Report Blocker" queda gris hasta elegir el motivo, sin decirlo
- **Dónde:** `pm-job-detail.tsx:216`
- **Evidencia:** `evidencia/07-reportar-bloqueo.jpg` (observado). La hoja abre con "Select an option" y el botón "Report Blocker" desactivado; con "Other" sigue gris hasta escribir algo.
- **Criterio:** botones y envío: botón primario siempre habilitado, errores al enviar
- **Severidad:** 1 · Son dos campos y se deduce, pero el botón gris no dice qué falta.
- **Recomendación:** botón activo; al tocar sin motivo, "Choose a reason" junto al select; con "Other" vacío, "Say what is stopping you".
- **Esfuerzo:** S

## Lo que funciona bien
- **Teclado numérico y formato:** el millaje usa `inputMode="numeric"`, quita lo que no es número y muestra miles con coma (210,000) mientras se escribe; 16 px, sin zoom en iPhone.
- **Las tres reglas del millaje están en la pantalla** y coinciden con la API: menor (no deja), salto > 50 000 (pide confirmar), vacío (no deja terminar).
- **Guardado automático con cola:** no pisa lo que se está escribiendo cuando SWR recarga (`pm-service-card.tsx:70-71`) y guarda la última versión.
- **Create PM service:** búsqueda con flechas y Enter, aviso de "Open WO-0xx" en cada resultado, "Checking truck…" mientras consulta y el botón fijo abajo, siempre a la vista.
- **Finish y Report Blocker piden confirmación en una hoja** con "Cancel" a la izquierda y la acción a la derecha; se cierran con Esc y no se pueden pulsar dos veces.

## Fuera de alcance / no verificado
- **Finish con éxito** y con error del servidor: no se terminó ningún PM (ver `00-contexto.md` §3).
- **Nota dentro de un bloqueo:** no hay PM bloqueado en la demo; el formulario usa `onSubmit` y se ve bien en el código (`pm-job-detail.tsx:168-183`).
- **Teclado físico y lector de pantalla:** skill 2.
- **Teclado virtual tapando el campo:** Playwright no abre el teclado del teléfono.
