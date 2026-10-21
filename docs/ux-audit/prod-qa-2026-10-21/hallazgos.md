# Hallazgos — QA de producción 2026-10-21

**Fecha:** 2026-10-21 · **Alcance:** Shop Manager, escritorio, producción
**Resumen:** 15 hallazgos. 1 de severidad 3. Nada impide entrar ni crear una orden;
el filtro del Dashboard es el que hay que mirar primero.

Estado: un solo issue, [LTR-277](https://linear.app/ltransl/issue/LTR-277), con 9 secciones. LTR-278 a LTR-292 quedaron como duplicados y no se ejecutan. `docs/OPEN_ISSUES.md` tiene una sola línea (local, sin commit).

## Hallazgos

### UX-1-001 · Un contador en cero dice que no hay nada pendiente
- **Dónde:** Dashboard (`/admin`), contadores de arriba · `apps/web/src/components/admin-dashboard.tsx:66`
- **Evidencia:** (observado) `evidencia/01-dashboard-filtro-vacio.png` · Pasos: 1) Dashboard con Needs you 28 (27 llegadas sin Work Order y 1 inspección), 2) pulsar "Blocked or paused" (valor 0) → Needs you 0 y "Nothing waiting on you". "Show all" devuelve las 28.
- **Criterio:** Nielsen H1 (visibilidad del estado). El filtro de un contador se lee como el estado de todo el taller.
- **Severidad:** 3 · Cada mañana, si se pulsa un contador en cero, desaparecen las llegadas sin orden y la inspección pendiente.
- **Recomendación:** Con un contador activo, el vacío nombra ese filtro ("No blocked or paused work") y las llegadas sin Work Order y la inspección siguen visibles: no forman parte de ese contador. Hoy `arrived` y `leaving` se vacían en cuanto hay `focus` (`admin-dashboard.tsx:66-69`) y el total `waiting` cae a 0.
- **Esfuerzo:** S

### UX-4-001 · La etiqueta de búsqueda de Work Orders se corta
- **Dónde:** `/admin/work-orders` · `apps/web/src/components/admin-work-orders-list.tsx:97` · texto en `apps/web/src/lib/admin-messages-catalog.ts:1011`
- **Evidencia:** (observado) `evidencia/04-work-orders-lista.png` · El texto "Search Work Order, Truck, category, or Mechanic" mide 276 px dentro de una caja de 250 px (`scrollWidth` 276, `clientWidth` 250). La clase es `truncate`.
- **Criterio:** Escaneabilidad del filtro. La etiqueta visible no se lee entera.
- **Severidad:** 2 · El placeholder "Search work orders" sigue usable. La etiqueta cortada se ve en la barra de filtros de uso diario.
- **Recomendación:** La etiqueta visible cabe en la caja: "Search" o "Work Order, truck, or mechanic". El texto largo se queda en `aria-label`.
- **Esfuerzo:** S

### UX-3-001 · Marca y modelo salen en dos grafías en el mismo tablero
- **Dónde:** Yard, pestaña Shop (`/admin/yard-operations`), tarjetas de PM; lista de Trucks (`/admin/trucks`); filtro Fits de Parts (`/admin/parts/catalog`)
- **Evidencia:** (observado) en el tablero, la misma pasada: "2024 Freightliner CASCADIA" (WO-018) y "2026 Freightliner Cascadia" (WO-015); "2026 Kentworth W9" (WO-021). En Trucks, el 277 y el 282 son "Freightliner CASCADIA" y el 743 es "2016 Freightliner Cascadia" (`evidencia/01-trucks-lista.png`). En Parts, el filtro Fits lista "Kentworth" y "Kenworth" a la vez. En Trucks del mecánico MG, el 282 sigue en "CASCADIA" y el 907 en "Cascadia" (`evidencia/03-mecanico-trucks-cascadia.png`). En Trucks de PM (MPM) se repite: 282 "CASCADIA", 907 "Cascadia", 966 "Kentworth W9".
- **Criterio:** Consistencia del nombre del camión. El sistema ya tiene un formateo de marca y modelo (LTR-113).
- **Severidad:** 2 · No bloquea el trabajo. En un tablero de 12 camiones el nombre no se lee igual.
- **Recomendación:** Un solo valor guardado por marca (Kenworth, Cascadia en sentence case) y que Yard, Trucks y el filtro Fits lo muestren igual. El formateo de LTR-113 no está unificando estas fichas.
- **Esfuerzo:** S

