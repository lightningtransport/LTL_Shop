# 05 · Navegación y arquitectura de información — Lightning Shop, Setup del admin

**Fecha:** 2026-10-07 · **Alcance:** grupo Setup del menú (Mechanics, Job Catalog, Shop workflow y Shop hours), detalles de categoría y de persona, la entrada del Manager a `/qc` y el hueco de Partes y costos · **Método:** código (rutas, enlaces, guards, redirecciones) + observaciones del navegador ya registradas en `evidencia/observaciones-navegador.md` (demo local, Manager, 1440×900 y 375×812). En esta corrida no se abrió el navegador.
**Resumen:** 15 hallazgos, 4 de severidad 3. El patrón dominante es que Setup está ordenado por objeto (personas, trabajos, pasos), pero los tres objetos no se enlazan entre sí. Para responder "¿quién hace este paso?", "¿en qué pasos está esta persona?" o "¿dónde se usa este Job?", el Manager tiene que cruzar pantallas de memoria, y una de esas preguntas no tiene respuesta en ninguna pantalla. El menú no hay que rehacerlo, pero sí reordenarlo y renombrarlo. Lo que sí falta es un sitio para Partes y costos.

## Mapa de navegación observado

Inicio = `/admin` (Dashboard), donde cae el Manager al entrar (`apps/web/src/lib/admin-routing.ts:11`). Los clics cuentan desde el inicio en computadora. En el teléfono se suma 1 clic para abrir el menú (`admin-shell.tsx:145-156`).

| Ruta | Etiqueta (EN / ES) | Cómo se llega | Clics desde inicio | Rol / guard |
|---|---|---|---|---|
| `/admin` | Dashboard | Menú › Operations | 0 | `admin.access` (`middleware.ts:10`, `admin.controller.ts:31`) |
| `/admin/mechanics` | Mechanics / Mecánicos | Menú › Setup | 1 | Lectura: `admin.access`. Escritura: `ManagerWritesGuard` (`admin.controller.ts:230-246`) |
| `/admin/mechanics/[id]` | Nombre de la persona | Nombre en la lista (`admin-mechanics-list.tsx:88`). **Sin otro origen**: ningún otro `href` en `apps/web/src` apunta aquí | 2 (3-4 si hay que buscar: escribir + "Apply filters") | Igual que la anterior. Edición solo si `role === mechanic` (`admin-mechanic-detail.tsx:16`) |
| `/admin/catalog` | Job Catalog / Catálogo de Jobs | Menú › Setup | 1 | Lectura: `admin.access`. Escritura: `ManagerWritesGuard` (`admin.controller.ts:290-299`) |
| `/admin/catalog/categories/[id]` | Nombre de la categoría | Nombre en la tabla (`admin-catalog-list.tsx:62`) | 2 (observado: 3, porque el primer clic no navegó) | Igual que la anterior |
| ↳ diálogo Add Job / Rename Job | — (sin URL) | Botón en la lista o en el detalle | 2-3 | `ManagerWritesGuard` |
| `/admin/setup/workflow` | Shop workflow / Flujo del taller | Menú › Setup | 1 | Lectura: `admin.access`. Escritura: comprobación en el servicio (`admin.controller.ts:258-267`, `admin-shop-workflow.tsx:19`) |
| ↳ Shop hours | Shop hours / Horario del taller | **Solo con scroll** dentro de Shop workflow (`admin-shop-workflow.tsx:117`). No está en el menú | 1 + scroll | Igual que la anterior |
| `/qc` | Quality Check | No está en el menú del admin | — | `quality_check.perform` (`quality-check.controller.ts:12`). El Manager es redirigido a `/admin` (`quality-check-page.tsx:68`) |
| Partes y costos | — | **No existe** | — | Solo hay modelos y seed (`schema.prisma` `Part`…, `prisma/pm-parts.ts`) |

**Tareas de Setup, en clics:**

