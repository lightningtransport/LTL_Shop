# 06 · Estados del sistema — Lightning Shop Admin (Dashboard y Yard)

**Fecha:** 2026-10-05 · **Alcance:** `/admin`, `/admin/yard-operations` (Shop readiness y
Movement) · **Método:** código + navegador (producción en solo lectura; no se apagó el backend ni
se cambiaron datos)

**Resumen:** 8 hallazgos, 3 de severidad 3. El estado más descuidado es el **dato viejo o
contradictorio**:
- El Yard no se refresca solo, mientras el Dashboard sí.
- Movement dice "Updated <ahora>" aunque no tenga datos.
- Los contadores del Yard ignoran el filtro activo.

El resto de estados existe pero es genérico. Conviene un estado común "datos al día / sin datos /
contradicción" para las dos pantallas.

## Matriz pantalla × estado

`✓` correcto · `△` existe pero deficiente · `✗` no existe · `–` no aplica · `?` no verificado

| Pantalla | Vacío | Cargando | Parcial | Error | Éxito | Sin permiso | Frescura del dato |
|---|---|---|---|---|---|---|---|
| Dashboard · métricas | – | △ UX-6-004 | – | △ UX-6-005 | – | ✓ | ✓ (30 s) |
| Dashboard · Needs attention | ✓ | △ UX-6-004 | △ UX-5-007 (corte en 8, sin aviso) | △ UX-6-005 | △ UX-6-006 | ✗ UX-6-003 | ✓ (30 s) |
| Dashboard · Work requests | △ UX-6-007 | △ | – | △ | – | ✓ | ✓ |
| Yard · resumen | – | ✓ | △ UX-6-002 | ✓ | – | – | ✗ UX-6-001 |
| Yard · tablero / lista | △ UX-6-002 | △ UX-6-004 | △ UX-6-002 (cuenta por página) | ✓ | △ UX-6-006 | ✓ | ✗ UX-6-001 |
| Yard · Movement | ✓ | ✓ | ✓ ("Show all") | △ UX-6-008 | – | – | ✗ UX-6-008 |

## Hallazgos

### Frescura y contradicciones (transversal)

### UX-6-001 · El Yard no se actualiza solo; el Dashboard sí
- **Dónde:** `apps/web/src/lib/admin-data.ts` (`useAdminYardOperations` sin `refreshInterval`;
  `useAdminDashboard` con 30 s)
- **Evidencia:** (inferido del código)
  - El tablero solo se recarga al volver a la pestaña o al reconectar.
  - Con el Yard abierto en la oficina, un camión que pasó a Ready to Go o que un mecánico
    bloqueó no aparece hasta que alguien toca la ventana.
  - La pantalla no dice cuándo se actualizó.
- **Criterio:** Visibilidad del estado del sistema (Nielsen H1).
- **Severidad:** 3 · Es la vista del taller completo; decidir con datos viejos sin saberlo es el
  peor caso.
- **Recomendación:** Refresco cada 30 s, como el Dashboard, y "Updated 1 min ago" junto al
  título, en las dos pantallas.
- **Esfuerzo:** S

### UX-6-002 · Contadores y columnas no coinciden con lo que se ve
- **Dónde:** Yard, resumen y cabeceras de columna · `yard-operations.service.ts:772-806`;
  `admin-yard-operations.tsx:194-212, 299-332`
- **Evidencia:** `evidencia/06-yard-busqueda-sin-resultados.jpg` (observado):
  - Con `?search=zzzz` el tablero dice "No Trucks match these filters." mientras el resumen
    sigue diciendo "Inspection 0 · In the Shop 4 · Ready to Go 5" y "1 paused (blocked) among
    these trucks".
  - Además, la cuenta de cada columna solo suma las páginas cargadas (25 por página) y deja de
    coincidir con el resumen cuando hay más camiones.
- **Criterio:** Consistencia; visibilidad del estado.
- **Severidad:** 3 · Con filtros, el Manager no sabe cuántos camiones cumplen el filtro.
- **Recomendación:**
  - Resumen y columnas **sobre el resultado filtrado** (la API devuelve los contadores con la
    misma consulta).
  - Si no se puede, cambiar el texto a "in the whole shop".
  - Las columnas muestran "4 of 12" mientras falten páginas.
- **Esfuerzo:** M

### Sin permiso

### UX-6-003 · Solo lectura: "Resolve" lleva a una pantalla donde tampoco se puede resolver
- **Dónde:** Dashboard → Needs attention · `admin-work-order-item.tsx:31, 54-63`
- **Evidencia:** (inferido del código)
  - Sin `work_orders.manage`, la caja del blocker se vuelve texto ("Reported blocker: …").
  - Pero el Next step sigue mostrando el botón "Resolve", que enlaza al Truck, donde
    `canResolve` también es falso.
- **Criterio:** Sin permiso para una acción concreta (la acción no aparece o aparece explicada).
- **Severidad:** 2 · Afecta a los roles de solo lectura; es un callejón sin salida.
- **Recomendación:** Sin permiso, no hay botón; una línea "Only a Shop Manager can take this
  step.", como en las propuestas de Truck y WO.
- **Esfuerzo:** S

### Cargando