### UX-3-002 · Notas de prueba quedan en el costo de la parte
- **Dónde:** Parts (`/admin/parts/catalog`), columna Cost
- **Evidencia:** (observado) `evidencia/04-parts-catalogo.png` · "Last paid $12.00 · Oct 9, 2026 · Prueba" y "Last paid $22.00 · Oct 9, 2026 · Prueba". La misma prueba sigue en Vendors (un solo vendor, "Prueba") y en Purchases: factura 123123, camión 277, $530.00, nota "edd" (`evidencia/03-compra-prueba.png`). Esa factura está en un borrador de Internal invoices de octubre.
- **Criterio:** El texto de producción no debe leerse como un ensayo. La interfaz está en inglés y la nota dice "Prueba".
- **Severidad:** 2 · No bloquea el inventario. Quien mira el costo ve una nota de prueba.
- **Recomendación:** Quitar o reescribir esas notas en las partes que las tengan. No hace falta un cambio de pantalla si el texto vive en el dato.
- **Esfuerzo:** S

### UX-4-002 · El menú de cada parte mide 32 px en escritorio
- **Dónde:** Parts, botón "…" de la fila · `apps/web/src/components/admin-parts-catalog.tsx:100`
- **Evidencia:** (observado) `evidencia/04-parts-catalogo.png` · cada `Actions for …` mide 32×32 px. La clase es `size-11` y `lg:size-8` (44 px en touch, 32 px desde `lg`).
- **Criterio:** Tamaño del control. En puntero fino el piso del sistema es 36 px; en touch, 44 px.
- **Severidad:** 2 · En este escritorio se puede pulsar. En una laptop ancha el blanco del botón queda por debajo del piso.
- **Recomendación:** `size-11` en touch y `lg:size-9` (36 px) en puntero fino, el mismo corte que el resto de los iconos de la app.
- **Esfuerzo:** S

### UX-3-003 · Con 1, el texto sigue en plural
- **Dónde:** Internal invoices (`/admin/parts/internal-invoices`) y Shop rates (`/admin/parts/labor-rate`) · `apps/web/src/lib/admin-messages-catalog.ts:485` y `:465`
- **Evidencia:** (observado) `evidencia/03-facturas-1-drafts.png` dice "1 drafts". `evidencia/03-shop-rates.png` dice "Saving recalculates 1 completed Work Orders". En español el resumen de facturas es "{drafts} borradores", el mismo molde.
- **Criterio:** El conteo de 1 usa el singular. Ya existe `adminCountLabel` en `apps/web/src/lib/admin-messages.ts:53` (DM3, LTR-204).
- **Severidad:** 2 · No bloquea. Se lee mal cada vez que hay un solo borrador o una sola orden a recalcular.
- **Recomendación:** Esas dos frases pasan por `adminCountLabel`, en inglés y en español: "1 draft" / "1 borrador", "1 completed Work Order" / el singular en español.
- **Esfuerzo:** S

### UX-3-004 · People dice que solo lista mecánicos, PM y Safety
- **Dónde:** People (`/admin/mechanics`), el subtítulo · `apps/web/src/lib/admin-messages-catalog.ts:1222`
- **Evidencia:** (observado) `evidencia/03-people.png` · el subtítulo es "Mechanics, PM and Safety people who use the app" y la tabla incluye Shop Manager y System Admin.
- **Criterio:** El texto de la pantalla nombra a quien está en la lista (D48).
- **Severidad:** 2 · La lista está bien. El subtítulo deja fuera a quien la abre.
- **Recomendación:** "Shop Managers, System Admins, mechanics, PM and Safety."
- **Esfuerzo:** S

