# 03 · Contenido y lenguaje — Lightning Shop, pantallas de Setup del admin

**Fecha:** 2026-10-07 · **Alcance:** Shop workflow (con Shop hours de pasada), Job Catalog (lista, detalle, diálogos Add/Rename/Activate), Mechanics (lista, detalle, diálogos Add person, Activate, Deactivate, Reset password), en EN y ES · **Método:** código (`apps/web/src/lib/admin-messages.ts`, `api-error-copy.ts`, componentes `admin-shop-workflow.tsx`, `admin-catalog-*.tsx`, `admin-mechanic*.tsx`) + observaciones del navegador ya capturadas (`evidencia/observaciones-navegador.md`, demo local como Manager). No se usó el navegador en esta corrida.

**Resumen:** 20 hallazgos, 4 de severidad 3. El patrón dominante es que **los textos describen la versión anterior del producto**:
- dicen "solo lectura" donde ya se escribe;
- repiten un mismo párrafo de permisos en 8 lugares;
- nombran el paso por el dato ("PM A Service") y no por el concepto.

La pantalla de Mechanics llama a lo mismo "mechanic", "person" y "capability/type", y su contador "Open Work Orders" dice 0 a quien tiene 9 Jobs pendientes. Ocho hallazgos marcan textos que **cambian por decisión** del dueño (equipos y cola, QC del Manager, "PM", catálogo con protecciones, "Remove", Partes y costos). Para esos se propone el texto nuevo, no se reporta como defecto. Los errores de API **no llegan crudos**: cada código tiene una frase EN/ES en `api-error-copy.ts`.

## Hallazgos

### UX-3-001 · El catálogo y Mechanics dicen "solo lectura" y "no disponible aquí" cuando sí se puede escribir
- **Dónde:** Job Catalog lista y detalle (`/admin/catalog`, `/admin/catalog/categories/[id]`) y Mechanics lista (`/admin/mechanics`), para quien no tiene permiso de escritura.
  - Textos: `apps/web/src/lib/admin-messages.ts:76` (EN) y `:1064` (ES), `catalogDescription`; `:371` y `:1358`, `mechanicsDescription`.
  - Uso: `components/admin-catalog-list.tsx:32`, `admin-catalog-category-detail.tsx:27`, `admin-mechanics-list.tsx:41`.
- **Evidencia:** (inferido del código) EN `'Read-only Categories, Jobs, and aliases. Creating, renaming, deactivating, and Custom Job mapping are not available here.'`. Renombrar y agregar ya existen (`catalogRenameJob`, `catalogAddJob`), y el glosario (`docs/design-system/glossary-en-es.md`) aún dice "UI read-only; System Admin writes by API".
- **Criterio:** Nielsen H2 (correspondencia con el mundo real) · coherencia entre texto y comportamiento.
- **Severidad:** 2 · Lo ve solo quien no escribe, pero le dice algo falso sobre el producto. **Cambia por decisión:** el catálogo pasa a ser gestionable por el Manager con protecciones (reemplaza D25).
- **Recomendación:**
  - Reescribir para quien solo mira: EN "Categories, Jobs and aliases the Shop uses. Only the Shop Manager or a System Admin can change them." / ES "Categorías, Jobs y alias que usa el Shop. Solo el Shop Manager o un System Admin pueden cambiarlos.".
  - Igual para Mechanics: "People in the Shop and their open work. Only the Shop Manager or a System Admin can change them." / "Personas del Shop y su trabajo abierto. Solo el Shop Manager o un System Admin pueden cambiarlas.".
  - Actualizar la fila "Job Catalog" del glosario.
- **Esfuerzo:** S

### UX-3-002 · El mismo párrafo "Manager or System Admin…" aparece debajo del subtítulo y dentro de cada diálogo
- **Dónde:**
  - `catalogAddJobTip`, `admin-messages.ts:97` / `:1085`. Se muestra en `admin-catalog-list.tsx:35`, `admin-catalog-category-detail.tsx:38`, `admin-catalog-write.tsx:163` (Add Job) y `:240` (Rename Job).
  - `mechanicRosterTip`, `:373` / `:1360`. Se muestra en `admin-mechanics-list.tsx:46`, `admin-mechanic-detail.tsx:31`, `admin-mechanic-roster.tsx:187` (Add person) y `:223` (Activate person).
