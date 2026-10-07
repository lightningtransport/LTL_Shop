# 06 · Estados del sistema — Lightning Shop, Setup del admin

**Fecha:** 2026-10-07 · **Alcance:** Shop workflow (con Shop hours de pasada), Job Catalog (lista, detalle de categoría, diálogos Add/Rename Job), Mechanics (lista, detalle, diálogos Add person, Desactivar, Reset password) y la ausencia de Partes · **Método:** código + observaciones del navegador del 2026-10-07 (`evidencia/observaciones-navegador.md`, capturas `evidencia/00-*.jpg`). En esta corrida no se usó el navegador: lo que no está en esas observaciones es `(inferido del código)`.

**Resumen:** 24 hallazgos, 11 de severidad 3-4. Cargar y fallar al cargar están bien resueltos con primitivas comunes (`PageSkeleton`, `LoadFailure`, `EmptyState`). Lo que no está diseñado son los estados **silenciosos**: un dueño por defecto inactivo o sin la capacidad, un paso cuyo Job se desactivó, una categoría inactiva, un conteo de trabajo abierto que contradice al bloqueo. Todos se ven bien en Setup y fallan días después en el patio. Seis brechas no son defectos, sino que **cambian por decisión del dueño** (UX-6-019 a UX-6-024).

## Matriz pantalla × estado

`✓` correcto · `△` existe pero deficiente · `✗` no existe · `–` no aplica · `?` no verificado

| Pantalla | Vacío / primer uso | Cargando | Parcial | Error | Éxito | Deshab. / solo lectura | Ítems inactivos | Conflictos | Cambios sin guardar | Sesión |
|---|---|---|---|---|---|---|---|---|---|---|
| Shop workflow (pasos) | △ UX-6-001 | △ UX-6-003 | – | ✗ UX-6-004, UX-6-005 | △ UX-6-014 | ✓ (texto de solo lectura) | ✗ UX-6-007, UX-6-008 | ✗ UX-6-005 | ✗ UX-6-016 | ? |
| Shop hours | – | ✓ | – | ✓ (mensaje por código) | ✓ toast | ✓ | – | – | ✗ UX-6-016 | ? |
| Catálogo · lista | ✓ (con CTA; filtro sin resultados distinto) | ✓ skeleton | – | ✓ LoadFailure + Retry | △ UX-6-015 | △ UX-6-017, UX-6-018 | △ UX-6-010 | – | – | ? |
| Catálogo · detalle de categoría | △ UX-6-010 | ✓ skeleton | – | ✓ 404 propio + LoadFailure | ✓ toast + recarga | △ UX-6-017 | ✗ UX-6-010, UX-6-021 | – | – | ? |
| Diálogos Add / Rename Job | – | ✓ (botones deshabilitados con `busy`) | – | △ UX-6-006 | ✓ toast + cierra | ✓ | △ UX-6-010 | △ UX-6-006 | ? | ? |
| Mechanics · lista | △ UX-6-002 | ✓ skeleton + Load more | ✓ Load more | ✓ LoadFailure + Retry | ✓ toast | △ UX-6-017 | ✓ (Show inactive + Activate) | ✗ UX-6-011 | – | ? |
| Mechanic · detalle | – | ✓ skeleton | △ UX-6-012 | ✓ 404 propio + LoadFailure | ✓ toast | △ UX-6-017 | ✓ badge + Reactivate | ✗ UX-6-011 | ? | ? |
| Diálogo Desactivar persona | – | ✓ | – | △ UX-6-013 | ✓ toast | ✓ (Deactivate deshabilitado con explicación) | ✗ UX-6-009 | △ UX-6-013 | – | ? |
| Diálogo Add person | – | ✓ | – | ✓ (409 de email propio) | ✓ (pantalla de contraseña temporal) | ✓ | – | ✓ | ? | ? |
| Partes (no existe) | ✗ UX-6-024 | – | – | – | – | – | – | – | – | – |

Celdas `✗`: 11. Columna peor resuelta: **Ítems inactivos**, sin ninguna celda `✓` en las pantallas de pasos y catálogo.

## Hallazgos

### Vacío y primer uso