| Tarea (flujo del contexto) | Recorrido | Clics |
|---|---|---|
| Cambiar el dueño de un paso (flujo 1) | Menú › Shop workflow → elegir en el select → Save | 3 |
| Encontrar un Job por su nombre o alias (flujo 2) | Menú › Job Catalog → adivinar la categoría → abrir → leer. Si no está, volver y probar otra | 3 por intento, hasta 17 categorías (≈ 35 clics en el peor caso) |
| Renombrar un Job (flujo 2) | Lo anterior + Rename Job + Save | 5+ |
| Desactivar a una persona (flujo 3) | Menú › Mechanics → (buscar + Apply) → nombre → Deactivate → confirmar. Si tiene trabajo abierto, recién ahí sale "Reassign first" | 4-6 |
| Ver en qué pasos está una persona | No hay pantalla. Hay que abrir Shop workflow y leer cada select | — |
| Ver dónde se usa un Job del catálogo | No hay pantalla | — |
| Ver o cambiar el horario del taller | Menú › Shop workflow → scroll hasta el final | 1 + scroll |

**Rutas huérfanas:** ninguna en sentido estricto. Hay dos casi huérfanas: el perfil de una persona (solo se llega desde la lista de Mechanics) y Shop hours (sin entrada propia). `/qc` existe, pero el Manager no puede usarla.

## Estructura propuesta

Mantiene el agrupado por objeto y agrega lo que falta: las relaciones entre pantallas y un grupo nuevo para partes y costos. Los cambios marcados con **[decisión]** vienen de las decisiones del dueño del 2026-10-07: equipos y cola por paso, respaldo de QC del Manager, gestión del catálogo, "Remove" persona y Partes y costos, etapa 1.

```
Operations / Operación                       (sin cambios)
├── Dashboard
├── Yard Operations
├── Work Orders
└── Trucks
    └── Truck › pestaña "Costs"              [decisión] costo por camión vive en el camión, no en Setup

Parts & costs / Partes y costos              NUEVO grupo [decisión]; va antes de Setup porque se usa más seguido
├── Purchases / Compras                      tarea semanal: registrar factura de partes (camión opcional)
├── Outside repairs / Reparaciones externas  tarea semanal: factura de taller externo (camión, Job opcional)
├── Parts / Partes                           catálogo de partes; alimenta el selector del PM
└── Vendors / Proveedores                    dato maestro compartido por Compras y Reparaciones externas
    (Finance / cobro interno: diseño, sin entrada de menú hasta que exista)

Setup / Configuración                        reordenado por dependencia: qué se hace → con qué → quién
├── Shop workflow / Flujo del taller         SUBE al primer lugar: es el flujo crítico 1
│   ├── Paso → Job (enlace a su categoría)   NUEVO enlace
│   └── Paso → equipo + cola (enlace a cada persona)   [decisión] equipos por paso
├── Job Catalog / Catálogo de Jobs
│   └── Categoría → Job → "Used in: Shop workflow · PM A Service"   NUEVO "dónde se usa"
├── People / Personas                        RENOMBRADO desde "Mechanics": incluye Safety y admins
│   └── Persona → "Teams: Detailing, Alignment" (enlace al paso)    NUEVO
└── Shop hours / Horario del taller          SALE de Shop workflow a una entrada propia
                                             (o queda como pestaña de Shop workflow con su URL)

Audit / Auditoría                            (sin cambios)
└── History
```

**Por qué así:**
- **Partes y costos fuera de Setup.** Setup es lo que se toca "de vez en cuando" (`00-contexto.md` §1). Registrar compras y facturas externas es trabajo de todas las semanas. Ponerlo bajo Setup mezclaría frecuencias, y el criterio de agrupación del menú es la frecuencia (LTR-122, `admin-shell.tsx:15`). Partes y Proveedores son datos maestros, pero van en el mismo grupo que Compras porque solo se crean o editan al registrar una compra. Separarlos obligaría a ir y volver entre grupos. Con 4 ítems, el grupo queda en un tamaño razonable.
- **Proveedores**: un solo lugar, compartido por Compras y Reparaciones externas. No debe vivir dentro de Partes, porque una reparación externa no tiene partes.
- **Costo por camión**: es una vista del camión, no una sección. Va como pestaña en el detalle del Truck, que es donde el Manager ya mira un camión.
- **Orden de Setup**: Shop workflow primero (flujo crítico 1), Catálogo después (el paso apunta a un Job), Personas al final (el paso apunta a un equipo). Hoy el orden es Mechanics, Catalog, Workflow (`admin-shell.tsx:29-31`), que es el orden en que se construyeron.
- **URLs**: los ítems nuevos de Setup bajo `/admin/setup/*` y los de partes bajo `/admin/parts/*`. Las rutas actuales se redirigen para no romper enlaces guardados (ver UX-5-006).

