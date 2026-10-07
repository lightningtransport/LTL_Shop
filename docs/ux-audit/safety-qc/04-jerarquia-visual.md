# 04 · Jerarquía y claridad visual — Lightning Shop, pantalla de Safety (Quality Check)

**Fecha:** 2026-10-07 · **Alcance:** `/qc` en teléfono (375 px, claro y oscuro) y computadora (1366 px) · **Método:** código + navegador (medidas con `getComputedStyle`)
**Resumen:** 4 hallazgos, ninguno de severidad 3. La prueba de 5 segundos **pasa** en el teléfono: lo primero que se ve es "Truck 606" y el botón principal. Lo que falla es el segundo vistazo: la tarjeta es texto corrido en dos tonos de gris, los tres estados de un camión casi no se distinguen, y la sección "Returned" parece una nota al pie. **Es un problema de aplicación, no de sistema:** las primitivas de la Etapa 8 (`SectionCard`, `CountChip`, `MechanicAvatar`, `PriorityBadge`) existen en `ui.tsx` y esta pantalla no usa ninguna.

## Prueba de 5 segundos
- **Teléfono, con un camión tomado** (`evidencia/04-movil.jpg`): se ve "Quality Check", "Truck 606" y "Approve". Se entiende qué pantalla es y qué hacer. **Pasa.**
- **Teléfono oscuro** (`evidencia/04-movil-oscuro.jpg`): igual; el botón principal en celeste se distingue. **Pasa.**
- **Computadora** (`evidencia/04-escritorio.jpg`): la misma columna de 544 px centrada en 1366 px. Se entiende, pero dos tercios de la pantalla quedan vacíos. **Pasa con reservas.**

## Hallazgos

### UX-4-001 · Los títulos de sección son del mismo tamaño y color que el subtítulo
- **Dónde:** `apps/web/src/components/quality-check-page.tsx:83` y `:128` (`<h2 className="mb-2 text-sm text-shop-muted">`)
- **Evidencia:** medido: "To review · 1" y "Returned · waiting for the Manager · 0" son 14 px, peso 400, gris `oklch(0.5 …)`, lo mismo que el subtítulo "Trucks ready for your review" y que "Nothing returned.". `evidencia/04-movil.jpg` (observado).
- **Criterio:** jerarquía tipográfica: el nivel de sección debe distinguirse del texto de apoyo
- **Severidad:** 2 · La sección "Returned" (lo que espera al Manager) se lee como una nota al pie y se pasa por alto.
- **Recomendación:** separar las dos listas en pestañas ("To review", "Returned", "Done") o, si quedan en la misma página, usar `SectionCard` con título 16 px semibold y `CountChip`.
- **Esfuerzo:** S

### UX-4-002 · La tarjeta es texto corrido: no se ve qué hizo cada quién
- **Dónde:** `quality-check-page.tsx:96-97` (`item.doneJobs.join(', ')` y `t.doneBy(item.mechanics.join(', '))`)
- **Evidencia:** medido: Jobs en 14 px, mecánicos en 12 px gris, en dos líneas separadas por comas ("PM A Service, Detailing, Alignment" / "Work by Daniel, Alejandro 2, Alejandro 1"). El orden de las dos listas no se corresponde (UX-1-009), así que no se puede leer "quién hizo qué".
- **Criterio:** agrupación y escaneabilidad de listas
- **Severidad:** 2 · Safety lee la tarjeta entera para saber qué revisar; con Jobs de nombre largo la línea se parte y se mezcla.
- **Recomendación:** Jobs como chips con check (tono success) y avatares de color de los mecánicos (`MechanicAvatar`), como en la propuesta; el detalle por Job va a la vista de revisión.
- **Esfuerzo:** S

### UX-4-003 · Los tres estados de un camión casi no se distinguen
- **Dónde:** `quality-check-page.tsx:90` (`item.mine ? 'border-primary p-3' : 'p-3'`) y `:98-99`
- **Evidencia:** `evidencia/04-movil.jpg` (mío: borde azul y chip "Taken by me") frente a `evidencia/01-other-sees-taken.jpg` (de la otra persona: tarjeta igual, con chip gris y un "Take" apagado) y `evidencia/01-list.jpg` (libre). La diferencia es un borde de 1 px y un chip de 12 px.
- **Criterio:** uso del color y del contraste como énfasis del estado
- **Severidad:** 2 · Con varios camiones, Safety tiene que leer los chips para saber cuál es suyo y cuál está libre.
- **Recomendación:** libre → botón "Take"; mío → borde primario, chip "Yours" con punto y "Continue review"; de otra persona → tarjeta atenuada, avatar y "Taken by Safety 2" sin botón.
- **Esfuerzo:** S

### UX-4-004 · En computadora la pantalla usa un tercio del ancho
- **Dónde:** el contenedor de la pantalla (`HomeTopBar` + columna central)
- **Evidencia:** medido: 544 px de contenido en una ventana de 1366 px (`evidencia/04-escritorio.jpg`).
- **Criterio:** densidad y uso del espacio por dispositivo
- **Severidad:** 1 · Safety usa sobre todo el teléfono (contexto §1); en la computadora no estorba, pero no aprovecha el espacio para mostrar la revisión al lado.
- **Recomendación:** en computadora, lista a la izquierda y la revisión del camión en un panel a la derecha.
- **Esfuerzo:** M (va con la vista de revisión)

## Inventario visual
- **Tamaños de fuente en la pantalla:** 5 (24, 18, 16, 14 y 12 px). Razonable; el problema es que secciones, subtítulo y vacíos comparten 14 px gris.
- **Colores de énfasis:** 1 (primario azul en claro, celeste en oscuro). Ni prioridad ni salida tienen color, porque no se muestran.
- **Variantes de botón:** 2 (principal y con borde). Ningún botón tiene icono, cuando en las pantallas de la Etapa 8 sí lo llevan.
- **Primitivas de la Etapa 8 usadas:** 0 de `SectionCard`, `CountChip`, `MechanicAvatar` y `PriorityBadge` (las usa, por ejemplo, `admin-truck-detail.tsx:316`). Sí usa `Card`, `Badge`, `EmptyState`, `LoadFailure`, `CardListSkeleton` y `Modal`.

## Lo que funciona bien
- **Un solo botón principal por tarjeta**, y el número del camión es lo más grande después del título (18 px semibold).
- **Claro y oscuro** se ven bien; el chip "Taken by me" y el botón principal mantienen el contraste en oscuro.
- **En el teléfono no hay scroll lateral** y los botones miden 44 px de alto.

## Fuera de alcance / no verificado
- Contraste numérico (skill 2).
- Lista con muchos camiones: la demo tiene uno; con 5 o más se espera que UX-4-002 y UX-4-003 pesen más.
