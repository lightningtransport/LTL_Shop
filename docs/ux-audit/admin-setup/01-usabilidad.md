# 01 · Fundamentos de usabilidad — Lightning Shop, Setup del admin

**Fecha:** 2026-10-07 · **Alcance:** las 5 pantallas de Setup, recorridas por flujo crítico:
1. Shop workflow `/admin/setup/workflow`, con Shop hours de pasada.
2. Job Catalog `/admin/catalog` y `/admin/catalog/categories/[id]`.
3. Mechanics `/admin/mechanics` y `/admin/mechanics/[id]`.
4. Partes del PM: no hay ruta; se audita la ausencia.

**Método:** código + observaciones de navegador ya capturadas (demo local `ltl_shop_setup_demo`, Manager, 1440×900 y 375×812; `evidencia/observaciones-navegador.md`). En esta corrida no se abrió el navegador. Lo que viene de esas observaciones va marcado `(observado)`; el resto, `(inferido del código)`.

**Resumen:** 20 hallazgos: 6 de severidad 3, 8 de severidad 2 y 6 de severidad 1; ninguno de 4. 6 son "cambia por decisión": brechas frente a decisiones que el dueño ya tomó, no defectos. El patrón dominante es que **los cambios de Setup tienen efectos lejanos y silenciosos**. Al cambiar el tipo de una persona, renombrar un Job, desactivar algo o recargar el catálogo, la pantalla dice "guardado" y el problema aparece días después en el patio: un paso sin dueño, un carril vacío o un Job duplicado. Ninguna pantalla avisa antes.

> Nota sobre "cambia por decisión": el dueño ya decidió, el 2026-10-07, estos cambios:
> - equipos por paso con cola, con un solo dueño por Job;
> - el Manager hace QC como respaldo;
> - la etiqueta del paso PM pasa a ser "PM";
> - el Manager gestiona categorías, Jobs y aliases, con protecciones;
> - "Remove" conserva el historial;
> - una sección nueva de Partes y costos.
>
> Los hallazgos marcados así describen lo que falta frente a esas decisiones. No piden otra cosa.

## Hallazgos

### Flujo 1 · Definir quién hace cada paso obligatorio (Shop workflow)

### UX-1-001 · Después de cambiar un dueño no se nota que falta guardar, y se puede salir sin aviso
- **Dónde:** Shop workflow (`/admin/setup/workflow`) · `apps/web/src/components/admin-shop-workflow.tsx:36` (cálculo de `dirty`), `:115` (botón Save)
- **Evidencia:** `evidencia/00-shop-workflow-cambio-sin-guardar.jpg` (observado): con Alignment cambiado a Anthony, el botón Save se ve igual de apagado que antes del cambio, en modo oscuro. Ningún texto dice "cambios sin guardar". El código no tiene `beforeunload` ni guarda de ruta: si el Manager navega a otra sección, pierde el cambio sin aviso (inferido del código).
- **Criterio:** Nielsen H1 (visibilidad del estado del sistema) · H3 (control y libertad: salir a medias sin aviso)
- **Severidad:** 2 · Frecuencia baja (pantalla ocasional). El impacto es diferido: el Manager cree que dejó un dueño y las WO nuevas salen sin asignar. Persiste mientras el botón activo y el desactivado se parezcan.
- **Recomendación:** con `dirty`:
  - mostrar "1 cambio sin guardar" junto al botón;
  - marcar la fila cambiada (borde o punto);
  - pedir confirmación al salir de la página.

  Revisar en oscuro que el primario activo se distinga del gris de `disabled:bg-muted` (`ui.tsx:29`).
- **Esfuerzo:** S

