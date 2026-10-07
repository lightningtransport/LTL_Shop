# 04 · Jerarquía y claridad visual — Lightning Shop, pantallas del Mecánico de PM

**Fecha:** 2026-10-07 · **Alcance:** inicio, Create PM service, detalle del PM (por empezar, en curso, terminado) y Completed, en teléfono (375 px, claro y oscuro) y computadora (1366 px) · **Método:** código + navegador (medidas con `getComputedStyle`)
**Resumen:** 5 hallazgos, 1 de severidad 3. La prueba de 5 segundos **pasa** en el inicio y en el PM por empezar, y **falla** en el PM en curso: lo primero que se ve es "Service type", y "Finish Work" queda a 1480 px, casi dos pantallas abajo, detrás de nueve selects iguales. **Es un problema de aplicación:** las primitivas existen (`PriorityBadge`, `Card`, `InlineAlert`), pero el formulario del PM pone todo al mismo nivel.

## Prueba de 5 segundos
- **Inicio, teléfono** (`evidencia/01-inicio.jpg`): se ve "PM Mechanic", un botón gris "Create PM service" y "Truck 968 · Continue PM service". Se entiende qué hacer. **Pasa**, aunque lo primero es un botón desactivado.
- **PM por empezar, teléfono** (`evidencia/04-pm-por-empezar.jpg`): "Truck 603" y "Start PM service" en azul. **Pasa.**
- **PM en curso, teléfono** (`evidencia/01-detalle-pm-en-curso.jpg`): "Truck 968", un select "Service type" y tres campos que parecen iguales. No se ve qué falta para terminar ni dónde está Finish. **Falla.**
- **PM en curso, oscuro** (`evidencia/04-detalle-movil-oscuro.jpg`): igual que en claro. **Falla** por la misma razón.
- **PM en curso, computadora** (`evidencia/04-detalle-escritorio.jpg`): columna de 576 px centrada en 1366 px; los dos campos de solo lectura quedan lado a lado. **Falla** (Finish no se ve).

## Hallazgos

### Detalle del PM en curso

### UX-4-001 · "Finish Work" queda a casi dos pantallas, después de nueve selects
- **Dónde:** `/work-orders/[id]?view=pm` · `apps/web/src/components/pm-job-detail.tsx:93-113` (Service type primero), `:131-132` (tarjeta del PM) y `:153` (Finish) · `apps/web/src/components/pm-service-card.tsx:260-294` (una fila por categoría)
- **Evidencia:** medido a 375×812: Finish empieza en y = 1480 px de una página de 2082 px; la pantalla muestra 812. Arriba quedan "Service type", "Current truck mileage", "Last completed PM", "Observed mileage" y las 9 categorías de piezas (`evidencia/01-detalle-pm-en-curso.jpg`, observado). El estado "Saved automatically" y los errores de guardado también salen al pie de la tarjeta (`pm-service-card.tsx:296-304`), lejos del campo que se acaba de tocar.
- **Criterio:** punto de entrada y acción principal (CTA) visible en móvil
- **Severidad:** 3 · Es la pantalla de cada PM; Daniel baja dos pantallas para terminar y, al tocar un campo de arriba, no ve si se guardó ni si falló (ver UX-6-001).
- **Recomendación:** arriba, un resumen de dos líneas ("Mileage 210,000 ✓ · Parts 0 of 9") que diga qué falta; Finish fijo abajo como en Create PM service (`work-orders/new/page.tsx:428-436`); "Service type" como chip editable en el encabezado ("PM A ▾"), no como primera tarjeta.
- **Esfuerzo:** M

### UX-4-002 · Los campos de solo lectura se ven iguales al campo que hay que llenar
- **Dónde:** `pm-service-card.tsx:199-208` (`<Input readOnly>` para "Current truck mileage" y "Last completed PM")
- **Evidencia:** medido: los tres campos tienen el mismo fondo `oklch(1 0 0)`, el mismo borde `oklch(0.9288 …)`, 16 px y 46 px de alto. En la captura, "210,000 mi" (dato) y "210,000" (lo que se escribe) se ven iguales (`evidencia/07-error-al-escribir.jpg`, observado).
- **Criterio:** color y énfasis de estados (editable vs. dato) y agrupación
- **Severidad:** 2 · Daniel toca el primer campo, no pasa nada, y busca dónde escribir; con el teléfono en una mano cuesta.
- **Recomendación:** mostrar el millaje actual y el último PM como texto con etiqueta (`dl`, como en el PM terminado, `pm-service-card.tsx:330-343`) encima del campo: "Truck: 210,000 mi · Last PM: none".
- **Esfuerzo:** S

