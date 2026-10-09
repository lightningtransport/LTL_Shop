# 07 · Formularios e interacción — Lightning Shop, Setup del admin

**Fecha:** 2026-10-07 · **Alcance:** Shop workflow (dueños por paso y Shop hours), Job Catalog (Add Job desde la lista y desde la categoría, Rename Job, Activate), Mechanics (Add person, Name and type, Deactivate, Reactivate, Reset password) y la casilla "Also add to the catalog" del Work Plan · **Método:** código + observaciones del navegador del 2026-10-07 (`evidencia/observaciones-navegador.md`). En esta corrida no se usó el navegador.
**Resumen:** hay 25 hallazgos. 9 son de severidad 3 o más y 6 cambian por decisión del dueño.
- **Patrón dominante:** el formulario acepta un cambio que deja el taller en mal estado, y no avisa ni antes ni después. Pasa al cambiar el tipo de una persona que es dueña de trabajo, con la casilla "Also add to the catalog" y con Activate.
- **Errores del servidor:** cuando el problema está en otro registro (otro Job, otra persona, otro paso), el aviso no dice cuál es, aunque la API lo devuelve.
- **Doble envío:** está bien resuelto en todos los formularios.

## Inventario de formularios

| Formulario | Ruta | Flujo | Patrón | Revisión |
|---|---|---|---|---|
| Dueño por paso + Save | `/admin/setup/workflow` | 1 | Selects sueltos y un botón fuera de `<form>`, estado local (`admin-shop-workflow.tsx:94-115`) | Completa |
| Shop hours (hora, días, Save shop hours) | `/admin/setup/workflow` | 1 (de pasada) | `type=time` y checkboxes sin `<form>` (`admin-shop-workflow.tsx:173-210`) | Completa |
| Add Job (desde la lista, elige categoría) | `/admin/catalog` | 2 | Modal con `<form onSubmit>` (`admin-catalog-write.tsx:114-193`) | Completa |
| Add Job (desde la categoría, categoría fija) | `/admin/catalog/categories/[id]` | 2 | El mismo modal, sin el select | Completa |
| Rename Job | `/admin/catalog/categories/[id]` | 2 | Modal con `<form onSubmit>` (`admin-catalog-write.tsx:195-259`) | Completa |
| Activate (Job inactivo) | `/admin/catalog/categories/[id]` | 2 | Botón de un clic (`admin-catalog-write.tsx:72-96`) | Completa |
| Add person (nombre, email, tipo) | `/admin/mechanics` | 3 | Modal en dos pasos: datos y contraseña temporal (`admin-mechanic-roster.tsx:120-206`) | Completa |
| Activate (desde la lista, pide tipo) | `/admin/mechanics?includeInactive=true` | 3 | Modal con `CapabilityForm` (`admin-mechanic-roster.tsx:208-238`) | Muestreo |
| Name and type | `/admin/mechanics/[id]` | 3 | `CapabilityForm` en tarjeta (`admin-mechanic-roster.tsx:240-277, 444-502`) | Completa |
| Deactivate / Reactivate / Reset password | `/admin/mechanics/[id]` | 3 | Diálogos de confirmación (`admin-mechanic-roster.tsx:313-442`) | Completa |
| Custom Job + "Also add to the catalog" | Work Plan (Truck / WO) | 2 (entrada lateral al catálogo) | `<form onSubmit>` en el panel Add work (`work-plan-add-work.tsx:266-299`) | Completa |

**Patrón base:**
- No hay librería de formularios (ni react-hook-form ni Formik). Cada formulario guarda su estado con `useState`.
- La validación del cliente se hace a mano y solo al enviar. Muestra **un** error a la vez, en un `InlineAlert` (`ui.tsx:160-172`).
- El servidor valida con zod (`packages/shared/src/schemas.ts:22-50`). Los códigos conocidos se traducen con `adminWriteFailureMessage` (`apps/web/src/lib/system-admin.ts:48-72`).
- Los modales son Radix (`Modal`, `ui.tsx:1140-1207`).

## Hallazgos

### Sistémicos

### UX-7-001 · Los errores aparecen de uno en uno, al pie del formulario y lejos del campo
- **Dónde:**
  - Add person: `admin-mechanic-roster.tsx:154-161` y `:197`.
  - Add Job: `admin-catalog-write.tsx:138-145` y `:185`.
  - Rename Job: `admin-catalog-write.tsx:220-223` y `:251`.
  - Name and type: `admin-mechanic-roster.tsx:470-473` y `:495`.
- **Evidencia (inferido del código):** cada `onSubmit` corta en el primer `return`. Por ejemplo, en Add person:
  ```tsx
  if (!name.trim()) { setError(messages.mechanicNameRequired); return; }
  if (!isRosterEmail(email)) { setError(messages.mechanicEmailRequired); return; }
  ```
  - El mensaje va a un único `InlineAlert`, debajo de los radios del tipo.
  - Ningún `Input` recibe `aria-invalid` ni `aria-describedby`.
  - El foco no vuelve al campo con el error.
  - Si el Manager envía Add person vacío, ve "Enter a name.". Lo corrige y recién entonces ve "Enter a valid email.".
- **Criterio:** Nielsen H9 (ayudar a reconocer y corregir errores) · WCAG 3.3.1 (identificación de errores) · WCAG 1.3.1 (información y relaciones).
- **Severidad:** 2 · Formularios cortos (1 a 3 campos) y de uso ocasional. Molesta, pero se completa.
- **Recomendación:**
  - Un `FieldError` en `ui.tsx` que reciba `id` y mensaje, para que cada `Input` lleve `aria-invalid` y `aria-describedby`.
  - Al enviar, validar todos los campos y mostrar cada error debajo de su campo.
  - Llevar el foco al primer campo con error.
  - El `InlineAlert` del pie queda solo para errores del servidor que no son de un campo.
