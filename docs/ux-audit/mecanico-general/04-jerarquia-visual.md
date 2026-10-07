# 04 · Jerarquía y claridad visual — Lightning Shop, pantallas del Mecánico General (Standard)

**Fecha:** 2026-10-07 · **Alcance:** inicio `/mechanic/standard` y detalle `/work-orders/[id]` (WO-004 en curso, WO-005 bloqueado) en teléfono (375 px, claro, oscuro y español) y computadora (1366 px); Trucks y Completed de pasada · **Método:** código + navegador (medidas con `getComputedStyle`)
**Resumen:** 8 hallazgos, ninguno de severidad 3. La prueba de 5 segundos **pasa** en el inicio y en el detalle de un camión en curso: se ve "My Assigned Work" o "Truck 604" y un botón azul. **Falla en el detalle de un camión bloqueado**: lo primero es un campo de texto vacío y "Your Jobs" queda bajo el pliegue. El patrón es que **todo pesa lo mismo**: cuatro botones primarios iguales en el inicio, Jobs ajenos con la misma tarjeta que los propios, el bloqueo en gris. **Es un problema de aplicación, no de sistema:** las primitivas de la Etapa 8 existen (`SectionCard` y `CountChip` en `ui.tsx`, `MechanicAvatar` en `mechanic-avatar.tsx`, tonos de aviso) y estas pantallas casi no las usan.

## Prueba de 5 segundos
- **Inicio, teléfono** (`evidencia/01-inicio.jpg`): "My Assigned Work", "Truck 605 · Critical" y un botón azul "View Work". Se entiende qué es y qué tocar. No se sabe en cuál camión trabajar (ver UX-4-001). **Pasa con reservas.**
- **Inicio, oscuro** (`evidencia/04-inicio-oscuro.jpg`) y **en español** (`evidencia/04-inicio-es.jpg`): igual. **Pasa con reservas.**
- **Detalle de un camión en curso, teléfono** (`evidencia/01-detalle-604.jpg`): "Truck 604", "Air Leak" y "Complete job". **Pasa.**
- **Detalle de un camión bloqueado, teléfono** (`evidencia/04-605-movil.jpg`): un bloque amarillo con un campo vacío "For example: the part arrived." ocupa el centro; "Your Jobs" no se ve. **Falla.**
- **Computadora** (`evidencia/04-inicio-escritorio.jpg`, `evidencia/04-detalle-escritorio.jpg`): la misma columna centrada. **Pasa con reservas** (UX-4-008).

## Hallazgos

### Inicio (`/mechanic/standard`)

### UX-4-001 · Cuatro botones primarios iguales y nada distingue el camión donde se trabaja
- **Dónde:** `apps/web/src/app/page.tsx:378-395` (cada tarjeta lleva un botón `default` de ancho completo: "View Work", "Start Work" o "View Details")
- **Evidencia:** medido: en el inicio hay 4 enlaces/botones con el fondo primario ("View Work", "View Work", "Start Work", "View Details"), todos de ancho completo y 44 px. `evidencia/01-reloj-movido.jpg` (observado): el camión que espera al Manager ("View Details"), el bloqueado y el que se puede trabajar tienen el mismo botón.
- **Criterio:** acción principal (una sola por vista) y color como énfasis
- **Severidad:** 2 · El mecánico lee cada tarjeta para saber dónde ir; con 3–4 camiones es un recorrido de varias pantallas. Se cruza con UX-1-001.
- **Recomendación:** botón primario solo en la tarjeta donde corre el reloj o en el siguiente trabajo disponible ("Continue" / "Start Work"); el resto "View" con borde. La tarjeta con reloj lleva borde primario y la marca "Clock running".
- **Esfuerzo:** S

### UX-4-002 · El Job bloqueado no tiene color en la tarjeta del inicio
- **Dónde:** `page.tsx:366-371` (el motivo va en la línea `text-xs text-shop-muted`)
- **Evidencia:** medido: "Assigned to you · Blocked · Waiting for Parts" es 12 px, peso 400, gris, igual que "Assigned to you". En el detalle el mismo bloqueo es ámbar (`evidencia/04-605-movil.jpg`). `evidencia/01-inicio.jpg` (observado), Truck 605.
- **Criterio:** color semántico coherente entre pantallas; énfasis del estado
- **Severidad:** 2 · Es el único dato que dice "aquí no hay nada que hacer" y es el texto más pequeño de la tarjeta.
- **Recomendación:** punto ámbar y el texto "Blocked · Waiting for Parts" en tono `warning`, igual que en el detalle; ver también UX-1-005.
- **Esfuerzo:** S