### UX-1-002 · Si falla el guardado, el mensaje no dice por qué
- **Dónde:** Shop workflow · `apps/web/src/components/admin-shop-workflow.tsx:49-50`
- **Evidencia:** (inferido del código) `} catch { setSaveError(messages.shopWorkflowSaveFailed); }`. El mensaje es "Could not save the shop workflow. Refresh and try again.". El motivo real que devuelve la API se pierde: `OWNER_NOT_ELIGIBLE` ("must be an active mechanic with…", `shop-workflow.service.ts:83-86`) o `STEP_HAS_NO_OWNER`. Shop hours, en la misma página, sí usa `apiErrorMessage(failure, …)` (`:155`).
- **Criterio:** Nielsen H9 (ayudar a reconocer, diagnosticar y recuperarse de errores) · H4 (dos tarjetas de la misma página tratan el error distinto)
- **Severidad:** 2 · Caso raro, porque la lista ya filtra por capacidad. Pero cuando pasa (alguien desactivó a la persona en otra pestaña), refrescar no explica nada.
- **Recomendación:** usar `apiErrorMessage` también aquí, con texto por código. Por ejemplo, para `OWNER_NOT_ELIGIBLE`: "Daniel ya no está activo o ya no es PM. Elige otro dueño para PM." Marcar la fila afectada.
- **Esfuerzo:** S

### UX-1-003 · Cambiar el tipo de una persona deja su paso sin dueño y nadie lo avisa
- **Dónde:**
  - Shop workflow: `apps/web/src/components/admin-shop-workflow.tsx:87` (el aviso solo mira `active`) y `:59-61` (el dueño no elegible sigue en la lista).
  - Mechanics → detalle → Type: `apps/web/src/components/admin-mechanic-roster.tsx:268-272`.
  - API: `apps/api/src/admin/system-admin-writes.service.ts:151-160` y `apps/api/src/work-orders/mandatory-jobs.ts:51-55`.
- **Evidencia:** (inferido del código) Ejemplo: Daniel es dueño por defecto de PM y el Manager lo cambia de PM a Standard en su ficha.
  - El cambio de tipo se guarda sin revisar si la persona es dueña de un paso, ni si tiene Jobs PM abiertos. Solo se revisa al desactivar (`:146`).
  - En Shop workflow, Daniel sigue elegido sin aviso: el aviso amarillo de `:87` solo sale si está inactivo.
  - Cada WO nueva sale con PM sin asignar, porque `usableDefaultOwner` devuelve `null` si falta la capacidad.
- **Criterio:** Nielsen H5 (prevención de errores) · H1 (visibilidad del estado del sistema)
- **Severidad:** 3 · El cambio es poco frecuente, pero el efecto es silencioso y se repite en cada WO nueva hasta que alguien nota el paso sin dueño en el patio. Es el caso que el contexto describe ("un trabajo sin dueño").
- **Recomendación:**
  1. En la ficha, antes de guardar el tipo, avisar: "Daniel es el dueño por defecto de PM. Si deja de ser PM, las Work Orders nuevas tendrán PM sin asignar. [Cambiar dueño de PM]". Hacer lo mismo en el diálogo Desactivar.
  2. En Shop workflow, ampliar el aviso de `:87` a "ya no tiene la capacidad necesaria" (`usableDefaultOwner(...) === null`).
  - Con la decisión de equipos por paso, el aviso pasa a ser "el equipo de PM queda con 0 personas activas".
- **Esfuerzo:** S–M

### UX-1-004 · Un paso cuyo Job o categoría está inactivo se ve configurado, pero no se crea
- **Dónde:** Shop workflow · `apps/api/src/admin/shop-workflow.service.ts:18` y `:33` (no lee el estado del Job ni de la categoría) · `apps/api/src/work-orders/mandatory-jobs.ts:70` (filtra `status: 'active'`)
- **Evidencia:** (inferido del código, conocido)
  - La lista del workflow muestra los 4 pasos aunque el Job (por ejemplo "Alignment") o su categoría estén inactivos.
  - Al crear la WO, `resolveMandatoryJobs` los descarta en silencio.
  - Después el Dashboard muestra "Missing required steps … Detailing" (observado en el Dashboard) sin decir por qué falta.
- **Criterio:** Nielsen H1 (visibilidad del estado del sistema) · H9 (diagnosticar errores)
- **Severidad:** 3 · Hoy no hay botón para desactivar un Job, pero la categoría sí puede quedar inactiva (fusión LTR-24, `job-catalog.ts:387-390`). Con la decisión de que el Manager gestione Jobs, el riesgo crece. Cuando pasa, afecta a todas las WO nuevas.
- **Recomendación:**
  - En Shop workflow, marcar la fila: "Este Job está inactivo en el Job Catalog. Las Work Orders nuevas no lo reciben. [Abrir en el catálogo]".
  - En el catálogo, impedir desactivar un Job que es paso obligatorio, o pedir antes elegir otro Job para el paso. Es la protección que pide la decisión del dueño.