- **Esfuerzo:** S (es un componente base; los cuatro formularios lo heredan).

### UX-7-002 · Esc o un clic fuera cierra el diálogo y borra lo escrito, también la contraseña temporal que se ve una sola vez
- **Dónde:** `Modal`, `apps/web/src/components/ui.tsx:1170` (`onOpenChange={(nextOpen) => !nextOpen && onClose()}`). Cómo se cierra cada diálogo:
  - Add person: `close()` llama a `reset()` (`admin-mechanic-roster.tsx:139-150`).
  - Reset password: `closeReset()` pone `setResetPassword(null)` (`admin-mechanic-roster.tsx:337-341`).
- **Evidencia (inferido del código):**
  - El `Modal` no intercepta `onPointerDownOutside` ni `onEscapeKeyDown`, y no mira si el formulario tiene cambios o si está guardando.
  - En Add person, un clic fuera vacía nombre, email y tipo.
  - En el paso de la contraseña temporal, un clic fuera la descarta. Para dársela a la persona hay que hacer otro Reset password.
  - Durante el envío, los botones están deshabilitados, pero Esc sigue cerrando el diálogo.
- **Criterio:** Nielsen H3 (control y libertad del usuario) · Nielsen H5 (prevención de errores).
- **Severidad:** 2 · El Manager lo nota y lo recupera: vuelve a escribir o hace otro reset. Pero en el paso de la contraseña obliga a repetir una acción de seguridad.
- **Recomendación:**
  - Agregar a `Modal` una prop `dismissible` (o `busy` y `dirty`). Cuando esté en `false`, el modal hace `preventDefault()` en `onPointerDownOutside` y `onEscapeKeyDown`.
  - En el paso de la contraseña temporal, solo "Done" cierra el diálogo.
  - Con cambios sin guardar, preguntar antes de cerrar: "¿Descartar lo escrito?".
- **Esfuerzo:** S.

### UX-7-003 · Cuando el conflicto es con otro registro, el aviso no dice cuál, aunque la API lo devuelve
- **Dónde:** `apps/web/src/lib/system-admin.ts:55-61`. La API manda el registro en conflicto:
  - `jobId` en `CATALOG_JOB_EXISTS` y `CATALOG_ALIAS_EXISTS` (`apps/api/src/admin/system-admin-writes.service.ts:351-367`);
  - `mechanicId` en `MECHANIC_EMAIL_EXISTS` (`system-admin-writes.service.ts:414-418`).
- **Evidencia (inferido del código):**
  - `adminWriteFailureMessage` se queda solo con el texto y descarta el resto del cuerpo de la respuesta.
  - Para `MECHANIC_EMAIL_EXISTS` usa a propósito el genérico "That email already belongs to a Shop user." (`system-admin.ts:57`).
  - En ningún caso el Manager recibe un enlace a "esa persona" ni a "ese Job", aunque la API le dice "Open that roster row to reactivate it".
- **Criterio:** Nielsen H9 (recuperarse de errores) · Nielsen H6 (reconocer antes que recordar).
- **Severidad:** 3 · Frecuencia media: altas de personas que ya existieron y Jobs que ya existen con otro nombre. El Manager tiene que buscar a mano, y en el caso de los aliases no puede, porque ninguna pantalla lista quién usa un alias.
- **Recomendación:**
  - Devolver el cuerpo de la respuesta junto con el mensaje y mostrar una acción en el mismo error. Por ejemplo:
    - "Ya existe Mario Díaz (inactivo). [Abrir y reactivar]".
    - "Ese nombre ya es alias de **Fuel Lines** (Fuel System). [Ver Job]".
  - Para el alias hace falta el nombre del Job dueño: que la API lo agregue al 409, o que la web lo busque por `jobId`.
- **Esfuerzo:** M.

### UX-7-004 · Los cambios sin guardar no se ven y se pierden sin aviso al salir
- **Dónde:**
  - Shop workflow: `admin-shop-workflow.tsx:36` (`dirty`) y `:115`.
  - Shop hours: `admin-shop-workflow.tsx:144` y `:210`.
  - No hay ningún `beforeunload` en `apps/web/src`.
- **Evidencia:**
  - **(Observado)** El botón Save se ve igual, gris, antes y después de cambiar un dueño (`evidencia/00-shop-workflow-cambio-sin-guardar.jpg`).
  - **(Inferido del código)** El código sí lo habilita (`disabled={!dirty || saving}`). Si se habilita y no se nota, la diferencia de estilo entre habilitado y deshabilitado es demasiado débil en esa vista. También pudo ser que la captura se tomó antes de que la página se actualizara. Hay que confirmarlo.
  - No hay texto de "cambios sin guardar".
  - Salir por el menú lateral descarta los cambios sin preguntar.
- **Criterio:** Nielsen H1 (visibilidad del estado del sistema) · Nielsen H5 (prevención de errores).
- **Severidad:** 3 · Flujo crítico 1. Si el Manager cambia un dueño y se va creyendo que quedó guardado, el error aparece días después en el patio, cuando las WO nuevas salen con el dueño viejo.
- **Recomendación:**
  - Mientras haya cambios, mostrar una barra fija "Hay cambios sin guardar · Save · Descartar".
  - Marcar el paso cambiado con un punto o el texto "cambiado".
  - Advertir al salir (`beforeunload` y guarda de navegación).
  - Verificar el contraste del botón habilitado y del deshabilitado (skill 4).
- **Esfuerzo:** S.

### Shop workflow · dueño por paso

### UX-7-005 · Si un dueño guardado dejó de ser válido, el Save falla siempre y el aviso dice "Refresh and try again"
- **Dónde:**
  - `admin-shop-workflow.tsx:43-50`: envía **todos** los pasos y el `catch` ignora el error.
  - `admin-shop-workflow.tsx:56-63`: el dueño guardado sigue en la lista aunque ya no sea elegible.
  - `apps/api/src/admin/shop-workflow.service.ts:81-87`: la API responde `OWNER_NOT_ELIGIBLE`.