### UX-3-005 · El catálogo de Jobs muestra el id interno LTR-24
- **Dónde:** Jobs (`/admin/catalog`), categorías inactivas Alignment y Air System
- **Evidencia:** (observado) `evidencia/03-jobs-ltr24.png` · "Merged into Suspension & Steering (LTR-24)" y "Merged into Air & Brake System (LTR-24)".
- **Criterio:** La pantalla del taller no muestra ids de Linear. El recorrido de tablet ya marca LTR- como texto de equipo.
- **Severidad:** 2 · No bloquea. Quien no conoce Linear ve un código.
- **Recomendación:** Dejar "Merged into Suspension & Steering" sin el paréntesis. El id se queda en el historial, no en la fila.
- **Esfuerzo:** S

### UX-3-006 · "Add Category" no va en sentence case
- **Dónde:** Jobs (`/admin/catalog`) · `apps/web/src/lib/admin-messages-catalog.ts:911`
- **Evidencia:** (observado) `evidencia/03-jobs-ltr24.png` · el botón dice "Add Category". Al lado, "Add Job" conserva la mayúscula de Job, que es término de producto. En español el botón ya dice "Agregar categoría".
- **Criterio:** LTR-252: los botones van en sentence case. Los términos de producto conservan la mayúscula.
- **Severidad:** 1 · Se entiende. Es el único botón del Admin de este pase que capitaliza una palabra común.
- **Recomendación:** "Add category". Revisar en el mismo catálogo "Rename Category" y "Deactivate Category" (`admin-messages-catalog.ts:914-916`).
- **Esfuerzo:** S

### UX-4-003 · El filtro Month de facturas internas se ve vacío
- **Dónde:** Internal invoices, filtros de la lista · `apps/web/src/components/admin-internal-invoices.tsx:38` y `:76`
- **Evidencia:** (observado) `evidencia/03-facturas-1-drafts.png` · el input `type="month"` de la lista tiene `value=""`. El control nativo pinta rayas. Debajo, el único grupo es Oct 2026. El Month de "Month close" sí tiene valor (septiembre, el mes anterior, a propósito).
- **Criterio:** Un filtro vacío que parece roto. El vacío significa "cualquier mes", y no lo dice.
- **Severidad:** 2 · La lista se lee. El control de al lado parece un campo sin fecha.
- **Recomendación:** Si vacío es "cualquier mes", el control lo dice (un select con "Any month", o un texto al lado). No dejar el `input type="month"` en blanco.
- **Esfuerzo:** S

### UX-1-002 · "View completed work (3)" abre una lista de Jobs, no de 3
- **Dónde:** Mecánico Standard, My work → Completed · `apps/web/src/components/mechanic-home.tsx:129` y `apps/web/src/components/mechanic-completed-page.tsx:35`
- **Evidencia:** (observado) sesión MG. El botón de My work dice "View completed work (3)". La pantalla dice "Jobs you completed in the last 30 days" y el grupo Yesterday trae 9 Jobs (`evidencia/01-mecanico-completed.png`). El 3 es `data.completed.length` (Work Orders cerradas). La lista es `myCompletedJobs`, los Jobs que MG terminó aunque la orden siga abierta. En PM el botón dice "(6)" y Completed lista 6 servicios (`evidencia/01-pm-completed.png`): esa pantalla usa `data.completed`, no `myCompletedJobs` (`mechanic-completed-page.tsx:35`).
- **Criterio:** Nielsen H1. El número del botón y lo que abre tienen que ser la misma cuenta.
- **Severidad:** 2 · MG llega. El 3 no prepara para la lista larga.
- **Recomendación:** El botón cuenta los Jobs de esa lista (el mismo `myCompletedJobs`), no las Work Orders cerradas.
- **Esfuerzo:** S

### UX-4-004 · Request work mide 32 px en escritorio
- **Dónde:** Work Order del mecánico, panel Notes · `apps/web/src/components/ui.tsx:44` (variante `sm`)
- **Evidencia:** (observado) en WO-022 del camión 609, el botón "Request work" mide 32 px de alto. La clase `sm` pone `[@media(pointer:fine)]:min-h-8`. El piso de puntero fino en el sistema es 36 px (`size` icon ya usa `size-9`). En el mismo diálogo, las razones de Report blocker miden 44 px (`evidencia/01-mecanico-blocker.png`). En el PM del 943, "Request work" y "Service type: PM A Service" también miden 32 px (`pm-job-detail.tsx:126`, `size="sm"`).
- **Criterio:** Tamaño del control. 44 px en touch, 36 px con puntero fino.
- **Severidad:** 2 · En este escritorio se pulsa. Queda por debajo del piso del propio `Button`.
- **Recomendación:** La variante `sm` en puntero fino pasa a `min-h-9` (36 px). Request work y el tipo de servicio lo heredan.
- **Esfuerzo:** S