- **Esfuerzo:** S (aviso) · M (protección)

### UX-1-005 · Para elegir dueño solo se ve un nombre (cambia por decisión)
- **Dónde:** Shop workflow · `apps/web/src/components/admin-shop-workflow.tsx:32-35` y `:94-104`
- **Evidencia:** (observado) En `00-shop-workflow-desktop.jpg`:
  - PM ofrece solo a Daniel.
  - Alignment y Detailing ofrecen las mismas 6 personas Standard.
  - No se ve carga, ocupación ni nada que ayude a decidir.

  El modelo es una sola persona por paso, en un `<select>`.
- **Criterio:** Nielsen H6 (reconocer antes que recordar). Hoy el Manager tiene que recordar quién está cargado.
- **Severidad:** 2 · **Cambia por decisión:** equipos por paso, con cola y un dueño por Job. La pantalla nueva debe:
  - asignar un equipo, no una persona;
  - mostrar en cada equipo cuántas personas activas hay y cuántos Jobs tiene en cola;
  - avisar si el equipo queda vacío.
- **Recomendación:** diseñar la fila del paso como "Equipo: Standard (6 activas · 14 Jobs en cola)" con "Ver personas". La recomendación de UX-1-003 se aplica al equipo.
- **Esfuerzo:** M

### UX-1-006 · El texto de QC dice que lo hace Safety, y el Manager no tiene cómo hacerlo (cambia por decisión)
- **Dónde:** Shop workflow, fila Quality Check · `apps/web/src/lib/admin-messages.ts:44` · `apps/web/src/components/quality-check-page.tsx:68`
- **Evidencia:**
  - (observado) La fila QC dice "Safety (Quality Check) takes it from the queue".
  - (observado) Si el Manager entra en `/qc`, va a `/admin` sin mensaje: `if (… !canPerform) replaceAppLocation(defaultWorkspacePath(user), router)`.
  - (observado) El Dashboard ofrece "Mark it here only if Safety cannot". El respaldo existe, pero vive en otra pantalla y Setup no lo menciona.
  - (inferido del código) El comentario de `admin-shop-workflow.tsx:15` todavía dice "the Manager completes it".
- **Criterio:** Nielsen H1 (visibilidad del estado del sistema) · H2 (correspondencia con el mundo real: quién hace QC)
- **Severidad:** 2 · **Cambia por decisión:** el Manager hace QC como respaldo.
- **Recomendación:**
  - Fila QC: "Safety lo toma de la cola. Si Safety no está, el Manager lo marca desde el Truck o el Dashboard."
  - En `/qc`, para un Manager, abrir la cola en lugar de redirigir en silencio, o al menos explicar adónde lo lleva.
- **Esfuerzo:** S (texto) · M (QC del Manager)

### UX-1-007 · El paso se llama "PM A Service" aunque cubre PM A y PM B (cambia por decisión)
- **Dónde:** Shop workflow, fila 1 · `apps/web/src/components/admin-shop-workflow.tsx:85` (muestra `catalogJob.displayName`) · `apps/api/src/work-orders/mandatory-jobs.ts:13`
- **Evidencia:** (observado) `00-shop-workflow-desktop.jpg`: el paso dice "PM A Service" y el subtítulo dice "PM". El Manager puede pensar que el PM B no tiene dueño. El carril sale de la categoría PM (`yard-work-plan-derivation.ts:107-108`).
- **Criterio:** Nielsen H2 (correspondencia entre el sistema y el mundo real)
- **Severidad:** 1 · **Cambia por decisión:** la etiqueta del paso pasa a ser "PM"; el alcance PM A/B no cambia.
- **Recomendación:** etiqueta propia del paso ("PM"), separada del nombre del Job del catálogo, con la nota "PM A o PM B según el camión".
- **Esfuerzo:** S

