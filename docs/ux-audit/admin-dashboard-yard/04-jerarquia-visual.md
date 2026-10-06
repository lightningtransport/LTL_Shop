# 04 · Jerarquía y claridad visual — Lightning Shop Admin (Dashboard y Yard)

**Fecha:** 2026-10-05 · **Alcance:** `/admin` y `/admin/yard-operations` en 1280 px y 375 px,
tema oscuro · **Método:** código + navegador (producción en solo lectura, medidas con
`getComputedStyle`).

**Resumen:** 7 hallazgos, 3 de severidad 3. Las dos pantallas **fallan la prueba de los 5
segundos**.
- En el Dashboard, la vista va a 7 números grandes iguales y ninguno dice qué hacer.
- En el Yard va a un tablero ancho con columnas vacías, tarjetas de texto de 12 px y el único
  botón primario es "Apply filters".

El problema es de **aplicación**: los tokens y los componentes existen, pero se usan con el
mismo peso para todo.

## Prueba de los 5 segundos

- **Dashboard, escritorio** (`evidencia/04-dashboard-escritorio.jpg`): "Shop Operations, siete
  números". No se sabe qué hacer primero. El primer elemento accionable (Resolve) está debajo
  de las métricas, dentro de la tercera tarjeta. **Falla.**
- **Dashboard, teléfono** (`04-dashboard-movil.jpg`): la primera pantalla entera son 7 métricas;
  "Needs attention" empieza debajo del pliegue. **Falla.**
- **Yard, escritorio** (`05-yard-tablero-escritorio.jpg`): "tablero de camiones por fase". Se
  entiende la forma, pero nada destaca: el camión bloqueado, el que sale mañana y los 5 Ready to
  Go pesan lo mismo, y el botón más fuerte es "Apply filters". **Falla parcial.**
- **Yard, teléfono** (`04-yard-movil-arriba.jpg`, `04-yard-movil-ready-to-go.jpg`): contadores,
  un buscador sin texto (solo la lupa), "Filters" y la lista. Cada tarjeta Ready to Go lleva un
  botón grande "Return to Service" que pesa más que la tarjeta. **Falla parcial.**

## Hallazgos

### Dashboard

### UX-4-001 · Siete métricas del tamaño del título ocupan la primera pantalla
- **Dónde:** `/admin`, sección de métricas · `admin-dashboard.tsx:68-75`
- **Evidencia:** (medido)
  - Los 7 números son de 30 px/700, **el mismo estilo que el título h1 "Shop Operations"**.
  - Cada tarjeta trae una descripción de 12 px ("Created, in progress, or waiting / paused").
  - En el teléfono las 7 llenan toda la primera vista (`04-dashboard-movil.jpg`).
  - En `xl` son 6 columnas y "Ready to Go" queda sola en otra fila.
- **Criterio:** Punto de entrada; densidad (si quito esto, ¿alguien lo extraña?).
- **Severidad:** 3 · Es lo primero que se ve cada mañana y no lleva a actuar.
- **Recomendación:**
  - Cuatro contadores accionables en una franja compacta (número 20–24 px), como la de la
    propuesta de WO: Blocked, Ready to close, Ready to Go, Unassigned.
  - "Completed today / 7 days" en una línea secundaria.
  - Sin descripciones bajo el número; el detalle va en `title` o en la lista destino.
- **Esfuerzo:** S

### UX-4-002 · Cada ítem de "Needs attention" es una tarjeta larga que repite la misma frase
- **Dónde:** Needs attention · `admin-work-order-item.tsx` (compact)
- **Evidencia:** (observado en el ítem 918 / WO-010)
  - "Next step: Blocked · Air Dryer: Waiting for Parts", y en la caja ámbar de abajo
    "Blocked · Air Dryer: Waiting for Parts" otra vez.
  - Debajo hay un textarea de ancho completo.
  - Más "Jobs progress 3/8", "Mechanics MA, MD, MG, MPM", dos badges y la fecha.
  - Es una tarjeta (borde) dentro de la tarjeta "Needs attention" (borde) que contiene la caja
    ámbar (borde): 3 niveles.
- **Criterio:** Agrupación (tarjetas dentro de tarjetas); ruido.
- **Severidad:** 3 · Con 8 ítems, la lista es una pared; hay que leer cada tarjeta para saber
  qué pide.
- **Recomendación:**
  - Una **fila por acción**: Truck, qué pasa (una frase), quién y cuándo, y un botón.
  - La nota de Resolve se abre al pedirla (como en la WO y el Truck).
  - Sin "Jobs progress" ni la lista de mecánicos en la fila; viven en el Truck.
- **Esfuerzo:** M

### UX-4-003 · Mecánicos como iniciales y "Jobs progress" sin barra
- **Dónde:** ítems de Needs attention y tarjetas del Yard
- **Evidencia:** (observado) "MA, MD, MG, MPM" en 12 px/400; "3 / 8" como texto.
- **Criterio:** Escaneabilidad.
- **Severidad:** 2
- **Recomendación:** En el Yard, una pila de avatares y una barra de progreso fina en la
  tarjeta, el mismo componente que la franja de la WO. En la cola del Dashboard no hacen falta.
- **Esfuerzo:** S

### Yard Operations