## Hallazgos

### Organización y "¿qué hay aquí?"

### UX-5-001 · Las tres pantallas de Setup describen un mismo sistema, pero no se enlazan entre sí
- **Dónde:** `/admin/setup/workflow`, `/admin/catalog/categories/[id]`, `/admin/mechanics/[id]`. El paso muestra su Job y su categoría como texto plano (`apps/web/src/components/admin-shop-workflow.tsx:85-86`), y las personas del select son solo nombres (`:101-103`). El Job del catálogo muestra nombre, estado y aliases, pero no su uso (`admin-catalog-category-detail.tsx:46-57`). El perfil de la persona muestra capacidades y conteos, pero no los pasos que tiene (`admin-mechanic-detail.tsx:34-44`). El DTO del paso ni siquiera trae `categoryId` para poder enlazar (`packages/shared/src/types.ts:895`).
- **Evidencia:** (inferido del código) ningún `href` de estas pantallas apunta a otra pantalla de Setup. Los únicos enlaces son la lista → detalle y "Back to…". (observado) `observaciones-navegador.md` › Shop workflow: "No hay ninguna pista de quién está ocupado, de la carga de trabajo ni de si la persona está activa".
- **Criterio:** Movimiento (desde un detalle se va a lo relacionado sin pasar por el menú) · Nielsen H6 (reconocer en vez de recordar).
- **Severidad:** 3 · Se paga en cada cambio de Setup: antes de desactivar a alguien, cambiar un Job o armar un equipo, el Manager tiene que recordar qué depende de qué. Los errores aparecen días después en el patio (`00-contexto.md` §1). Con equipos por paso **[decisión]**, el cruce persona ↔ paso pasa de 4 relaciones a decenas.
- **Recomendación:**
  - En Shop workflow: el nombre del Job enlaza a su categoría (agregar `categoryId` al DTO) y cada miembro del equipo enlaza a su perfil.
  - En el perfil de la persona: una tarjeta "Teams / Equipos", con los pasos a los que pertenece y un enlace a Shop workflow.
  - En el catálogo: ver UX-5-002.
- **Esfuerzo:** M

### UX-5-002 · No hay forma de saber dónde se usa un Job del catálogo
- **Dónde:** Job Catalog, detalle de categoría (`/admin/catalog/categories/[id]`) · `apps/web/src/components/admin-catalog-category-detail.tsx:46-57`.
- **Evidencia:** (observado) "Cada Job es un nombre, una línea 'Aliases: …' y un solo botón, 'Rename Job'". (inferido del código) El `AdminCatalogJobDto` no trae uso (`packages/shared/src/types.ts:874`).
- **Criterio:** Organización (un contenido, sus relaciones visibles) · Nielsen H5 (prevención de errores).
- **Severidad:** 3 · Con la gestión del catálogo **[decisión: renombrar, desactivar, borrar]**, el Manager puede desactivar "PM A Service" o "Detailing" sin saber que es un paso obligatorio, y el efecto aparece en la próxima WO. La protección en la API evita el daño, pero no le explica al Manager por qué no puede hacerlo.
- **Recomendación:**
  - Bajo cada Job, una línea "Used in: Shop workflow (step 1) · 12 open Work Orders", con enlace.
  - El menú de acciones del Job desactiva "Deactivate" y "Delete" cuando es un paso del flujo, con el motivo a la vista.
- **Esfuerzo:** M