- **Evidencia:** (observado) `evidencia/00-catalogo-lista.jpg`, `00-catalogo-renombrar.jpg`, `00-catalogo-agregar.jpg`, `00-mechanics-lista.jpg`, `00-catalogo-movil.jpg`. En el teléfono, subtítulo y párrafo ocupan media pantalla. El diálogo "Rename Job" explica cómo **agregar** un Job: "Add a Job to an active Category so the same work always has the same name…".
- **Criterio:** Nielsen H8 (diseño estético y minimalista) · H2. El párrafo empieza con el rol ("Manager or System Admin.") y solo se muestra a quien ya tiene ese rol (`canWrite`).
- **Severidad:** 2 · Aparece en las cinco pantallas y en cuatro diálogos. Empuja la tabla fuera de la vista en el teléfono y en Rename dice algo que no aplica.
- **Recomendación:**
  - Borrar `catalogAddJobTip` y `mechanicRosterTip` de páginas y diálogos. Un solo subtítulo por pantalla.
  - Dentro de cada diálogo, una línea propia de esa acción:
    - **Rename Job:** EN "The new name shows on every Work Order that uses this Job. Its history stays." / ES "El nombre nuevo se ve en todos los Work Orders que usan este Job. Su historial se conserva.".
    - **Add Job:** EN "Use one name per kind of work so mechanics find it the same way every time." / ES "Usa un solo nombre por tipo de trabajo para que los mecánicos lo encuentren siempre igual.".
    - **Add person:** solo la frase de contraseña temporal que ya existe en `mechanicsWriteDescription`.
  - "This is not the full permissions screen" se quita: el Manager no tiene otra pantalla de permisos a la que ir.
- **Esfuerzo:** S

### UX-3-003 · El paso obligatorio de PM se llama "PM A Service"
- **Dónde:** Shop workflow, `/admin/setup/workflow`. Nombre del paso: `components/admin-shop-workflow.tsx:85` (`step.catalogJob.displayName`). Origen: `apps/api/src/work-orders/mandatory-jobs.ts:13`.
- **Evidencia:** (observado) `evidencia/00-shop-workflow-desktop.jpg`: primer paso "PM A Service", con subtítulo "PM". En el resto de la app el paso se llama "PM" (`calloutMissingSub`, `admin-messages.ts:699`: "Every Work Order needs PM, Alignment, Detailing and Quality Check").
- **Criterio:** Nielsen H4 (consistencia) · un concepto, un nombre.
- **Severidad:** 2 · El Manager lee que el paso fija el servicio A, cuando A/B lo elige el mecánico. **Cambia por decisión:** el paso se llama "PM".
- **Recomendación:**
  - Nombrar los pasos por `step_key` con claves de mensajes: EN "PM" / ES "PM".
  - Línea de ayuda: EN "Starts as PM A. The PM mechanic can switch it to PM B." / ES "Empieza como PM A. El mecánico de PM puede cambiarlo a PM B.".
- **Esfuerzo:** S

### UX-3-004 · En español los pasos siguen en inglés y repiten su categoría
- **Dónde:** Shop workflow. `admin-shop-workflow.tsx:85-86` muestra `catalogJob.displayName` y `catalogJob.categoryName` (datos en inglés).
- **Evidencia:**
  - (observado) `00-shop-workflow-desktop.jpg`: "Alignment (Suspension & Steering)", "Detailing (Detailing)", "Quality Check (Quality Check)".
  - (inferido del código) En ES, el Truck, el Work Plan y New Work Order dicen "Alineación", "Detallado" y "Control de calidad" (`admin-messages.ts:1304-1306`, `:1058`, `:1684`), según el glosario ("Mandatory step names (LTR-170)").
- **Criterio:** Nielsen H4 · i18n incompleta.
- **Severidad:** 2 · Es la pantalla que define esos pasos y es la única que los nombra distinto. El subtítulo repetido no aporta.
- **Recomendación:**
  - Usar las claves existentes `alignment`, `detailing`, `qualityCheck` (y la nueva de PM) por `step_key`.
  - Quitar la línea de categoría cuando coincide con el nombre del paso. Si se mantiene, escribirla como "Catalog Job: Alignment · Suspension & Steering" / "Job del catálogo: Alignment · Suspension & Steering", para que se lea como el dato que es.
- **Esfuerzo:** S

### UX-3-005 · "Safety (Quality Check) takes it from the queue" no dice que el Manager puede hacer QC
- **Dónde:** Shop workflow, fila Quality Check. `shopWorkflowQcOwner`, `admin-messages.ts:44` / `:1033`. Uso: `admin-shop-workflow.tsx:106`.
- **Evidencia:**
  - (observado) `00-shop-workflow-desktop.jpg`.
  - En el Dashboard el Manager ve "Waiting for Safety · Mark it here only if Safety cannot" (`:499`, `:592`). Pero al abrir `/qc` lo devuelve al Dashboard sin aviso (observaciones, "Manager en `/qc`").
  - El mismo concepto se llama "QC" (`:70`, `:28` "Mark QC complete"), "Quality Check" y "Safety".
- **Criterio:** Nielsen H2 y H4.
- **Severidad:** 2 · La regla vigente (D19) se cumple, pero el respaldo del Manager no aparece donde se configura. **Cambia por decisión:** el Manager usa la pantalla de QC como respaldo, y QC pasa a ser un equipo con cola como los demás pasos.
- **Recomendación:**
  - Con equipos, la fila QC usa el mismo control que las demás. Debajo: EN "Safety takes it from the queue. If no one from Safety can, the Shop Manager does the Quality Check." / ES "Safety lo toma de la cola. Si nadie de Safety puede, el Shop Manager hace el Control de calidad.".
  - Unificar el nombre del paso en "Quality Check" / "Control de calidad". "QC" solo en botones cortos y donde el espacio obliga.
