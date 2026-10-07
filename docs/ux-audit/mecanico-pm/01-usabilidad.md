# 01 · Fundamentos de usabilidad — Lightning Shop, pantallas del Mecánico de PM

**Fecha:** 2026-10-07 · **Alcance:** `/mechanic/pm`, `/mechanic/pm/new`, `/mechanic/pm/completed`, `/mechanic/pm/trucks` y el detalle del PM (`/work-orders/[id]?view=pm`) con la cuenta de PM, teléfono 375 px y computadora 1366 px · **Método:** código + navegador (demo local `ltl_shop_demo`, recorrido con Playwright)
**Resumen:** 7 hallazgos, ninguno de severidad 3. El patrón dominante es que **la regla "un PM a la vez" se descubre al tocar**: el inicio la respeta en una sección, pero la tarjeta pausada, la pantalla de Create PM service y el detalle de otro camión ofrecen empezar como acción principal y responden con un error. Lo demás es información que falta para decidir qué camión sigue y para comprobar lo que ya hizo.

**Inventario recorrido:**

| Flujo | Pantalla / estado | Cómo se llegó |
|---|---|---|
| 3 · Qué tengo y qué sigue | `/mechanic/pm` con WO-016 en curso, 7 en "Ready to Start", 1 pausado | Inicio de Daniel |
| 2 · Empezar un PM | `/mechanic/pm/new` → 957 (sin WO), 968 (mío), 944 y 603 (con WO) → Create | Pestaña "My work" → URL directa (el botón está desactivado) |
| 2 · Empezar un PM | Detalle WO-003 → "Start PM service" | "View Work" en la tarjeta de 603 |
| 1 · Registrar el PM | Detalle WO-016: millaje, piezas, Service type, Finish (abrir y cancelar) | "Continue PM service" |
| 4 · Avisar | Report Blocker (abrir y cerrar con Esc), notas | Detalle WO-016 |
| 5 · Lo que hice | `/mechanic/pm/completed`, detalle WO-006 (terminado) | Pestaña "Completed" |

## Hallazgos

### Flujo 3 · Qué tengo y qué sigue

### UX-1-001 · Con un PM en curso, la tarjeta pausada ofrece "Start PM service" como botón principal
- **Dónde:** `/mechanic/pm`, sección "Paused PM services" · `apps/web/src/app/page.tsx:261` (la tarjeta pausada no recibe `startBlocked`, que sí recibe la de la línea 229) y `:382`
- **Evidencia:** `evidencia/01-inicio.jpg` (observado). Arriba, "Finish WO-016 before starting another PM service." y "Ready to Start" con "View Work" en gris; abajo, Truck 609 (WO-009) con "Start PM service" en azul. Tocarlo abre el detalle, donde "Start PM service" responde "Finish your PM service in progress before starting another." (`evidencia/01-iniciar-con-otro-pm.jpg`).
- **Criterio:** Nielsen H4 (consistencia) y H5 (prevención de errores). Es W14 (`docs/OPEN_ISSUES.md`) que volvió en la sección de pausados.
- **Severidad:** 2 · Pasa cada vez que el Manager pausa un WO con el PM pendiente mientras Daniel tiene otro en curso; el error lo frena, pero el inicio le dice dos cosas distintas.
- **Recomendación:** pasar `startBlocked={isPm && activeWork.length > 0}` también a las tarjetas pausadas, para que digan "View Work" en secundario como las de "Ready to Start".
- **Esfuerzo:** S