### UX-5-003 · "Mechanics" reúne a personas que no son mecánicos
- **Dónde:** Menú › Setup › Mechanics (`apps/web/src/components/admin-shell.tsx:29`, `admin-messages.ts:17` y `:1007`, "Mecánicos"). El roster incluye a Safety (`apps/api/src/admin/admin.service.ts:118-123`) y a los usuarios admin con capacidad de mecánico. Solo el selector de asignación los excluye (`:2230-2231`).
- **Evidencia:** (observado) los admin aparecen con "Shop Admin · Standard · PM" (Cristian Perez, iBrain Admin), y el subtítulo de la página dice "Add Standard, PM or Safety people" (`admin-messages.ts:372`).
- **Criterio:** Nomenclatura (la etiqueta dice qué hay dentro).
- **Severidad:** 2 · El Manager encuentra igual a la persona, pero no espera ver a Safety ni a los admins bajo "Mechanics". Con equipos por paso **[decisión]**, "Mechanics" tampoco sirve para decir "el equipo de QC". El vocabulario se desarrolla en la skill 3.
- **Recomendación:** renombrar el ítem y el título a "People / Personas" (o "Shop team / Equipo del taller"). Mantener la columna de tipo (Standard, PM, Safety, Admin) como filtro.
- **Esfuerzo:** S

### UX-5-004 · No hay ningún lugar para partes, proveedores ni costos (cambia por decisión)
- **Dónde:** menú del admin (`apps/web/src/components/admin-shell.tsx:16-40`). Las partes existen solo como modelos y seed (`schema.prisma` `Part`, `PartCategory`, `PartFitment`, `PmServicePart`; `apps/api/prisma/pm-parts.ts`).
- **Evidencia:** (observado) "No hay ninguna entrada de menú ni pantalla de partes en Setup".
- **Criterio:** Organización (la función existe para el negocio, pero no tiene sitio en la estructura). **Cambia por decisión** (D24 se reemplaza por Partes y costos, etapa 1). No es un defecto de la regla vigente.
- **Severidad:** 2 · Hoy no bloquea ninguna tarea de la app. La decisión del dueño lo convierte en una sección nueva, y el riesgo de IA es colgarla en el lugar equivocado.
- **Recomendación:** grupo de menú propio "Parts & costs / Partes y costos" con Purchases, Outside repairs, Parts y Vendors, más la pestaña "Costs" en el Truck (ver Estructura propuesta). No meterlo dentro de Setup.
- **Esfuerzo:** L

### UX-5-005 · Shop hours está escondido dentro de Shop workflow
- **Dónde:** `/admin/setup/workflow` · `apps/web/src/components/admin-shop-workflow.tsx:117` y `:161-212`. No tiene ítem de menú ni URL propia.
- **Evidencia:** (observado) "Shop hours tiene su propio 'Save shop hours': dos botones de guardar en la misma página".
- **Criterio:** Nomenclatura y organización (nada en "Shop workflow" sugiere que ahí se define a qué hora se paran los relojes).
- **Severidad:** 2 · Es una tarea poco frecuente, pero quien la busca no la encuentra por el menú. Además, los dos guardados en la misma página confunden qué se guarda (skill 7).
- **Recomendación:** ítem propio "Shop hours / Horario del taller" bajo Setup (`/admin/setup/hours`), o pestañas con URL dentro de Shop workflow (`?tab=hours`).
- **Esfuerzo:** S

### UX-5-006 · Las URLs de Setup no siguen el menú
- **Dónde:** `apps/web/src/components/admin-shell.tsx:29-31`. Shop workflow vive en `/admin/setup/workflow`, y Mechanics y Job Catalog en `/admin/mechanics` y `/admin/catalog`.
- **Evidencia:** (inferido del código) las tres rutas de la tabla del mapa.
- **Criterio:** Orientación (la URL refleja la jerarquía).
- **Severidad:** 1 · No impide nada. Solo cuesta al compartir enlaces y al agregar las secciones nuevas.
- **Recomendación:** al agregar las rutas nuevas, usar `/admin/setup/{workflow,catalog,people,hours}` y redirigir las actuales (`next.config` `redirects`), para no romper enlaces guardados.
- **Esfuerzo:** S

### ¿Dónde estoy?