- **Esfuerzo:** S

### UX-3-006 · "Default owner" no sirve para un paso con equipo y cola
- **Dónde:** Shop workflow.
  - `shopWorkflowDescription`, `admin-messages.ts:42` / `:1031`.
  - `shopWorkflowNoOwner`, `:43` / `:1032`.
  - `shopWorkflowOwnerFor`, `:46` / `:1035`.
  - `shopWorkflowInactiveOwner`, `:45` / `:1034`.
  - Uso: `admin-shop-workflow.tsx:89`, `:95`, `:100`.
- **Evidencia:** (observado) `00-shop-workflow-desktop.jpg`: una lista por paso, "No default owner", sin pista de carga ni de estado.
- **Criterio:** Nielsen H2 · vocabulario del concepto central.
- **Severidad:** 2 · Hoy es correcto. **Cambia por decisión:** cada paso tiene equipo y cola, y un Job sigue con un solo dueño (D11 enmendada). Si la UI mezcla "owner" (de un Job) con "team" (de un paso), el Manager no sabrá a quién llega el trabajo.
- **Recomendación (texto propuesto):**
  - **Subtítulo:** EN "Mandatory steps every new Work Order gets, and the team that does each one. Open Work Orders do not change." / ES "Pasos obligatorios de cada Work Order nuevo y el equipo que hace cada uno. Los Work Orders abiertos no cambian.".
  - **Etiqueta del control:** EN "Team for {step}" / ES "Equipo de {step}". **Vacío:** EN "No team: the Job starts unassigned." / ES "Sin equipo: el Job empieza sin asignar.".
  - **Regla bajo el control:**
    - EN "One person: the Job goes straight to them. Two or more: it waits in the team queue until someone takes it."
    - ES "Una persona: el Job va directo a ella. Dos o más: espera en la cola del equipo hasta que alguien lo toma."
  - **Persona inactiva:** EN "{name} is inactive and does not get new Jobs." / ES "{name} está inactiva y no recibe Jobs nuevos.".
  - Reservar "owner / responsable" para el Job: "Job owner" / "responsable del Job".
- **Esfuerzo:** S (texto). El cambio de comportamiento es S1 del plan.

### UX-3-007 · Dos botones "Save" en la misma página; el primero no dice qué guarda
- **Dónde:** Shop workflow. `shopWorkflowSave`, `admin-messages.ts:47` / `:1036` ("Save" / "Guardar"), en `admin-shop-workflow.tsx:115`. `shopHoursSave`, `:57` / `:1045`, en `:210`.
- **Evidencia:** (observado) `00-shop-workflow-cambio-sin-guardar.jpg`, `00-shop-workflow-guardado.jpg`: "Save" y "Save shop hours" en la misma página.
- **Criterio:** Nielsen H4 · botones con verbo + objeto.
- **Severidad:** 2 · El Manager no sabe si "Save" guarda también el horario. Que el botón se vea apagado es tema de las skills 4 y 7.
- **Recomendación:** EN "Save steps" / ES "Guardar pasos". Toast: EN "Steps saved. New Work Orders use them from now on." / ES "Pasos guardados. Los Work Orders nuevos los usan desde ahora.".
- **Esfuerzo:** S

### UX-3-008 · La sección se llama "Mechanics" pero lista personas que no son mecánicos, y alterna "mechanic" con "person"
- **Dónde:** Mechanics lista y detalle.
  - "Mechanic": `mechanics`, `admin-messages.ts:17` (menú y encabezado de columna en `admin-mechanics-list.tsx:84`); `mechanicsTitle`, `:370`; `noMechanicsMatch`, `:415`; `mechanicNotFound`, `:423`; `noRecentClosedWorkOrders`, `:428`.
  - "Person": `createMechanic`, `:374`; `activateMechanicTitle`, `:384`; `deactivateMechanicTitle`, `:404`; toasts en `:387-389` y `:407-408`.
  - En ES igual: `:1007`, `:1357`, `:1361` y siguientes.
- **Evidencia:**
  - (observado) `00-mechanics-lista.jpg`: aparecen Cristian Perez e iBrain Admin con "Shop Admin · Standard · PM". El botón dice "Add person" bajo el título "Mechanics".
  - El formulario ofrece "Safety (Quality Check)", que no es un mecánico.
- **Criterio:** Nielsen H2 y H4 · un concepto, un nombre.
- **Severidad:** 3 · Es el concepto central de la pantalla. El Manager duda si "Add person" crea un mecánico y si un Safety o un admin debería estar ahí.
- **Recomendación:**
  - Llamar a la sección y a la columna EN "People" / ES "Personas".
  - Usar "person / persona" en todos los textos: "No people match these filters." / "Ninguna persona coincide con estos filtros."; "This person could not be found." / "No se encontró esta persona.".
  - "Mechanic" queda solo para el tipo (Standard, PM).
  - Si se prefiere mantener "Mechanics", sacar de la lista a quien no es Standard, PM ni Safety. Hoy no es así.