### UX-1-008 · Dos botones "Guardar" en la misma página, cada uno para una parte
- **Dónde:** Shop workflow · `apps/web/src/components/admin-shop-workflow.tsx:115` y `:210`
- **Evidencia:** (observado) "Save" bajo los pasos y "Save shop hours" bajo el horario. Si se cambian las dos partes y se pulsa solo uno, la otra parte se pierde al salir, sin aviso (ver UX-1-001).
- **Criterio:** Nielsen H4 (consistencia y estándares) · H3 (control y libertad)
- **Severidad:** 1 · Son dos tarjetas separadas y el riesgo es bajo, pero se suma a UX-1-001.
- **Recomendación:**
  - Renombrar el primero a "Save workflow".
  - Con cambios sin guardar en una sección, avisar al salir indicando cuál.
  - Otra opción: mover Shop hours a su propia página de Setup.
- **Esfuerzo:** S

### Flujo 2 · Mantener el catálogo de trabajos (Job Catalog)

### UX-1-009 · Renombrar un Job que es paso obligatorio no avisa y lo saca de su carril
- **Dónde:** Category detail → "Rename Job" · `apps/web/src/components/admin-catalog-write.tsx:218-235` · `apps/api/src/admin/yard-work-plan-derivation.ts:110` · `apps/api/src/work-orders/mandatory-jobs.ts:68` y `:80`
- **Evidencia:** (inferido del código) El carril sale del nombre: `if (category.includes('alignment') || name === 'alignment')`.
  - Si el Manager renombra "Alignment" (en Suspension & Steering) a "Wheel Alignment":
    - las WO quedan con ese Job en Shop Work en lugar de Alignment;
    - `coveredLanes` ya no ve el carril, y una WO que lo incluya recibe además el paso obligatorio, duplicado.
  - El diálogo no dice que ese Job es un paso del workflow. El detalle de categoría tampoco lo marca (`admin-catalog-category-detail.tsx:46-55`).
- **Criterio:** Nielsen H5 (prevención de errores) · H1 (el estado "este Job es paso obligatorio" no se ve)
- **Severidad:** 3 · Renombrar es poco frecuente, pero el efecto es invisible en el momento y desordena el Yard y el Dashboard en todas las WO siguientes.
- **Recomendación:**
  - Marcar en el detalle de categoría los Jobs que son paso obligatorio (badge "Workflow step").
  - En Rename, para esos Jobs, avisar: "Este Job es el paso Alignment del Shop workflow. El nuevo nombre se verá en todas las Work Orders."
  - De fondo, que el carril salga del `stepKey` o del id del Job, no del nombre. Ya está anotado como conocido.
- **Esfuerzo:** S (aviso) · M (carril por id)

### UX-1-010 · La recarga del catálogo base deshace lo que hizo el Manager
- **Dónde:**
  - `apps/api/prisma/job-catalog.ts:399-426` (`upsertCatalogJob`): busca por nombre y fuerza `status: 'active'`.
  - `:335-339`: los aliases vuelven al Job base.
  - Se llama desde `apps/api/prisma/seed.ts:191` y `apps/api/prisma/apply-job-catalog.ts:9`.
- **Evidencia:** (inferido del código, conocido) Si el Manager:
  - renombró "Fuel Lines": la recarga no encuentra el nombre original y crea otro "Fuel Lines" activo, así que aparece un duplicado;
  - desactivó un Job base: lo reactiva;
  - movió un alias: lo devuelve.

  Nada de esto se ve en la pantalla. El Manager solo encuentra su cambio deshecho.
- **Criterio:** Nielsen H1 (visibilidad del estado del sistema) · H5 (prevención de errores) · H3 (control: el cambio del usuario no se respeta)
- **Severidad:** 3 · Ocurre en cada release que aplique el catálogo. El Manager pierde trabajo y confía menos en la pantalla.
- **Recomendación:** que la recarga solo cree lo que falta. Debe:
  - respetar los Jobs con `createdById` del Manager o con nombre editado;
  - registrar lo que no tocó.

  Si se mantiene la recarga, mostrar en el catálogo "Actualizado por el sistema el <fecha>: 2 Jobs agregados".