### UX-5-007 · En el detalle de categoría y de persona, la barra superior no nombra la página
- **Dónde:** `/admin/catalog/categories/[id]` y `/admin/mechanics/[id]`. `useAdminBreadcrumb` se usa solo en Truck y WO (`admin-truck-detail.tsx:47`, `admin-work-order-detail.tsx:148`). Si la página no lo llama, la barra cae al ítem del menú, sin enlace (`admin-shell.tsx:77-78`).
- **Evidencia:** (inferido del código) en "Fuel System", la barra superior dice solo "Job Catalog", como texto y no como enlace.
- **Criterio:** Orientación (breadcrumb con cada nivel clicable, coherente entre pantallas).
- **Severidad:** 1 · La página tiene su propio "Back to…" y su título. Es una inconsistencia con Truck y WO.
- **Recomendación:** `useAdminBreadcrumb([{ label: 'Job Catalog', href: '/admin/catalog' }, { label: data.name }])` en los dos detalles. Lo mismo para persona.
- **Esfuerzo:** S

### ¿A dónde puedo ir?

### UX-5-008 · El primer clic en una categoría no abrió el detalle
- **Dónde:** Job Catalog, tabla (`/admin/catalog`) · `apps/web/src/components/admin-catalog-list.tsx:62`. Lo mismo ocurre en la lista de Mechanics (`admin-mechanics-list.tsx:88`).
- **Evidencia:** (observado) "el primer clic en 'Fuel System' no navegó, solo hizo scroll. Navegando directo a la URL, el detalle sí carga". (inferido del código) Las dos listas usan `next/link` con prefetch por defecto. El menú y el dashboard usan `AdminNavLink`, creado justamente porque "an in-flight RSC prefetch [can] leave the first click non-navigable" (`admin-nav-link.tsx:10-13`).
- **Criterio:** Movimiento (los enlaces responden al primer gesto) · Nielsen H1.
- **Severidad:** 2 · El Manager lo resuelve con un segundo clic, pero cree que el enlace está roto, y pasa en la entrada principal del catálogo.
- **Recomendación:** usar `AdminNavLink` en los enlaces de fila de `admin-catalog-list.tsx:62` y `admin-mechanics-list.tsx:88`, y en `AdminBackLink` (`ui.tsx:802`).
- **Esfuerzo:** S

### UX-5-009 · El Manager que entra a `/qc` vuelve al Dashboard sin saber por qué (cambia por decisión)
- **Dónde:** `/qc` · `apps/web/src/components/quality-check-page.tsx:68` → `defaultWorkspacePath` (`apps/web/src/lib/admin-routing.ts:10-17`). La API exige `quality_check.perform` (`apps/api/src/quality-check/quality-check.controller.ts:12`).
- **Evidencia:** (observado) "Manager en `/qc`: lo manda a `/admin` (Dashboard) sin ningún mensaje". El respaldo existente está en otro sitio: "Waiting for Safety · Mark it here only if Safety cannot · Mark QC complete" en el Dashboard.
- **Criterio:** Roles y permisos (el mismo concepto, en el mismo sitio para todos los roles; no ocultar sin explicar). **Cambia por decisión**: respaldo de QC del Manager (D19 se amplía).
- **Severidad:** 2 · Pasa cuando Safety falta y el Manager busca la cola de QC. Termina en el Dashboard y no sabe si la cola existe.
- **Recomendación:** con el respaldo decidido, el Manager abre `/qc` con la misma cola (o una vista "as backup"), en vez de ser redirigido. Mientras tanto, redirigir con un aviso: "Quality Check is Safety's queue. As Manager, mark QC from the Dashboard › Waiting for Safety."
- **Esfuerzo:** M

### UX-5-010 · Los avisos de pasos faltantes no llevan a donde se definen los pasos
- **Dónde:** Dashboard y Truck, "Missing required steps" (`apps/web/src/lib/admin-messages.ts:22-23`, `:699`). En todo `apps/web/src`, el único `href` a `/admin/setup/workflow` es el del menú (`admin-shell.tsx:31`).
- **Evidencia:** (observado) "Every Work Order needs PM, Alignment, Detailing and Quality Check. Each is added with its default owner." Muestra "Add missing steps", pero no un enlace al Shop workflow.
- **Criterio:** Movimiento (de un efecto a su causa sin pasar por el menú).
- **Severidad:** 2 · El texto menciona el "default owner" de cada paso. Si el dueño está mal o falta, el Manager no tiene camino directo para corregirlo. Además, la lista de pasos está escrita a mano en el texto y no sale del flujo (skill 3).
- **Recomendación:** agregar "Change default owners" → `/admin/setup/workflow` junto a "Add missing steps", y generar la lista de pasos a partir de los datos del flujo.
- **Esfuerzo:** S