### UX-4-003 · Las nueve categorías de piezas son una pared igual; no se ve cuáles tienen pieza
- **Dónde:** `pm-service-card.tsx:260-294`
- **Evidencia:** `evidencia/07-sin-conexion-pieza.jpg` (observado): una categoría con "LF3654 — Fleetguard Oil Filter" y las demás con "No part used", todas con el mismo borde, tamaño y peso. El título "Parts used" mide 14 px semibold, igual que las etiquetas de cada categoría (14 px, peso 500) y que el título de la tarjeta "PM Service" (14 px semibold).
- **Criterio:** jerarquía tipográfica y escaneabilidad de listas
- **Severidad:** 2 · Para revisar antes de Finish, Daniel lee las nueve filas; no hay conteo ni marca de las elegidas.
- **Recomendación:** "Parts used · 1" con `CountChip`; la fila elegida con check y tono success; títulos de sección a 16 px.
- **Esfuerzo:** S

### Inicio

### UX-4-004 · Las tarjetas repiten el Work Order y no muestran prioridad
- **Dónde:** `apps/web/src/app/page.tsx:310-316` y `:334-336` (dos líneas con el WO), `:320` (sin `PriorityBadge` para PM)
- **Evidencia:** `evidencia/01-inicio.jpg` (observado). Cada tarjeta: "Truck 605 / 2022 Volvo VNL 760 / Work Order WO-005 · In Progress / PM A Service · Work Order WO-005 / View Work". Las 7 tarjetas de "Ready to Start" miden lo mismo (~155 px cada una), así que la sección ocupa más de una pantalla y la de pausados queda abajo.
- **Criterio:** densidad y ruido; escaneabilidad
- **Severidad:** 2 · Con siete camiones casi iguales, Daniel no distingue cuál atender (ver UX-1-004).
- **Recomendación:** una línea por tarjeta debajo del número: "PM A · WO-005 · waiting 2 d" más `PriorityBadge`; tarjetas compactas para "View Work" y la grande solo para el PM en curso.
- **Esfuerzo:** S

### Computadora

### UX-4-005 · En computadora el formulario usa 576 px de 1366
- **Dónde:** contenedor de la app (columna central)
- **Evidencia:** medido: `main` de 576 px a 1366 px (`evidencia/04-detalle-escritorio.jpg`, observado).
- **Criterio:** densidad y uso del espacio por dispositivo
- **Severidad:** 1 · Daniel usa el teléfono (contexto §1); en computadora no estorba, pero alarga el scroll de UX-4-001.
- **Recomendación:** en ≥ 1024 px, millaje y resumen a la izquierda y piezas a la derecha, con Finish visible.
- **Esfuerzo:** M

## Inventario visual
- **Tamaños de fuente:** inicio 5 (24, 20, 16, 14 y 12 px); detalle 4 (24, 16, 14 y 12 px). En el detalle, título de tarjeta, títulos de grupo y etiquetas comparten 14 px.
- **Colores de énfasis:** 1 (primario azul en claro). Semánticos: rojo (error de millaje), ámbar (salto de millaje, bloqueo), verde (PM terminado).
- **Variantes de botón:** 3 (principal, secundario relleno gris, ghost). El principal desactivado (Finish: fondo `oklch(0.9683 …)`, texto gris) se ve igual al secundario ("Add Note", "Request Work").
- **Primitivas usadas:** `Card`, `InlineAlert`, `LoadFailure`, `EmptyState`, `CardListSkeleton`, `Modal`. `PriorityBadge` existe en el inicio pero se oculta para PM; `CountChip` y `SectionCard` no se usan.

## Lo que funciona bien
- **El número del camión manda** en todas las pantallas (24 px en el encabezado, 20 px bold en las tarjetas).
- **En el inicio hay un solo botón azul por sección** y el PM en curso va primero.
- **El PM terminado** usa etiqueta pequeña + valor (`dl`) y se lee de un vistazo (`evidencia/01-pm-terminado.jpg`).
- **Claro y oscuro** se ven bien; los campos mantienen borde y contraste en oscuro (`evidencia/04-detalle-movil-oscuro.jpg`).
- **Los campos miden 46 px y los botones 44 px** de alto; no hay scroll lateral a 375 px.

## Fuera de alcance / no verificado
- Contraste numérico (skill 2).
- Camión con muchas categorías sin piezas compatibles ("No compatible parts for this truck"): la demo no tiene uno.