### UX-1-003 · El PM pide el millaje cuando el millaje ya está y queda corto
- **Dónde:** PM del camión 943, WO-017 (`/work-orders/34bd238d-c35a-495e-9a25-63304763c9f3?view=pm`) · `apps/web/src/components/pm-service-card.tsx:420`
- **Evidencia:** (observado) `evidencia/01-pm-millaje.png` · Observed mileage 195,676. Truck now 195,678. Samsara 195,676 mi. El resumen dice "Mileage · check it". El aviso amarillo de Parts dice "Enter the observed mileage to record parts used." Los interruptores quedan bloqueados (Oil Filter 1 sigue marcado) y Finish PM dice "Check the mileage above". No se cambió el número ni se terminó el PM.
- **Criterio:** Nielsen H1 y H9. Si el millaje guardado quedó por debajo del millaje actual del truck, el aviso nombra esa regla. Hoy el aviso de "campo vacío" sale con el campo lleno.
- **Severidad:** 2 · El PM sigue abierto y las partes no se pueden tocar. El número correcto está al lado (Truck now), pero el aviso no lo dice hasta que el campo pierde el foco (`showBelow` en `pm-service-card.tsx:277`). En My work la tarjeta del 943 pinta el millaje en verde (`pm-home.tsx:156`).
- **Recomendación:** Con millaje por debajo del actual, el aviso usa `mileageBelowCurrent` (nombra el millaje del truck) sin esperar al blur. La tarjeta de My work usa la misma comprobación y no muestra el check verde.
- **Esfuerzo:** S

### UX-4-005 · El interruptor de partes del PM mide 28 px en escritorio
- **Dónde:** Partes del PM · `apps/web/src/components/pm-service-card.tsx:450`
- **Evidencia:** (observado) en WO-017 cada interruptor "changed" mide 28 px de alto en escritorio. En el iPad apaisado 1194 px, con touch y puntero grueso, el mismo botón mide 28×48 (`evidencia/10-ipad-land-pm-service.png`). En el teléfono (390 px) mide 44 px. La clase es `h-11 lg:h-7`: a partir de `lg` el botón entero baja a 28 px aunque el dedo siga activo. El comentario de la línea 449 pide 44 px en touch y deja la pista en 28 px.
- **Criterio:** Tamaño del control. 44 px en touch, 36 px con puntero fino.
- **Severidad:** 2 · Es el control de cada parte del PM. En escritorio queda bajo el piso de 36 px. En el iPad apaisado queda bajo el piso de 44 px.
- **Recomendación:** La pista puede seguir en 28 px. Con puntero fino el botón no baja de 36 px. Con touch se queda en `h-11` en todos los anchos: `lg:h-7` no gana si el puntero es grueso. Quedó en la sección 8 de LTR-277. No se activó ni se apagó una parte del 943.
- **Esfuerzo:** S

### UX-3-007 · Tres camiones de la demo siguen en producción
- **Dónde:** Setup → Samsara (`/admin/setup/samsara`), "Our trucks without a Samsara vehicle"
- **Evidencia:** (observado) `evidencia/03-samsara-demo.png` · 9050 Carlos Lightning 142,500 mi sin VIN; 9220 Luis Lightning 98,001 mi sin VIN; 9680 Maria Lightning 210,000 mi sin VIN. La semilla (`apps/api/prisma/seed.ts`) usa 905 Carlos 142,500, 922 Luis 98,000 y 968 Maria 210,000. El 741 (Abrahan Gonzalez, CTC, con VIN) es el cuarto sin Samsara y no es esta semilla.
- **Criterio:** La flota de producción no muestra camiones de la demo.
- **Severidad:** 2 · No bloquea el emparejado. Aparecen como camiones nuestros.
- **Recomendación:** El dueño dice si se desactivan. No borrarlos desde un agente. Issue LTR-292.
- **Esfuerzo:** S