### UX-5-011 · Al perfil de una persona solo se llega desde la lista de Mechanics
- **Dónde:** `/admin/mechanics/[id]`. El único origen es `admin-mechanics-list.tsx:88`.
- **Evidencia:** (inferido del código) no hay otro `href` a `/admin/mechanics/` en `apps/web/src`. Los nombres de dueño en WO, Truck y Shop workflow son texto. Al revés funciona: el perfil enlaza a sus WO (`admin-mechanic-detail.tsx:55`, `:75`).
- **Criterio:** Movimiento (relaciones navegables en los dos sentidos).
- **Severidad:** 2 · Para revisar a alguien que ve en una WO (su carga o si está activo), el Manager va al menú, busca, aplica el filtro y abre el perfil: 4 clics en vez de 1.
- **Recomendación:** el nombre del dueño enlaza al perfil en el detalle de WO, en Truck y en Shop workflow (UX-5-001).
- **Esfuerzo:** S

### ¿Cómo vuelvo?

### UX-5-012 · Volver desde el detalle pierde la búsqueda
- **Dónde:**
  - Catálogo: la búsqueda vive solo en el estado del componente (`apps/web/src/components/admin-catalog-list.tsx:16`) y se pierde al ir al detalle, tanto con "Back to Job Catalog" (`admin-catalog-category-detail.tsx:24`) como con el atrás del navegador.
  - Mechanics: el filtro sí está en la URL (`admin-mechanics-list.tsx:65-70`), pero "Back to Mechanics" apunta fijo a `/admin/mechanics` (`admin-mechanic-detail.tsx:25`), sin `?search=` ni `includeInactive`.
- **Evidencia:** (inferido del código) las líneas citadas.
- **Criterio:** Movimiento ("volver" lleva a donde estaba el usuario, con sus filtros).
- **Severidad:** 2 · Son pantallas de uso ocasional, pero el recorrido típico (buscar → abrir → volver → abrir otro) obliga a reescribir la búsqueda cada vez.
- **Recomendación:** guardar la búsqueda del catálogo en `?search=`. "Back" vuelve con `router.back()` si se llegó desde la lista, o recibe la consulta (`?from=`), como ya hace el detalle de Truck con `originCrumb` (`admin-truck-detail.tsx:47`).
- **Esfuerzo:** S

### UX-5-013 · Salir de Shop workflow con dueños cambiados descarta los cambios sin avisar
- **Dónde:** `/admin/setup/workflow` · `apps/web/src/components/admin-shop-workflow.tsx:23`, `:36`. Los borradores son estado local y no hay aviso al salir.
- **Evidencia:** (observado) "El botón Save se ve igual, gris y apagado, antes y después de cambiar un dueño" (`00-shop-workflow-cambio-sin-guardar.jpg`). (inferido del código) No hay `beforeunload` ni guarda de navegación.
- **Criterio:** Movimiento (volver sin perder estado) · Nielsen H3. El detalle del formulario es de la skill 7.
- **Severidad:** 2 · El Manager cambia el dueño, hace clic en Job Catalog para comprobar algo y el cambio desaparece. La siguiente WO sale con el dueño viejo.
- **Recomendación:** si `dirty`, pedir confirmación al salir ("You have unsaved owner changes. Save / Discard"). Volver primario el botón Save cuando hay cambios.
- **Esfuerzo:** S

### Búsqueda y filtros

### UX-5-014 · El buscador del catálogo solo encuentra categorías, no Jobs ni aliases
- **Dónde:** `/admin/catalog` · `apps/web/src/components/admin-catalog-list.tsx:21`, más el placeholder "Search Category" (`admin-messages.ts:104`).
- **Evidencia:** (inferido del código)
  ```ts
  return categories.filter((category) => category.name.toLowerCase().includes(query));
  ```
  Si se escribe "fuel lines" o "líneas de combustible", no aparece nada y sale "No Categories match this search.". Además, "lineas" sin tilde tampoco encontraría "líneas" (no se normalizan acentos).