- **Esfuerzo:** S

### UX-3-009 · "Capabilities" mezcla el tipo de la persona con permisos internos
- **Dónde:** Mechanics lista, columna Capabilities (`admin-mechanics-list.tsx:103-107`), y detalle (`admin-mechanic-detail.tsx:36-37`).
  - Etiqueta: `capabilitiesLabel`, `admin-messages.ts:417` / `:1403`.
  - Mapeo: `ADMIN_CAPABILITY_KEY`, `:2007-2014`. Incluye "Shop Admin", "Work Orders" y "Yard"/"Patio".
  - El formulario llama al mismo dato "Type" / "Tipo" (`mechanicCapability`, `:378` / `:1365`).
- **Evidencia:** (observado) `00-mechanics-lista.jpg`: "Shop Admin · Standard · PM" en una misma fila.
- **Criterio:** Nielsen H2 (palabras del usuario, no del modelo de permisos) · H4.
- **Severidad:** 2 · El Manager elige un "Type" y luego lo encuentra como "Capabilities", mezclado con permisos que no puede cambiar desde aquí.
- **Recomendación:**
  - Columna y campo EN "Type" / ES "Tipo", con un solo valor: Standard, PM o Safety.
  - El acceso de admin va como insignia aparte: EN "Admin" / ES "Admin".
  - No mostrar "Work Orders" ni "Yard" en esta pantalla.
- **Esfuerzo:** S

### UX-3-010 · "Open Work Orders: 0" para quien tiene 9 Jobs pendientes
- **Dónde:** Mechanics lista (`admin-mechanics-list.tsx:111`) y detalle (`admin-mechanic-detail.tsx:40`, `:46`, `:62`). `openAssignments`, `admin-messages.ts:416` / `:1402`. `noOpenAssignments`, `:427` / `:1412`.
- **Evidencia:** (observado)
  - `00-mechanics-detalle.jpg`: Daniel (PM) muestra "Open Work Orders: 0" y "No open Work Orders assigned.".
  - `00-mechanics-desactivar-bloqueado-vs-0.jpg`: al desactivar aparecen 9 Jobs "PM A Service" en WO-003…WO-016.
  - En la lista, Alejandro 1 muestra 10 contra 7 en la base.
  - El contador cuenta `mechanic_assignments` y no los Jobs de los que la persona es dueña (plan, "Mechanics"). El recuento corregido es de las skills 6 y 8.
- **Criterio:** Nielsen H1 (visibilidad del estado) · H2.
- **Severidad:** 3 · El Manager decide desactivar o sacar a alguien según este número y el número lo engaña.
- **Recomendación:**
  - Contar por dueño del Job y decir qué se cuenta: EN "Pending Jobs" / ES "Jobs pendientes", con "in {n} Work Orders" / "en {n} Work Orders" debajo.
  - Vacío: EN "{name} has no pending Jobs." / ES "{name} no tiene Jobs pendientes.".
  - La lista del detalle debe ser la misma que muestra el bloqueo al desactivar.
- **Esfuerzo:** S en texto. El recuento es M (S3 del plan).

### UX-3-011 · "Job labor time is not available." es un texto fijo que no informa nada
- **Dónde:** Mechanics detalle. `jobLaborUnavailable`, `admin-messages.ts:429` / `:1414`. Uso: `admin-mechanic-detail.tsx:42`.
- **Evidencia:** (observado) `00-mechanics-detalle.jpg`. En ES: "El tiempo de labor por Job no está disponible." ("labor" es calco del inglés).
- **Criterio:** Nielsen H8 · H2.
- **Severidad:** 1 · No bloquea nada. Hace pensar que algo falla.
- **Recomendación:**
  - Quitarlo hasta mostrar el tiempo real de `work_sessions`.
  - Cuando exista: EN "Labor this week: 12 h 30 min" / ES "Tiempo trabajado esta semana: 12 h 30 min".
  - En ES usar "tiempo trabajado", no "tiempo de labor".
- **Esfuerzo:** S

### UX-3-012 · "No closed Work Orders assigned to this mechanic." junto a "Completed Jobs: 3"
- **Dónde:** Mechanics detalle, `admin-mechanic-detail.tsx:41` y `:82`. `completedJobsCount`, `admin-messages.ts:425`. `noRecentClosedWorkOrders`, `:428` / `:1413`. La tarjeta se titula "Recent closed Work Orders" (`:426`), pero el vacío habla de "assigned to this mechanic".
- **Evidencia:** (observado) `00-mechanics-detalle.jpg`.
- **Criterio:** Nielsen H1 · coherencia entre cifra y lista.
- **Severidad:** 2 · El Manager no sabe cuál de los dos datos creer.
- **Recomendación:**
  - Basar lista y cifra en los Jobs de los que la persona fue dueña.
  - Título: EN "Recent completed Jobs" / ES "Jobs completados recientes".
  - Vacío: EN "{name} has not completed any Jobs yet." / ES "{name} todavía no completó ningún Job.".
