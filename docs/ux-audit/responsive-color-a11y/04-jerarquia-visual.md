# 04 · Jerarquía visual y responsive — Lightning Shop (Admin y móvil)

**Fecha:** 2026-10-15 · **Alcance:** Dashboard, Yard, Trucks, Work Orders, Purchases, People, Job Catalog y Shop workflow en 375, 768, 853, 1024, 1728 y 2056 px · **Método:** código + navegador (medición con script del ancho del contenido, del ancho que necesita cada placeholder contra el disponible, y de la altura de los chips y el ancho de los avatares)
**Resumen:**
- **9 hallazgos.** 1 de severidad 3: entre 768 y 1023 px el menú lateral deja 528 px de contenido y los buscadores de las listas se aplastan hasta desaparecer (Purchases, People) o quedan en 41–65 px (Work Orders, Trucks).
- **Patrón dominante:** los cortes de layout se deciden por el ancho de la **ventana** (`md:`), no por el espacio que de verdad le queda al contenido después del menú de 240 px.
- **En pantallas muy anchas** pasa lo contrario: el contenido se queda en 1440 px centrado y deja franjas vacías.

| Ancho | Qué se ve |
|---|---|
| 375 | Bien. Solo el placeholder de Purchases se corta (UX-4-006). |
| 768–1023 | Menú lateral + 528–783 px de contenido. Buscadores aplastados (UX-4-001), Shop workflow con chips en 2–3 líneas (UX-4-007), tabla de Purchases con celdas partidas (UX-4-009). |
| 1024 | Buscador del Yard cortado (UX-4-004). |
| 1728 (MacBook Pro 16") | Bien: el contenido usa los 1440 px disponibles. |
| 2056 (MacBook "Más espacio", monitores externos) | Franjas vacías de 188 px a cada lado (UX-4-003). |

## Hallazgos

### UX-4-001 · Entre 768 y 1023 px el buscador de las listas desaparece o queda en un cuadrito
- **Dónde:** Purchases (`/admin/parts/purchases`), People (`/admin/mechanics`), Outside repairs, Trucks, Work Orders · `apps/web/src/components/ui.tsx:879-892` (`AdminFilterToolbar`)
- **Evidencia:** `evidencia/04-purchases-768-buscador-colapsado.jpg` (observado). Ancho que queda para escribir a 768 px:
  - Purchases: **0 px**
  - People: **0 px**
  - Trucks: 65 px
  - Work Orders: 41 px
  ```tsx
  <form role="search" className="flex min-w-0 items-end gap-2" onSubmit={submit}>
    <Input type="search" className="min-w-0 flex-1" … />
    <div className="hidden min-w-0 items-end gap-2 md:flex">{filters}{actions}</div>
  ```
- **Criterio:** Nielsen H8 (diseño estético y minimalista: el control principal desaparece) · WCAG 1.4.10 Reflow
- **Severidad:** 3 · Pasa en toda tablet en horizontal y en ventanas medianas de computadora. El Manager no puede buscar ni ver lo que escribió. Persistente.
- **Recomendación:**
  - Decidir el corte por el **contenedor**, no por la ventana: `@container` en la tarjeta y filtros en línea desde `@4xl` (~896 px del contenedor). Si no, pasar de `md:` a `xl:`.
  - Darle al buscador un mínimo: `min-w-[14rem] flex-[1_1_16rem]`.
  - Por debajo de ese ancho se usa el botón "Filters" que ya existe.
- **Esfuerzo:** S

### UX-4-002 · El menú lateral aparece a 768 px y deja 528 px de contenido
- **Dónde:** todo el Admin · `apps/web/src/components/admin-shell.tsx:141-143` (`md:[--admin-aside:15rem]`, `md:flex`)
- **Evidencia:** medido a 768 px: contenido de 528 px en todas las listas (observado).
- **Criterio:** Jerarquía visual: el espacio se lo lleva la navegación y no la tarea · WCAG 1.4.10
- **Severidad:** 2 · Agrava UX-4-001, UX-4-007 y UX-4-009. En tablet vertical el Manager trabaja con media pantalla.
- **Recomendación:** mostrar el menú fijo desde `lg` (1024 px) y usar el menú del encabezado (como en el teléfono) entre 768 y 1023. Opción intermedia: menú angosto solo con iconos (64 px) en ese rango.
- **Esfuerzo:** S–M

### UX-4-003 · En pantallas anchas el contenido queda en 1440 px y deja franjas vacías
- **Dónde:** Yard, Dashboard, Trucks, Work Orders · `apps/web/src/components/admin-shell.tsx:210` (`mx-auto … max-w-[1440px]`)
- **Evidencia:** `evidencia/04-yard-2056-franjas-vacias.jpg`, `evidencia/04-dashboard-2056-franjas-vacias.jpg` (observado). Captura del dueño en su MacBook Pro. A 2056 px: el contenido empieza en x=428 y deja 188 px a la derecha.
- **Criterio:** Jerarquía visual: aprovechamiento del espacio en pantallas de datos. El Yard es un tablero que justamente necesita columnas (D33).
- **Severidad:** 2 · Todos los días para quien usa "Más espacio" o un monitor externo. Se nota "raro" y en el Yard esconde columnas detrás del scroll lateral habiendo espacio libre.
- **Recomendación:**
  - Las pantallas de **datos** (Yard, Dashboard, listas) usan todo el ancho: `max-w-none`, o `max-w-[1920px]` con `px-6`.
  - Las de **lectura y formularios** (Work Order, Truck, Setup, formularios de Parts & costs) mantienen 1440 px o menos.
  - Cómo hacerlo: un prop `wide` en el layout del Admin, o una clase en cada página.
- **Esfuerzo:** S

### UX-4-004 · El buscador del Yard corta su placeholder ("Truck, Work Order or mechani…")
- **Dónde:** Yard → Shop (`/admin/yard-operations`) · `apps/web/src/components/admin-yard-operations.tsx:244-249`
- **Evidencia:** el texto necesita 237 px. Hay 240 px a 1728 y 2056 (queda al límite, y con la fuente de macOS se corta como en la captura del dueño) y 182 px a 1024 (observado).
- **Criterio:** WCAG 3.3.2 (etiquetas o instrucciones) · Nielsen H6 (reconocer antes que recordar)
- **Severidad:** 2 · El Manager no sabe qué puede buscar.
- **Recomendación:**
  - Placeholder corto, "Search trucks" / "Buscar unidades", y el `aria-label` completo ("Search by truck, Work Order or mechanic").
  - Campo con `w-full sm:w-80`.
- **Esfuerzo:** S

### UX-4-005 · El buscador de Work Orders corta su texto en 375 y 1024 px y se reduce a "Search…" en 768
- **Dónde:** `/admin/work-orders` · `apps/web/src/components/admin-work-orders-list.tsx:94-98`
- **Evidencia:** el placeholder "Search Work Order, Truck, category, or Mechanic" sale cortado a 375 y 1024. A 768 el placeholder pasa a "Search…" y solo tiene 41 px (observado).
- **Criterio:** WCAG 3.3.2 · consistencia con las otras listas
- **Severidad:** 2
- **Recomendación:** mismo patrón que UX-4-004: placeholder corto ("Search work orders") y descripción completa en `aria-label`. Pasar esta lista a `AdminFilterToolbar` cuando se arregle UX-4-001, para que se comporte igual que las demás.
- **Esfuerzo:** S

### UX-4-006 · En el teléfono el placeholder de Purchases se corta
- **Dónde:** `/admin/parts/purchases` a 375 px · `apps/web/src/lib/admin-messages-catalog.ts:103` (`pcSearchPurchases`)
- **Evidencia:** necesita 243 px y hay 193 (observado). Lo mismo pasa con `pcSearchOutside` ("Search invoice #, vendor, truck or what was done").
- **Criterio:** WCAG 3.3.2
- **Severidad:** 1
- **Recomendación:** "Search purchases" / "Buscar compras"; la lista de campos va en el `aria-label`.
- **Esfuerzo:** S

### UX-4-007 · Shop workflow parte el chip de cada persona en dos o tres líneas
- **Dónde:** Setup → Shop workflow (`/admin/setup/workflow`) · `apps/web/src/components/admin-shop-workflow.tsx:146` (`md:grid-cols-[2rem_minmax(0,16rem)_minmax(0,1fr)]`) y `:167-176` (chip)
- **Evidencia:** `evidencia/04-shop-workflow-853-chip-dos-lineas.png` y captura del dueño (observado). Columna del equipo a 768 px: 102 px, chips de 70 px de alto. A 853 px: 187 px, chips de 50 px. A 1024 px: una línea (36 px).
- **Criterio:** Jerarquía visual: un chip partido parece roto y separa el nombre de su avatar
- **Severidad:** 2 · Lo señaló el dueño. Pasa en toda tablet y ventana mediana.
- **Recomendación:**
  - Grilla de tres columnas solo desde `xl`. Debajo, el equipo va bajo el nombre del paso, con todo el ancho.
  - Chip con `max-w-full` y el nombre en `truncate whitespace-nowrap`, con `title` del nombre completo.
- **Esfuerzo:** S

### UX-4-008 · Las iniciales de tres letras no caben en el avatar chico
- **Dónde:** Shop workflow, tarjetas del Yard, grupos de avatares · `MechanicAvatar` `size="sm"` en `apps/web/src/components/` (avatar de 24 px)
- **Evidencia:** "MPM" necesita 29 px en un avatar de 24 px, y "MG1" y "QC2", 25 px (observado; captura del dueño). Con los códigos por rol de la demo y del roster (D36) casi todos tienen tres caracteres.
- **Criterio:** Jerarquía visual y legibilidad · WCAG 1.4.4 (el texto no debe recortarse)
- **Severidad:** 2 · Se ve en cada pantalla con avatares chicos.
- **Recomendación:**
  - El avatar ajusta la letra al largo de las iniciales: `text-[9px] tracking-tight` con 3 caracteres en `sm`, y `text-[11px]` con 2.
  - Otra opción: avatar `sm` de 28 px.
  - Mostrar como mucho 3 caracteres.
- **Esfuerzo:** S

### UX-4-009 · Entre 768 y 1023 px la tabla de Purchases parte números de factura y fechas
- **Dónde:** `/admin/parts/purchases` · `apps/web/src/components/admin-purchases.tsx` (tabla)
- **Evidencia:** `evidencia/04-purchases-768-buscador-colapsado.jpg`: "FP-D000031" en dos líneas y "Oct 14, 2026" en tres (observado).
- **Criterio:** Escaneabilidad de tablas
- **Severidad:** 1 · Se arregla en buena parte con UX-4-002.
- **Recomendación:** `whitespace-nowrap` en las columnas de número, fecha y total. Por debajo de `lg`, la lista de tarjetas que ya usa el teléfono.
- **Esfuerzo:** S

## Lo que funciona bien
- **Sin scroll lateral de página en 375 px:** ninguna pantalla medida lo tiene, y en el teléfono las listas pasan a tarjetas.
- **El Kanban del Yard (D33) contiene su scroll lateral dentro del tablero.** La página no se mueve de lado.
- **El botón "Filters" con hoja inferior** en el teléfono ya resuelve el problema de espacio. UX-4-001 es solo correr ese corte más arriba.
- **La barra fija "Unsaved changes"** (Inspection checklist, y Shop workflow desde LTR-210) queda siempre a la vista en todos los anchos.

## Fuera de alcance / no verificado
- **Medición en Chrome con emulación de viewport:** la fuente real de macOS Safari puede medir distinto. El corte del Yard a 1728 px lo confirmó la captura del dueño.
- **No se midieron** el detalle de Work Order y de Truck en 768 px, ni las pantallas de Parts & costs fuera de Purchases.
- **Desborde que el usuario no ve:** en el Yard, `document.scrollingElement` mide más que la ventana por las columnas del Kanban, pero `html { overflow-x: hidden }` impide el scroll. No se reporta.
