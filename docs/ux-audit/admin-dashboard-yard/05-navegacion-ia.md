# 05 · Navegación y arquitectura de información — Lightning Shop Admin (Dashboard y Yard)

**Fecha:** 2026-10-05 · **Alcance:** `/admin`, `/admin/yard-operations` (Shop readiness y
Movement) y sus destinos · **Método:** código + navegador (producción en solo lectura, 10:53 PM:
4 WOs abiertas, 5 Ready to Go).

**Resumen:** 9 hallazgos, 5 de severidad 3. El patrón dominante: **las dos pantallas de entrada
no responden preguntas distintas.**
- El Dashboard es una lista de WOs con métricas.
- El Yard es la misma información ordenada por paso.
- Ninguna de las dos responde bien "¿qué hago ahora?".
- Lo que el Manager tiene que hacer está repartido: los 5 Ready to Go solo en el Yard, el blocker
  en los dos, los pedidos de trabajo solo en el Dashboard.
- Casi cada botón te saca a otra pantalla.

Se propone un reparto en [Estructura propuesta](#estructura-propuesta).

## Mapa de navegación observado

| Ruta | Etiqueta | Cómo se llega | Clics desde inicio | Rol |
|---|---|---|---|---|
| `/admin` | Menú "Dashboard" · título **"Shop Operations"** | Menú; inicio después de entrar | 0 | Manager |
| `/admin/yard-operations` | "Yard Operations" | Menú; métrica "Ready to Go" del Dashboard | 1 | Manager |
| `/admin/yard-operations?tab=movement` | "Movement (Dispatch)" | Pestaña del Yard | 2 | Manager |
| `/admin/work-orders?status=…` | "Work Orders" filtrada | 6 de las 7 métricas del Dashboard | 1 | Manager |
| `/admin/work-orders` | "Work Orders" | Menú; "View all Work Orders" | 1 | Manager |
| `/admin/trucks/[id]?from=/admin` | Truck | Número del Truck o botón del Next step en Needs attention | 1 | Manager |
| `/admin/trucks/[id]?from=/admin/yard-operations` | Truck | Tarjeta del Yard | 1–2 | Manager |
| `/admin/work-orders/[id]` | WO | Número de la WO en Needs attention; fila de pedido de trabajo | 1 | Manager |

**Volver:**
- **Desde el Truck al Dashboard:** "Back to Dashboard" funciona.
- **Desde el Truck al Yard:** "Back to Yard Operations" lleva al Yard **sin los filtros, la
  búsqueda ni la vista** (UX-5-006).
- **Pestaña Movement:** sus chips no llevan a ninguna parte.

### Matriz tarea × pantalla (hoy)

✅ = se hace aquí · → = el botón lleva a otra pantalla · 👁 = solo se ve · — = no está

| Tarea del Manager | Dashboard | Yard | Truck / WO |
|---|---|---|---|
| Saber qué atender primero (HU-M7) | 👁 Needs attention: máximo 8, todas las WOs abiertas > 24 h | 👁 Tablero por paso (sin prioridad) | — |
| Resolver un blocker (HU-M4) | ✅ en línea (textarea abierto) **y** → Truck desde el Next step | 👁 badge "Blocked" | ✅ |
| Asignar un Job sin dueño (HU-M3) | → Truck ("Assign") | 👁 texto del Next step | ✅ |
| Cerrar una WO lista (HU-M5) | → Truck ("Close Work Order") | — (columna "Ready to close WO") | ✅ |
| Devolver a servicio (HU-M5) | 👁 métrica "Ready to Go: 5" → Yard sin filtro | ✅ un clic, sin motivo ni confirmación | ✅ (Truck: textarea; WO: diálogo) |
| Pedidos de trabajo (HU-ME4) | 👁 lista → WO (allá se marcan "handled") | — | ✅ WO |
| Ver dónde está cada camión (J5) | — | ✅ tablero | — |
| Saber qué llega o sale (Dispatch) | — | 👁 Movement (chips sin enlace) y una línea gris en la tarjeta | — |
| Ver pausados | 👁 "Waiting / Paused" (solo pausas) | 👁 "N paused (blocked)" (pausas **y** blockers) | ✅ WO |

## Hallazgos

### ¿Dónde estoy?

### UX-5-001 · El menú dice "Dashboard" y la página dice "Shop Operations"
- **Dónde:** `/admin` · título `admin-dashboard.tsx:41-45` (msgs:10); menú `admin-shell.tsx:17`
- **Evidencia:** `evidencia/04-dashboard-escritorio.jpg` (observado). El back link del Truck dice
  "Back to Dashboard" y llega a "Shop Operations".
- **Criterio:** Orientación (la etiqueta del menú, el título y el breadcrumb coinciden).
- **Severidad:** 2 · Es la pantalla de inicio; el nombre doble no ayuda a orientarse.
- **Recomendación:** Título "Dashboard" (o "Today"), con la fecha y la hora de actualización
  como dato secundario.
- **Esfuerzo:** S

### ¿Qué hay aquí?

### UX-5-002 · Dashboard y Yard no responden preguntas distintas; lo urgente queda repartido
- **Dónde:** `/admin` (Needs attention) y `/admin/yard-operations` (tablero)
- **Evidencia:** (observado) A las 10:53 PM:
  - "Needs attention" lista las 4 WOs abiertas (todas entran por "Open more than 24 hours"), o
    sea, la lista de WOs otra vez.
  - Los **5 camiones Ready to Go** (lo único que el Manager puede despachar ya) **no aparecen**:
    solo son una métrica que lleva al Yard.
  - El Yard muestra los mismos 4 camiones por paso y los 5 Ready to Go, cada uno con su botón.
- **Criterio:** Organización ("un contenido, un lugar"; criterio de agrupación reconocible).
- **Severidad:** 3 · Cada mañana el Manager tiene que abrir las dos pantallas y unir las piezas.
- **Recomendación:** Reparto explícito (ver Estructura propuesta):
  - **Dashboard = "¿qué hago ahora?"**: una **cola de acciones**, una fila por cosa que espera
    al Manager, con la acción ahí mismo. Incluye blocker, cerrar, return to service, asignar,
    pedido de trabajo y pausa.
  - **Yard = "¿dónde está cada camión?"**: el tablero de flujo, sin acciones duplicadas salvo
    Return to Service.
- **Esfuerzo:** M

### UX-5-003 · Las métricas no llevan a lo que nombran y dos de ellas cuentan cosas distintas con nombres parecidos
- **Dónde:** Dashboard, métricas · `admin-dashboard.tsx:26-35`; Yard, resumen · `admin-yard-operations.tsx:194-212`
- **Evidencia:** (observado, enlaces leídos en producción)
  - "Ready to Go: 5" → `/admin/yard-operations`, **sin filtro**: llega al tablero completo.
  - "Waiting / Paused: 0" cuenta solo pausas oficiales.
  - El Yard dice "1 paused (blocked) among these trucks", que cuenta pausas **y** blockers de
    mecánicos (D5), y no es un enlace.
  - Las métricas del Yard no son enlaces.
  - No existen métricas de lo que más frena: blockers, Jobs sin dueño, pedidos de trabajo.
- **Criterio:** Un contenido, un lugar; nomenclatura (dos etiquetas para conceptos parecidos).
- **Severidad:** 3 · "0 pausados" en el Dashboard y "1 bloqueado" en el Yard al mismo tiempo
  hacen dudar de los dos números.
- **Recomendación:**
  - Pocas métricas, todas accionables y con el mismo nombre en las dos pantallas: **Blocked**
    (pausas + blockers, D5), **Ready to close**, **Ready to Go**, **Unassigned**.
  - Cada una filtra la cola del Dashboard o lleva al Yard con `?phase=…` o `?blocked=true`.
  - Las de historia (Completed today, 7 days) pasan a una línea secundaria.
- **Esfuerzo:** M

### UX-5-004 · Movement (Dispatch) es una pestaña aparte que no se cruza con el taller
- **Dónde:** `/admin/yard-operations?tab=movement` · `admin-yard-data-boundary-cards.tsx`
- **Evidencia:** `evidencia/05-yard-movement.jpg` (observado):
  - Chips de números de Truck: "301 Yard · 42", "Outside · 5", "Incoming Trucks" (57),
    "Upcoming Departures" (24). **Ningún chip es enlace.**
  - El 277 tiene WO-001 abierta y Dispatch lo marca "Outside".
  - El 601 "departs Oct 6" con 3 Jobs pendientes. Ese aviso solo aparece como una línea gris en
    la tarjeta del tablero (`04-yard-movil-ready-to-go.jpg`).
- **Criterio:** Organización (el dato vive lejos de donde se decide); movimiento (callejón sin
  salida).
- **Severidad:** 3 · El valor del dato de Dispatch está en el cruce ("sale mañana y no está
  listo"), y la pantalla no lo hace.
- **Recomendación:**
  - **Integrar Dispatch en el tablero** como señal en la tarjeta: "Leaves Oct 6 · 3 jobs left"
    en ámbar, y "Arriving Oct 8" en la columna de llegadas.
  - Un filtro rápido "Leaving soon".
  - La pestaña Movement queda como referencia: cada chip abre el Truck, y se marcan los que
    tienen WO abierta.
- **Esfuerzo:** M

### ¿A dónde puedo ir?

### UX-5-005 · Los botones del Next step del Dashboard te mandan al Truck en lugar de actuar
- **Dónde:** Dashboard → Needs attention · `admin-work-order-item.tsx:54-63` (`Link` a `adminTruckHref`)
- **Evidencia:** (inferido del código; en producción el único botón visible era Resolve, que
  actúa en línea) Assign, Close Work Order, Mark QC complete, Resume, Return to Service y Add
  missing steps son enlaces al Truck. Para un usuario de solo lectura, "Resolve" también lleva
  al Truck, donde tampoco puede resolver: callejón sin salida.
- **Criterio:** Movimiento (navegar vs actuar); consistencia con la regla decidida el
  2026-10-05 ("el Next step actúa donde estás", `admin-truck-wo` UX-5-004).
- **Severidad:** 3 · Cada acción desde la pantalla de inicio cuesta una ida y una vuelta.
- **Recomendación:** El Dashboard usa el **mismo componente de Next step** que el Truck y la WO
  (propuestas en `docs/proposals/`), con la acción en línea. Sin permiso no hay botón: se
  muestra "Only a Shop Manager can take this step."
- **Esfuerzo:** M

### UX-5-006 · Volver del Truck al Yard pierde filtros, búsqueda, vista y pestaña
- **Dónde:** Tarjeta del Yard → Truck → "Back to Yard Operations" · `admin-yard-operations.tsx:456`
  (`adminTruckHref(item.truck.id, '/admin/yard-operations')`)
- **Evidencia:** (inferido del código) el `from` es siempre `/admin/yard-operations`, sin la
  query actual (`search`, `phase`, `blocked`, `view`, `tab`). `adminTruckOrigin` sí respeta una
  query cuando viene. Las listas de Trucks y de WOs pasan su ruta completa.
- **Criterio:** Movimiento ("Volver lleva a donde estaba el usuario, con los filtros").
- **Severidad:** 3 · Es el recorrido diario (tablero → camión → tablero); hay que volver a
  filtrar cada vez.
- **Recomendación:** Pasar `from` con la query actual (`pathname + search`).
- **Esfuerzo:** S

### UX-5-007 · "View all Work Orders" no lleva a lo que necesita atención
- **Dónde:** Dashboard → Needs attention → "View all Work Orders" (`/admin/work-orders`)
- **Evidencia:** (observado) La lista se corta en 8 (`ATTENTION_LIMIT`). El botón abre la lista
  de todas las WOs (abiertas y cerradas) ordenadas por fecha de actualización, no por atención.
- **Criterio:** Movimiento (lo relacionado); consistencia del orden.
- **Severidad:** 2 · Con más de 8 camiones con algo pendiente, el resto no tiene dónde verse
  en orden.
- **Recomendación:** La cola del Dashboard muestra todo lo que espera, agrupado por tipo de
  acción y plegable, en lugar de cortarse en 8. Si se quiere un enlace: "All open Work
  Orders" con `?status=open`.
- **Esfuerzo:** M

### UX-5-008 · Return to Service se hace de tres formas distintas según la pantalla
- **Dónde:** Yard (botón bajo la tarjeta, `admin-yard-operations.tsx:503-535`), Truck (textarea
  abierto) y WO (diálogo)
- **Evidencia:** (inferido del código, observado el botón del Yard)
  - En el Yard es un clic, sin motivo y sin confirmación, y su error es genérico ("Could not
    complete this step…").
  - En la WO se confirma en un diálogo con motivo opcional.
  - Las propuestas de Truck y WO ya lo unifican en un diálogo.
- **Criterio:** Consistencia (la misma acción se comporta igual en todas partes).
- **Severidad:** 2 · Es una acción que saca el camión del tablero; hacerla sin querer en el Yard
  no tiene vuelta en la UI.
- **Recomendación:** El mismo diálogo en las tres pantallas: confirmar y motivo opcional.
- **Esfuerzo:** S

### Búsqueda y filtros

### UX-5-009 · En el tablero, los filtros repiten la agrupación, y los números no coinciden con lo que se ve
- **Dónde:** Yard → filtros "Readiness", "Phase", "Blockers", "More filters", "Apply filters" ·
  `admin-yard-operations.tsx:214-290`; resumen `yard-operations.service.ts:772-806`
- **Evidencia:** (observado y del código)
  - "Phase" filtra por la misma fase que ya son las columnas del tablero.
  - "Readiness" usa "Not started / In the Shop / Ready to Go" mientras la métrica dice
    "Inspection".
  - Los filtros solo se aplican con "Apply filters"; la búsqueda se aplica sola.
  - Los contadores del resumen son **globales** (ignoran los filtros), aunque el texto diga
    "among these trucks".
  - La cuenta de cada columna incluye solo las páginas cargadas (25 por página).
  - Los filtros de prioridad y estado buscan en **todas** las WOs que tuvo el camión, también
    las cerradas: un camión puede salir por una WO vieja. Esto último está por verificar con
    datos reales.
- **Criterio:** Búsqueda y filtros (se ven, se combinan, dicen qué hacen).
- **Severidad:** 2 · Confunde, pero el tablero sigue siendo usable.
- **Recomendación:**
  - Quitar "Phase" del tablero (las columnas ya lo son) y "Readiness".
  - Dejar filtros rápidos que se aplican al tocar: **Blocked**, **Leaving soon** (Dispatch),
    **Priority high+**, y la búsqueda.
  - Los contadores reflejan lo filtrado o lo dicen.
  - Los filtros solo miran la WO abierta.
- **Esfuerzo:** M

## Estructura propuesta

```
Dashboard  — "¿Qué tengo que hacer ahora?"  (se refresca solo)
├── Encabezado: "Dashboard" · actualizado hace 1 min
├── 4 contadores accionables: Blocked · Ready to close · Ready to Go · Unassigned  (filtran la cola)
├── Cola de acciones (una fila = una cosa que espera al Manager, acción en línea)
│   ├── Blocked / Paused        → Resolve (nota a pedido) · Resume
│   ├── Ready to close          → Close Work Order
│   ├── Ready to Go             → Return to Service (diálogo)        ← hoy solo en el Yard
│   ├── Unassigned              → Assign (selector)
│   ├── Waiting for Safety      → Mark QC complete (respaldo)
│   └── Work requests           → Mark handled · Open WO
├── "Leaving soon and not ready" (cruce con Dispatch)                ← hoy no existe
└── Línea secundaria: completed today / 7 days → lista de WOs

Yard Operations — "¿Dónde está cada camión?"  (se refresca solo)
├── Filtros rápidos: Blocked · Leaving soon · High priority · búsqueda (en la URL)
├── Tablero por paso: las columnas vacías se pliegan; la tarjeta no repite la fase;
│   las señales de Dispatch van en la tarjeta ("Leaves Oct 6 · 3 jobs left")
├── Ready to Go: Return to Service (el mismo diálogo)
└── Movement (Dispatch): referencia; cada chip abre el Truck y marca si tiene WO abierta

Trucks / Work Orders (listas) — directorio, búsqueda e historial; sin acciones
```

Qué se mueve y por qué:

| Cambio | Por qué |
|---|---|
| Ready to Go entra a la cola del Dashboard con Return to Service | Es lo que más espera al Manager y hoy solo es un número (UX-5-002) |
| El Next step del Dashboard actúa en línea | La regla ya decidida (UX-5-005) |
| 7 métricas pasan a 4 accionables + una línea de historia | Nombres iguales en las dos pantallas (UX-5-003) |
| Dispatch pasa de pestaña aparte a señal en la tarjeta y a filtro "Leaving soon" | El valor está en el cruce (UX-5-004) |
| El `from` del Yard lleva la query | Volver sin perder el contexto (UX-5-006) |
| Return to Service: un solo diálogo en todas partes | Consistencia (UX-5-008) |

## Lo que funciona bien
- **El mismo texto de Next step en todas las pantallas** (`truck-next-step.ts`): Dashboard, Yard,
  listas, Truck y WO dicen lo mismo.
- Las métricas del Dashboard **sí son enlaces con filtros reales** a la lista de WOs (excepto
  Ready to Go), y la lista avisa cuando el filtro de tiempo está activo.
- Los filtros, la vista y la pestaña del Yard están en la URL: se pueden compartir y sobreviven
  al refrescar.
- Desde el Dashboard, el Truck sabe volver ("Back to Dashboard").
- Movement dice claramente de dónde viene el dato y que no es el Ready to Go del taller.

## Fuera de alcance / no verificado
- Los botones de Next step distintos de Resolve no estaban visibles en producción a esa hora
  (las WOs estaban en `work`); su destino se tomó del código.
- No se probó Return to Service desde el Yard (cambia datos).
- La búsqueda y los filtros sobre WOs viejas cerradas se dedujeron del código
  (`yard-operations.service.ts:729-738`); falta confirmarlos con datos.