### UX-1-002 · Mientras la lista carga o falla, "Create PM service" aparece activo aunque haya un PM en curso
- **Dónde:** `/mechanic/pm` · `apps/web/src/app/page.tsx:142` (`activeWork` es `[]` sin datos) y `:156-170`
- **Evidencia:** `evidencia/06-cargando-inicio.jpg` y `evidencia/06-error-inicio.jpg` (observado). Con la lista demorada 4 s o respondiendo 500, el botón es azul y dice "PM services start immediately after creation."; con la lista cargada, el mismo botón está gris y dice "Finish WO-016 before starting another PM service." (`evidencia/01-inicio.jpg`).
- **Criterio:** Nielsen H1 (visibilidad del estado) y H5
- **Severidad:** 2 · En el taller la carga puede tardar; si toca el botón en ese momento llega a Create PM service y descubre la regla al final (UX-1-003).
- **Recomendación:** mientras `data` no exista, mostrar el botón con el esqueleto (sin acción) y decidir entre activo y desactivado solo con la lista cargada.
- **Esfuerzo:** S

### UX-1-003 · La regla "un PM a la vez" aparece después de elegir el camión y tocar Create
- **Dónde:** `/mechanic/pm/new` · `apps/web/src/app/work-orders/new/page.tsx:95` (`createBlocked` no mira si hay un PM en curso) y `:156-159`; detalle de otro PM · `apps/web/src/components/pm-job-detail.tsx:131-146`
- **Evidencia:** pasos (observado): 1) con WO-016 en curso, abrir `/mechanic/pm/new`, 2) elegir 957, 3) tocar "Create PM service" → "Finish WO-016 before starting another PM service." en rojo y el botón sigue azul (`evidencia/01-crear-con-otro-pm.jpg`). En WO-003, "Start PM service" en azul → "Finish your PM service in progress before starting another." arriba de la página, sin decir cuál ni llevar a él (`evidencia/01-iniciar-con-otro-pm.jpg`).
- **Criterio:** Nielsen H5 (prevención de errores) y H9 (ayudar a recuperarse)
- **Severidad:** 2 · La regla es fija (D2) y la app ya la sabe al abrir la pantalla; Daniel llena el paso y recién al final se entera. El error no tiene salida hacia el PM en curso.
- **Recomendación:** con un PM en curso, abrir Create PM service y el detalle de otros PM con un aviso arriba: "You have a PM in progress on Truck 968 (WO-016)." con el botón "Continue PM on 968"; el botón de empezar, en secundario y desactivado.
- **Esfuerzo:** S

### UX-1-004 · "Ready to Start" no ayuda a decidir qué camión sigue
- **Dónde:** `/mechanic/pm`, sección "Ready to Start" · `apps/web/src/app/page.tsx:221-233`, `:320` (la prioridad se oculta para PM) y `:314-316`
- **Evidencia:** `evidencia/01-inicio.jpg` (observado). Dice "7 orders ready to Start Work", pero ninguna tarjeta tiene "Start" (todas "View Work", por la regla D2). Mezcla WOs "Created" e "In Progress" sin explicar qué significa cada uno para el PM. Ninguna muestra prioridad, desde cuándo espera, ni el millaje o el último PM, y el orden no se explica.
- **Criterio:** Nielsen H2 (correspondencia con el mundo real) y H6 (reconocer antes que recordar)
- **Severidad:** 2 · Al terminar un PM, Daniel elige el siguiente camión; para saber cuál urge tiene que preguntar al Manager o abrir uno por uno.
- **Recomendación:** título "Waiting for PM", orden por prioridad y antigüedad, y en cada tarjeta `PriorityBadge`, "waiting 2 d" y "last PM: 154,300 mi"; quitar el estado del WO de la línea (no le dice nada al PM).
- **Esfuerzo:** M

### UX-1-005 · "Paused PM services" siempre visible y con un texto que promete reanudar
- **Dónde:** `/mechanic/pm` · `apps/web/src/app/page.tsx:249-265` · `apps/web/src/lib/locale-context.tsx:401`
- **Evidencia:** (inferido del código; con datos demo la sección tiene un camión). Sin pausados, la sección queda con "No paused PM services. Paused work will appear here until it is resumed." El PM no tiene pausa (D17); lo que aparece aquí son WOs que pausó el Manager, y Daniel no los reanuda.
- **Criterio:** Nielsen H2 y H8 (minimalismo)
- **Severidad:** 1 · Ocupa espacio todos los días y sugiere una acción que Daniel no tiene.
- **Recomendación:** mostrar la sección solo si hay camiones, con el título "Paused by the Manager" y la razón de la pausa.
- **Esfuerzo:** S