- **Evidencia (inferido del código):**
  1. Daniel es el dueño de PM.
  2. Pasa a Standard, o se desactiva.
  3. El Manager cambia el dueño de Detailing y pulsa Save.
  4. La API rechaza todo el envío porque el paso PM sigue con Daniel.
  5. El `catch {}` muestra `shopWorkflowSaveFailed`: "Could not save the shop workflow. Refresh and try again." Recargar no lo arregla, porque Daniel sigue guardado en PM.

  Además, el aviso de la fila solo aparece cuando el dueño está **inactivo** (`:87`). Si perdió el tipo, no hay ninguna pista de cuál es la fila que falla.
- **Criterio:** Nielsen H9 (diagnosticar y recuperarse de errores) · Nielsen H1 (visibilidad del estado).
- **Severidad:** 3 · Pasa siempre después de un cambio de tipo o una baja (ver UX-7-019). El Manager no puede guardar y no sabe por qué.
- **Recomendación:**
  - Enviar solo los pasos cambiados.
  - Pasar `failure` a `apiErrorMessage` y traducir `OWNER_NOT_ELIGIBLE` nombrando el paso: "Daniel ya no es PM. Elige otro dueño para PM.".
  - Marcar esa fila con el error.
  - En la fila, avisar también cuando el dueño perdió el tipo, no solo cuando está inactivo.
- **Esfuerzo:** S.

### UX-7-006 · La lista de dueños no da datos para decidir
- **Dónde:** `admin-shop-workflow.tsx:94-104`, `:56-63`.
- **Evidencia (observado):**
  - PM ofrece solo a Daniel. Alignment y Detailing ofrecen los mismos 6 Standard.
  - No se ve si la persona está activa, cuánto trabajo abierto tiene ni si ya es dueña de otro paso (`observaciones-navegador.md`, Shop workflow).
  - **(Inferido del código)** El dueño guardado que ya no es elegible aparece primero en la lista, sin ninguna marca.
- **Criterio:** Nielsen H6 (reconocer antes que recordar).
- **Severidad:** 2 · La decisión es poco frecuente, pero se toma a ciegas.
- **Recomendación:** en cada opción, nombre · Work Orders abiertas · "(inactive)" o "(no es PM)". Si se reemplaza el `<select>` por una lista con casillas, este dato cabe y también sirve para el cambio de UX-7-020.
- **Esfuerzo:** S.

### UX-7-007 · Hay dos botones de guardar en la página y Enter no guarda ninguno
- **Dónde:**
  - Save: `admin-shop-workflow.tsx:115`.
  - Save shop hours: `admin-shop-workflow.tsx:210`.
  - Los dos son `type="button"` y están fuera de un `<form>`.
- **Evidencia:**
  - **(Observado)** Las dos secciones guardan por separado (`evidencia/00-shop-workflow-desktop.jpg`).
  - **(Inferido del código)** Si el Manager cambia un dueño y la hora y pulsa uno solo, el otro cambio queda sin guardar y sin aviso.
  - Enter en el campo de hora no hace nada.
- **Criterio:** Nielsen H4 (consistencia) · Nielsen H5 (prevención de errores).
- **Severidad:** 2 · Pasa poco, pero el efecto es silencioso.
- **Recomendación:**
  - Envolver cada sección en `<form onSubmit>`, para que Enter funcione en la hora.
  - Junto con UX-7-004, marcar qué sección tiene cambios.
  - O dejar un solo "Save" que guarde las dos secciones.
- **Esfuerzo:** S.

### UX-7-008 · Una actualización de los datos puede borrar la selección que el Manager no guardó
- **Dónde:**
  - Shop workflow: `admin-shop-workflow.tsx:27-30`.
  - Shop hours: `admin-shop-workflow.tsx:136-140`.
- **Evidencia (inferido del código):**
  ```tsx
  useEffect(() => {
    if (!data) return;
    setDrafts(Object.fromEntries(data.map((step) => [step.stepKey, step.defaultMechanic?.id ?? ''])));
  }, [data]);
  ```
  Si SWR trae datos nuevos (otro Manager guardó y esta pestaña vuelve a tener el foco), la selección local sin guardar se reemplaza sin aviso.
- **Criterio:** Nielsen H1 (visibilidad del estado) · Nielsen H3 (control del usuario).
- **Severidad:** 1 · Hace falta que dos personas editen a la vez.
- **Recomendación:** volver a sembrar los borradores solo cuando no haya cambios. Si hay cambios, avisar: "Otro usuario cambió el flujo. [Ver cambios]".
- **Esfuerzo:** S.

### UX-7-009 · Shop hours bloquea el botón por una regla que solo se explica al fallar
- **Dónde:** `admin-shop-workflow.tsx:143`, `:175-184`, `:205`, `:210`.
- **Evidencia (inferido del código):**
  - El campo tiene `min="12:00"`, pero la etiqueta y la ayuda no dicen el rango.
  - "Choose a time between 12:00 p.m. and 11:59 p.m. and at least one day." aparece recién cuando el valor es inválido. Para entonces el botón ya está deshabilitado.
  - `aria-invalid` se pone en la hora también cuando el problema es que no hay días marcados.
- **Criterio:** Nielsen H5 (prevención de errores) · WCAG 3.3.2 (etiquetas o instrucciones).
- **Severidad:** 1 · Se usa casi nunca, y el mensaje aparece al instante.
- **Recomendación:**
  - Poner el rango en la ayuda, debajo de la hora: "Entre 12:00 p. m. y 11:59 p. m.".
  - Separar los dos errores: el de la hora junto a la hora y el de los días junto a los días.
- **Esfuerzo:** S.

### Job Catalog · Add Job, Rename Job, Activate

