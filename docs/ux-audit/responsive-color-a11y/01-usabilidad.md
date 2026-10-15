# 01 · Evaluación heurística (Nielsen) — Lightning Shop

**Fecha:** 2026-10-15 · **Método:** código + navegador, con las acciones ejecutadas en una copia local de la base demo (`ltl_shop_review_208`). Manager a 1440 px; mecánico y Safety a 375 px.

**Alcance (pantallas recorridas):**
1. **Ver el taller (Manager):** Dashboard `/admin` → Mark handled, Assign.
2. **Trabajar un camión (Manager):** Truck `/admin/trucks/[id]` (922, devuelto por Safety) → Resolve. Work Order `/admin/work-orders/[id]` (WO-075) → Mark complete del QC.
3. **Mi trabajo (Mecánico General):** `/mechanic/standard` → Continue → `/work-orders/[id]` → Complete job.
4. **Quality Check (Safety):** `/qc`.

**Resumen:**
- **9 hallazgos nuevos.** 1 de severidad 4 y 1 de severidad 3, los dos en el mismo punto: **qué pasa después de que Safety devuelve un camión**. Con un toque el Manager puede completar el QC devuelto sin arreglar nada, y "Resolve" no lleva a arreglar lo que Safety encontró.
- **Patrón que más se repite:** acciones de un toque que no dicen qué hicieron ni dejan deshacer (H1, H3).
- **El resto está sano.** Las auditorías anteriores por área (`../mecanico-general/`, `../mecanico-pm/`, `../safety-qc/`, `../admin-setup/`, `../demo-mode/`) llevaron a rediseños, y casi todos sus hallazgos ya no se reproducen.

## Hallazgos

### Flujo 2 · Trabajar un camión (Manager)

### UX-1-001 · Un toque en "Mark complete" completa el QC que Safety devolvió, sin confirmar ni mostrar por qué lo devolvió
- **Dónde:** Work Order → Jobs → fila Quality Check (`/admin/work-orders/[id]`) · `apps/web/src/components/admin-job-table.tsx:281`
- **Evidencia:** `evidencia/01-wo-qc-bloqueado-completado-un-toque.jpg` (observado). Pasos:
  1. WO-075 está bloqueada con "Quality Check is blocked · Returned by Safety · 'Alignment: Sigue jalando a la derecha en la prueba de manejo.'".
  2. "Mark complete" en la fila del QC.
  3. Sin diálogo, el QC queda **Done** (lo hizo "MS · Manager Shop"), el bloqueo pasa a "1 resolved blocker" y el siguiente paso dice "All jobs are done · Confirm completion".
  4. Alignment sigue como estaba.
- **Criterio:** H5 Prevención de errores (acción irreversible y frecuente al lado de la que se busca, sin confirmación) · H1 (no se ve qué se pasa por alto)
- **Severidad:** 4 · El camión puede volver a la ruta con el defecto que Safety detectó (la dirección jala a un lado). El respaldo del Manager (D29) es legítimo, pero hoy salta la revisión de Safety con un toque y sin recordar el motivo.
- **Recomendación:** si el QC tiene una devolución de Safety abierta:
  - "Mark complete" abre un diálogo con el motivo de Safety: "Safety returned this truck: '…'. Mark QC complete anyway?". Pide una nota obligatoria y queda en el historial como "QC completed by Manager over a Safety return".
  - El botón principal del diálogo es "Add work" (UX-1-002), no completar.
  - Igual para "Mark QC complete" en el Dashboard y el Truck.
- **Esfuerzo:** S