- **Esfuerzo:** S en texto. M si cambia la consulta.

### UX-3-013 · El diálogo de desactivar no avisa del trabajo abierto, y "Reassign first" pide algo que no se puede hacer ahí
- **Dónde:** Mechanics detalle, tarjeta Access.
  - `deactivateMechanicConfirm`, `admin-messages.ts:405` / `:1391`, en `admin-mechanic-roster.tsx:409`.
  - `mechanicOpenWorkTitle`, `:412` / `:1398`; `mechanicOpenWorkRunning`, `:413` / `:1399`. Bloque en `admin-mechanic-roster.tsx:289-304`.
  - `MECHANIC_HAS_OPEN_WORK` en `apps/web/src/lib/api-error-copy.ts:100` / `:161`.
- **Evidencia:** (observado)
  - `00-mechanics-desactivar-dialogo.jpg`: "This person will stop signing in… Nothing is deleted; their history stays.", sin aviso.
  - `00-mechanics-desactivar-bloqueado-vs-0.jpg`: solo después de confirmar aparece "Reassign first" con 9 Jobs y "Their labor time is running".
  - No hay botón para reasignar, solo enlaces a cada WO.
  - El error pide "stop their labor time", algo que el Manager no puede hacer desde aquí.
- **Criterio:** Nielsen H5 (prevención de errores) · H9 (ayudar a recuperarse).
- **Severidad:** 3 · Desactivar o sacar a alguien es la tarea 3 del contexto. El Manager confirma, choca con un bloqueo y no sabe cómo seguir.
- **Recomendación:**
  - Cargar el trabajo abierto al abrir el diálogo y decirlo antes de confirmar:
    - EN "{name} has {n} pending Jobs. Reassign each one from its Work Order, then come back to deactivate." / ES "{name} tiene {n} Jobs pendientes. Reasigna cada uno desde su Work Order y vuelve para desactivarla.".
  - Título EN "Pending Jobs to reassign" / ES "Jobs pendientes por reasignar".
  - Reloj corriendo: EN "{name} is clocked in on {job}. Ask them to stop, or complete the Job from its Work Order." / ES "{name} tiene el reloj corriendo en {job}. Pídele que lo detenga, o completa el Job desde su Work Order.".
  - El botón de confirmar no aparece hasta que no quede nada pendiente.
- **Esfuerzo:** S en texto. M si se carga el trabajo abierto antes de confirmar.

### UX-3-014 · No existe "Remove"; "Deactivate" carga con dos significados
- **Dónde:** Mechanics detalle, tarjeta Access (`admin-mechanic-roster.tsx:391-402`). `accessActiveHint` y `accessInactiveHint`, `admin-messages.ts:401-402`; `deactivateMechanic`, `:403`.
- **Evidencia:** (observado) observaciones, "Faltantes": no hay botón para borrar ni para sacar a la persona. Hoy "Deactivate" es lo único que hay, para una baja temporal y también para alguien que se fue.
- **Criterio:** Nielsen H2 · un verbo por acción.
- **Severidad:** 2 · **Cambia por decisión:** "Remove" oculta a la persona, bloquea su acceso y conserva su historial (D22 enmendada).
- **Recomendación:** dos acciones con verbos distintos.
  - **Deactivate / Desactivar** (vuelve con Reactivate). Ayuda: EN "Can't sign in for now. Stays in the list as Inactive. You can reactivate them." / ES "No puede entrar por ahora. Sigue en la lista como Inactiva. Puedes reactivarla.".
  - **Remove / Quitar del Shop** (definitivo). Diálogo:
    - EN "Remove {name} from the Shop? They can no longer sign in and disappear from lists and teams. Their history stays on past Work Orders." / ES "¿Quitar a {name} del Shop? Ya no podrá entrar y deja de aparecer en listas y equipos. Su historial sigue en los Work Orders anteriores.".
    - Botón: EN "Remove {name}" / ES "Quitar a {name}".
  - No usar "Delete / Eliminar" en la UI, salvo para el borrado real de alguien sin historial. Ese caso dice: EN "Delete {name}? They never worked on a Job. This cannot be undone." / ES "¿Eliminar a {name}? Nunca trabajó en un Job. No se puede deshacer.".
- **Esfuerzo:** S en texto (comportamiento en S3).