### UX-7-010 · Add Job desde la lista sí deja elegir la categoría, pero el diálogo guarda lo escrito y el error de la vez anterior
- **Dónde:** `admin-catalog-write.tsx:129-133`, `:164-179`, `:186-187`.
- **Evidencia (inferido del código):**
  - Desde `/admin/catalog`, el diálogo muestra un `Select` con las categorías **activas**. Desde una categoría, la categoría queda fija y el select no aparece.
  - La opción vacía dice "Category", igual que la etiqueta.
  - Cancel y la X solo hacen `setJobOpen(false)`. El componente sigue montado, así que al reabrirlo siguen la categoría elegida, el nombre escrito y el último `error`.
  - El estado solo se limpia después de un alta con éxito (`:150-151`).
  - Si Alignment o Air System están inactivos, no aparecen en la lista y nada explica por qué.
- **Criterio:** Nielsen H1 (visibilidad del estado) · Nielsen H4 (consistencia).
- **Severidad:** 2 · El Manager reabre el diálogo y encuentra un error que ya no aplica.
- **Recomendación:**
  - Limpiar el estado al cerrar, como hace Add person.
  - Usar "Elige una categoría…" como opción vacía.
  - Debajo del select: "Las categorías inactivas no aceptan Jobs nuevos".
- **Esfuerzo:** S.

### UX-7-011 · El conflicto de nombre o de alias aparece recién al enviar y no ofrece qué hacer
- **Dónde:**
  - `admin-catalog-write.tsx:153-155`.
  - API: `system-admin-writes.service.ts:278-279`, `:336-369`.
  - Texto: `apps/web/src/lib/api-error-copy.ts:83-84`.
- **Evidencia (inferido del código):** al agregar o renombrar se hacen dos comprobaciones:
  - **Nombre en la categoría.** Sin distinguir mayúsculas → `CATALOG_JOB_EXISTS`, "That Job name is already in the Job Catalog.".
  - **Alias en todo el catálogo.** Si coincide con un alias de **cualquier** Job, aunque sea de otra categoría → `CATALOG_ALIAS_EXISTS`, "That alias is already used by another catalog Job.".

  En los dos casos:
  - El Manager escribió un *nombre*, no un alias, y no sabe de qué Job se trata.
  - Mientras escribe no aparece ninguna sugerencia.
  - El Job existente puede estar inactivo. Ahí lo que necesita es Activate, pero el error no se lo ofrece.
  - Casos como "lineas de combustible" y "líneas de combustible" (`evidencia/00-catalogo-categoria.jpg`) muestran que el catálogo ya tiene variantes casi iguales.
- **Criterio:** Nielsen H5 (prevención de errores) · Nielsen H9 (recuperarse de errores).
- **Severidad:** 3 · Es el error típico del flujo 2, y la salida obliga a buscar a mano en 17 categorías.
- **Recomendación:**
  - Mientras escribe (con debounce, desde 3 letras), mostrar coincidencias: "Ya existe: **Fuel Lines** · Fuel System · alias 'lineas de combustible'".
  - Al enviar, el error dice el Job y la categoría, con acciones "Ver Job" y, si está inactivo, "Activar ese Job".
- **Esfuerzo:** M.

### UX-7-012 · Al renombrar, el nombre anterior deja de servir para buscar y el diálogo no lo dice
- **Dónde:**
  - `system-admin-writes.service.ts:381-395`: el alias del nombre anterior **se reescribe** con el nuevo.
  - Diálogo: `admin-catalog-write.tsx:237-258`.
- **Evidencia (inferido del código):**
  ```ts
  await tx.jobAlias.update({
    where: { aliasNorm: previousNorm },
    data: { aliasText: nextDisplayName, aliasNorm: nextNorm },
  });
  ```
  - Si un mecánico buscaba "Fuel Line", después del rename ese texto ya no encuentra el Job.
  - El diálogo de Rename no lo avisa. Lo que muestra es el párrafo de Add Job, que no tiene que ver (observado, `evidencia/00-catalogo-renombrar.jpg`).
  - Se puede enviar el mismo nombre sin cambios. Se guarda igual y sale el aviso "renamed".
- **Criterio:** Nielsen H1 (visibilidad del estado) · Nielsen H5 (prevención de errores).
- **Severidad:** 2 · Los renames son raros, pero rompen búsquedas que la gente ya aprendió.
- **Recomendación:**
  - Conservar el nombre anterior como alias. Si no, ofrecer una casilla "Mantener 'Fuel Line' como alias" marcada por defecto.
  - Deshabilitar el botón mientras el nombre sea el mismo, con la pista "Escribe un nombre nuevo".
- **Esfuerzo:** S.

### UX-7-013 · Activate es de un clic y desde la pantalla no tiene vuelta atrás
- **Dónde:** `admin-catalog-write.tsx:72-96`.
- **Evidencia (inferido del código):**
  - Activate llama a la API sin confirmar.
  - La interfaz no tiene Deactivate. La API lo acepta (`status` en `adminUpdateCatalogJobSchema`, `packages/shared/src/schemas.ts:45-50`), pero no hay botón.
  - Un Job activado por error queda visible para todos los mecánicos en el Work Plan.
  - Mientras activa, `busy` deshabilita solo Activate. Rename sigue disponible.
- **Criterio:** Nielsen H3 (control y libertad: deshacer).
- **Severidad:** 2 · Es poco frecuente, pero no se puede corregir sin ayuda técnica.
- **Recomendación:** mientras no exista Deactivate (ver UX-7-022), mostrar después de activar un aviso con "Deshacer" (5 s) que llame a `status: inactive`.
- **Esfuerzo:** S.

### Work Plan · "Also add to the catalog"

