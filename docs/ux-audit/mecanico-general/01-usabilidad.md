# 01 · Fundamentos de usabilidad — Lightning Shop, pantallas del Mecánico General (Standard)

**Fecha:** 2026-10-07 · **Alcance:** `/mechanic/standard`, `/mechanic/standard/trucks`, `/mechanic/standard/completed`, `/mechanic/standard/new` y `/work-orders/[id]` con Anthony (flujos 1–5 del contexto), teléfono 375 px y computadora 1366 px · **Método:** código + navegador (demo local `ltl_shop_demo`, recorrido con Playwright)
**Resumen:** 11 hallazgos, 1 de severidad 3. El patrón dominante es que **el mecánico no ve dónde corre su reloj**: el inicio solo avisa cuando el reloj se detuvo, Start en la lista cierra el reloj de otro camión sin decirlo, el aviso puede decir que el reloj "se movió" cuando no corre en ninguno, y el tiempo del detalle suma el de todos. El resto son tarjetas que no separan lo que se puede hacer de lo que espera al Manager y detalles de Trucks y Completed.

**Inventario recorrido:**

| Flujo | Pantalla / estado | Cómo se llegó |
|---|---|---|
| 1 · Ver lo que me toca y dónde corre el reloj | `/mechanic/standard` antes y después de Start en otro camión | Anthony: WO-004 en curso, WO-005 bloqueado, WO-012 y WO-013 listos |
| 2 · Trabajar y terminar | `/work-orders/[id]` WO-004: Continue → Complete job (nota) → "You finished your part" | Anthony |
| 3 · Avisar que algo me detiene | WO-005 (bloqueo de la demo) y WO-012 (Report Blocker "Waiting for Parts") | Anthony |
| 4 · Notas y pedir trabajo | WO-004: Request Work | Anthony |
| 5 · Buscar una unidad y ver lo hecho | `/mechanic/standard/trucks` (604, "zzzz"), historial, `/mechanic/standard/completed`, `/mechanic/standard/new` | Anthony |

## Hallazgos

### Flujo 1 · Ver lo que me toca y dónde corre el reloj

### UX-1-001 · El inicio no dice en qué camión corre el reloj
- **Dónde:** `/mechanic/standard`, tarjetas de "In Progress" · `apps/web/src/app/page.tsx:322-331` (solo hay aviso cuando el reloj se **detuvo**: blocker resuelto o `myClockStopped`)
- **Evidencia:** `evidencia/01-inicio-tras-cambio.jpg` (observado). Después de Start en Truck 922, la tarjeta de 922 (reloj corriendo) es igual a las demás: "In Progress", "View Work". Solo 604 lleva el aviso "Your clock is on Truck 922 · tap Continue". En `evidencia/01-inicio.jpg` (antes del cambio) ninguna tarjeta dice dónde corre el reloj. Para saberlo hay que abrir cada camión y leer "Labor time: … · running".
- **Criterio:** Nielsen H1 (visibilidad del estado del sistema) y H6 (reconocer antes que recordar)
- **Severidad:** 3 · Cada vez que abre la app (frecuencia alta). El reloj corre en un solo camión (D21) y se cierra solo a las 5:00 (D20); si el mecánico cree que su reloj corre y no corre, su tiempo no queda registrado, que es lo que pide J7. No se aprende a esquivar sin abrir cada camión.
- **Recomendación:** una franja fija arriba del inicio con el estado del reloj: "Your clock · Truck 922 · since 10:45" (con punto verde) o "Your clock is stopped · tap Continue on a Truck". En la tarjeta del camión donde corre, una marca "Clock running". En ES: "Tu reloj · Unidad 922 · desde 10:45" / "Tu reloj está detenido".
- **Esfuerzo:** M (la lista necesita saber dónde corre la sesión abierta del mecánico; hoy el detalle ya lo sabe con `laborRunning`)