- **Esfuerzo:** M

### UX-1-011 · No se puede desactivar un Job, editar aliases ni gestionar categorías (cambia por decisión)
- **Dónde:** Category detail · `apps/web/src/components/admin-catalog-write.tsx:89-96` (solo "Rename Job" y, si está inactivo, "Activate") · `apps/web/src/lib/admin-messages.ts:97` ("Categories do not change here")
- **Evidencia:** (observado)
  - `00-catalogo-categoria.jpg`: cada Job tiene un solo botón, "Rename Job". Los aliases se ven, pero no se editan.
  - "Fuel Lines" tiene "lineas de combustible" y "líneas de combustible", casi duplicados, y el Manager no puede quitar uno.
  - Si un Job se agrega por error, no hay salida: no se puede borrar ni desactivar.
- **Criterio:** Nielsen H3 (control y libertad del usuario: deshacer un alta errónea)
- **Severidad:** 2 · **Cambia por decisión** (D25 → el Manager gestiona categorías, Jobs y aliases, con protecciones). Las protecciones que deben acompañarlo están en UX-1-004 y UX-1-009.
- **Recomendación:**
  - Agregar "Deactivate Job", con bloqueo o aviso si es paso obligatorio.
  - Editar y quitar aliases, avisando si el alias ya existe en otro Job.
  - Crear, renombrar y activar categorías.
  - Cada acción destructiva con confirmación que diga el efecto ("Las Work Orders abiertas conservan el Job; no se podrá elegir en Work Orders nuevas").
- **Esfuerzo:** M

### UX-1-012 · El texto de ayuda se repite en cada diálogo, incluso donde no aplica
- **Dónde:**
  - Lista: `apps/web/src/components/admin-catalog-list.tsx:32` y `:35`.
  - Detalle: `apps/web/src/components/admin-catalog-category-detail.tsx:27` y `:38`.
  - Diálogos: `apps/web/src/components/admin-catalog-write.tsx:163` y `:240`.
  - Lo mismo en Mechanics: `admin-mechanics-list.tsx:46`, `admin-mechanic-roster.tsx:187` y `:223`.
- **Evidencia:** (observado)
  - `00-catalogo-lista.jpg` y `00-catalogo-movil.jpg`: el subtítulo y el párrafo "Manager or System Admin. Add a Job to an active Category…" dicen casi lo mismo. En el teléfono ocupan media pantalla.
  - `00-catalogo-renombrar.jpg`: el diálogo "Rename Job" repite el párrafo de agregar.
- **Criterio:** Nielsen H8 (diseño estético y minimalista)
- **Severidad:** 1 · No impide la tarea, pero el texto que sí importa queda enterrado (por ejemplo, el aviso de UX-1-009 si se agrega).
- **Recomendación:**
  - Dejar un solo texto por pantalla: el subtítulo.
  - En cada diálogo, solo lo que aplica a esa acción. En Rename: "El nombre cambia en el catálogo y en las Work Orders nuevas; el Job sigue siendo el mismo."
  - Quitar "Manager or System Admin": quien lo ve ya tiene permiso.
- **Esfuerzo:** S

### UX-1-013 · El primer clic en una categoría no abrió el detalle
- **Dónde:** Job Catalog, columna Category · `apps/web/src/components/admin-catalog-list.tsx:62`
- **Evidencia:** (observado) El primer clic en "Fuel System" solo hizo scroll; abriendo la URL directa, el detalle cargó. En el código es un `<Link>` normal dentro de `DataTable`. La causa no está determinada: puede ser el foco o el scroll de la fila primaria en `DataTable`, o un clic que cayó mientras se movía la página.
- **Criterio:** Nielsen H1 (visibilidad del estado del sistema: el clic no da respuesta)
- **Severidad:** 2 · Si se repite, es la puerta de entrada a todo el flujo 2. Hay que confirmarlo antes de priorizarlo.
- **Recomendación:** reproducir en la skill 8 (técnico) con escritorio y teléfono. Si se confirma, hacer navegable toda la fila o revisar el manejo de foco y scroll de `DataTable` en la celda primaria.
- **Esfuerzo:** S

