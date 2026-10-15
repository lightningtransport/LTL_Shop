# Propuesta: rediseño de Setup del Admin (Shop workflow, Job Catalog y People)

> **Estado (2026-10-14): construida y en producción** — PR 264 (etapa 0), 265 (S1), 267 (S2), 268 (S3), 269+ (S4, Parts & costs). Cómo funciona hoy: [`SYSTEM.md`](../../SYSTEM.md). Esta propuesta queda como referencia de diseño.

**Clasificación:** PROPUESTA (ya construida; ver arriba).
**Fecha:** 2026-10-07 · **Rama:** `claude/shop-workflow-revision-9afabe` · Aprobada y construida.
**Pantallas:**
- Shop workflow (`/admin/setup/workflow`): `apps/web/src/components/admin-shop-workflow.tsx` (con Shop hours).
- Job Catalog (`/admin/catalog` y `/admin/catalog/categories/[id]`): `admin-catalog-list.tsx`, `admin-catalog-category-detail.tsx` y `admin-catalog-write.tsx`.
- Mechanics → **People** (`/admin/mechanics` y `/admin/mechanics/[id]`): `admin-mechanics-list.tsx`, `admin-mechanic-detail.tsx` y `admin-mechanic-roster.tsx`.
- La entrada del Manager a Quality Check (`/qc`): `quality-check-page.tsx`.

**Reglas que no cambian:**
- D11: cada Job tiene un solo dueño. El tiempo es por persona (D18).
- D19: el Quality Check lo hace Safety. "Mark QC complete" sigue en el Truck.
- D22: alta con contraseña temporal; desactivar solo sin trabajo abierto; nada se borra al desactivar.
- D25: "Add also to catalog" sigue igual.
- Los Work Orders abiertos no cambian cuando se cambia Setup: todo aplica a los nuevos.

**Lo que decidió el dueño el 2026-10-07 y esta propuesta dibuja:** D28 (equipo y cola por paso; el paso se llama "PM"), D29 (el Manager hace QC como respaldo), D30 (el Manager maneja todo el catálogo, con protecciones) y D31 ("Quitar del Shop" conserva el historial). D32 (partes y costos) va aparte, en S4.

Hallazgos en [`OPEN_ISSUES.md` §1m](../../archive/OPEN_ISSUES_HISTORIAL_2026-10.md) (SW1–SW5, JC1–JC6, ME1–ME5), en la auditoría
[`docs/ux-audit/admin-setup/`](../../ux-audit/admin-setup/09-informe-final.md) (skills audit-ux 0, 1, 3, 4, 5, 6, 7 y 9; patrones P1–P6)
y en [`USER_FLOWS.md`](../../USER_FLOWS.md) HU-M8, HU-M9, HU-A2 y HU-QC1.

## 1. Cómo verla

Abre [`mockup.html`](mockup.html) en el navegador (un solo archivo, sin instalar nada). Arriba: teléfono o
computadora, claro u oscuro, y **Demo**, con un botón por situación:

- **Shop workflow · teams:** PM (Daniel), Alignment (Alejandro 1, una persona), Detailing (equipo de 3) y Quality Check (equipo de Safety de 3, con el aviso de respaldo del Manager);
- **Owner no longer eligible:** Alejandro 1 pasó a PM y sigue en Alignment. Se marca y se puede guardar igual;
- **Empty team:** Alignment sin nadie. Aviso, no bloquea;
- **Step Job inactive:** el Job de Detailing está inactivo y el paso no se crea. Aviso con "Activate";
- **Unsaved changes:** la barra fija de guardar, y el aviso al salir con cambios;
- **Shop hours tab:** el horario, en su propia pestaña y con su propio guardado;
- **Job Catalog:** la lista con estado, "Used on" y acciones (…). Alignment y Air System inactivas, con su motivo y "Activate";
- **Search "lineas":** la búsqueda encuentra Jobs y aliases, sin importar las tildes;
- **Category detail:** Suspension & Steering, con Alignment como Job del sistema, aliases como chips y "Used by";
- **Delete vs deactivate:** borrar un Job usado ofrece desactivarlo;
- **Alias conflict:** el error dice de qué Job es el alias;
- **People:** la lista con tipo, estado, equipos y Jobs pendientes reales;
- **Person detail:** Anthony, con su estado, equipos, Jobs pendientes (Reassign / Send to team queue) y la tarjeta Access;
- **Remove · blocked:** el diálogo de quitar muestra **antes** de confirmar lo que hay que mover, y deja moverlo ahí;
- **Change type warning:** cambiar de tipo dice qué equipos deja y qué Jobs hay que mover;
- **Manager on /qc:** la pantalla de Safety con la franja "backup for Safety".

Todo funciona con datos de ejemplo: agregar y quitar personas de un equipo, guardar o descartar, buscar, agregar
y quitar aliases (Enter agrega, Esc cancela), renombrar, desactivar, borrar, reasignar, mandar a la cola, quitar
del Shop y aprobar como Manager.

## 2. Para qué sirven las pantallas

El Manager (Cristian) entra a Setup de vez en cuando, desde la computadora de la oficina, para cambiar **quién
hace qué** y **cómo se llama el trabajo**. Lo que cambia ahí lo sufre el patio días después. Las pantallas
responden:

- **Shop workflow:** ¿quién hace cada paso obligatorio, y qué pasa con un Work Order nuevo?
- **Job Catalog:** ¿cómo se llama este trabajo, existe ya, y qué rompo si lo toco?
- **People:** ¿quién trabaja en el Shop, cuánto tiene pendiente, y puedo sacarlo sin dejar trabajo tirado?

La regla de diseño sale del patrón P1 de la auditoría: **cada cambio dice antes qué afecta**, y nada se rompe en
silencio.

## 3. Lo que está mal hoy (auditoría del 2026-10-07 con la base demo)

**Defectos de lo construido** ([§1m](../../archive/OPEN_ISSUES_HISTORIAL_2026-10.md)):

| # | Qué pasa | Efecto | Auditoría |
|---|---|---|---|
| SW1 | **Shop workflow no guarda nada** si el dueño de un paso dejó de poder hacerlo. Manda todos los pasos y la API rechaza el lote. Dice "Refresh and try again", y refrescar no lo arregla. | La pantalla queda inutilizable. | UX-6-005 (sev 4), UX-7-005 |
| SW2 | **Un paso obligatorio deja de crearse en silencio** si su Job o su categoría se desactivan. La pantalla lo sigue mostrando como configurado. | Un WO nuevo nace sin Detailing y nadie lo nota. | UX-6-008, UX-1-004 |
| SW3 | **Cambiar el tipo de una persona, o desactivarla, no avisa** que es dueña de un paso ni que tiene Jobs de otro tipo. | Pasos sin dueño y Jobs que nadie puede hacer. | UX-7-017, UX-1-003, UX-6-009 |
| SW4 | **Los cambios sin guardar se pierden al salir, sin aviso**, y hay dos botones de guardar en la página (pasos y Shop hours). El botón Save sí se pone azul con cambios (UX-4-001 se retiró: la lectura "gris" fue un error de medición). | El Manager sale de la pantalla y pierde lo que cambió. | UX-6-016, UX-7-004, UX-1-008, UX-5-013 |
| SW5 | **Renombrar un Job que es paso lo saca de su carril en Yard** (se reconoce por nombre). | Yard deja de mostrar el paso. | UX-1-009 |
| JC1 | **Cada publicación deshace los cambios del Manager** en el catálogo (`applyJobCatalog`). | Pérdida de datos silenciosa en cada release. | UX-1-010 |
| JC2 | **El buscador solo encuentra categorías**, no Jobs ni aliases. | Hasta 17 categorías abiertas para encontrar un Job; duplicados. | UX-5-014 |
| JC3 | **Una categoría inactiva no dice por qué**, y "Activate" en sus Jobs no tiene efecto. | Alignment y Air System confunden. | UX-6-010 |
| JC4 | **El primer clic en una categoría no abre el detalle.** | Parece roto. | UX-1-013, UX-5-008 |
| JC5 | **Aliases casi duplicados por una tilde** ("lineas" y "líneas de combustible"). | Ruido y búsquedas que fallan. | UX-3-017 |
| JC6 | **Textos viejos o repetidos:** "Read-only…", "Manager or System Admin…" en 8 lugares, "The Job id stays the same". | Media pantalla de texto en el teléfono. | UX-3-001, UX-3-002, UX-3-015 |
| ME1 | **"Open Work Orders" no es el trabajo real:** Daniel muestra 0 con 9 Jobs pendientes; Alejandro 1, 10 con 7. | La lista no sirve para decidir. | UX-1-014, UX-3-010, UX-6-011 |
| ME2 | **Desactivar avisa del bloqueo recién después de confirmar**, y desde ahí no se puede reasignar. | Prueba y error. | UX-6-013, UX-3-013, UX-7-018 |
| ME3 | **Esc o un clic fuera cierra "Add person"** y se pierde lo escrito, incluida la contraseña temporal. | Hay que reiniciar la contraseña. | UX-7-002 |
| ME4 | **El detalle se contradice:** "Completed Jobs: 3" junto a "No closed Work Orders"; "Job labor time is not available" fijo. | No se le cree a la pantalla. | UX-6-012, UX-3-011, UX-3-012 |
| ME5 | **"Mechanics" lista Safety y admins**, y "Capabilities" mezcla el tipo con permisos. | Vocabulario que no es del taller. | UX-3-008, UX-3-009, UX-5-003 |

**Lo que falta por decisión del dueño** (no son defectos; patrón P6):

| Bloque | Qué | Auditoría |
|---|---|---|
| S1 | Equipo y cola por paso; el Manager en `/qc` (hoy lo manda al Dashboard sin decir nada); el paso se llama "PM". | UX-7-020, UX-6-019, UX-5-009, UX-1-005, UX-1-006, UX-1-007, UX-3-003, UX-3-005, UX-3-006 |
| S2 | Categorías, Jobs y aliases; borrar solo lo nunca usado; Jobs del sistema; "dónde se usa". | UX-7-022, UX-6-021, UX-4-004, UX-4-007, UX-1-011, UX-5-002, UX-3-016 |
| S3 | "Remove"; cabecera de estado; equipos de la persona; reasignar o mandar a la cola desde el bloqueo. | UX-7-023, UX-7-025, UX-6-023, UX-4-009, UX-5-011, UX-1-016, UX-3-014 |