### UX-1-002 · Start Work en la lista cierra el reloj de otro camión sin decirlo
- **Dónde:** botón "Start Work" de "Ready to Start" · `page.tsx:414-421` (`POST /start` y `router.push` al detalle)
- **Evidencia:** pasos (observado): 1) reloj corriendo en 604, 2) tocar "Start Work" en Truck 922 → el botón dice "Starting…" (`evidencia/01-iniciar-desde-lista.jpg`) y abre 922 con el toast "Work started.", 3) volver al inicio → 604 dice "Your clock is on Truck 922 · tap Continue" (`evidencia/01-inicio-tras-cambio.jpg`). En ningún momento la app dice que el reloj de 604 se cerró.
- **Criterio:** Nielsen H1 (visibilidad del estado) y H5 (avisar antes de una consecuencia)
- **Severidad:** 2 · La regla es correcta (D21); lo que falla es que el mecánico no se entera en el momento. Lo descubre al volver a 604. No pierde tiempo registrado, pero no sabe que tiene que volver a tocar Continue.
- **Recomendación:** si el reloj corre en otro camión, el toast de inicio lo dice: "Clock moved from Truck 604 to Truck 922." (ES: "Tu reloj pasó de la unidad 604 a la 922."). No hace falta confirmar.
- **Esfuerzo:** S (la respuesta de `start` puede traer el camión anterior)

### UX-1-003 · "Your clock moved to another Truck" cuando el reloj no corre en ningún camión
- **Dónde:** `apps/api/src/work-orders/work-order.mapper.ts:202-203` (si no hay reloj abierto en otro lado, `elsewhereWorkOrder` es `null`) y `apps/web/src/lib/clock-stopped.ts:17-19` (con `null` usa `clockSwitchedTapContinue`, `locale-context.tsx:447`)
- **Evidencia:** `evidencia/01-reloj-movido.jpg` (observado). Pasos: 1) Start en 922 y luego Continue en 604 (el reloj de 922 se cierra por cambio de camión), 2) completar el último Job de 604 → el reloj se detiene (D18), 3) el inicio dice en 922 "Your clock moved to another Truck · tap Continue". No corre en ninguno.
- **Criterio:** Nielsen H1 (visibilidad del estado) y H2 (el mensaje no corresponde con lo que pasó)
- **Severidad:** 2 · Pasa cada vez que el mecánico termina su parte en un camión después de haber cambiado (frecuente con D21). El mensaje le hace creer que su tiempo corre en otro lado.
- **Recomendación:** con `elsewhereWorkOrder: null`, decir "Your clock is stopped · tap Continue" (ES: "Tu reloj está detenido · toca Continuar").
- **Esfuerzo:** S

### UX-1-004 · El aviso dice "tap Continue" y el botón de la tarjeta dice "View Work"
- **Dónde:** `page.tsx:326-330` (aviso) y `:394` (botón `viewWork` en tarjetas activas)
- **Evidencia:** `evidencia/01-inicio-tras-cambio.jpg` (observado). La tarjeta de 604 dice "Your clock is on Truck 922 · tap Continue" y su único botón es "View Work". Hay que abrir el camión y buscar "Continue" debajo de "Work Options" (`evidencia/01-604-reloj-en-otro.jpg`).
- **Criterio:** Nielsen H4 (consistencia: el texto nombra una acción que no está) y H7 (eficiencia)
- **Severidad:** 2 · Un toque y una búsqueda de más cada vez que vuelve a un camión; también al día siguiente ("Yesterday's work is still open · tap Continue", D20).
- **Recomendación:** cuando la tarjeta tiene aviso de reloj detenido, el botón dice "Continue" y hace lo mismo que "Start Work" en la lista (inicia y abre el detalle).
- **Esfuerzo:** S (reutilizar `StartWorkAction`)

### UX-1-005 · Un camión donde solo me queda un Job bloqueado sigue en "In Progress" igual que los demás
- **Dónde:** `page.tsx:140-142` (un Work Order sale de "In Progress" solo cuando todos mis Jobs están hechos) y `:369-371` (el bloqueo es una línea de 12 px gris)
- **Evidencia:** `evidencia/01-inicio.jpg` (observado). Truck 605 está en "In Progress" con el mismo botón azul "View Work" que 604. Lo único que dice que no hay nada que hacer es "Assigned to you · Blocked · Waiting for Parts" en gris pequeño.
- **Criterio:** Nielsen H1 (visibilidad del estado) y H8 (lo relevante compite con lo que no lo es)
- **Severidad:** 2 · El mecánico abre 605 para descubrir que espera al Manager; con varios camiones, no distingue de un vistazo dónde puede trabajar.
- **Recomendación:** separar en el inicio "Blocked · waiting on the Manager" (ES "Bloqueado · espera al Manager"), con el motivo y desde cuándo, y botón secundario. Lo que se puede trabajar queda arriba.
- **Esfuerzo:** S