### UX-4-003 · El aviso del reloj aprieta la cabecera de la tarjeta
- **Dónde:** `page.tsx:326-330` (chip de 12 px en la columna derecha, al lado del número y la línea del Work Order)
- **Evidencia:** `evidencia/01-reloj-movido.jpg` (observado). En Truck 922 el chip "Your clock moved to another Truck · tap Continue" ocupa tres líneas y parte "Work Order WO-" / "012 · In Progress" y "2024 Kenworth" / "T680".
- **Criterio:** agrupación y escaneabilidad (el identificador se parte)
- **Severidad:** 1 · Se lee, pero el número de Work Order queda cortado.
- **Recomendación:** el aviso va en una franja de ancho completo debajo de la cabecera, con icono de reloj, no como chip al lado del título.
- **Esfuerzo:** S

### UX-4-004 · "Paused by the Manager" vacío y "Normal" en cada tarjeta
- **Dónde:** `page.tsx:249-265` (la sección se muestra siempre, también vacía) y `:320` (`PriorityBadge` también para Normal)
- **Evidencia:** `evidencia/01-inicio.jpg` (observado): al final, "Paused by the Manager · 0 paused Work Orders" y un recuadro "No paused Work Orders. Paused work will appear here until it is resumed."; tres de cuatro tarjetas llevan "Normal".
- **Criterio:** densidad y ruido
- **Severidad:** 1 · Ocupa espacio sin aportar; el badge "Normal" diluye el de "Critical".
- **Recomendación:** mostrar la sección de pausados solo si hay alguno; mostrar prioridad solo cuando es High o Critical.
- **Esfuerzo:** S

### Detalle (`/work-orders/[id]`)

### UX-4-005 · "Other work" pesa igual que "Your Jobs" y los títulos de sección son más chicos que los Jobs
- **Dónde:** `apps/web/src/app/work-orders/[id]/detail-client.tsx:376-447` (las dos listas usan `JobTodoCard`, `:655-678`) y la clase `group-title`
- **Evidencia:** medido: "Your Jobs", "Other work on this Truck", "Completed" y "Notes" son 14 px semibold; el nombre de cada Job es 16 px. En 604 hay 1 Job propio y 3 ajenos con la misma tarjeta (`evidencia/01-detalle-604.jpg`); en 605, 1 propio y 4 ajenos (`evidencia/01-detalle-605.jpg`). Las tarjetas ajenas empujan "Completed" y "Notes" a más de 950 px.
- **Criterio:** jerarquía tipográfica (el título de sección debe pesar más que sus ítems) y agrupación
- **Severidad:** 2 · El mecánico abre el detalle para su Job; tiene que distinguir el suyo entre tarjetas iguales y hacer scroll para llegar a las notas.
- **Recomendación:** Your Jobs con tarjeta y acciones; Other work en una lista compacta (una línea por Job con avatar de color y estado) dentro de un `SectionCard` plegable. Títulos de sección a 16 px.
- **Esfuerzo:** S

### UX-4-006 · Con un bloqueo, lo primero es un campo de texto vacío y "Your Jobs" queda bajo el pliegue
- **Dónde:** `detail-client.tsx:263-320` (la sección de bloqueos va antes de todo y lleva un `Textarea` de 2 filas siempre abierto, `:304-311`)
- **Evidencia:** medido en 605 a 375 px: "Active blockers" empieza a 268 px, "Your Jobs" a 762 px (la pantalla mide 812). `evidencia/04-605-movil.jpg` y `evidencia/04-605-oscuro.jpg` (observado). Lo mismo tras reportar un bloqueo (`evidencia/06-bloqueo-reportado.jpg`).
- **Criterio:** punto de entrada y densidad (un campo vacío roba el primer vistazo)
- **Severidad:** 2 · Pasa en cada camión bloqueado, que el mecánico abre para ver si ya se resolvió. Se entiende leyendo, no de un vistazo.
- **Recomendación:** el bloqueo como aviso compacto arriba ("Air Bag Replacement · Waiting for Parts · since Oct 7") con un botón "Add note" que abre el campo; el campo no se muestra hasta que se pide.
- **Esfuerzo:** S