### Flujo 3 · Dar de alta, cambiar o sacar a una persona (Mechanics)

### UX-1-014 · "Open Work Orders" no coincide con el trabajo real de la persona
- **Dónde:**
  - Mechanics, lista y detalle: `apps/api/src/admin/admin.service.ts:140-145` (cuenta `mechanicAssignments`) y `:2512-2522` (`openWorkOrderCount`).
  - `apps/web/src/components/admin-mechanics-list.tsx:111`.
  - `apps/web/src/components/admin-mechanic-detail.tsx:40-42`, `:62` y `:82`.
- **Evidencia:** (observado) Jobs pendientes en la base frente al número de la pantalla:

  | Persona | Base | Pantalla |
  |---|---|---|
  | Alejandro 1 | 7 | 10 |
  | Alejandro 2 | 8 | 10 |
  | Daniel | 9 | 0 |

  - El número sale de las asignaciones a la WO, no de los Jobs que la persona tiene asignados.
  - Daniel, en `00-mechanics-detalle.jpg`, muestra "Open Work Orders: 0" y "Completed Jobs: 3", y a la vez "No closed Work Orders assigned to this mechanic.".
  - Al intentar desactivarlo aparecen 9 Jobs pendientes (`00-mechanics-desactivar-bloqueado-vs-0.jpg`).
- **Criterio:** Nielsen H1 (visibilidad del estado del sistema) · H4 (consistencia: dos números del mismo concepto que se contradicen)
- **Severidad:** 3 · Es el dato que el Manager usa para decidir a quién asignar o si puede sacar a alguien. Con 0, cree que está libre. Pasa con todos los PM y en cada visita.
- **Recomendación:**
  - Contar Jobs `to_do` en WO abiertas donde `assignedMechanicId` es la persona (la misma consulta que `openWorkOf`, `system-admin-writes.service.ts:231-245`).
  - Etiquetar "Pending Jobs (in N Work Orders)".
  - Listar en el detalle esos Jobs, no las asignaciones.
  - "Recent closed" debe salir de los Jobs completados por la persona.
- **Esfuerzo:** M

### UX-1-015 · El bloqueo para desactivar aparece después de confirmar, y no se puede resolver ahí
- **Dónde:** Mechanics → detalle → Access → Deactivate · `apps/web/src/components/admin-mechanic-roster.tsx:406-414` (diálogo) y `:343-355` (`deactivate`) · `apps/api/src/admin/system-admin-writes.service.ts:146-148`
- **Evidencia:** (observado)
  - `00-mechanics-desactivar-dialogo.jpg`: el diálogo solo dice "This person will stop signing in… Nothing is deleted; their history stays.".
  - Al pulsar Deactivate aparece "Reassign first" con 9 Jobs PM A Service y "Their labor time is running" (`00-mechanics-desactivar-bloqueado-vs-0.jpg`). Detrás, la página sigue diciendo "Open Work Orders: 0".
  - Para reasignar solo hay enlaces a cada WO: 9 viajes de ida y vuelta.
- **Criterio:**
  - Nielsen H5 (prevención de errores: avisar antes, no después de confirmar).
  - H3 (control y libertad: callejón que obliga a salir).
  - H7 (eficiencia: reasignar uno por uno).
- **Severidad:** 3 · Pasa en cada baja de alguien con trabajo, que es el caso normal de una baja. Se completa, pero con frustración y muchos pasos.
- **Recomendación:**
  - Consultar el trabajo abierto al abrir el diálogo y mostrarlo antes de confirmar: "Daniel tiene 9 Jobs pendientes y un reloj corriendo."
  - Dentro del diálogo, ofrecer "Reasignar todos a… [persona]", o dejarlos en la cola del equipo cuando exista.
  - Ofrecer "Detener reloj".
  - Avisar también si la persona es dueña por defecto de un paso (UX-1-003).
- **Esfuerzo:** M