### UX-3-015 · "The Job id stays the same" es jerga de base de datos
- **Dónde:** Job Catalog. `catalogWriteDescription`, `admin-messages.ts:88` / `:1076` ("El id del Job no cambia."). `catalogAddJobTip`, `:97` / `:1085` ("Rename or activate keeps the Job id"). Uso: `admin-catalog-list.tsx:32`, `admin-catalog-category-detail.tsx:27`.
- **Evidencia:** (observado) `00-catalogo-lista.jpg`.
- **Criterio:** Nielsen H2 (palabras del usuario, no del modelo de datos).
- **Severidad:** 2 · El Manager no sabe qué es un id. La preocupación real (¿se pierde la historia si renombro?) queda sin respuesta.
- **Recomendación:** subtítulo EN "Categories and Jobs the Shop uses. Renaming a Job keeps its history and every Work Order that uses it." / ES "Categorías y Jobs que usa el Shop. Renombrar un Job conserva su historial y todos los Work Orders que lo usan.".
- **Esfuerzo:** S

### UX-3-016 · El detalle de categoría solo ofrece "Rename Job"; faltan los textos de las protecciones
- **Dónde:** Job Catalog detalle (`admin-catalog-category-detail.tsx:46-55`), acciones en `admin-catalog-write.tsx:90-94` (`catalogRenameJob`, `catalogActivateJob`, `admin-messages.ts:90-91`).
- **Evidencia:** (observado) `00-catalogo-categoria.jpg`: cada Job es nombre + "Aliases: …" + "Rename Job". No hay estado, desactivar, borrar ni editar alias. Un riesgo del plan es que desactivar el Job de un paso lo saca del flujo sin aviso.
- **Criterio:** Nielsen H5 (prevención de errores) · H1.
- **Severidad:** 2 · **Cambia por decisión:** catálogo gestionable con protecciones (reemplaza D25). Sin estos textos, las protecciones van a parecer errores.
- **Recomendación (texto propuesto):**
  - **Insignia de Job de sistema:** EN "System Job" / ES "Job del sistema". Ayuda: EN "A Shop workflow step uses this Job. You can rename it, but not deactivate or delete it." / ES "Un paso del flujo del Shop usa este Job. Puedes renombrarlo, pero no desactivarlo ni eliminarlo.".
  - **Desactivar:**
    - EN "Deactivate {job}? Mechanics stop seeing it when adding work. Work Orders that already have it keep it." / ES "¿Desactivar {job}? Los mecánicos dejan de verlo al agregar trabajo. Los Work Orders que ya lo tienen lo conservan.".
  - **Eliminar un Job ya usado:**
    - EN "{job} is on {n} Work Orders, so it was deactivated instead of deleted. Its history stays." / ES "{job} está en {n} Work Orders, así que se desactivó en lugar de eliminarse. Su historial se conserva.".
  - **Categoría de sistema:** EN "System Category: the Shop workflow uses it." / ES "Categoría del sistema: la usa el flujo del Shop.".
- **Esfuerzo:** S en texto (comportamiento en S2).

### UX-3-017 · Alias casi duplicados por una diferencia de tilde
- **Dónde:** Job Catalog detalle, Fuel System → Fuel Lines (`admin-catalog-category-detail.tsx:53`). Datos: `apps/api/prisma/job-catalog.ts:99` (`['líneas de combustible', 'lineas de combustible']`). Normalización: `apps/api/src/job-catalog/job-catalog.service.ts:4-5` (`text.toLowerCase().replace(/[^a-z0-9]/g, '')`).
- **Evidencia:**
  - (observado) `00-catalogo-categoria.jpg`: "Aliases: líneas de combustible, lineas de combustible".
  - (inferido del código) La normalización borra la "í" en lugar de quitarle la tilde: "líneas" queda "lneas". Por eso hizo falta guardar las dos formas.
- **Criterio:** Nielsen H8 · calidad del contenido.
- **Severidad:** 1 · Es ruido visual. Pero cuando el Manager edite alias, va a ver repeticiones y no sabrá cuál borrar.
- **Recomendación:**
  - Normalizar quitando tildes (`normalize('NFD')` y quitar marcas diacríticas antes del filtro) y dejar un solo alias, "líneas de combustible".
  - Con edición de alias, el error que ya existe (`CATALOG_ALIAS_EXISTS`, `api-error-copy.ts:83` / `:144`) cubre el caso: "That alias is already used by another catalog Job.".
- **Esfuerzo:** S

### UX-3-018 · Inglés filtrado y mezclas en el catálogo español
- **Dónde:** `admin-messages.ts`, ES.
  - `catalogDescription`, `:1064`: "Categories, Jobs y aliases".
  - `catalogNoCategories`, `:1069`: "No hay Job Categories registradas.".
  - `catalogTitle`, `:1063` ("Catálogo de Jobs"), frente a `catalogWriteForbidden`, `catalogWriteFailed` y `catalogWriteConflict`, `:1089-1091` ("Job Catalog").
  - `mechanicWriteForbidden`, `:1377`: "roster".
  - `mechanicEmail`, `:1364` ("Email"), frente a `searchMechanics`, `:1400` ("correo").
  - `shopWorkflow`, `:1030` ("Flujo del taller"), frente a "Shop" en el resto del producto (glosario: Shop se queda en inglés).
  - `catalogInactive`, `:1073`: "Inactivo" en masculino, también como insignia de **categoría** (`admin-catalog-list.tsx:63`, `admin-catalog-category-detail.tsx:28`).
