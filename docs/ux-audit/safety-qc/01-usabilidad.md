# 01 · Fundamentos de usabilidad — Lightning Shop, pantalla de Safety (Quality Check)

**Fecha:** 2026-10-07 · **Alcance:** `/qc` con Safety 1 y Safety 2 (flujos 1–3 del contexto), teléfono 375 px y computadora 1366 px · **Método:** código + navegador (demo local `ltl_shop_demo`, recorrido con Playwright)
**Resumen:** 9 hallazgos, 3 de severidad 3. El patrón dominante es que **Safety decide sin ver lo que va a aprobar**: la tarjeta solo trae nombres de Jobs y de mecánicos, y la decisión irreversible (Approve) es un toque. Lo demás son salidas que faltan (soltar un camión, recuperar lo escrito) y un orden de lista que no refleja la urgencia.

**Inventario recorrido:**

| Flujo | Pantalla / estado | Cómo se llegó |
|---|---|---|
| 1 · Revisar y aprobar | `/qc` lista → Take → Approve | Safety 1, WO-006 (Truck 606) de la demo |
| 2 · Devolver | `/qc` → Return (diálogo) → nota vacía, Esc, reabrir | Safety 1 |
| 3 · Qué tomó la otra persona / qué espera al Manager | `/qc` con Safety 2 mientras Safety 1 tiene el camión; sección "Returned" | Safety 2 |

## Hallazgos

### Flujo 1 · Revisar y aprobar

### UX-1-001 · Safety no ve qué se le hizo al camión que va a aprobar
- **Dónde:** `/qc`, tarjeta del camión · `apps/web/src/components/quality-check-page.tsx:92-97` · API `apps/api/src/quality-check/quality-check.service.ts:66-77` (solo manda `doneJobs` y `mechanics` como nombres)
- **Evidencia:** `evidencia/01-list.jpg` (observado). La tarjeta de 606 dice "Detailing, Alignment, PM A Service · Work by Alejandro 2, Alejandro 1, Daniel" y nada más: ni la nota de cierre de cada Job, ni quién hizo cuál, ni el millaje y las piezas del PM, ni la inspección, ni los bloqueos que tuvo, ni dónde está el camión en el patio. No hay ningún enlace a más detalle (Safety no puede abrir el Truck ni la WO, QC4).
- **Criterio:** Nielsen H6 (reconocer antes que recordar) y H1 (visibilidad del estado)
- **Severidad:** 3 · Cada revisión (frecuencia alta); para saber qué mirar Safety tiene que buscar al mecánico o al Manager (impacto alto); no se aprende a esquivar.
- **Recomendación:** una vista de revisión por camión con Jobs (quién, cuándo, nota de cierre), PM (millaje y piezas), inspección, bloqueos resueltos, devoluciones anteriores y ubicación. Necesita `GET /qc/:workOrderId` (propuesta §5).
- **Esfuerzo:** M

### UX-1-002 · Approve es un toque y no se puede deshacer
- **Dónde:** botón Approve · `quality-check-page.tsx:103`
- **Evidencia:** pasos (observado): 1) Take en 606, 2) tocar Approve → el camión desaparece de la lista y sale el toast "Truck 606 approved". No hubo diálogo (`dialog after approve click: false`). `evidencia/01-after-approve.jpg`. Safety no tiene forma de revertirlo; Approve queda pegado a Return, que es el otro resultado posible.
- **Criterio:** Nielsen H5 (prevención de errores) y H3 (control y libertad)
- **Severidad:** 3 · Aprobar deja el camión listo para cerrar y salir; un toque por error en el patio (guantes, teléfono en una mano) no se puede corregir desde Safety.
- **Recomendación:** confirmar en una hoja corta: "Approve Truck 606? The Manager can then close WO-006." con "Back" y "Approve". Lo mismo que D27 pide para cerrar (propuesta D-QC1).
- **Esfuerzo:** S

### UX-1-003 · La lista ordena por la creación de la WO, no por urgencia
- **Dónde:** `quality-check.service.ts:53` (`orderBy: { createdAt: 'asc' }`)
- **Evidencia:** (inferido del código). El orden es el de apertura de la WO, no el de "listo desde" (el texto "ready 18 h" que se muestra), ni la prioridad, ni la salida que pide Dispatch. La tarjeta no muestra prioridad ni salida.
- **Criterio:** Nielsen H7 (flexibilidad y eficiencia) y H1
- **Severidad:** 2 · Con 1–3 camiones en la lista se ve todo; con más, un camión Critical o que sale hoy puede quedar abajo sin que nada lo distinga.
- **Recomendación:** ordenar sale pronto (Dispatch) → Critical/High → más tiempo listo, y mostrar prioridad y salida en la tarjeta (propuesta D-QC5).
- **Esfuerzo:** M

### UX-1-004 · Después de aprobar no hay forma de comprobar qué se aprobó
- **Dónde:** `/qc` después de Approve · `quality-check-page.tsx:56` (solo un toast)
- **Evidencia:** `evidencia/01-after-approve.jpg` (observado). El camión sale de la lista; la única confirmación es el toast, que desaparece. No hay historial de lo aprobado o devuelto por Safety.
- **Criterio:** Nielsen H1 (visibilidad del estado) y H6
- **Severidad:** 2 · Safety no puede responder "¿ya revisé el 606?" ni ver qué aprobó la otra persona; lo completa preguntando.
- **Recomendación:** pestaña "Done" con lo aprobado y devuelto hoy y los últimos 7 días (propuesta D-QC6, `GET /qc/history`).
- **Esfuerzo:** M

### Flujo 2 · Devolver