## 4. Qué cambia (la maqueta)

### 4.1 Patrones comunes a las tres pantallas

Salen de P3 y P4 de la auditoría y se usan igual en las tres:

1. **Un solo modo de guardar.** Con cambios aparece una **barra fija abajo**: "2 unsaved changes · Detailing team
   (+Elliot, −John)", con **Discard** y **Save changes** (principal). Sin cambios no hay botón de guardar.
   Salir con cambios pregunta "Leave without saving?" (SW4). Hoy el botón Save ya se pone azul con cambios; lo
   nuevo es que se vea **qué** cambió y que no se pierda al salir.
2. **Guardar solo lo que cambió.** Un error dice qué paso o qué campo falló y por qué, junto a él, nunca "Refresh and
   try again" (SW1).
3. **El bloqueo se dice antes de confirmar.** Desactivar, quitar, cambiar de tipo, borrar o desactivar un Job: el
   diálogo ya trae lo que lo impide y la forma de resolverlo ahí mismo (P1, ME2).
4. **Las pantallas se enlazan.** Paso → su Job en el catálogo. Job → "Used by: Shop workflow step Alignment · 34
   Work Orders". Persona → sus equipos. Equipo → cada persona (P4).
5. **Textos del glosario** de [`03-contenido.md`](../../ux-audit/admin-setup/03-contenido.md): Team / Equipo,
   Team queue / Cola del equipo, Take / Tomar, System Job / Job del sistema, Remove from Shop / Quitar del Shop,
   Pending Jobs / Jobs pendientes, Type / Tipo. Un subtítulo por pantalla; se borran los párrafos "Manager or System
   Admin…" (JC6).
6. **Menú Setup** en el orden de la dependencia (UX-5, estructura propuesta): **Shop workflow → Job Catalog →
   People**. "Mechanics" pasa a **People / Personas** (ME5). Las URLs viejas redirigen.

### 4.2 Shop workflow

1. **Encabezado:** "Shop workflow" y una línea: "The steps every truck Work Order starts with, and the team that does
   each one. Changes apply to new Work Orders; open ones keep their owners."
2. **Dos pestañas:** **Steps** y **Shop hours**, cada una con su URL y su propio guardado. Se acaban los dos botones
   Save en la misma página (SW4, UX-5-005).
3. **Una fila por paso**, en el orden del flujo:
   - **El nombre del paso** por su clave, en los dos idiomas: **PM**, Alignment, Detailing, Quality Check
     (UX-3-003, UX-3-004).
   - **"Catalog Job: Alignment · Suspension & Steering"** como enlace a la categoría, con un candado: es el Job del
     sistema del paso y no se cambia aquí (D-SET8).
   - **"Team · Standard mechanics"**: chips con avatar y nombre, cada uno con "×", y **"+ Add"**. "Add" abre una
     lista con casillas: solo las personas que pueden hacer el paso (por tipo), cada una con sus Jobs pendientes
     (UX-7-020).
   - **Una línea que dice qué pasa con un WO nuevo**, según el equipo:
     - una persona: "New Alignment Jobs are assigned to Alejandro 1." (como hoy);
     - dos o más: "New Detailing Jobs wait in the team queue. The first of the 3 to take one owns it." (D28);
     - nadie: aviso ámbar "No one can take Alignment. New Work Orders get Alignment without an owner; it shows on
       the Dashboard for you to assign. You can still save." (HU-M8, D-SET1).
   - **PM:** "Default scope: PM A · the PM mechanic picks A or B on the truck." (D28).
   - **Quality Check:** el equipo de Safety (Safety 1, 2 y 3) y una nota azul: "**The Shop Manager can do QC as
     backup.** If no one from Safety can, open Quality Check and take, approve or return the truck. It's recorded in
     your name." con el enlace "Open Quality Check" (D29, UX-3-005).
4. **Persona que ya no puede hacer el paso** (cambió de tipo, se desactivó): el chip queda **marcado** (borde
   punteado, nombre tachado, "now PM" o "inactive") y la fila dice "Alejandro 1 can't do Alignment anymore (now PM).
   They get no new Jobs. Remove them when you can; saving still works." **No bloquea guardar** (SW1). Si era el
   único, sale además el aviso de equipo vacío.
5. **Job del paso inactivo** (datos viejos, o antes de S2): chip "Not created" y aviso "The Detailing Job is inactive in
   the Job Catalog, so new Work Orders don't get the Detailing step." con **Activate Detailing** y "Open in Job
   Catalog" (SW2). Con S2 esto ya no puede pasar: un Job del sistema no se desactiva.
6. **Debajo de la lista**, una sola explicación: "A team with one person: new Jobs are assigned to that person. Two or
   more: new Jobs wait in the team queue and the first one to take it owns it. The Shop Manager can assign any Job
   directly."
7. **"Changed by Cristian · Oct 6"** en cada paso (ya existe `updatedBy`).

### 4.3 Job Catalog — lista

1. **Encabezado:** "Categories, Jobs and aliases the Shop uses. One name per kind of work." A la derecha **Add
   category** (con borde) y **Add Job** (principal).