### UX-6-001 · Los pasos sin dueño no dicen qué pasa con las Work Orders nuevas
- **Dónde:** Shop workflow (`/admin/setup/workflow`) · `apps/web/src/components/admin-shop-workflow.tsx:100` (opción "No default owner") y `:76` (vacío total)
- **Evidencia:** `evidencia/00-shop-workflow-desktop.jpg` (observado): en la demo los 4 pasos arrancan en "No default owner" y nada avisa que así cada WO nueva sale con esos Jobs sin asignar. Si no hay pasos, `:76` pinta solo "No workflow steps are configured yet." (inferido del código), sin explicar que `mandatory-jobs.ts:88-99` igual crea los pasos, sin dueño.
- **Criterio:** Nielsen H1 (visibilidad del estado del sistema) · estado vacío de primer uso
- **Severidad:** 2 · Frecuencia baja (primera configuración), impacto medio (WOs sin dueño hasta que alguien lo note), se corrige una vez
- **Recomendación:** Bajo cada paso sin dueño, una línea de advertencia: "Sin dueño: las Work Orders nuevas dejan este paso sin asignar." Arriba, si algún paso no tiene dueño, un aviso: "2 pasos sin dueño por defecto".
- **Esfuerzo:** S

### UX-6-002 · La lista de Mechanics vacía dice "no coinciden los filtros" aunque no haya filtros
- **Dónde:** Mechanics (`/admin/mechanics`) · `apps/web/src/components/admin-mechanics-list.tsx:74`
- **Evidencia:** (inferido del código) `{!isLoading && !error && items.length === 0 ? <EmptyState><p>{messages.noMechanicsMatch}</p></EmptyState> : null}`. Es el mismo texto ("No mechanics match these filters.") con o sin `search`/`includeInactive`, y no trae el botón "Add person", que el catálogo sí pone en su vacío (`admin-catalog-list.tsx:46`).
- **Criterio:** Nielsen H1 · vacío de primer uso distinto de filtro sin resultados
- **Severidad:** 2 · Frecuencia baja, impacto bajo; confunde sobre todo después de una búsqueda con el filtro de inactivos
- **Recomendación:** Dos ramas: sin filtros, "Todavía no hay personas en el taller" + "Add person". Con filtros, repetir lo buscado ("Nadie coincide con 'dan'") + "Clear filters".
- **Esfuerzo:** S

### Cargando

### UX-6-003 · Las listas de dueños se ven vacías mientras cargan o si fallan, sin aviso
- **Dónde:** Shop workflow · `apps/web/src/components/admin-shop-workflow.tsx:21` y `:32-35`
- **Evidencia:** (inferido del código) `const { data: mechanicPages } = useAdminAssignableMechanics();` ignora `isLoading` y `error`. Mientras carga o si falla, cada `Select` muestra solo "No default owner" (más el dueño guardado). El Manager concluye que nadie puede hacer ese paso. No hay `LoadFailure` ni Retry para esa lectura (`lib/admin-data.ts:159-174`).
- **Criterio:** Nielsen H1 · H9 (reconocer y recuperarse de errores)
- **Severidad:** 3 · Frecuencia baja (red lenta o API caída), impacto alto (información falsa: "no hay nadie elegible"), no se distingue del caso real
- **Recomendación:** Mientras `isLoading`, deshabilitar los `Select` con el texto "Cargando personas…". Si hay `error`, poner un `LoadFailure` acotado a la tarjeta ("No se pudo cargar la lista de personas" + Retry) y no dejar guardar.
- **Esfuerzo:** S

### Error

### UX-6-004 · El error al guardar el flujo es genérico, dice "recarga" y aparece lejos del botón
- **Dónde:** Shop workflow · `apps/web/src/components/admin-shop-workflow.tsx:49-50` y `:73` · texto en `apps/web/src/lib/admin-messages.ts:49`
- **Evidencia:** (inferido del código) `} catch { setSaveError(messages.shopWorkflowSaveFailed); }` descarta el código de la API (`OWNER_NOT_ELIGIBLE`, `STEP_HAS_NO_OWNER`, `UNKNOWN_STEP`, 403), aunque `api-error-copy.ts:105` ya tiene "That person cannot own this step.". El texto pide "Refresh and try again", que no arregla un dueño no elegible. El `InlineAlert` va arriba de todo (`:73`) y el botón Save abajo (`:115`): en el teléfono el aviso queda fuera de la pantalla. Shop hours, en la misma página, sí usa `apiErrorMessage` (`:155`).
- **Criterio:** Nielsen H9 · error de sistema vs error de usuario
- **Severidad:** 3 · Frecuencia media cuando hay dueños inactivos (ver UX-6-005), impacto alto (el consejo es incorrecto), se repite
- **Recomendación:** Usar `apiErrorMessage(failure, messages, messages.shopWorkflowSaveFailed)` como en Shop hours. Para `OWNER_NOT_ELIGIBLE`, marcar el paso concreto ("Daniel ya no puede ser dueño de PM: está inactivo. Elige otro o deja sin dueño."). Poner el aviso junto al botón Save o hacer scroll hasta él.
- **Esfuerzo:** S