### UX-7-014 · La casilla crea una entrada permanente del catálogo sin mostrar qué se va a crear
- **Dónde:** `work-plan-add-work.tsx:130-138`, `:170-173`, `:284-295`.
- **Evidencia (inferido del código):**
  - Con la casilla marcada, Enter o "Add" llama a `createAdminCatalogJob` con el texto libre tal cual, en la categoría que esté elegida arriba.
  - No hay vista previa ("Se creará **Fuel line leak** en **Fuel System**") ni confirmación.
  - El catálogo no tiene borrar ni desactivar en la interfaz, así que un error de tipeo queda para siempre y aparece a todos los mecánicos.
  - El campo admite 120 caracteres (`:274`) y el catálogo 200. No hay ninguna otra regla de forma.
- **Criterio:** Nielsen H5 (prevención de errores) · Nielsen H3 (control: deshacer).
- **Severidad:** 3 · Se usa en el trabajo diario del Manager. El efecto es permanente y lo ven todos.
- **Recomendación:**
  - Al marcar la casilla, mostrar debajo, en vivo: "Se agregará al catálogo como **{nombre}** en **{categoría}**".
  - Después de crear, un aviso con "Deshacer", que necesita la desactivación de UX-7-022.
- **Esfuerzo:** S (la vista previa) · M (deshacer).

### UX-7-015 · Si el nombre choca con un alias o con un Job inactivo, el trabajo no se agrega al plan
- **Dónde:** `work-plan-add-work.tsx:139-159`.
- **Evidencia (inferido del código):**
  - Solo `CATALOG_JOB_EXISTS` con un Job **activo** que no esté ya en el plan se resuelve solo: lo elige y avisa (`customJobAlreadyInCatalog`).
  - Cualquier otro caso cae en `setCatalogError(...)`:
    - `CATALOG_ALIAS_EXISTS`;
    - un Job inactivo, que no viene en `refreshCatalogJobs`;
    - un Job que ya está en el plan.
  - En esos casos el trabajo personalizado **no** se agrega a la lista "To add". El Manager tiene que desmarcar la casilla y volver a pulsar Add, y nada se lo indica.
- **Criterio:** Nielsen H9 (recuperarse de errores).
- **Severidad:** 2 · Pasa con los nombres más comunes, los que ya son alias.
- **Recomendación:**
  - Ante `CATALOG_ALIAS_EXISTS`, elegir el Job dueño del alias, como ya se hace con `CATALOG_JOB_EXISTS`, porque la API devuelve el `jobId`.
  - Si no se puede, agregarlo como personalizado y decir: "No se agregó al catálogo: ya existe como alias de X. Quedó como trabajo personalizado.".
- **Esfuerzo:** S.

### UX-7-016 · El campo de trabajo personalizado no sugiere el Job del catálogo que ya existe
- **Dónde:** `work-plan-add-work.tsx:80-84`, `:244-253`, `:266-283`.
- **Evidencia (inferido del código):**
  - El buscador del catálogo (`jobQuery`) y el campo personalizado (`customName`) son dos campos distintos.
  - `customIsDuplicate` compara solo contra el plan y los borradores, no contra el catálogo.
  - Si el Manager escribe "Fuel Lines" en el campo personalizado sin marcar la casilla, se agrega como trabajo personalizado aunque exista en el catálogo. Así se rompe lo que el catálogo busca: que el mismo trabajo se llame siempre igual.
- **Criterio:** Nielsen H5 (prevención de errores) · Nielsen H6 (reconocer antes que recordar).
- **Severidad:** 2 · Pasa en el uso diario y su efecto se suma con el tiempo (reportes por Job).
- **Recomendación:** mientras escribe en el campo personalizado, mostrar "¿Quisiste decir **Fuel Lines**?", con un botón para elegirlo, usando las mismas coincidencias de UX-7-011.
- **Esfuerzo:** S.

### Mechanics · Add person, Name and type, Deactivate, Reactivate, Reset password

### UX-7-017 · Cambiar el tipo de una persona que tiene trabajo o es dueña de un paso no avisa nada
- **Dónde:**
  - Formulario: `admin-mechanic-roster.tsx:258-273` y `:494`.
  - API: `system-admin-writes.service.ts:145-162`. Solo comprueba trabajo abierto cuando `active === false`; con `mode` borra y vuelve a crear el tipo sin más.
  - Efecto en WO nuevas: `apps/api/src/work-orders/mandatory-jobs.ts:50-56`.
- **Evidencia (inferido del código), con los datos observados en la demo:**
  - Daniel es el único PM, tiene 9 Jobs "PM A Service" pendientes (`evidencia/00-mechanics-desactivar-bloqueado-vs-0.jpg`) y es el candidato natural a dueño del paso PM.
  - Si el Manager lo cambia a Standard y pulsa Save:
    1. sale el aviso "saved";
    2. los 9 Jobs PM siguen a su nombre, aunque ya no es PM;
    3. las WO nuevas dejan el paso PM sin dueño, sin ningún aviso (`usableDefaultOwner` devuelve `null`);
    4. el Shop workflow ya no se puede guardar (UX-7-005).
  - Es un radio y un Save. No hay confirmación ni resumen de lo que afecta.
- **Criterio:** Nielsen H5 (prevención de errores) · Confirmación proporcional a la consecuencia (criterio 11).
- **Severidad:** 3 · Es raro, pero el daño sale días después en el patio: trabajos sin dueño y un carril vacío. Además bloquea otro formulario.
- **Recomendación:**
  - Antes de guardar un cambio de tipo, pedir a la API el trabajo abierto y los pasos del workflow de esa persona.
  - Si hay algo, mostrar un diálogo que lo nombre: "Daniel tiene 9 Jobs PM pendientes y es dueño del paso PM. Al pasarlo a Standard: los Jobs quedan a su nombre / el paso PM queda sin dueño. [Reasignar primero] [Cambiar igual]".
  - En la API, devolver un 409 parecido a `MECHANIC_HAS_OPEN_WORK`, salvo que el cliente confirme.
- **Esfuerzo:** M.