- **Evidencia:** (inferido del código). Las capturas son en EN.
- **Criterio:** i18n incompleta · Nielsen H4.
- **Severidad:** 2 · Sistémico. Cada uno es menor; juntos, la versión ES se lee como traducción a medias.
- **Recomendación (todo en un PR):**
  - "Categorías, Jobs y alias"; "No hay categorías registradas.".
  - "Catálogo de Jobs" en todos los textos (el glosario decía "Job Catalog stays English": actualizarlo).
  - "roster" → "la lista de personas".
  - "Correo" en etiqueta y búsqueda.
  - "Flujo del Shop".
  - Insignia de categoría: "Inactiva", con clave aparte `catalogCategoryInactive`.
- **Esfuerzo:** S

### UX-3-019 · Tres maneras de decir "no tienes permiso" y dos voces en los errores
- **Dónde:** `admin-messages.ts`.
  - Permisos:
    - `shopWorkflowReadOnly`, `:50` ("Only a Shop Manager or the System Admin can change this.");
    - `catalogWriteForbidden`, `:101` ("Only the Shop Manager or the System Admin…");
    - `mechanicWriteForbidden`, `:390` ("Only the Manager or a System Admin can change the roster.").
    - En ES, "puede" (`:1039`, `:1089`) frente a "pueden" (`:1377`).
  - Voz: "We could not save…" (`:102`, `:391`) frente a "Could not save…" (`:49`, `:60`).
  - Genéricos: `loadError`, `:154` ("Unable to load current administrative data."); `mechanicSaved`, `:389` ("Saved."); `catalogJobAdded`, `:98` ("Job added.", sin nombre).
- **Evidencia:** (inferido del código).
- **Criterio:** voz y tono · Nielsen H4 · H9.
- **Severidad:** 1 · No impide nada, pero suma a la sensación de textos escritos en momentos distintos.
- **Recomendación:**
  - **Permisos, un solo patrón:** EN "Only the Shop Manager or a System Admin can change {thing}." / ES "Solo el Shop Manager o un System Admin pueden cambiar {thing}.".
  - **Errores en forma impersonal:** EN "Could not save {thing}. Try again." / ES "No se pudo guardar {thing}. Inténtalo de nuevo.".
  - **Carga:** EN "Could not load this page. Check your connection and retry." / ES "No se pudo cargar esta página. Revisa la conexión y reintenta.".
  - **Éxitos con objeto:** EN "{job} added to {category}." / ES "{job} agregado a {category}."; EN "{name} saved." / ES "{name} guardada.".
- **Esfuerzo:** S

### UX-3-020 · No hay sección ni vocabulario para partes y costos
- **Dónde:** menú Setup (`navGroupSetup`, `admin-messages.ts:108` / `:1096`). Solo tiene Mechanics, Job Catalog y Shop workflow.
- **Evidencia:** (observado) observaciones, "Partes": no hay entrada ni pantalla.
- **Criterio:** Nielsen H2 · arquitectura de contenido (ver skill 5).
- **Severidad:** 2 · **Cambia por decisión:** Partes y costos, etapa 1 (reemplaza D24). Conviene fijar los términos antes de construir, para no repetir lo de Mechanics.
- **Recomendación:**
  - Sección EN "Parts and costs" / ES "Partes y costos".
  - Subpáginas EN "Parts", "Purchases", "Outside repairs" / ES "Partes", "Compras", "Reparaciones externas".
  - Pestaña del Truck EN "Costs" / ES "Costos".
  - "Vendor" / "Proveedor". "Invoice" / "Factura". Sin "stock" ni "inventory", que no existen en la etapa 1.
- **Esfuerzo:** S en texto.

## Glosario propuesto

Términos de las pantallas de Setup. Los marcados **(nuevo)** vienen de las decisiones del dueño y todavía no existen en la UI.