### UX-6-005 · Un dueño guardado que ya no es elegible bloquea guardar cualquier otro paso
- **Dónde:** Shop workflow · `apps/web/src/components/admin-shop-workflow.tsx:43-46` y `:56-63` · `apps/api/src/admin/shop-workflow.service.ts:81-87`
- **Evidencia:** (observado, y confirmado en el código; ver "Reproducción del bloqueo" en `evidencia/observaciones-navegador.md`). En la demo: Anthony quedó como dueño de Alignment, se le cambió el tipo a PM y al guardar Detailing apareció "Could not save the shop workflow. Refresh and try again.".
  - La lista conserva al dueño guardado aunque no sea elegible (`:58-61`).
  - `save()` envía **todos** los pasos con dueño posible, cambiados o no (`:43`).
  - La API valida cada uno y rechaza el lote completo con `OWNER_NOT_ELIGIBLE` (`shop-workflow.service.ts:82-86`).
  - Ejemplo: si Daniel (dueño de PM) se desactiva o pasa a Standard, cambiar el dueño de Detailing falla con "Could not save the shop workflow. Refresh and try again." (UX-6-004). Recargar no lo arregla. Solo funciona si el Manager adivina que tiene que quitar a Daniel de PM.
- **Criterio:** Nielsen H9 · H5 (prevención de errores)
- **Severidad:** 4 · Impide completar el flujo crítico 1 hasta descubrir la causa; persistente, porque cada intento falla igual
- **Recomendación:**
  - Enviar solo los pasos cambiados, o que la API acepte sin revalidar un dueño que no cambió.
  - Mostrar al dueño no elegible como opción deshabilitada con la etiqueta "(inactivo)" o "(ya no es PM)", y pedir explícitamente elegir otro.
- **Esfuerzo:** S

### UX-6-006 · "Ese nombre ya está en el catálogo" no dice dónde ni ofrece activarlo
- **Dónde:** Diálogos Add Job y Rename Job · `apps/web/src/components/admin-catalog-write.tsx:153-154` y `:230-231` · `apps/web/src/lib/system-admin.ts:55-60` · API `apps/api/src/admin/system-admin-writes.service.ts:351-369`
- **Evidencia:** (inferido del código)
  - `CATALOG_JOB_EXISTS` trae el `jobId` del Job existente, y `CATALOG_ALIAS_EXISTS` el `jobId` del Job dueño del alias.
  - `adminWriteFailureMessage` los traduce a texto plano: "That Job name is already in the Job Catalog." / "That alias is already used by another catalog Job.", sin enlace ni nombre.
  - Si el Job existente está inactivo o en otra categoría (el alias es único en todo el catálogo), el Manager no sabe dónde buscarlo.
  - `work-plan-add-work.tsx:127-140` ya resuelve este mismo código usando el `jobId`.
- **Criterio:** Nielsen H9 · H6 (reconocer antes que recordar)
- **Severidad:** 2 · Frecuencia baja, impacto medio (el Manager se rinde o crea un nombre parecido, como los aliases casi duplicados de "Fuel Lines" en `00-catalogo-categoria.jpg`)
- **Recomendación:** En el diálogo: "Ya existe 'Fuel Lines' en Fuel System (inactivo)", con los botones "Ver Job" y, si está inactivo, "Activar". Para el alias: "El alias 'líneas de combustible' pertenece a 'Fuel Lines' (Fuel System)".
- **Esfuerzo:** S

### Ítems inactivos (estados silenciosos)

### UX-6-007 · Un dueño por defecto que perdió la capacidad no muestra ningún aviso y deja el paso sin asignar
- **Dónde:** Shop workflow · `apps/web/src/components/admin-shop-workflow.tsx:87-91` · `apps/api/src/work-orders/mandatory-jobs.ts:51-56` y `:85` · DTO `packages/shared/src/types.ts:896`
- **Evidencia:** (inferido del código)
  - Al crear una WO, `usableDefaultOwner` devuelve `null` si el dueño está inactivo **o** ya no tiene la capacidad, y el Job nace sin asignar.
  - La pantalla solo avisa del primer caso ("{name} is inactive. New Work Orders leave this step unassigned.").
  - El DTO `defaultMechanic: { id; name; active }` no trae capacidades. Si Daniel pasa de PM a Standard, el paso PM sigue mostrando "Daniel" como si todo estuviera bien.
  - Ninguna otra pantalla (Dashboard, Mechanics) señala que un paso está quedando sin dueño.