## Lo que funciona bien

- Create WO del camión 883 abre el diálogo del sistema (prioridad, nota, Cancel, Create Work Order). Cancel no crea la orden. `evidencia/01-dashboard-needs-you.png` es la cola antes del filtro.
- "12 open Work Orders" abre la lista con las 12 filas y los chips In Progress, Created y Critical.
- El tablero del Yard llega hasta Ready to Go desplazando a la derecha. Las columnas vacías dicen "No trucks". `evidencia/01-yard-final-tablero.png`.
- Los 27 sin Work Order y los 3 In shop coinciden entre el Dashboard y el Yard. Dispatch avisa de 3 camiones (832, 857, 898) que tiene en 301 Yard y Samsara ve afuera.
- En Trucks, Where = "In yard without a Work Order" deja 27 filas y ninguna tiene Work Order abierta. Coincide con el 27 del Dashboard.
- Dispatch muestra la semana: Incoming del lunes 19 (8 necesitan Work Order, con hora de llegada distinta) y Upcoming de hoy (4 Ready · nothing open). `evidencia/01-dispatch.png`.
- Parts carga 91 partes, con búsqueda, tipo, Fits y la tabla. El resumen "0 in stock" coincide con la columna.
- Purchases abre el detalle (vendedor, líneas, total, archivo, Void). Outside repairs vacío dice "No outside repairs yet". Vendors muestra la fila con el badge Parts.
- People lista Shop Manager, System Admin, Standard, PM y Safety. Shop workflow muestra los 4 pasos y "Open Quality Check". La hoja de inspección carga los checks. Shop rates muestra $50.00 por hora desde el 16 de octubre.
- Mecánico Standard (MG): My work muestra el 609 en progreso y 6 esperando al Manager. La orden abre Flat Repair con la lectura de la llanta (LF 22 PSI), Complete job y Report blocker. El diálogo pide una razón y no envía hasta elegirla; Cancel no reportó nada. Truck Information abre en un solo pliegue. Trucks lista los camiones con sus Jobs. Completed agrupa por día.
- PM (MPM): My work muestra el 943 en progreso, Create PM service apagado ("One PM at a time") y 11 esperando. Completed dice "(6)" y lista 6 servicios. Trucks lista los camiones con su orden abierta. No se terminó el PM ni se cambió el millaje.
- Safety (QC): To review, Returned y Done cargan. Las tres están vacías y el vacío lo dice: "Nothing to review", "Nothing returned.", "Nothing yet. What you approve or return shows here." Los contadores en 0 coinciden. Las pestañas miden 44 px. `evidencia/01-qc-vacio.png`, `evidencia/01-qc-done.png`.
- Samsara carga: 159 emparejados, 0 propuestas. Shop hours cierra a las 17:00 (Eastern), lunes a viernes. Save está apagado hasta que hay un cambio. No se guardó ni se sincronizó.

## Fuera de alcance / no verificado

- La hoja de revisión de Safety (Take, Approve, Return). La cola estaba vacía en teléfono e iPad. Shop Manager, MG, PM y el resto de Safety ya se vieron, en emulación.
- No se abrió el borrador de la factura interna. No se pulsó Sync en Samsara ni se guardó Shop hours.
- No se completó el Job del 609 ni se envió una nota. No se terminó el PM del 943.
- Safety no tenía camiones en To review, así que no se abrió una revisión (Take, Approve, Return, hallazgos).
- No se abrió el menú "…" de una parte, no se contó stock y no se guardó ninguna tarifa.

## Teléfono e iPad (emulación, 2026-10-21)

Chrome emulado, no un teléfono real: no hay barras del navegador. Touch activo. Sesión Shop Manager.

- Teléfono 390×844: Dashboard, menú (cada fila 44 px), Yard en lista (los pasos se apilan), Work Orders en tarjetas, Trucks en tarjetas. Nada se sale del ancho. El documento no crece más que la pantalla: scrollea `main`.
- La pestaña Shop del Yard mide 34×44 px (`admin-yard-operations.tsx:198`, alto 44 y sin padding). Quedó como sección 10 de LTR-277.
- iPad a 980 px (Safari pide sitio de escritorio): sin barra lateral, el contenido usa el ancho. Los cuatro contadores del Dashboard caben en una fila. El menú "…" de Parts mide 44 px.
- iPad apaisado 1194×834: vuelve la barra lateral y el tablero del Yard se desplaza a la derecha (2388 px dentro de 906). Se ven Inspection, Shop Work y PM.
- `/mechanic/standard` con Shop Manager dice que ese espacio no está en la cuenta.