2. **Un buscador** "Search categories, Jobs or aliases" que filtra al escribir, sin tildes ni mayúsculas (JC2, JC5).
   Con texto, arriba sale **"Jobs and aliases"**: "Fuel Lines · Fuel System · alias 'líneas de combustible'", con la
   coincidencia resaltada. Un clic abre la categoría con ese Job resaltado. Sin resultados: "Add 'x' as a Job".
3. **Filtro** All · Active · Inactive (un solo modo de filtrar, UX-5-015).
4. **Tabla:** Category (con chip "System" si lo es) | Status | Jobs ("2 · 1 inactive") | Used on ("212 Work
   Orders" o "Never used") | acciones (UX-4-004). Los aliases se ven en el detalle.
5. **Categoría inactiva:** el motivo debajo del nombre ("Merged into Suspension & Steering (LTR-24)") y un botón
   **Activate** en la fila (JC3).
6. **Menú "…"** por fila: Rename · Deactivate (desactivado con el motivo si tiene un Job del sistema) · Delete
   (solo si nunca se usó; si no: "Used on 87 Work Orders. Deactivate it instead.").
7. **Teléfono:** una tarjeta por categoría, dos líneas (UX-4-005). Toda la fila abre el detalle al primer clic (JC4).

### 4.4 Job Catalog — detalle de categoría

1. **Encabezado:** nombre, estado y "System" si aplica; "4 Jobs · 1 inactive · used on 53 Work Orders". **Add Job**
   y "…" (Rename category, Deactivate, Delete).
2. **Tabla de Jobs:** Job | Status | Aliases | Used by | "…".
   - **Job del sistema** (PM A/B Service, Alignment, Detailing, Quality Check): chip con candado **"System Job"** y
     una línea arriba de la tabla: "Alignment is a System Job: a Shop workflow step and Yard use it. You can rename it
     and edit its aliases; it can't be deactivated or deleted." (D30, SW5).
   - **Aliases como chips** con "×" (quitar no pide confirmar; toast con **Undo**) y "+ Alias": un campo que agrega
     con Enter y valida al salir. **Conflicto:** "'alineacion' is already an alias of **Alignment** · Suspension &
     Steering (as 'alineación'). Open Alignment" (UX-7-022, UX-7-011). Las tildes no cuentan (JC5).
   - **Used by:** "Shop workflow step Alignment · 34 Work Orders" (enlace a Shop workflow), "12 Work Orders" o "Not
     used yet" (UX-5-002).
   - **Menú "…":** Rename · Deactivate / Activate · Delete. Para un Job del sistema, Deactivate y Delete salen
     desactivados con el motivo.
3. **Delete decide según el uso** (D30):
   - **Nunca usado:** "Delete Steering Box Seal? It was never used on a Work Order. It and its aliases are deleted.
     This can't be undone." con **Delete** en rojo.
   - **Usado:** "Kingpin can't be deleted. It's on 12 Work Orders. Deactivate it instead: it stays on those Work
     Orders and their history, and stops showing when adding work." con **Deactivate Kingpin**.
4. **Rename:** "The new name shows on every Work Order that uses this Job. Its history stays." y la casilla marcada
   **"Keep 'Kingpin' as an alias, so searches still find it"** (UX-7-012, D-SET4). Rename se activa solo con un nombre
   distinto. En un Job del sistema: "the Alignment step and Yard keep working after a rename".

### 4.5 People — lista

1. **"People"** (ES "Personas"): "Everyone who works in the Shop, their teams and their pending Jobs." y **Add
   person**.
2. **Buscador** por nombre o correo, que filtra al escribir, y **Active · Inactive · Removed · All** con el número de
   cada uno.
3. **Tabla:** Person (avatar, nombre, correo) | Type (Standard, PM, Safety, Shop Manager) | Status | Teams (chips de
   los pasos) | **Pending Jobs** (los Jobs de los que es dueña en WOs abiertos, no el equipo del WO: Daniel 9,
   Alejandro 1 7) (ME1). Safety: "1 QC".
4. Debajo: "Pending Jobs counts each Job the person owns on an open Work Order."
5. **Teléfono:** una tarjeta por persona: nombre, tipo, "4 pending Jobs · Detailing".
6. **Add person** no se cierra con Esc ni con un clic fuera mientras tenga algo escrito o muestre la contraseña
   temporal (ME3). No está en la maqueta porque el diálogo no cambia.

### 4.6 People — detalle de una persona

1. **Cabecera de estado** (UX-4-009): avatar, nombre, chips **Active** y **Standard**, "4 Jobs pending · 41 completed ·
   last active Today 8:55 AM", correo, y **Edit** (nombre y tipo). Se quita la tarjeta "Capabilities" (ME5) y los
   textos que se contradecían (ME4).
2. **Pending Jobs**, una fila por Job: "Truck 606 · Detailing", el WO en letra mono y "Detailing step". Acciones:
   - **Send to Detailing queue**, si el Job es de un paso con equipo de dos o más (D28). Si es el único del equipo:
     "No PM queue", desactivado;
   - **Reassign**: una lista de quienes pueden hacerlo, con sus Jobs pendientes.

   Las dos con toast y **Undo**.
3. **Teams** (UX-5-011): "Detailing · 3 people share the queue", con enlace a Shop workflow. Sin equipo: "Not on any
   step team. They get Jobs when the Manager assigns them."
4. **Recently completed:** Jobs, no Work Orders (ME4).
5. **Access**, una tarjeta aparte con tres filas:
   - **Reset password:** "Gives a new temporary password. They change it when they sign in."
   - **Deactivate:** "Can't sign in or get new Jobs. You can turn it back on."
   - **Remove from Shop** (en rojo): "Leaves every list and team for good. Their name stays on past Work Orders, notes
     and time."
6. **Diálogo Remove / Deactivate, con el bloqueo antes de confirmar** (D31, ME2, UX-7-025):
   - "Remove Anthony from the Shop? Anthony stops signing in and leaves every list and team. Their name stays on past
     Work Orders, notes and time."
   - Si tiene trabajo, un aviso ámbar: "**Move 4 pending Jobs first.**" con **"Send 2 step Jobs to their team
     queue"** y la lista de los Jobs, cada uno con Send to queue / Reassign ahí mismo.
   - **Remove from Shop** queda desactivado hasta que no quede nada; entonces el aviso cambia a "No pending Jobs and no
     clock running. Ready to remove."
   - Debajo, lo que pasa con los equipos: "Leaves the Detailing team (2 stay)". Si era el único: "no one left; new
     Work Orders get it without an owner".
   - "Created by mistake and never did anything? Then the app offers Delete instead." (D31: el borrado real solo
     para quien no tiene historial).
7. **Edit → cambiar de tipo** (SW3): al elegir otro tipo, antes de guardar:
   - "Anthony leaves the Detailing team: PM people can't do Detailing.";
   - "**Move 4 pending Jobs first.** They're Standard work." y Save desactivado (D-SET3).
8. **Persona inactiva:** franja "Inactive. Anthony can't sign in and gets no new Jobs. Activate". **Quitada:** "Removed
   from the Shop on Sep 2. Not in any list or team. Their name stays on 9 past Jobs, notes and time." (solo se llega
   con el filtro Removed).