- **Criterio:** Nielsen H1 · consistencia entre lo configurado y lo que pasa
- **Severidad:** 3 · Frecuencia media (cambios de tipo o bajas), impacto alto (Jobs sin dueño en el patio, se descubren días después), silencioso
- **Recomendación:** Que la API devuelva `defaultMechanicUsable: boolean` y el motivo (`inactive` | `missing_capability`). Mostrar el mismo aviso de advertencia en los dos casos: "Daniel ya no es PM. Las Work Orders nuevas dejan este paso sin asignar." Contar los pasos con este problema en el encabezado de Setup.
- **Esfuerzo:** S

### UX-6-008 · Un paso cuyo Job o categoría se desactivó desaparece de las WOs nuevas sin aviso
- **Dónde:** Shop workflow · `apps/api/src/work-orders/mandatory-jobs.ts:70` · `apps/api/src/admin/shop-workflow.service.ts:18` y `:34-46` · `apps/web/src/components/admin-shop-workflow.tsx:81-108`
- **Evidencia:** (inferido del código)
  - `where: { active: true, catalogJob: { status: 'active', category: { status: 'active' } } }`: un paso con el Job o la categoría inactivos no se agrega a las WOs nuevas.
  - `list()` no selecciona `catalogJob.status`, el estado de la categoría ni usa `row.active`, así que la pantalla pinta el paso igual que uno vigente.
  - Así se ve igual un paso que sí se aplica que uno que dejó de aplicarse. El Dashboard luego dice "Every Work Order needs PM, Alignment, Detailing and Quality Check. Each is added with its default owner." (observado), y eso ya no es cierto.
- **Criterio:** Nielsen H1 · prevención de errores (H5)
- **Severidad:** 3 · Frecuencia baja (recarga del catálogo, fusiones como LTR-24), impacto alto (WOs sin Detailing o sin QC), totalmente invisible
- **Recomendación:** Devolver el estado del Job, de la categoría y del paso. En la fila, poner el badge "No se aplica" y el texto "El Job 'Detailing' está inactivo en el catálogo: las Work Orders nuevas no reciben este paso.", con un enlace "Activar en el catálogo".
- **Esfuerzo:** S

### UX-6-009 · Desactivar o cambiar el tipo de una persona no avisa que es dueña por defecto de un paso
- **Dónde:** Mechanic detalle · diálogo Desactivar `apps/web/src/components/admin-mechanic-roster.tsx:406-417` · editor de tipo `:240-277` · API `apps/api/src/admin/system-admin-writes.service.ts:145-162`
- **Evidencia:** (inferido del código)
  - La API bloquea la desactivación solo por Jobs pendientes o tiempo corriendo (`openWorkOf`), no por ser dueño por defecto.
  - Cambiar de PM a Standard (`input.mode`) no se bloquea ni se advierte.
  - El diálogo solo dice "This person will stop signing in… Nothing is deleted" (`00-mechanics-desactivar-dialogo.jpg`, observado).
  - Resultado: UX-6-007 se dispara sin que el Manager lo sepa.
- **Criterio:** Nielsen H5 (prevención de errores) · H1
- **Severidad:** 3 · Frecuencia media, impacto alto y diferido
- **Recomendación:** En los dos lugares: "Daniel es el dueño por defecto de PM. Las Work Orders nuevas quedarán sin dueño en PM." con el enlace "Cambiar en Shop workflow". Si la API ya resuelve la cola por equipo (UX-6-019), el aviso nombra el equipo que absorbe el paso.
- **Esfuerzo:** S

### UX-6-010 · Una categoría inactiva solo muestra un badge: no dice por qué ni qué se puede hacer, y sus Jobs se pueden "activar" sin efecto
- **Dónde:** Catálogo lista `apps/web/src/components/admin-catalog-list.tsx:63` · detalle `apps/web/src/components/admin-catalog-category-detail.tsx:28-36`, `:55` y `:60-72` · API `apps/api/src/admin/system-admin-writes.service.ts:309-333`
- **Evidencia:** captura del dueño en producción: Alignment y Air System con "Inactive" (observado). En el código (inferido):
  - Las acciones de categoría se ocultan si está inactiva (`:29`).
  - El vacío dice "No Jobs are recorded in this Category." sin el motivo (`:60-61`).
  - Cada Job sigue mostrando "Rename Job" y "Activate" (`:55`). `updateCatalogJob` no revisa la categoría, así que el toast dice "Job activated.", pero `mandatory-jobs.ts:70` y el selector de trabajos siguen ignorando ese Job porque la categoría está inactiva.