- **Criterio:** Búsqueda (busca lo que el usuario sabe: el nombre del trabajo o como lo dicen en el taller).
- **Severidad:** 3 · Encontrar un Job es el primer paso de todo el flujo 2. Sin búsqueda por Job o alias, el Manager adivina la categoría entre 17. Si no lo encuentra, puede crear un duplicado, que es justo lo que el catálogo existe para evitar (los aliases casi duplicados de "Fuel Lines" ya lo muestran).
- **Recomendación:** buscar por categoría, Job y alias, sin distinguir mayúsculas ni acentos. Mostrar los resultados como "Fuel Lines · Fuel System · alias: líneas de combustible", con enlace a la categoría y el Job resaltado. Placeholder: "Search Jobs, aliases or Categories".
- **Esfuerzo:** M

### UX-5-015 · Mechanics filtra con "Apply filters" y el catálogo filtra al escribir
- **Dónde:** `/admin/mechanics` · `apps/web/src/components/admin-mechanics-list.tsx:49-71` (`AdminFilterToolbar`, `onSubmit`). En cambio, `/admin/catalog` filtra en cada tecla (`admin-catalog-list.tsx:38`).
- **Evidencia:** (observado) "El filtro necesita un clic en el botón". (inferido del código) Enter también envía, porque es un `<form>` (`ui.tsx:846-850`), pero no se indica en ningún sitio.
- **Criterio:** Búsqueda (comportamiento consistente entre listas de la misma sección) · Nielsen H4.
- **Severidad:** 2 · El Manager escribe un nombre, no pasa nada y cree que no existe.
- **Recomendación:** filtrar al escribir, con un pequeño retardo, y reflejarlo en la URL. "Show inactive" se aplica al marcarlo. Dejar "Clear" y quitar "Apply filters". Si se mantiene el botón, ponerlo pegado al campo.
- **Esfuerzo:** S

## Notas de roles (sin hallazgo propio)
- Los usuarios admin aparecen en la lista de Mechanics, pero su perfil dice "Read only", sin motivo (`admin-mechanic-detail.tsx:16`, `:29`). Se resuelve con UX-5-003: tipo "Admin" visible y filtrable. Con "Remove" **[decisión]**, aclarar que a un admin se le gestiona en otro lado.
- Un mecánico que abre `/admin/*` ve la página 403 con "volver a /" (`middleware.ts:15-18`, `app/forbidden.tsx:19`), no su espacio de trabajo. Está fuera del alcance de Setup; se anota para la auditoría del shell.

## Lo que funciona bien
- El menú está agrupado por frecuencia (Operations → Setup → Audit, `admin-shell.tsx:15`) con 3-4 ítems por grupo. El ítem activo se marca con `aria-current` (`:94-99`). La base de la propuesta es esta misma estructura.
- Los tres flujos de Setup están a 1 clic del inicio, y cada pantalla tiene URL propia, incluidos los detalles por id.
- Mechanics guarda la búsqueda y "Show inactive" en la URL (`admin-mechanics-list.tsx:21-32`): se puede compartir y sobrevive a recargar.
- Los detalles tienen "Back to…" explícito y un 404 con salida (`admin-catalog-category-detail.tsx:17-18`, `admin-mechanic-detail.tsx:18-19`).
- En el teléfono, el menú es una hoja con los mismos grupos, y en los detalles el breadcrumb se reduce al padre como "‹ Volver" (`admin-shell.tsx:161-167`).

## Fuera de alcance / no verificado
- En esta corrida no se usó el navegador. Lo marcado "(observado)" viene de `evidencia/observaciones-navegador.md` (misma fecha, demo local, Manager). No se probó el atrás del navegador después de filtrar, ni la entrada como System Admin o como mecánico.
- La causa del primer clic fallido (UX-5-008) es una inferencia: se observó una vez y el código coincide con el problema ya documentado en `admin-nav-link.tsx`.
- La estructura de Partes y costos se apoya en el plan del dueño (`~/.claude/plans/revision-y-mejoras-te-abstract-locket.md` §S4). Las pantallas no existen todavía.
- Los textos del menú (EN/ES) se revisan en la skill 3, y los dos botones de guardar de Shop workflow en la skill 7.