### UX-1-006 · `/mechanic/standard/new` existe, no tiene enlace y se titula "New Work Order"
- **Dónde:** `apps/web/src/app/mechanic/standard/new/page.tsx` → `app/work-orders/new/page.tsx:221-232`
- **Evidencia:** `evidencia/01-nuevo-work-order.jpg` (observado). Título "New Work Order" y un recuadro "Ask your Shop Manager to create a Work Order." Ninguna pantalla del Standard enlaza aquí (el único enlace a `/new` es el del PM, `page.tsx:164`).
- **Criterio:** Nielsen H8 (diseño minimalista) y H2
- **Severidad:** 1 · Solo se llega escribiendo la URL o desde un marcador viejo; no confunde a nadie en el uso diario.
- **Recomendación:** redirigir `/mechanic/standard/new` a `/mechanic/standard`.
- **Esfuerzo:** S

### Flujo 2 · Trabajar y terminar

### UX-1-007 · "Labor time" suma el tiempo de todos, pero "running" es el del mecánico
- **Dónde:** `apps/web/src/app/work-orders/[id]/detail-client.tsx:196` y `:217-222` (`liveLaborMs(wo.totalActiveLaborMs, wo.laborRunning, …)`; `totalActiveLaborMs` es el total del Work Order, `laborRunning` es la sesión del que mira)
- **Evidencia:** `evidencia/01-detalle-604.jpg` (observado): "Labor time: 3m · running". Con más mecánicos en el camión el número incluye el tiempo de ellos (inferido del código: `liveLaborMs` en `apps/web/src/lib/work-order-identity.ts:22-23`).
- **Criterio:** Nielsen H2 (correspondencia con el mundo real) y H1
- **Severidad:** 2 · El mecánico lee el número como "mi tiempo" (J7: "que se sepa cuánto tardé"); en un camión con PM, Detailing y Alignment el número no es suyo.
- **Recomendación:** mostrar "Your time: 1h 12m · running" (ES "Tu tiempo: …") con sus propias sesiones; el total del camión es del Manager.
- **Esfuerzo:** M (la API tiene el tiempo por mecánico, LTR-184; hay que mandarlo en el detalle del mecánico)

### UX-1-008 · El toast "Work started." tapa los botones del diálogo "Complete job"
- **Dónde:** `apps/web/src/components/action-toast.tsx:53-56` (6 s) y `:68` (fijo abajo, `z-[60]`), sobre el `Modal` de `detail-client.tsx:488-561`
- **Evidencia:** `evidencia/07-toast-tapa-dialogo.jpg` (observado). Pasos: 1) Continue en 604, 2) enseguida "Complete job" → la hoja sube y el toast "Work started. · Dismiss" queda encima de "Cancel" y "Complete job".
- **Criterio:** Nielsen H3 (control: la acción principal queda tapada) y H8
- **Severidad:** 2 · Pasa en el camino más corto (Continue y completar), en el teléfono. El mecánico espera 6 s o toca "Dismiss"; un toque apurado cae en el toast.
- **Recomendación:** cuando hay un diálogo abierto, el toast sube por encima de la hoja (ya existe `--toast-lift`) o se cierra al abrir el diálogo.
- **Esfuerzo:** S

### Flujo 3 · Avisar que algo me detiene

### UX-1-009 · El bloqueo no dice desde cuándo espera ni quién lo reportó
- **Dónde:** `detail-client.tsx:271-274` (primera línea: Job, "Blocked" y motivo; la nota inicial va sin autor ni hora)
- **Evidencia:** `evidencia/01-detalle-605.jpg` (observado). "Air Bag Replacement · Blocked · Waiting for Parts" y "Falta la bolsa de aire trasera…" sin fecha; la nota agregada después sí dice "Anthony · Oct 7, 2026, 10:42 AM".
- **Criterio:** Nielsen H1 (visibilidad del estado)
- **Severidad:** 1 · El mecánico puede deducirlo de las notas, pero no puede decirle al Manager "lleva dos días" sin buscar.
- **Recomendación:** "Blocked since Oct 7, 10:42 · by Anthony" en la primera línea del bloqueo (ES "Bloqueado desde …").
- **Esfuerzo:** S