- **Criterio:** Nielsen H1 · H9 · estado deshabilitado sin explicación
- **Severidad:** 3 · Frecuencia baja, impacto medio-alto (falso éxito), confunde cada vez
- **Recomendación:** Bajo el título de una categoría inactiva: "Categoría inactiva desde la fusión LTR-24: sus Jobs no se pueden elegir en Work Orders." Ocultar "Activate" en sus Jobs o explicar "Activa primero la categoría". La acción "Activar categoría" llega con la gestión del catálogo (UX-6-021).
- **Esfuerzo:** S

### Conflictos y datos contradictorios

### UX-6-011 · "Open Work Orders: 0" mientras la persona tiene 9 Jobs pendientes
- **Dónde:** Mechanics lista `apps/web/src/components/admin-mechanics-list.tsx:111` · detalle `apps/web/src/components/admin-mechanic-detail.tsx:40` y `:48-62` · cálculo `apps/api/src/admin/admin.service.ts:2512-2523` vs `apps/api/src/admin/system-admin-writes.service.ts:231-259`
- **Evidencia:** `evidencia/00-mechanics-desactivar-bloqueado-vs-0.jpg` y la tabla de `observaciones-navegador.md` (observado): Daniel tiene 9 en la base y 0 en pantalla; Alejandro 1 tiene 7 en la base y 10 en pantalla. La causa (inferido del código):
  - La pantalla cuenta `mechanicAssignments`, es decir, asignaciones a nivel Work Order.
  - El bloqueo de desactivar cuenta `workOrderJob.assignedMechanicId` con `status: 'to_do'`, es decir, Jobs.
  - Son dos fuentes distintas para la misma pregunta.
- **Criterio:** Nielsen H1 · consistencia (H4)
- **Severidad:** 3 · Frecuencia alta (toda persona con Jobs asignados por paso), impacto alto: el Manager decide desactivar o repartir trabajo con un número falso
- **Recomendación:** Una sola fuente: contar Jobs pendientes y Work Orders distintas desde `workOrderJob.assignedMechanicId`, la misma consulta que `openWorkOf`. La columna dice "9 Jobs · 9 WOs" y el detalle lista esos Jobs.
- **Esfuerzo:** M

### UX-6-012 · El detalle de la persona se contradice: "Completed Jobs: 3" y "No closed Work Orders"
- **Dónde:** Mechanic detalle · `apps/web/src/components/admin-mechanic-detail.tsx:41-42` y `:68-82` · `apps/api/src/admin/admin.service.ts:545-555`
- **Evidencia:** `evidencia/00-mechanics-detalle.jpg` (observado):
  - "Completed Jobs: 3" sale de `workOrderJob.completedById`, mientras que "No closed Work Orders assigned to this mechanic." sale de `mechanicAssignments`.
  - "Job labor time is not available." aparece siempre, como un estado parcial permanente.
- **Criterio:** Nielsen H1 · estado parcial
- **Severidad:** 2 · Frecuencia alta, impacto medio (desconfianza en la pantalla), no bloquea
- **Recomendación:** Usar la misma fuente de Jobs que UX-6-011 para "Trabajo reciente". Quitar la línea de horas hasta que existan, o reemplazarla por el total real de `workSession`.
- **Esfuerzo:** M

### UX-6-013 · El diálogo Desactivar muestra la lista que lo bloquea recién después de confirmar
- **Dónde:** Diálogo Desactivar · `apps/web/src/components/admin-mechanic-roster.tsx:343-359` y `:406-417`
- **Evidencia:** `evidencia/00-mechanics-desactivar-dialogo.jpg` → `00-mechanics-desactivar-bloqueado-vs-0.jpg` (observado). El primer paso dice "Nothing is deleted". Solo al pulsar el botón destructivo aparece "Reassign first" con 9 "PM A Service" y "Their labor time is running". No hay forma de reasignar desde ahí, solo enlaces a cada WO.
- **Criterio:** Nielsen H5 (prevención de errores) · H3 (control del usuario)
- **Severidad:** 3 · Frecuencia media en cada baja, impacto alto (9 viajes a 9 WOs), se repite
- **Recomendación:** Al abrir el diálogo, consultar el trabajo abierto (un `GET` con la misma lógica de `openWorkOf`). Si hay, mostrarlo antes de cualquier confirmación, con "Reasignar todos a…" (selector de persona del mismo tipo o la cola del equipo). Deshabilitar Deactivate hasta que no quede nada.
- **Esfuerzo:** M