### UX-1-002 · "Resolve" de un camión devuelto por Safety no lleva a arreglar lo que Safety encontró
- **Dónde:** Truck y Work Order → Next step "Quality Check is blocked · Returned by Safety" → Resolve · `apps/web/src/components/admin-blocker-resolve.tsx`, `admin-messages-catalog.ts:857` (`resolveBlockerNoteLabel`)
- **Evidencia:** `evidencia/01-resolve-devuelto-por-safety.jpg` (observado). Resolve solo abre "Note for the mechanic (optional)" y "Confirm resolve". No ofrece agregar trabajo ni reabrir Alignment, y el camión vuelve a la cola de Safety igual que estaba.
- **Criterio:** H5 Prevención de errores · H6 Reconocer antes que recordar (el Manager tiene que saber que debe ir a "Add work" antes de resolver) · D19 ("el Manager agrega el trabajo")
- **Severidad:** 3 · Pasa cada vez que Safety devuelve un camión. O se pierde una vuelta más con Safety, o sale un camión sin arreglar.
- **Recomendación:** para "Returned by Safety", el siguiente paso ofrece:
  - **"Add work"** como acción principal, con el Job que Safety marcó (D-QC3) ya elegido, o "Reopen Alignment". El bloqueo se resuelve solo cuando ese trabajo se completa.
  - "Resolve without work" como acción secundaria con nota obligatoria.
  - La etiqueta de la nota dice "Note for Safety".
- **Esfuerzo:** M

### UX-1-003 · La nota que escribió Safety aparece como "Mechanic: …"
- **Dónde:** Next step del Truck y de la Work Order · `apps/web/src/lib/admin-messages-catalog.ts:1367` (`calloutMechanicNote: 'Mechanic: "{body}"'`)
- **Evidencia:** WO-075: "Reported by QC1 · Quality Check … Mechanic: 'Alignment: Sigue jalando…'" (observado).
- **Criterio:** H2 Correspondencia con el mundo real · H4 Consistencia (D19: Safety no es mecánico)
- **Severidad:** 2 · El Manager puede ir a buscar al mecánico equivocado.
- **Recomendación:** prefijo según el rol de quien reportó: "Safety: …" para `quality_check.perform` y "Mechanic: …" para mecánicos. O el nombre, igual que la línea de arriba.
- **Esfuerzo:** S

### UX-1-004 · "Costs so far: $0.00 labor" en una Work Order con 1 h 3 min de trabajo
- **Dónde:** encabezado de la Work Order (`/admin/work-orders/[id]`)
- **Evidencia:** WO-075: "Costs so far: $0.00 labor · $0.00 outside repairs" junto a "Active labor 1h 3m" (observado). Por D34 la mano de obra se escribe al completar, pero la pantalla no lo dice.
- **Criterio:** H1 Visibilidad del estado · H2 (el "so far" promete el acumulado)
- **Severidad:** 2 · El Manager lee que el camión no costó nada.
- **Recomendación:** "Labor: 1h 3m · charged when the Work Order completes" o el costo estimado (horas × tarifa vigente) marcado como estimado.
- **Esfuerzo:** S

### UX-1-005 · El historial dice "Mechanic added" cuando Safety toma el QC
- **Dónde:** Work Order → History → Activity
- **Evidencia:** "QC1 · Quality Check · Mechanic added · Quality Check" (observado).
- **Criterio:** H2 Correspondencia con el mundo real
- **Severidad:** 1
- **Recomendación:** "QC1 took Quality Check" (el mismo verbo "Take" de la pantalla de Safety).
- **Esfuerzo:** S

### Flujo 1 · Ver el taller (Manager)

### UX-1-006 · "Mark handled" en un pedido de trabajo no se puede deshacer y el aviso tapa la fila siguiente
- **Dónde:** Dashboard → Work requests → Mark handled · `apps/web/src/components/admin-dashboard.tsx`
- **Evidencia:** al tocar, el pedido desaparece y sale el toast "Work request marked handled." abajo a la derecha, encima de los botones "Open Work Order / Mark handled" de la fila siguiente. No hay "Undo" (observado).
- **Criterio:** H3 Control y libertad · H1
- **Severidad:** 2 · Un toque de más en el teléfono borra el pedido del mecánico de la lista del Manager.
- **Recomendación:** toast con **Undo** (5 s) y que no tape las acciones de la lista (arriba en escritorio, o con margen inferior en la lista).
- **Esfuerzo:** S