### UX-1-005 · Al devolver no se puede decir qué Job falló
- **Dónde:** diálogo Return · `quality-check-page.tsx:147-179`
- **Evidencia:** `evidencia/01-return-empty-error.jpg` (observado). Solo hay un campo de texto libre.
- **Criterio:** Nielsen H6 y H2 (correspondencia con el mundo real: Safety encuentra el defecto en un trabajo concreto)
- **Severidad:** 2 · El Manager lee la nota y tiene que deducir a qué Job pertenece para agregar el trabajo.
- **Recomendación:** chips opcionales con los Jobs hechos más "Other" encima de la nota; guardar el `jobId` en el bloqueo (propuesta D-QC3).
- **Esfuerzo:** M

### UX-1-006 · Cerrar el diálogo de devolver borra lo escrito
- **Dónde:** `quality-check-page.tsx:111` (abrir pone `setNote('')`) y `:151`
- **Evidencia:** pasos (observado): 1) Return, 2) escribir "Rear brake hose leaking", 3) Esc, 4) Return otra vez → el campo está vacío (`textarea after reopen: ""`).
- **Criterio:** Nielsen H3 (control y libertad) y H9 (conservar lo que escribió el usuario)
- **Severidad:** 2 · Un Esc o un toque fuera de la hoja hace perder la descripción, que se escribe en el teléfono, de pie.
- **Recomendación:** conservar el borrador por camión mientras la pantalla siga abierta; limpiarlo solo al devolver con éxito.
- **Esfuerzo:** S

### Flujo 3 · Lo que tomó la otra persona y lo devuelto

### UX-1-007 · Un camión tomado no se puede soltar
- **Dónde:** tarjeta "Taken by me" · `quality-check-page.tsx:101-115`. La API no tiene `release` (`apps/api/src/quality-check/`).
- **Evidencia:** `evidencia/01-taken.jpg` y `evidencia/01-other-sees-taken.jpg` (observado). Safety 1 solo tiene Approve y Return; Safety 2 ve "Taken by Safety 1" sin poder hacer nada.
- **Criterio:** Nielsen H3 (salida de emergencia)
- **Severidad:** 3 · Si Safety 1 toma un camión y termina el turno, el camión queda trabado hasta que el Manager reasigne el QC; nadie en la pantalla lo puede destrabar.
- **Recomendación:** "Let go" en el menú de la revisión, que deja el QC libre y queda en el Activity Log (propuesta D-QC2).
- **Esfuerzo:** S

### UX-1-008 · El camión de otra persona muestra un botón "Take" apagado
- **Dónde:** `quality-check-page.tsx:117` (`disabled={... || !!takenByOther}`)
- **Evidencia:** `evidencia/01-other-sees-taken.jpg` (observado). Debajo de "Taken by Safety 1" hay un botón gris de ancho completo "Take".
- **Criterio:** Nielsen H4 (consistencia) y H8 (minimalismo)
- **Severidad:** 1 · Se entiende con la etiqueta, pero el botón parece tocable y no dice por qué no responde.
- **Recomendación:** sin botón; atenuar la tarjeta y dejar solo "Taken by Safety 1" con su avatar.
- **Esfuerzo:** S

### UX-1-009 · Los Jobs y los mecánicos cambian de orden entre una carga y otra
- **Dónde:** `quality-check.service.ts:35` (`orderBy: { addedAt: 'asc' }`, sin desempate)
- **Evidencia:** (observado) el mismo camión, en dos cargas seguidas: "Detailing, Alignment, PM A Service · Work by Alejandro 2, Alejandro 1, Daniel" y luego "PM A Service, Detailing, Alignment · Work by Daniel, Alejandro 2, Alejandro 1". Los Jobs agregados juntos tienen el mismo `addedAt`.
- **Criterio:** Nielsen H4 (consistencia)
- **Severidad:** 1 · Desorienta al volver a mirar la tarjeta, sin impedir nada.
- **Recomendación:** desempatar por el orden del flujo (PM primero) o por `id`; mejor aún, una fila por Job con su mecánico (UX-1-001).
- **Esfuerzo:** S

## Lo que funciona bien
- **Take responde al instante** (Q1 arreglado en #250): el botón se deshabilita al tocarlo y en ~100 ms aparecen Approve y Return (`evidencia/01-taken.jpg`). Antes la lista no cambiaba (`evidencia/01-q1-lista-sin-cambiar.jpg`).
- **Return no deja enviar sin nota** y lo dice junto al campo: "Say what you found first." (`evidencia/01-return-empty-error.jpg`).
- **Dos personas en la misma lista no chocan:** la otra persona ve "Taken by Safety 1" (QC2) y la lista se refresca cada 20 s.
- **Los botones se deshabilitan mientras corre una acción** (`busy`), así que no hay doble envío.
- El diálogo de devolver cierra con Esc y devuelve el foco al botón que lo abrió (`returnFocusRef`).

## Fuera de alcance / no verificado
- **"Returned" con datos:** no se devolvió un camión en este recorrido para no gastar el único camión de la demo; se vio en la revisión de Q1 (lista con la nota y "waiting for the Manager").
- **Producción:** no se abrió `/qc` con la cuenta de Safety real; queda para cuando el dueño inicie sesión.
- **Sin conexión:** no probado (skill 6/8).

## Para otras skills
- Skill 3: el texto de ejemplo del campo ("Leak in the rear brake hose") se lee como una respuesta ya escrita; mejor "E.g. …". "ready 0 min ago" debería ser "ready just now".
- Skill 4: la tarjeta no tiene jerarquía (todo es texto gris del mismo peso; el estado "tomado" es solo un borde y un chip) y en computadora la pantalla usa 560 px de 1366 (`evidencia/01-desktop.jpg`).
- Skill 6: el estado vacío no dice cuándo llegan camiones ni ofrece nada (`evidencia/01-desktop.jpg`).