### UX-7-018 · Deactivate pide confirmar primero y avisa del bloqueo después
- **Dónde:** `admin-mechanic-roster.tsx:343-359`, `:406-417`.
- **Evidencia (observado):**
  - El diálogo dice "This person will stop signing in… Nothing is deleted; their history stays." (`evidencia/00-mechanics-desactivar-dialogo.jpg`).
  - Recién al pulsar Deactivate aparece "Reassign first" con 9 Jobs. El botón se apaga (`disabled={busy || Boolean(openWork)}`) y solo quedan enlaces a cada WO.
  - Detrás, la ficha sigue diciendo "Open Work Orders: 0" (`evidencia/00-mechanics-desactivar-bloqueado-vs-0.jpg`).
  - Para reasignar, el Manager tiene que abrir 9 WO una por una y luego volver.
- **Criterio:** Nielsen H5 (prevención de errores) · Nielsen H1 (visibilidad del estado) · Nielsen H7 (eficiencia).
- **Severidad:** 3 · Flujo crítico 3. El Manager pierde un intento y no tiene cómo resolverlo desde ahí.
- **Recomendación:**
  - Al abrir el diálogo, pedir el trabajo abierto (sin escribir nada) y mostrarlo desde el principio.
  - Ofrecer "Reasignar todos a…" con un select de personas del mismo tipo, o pasarlos a la cola del paso cuando exista (UX-7-020).
  - Dejar el texto "Nothing is deleted" para el caso sin bloqueo.
- **Esfuerzo:** M.

### UX-7-019 · Name and type siempre permite guardar y, con la persona inactiva, la ficha muestra dos botones que hacen lo mismo
- **Dónde:**
  - Formulario: `admin-mechanic-roster.tsx:263`, `:268-272`, `:498`.
  - Botón Reactivate: `admin-mechanic-roster.tsx:399-401`.
  - API: `system-admin-writes.service.ts:151-162`.
- **Evidencia (inferido del código):**
  - El Save no compara con los valores guardados. Si se pulsa sin cambios, la API borra y vuelve a crear el tipo (cambia `grantedById` y `grantedAt`) y sale el aviso "saved".
  - Con la persona inactiva, la tarjeta Name and type muestra "Activate" y la tarjeta Access muestra "Reactivate". Hacen lo mismo de dos formas distintas.
  - Desde la lista, Activate pide el tipo (`:208-238`).
- **Criterio:** Nielsen H4 (consistencia) · Nielsen H1 (visibilidad del estado).
- **Severidad:** 2 · Confunde, y deja un historial de permisos que dice algo que no pasó.
- **Recomendación:**
  - Habilitar Save solo con cambios, con la pista "Sin cambios".
  - Con la persona inactiva, un único "Reactivar" que pida el tipo, igual que en la lista.
- **Esfuerzo:** S.

### Cambia por decisión del dueño

Lo que sigue no es un defecto: describe las reglas vigentes (D11, D19, D22, D24, D25), que el dueño decidió cambiar. Se deja como criterio de formulario para diseñar lo nuevo.

### UX-7-020 · (Cambia por decisión) El dueño por paso es un solo `<select>`, pero el taller necesita un equipo con cola
- **Dónde:** `admin-shop-workflow.tsx:94-104` (un `defaultMechanicId` por paso, `:43-46`).
- **Evidencia (observado):**
  - Alignment y Detailing ofrecen 6 personas y solo se puede elegir una.
  - En producción, MA, MD, MG, MPM y QC son equipos (`00-contexto.md` §3).
- **Criterio:** Adecuación del control al dato: selección múltiple → casillas (criterio 3).
- **Severidad:** 3 · Decisión del dueño: equipo por paso, con cola, y un Job con un solo dueño.
- **Recomendación para el formulario nuevo:**
  - Por paso, una lista de casillas con las personas elegibles, cada una con su carga (UX-7-006).
  - Debajo, "Cómo se asigna: al primero que lo toma de la cola".
  - Validar que haya al menos una persona, o mostrar el aviso explícito "Sin equipo: el paso queda sin dueño".
  - El guardado sigue las reglas de UX-7-004 y UX-7-005: solo lo cambiado y el error en la fila.
- **Esfuerzo:** M.

### UX-7-021 · (Cambia por decisión) QC sin control y el paso "PM A Service" en vez de "PM"
- **Dónde:**
  - QC: `admin-shop-workflow.tsx:105-107` (texto fijo "Safety (Quality Check) takes it from the queue").
  - Nombre del paso: `admin-shop-workflow.tsx:85` (`catalogJob.displayName`).
- **Evidencia (observado):** la fila QC no tiene ningún control, y el paso 1 se llama "PM A Service" (`evidencia/00-shop-workflow-desktop.jpg`).
- **Criterio:** Consistencia con el modelo mental del taller.
- **Severidad:** 2 · Decisiones del dueño: el Manager hace QC como respaldo, y el paso se llama "PM".
- **Recomendación:**
  - En la fila QC, el equipo de Safety (como en UX-7-020) más una casilla "El Manager puede completar QC si Safety no puede", marcada por defecto.
  - Mostrar el paso como "PM" y, en gris, el Job del catálogo que crea.
- **Esfuerzo:** S.

### UX-7-022 · (Cambia por decisión) No hay formularios para aliases ni para borrar o desactivar Jobs
- **Dónde:** `admin-catalog-category-detail.tsx:52-55`: los aliases son texto y la única acción es Rename.
- **Evidencia (observado):** cada Job tiene solo "Rename Job". No hay estado, desactivar, borrar ni edición de aliases (`evidencia/00-catalogo-categoria.jpg`).
- **Criterio:** Control y libertad (Nielsen H3) · Confirmación proporcional (criterio 11).
- **Severidad:** 3 · Decisión del dueño: el Manager maneja categorías, Jobs y aliases, con protecciones.
- **Recomendación para los formularios nuevos:**
  - **Aliases:**
    - Mostrarlos como chips con "×".
    - Un campo "Agregar alias" que valide al salir del campo (blur) y al enviar.
    - Si hay conflicto, decir en el mismo campo de qué Job es: "Ya es alias de Fuel Lines".
    - Quitar un alias no pide confirmación, pero sí ofrece Deshacer.
  - **Borrar o desactivar:**
    - Un solo botón que decide según el uso. Sin uso: "Eliminar", con confirmación que nombra el Job.
    - Con uso: "Desactivar", con un diálogo que dice "Está en 23 WO; seguirá en ellas y no aparecerá para nuevas".
    - Bloquear la acción si el Job es de un paso del Shop workflow, y decir cuál.