### Flujo 5 · Buscar una unidad y ver lo hecho

### UX-1-010 · En Trucks, "Open WO-004" no lleva al Work Order
- **Dónde:** `apps/web/src/components/mechanic-trucks-page.tsx:50-54` (toda la tarjeta enlaza al historial; la etiqueta es solo texto)
- **Evidencia:** `evidencia/01-buscar-unidad.jpg` (observado). Buscar "604" muestra "Truck 604 · Open WO-004 · View truck repair history"; tocar abre el historial ("No repair history."), que tampoco enlaza el Work Order abierto.
- **Criterio:** Nielsen H7 (flexibilidad y eficiencia)
- **Severidad:** 1 · Si el camión es suyo, lo tiene en el inicio; si no lo es, no puede abrirlo (D11). Es un camino corto que falta, no un bloqueo.
- **Recomendación:** si el Work Order abierto tiene Jobs del mecánico, la etiqueta es un enlace "Open WO-004 ›" al detalle.
- **Esfuerzo:** S

### UX-1-011 · Completed no dice cuándo se completó cada Job ni con qué nota
- **Dónde:** `apps/web/src/components/mechanic-completed-page.tsx:53-58`
- **Evidencia:** `evidencia/01-completados.jpg` (observado). "Truck 605 · Work Order WO-005 · In Progress · ✓ Battery · Electrical & Starting". Sin fecha ni nota de cierre.
- **Criterio:** Nielsen H6 (reconocer antes que recordar)
- **Severidad:** 1 · Para responder "¿cuándo cambié esa batería?" tiene que abrir el Work Order.
- **Recomendación:** fecha y hora de cierre a la derecha de cada Job ("Oct 7, 10:42") y la nota en una línea debajo, truncada.
- **Esfuerzo:** S

## Lo que funciona bien
- **El mecánico ve solo lo suyo y en orden de acción:** el inicio separa "In Progress", "Ready to Start" y "Waiting on Manager", y marca el próximo Job con "Next" (`evidencia/01-reloj-movido.jpg`).
- **Start, Complete y Report Blocker no se pueden tocar dos veces:** los botones se deshabilitan y cambian a "Starting…", "Completing…", "Reporting…" (`evidencia/01-iniciar-desde-lista.jpg`, `evidencia/07-completar-enviando.jpg`).
- **Cuando "Complete job" no se puede usar, dice por qué** justo encima: "Press Continue to be able to complete Jobs." (`evidencia/01-604-reloj-en-otro.jpg`).
- **Terminar la parte se confirma con contenido:** "You finished your part on Truck 604. Your time stopped. If the Manager gives you another Job here, tap Continue." (`evidencia/06-terminaste-tu-parte.jpg`) y el camión pasa a "Waiting on Manager" en el inicio.
- **"Other work" se ve y no se puede tocar:** dice "Other mechanics do this work. You can see it, not change it." (D11), y el Job de ayudante aparece como "Brake Inspection · helper" (D23).

## Fuera de alcance / no verificado
- **"Resolved · tap Continue":** no se resolvió un bloqueo (es acción del Manager). Se leyó el código (`page.tsx:322-325`, `detail-client.tsx:248-257`).
- **"Yesterday's work is still open · tap Continue" (D20):** no se esperó al cierre de las 5:00; se espera el mismo comportamiento que UX-1-004.
- **"Paused by the Manager" con datos:** WO-009 no es de Anthony.
- **Producción:** no verificado.

## Para otras skills
- Skill 3: "Work Options" como título encima de un solo botón "Continue" no dice nada; "Created" y "In Progress" son estados del sistema en la tarjeta del mecánico; los errores del servidor llegan crudos en inglés ("Internal server error", "Job is blocked").
- Skill 4: Other work pesa igual que Your Jobs; con un bloqueo, Your Jobs queda bajo el pliegue (UX-4-005, UX-4-006).
- Skill 6: un Work Order sin Jobs propios dice "You do not have access to this PM Work Order." (UX-6-005); los errores en español salen en inglés en Start y Notas (UX-6-006).
- Skill 7: la nota de cierre se pierde al cerrar el diálogo; el bloqueo solo pide nota con "Other" (UX-7-002, UX-7-003).