### UX-1-016 · No hay forma de sacar a una persona de la lista (cambia por decisión)
- **Dónde:** Mechanics → detalle → Access · `apps/web/src/components/admin-mechanic-roster.tsx:396-403` (solo Deactivate o Reactivate, y Reset password)
- **Evidencia:** (observado) No hay botón para borrar ni para sacar. Una persona que se fue queda como inactiva para siempre, y aparece al marcar "Show inactive".
- **Criterio:** Nielsen H3 (control y libertad del usuario)
- **Severidad:** 2 · **Cambia por decisión** (D22 → "Remove" conserva el historial).
- **Recomendación:** acción "Remove", separada de Deactivate, con confirmación que diga el efecto: "Sale de la lista y de los selectores. Sus Jobs, tiempos y Work Orders pasados se conservan con su nombre." Aplicar el mismo bloqueo previo de UX-1-015.
- **Esfuerzo:** M

### UX-1-017 · El filtro de Mechanics necesita "Apply" y el del catálogo no
- **Dónde:** `apps/web/src/components/admin-mechanics-list.tsx:49-71` (`onSubmit` con `router.replace`) frente a `apps/web/src/components/admin-catalog-list.tsx:38` (filtra al escribir)
- **Evidencia:** (observado) En Mechanics hay que escribir y pulsar "Apply filters". En Job Catalog la lista se filtra al escribir. Hay dos comportamientos para la misma búsqueda en la misma sección Setup.
- **Criterio:** Nielsen H4 (consistencia y estándares) · H7 (flexibilidad y eficiencia)
- **Severidad:** 1 · La lista es corta y se aprende enseguida.
- **Recomendación:** que el buscador de Mechanics filtre al escribir, con un retardo breve, y que solo "Show inactive" siga en el panel de filtros. Otra opción es aplicar al cambiar la casilla.
- **Esfuerzo:** S

### UX-1-018 · Los usuarios admin aparecen como mecánicos, y su ficha solo dice "Read only"
- **Dónde:** `apps/api/src/admin/admin.service.ts:118-122` (`rosterCapabilityWhere` filtra por capacidad, no por rol) · `apps/web/src/components/admin-mechanic-detail.tsx:16` y `:29`
- **Evidencia:** (observado) Cristian Perez e iBrain Admin salen en la lista con "Shop Admin · Standard · PM". Al abrir su ficha no hay acciones y aparece el badge "Read only", sin explicar por qué (inferido del código).
- **Criterio:** Nielsen H2 (correspondencia con el mundo real: ¿es mecánico o no?) · H8 (información que compite)
- **Severidad:** 1 · Confunde al contar cuántas personas hay en cada tipo (pregunta abierta del contexto: cuántas hay en Detailing y Safety).
- **Recomendación:**
  - Separar a los admins en un grupo "Office" o excluirlos.
  - Si se muestran, en su ficha decir "Esta cuenta es de administración; se gestiona en System Admin."
- **Esfuerzo:** S

### UX-1-019 · El estado de las Work Orders cerradas sale con la clave interna
- **Dónde:** Mechanics → detalle → Recent closed Work Orders · `apps/web/src/components/admin-mechanic-detail.tsx:77`
- **Evidencia:** (inferido del código) `{assignment.primaryCategoryName} · {assignment.status}` muestra `completed` o `cancelled` tal cual, también en español.
- **Criterio:** Nielsen H2 (correspondencia entre el sistema y el mundo real)
- **Severidad:** 1 · Se entiende, pero no está traducido y desentona.
- **Recomendación:** pasar el estado por la misma etiqueta traducida que usa Work Orders ("Completed" / "Completado", "Cancelled" / "Cancelado").
- **Esfuerzo:** S

### Flujo 4 · Saber de dónde salen las partes del PM