### UX-6-004 · El esqueleto de carga no tiene la forma de la pantalla y oculta el título
- **Dónde:** Dashboard `admin-dashboard.tsx:17` (`PageSkeleton` reemplaza también el
  encabezado); Yard `PageSkeleton` debajo del título real, con un segundo título de esqueleto
- **Evidencia:** `evidencia/06-dashboard-cargando.jpg` (observado):
  - Tres bloques grises iguales, sin la forma de las métricas ni de la lista.
  - El título "Shop Operations" desaparece mientras carga.
  - En el Yard aparece un título de esqueleto bajo el título real.
- **Criterio:** Cargando (esqueleto con la forma del contenido, sin saltos).
- **Severidad:** 1 · Dura poco; produce un salto de layout al llegar los datos.
- **Recomendación:** Mantener el encabezado real y usar un esqueleto con la forma de la franja
  de contadores y de 3 filas de la cola. En el Yard, `PageSkeleton header={false}`.
- **Esfuerzo:** S

### Error

### UX-6-005 · Errores de carga con texto de sistema y sin decir qué hacer
- **Dónde:** Dashboard `LoadFailure` "Unable to load current administrative data." / "Retry";
  Yard "Unable to load Yard Operations." / "Retry Yard Operations"
- **Evidencia:** (inferido del código; no se apagó el backend en producción)
- **Criterio:** Error del sistema (decir que no es culpa del usuario, si sus datos están a
  salvo y qué hacer).
- **Severidad:** 2
- **Recomendación:** "Couldn't load the Dashboard. Your data is safe. Check the connection and
  try again." con el botón "Try again". En el Dashboard, si falla una sola sección, el resto
  sigue visible.
- **Esfuerzo:** S

### Éxito

### UX-6-006 · Return to Service en el Yard: un clic, sin confirmar y con error genérico
- **Dónde:** Yard, botón bajo la tarjeta Ready to Go · `admin-yard-operations.tsx:503-535`
- **Evidencia:** (inferido del código; no se pulsó en producción)
  - El clic hace un GET y un POST sin diálogo.
  - El éxito es un toast "Truck returned to service." y la tarjeta desaparece.
  - El error es "Could not complete this step. Refresh and try again." aunque sea un conflicto
    de versión.
  - Desde el Dashboard, Resolve también se hace sin confirmar (eso es correcto: es reversible).
- **Criterio:** Confirmación proporcional (acción con consecuencias → confirmación con resumen).
- **Severidad:** 3 · Saca el camión del tablero y lo marca In Service; un toque sin querer en el
  teléfono no tiene vuelta en la UI.
- **Recomendación:** El mismo diálogo de Return to Service que el Truck y la WO (motivo
  opcional) y el mensaje de conflicto específico.
- **Esfuerzo:** S

### Vacío

### UX-6-007 · Sin pedidos de trabajo, la sección desaparece; la búsqueda sin resultados no repite qué se buscó
- **Dónde:** Dashboard "Work requests" (`admin-dashboard.tsx:77-95`, se oculta con 0); Yard vacío
  ("No Trucks match these filters.", también sin filtros activos)
- **Evidencia:** `evidencia/06-yard-busqueda-sin-resultados.jpg` (observado): "No Trucks match
  these filters." con la búsqueda "zzzz", sin mencionarla y sin un botón para limpiar.
- **Criterio:** Vacío de filtro (repetir lo buscado, ofrecer quitar filtros).
- **Severidad:** 2
- **Recomendación:**
  - "No trucks match “zzzz”." con el botón "Clear search".
  - En el Dashboard, la cola vacía dice "Nothing waiting on you" con la hora. Así el Manager
    sabe que no es un fallo.
- **Esfuerzo:** S

### UX-6-008 · Movement dice "Updated <ahora>" aunque no haya datos, y cada fallo se ve igual
- **Dónde:** `admin-yard-operations.tsx:170` (`yard-movement-source`); `admin-yard-data-boundary-cards.tsx`
- **Evidencia:** (inferido del código)
  - El servidor pone `asOf` = ahora siempre, así que "Source: Dispatch · Updated …" sale
    también cuando las tres secciones están sin datos.
  - "Sin configurar", "error del proveedor" y "fallo de red" se ven todos como "UNAVAILABLE /
    Data unavailable".
  - No hay reintento visible.
- **Criterio:** Visibilidad del estado; error parcial acotado.
- **Severidad:** 2 · Hace pensar que el dato está al día cuando no hay dato.
- **Recomendación:**
  - Mostrar la hora del dato de Dispatch, no la de la consulta, y ocultarla si no hay datos.
  - Distinguir "Dispatch isn't connected" de "Dispatch didn't answer · Try again".
  - Texto en sentence case.
- **Esfuerzo:** S

## Lo que funciona bien
- Hay rama de vacío en Needs attention ("No open Work Orders need attention.") y en cada
  sección de Movement.
- El error de carga del Yard queda acotado al panel: las pestañas y el título siguen visibles.
- Movement acota el fallo por sección: si falla una, las otras siguen.
- Los botones que mutan (Resolve, Return to Service) se deshabilitan mientras esperan: no hay
  doble envío.

## Fuera de alcance / no verificado
- El error de sistema real (apagar la API) y la sesión expirada: no se provocaron en producción.
- Los estados de Movement sin configurar o con error: se tomaron del código y de
  `YARD_DATA_BOUNDARY.md`.