### Mecánico Standard (MG), misma emulación

Sesión MG. Teléfono 390×844, iPad vertical 834×1194, iPad 980 px (sitio de escritorio, touch) y iPad apaisado 1194×834. My work, la orden WO-022 del 609, Trucks y Completed. No se completó el Job, no se reportó un blocker y no se envió una nota.

- En el teléfono las pestañas My work / Trucks / Completed quedan abajo, 56 px de alto. El contenido deja 72 px debajo del último ítem, así que la barra no lo tapa.
- Complete job, Report blocker, Request work y Add note miden 44 px con touch (el puntero fino es el que baja Request work a 32 px; eso ya es la sección 8).
- En 834, 980 y 1194 las pestañas pasan arriba y el contenido usa el ancho. En 980 la orden parte en dos columnas: Jobs a la izquierda (~628 px) y Notes a la derecha (~286 px). View work ocupa todo el ancho de la tarjeta.
- Siguen a la vista, ya registrados: "View completed work (3)" con Yesterday en 9, y "CASCADIA" en el 282. En el teléfono la fila de espera recorta el nombre del Job con puntos suspensivos; el número de orden se lee. No es un corte fuera de la tarjeta.
- Nada nuevo para LTR-277. `evidencia/09-phone-mg-home.png`, `evidencia/09-phone-mg-wo.png`, `evidencia/09-ipad-mg-home.png`, `evidencia/09-ipad980-mg-wo.png`.

### PM (MPM), misma emulación

Sesión MPM. Teléfono 390×844, iPad 980 px (sitio de escritorio, touch) e iPad apaisado 1194×834. My work, el PM del 943 (WO-017) y Trucks. No se cambió el millaje, no se tocó un interruptor, no se terminó el PM y no se envió una nota.

- En el teléfono las pestañas quedan abajo a 56 px. El último control (View completed work) deja 72 px libres. Continue, Create (apagado), View, el millaje y los interruptores miden 44 px. Request work y Finish PM también.
- En 980 las pestañas pasan arriba y la espera se parte en dos columnas. La tarjeta impar (camión 609) ocupa la fila entera. Continue ocupa el ancho de la tarjeta.
- En 1194 el PM parte millaje y partes en dos columnas y el contenido usa el ancho. Cada interruptor mide 28×48: es UX-4-005, ya en la sección 8 de LTR-277, con la meta corregida para que el touch no baje de 44 px.
- Siguen a la vista, ya registrados: el millaje 195,676 en verde en My work y el aviso "Enter the observed mileage" con el campo lleno (UX-1-003). "View completed work (6)" coincide. CASCADIA y Kentworth siguen en la espera.
- `evidencia/10-phone-pm-home.png`, `evidencia/10-phone-pm-service.png`, `evidencia/10-ipad980-pm-home.png`, `evidencia/10-ipad-land-pm-service.png`.

### Safety (QC), misma emulación

Sesión QC. Teléfono 390×844, iPad 980 px (sitio de escritorio, touch) e iPad apaisado 1194×834. To review, Returned y Done. No se aprobó ni se devolvió nada: las tres están en 0.

- En el teléfono las pestañas quedan abajo, 56×130 px. El vacío dice "Nothing to review", "Nothing returned." y "Nothing yet. What you approve or return shows here." El recuadro usa el ancho (358 de 390).
- En 980 y en 1194 las pestañas pasan arriba, miden 44 px y se reparten el ancho. El contenido llega al borde. No hay barra lateral.
- Las etiquetas en mayúsculas de la hoja de revisión no salieron: no había un camión que abrir.
- Nada nuevo para LTR-277. `evidencia/11-phone-qc.png`, `evidencia/11-phone-qc-done.png`, `evidencia/11-ipad980-qc.png`, `evidencia/11-ipad-land-qc.png`.