### Éxito y confirmación

### UX-6-014 · No se nota cuándo hay cambios por guardar ni qué se guardó
- **Dónde:** Shop workflow · `apps/web/src/components/admin-shop-workflow.tsx:36`, `:48` y `:115`
- **Evidencia:**
  - Observado: `00-shop-workflow-cambio-sin-guardar.jpg` vs `00-shop-workflow-desktop.jpg`, el botón Save se ve igual de apagado antes y después de cambiar un dueño. Tras guardar, el toast "Shop workflow saved." no dice qué cambió (`00-shop-workflow-guardado.jpg`).
  - Inferido del código: el DTO trae `updatedAt` y `updatedBy`, pero la pantalla no los muestra.
- **Criterio:** Nielsen H1 · confirmación con contenido
- **Severidad:** 2 · Frecuencia media, impacto medio (duda si se guardó, cambios que se quedan sin guardar)
- **Recomendación:** Con cambios pendientes, poner "1 cambio sin guardar" junto a Save y el botón en variante primaria. Tras guardar: "Detailing → Anthony. Las Work Orders nuevas lo usan desde ahora." Al pie de la tarjeta: "Último cambio: Cristian, hoy 10:42".
- **Esfuerzo:** S

### UX-6-015 · Al volver a la lista del catálogo, los conteos pueden mostrar datos de hace 30 s
- **Dónde:** Catálogo · `apps/web/src/lib/admin-data.ts:252-261` · `apps/web/src/components/admin-catalog-category-detail.tsx:34` y `:55`
- **Evidencia:** (inferido del código) Después de Add/Activate en el detalle, solo se hace `mutate()` del detalle. La lista usa `dedupingInterval: 30_000`, así que al volver dentro de esos 30 s los números de Jobs e Inactive Jobs pueden ser los de antes.
- **Criterio:** Nielsen H1 · éxito reflejado en la UI
- **Severidad:** 1 · Frecuencia baja, impacto bajo, se corrige solo
- **Recomendación:** Después de escribir, invalidar también la clave `/api/admin/catalog/categories` (`mutate` global de SWR).
- **Esfuerzo:** S

### Transversales

### UX-6-016 · Salir de Shop workflow con cambios sin guardar los pierde sin aviso
- **Dónde:** Shop workflow y Shop hours · `apps/web/src/components/admin-shop-workflow.tsx:36` y `:144` (cada sección calcula `dirty`, pero nadie lo usa al salir)
- **Evidencia:** (inferido del código) No hay ningún `beforeunload` ni guarda de ruta en `apps/web/src`. La página tiene dos botones de guardar independientes ("Save" y "Save shop hours", observado). Cambiar un dueño, guardar las horas y salir deja el dueño sin guardar, sin aviso.
- **Criterio:** Nielsen H3 (control del usuario) · H5
- **Severidad:** 3 · Frecuencia media, impacto alto y diferido (el Manager cree que configuró el paso y en el patio no pasa nada)
- **Recomendación:** Con `dirty`, registrar `beforeunload` e interceptar los enlaces del menú: "Tienes cambios sin guardar en Shop workflow. ¿Salir sin guardar?". Opcional: un solo Save para toda la página.
- **Esfuerzo:** S

### UX-6-017 · El modo solo lectura no se explica igual en las tres pantallas
- **Dónde:**
  - Shop workflow: `apps/web/src/components/admin-shop-workflow.tsx:19` y `:72`.
  - Catálogo: `admin-catalog-list.tsx:32-35`.
  - Mechanics: `admin-mechanics-list.tsx:41-48` y `admin-mechanic-detail.tsx:16` y `:29`.
  - Regla: `apps/web/src/lib/system-admin.ts:21-31`.
- **Evidencia:** (inferido del código)
  - Workflow muestra el texto "Only a Shop Manager or the System Admin can change this." Catálogo y Mechanics solo cambian el subtítulo y esconden los botones.
  - El detalle de una persona muestra el badge "Read only" sin motivo. Lo ve incluso un Manager con permisos cuando la persona tiene rol admin (`canEditRoster` exige `role === MECHANIC`).
  - Las reglas difieren: Workflow pide `WORK_ORDERS_MANAGE` o `ADMIN`; Catálogo y Mechanics piden `ADMIN_ACCESS` y `WORK_ORDERS_MANAGE`. Una misma persona puede editar una pantalla y no la otra.