### UX-1-007 · Asignar desde el Dashboard no dice a quién ni qué Job, y la fila salta de lugar
- **Dónde:** Dashboard → Unassigned → Assign · `apps/web/src/components/next-step-action.tsx`
- **Evidencia:** asignar Lights del 601 a MA muestra "Job assigned.". La fila del 601 pasa a "Nobody is assigned to Flat Repair" y baja debajo del 602 (observado).
- **Criterio:** H1 Visibilidad del estado
- **Severidad:** 2 · Al repartir varios Jobs seguidos, el Manager pierde la cuenta de qué hizo.
- **Recomendación:**
  - Toast "Lights → MA · Mecánico Alineación" con Undo.
  - Mantener la fila en su lugar hasta la próxima actualización, o marcarla un momento.
- **Esfuerzo:** S

### UX-1-008 · "Missing required steps" dice que cada paso se agrega "con su dueño por defecto"
- **Dónde:** Dashboard → Missing required steps
- **Evidencia:** "Each is added with its default owner." (observado). Desde D28 un paso puede tener un equipo y una cola, no un solo dueño.
- **Criterio:** H2 · H4 (texto de antes de D28)
- **Severidad:** 1
- **Recomendación:** "Each is added to its team, as set in Shop workflow."
- **Esfuerzo:** S

### Flujo 3 · Mi trabajo (Mecánico General, teléfono)

### UX-1-009 · La franja del reloj corta la hora en el teléfono
- **Dónde:** franja "Your clock" arriba del camión (`/work-orders/[id]`) a 375 px
- **Evidencia:** "Your clock · Truck 604 · since 1:28 …" (observado).
- **Criterio:** H1 Visibilidad del estado (el dato que se corta es justamente desde cuándo corre)
- **Severidad:** 1
- **Recomendación:** "Clock on 604 · since 1:28 AM", sin el prefijo "Your clock", o la hora en una segunda línea.
- **Esfuerzo:** S

## Ya reportado antes (no se repite)
- **Verificado y corregido:**
  - Trucks del mecánico (UX-1-011 de demo-mode / LTR-208, PR 337).
  - Guardar en Shop workflow (UX-1-001 de admin-setup / LTR-210, PR 337).
- **No verificado de nuevo:**
  - Filtro de Mechanics con "Apply" y el del catálogo sin él (UX-1-017 de admin-setup).
  - Pantallas del PM (`../mecanico-pm/`).

## Lo que funciona bien
- **El Dashboard "Needs you"** ordena por lo que espera al Manager y cada fila actúa ahí mismo (Assign, Close, Start inspection, Mark QC complete). Es el patrón que hay que conservar.
- **El inicio del mecánico** dice el estado del reloj ("Your clock is stopped · tap Continue on a Truck"), separa Team queue, In Progress y Ready to Start, y ordena "Most urgent first".
- **"Complete job"** confirma con una hoja que dice lo que va a pasar ("This is your last Job here: your clock stops") y pide la nota para el Manager.
- **La pantalla de Safety** tiene una sola acción por camión, la lista de lo que se hizo y "Ready 1 d ago", y está ordenada por urgencia.
- **La navegación tiene migas** (Trucks › 922 › WO-075), y "Open Truck" en la Work Order evita perderse entre las dos fichas.

## Fuera de alcance / no verificado
- **No recorrido:** PM (`/mechanic/pm`), Setup → Job Catalog y Parts & costs, más allá de lo medido en `04-jerarquia-visual.md`.
- **Datos cambiados en la base de prueba local:** las acciones (marcar un pedido, asignar, completar el QC del 922) se hicieron en `ltl_shop_review_208`. Producción no se tocó.

## Para otras skills
- **Skill 2:** en las tarjetas de `/qc` los nombres de los mecánicos se leen dos veces (texto visible y `sr-only`).
- **Skill 4:** en el grupo de avatares superpuestos, "MPM" queda tapado por el siguiente ("Other work on this Truck"). Va con UX-4-008.