### 4.7 El Manager en Quality Check (D29)

- `/qc` deja de mandar al Manager al Dashboard. Ve **la misma pantalla de Safety** con una franja azul arriba:
  "**You're doing Quality Check as backup for Safety.** Take, approve or return a truck like Safety does. Each one is
  recorded in your name (Cristian Perez · Shop Manager)."
- Arriba a la derecha, **Back to Admin**.
- Toma, aprueba (con la confirmación de D-QC1: "Recorded as approved by Cristian Perez (Shop Manager, backup for
  Safety)") y devuelve igual que Safety. Un camión tomado por Safety 2 se ve como tomado.
- Se llega desde la fila Quality Check de Shop workflow, desde "Waiting for Safety" del Dashboard y desde el Truck
  (D-SET6). "Mark QC complete" sigue en el Truck.

### 4.8 Estados

Se quedan las primitivas que ya funcionan bien (auditoría, "Lo que funciona bien"): `PageSkeleton`, `LoadFailure`
con Retry, 404 con salida y errores de la API traducidos. Lo nuevo:

- **Equipo vacío**, **persona no elegible** y **Job del paso inactivo**: avisos en la fila, nunca bloquean guardar.
- **Lista vacía de búsqueda:** "No Job or alias matches 'x'. Add 'x' as a Job".
- **Categoría sin Jobs:** "No Jobs yet. Add the first one."
- **Persona sin pendientes:** "Nothing pending."
- **Toast con Undo** en todo lo reversible: quitar alias, desactivar, mandar a la cola, reasignar.

### 4.9 Estilo de la Etapa 8

- Las mismas primitivas que las otras propuestas: tarjetas con título (`SectionCard`), `CountChip`, chips con punto,
  `ResponsiveMenu` para "…", botones con icono, diálogos que en el teléfono son hojas inferiores.
- Claro y oscuro.
- Computadora de 1280 px como principal (es una pantalla de oficina). En el teléfono: tablas que pasan a tarjetas,
  toques de 44 px y textos de 16 px en los campos.

## 5. Qué necesita la API (todo aditivo)

Revisado en `shop-workflow.service.ts`, `mandatory-jobs.ts`, `system-admin-writes.service.ts`,
`yard-work-plan-derivation.ts`, `prisma/job-catalog.ts`, `schema.prisma` y `packages/shared/src/types.ts`.
**Ya existe y no se pide:** `ShopWorkflowStepDto.updatedBy`; `openWorkOf()` con los Jobs pendientes y el reloj (hoy solo
se usa al desactivar); `CatalogStatus` en categorías y Jobs; el `PATCH` de un Job (renombrar y activar); reasignar un
Job; el reinicio de contraseña.

**Etapa 0 (arreglos sin rediseño) — construida en la rama `claude/setup-fixes` (2026-10-07):**