### UX-4-007 · La tarjeta-resumen habla del camión, no del mecánico, y cada Job repite su categoría
- **Dónde:** `detail-client.tsx:208-215` (`jobCategoriesLine(wo.jobs)` y `jobsDone(…)` de todos los Jobs) y `:664` (categoría debajo del nombre)
- **Evidencia:** `evidencia/01-detalle-605.jpg` (observado): "Quality Check, PM, Suspension & Steering, Detailing, Electrical & Starting · 1 of 6 jobs done" en dos líneas; debajo, "Quality Check / Quality Check", "Detailing / Detailing", "PM A Service / PM".
- **Criterio:** densidad y ruido
- **Severidad:** 1 · Son dos líneas y una por Job que no ayudan a decidir nada.
- **Recomendación:** resumen del mecánico: "Your Jobs: 0 of 1 done · Your time: 3m · running"; la categoría solo cuando es distinta del nombre del Job.
- **Esfuerzo:** S

### UX-4-008 · En computadora las dos pantallas usan 576 de 1366 px
- **Dónde:** contenedor de la pantalla del mecánico (`HomeTopBar` + columna central)
- **Evidencia:** medido: 576 px de columna en 1366 px (`evidencia/04-inicio-escritorio.jpg`, `evidencia/04-detalle-escritorio.jpg`).
- **Criterio:** densidad y uso del espacio por dispositivo
- **Severidad:** 1 · El mecánico usa el teléfono (contexto §1); en la computadora no estorba.
- **Recomendación:** dejarlo así mientras el mecánico no use computadora; si la usa, dos columnas (Your Jobs a la izquierda, Notes a la derecha).
- **Esfuerzo:** M

## Inventario visual
- **Tamaños de fuente:** inicio 5 (24, 20, 16, 14 y 12 px); detalle 4 (24, 16, 14 y 12 px). En el detalle los títulos de sección (14 px semibold) son más chicos que los nombres de Job (16 px).
- **Colores de énfasis:** 1 primario (azul en claro, celeste en oscuro) más ámbar para bloqueos (solo en el detalle) y verde para lo completado. El chip del reloj usa el mismo azul que los botones.
- **Botones primarios por vista:** inicio 4 (más la pestaña activa, también azul); detalle de un camión en curso 1 ("Complete job"), 2 si falta Continue.
- **Variantes de botón:** 4 (principal, `secondary`, `outline`, `ghost`). Ningún botón del mecánico lleva icono; las pestañas sí.
- **Primitivas de la Etapa 8 usadas:** `Card`, `PriorityBadge`, `EmptyState`, `LoadFailure`, `CardListSkeleton`, `PageSkeleton`, `Modal`, `InlineAlert`. No usa `SectionCard`, `CountChip` ni `MechanicAvatar` (los usan, por ejemplo, el Truck y el Work Order del Manager).
- **Alto de botones:** 44 px en pantalla táctil y 36 px con mouse (`apps/web/src/components/ui.tsx:27`); medido 44 px con Playwright en modo táctil.

## Lo que funciona bien
- **El número del camión es lo más visible de cada tarjeta** (20 px bold en el inicio, 24 px en el detalle) y "Next" marca el Job que sigue.
- **"Complete job" y "Report Blocker" van juntos debajo del Job,** el primero sólido y el segundo con borde (`evidencia/01-detalle-604.jpg`).
- **Claro y oscuro** se ven bien; el bloqueo ámbar y el "Critical" rojo mantienen el tono en oscuro (`evidencia/04-605-oscuro.jpg`).
- **Las pestañas "My work · Trucks · Completed"** están siempre arriba, con icono, 44 px y la activa en azul.
- **Sin scroll lateral a 375 px** y los textos largos en español caben (`evidencia/04-inicio-es.jpg`).

## Fuera de alcance / no verificado
- Contraste numérico (skill 2).
- Un mecánico con 6 o más camiones a la vez: la demo da 4; se espera que UX-4-001 pese más.
- El historial del camión (`/trucks/[id]/history`) solo se vio como destino.