- **Criterio:** Nielsen H4 (consistencia) · estado "sin permiso para una acción"
- **Severidad:** 2 · Frecuencia baja, impacto medio (no entiende por qué no puede)
- **Recomendación:** Un único `ReadOnlyNotice` con el motivo concreto ("Solo lectura: esta cuenta es de System Admin y se administra en otro lugar" / "Necesitas el permiso Shop Manager") y una sola regla `canShowManagerWrites` para las tres pantallas.
- **Esfuerzo:** S

### UX-6-018 · "Add Job" queda deshabilitado sin explicación cuando no hay categorías activas
- **Dónde:** Catálogo lista · `apps/web/src/components/admin-catalog-write.tsx:39` y `:178`
- **Evidencia:** (inferido del código) El botón queda con `disabled={!categoryId && activeCategories.length === 0}`. El texto que lo explica ("Choose an active Category. Inactive Categories cannot take a new Job.") vive dentro del diálogo, que no se puede abrir.
- **Criterio:** Estado deshabilitado sin motivo · Nielsen H1
- **Severidad:** 1 · Frecuencia muy baja
- **Recomendación:** Dejar el botón activo y que el diálogo explique, o poner un texto bajo el botón con el motivo.
- **Esfuerzo:** S

### Brechas que cambian por decisión del dueño

Estas no son defectos de la regla vigente (D11, D19, D22, D24, D25). Las decisiones del 2026-10-07 las cambian (`00-contexto.md` §6). Se registran para que el rediseño cubra sus estados desde el principio.

### UX-6-019 · Un paso tiene un solo dueño: si falta, el Job queda sin asignar en lugar de ir a la cola del equipo
- **Dónde:** Shop workflow · `apps/api/src/work-orders/mandatory-jobs.ts:44-56` · `apps/web/src/components/admin-shop-workflow.tsx:93-104`
- **Evidencia:** (inferido del código) La única salida para "dueño no disponible" es `null`. Las listas no dan pistas de carga ni de quién está ocupado (observado).
- **Criterio:** Cambia por decisión (equipo + cola por paso; un Job sigue con un solo dueño)
- **Severidad:** 3 · Es la raíz de UX-6-007 y UX-6-009
- **Recomendación:** Cada paso tiene un equipo y, opcionalmente, una persona por defecto. Sin persona usable, el Job va a la cola del equipo, y la fila lo dice: "Sin dueño: va a la cola de MD (3 personas)". Diseñar el estado "equipo vacío" ("MD no tiene personas activas") como error que bloquea guardar.
- **Esfuerzo:** L

### UX-6-020 · Quality Check dice "Safety lo toma de la cola" sin respaldo del Manager ni aviso si no hay Safety activo
- **Dónde:** Shop workflow · `apps/web/src/components/admin-shop-workflow.tsx:105-107` · texto en `admin-messages.ts:44`
- **Evidencia:** "Safety (Quality Check) takes it from the queue" (observado). Las capturas de producción muestran una sola persona Safety. Si esa persona se desactiva, la pantalla no cambia (inferido).
- **Criterio:** Cambia por decisión (el Manager hace QC como respaldo)
- **Severidad:** 2
- **Recomendación:** "Safety (1 persona activa) · respaldo: Shop Manager". Si no hay ninguna persona Safety activa, mostrar en advertencia: "No hay Safety activo: el Shop Manager completa QC desde el Dashboard".
- **Esfuerzo:** S

### UX-6-021 · El catálogo no permite desactivar Jobs ni gestionar categorías ni aliases
- **Dónde:** Catálogo detalle · `apps/web/src/components/admin-catalog-write.tsx:86-97` (solo Rename y Activate) · la API ya acepta `status` (`system-admin-writes.service.ts:318-326`)
- **Evidencia:** "No hay estado, desactivar, borrar ni editar aliases" (observado, `00-catalogo-categoria.jpg`).
- **Criterio:** Cambia por decisión (el Manager maneja categorías, Jobs y aliases con protecciones)
- **Severidad:** 2
- **Recomendación:** Diseñar los estados de las protecciones desde el inicio. Desactivar un Job que usa un paso: "Detailing es un paso obligatorio. Elige otro Job para ese paso antes de desactivarlo." Desactivar una categoría con Jobs en WOs abiertas: listar cuáles. Un alias duplicado: decir de qué Job es (UX-6-006).
- **Esfuerzo:** M