| Cambio | Para qué |
|---|---|
| La web manda en `PUT /admin/setup/workflow-steps` **solo los pasos cambiados**, y la API no vuelve a revisar un dueño que no cambia. El error se muestra con su texto, no con "Refresh and try again" | SW1 (A37). |
| En `ShopWorkflowStepDto`: `catalogJob.active` (Job **y** categoría activos) y `defaultMechanic.eligible` | SW2 y SW1: marcar el paso que no se crea y al dueño que ya no puede. |
| `PATCH /admin/catalog/jobs/:id`: desactivar el Job de un paso activo → 409 `CATALOG_JOB_IN_WORKFLOW` (con `stepKey`); activar un Job de una categoría inactiva → 400 `CATALOG_CATEGORY_INACTIVE` | SW2, JC3 en parte (A38). |
| `openWorkOrderCount` y `currentAssignments` salen de los Jobs `to_do` de la persona, no de `mechanic_assignments` | ME1 (A39). |
| En `AdminMechanicDetailDto`: `pendingJobs`, `runningSession` y `defaultOwnerOfSteps`. `recentClosedWorkOrders` = WOs cerrados donde completó un Job | ME2, SW3, ME4 (A39, A40). Se eligió agregarlos al detalle en vez de un `GET …/open-work` aparte: el detalle ya se carga al abrir la página. |

**Pasan a S2:** JC5 (el normalizador sin tildes pide una migración que recalcule `alias_norm` y una los casi duplicados) y la razón visible de una categoría inactiva (JC3). **Pasa a S3:** ME5 ("People / Personas").

**S1 · Shop workflow (D28, D29):**

| Cambio | Para qué |
|---|---|
| Migración: tabla `shop_workflow_step_members` (`step_id`, `user_id`, `added_by_id`, `added_at`; clave `step_id + user_id`). Se llena con `default_mechanic_id` y, para Quality Check, con todo Safety activo. `default_mechanic_id` se deja sin usar (no se borra) | El equipo de cada paso. |
| Migración: `work_order_jobs.workflow_step_key` (texto, opcional). Se llena en los Jobs obligatorios abiertos | Saber de qué cola es un Job sin dueño. |
| `ShopWorkflowStepDto.members: { id, name, type, active, eligible, pendingJobCount }[]` y `assignment: 'direct' \| 'queue' \| 'none'` | Los chips, la línea "qué pasa con un WO nuevo" y los avisos. |
| `PUT /admin/setup/workflow-steps` acepta `{ stepKey, memberIds }[]` (sigue aceptando `defaultMechanicId`). Un integrante nuevo tiene que ser elegible; uno que ya estaba y dejó de serlo se acepta | Guardar el equipo sin repetir SW1. |
| `resolveMandatoryJobs`: un integrante elegible → dueño; dos o más → sin dueño y con `workflowStepKey`; ninguno → sin dueño | D28. |
| `GET /me/team-queue`, `POST /jobs/:id/take` y `POST /jobs/:id/release` (quedan en el Activity Log). Gana el primero que toma | La cola de los mecánicos (sus pantallas no están en esta maqueta). |
| `/qc` y sus endpoints aceptan también `work_orders.manage` y el System Admin. Al aprobar o devolver, el Activity Log guarda `asBackup: true` | D29. |

**S2 · Catálogo (D30):**

| Cambio | Para qué |
|---|---|
| Migración: `catalog_jobs.system_key` y `job_categories.system_key` (texto, únicos, opcionales). Se llenan en PM A/PM B Service (`pm`), Alignment, Detailing y Quality Check, y en sus categorías | Los carriles de Yard, `mandatory-jobs.ts` y `classifyWorkPlanLane` reconocen por clave, no por nombre (SW5). |
| Migración: `job_categories.inactive_reason` (texto, opcional). Se llena en Alignment y Air System ("Merged into … (LTR-24)") | JC3. |
| `applyJobCatalog` solo **crea lo que falta** (por `system_key` o `ninox_external_id`) y nunca cambia nombre, estado ni aliases de lo que existe. Prueba de que una segunda corrida no pisa nada | JC1. |
| `POST /admin/catalog/categories`, `PATCH /admin/catalog/categories/:id` (nombre, estado, motivo) y `DELETE /admin/catalog/categories/:id` | Manejar categorías. |
| `DELETE /admin/catalog/jobs/:id`: solo si nunca se usó; si no, `409 CATALOG_JOB_IN_USE` con `workOrderCount` | Borrar o desactivar. |
| `POST /admin/catalog/jobs/:id/aliases` y `DELETE /admin/catalog/jobs/:id/aliases/:aliasId`. El conflicto `CATALOG_ALIAS_EXISTS` agrega `{ jobId, jobName, categoryName, aliasText }` | Aliases y el error que nombra al otro Job. |
| `PATCH /admin/catalog/jobs/:id` acepta `keepOldNameAsAlias` | Renombrar sin perder búsquedas. |
| Desactivar o borrar un Job o una categoría del sistema: `409 SYSTEM_JOB_LOCKED` | La protección, también en la API. |
| `GET /admin/catalog/search?q=`: Jobs y aliases, sin tildes | JC2. |
| En `AdminCatalogJobDto`: `systemKey`, `workOrderCount`, `usedByStep` y `aliasItems: { id, text }[]` (`aliases: string[]` se queda). En la categoría: `systemKey`, `inactiveReason` y `workOrderCount` | "Used by", el candado y los chips. |

**S3 · Personas (D31):**