- **Esfuerzo:** M.

### UX-7-023 · (Cambia por decisión) No existe "Remove" para una persona
- **Dónde:** `admin-mechanic-roster.tsx:396-403`: solo Deactivate o Reactivate y Reset password.
- **Evidencia (observado):** no hay botón para sacar a una persona (`observaciones-navegador.md`, Mechanics).
- **Criterio:** Confirmación proporcional (criterio 11).
- **Severidad:** 2 · Decisión del dueño: "Remove" conserva el historial.
- **Recomendación para el formulario nuevo:**
  - Diálogo "Quitar a {nombre}" con la misma comprobación previa de UX-7-018 (trabajo abierto, pasos del workflow, reloj corriendo) y la reasignación ahí mismo.
  - El texto: "Su historial queda en las WO cerradas; no aparecerá en listas ni podrá entrar".
  - Botón destructivo "Quitar", separado de Cancel.
- **Esfuerzo:** M.

### UX-7-024 · (Cambia por decisión) Los formularios de partes y costos están por diseñar
- **Dónde:** no hay ruta. Los modelos `Part`, `PartCategory`, `PartFitment` y `PmServicePart` están en `apps/api/prisma/schema.prisma`, sin pantalla (`00-contexto.md` §2).
- **Evidencia (observado):** el menú de Setup tiene solo Mechanics, Job Catalog y Shop workflow.
- **Criterio:** Criterios 1, 3, 4, 7 y 9 de formularios.
- **Severidad:** 2 · Decisión del dueño: partes y costos por camión, etapa 1.
- **Recomendación para el diseño (compras y reparaciones externas):**
  - **Montos:**
    - `inputmode="decimal"` con la moneda visible ("Costo (USD)").
    - Aceptar "1,250.00" y "1250".
    - Mostrar el total en vivo cuando haya cantidad × precio.
  - **Fecha y proveedor:**
    - Fecha con hoy por defecto, que también acepte escribirla.
    - Proveedor o taller externo con autocompletar sobre los ya usados, para no duplicar.
  - **Contexto:** camión y WO ya elegidos cuando se viene desde ellos.
  - **Factura:** arrastrar o elegir archivo, con los tipos y el tamaño indicados antes, progreso y quitar.
  - **Envío:**
    - "Guardando…" con el botón deshabilitado durante el envío.
    - Clave de idempotencia, porque es dinero: el doble envío sería severidad 4.
    - Borrador en `sessionStorage` si el formulario pasa de 5 campos.
  - **Errores:** junto a cada campo (UX-7-001).
- **Esfuerzo:** L.

### UX-7-025 · (Cambia por decisión) Al reasignar por la cola, el bloqueo de Deactivate tiene que proponer la cola
- **Dónde:** `admin-mechanic-roster.tsx:280-307` (`MechanicOpenWorkAlert`, solo enlaces).
- **Evidencia (inferido del código):** hoy la única salida es abrir cada WO. Con equipos y cola (UX-7-020), lo natural es "Devolver sus 9 Jobs a la cola de PM".
- **Criterio:** Nielsen H7 (eficiencia de uso).
- **Severidad:** 2 · Depende de UX-7-020.
- **Recomendación:** en el aviso de bloqueo, un botón "Devolver a la cola" (y "Reasignar a…") que resuelva todo en un paso y vuelva a intentar Deactivate o Remove.
- **Esfuerzo:** M.

## Corrida 2 · Parts & costs (2026-10-09)

**Alcance:** New / Edit purchase (`apps/web/src/components/admin-purchase-form.tsx`), New / Edit outside repair (`admin-outside-repair-form.tsx`) y el detalle de la compra (`admin-purchase-detail.tsx`). **Método:** reporte del dueño en producción con dos capturas (formulario y detalle), recorrido en la demo local (`ltl_shop_setup_demo`) y lectura del código. El panel del navegador estaba oculto: no hay capturas nuevas, solo observaciones.

| Formulario | Ruta | Flujo | Patrón | Revisión |
|---|---|---|---|---|
| New / Edit purchase | `/admin/parts/purchases` (diálogo) | J13 | Modal con `<form onSubmit noValidate>`, estado local, borrador en `sessionStorage` | Completa |
| New / Edit outside repair | `/admin/parts/outside-repairs` (diálogo) | J13 | El mismo patrón, sin borrador | Muestreo (mismo patrón) |

### UX-7-026 · Al guardar con datos faltantes no dice qué falta
- **Dónde:** New purchase · `admin-purchase-form.tsx:316-322` (submit) y los campos `aria-invalid` sin texto (`:358`, `:384`, `:463`); igual en `admin-outside-repair-form.tsx`
- **Evidencia:** (observado) demo: New purchase vacío → Save purchase: 4 campos con borde rojo, **un** solo texto ("Pick a part or describe it."), nada arriba, el foco queda en el `BODY`. Reporte del dueño: "si falta información no me dice que falta por llenar".
- **Criterio:** Nielsen H9 (reconocer y recuperarse de errores) · WCAG 3.3.1 (identificación de errores) y 1.4.1 (no solo color)
- **Severidad:** 3 · Cada compra; el Manager no sabe por qué no guarda y prueba al azar
- **Recomendación:** Al tocar Save con faltantes: un resumen arriba del formulario ("Falta: Proveedor, N.º de factura, Línea 1: costo unitario") y un texto junto a **cada** campo; el foco y el scroll van al primer campo que falta. Marcar los campos opcionales "(optional)" para que lo obligatorio se deduzca.
- **Esfuerzo:** S