| Término recomendado (EN / ES) | Sinónimos encontrados | Dónde aparecen |
|---|---|---|
| **Step** / **Paso** | "workflow steps", "required steps", "Mandatory steps" | `admin-messages.ts:51`, `:498` |
| **Team** / **Equipo** (nuevo): personas que pueden hacer un paso | "Default owner" / "responsable por defecto" (hoy, una sola persona) | `:42-46`, `:1031-1035` |
| **Team queue** / **Cola del equipo** (nuevo): Jobs sin dueño de un paso con 2+ personas, esperando a que alguien los tome | "the queue" / "la cola" (solo QC) | `:44`, `:1033` |
| **Take** / **Tomar** (nuevo): pasar un Job de la cola a mi nombre. **Release** / **Soltar**: devolverlo a la cola | "takes it from the queue" | `:44` |
| **Job owner** / **Responsable del Job**: la única persona dueña de un Job | "assigned", "assignee", "owner" | `:401`, `:427`, glosario `jobUnassigned` |
| **PM** / **PM** (nombre del paso). "PM A" / "PM B" solo como alcance | "PM A Service", "PM service" | `admin-shop-workflow.tsx:85`, `mandatory-jobs.ts:13` |
| **Quality Check** / **Control de calidad** (paso). **Safety** (tipo de persona) | "QC", "Safety (Quality Check)" | `:28`, `:44`, `:70`, `:422` |
| **Person** / **Persona** (cualquier usuario del Shop). **Mechanic** solo para tipos Standard y PM | "Mechanics", "mechanic", "person" | `:17`, `:370-428` |
| **Type** / **Tipo**: Standard, PM, Safety | "Capabilities" / "Capacidades" | `:378`, `:417`, `:1403` |
| **Deactivate** / **Desactivar**: baja temporal, reversible | — | `:403-408` |
| **Remove** / **Quitar del Shop** (nuevo): definitivo, conserva historial, oculta de listas y equipos | "delete" (pedido del dueño) | — |
| **Delete** / **Eliminar**: solo para lo que nunca se usó (Job o persona sin historial) | — | — |
| **System Job** / **Job del sistema** (nuevo): Job que usa un paso del flujo; se renombra, no se desactiva ni se elimina | — | plan S2 (`system_key`) |
| **Category** / **Categoría** | "Job Categories", "Categories" (en ES) | `:1064`, `:1069` |
| **Alias** / **Alias** (plural igual): otro nombre por el que se encuentra un Job. Uno por forma, sin variantes de tilde | "Aliases" | `:79`, `:84`, `job-catalog.ts:99` |
| **Job Catalog** / **Catálogo de Jobs** | "Job Catalog" dentro de textos ES | `:1063` vs `:1089-1091` |
| **Pending Jobs** / **Jobs pendientes** | "Open Work Orders" (para contar Jobs de una persona) | `:416`, `:1402` |
| **Shop** / **Shop** | "taller" | `:1030`, `:1037-1048` |
| **Email** / **Correo** | "Email" y "correo" en ES | `:1364`, `:1400` |
| **Parts and costs** / **Partes y costos** (nuevo) | — | plan S4 |

## Guía de voz observada

- **Domina:** en EN una voz neutra, imperativa y breve ("Enter a name.", "Choose a Category."). En ES, tuteo consistente ("Escribe", "Elige", "Inténtalo"). No hay usted, exclamaciones ni mayúsculas gritonas.
- **Se rompe en:** la primera persona ocasional ("We could not save…") frente a la impersonal ("Could not save…"); los párrafos de permisos que empiezan con el rol en estilo telegráfico ("Manager or System Admin."); los textos con vocabulario técnico (id, roster, labor, capabilities).
- **Recomendada:** impersonal y en tú en ES, verbo + objeto en botones, y cada texto de ayuda dice qué pasa en el taller ("el Job espera en la cola del equipo"), no qué pasa en la base de datos.

## Lo que funciona bien

- **Errores de API traducidos:** cada código de la API tiene una frase EN/ES en `apps/web/src/lib/api-error-copy.ts`. No llegan mensajes crudos al Manager (por ejemplo `CATALOG_ALIAS_EXISTS`, `MECHANIC_EMAIL_EXISTS`). No tocar ese patrón; extenderlo para los códigos nuevos de S1–S4.
- **Contraseña temporal:** el texto dice qué hacer y cuándo desaparece: "Pass it to the person; the app will ask them to change it when they sign in. It is shown only once." (`admin-messages.ts:395`).
- **Shop hours:** explica el efecto real en el taller, no la configuración ("the app stops every clock still running; … Mechanics tap Continue the next day", `:54`). Su validación dice la regla correcta (`shopHoursInvalid`, `:59`).
- **Ayudas de acceso:** dicen la consecuencia concreta: "Does not sign in or appear in assignee lists. Their history stays." (`:402`). Es el modelo a seguir para Remove.
- **Validaciones de campo:** son específicas y en el idioma correcto, sin mensajes de librería en inglés: "Choose an active Category. Inactive Categories cannot take a new Job." (`:96`).

## Fuera de alcance / no verificado

- No se recorrió la app en esta corrida (sin navegador, por instrucción). Lo marcado (observado) viene de `evidencia/observaciones-navegador.md` y sus capturas `00-*.jpg`, tomadas en EN. **La versión ES no se vio en pantalla**: los hallazgos ES son (inferido del código).
- No se provocaron los errores de escritura (`catalogWriteConflict`, `mechanicWriteConflict`, 403 de System Admin), ni la vista de solo lectura de un usuario sin `work_orders.manage`.
- Los nombres de categoría y Job del catálogo son datos en inglés. `displayNameEs` existe en `apps/api/prisma/job-catalog.ts`, pero la UI no lo usa. Se reporta solo para los pasos obligatorios (UX-3-004). Traducir el catálogo entero queda como decisión del dueño.
- Los recuentos incorrectos (UX-3-010, UX-3-012) se tratan aquí solo como texto. La causa de datos corresponde a las skills 6 y 8 y a `OPEN_ISSUES` (ME#).