| Cambio | Para qué |
|---|---|
| Migración: `users.removed_at` y `users.removed_by_id` (opcionales) | Quitar del Shop sin borrar historial. |
| `POST /admin/mechanics/:id/remove`: el mismo `409 MECHANIC_HAS_OPEN_WORK` que desactivar. Pone `active = false` y `removed_at`, y saca a la persona de todos los equipos | D31. |
| `DELETE /admin/mechanics/:id`: solo sin historial (ni Jobs, ni notas, ni tiempo); si no, `409 PERSON_HAS_HISTORY` | El borrado real de D31. |
| `GET /admin/mechanics?status=active\|inactive\|removed` y, en la lista, las personas del Shop con rol Manager o Admin (tipo "Shop Manager", solo lectura) | El filtro y la lista completa. |
| "Send to team queue": el endpoint de reasignar de hoy, con dueño vacío, cuando el Job tiene `workflowStepKey` | Mandar a la cola desde el detalle y desde el bloqueo. |
| Cambiar de tipo con Jobs pendientes del tipo anterior: `409 MECHANIC_HAS_OPEN_WORK`. Si no, la saca de los equipos que ya no puede hacer | SW3 y D-SET2/D-SET3. |

Ningún campo existente cambia ni se borra. Las rutas de la web pasan a `/admin/setup/people` con redirección desde
`/admin/mechanics`; la API mantiene las suyas.

## 6. Decisiones del dueño

**Ya decididas (2026-10-07)** y dibujadas como dicen:

| # | Decisión | Dónde se ve |
|---|---|---|
| D28 | Cada paso obligatorio tiene un equipo y una cola. Una persona → el Job nace suyo; varias → nace en la cola y el primero que lo toma es el dueño. El paso de PM se llama "PM"; PM A es el de partida. | §4.2 |
| D29 | El Manager hace QC como respaldo desde `/qc`, y queda registrado. | §4.2 (fila QC) y §4.7 |
| D30 | El Manager maneja categorías, Jobs y aliases. Borrar solo lo nunca usado; Jobs del sistema protegidos con clave fija; la recarga no pisa al Manager. | §4.3 y §4.4 |
| D31 | "Quitar del Shop" conserva el historial; el bloqueo se dice antes de confirmar; borrado real solo sin historial. | §4.6 |

**Pequeñas — aceptadas por el dueño el 2026-10-08 tal como se recomiendan** (registradas en `DECISIONS.md`, D28–D31):

| # | Pregunta | Recomendación |
|---|---|---|
| D-SET1 | **¿Un equipo vacío bloquea guardar?** (UX-6-019 lo pedía.) | **No: aviso en la fila.** HU-M8 ya dice que el Job nace sin dueño y Shop workflow lo marca. Bloquear repite SW1: el Manager no puede guardar otro paso mientras busca a alguien. |
| D-SET2 | **¿Quién saca del equipo a una persona que ya no puede?** | **Cambiar de tipo y Remove la sacan solos** (y lo dicen antes de confirmar). **Desactivar la deja en el equipo marcada**, porque es temporal: al reactivarla vuelve a recibir Jobs. Mientras está marcada no recibe Jobs nuevos. |
| D-SET3 | **¿Cambiar de tipo con Jobs pendientes del tipo anterior se bloquea, como desactivar?** | **Sí, mover primero.** Hoy deja a la persona con Jobs que ya no puede hacer (SW3). El diálogo trae los Jobs y las mismas acciones. |
| D-SET4 | **¿Renombrar un Job guarda el nombre viejo como alias?** | **Sí, con la casilla marcada por defecto.** Así la búsqueda y los mecánicos lo siguen encontrando. Se puede desmarcar. |
| D-SET5 | **¿Dónde va Shop hours?** | **Pestaña de Shop workflow con su URL** (`/admin/setup/workflow/hours`) y su propio guardado. No suma una entrada al menú y deja de estar escondido abajo (UX-5-005). |
| D-SET6 | **¿Cómo llega el Manager a `/qc`?** | **Desde la fila Quality Check de Shop workflow, "Waiting for Safety" del Dashboard y el Truck.** Sin entrada fija en el menú: es un respaldo, no el trabajo de todos los días. |
| D-SET7 | **¿El equipo de Quality Check limita quién de Safety ve la cola?** | **Sí, como los otros pasos.** La migración pone a todo Safety activo en el equipo, así que el primer día nada cambia. Una persona de Safety nueva entra al equipo desde Shop workflow. |
| D-SET8 | **¿Se puede elegir otro Job para un paso?** | **No.** El Job de cada paso es su Job del sistema (se renombra, no se cambia). Así "un Job usado por un paso no se desactiva" (D30) se cumple siempre y la pantalla tiene un control menos. |
| D-SET9 | **¿Desactivar una categoría pide motivo?** | **Opcional, una línea**, que se ve en la lista y en el detalle. Las dos de LTR-24 lo traen escrito por la migración. |

## 7. Plan de implementación (cuando el dueño apruebe)

Un PR por etapa y un commit por etapa, cada una con sus pruebas: unitarias, e2e de la pantalla y **filas nuevas de
`test:real`** contra `ltl_shop_test` (las de abajo, A37 en adelante y QC11). Cada etapa se compara con la maqueta
usando capturas en teléfono y computadora, claro y oscuro. Antes de cada PR: `OPEN_ISSUES` §1m y `USER_FLOWS`
actualizados (docs primero).