### UX-1-020 · No hay ningún lugar donde ver o cambiar las partes del PM (cambia por decisión)
- **Dónde:** menú de Setup · `apps/web/src/components/admin-shell.tsx:27-31` (Mechanics, Job Catalog, Shop workflow) · datos en `apps/api/prisma/schema.prisma:453`, `:469`, `:487`, `:517` (`PartCategory`, `Part`, `PartFitment`, `PmServicePart`) cargados solo por `apps/api/prisma/pm-parts.ts`
- **Evidencia:** (observado) No hay entrada de menú ni pantalla de partes. El mecánico PM ve "la parte más usada" en su pantalla, pero el Manager no puede ver de dónde sale esa lista, corregir una parte ni saber cuánto cuesta.
- **Criterio:** Nielsen H1 (visibilidad del estado del sistema) · H3 (control: corregir un dato equivocado exige a un desarrollador)
- **Severidad:** 2 · **Cambia por decisión** (D24 → sección nueva de Partes y costos por camión, etapa 1).
- **Recomendación:** entrada "Parts & costs" en Setup con:
  - una lista por categoría de parte y los camiones que la usan (fitment);
  - qué partes usa cada servicio PM;
  - el costo.

  Mientras tanto, una vista de solo lectura evita que el Manager pregunte "¿de dónde salió este filtro?".
- **Esfuerzo:** L

## Lo que funciona bien
- **El dueño inactivo no desaparece en silencio en Shop workflow.** Se mantiene visible en la lista, con el aviso "{name} is inactive. New Work Orders leave this step unassigned." (`admin-shop-workflow.tsx:58-61` y `:87-91`). Es el modelo a extender en UX-1-003.
- **Desactivar no se puede hacer a ciegas.** La API se niega si hay Jobs pendientes o un reloj corriendo, y lista cada Job con enlace a su WO (`system-admin-writes.service.ts:146-148` y `:231-260`). Lo que falta es mostrarlo antes (UX-1-015).
- **La contraseña temporal se maneja bien.** Se muestra una sola vez, en un campo de solo lectura con "Copy", y el diálogo queda abierto hasta "Done" (`admin-mechanic-roster.tsx:79-118` y `:177-184`). No se pierde por cerrar a destiempo.
- **Las altas del catálogo están protegidas.**
  - Un nombre repetido en la categoría se rechaza con un mensaje propio (`system-admin-writes.service.ts:336-355`).
  - Renombrar conserva el id y mueve el alias del nombre anterior, así que las búsquedas viejas siguen encontrando el Job.
- **Las pantallas se leen bien en el teléfono.** Shop workflow pasa a una columna y la tabla del catálogo a tarjetas (`00-shop-workflow-movil.jpg`, `00-catalogo-movil.jpg`). Los guardados confirman con un aviso ("Shop workflow saved.", `00-shop-workflow-guardado.jpg`).

## Fuera de alcance / no verificado
- **El navegador no se abrió en esta corrida** porque otra sesión lo usaba. Lo marcado `(observado)` viene de `evidencia/observaciones-navegador.md` y sus capturas, del mismo día. No se tomaron capturas nuevas `01-*`.
- **Sin comprobar:**
  - en vivo, el efecto de UX-1-003, UX-1-004, UX-1-009 y UX-1-010 (cambiar tipo o renombrar y luego crear una WO, o correr la recarga del catálogo);
  - la causa de UX-1-013.
- **No se recorrió:**
  - la diferencia de permisos con System Admin ni la redirección del rol mecánico;
  - Shop hours en detalle (solo de pasada, como pide el contexto);
  - modo claro y español en todas las pantallas (las capturas son en oscuro e inglés).
- **En producción:** Alignment y Air System aparecen como categorías "Inactive". No se comprobó si alguna WO real perdió un paso por UX-1-004.

## Para otras skills
- **Skill 3 (contenido):**
  - Aliases casi duplicados por acentos ("lineas" / "líneas de combustible"). `normalizeAlias` borra las letras acentuadas en lugar de quitarles el acento (`apps/api/src/job-catalog/job-catalog.service.ts:4-5`).
  - Mezcla de inglés y español en los textos en ES ("Work Orders", "Job", "Categories").
- **Skill 6 (estados):** el detalle de Mechanics dice "Job labor time is not available." de forma permanente (`admin-mechanic-detail.tsx:42`). Es un estado vacío que no explica si algún día estará.
- **Skill 7 (formularios):** el alta de una persona valida el email solo al enviar (`admin-mechanic-roster.tsx:158-160`).
- **Skill 8 (técnico):** reproducir UX-1-013 (el primer clic en la categoría no navega).