### Flujo 1 · Registrar el PM

### UX-1-006 · Cambiar PM A ↔ PM B se aplica al elegir, sin confirmación ni aviso
- **Dónde:** detalle del PM, "Service type" · `apps/web/src/components/pm-job-detail.tsx:97-108`
- **Evidencia:** pasos (observado): elegir "PM B Service" en WO-016 → la API cambia el Job al momento; no hay toast ni mensaje, solo cambia el subtítulo a "PM B Service". El millaje se conserva.
- **Criterio:** Nielsen H1 (visibilidad del estado) y H3 (control)
- **Severidad:** 1 · Es reversible y raro, pero un toque en el select con el teléfono en la mano cambia el servicio sin que lo note.
- **Recomendación:** toast "Changed to PM B Service · Undo" tras el cambio.
- **Esfuerzo:** S

### Flujo 5 · Lo que hice

### UX-1-007 · "Completed" no dice cuándo ni con qué millaje se hizo cada PM
- **Dónde:** `/mechanic/pm/completed` · `apps/web/src/components/mechanic-completed-page.tsx:77-83` · subtítulo `locale-context.tsx:575`
- **Evidencia:** `evidencia/01-completados.jpg` (observado). Cada tarjeta trae Truck, vehículo y "PM A Service · Work Order WO-008". No hay fecha, millaje ni piezas, y nada indica que la tarjeta se puede tocar. El subtítulo dice "Jobs you completed", el texto del mecánico general.
- **Criterio:** Nielsen H6 (reconocer antes que recordar)
- **Severidad:** 2 · Para responder "¿cuándo le hice el PM al 606?" tiene que abrir cada tarjeta.
- **Recomendación:** fecha de terminado y millaje en la tarjeta ("Oct 7 · 154,300 mi · 1 part"), agrupado por día, y un chevron. Subtítulo "PM services you finished, newest first."
- **Esfuerzo:** S

## Lo que funciona bien
- **El inicio pone el PM en curso primero** con "Continue PM service" como único botón azul de esa sección, y desactiva "Create PM service" explicando por qué (`evidencia/01-inicio.jpg`).
- **Create PM service dice qué va a pasar con cada camión antes de tocar:** "Your PM service will be added to it", "You will take and start it", "You already started the PM on Work Order WO-016" con "Continue PM service" (LTR-147).
- **El PM terminado es solo lectura y claro:** millaje, PM anterior, millaje de hoy y piezas, más "This PM service is finished. The Shop Manager closes the Work Order." (`evidencia/01-pm-terminado.jpg`).
- **Las piezas son solo las del camión** (filtradas por marca y modelo) y el millaje se valida igual que en la API (`checkPmObservedMileage`).
- **Report Blocker** pide la razón en una hoja que se cierra con Esc y no se puede enviar vacía.

## Fuera de alcance / no verificado
- **Finish con éxito:** no se terminó ningún PM (ver `00-contexto.md` §3). Por el código, muestra el toast "PM service completed." y vuelve al inicio (`pm-job-detail.tsx:243-246`).
- **Inicio sin PM en curso y sin camiones:** Daniel tiene WO-016 en curso en la demo.
- **Trucks (`/mechanic/pm/trucks`):** solo se abrió; es la misma pantalla que la del mecánico general (auditoría `mecanico-general`).
- **Producción:** no verificado.

## Para otras skills
- Skill 3: "Finish Work" donde el flujo dice "Finish"; "PM Mechanic" como título del inicio; en español conviven "Unidad" (pestañas) y "camión" ("Millaje actual del camión"); "7 orders ready to Start Work".
- Skill 4: el detalle abre con "Service type" y Finish queda a 1480 px (UX-4-001).
- Skill 6: errores de carga sin título ni salida (UX-6-004).
- Skill 7: millaje, piezas y Finish en detalle (07-formularios.md).