### UX-4-004 · Columnas vacías ocupan el tablero y lo urgente no destaca
- **Dónde:** Readiness board · `admin-yard-operations.tsx:299-332`
- **Evidencia:** (medido a 1280 px)
  - 8 columnas. 5 están vacías ("No Trucks in this phase.") y miden 94 px cada una: 470 px de
    espacio sin camiones.
  - Hay scroll horizontal (1056 px de contenido en 990 px).
  - Las tarjetas son casi todas texto de 12 px (148 elementos a 12 px, 4 a 14 px).
  - El camión bloqueado (918) solo tiene un badge azul al final.
  - "Dispatch: departs Oct 6" del 601 (3 Jobs pendientes) es una línea gris de 12 px.
- **Criterio:** Punto de entrada; color y énfasis; densidad.
- **Severidad:** 3 · El tablero es para decidir prioridades (J5) y no marca prioridades.
- **Recomendación:**
  - Las columnas vacías se pliegan a una franja vertical con el nombre y "0".
  - La tarjeta tiene jerarquía: número del Truck en 16 px; **una línea de alerta en color**
    cuando hay blocker, pausa o "leaves soon with N jobs" (borde izquierdo ámbar, como la fila
    bloqueada de la WO); el resto en gris.
  - Sin el badge de fase (lo dice la columna).
- **Esfuerzo:** M

### UX-4-005 · El único botón primario del Yard es "Apply filters"
- **Dónde:** barra de filtros · `admin-yard-operations.tsx:214-275`
- **Evidencia:** (medido) el único fondo `primary` visible es "Apply filters". "Return to
  Service" es outline y aparece 5 veces seguidas en la columna Ready to Go (en el DOM hay 10:
  tablero y lista).
- **Criterio:** Acción principal; color reservado para lo accionable importante.
- **Severidad:** 2
- **Recomendación:**
  - Filtros rápidos que se aplican al tocar, sin "Apply".
  - En Ready to Go, la acción como botón compacto dentro de la tarjeta, o una acción de grupo
    "Return selected to service" si el dueño quiere hacerlo por lotes (pendiente).
- **Esfuerzo:** S

### UX-4-006 · La tarjeta repite su columna y la barra de filtros es más pesada que el tablero
- **Dónde:** tarjeta (badge de fase) y barra de filtros
- **Evidencia:** (observado)
  - Cada tarjeta lleva un badge con su fase ("Shop Work" en la columna Shop Work, "Ready to Go"
    en Ready to Go).
  - La barra de filtros es una tarjeta con 3 selects, "More filters", "Clear" y "Apply filters"
    sobre un tablero de 9 camiones.
  - En el teléfono el buscador no tiene texto visible (`max-xl:placeholder:text-transparent`).
- **Criterio:** Ruido; escaneabilidad.
- **Severidad:** 2
- **Recomendación:**
  - Quitar el badge de fase en el tablero (en la lista agrupada tampoco hace falta).
  - Barra de una línea: búsqueda con placeholder visible y chips de filtro rápido.
- **Esfuerzo:** S

### UX-4-007 · Movement: chips de números sin jerarquía, tres niveles de borde
- **Dónde:** `?tab=movement` · `admin-yard-data-boundary-cards.tsx`
- **Evidencia:** `evidencia/05-yard-movement.jpg` (observado)
  - Una tarjeta contiene 3 tarjetas, que contienen chips con borde.
  - "301 Yard · 42" lista 12 chips antes de "Show all".
  - Ningún chip dice si el camión está en el taller.
  - El estado sin datos usa "UNAVAILABLE" en mayúsculas.
- **Criterio:** Agrupación; escaneabilidad.
- **Severidad:** 2
- **Recomendación:**
  - Una lista por sección, con filas Truck · fecha · **estado en el taller** (chip con la fase
    o "Not in shop").
  - Primero los que tienen WO abierta; un solo nivel de borde.
- **Esfuerzo:** M

## Inventario visual

| Medida | Dashboard (1280 px) | Yard (1280 px) |
|---|---|---|
| Combinaciones tamaño/peso | 6: 30/700 (título **y** las 7 métricas), 18/600, 14/500, 14/400, 12/600, 12/400 | 10: 30/700, 18/700, 18/600, 16/400, 14/600, 14/500, 14/400, 12/600, 12/500, 12/400 |
| Elementos de texto a 12 px | 30 | 148 (casi todo el contenido de las tarjetas) |
| Botones primarios visibles | 1 ("Resolve", dentro de la 3.ª tarjeta) | 1 ("Apply filters") |
| Textareas siempre abiertos | 1 (Resolve) | 0 |
| Niveles de borde | 3 (Needs attention → ítem → caja del blocker) | 2 en el tablero (contenedor → tarjeta); 3 en Movement |
| Títulos | h1 → h3 "Needs attention" (sin h2) | h1 → h2 → h3 por columna; el tablero y la lista existen los dos en el DOM |
| Columnas vacías | — | 5 de 8, 94 px cada una |

Conclusión: **sistema sí, aplicación no.** Las propuestas de WO y Truck ya tienen las piezas
que faltan: franja de contadores, fila de acción, fila bloqueada con borde ámbar, avatares,
callout de Next step y diálogo de Return to Service. El rediseño de estas dos pantallas las
reutiliza.

## Lo que funciona bien
- Ningún texto baja de 12 px y el teléfono no tiene scroll horizontal.
- El color semántico es coherente (ámbar para el blocker, verde para Ready to Go).
- En el teléfono el Yard pasa a lista agrupada por paso, sin tablero aplastado.
- Las tarjetas del Yard llevan el Next step en una línea: la idea es correcta, falta jerarquía.

## Fuera de alcance / no verificado
- Contraste numérico (skill 2). El ámbar del tema claro ya está anotado en las maquetas
  anteriores.
- Tema claro en producción.