### UX-6-022 · El paso PM se titula con el nombre del Job ("PM A Service") y no con el del paso
- **Dónde:** Shop workflow · `apps/web/src/components/admin-shop-workflow.tsx:85-86`
- **Evidencia:** Título "PM A Service", subtítulo "PM" (observado, `00-shop-workflow-desktop.jpg`).
- **Criterio:** Cambia por decisión (etiqueta del paso "PM")
- **Severidad:** 1
- **Recomendación:** Título = nombre del paso ("PM"), subtítulo = Job del catálogo ("PM A Service · PM"). Así, si el Job queda inactivo (UX-6-008), el paso sigue reconocible.
- **Esfuerzo:** S

### UX-6-023 · No existe "Remove" para sacar a una persona de la lista conservando su historial
- **Dónde:** Mechanic detalle · `apps/web/src/components/admin-mechanic-roster.tsx:396-403` (solo Deactivate/Reactivate y Reset password)
- **Evidencia:** "No hay botón para borrar ni para sacar a la persona" (observado).
- **Criterio:** Cambia por decisión ("Remove" conserva el historial)
- **Severidad:** 2
- **Recomendación:** Diseñar sus estados: bloqueo previo con la lista de trabajo abierto (como pide UX-6-013), aviso si es dueña o integrante de un equipo, confirmación con contenido ("Daniel salió del taller. Su historial sigue en 12 WOs.") y cómo verla después (filtro "Removed").
- **Esfuerzo:** M

### UX-6-024 · Partes y costos no tienen pantalla: el origen de las partes del PM es invisible
- **Dónde:** Menú de Setup (solo Mechanics, Job Catalog y Shop workflow) · modelos `Part`, `PartCategory`, `PartFitment`, `PmServicePart` cargados por `apps/api/prisma/pm-parts.ts`
- **Evidencia:** No hay entrada de menú ni ruta (observado).
- **Criterio:** Cambia por decisión (Partes y costos por camión, etapa 1)
- **Severidad:** 2
- **Recomendación:** Al crear la pantalla, diseñar primero su vacío de primer uso ("Las partes del PM vienen de la lista base. Agrega una parte o un costo para empezar") y el estado "parte sin costo" como dato parcial visible, no como `—`.
- **Esfuerzo:** L

## Lo que funciona bien
- **Cargar y fallar al cargar tienen primitivas comunes:** `PageSkeleton` con `header={false}` evita saltos de layout, `LoadFailure` trae Retry, y el reintento automático de un fallo transitorio (`admin-data.ts:40-44` y `:66-79`) evita mostrar un error falso. Conviene no tocarlos y reusarlos para UX-6-003.
- **404 propios** en el detalle de categoría y en el de persona, con un botón para volver (`admin-catalog-category-detail.tsx:17-19`, `admin-mechanic-detail.tsx:18-20`).
- **El catálogo separa "sin categorías" de "sin coincidencias"** y ofrece la acción en el vacío (`admin-catalog-list.tsx:43-48`). Es el modelo para UX-6-002.
- **Alta de persona y Reset password** confirman con contenido: la contraseña temporal se muestra una vez con Copy, y hay un caso explícito para "este entorno no crea cuentas" (`admin-mechanic-roster.tsx:79-118`).
- **El bloqueo de desactivar es real y explica qué falta**, con enlaces a cada WO y el tiempo corriendo (`admin-mechanic-roster.tsx:280-307`). El problema es solo el momento en que aparece (UX-6-013).

## Fuera de alcance / no verificado
- **Sin navegador en esta corrida:** cargando, error de sistema (API caída), sin conexión y sesión expirada no se provocaron. Esas celdas son `?` o vienen del código.
  - Sesión: `lib/api.ts:163-166` borra el token y emite `ltl-auth-expired`. No se verificó si se conserva el borrador del Shop workflow (todo indica que no, porque el estado vive en `useState`).
- **Diálogos Add/Rename Job y Add person con cambios sin guardar:** no se revisó qué pasa al cerrarlos con texto escrito. Es tema de la skill 7.
- **Manager en `/qc`:** redirige sin mensaje (observado). Es un estado 403 de otra área: va en la auditoría de navegación o de `admin-truck-wo`.
- **El primer clic en una categoría que no navegó** (observado) es tema de las skills 5 y 8.
- **Textos concretos de los mensajes:** son de la skill 3. Aquí solo se juzgó si el estado existe y deja seguir.
- Las capturas son las de la observación del 2026-10-07 (`evidencia/00-*.jpg`). No se generaron capturas `06-*` nuevas.