### UX-7-027 · Lo que la pantalla calcula o llena sola no se explica
- **Dónde:** New purchase · costo unitario que se llena con el último pagado o el de referencia (`admin-purchase-form.tsx:173-179`), total de línea, reparto del impuesto y el flete (`:283-288`, la nota solo con varios camiones), recuadro de totales sin impuesto ni flete
- **Evidencia:** (observado) captura del dueño: "Unit cost 22.00" ya puesto y debajo "Last paid $22.00 on Oct 9" sin decir que es de ahí; el recuadro dice Subtotal $286.00 · Total $530.00 sin mostrar los $222.00 de impuesto ni los $22.00 de flete. Reporte: "no sé si se hacen ajustes o cálculos automáticos".
- **Criterio:** Nielsen H1 (visibilidad del estado) y H10 (ayuda en contexto)
- **Severidad:** 2 · El Manager completa la compra, pero no confía en el total
- **Recomendación:** Bajo el costo: "Filled with the last price paid to {vendor} ({date}). Change it if the invoice is different." (o "with the part's reference cost"). Recuadro de totales: Subtotal, Tax, Freight & other, **Total**, y una línea de a dónde va ("All to Truck 277" / "Truck 606 $49.80 · No truck $10.20"). Bajo Lines: "Line total = Qty × Unit cost."
- **Esfuerzo:** S

### UX-7-028 · "Other (not in catalog)" no dice que la pieza no entra al catálogo
- **Dónde:** New purchase · opción "Other" del selector de parte (`admin-purchase-form.tsx:410-420`)
- **Evidencia:** (observado) reporte del dueño: "cuando no está la parte sale other (not in catalog), ¿así se agregan piezas nuevas?". No se agrega: la descripción queda solo en esa compra (D-PC3).
- **Criterio:** Nielsen H2 (coincidencia con el mundo real) y H6 (reconocer antes que recordar)
- **Severidad:** 2 · Puede creer que agregó la pieza al catálogo y no encontrarla después
- **Recomendación:** Renombrar la opción "Other — only on this invoice" y, al elegirla, un texto: "Saved only on this purchase; it is not added to Parts. PM parts are added in Parts → Add part." con el enlace (en otra pestaña, para no perder el formulario).
- **Esfuerzo:** S

### UX-7-029 · "Discard this purchase?" aparece al final del formulario, fuera de la vista
- **Dónde:** Edit / New purchase · bloque `alertdialog` debajo de las notas (`admin-purchase-form.tsx:535-545`)
- **Evidencia:** (observado) captura del dueño: el aviso queda abajo, después de Notes; con varias líneas no se ve al tocar Cancel y parece que Cancel no hace nada.
- **Criterio:** Nielsen H1 (visibilidad) y H3 (control y libertad)
- **Severidad:** 3 · Cada vez que cierra con cambios; parece un botón roto
- **Recomendación:** Barra inferior fija dentro del diálogo (sticky) con el error, el aviso de descartar y los botones Cancel / Save, siempre a la vista; al tocar Cancel con cambios, el aviso aparece ahí mismo, junto a los botones.
- **Esfuerzo:** S

## Lo que funciona bien
- **Doble envío cubierto en todos los formularios.**
  - Cada envío tiene su `busy` o `saving`, y deshabilita el botón y los campos mientras dura (`admin-catalog-write.tsx:146,188`; `admin-mechanic-roster.tsx:162,200`; `admin-shop-workflow.tsx:39,115`).
  - La API también se protege: email único en `createMechanic`, y nombre y alias únicos en el catálogo.
- **Los diálogos son `<form onSubmit>`, con etiquetas asociadas.**
  - Enter envía en Add Job, Rename y Add person.
  - Cada `Input` tiene `Label htmlFor`.
  - El tipo de persona es un `fieldset` con `legend` y radios de 44 px (`admin-mechanic-roster.tsx:52-71`).
- **El diálogo de Deactivate está bien planteado.** Nombra a la persona y su email, usa un botón destructivo con el verbo ("Deactivate") separado de Cancel, y su texto dice qué se conserva.
- **La contraseña temporal se muestra una sola vez.** Va en un campo de solo lectura, con Copy y con una alternativa de seleccionar el texto si el portapapeles falla (`admin-mechanic-roster.tsx:79-118`).
- **"Also add to the catalog" resuelve bien el duplicado más común.** Cuando el nombre ya es un Job activo de la categoría, lo elige y lo dice (`work-plan-add-work.tsx:146-150`). Ese es el patrón que conviene extender (UX-7-015, UX-7-016).

## Fuera de alcance / no verificado
- **No se usó el navegador en esta corrida.** Lo marcado **(observado)** viene de `evidencia/observaciones-navegador.md` y sus capturas (2026-10-07). Lo demás es **(inferido del código)**. En esta corrida no se tomaron capturas nuevas `07-*.png`.
- **Pendiente de confirmar en el navegador:**
  - UX-7-004: si Save cambia de aspecto al cambiar un dueño. El código dice que sí; la captura observada dice que no.
  - UX-7-002: Esc durante el envío.
  - UX-7-005: el error `OWNER_NOT_ELIGIBLE` con un dueño que perdió el tipo.
  - UX-7-017: el cambio de tipo de Daniel en la demo.
- **No probado:** el comportamiento en móvil de los diálogos (teclado virtual, botón alcanzable) y la sesión expirada a mitad de un formulario (skill 8).
- **De otras skills:**
  - La redacción de los mensajes es de la skill 3. Por ejemplo, el párrafo de Add Job repetido en Rename.
  - El "Open Work Orders: 0" que no coincide con la base es de la skill 6 y de la skill 8.