**Etapa 0 · Arreglos sin rediseño** — **construida** en la rama `claude/setup-fixes` (SW1–SW4, JC3 en parte, JC4, JC6, ME1–ME4; como el "bloque A" de los roles de campo):
- Shop workflow: manda solo lo cambiado, muestra el error real, avisa al salir con cambios, marca la fila cambiada, la persona no
  elegible y el Job inactivo, y los botones dicen "Save steps" y "Save shop hours" (SW1, SW2, SW4).
- Avisos antes de confirmar: desactivar y cambiar de tipo muestran el bloqueo y los pasos de los que es dueña (SW3, ME2).
- Trabajo abierto real en la lista y el detalle (ME1, ME4); "Add person" no se cierra perdiendo lo escrito (ME3).
- Catálogo: `AdminNavLink` en la lista (JC4), textos reescritos y sin el párrafo dentro de los diálogos (JC6); no se puede
  desactivar el Job de un paso ni activar un Job de una categoría inactiva.
- `test:real`: **A37** (SW1), **A38** (SW2 + JC3), **A39** (ME1 + ME4), **A40** (ME2 + SW3). Los números de las filas de S1–S3 de abajo
  se ajustan al construir cada etapa.

**S1 · Shop workflow:** equipos, cola, Manager en QC y el nombre "PM".
- Migraciones (members, `workflow_step_key`); `resolveMandatoryJobs` con equipo; take y release; `/qc` para el Manager.
- La pantalla de §4.2 y la franja de §4.7. La cola en las pantallas de los mecánicos y de Safety.
- `test:real`:
  - **A42** · equipo de 3 en Detailing: el Job nace en la cola; el primero que lo toma es el dueño; los otros ya no
    lo pueden tomar; soltarlo lo devuelve.
  - **A43** · equipo de 1: nace asignado.
  - **A44** · equipo vacío: nace sin dueño y la lista de pasos lo marca.
  - **A45** · el paso se llama "PM" y el mecánico sigue eligiendo PM A o PM B.
  - **QC11** · el Manager toma y aprueba en `/qc`; queda a su nombre como respaldo; un mecánico sigue sin poder.

**S2 · Catálogo:** `system_key`, recarga que no pisa, categorías, aliases, borrar o desactivar, búsqueda y "Used by".
Cierra JC1, JC2, JC3 y SW5.
- `test:real`:
  - **A46** · renombrar Alignment no lo saca de su carril en Yard ni del paso.
  - **A47** · una segunda corrida de `applyJobCatalog` no deshace un nombre, un estado ni un alias del Manager.
  - **A48** · borrar un Job usado → 409 con el número; uno nunca usado se borra.
  - **A49** · desactivar o borrar un Job del sistema → 409.
  - **A50** · un alias repetido → 409 con el Job y la categoría del otro.
  - **A51** · categoría inactiva con motivo; sus Jobs no se ofrecen al agregar trabajo.

**S3 · Personas:** Remove, borrado real, cabecera de estado, equipos de la persona, Send to team queue y el cambio de
tipo con bloqueo.
- `test:real`:
  - **A52** · quitar a alguien sin trabajo: no entra, no sale en listas ni equipos, su nombre sigue en los WOs.
  - **A53** · quitar con trabajo → 409 con la lista; después de mandar sus Jobs a la cola, se puede.
  - **A54** · borrar a alguien con historial → 409; sin historial se borra.
  - **A55** · cambiar de tipo con Jobs pendientes → 409; sin Jobs, sale de los equipos que ya no puede hacer.

**Verificación final** (en S3): `ui-audit` con la cuenta del Manager, en inglés y español, claro y oscuro, teléfono y
computadora. Docs: `SYSTEM.md`, `USER_FLOWS` HU-M8, HU-M9, HU-A2 y HU-QC1, `design-system/glossary-en-es.md` y
`OPEN_ISSUES` §1m.

## 8. Notas de la maqueta

- Los datos son de ejemplo. "Hoy" es el 7 de octubre de 2026 y el Manager es Cristian Perez ("CP").
  - Personas: Daniel (PM); Alejandro 1, Alejandro 2, Anthony, John y Elliot (Standard); Safety 1, Safety 2 y
    **Safety 3** (agregada para mostrar un equipo de QC de tres); Mario Díaz (inactivo) y Luis Ramos (quitado).
  - Camiones del 601 al 968; los Jobs pendientes por persona son los de la auditoría (Daniel 9, Alejandro 1 7,
    Alejandro 2 8, Anthony 4).
  - Las categorías y los Jobs son los del catálogo base, recortados.
- La maqueta está en inglés (el idioma por defecto de la app); las otras maquetas tampoco tienen el botón de
  idioma. La app sigue con los dos idiomas completos, con los términos del glosario.
- Las acciones cambian la maqueta sin guardar nada. "Reset" la vuelve al principio.
- Es un solo archivo sin dependencias (solo Google Fonts). Los colores (tokens) son los mismos que en las otras
  propuestas y en `globals.css`.
- No se muestran, porque no cambian o van en otro bloque: el diálogo "Add person" y la contraseña temporal; la cola
  del equipo en las pantallas de los mecánicos (S1, las propuestas del Mecánico General y de PM); la revisión
  completa de Safety en `/qc` (ya construida); Partes y costos (S4, D32).
