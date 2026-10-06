# Plan: Etapa 8, fidelidad a las maquetas (WO, Truck, Dashboard, Yard y marco común)

## Context

En las Etapas 1–7 (rama `claude/exciting-lehmann-09883c`, Linear LTR-190) se construyó el
**comportamiento** de las propuestas: qué hace cada botón, dónde vive cada acción, D26/D27, conteos
y Dispatch. Pero se montó sobre los componentes y estilos que ya existían. Por eso las pantallas **no
se ven como las maquetas aprobadas** en el chat "Mejora UI pantalla" y en esta sesión:
- `docs/proposals/wo-detail-redesign/mockup.html`
- `docs/proposals/truck-detail-redesign/mockup.html`
- `docs/proposals/dashboard-yard-redesign/mockup.html`

El dueño lo notó al revisar y pide:
- que queden **como las mejoramos en la UI**;
- commits por paso;
- un plan documentado, ejecutado con loop/agentes;
- que esto sea **lo último antes de producción**;
- que al final quede escrito qué faltó definir.

Tres agentes compararon cada maqueta con la app, región por región.

**Hallazgo base:** los tokens de color (`globals.css`) y el mapeo de Tailwind **ya son idénticos** a
las maquetas (eso se hizo en la Etapa 7). Las diferencias son de uso y estructura:
- **Primitivas.** `Button` es `rounded-lg font-semibold` y la maqueta `rounded-md font-medium`.
  `Card` lleva `p-4 shadow-soft` y la maqueta no tiene sombra. `PageHeader` es `font-bold`.
- **Color equivocado.**
  - `Badge warning` usa `shop-accent`, que es **azul**. Por eso "Not Ready", "Paused" y "High" salen
    azules en vez de ámbar.
  - Los menús y diálogos usan `bg-popover`; en oscuro eso es el color del fondo, no el de la tarjeta.
- **Faltan piezas enteras.**
  - WO: la franja de métricas, el aviso del siguiente paso con tonos e icono, y las tarjetas
    separadas de la columna derecha.
  - Truck: la tarjeta que agrupa pasos, Jobs y avatares.
  - Yard y Dashboard: la anatomía de las filas y tarjetas, y Dispatch en 3 columnas.
  - Las hojas inferiores en el teléfono.
  - Los iconos en botones y menús.
- **Marco común.** En la maqueta el menú lateral ocupa todo el alto y hay migas de pan
  ("Work Orders › WO-010"). La app tiene la barra superior a todo el ancho y no tiene migas.

## Decisiones del dueño (2026-10-06, antes de empezar)
- **Título** como la maqueta: "Truck 918" en la WO y "Truck 601" en el Truck.
- **Marco común** igual a la maqueta: menú lateral a todo lo alto, migas de pan y estilo del menú.
- **Datos de la API:** se agregan los campos que faltan (Paso 6), antes de las pantallas que los
  usan.
- **Yard:** se quita "More filters"; quedan la búsqueda y los filtros rápidos, como la maqueta.

## Reglas de ejecución

- **Fuente de verdad:** cada maqueta. Se compara con capturas lado a lado a 1366 px y 375 px, en
  claro y oscuro, con los mismos datos (la API de prueba).
- **Comportamiento:** se mantiene el de las Etapas 1–7 (D26, D27 y lo que pide el README de cada
  propuesta). Si la maqueta se contradice con una decisión ya tomada, gana la decisión. Ejemplo: en
  la maqueta, "Close Work Order" en el Dashboard cierra directo, pero D27 pide confirmar, así que se
  confirma.
- **Commits:** uno por paso. Antes de cada commit:
  - `tsc` y las pruebas unitarias del web;
  - las e2e de la pantalla tocada (puertos alternos 3121/3014 si el 3101 está ocupado);
  - capturas comparadas.

  Se hace push de la rama con nombre y no se abre PR hasta que el dueño lo pida.
- **Docs primero:** las diferencias se anotan como §1h en `docs/OPEN_ISSUES.md` (F1…Fn) antes de
  tocar el código, y se tachan al cerrarse. Las preguntas abiertas se juntan en
  `docs/proposals/PENDIENTES_UI.md`.
- **Selectores de prueba:** se conservan los testids que piden los README:
  - WO: `admin-wo-*`, `labor-segments`, `labor-end-reason`.
  - Truck: `truck-*`, `assign-job-<id>`, `work-plan-add-work`, `operational-counts`.
  - Yard: `yard-*`.
  - Dashboard: `work-order-next-step`, `admin-blocker`.

  Si un texto o un elemento cambia, se actualiza la prueba en el mismo commit.
- **Ejecución con agentes:**
  - Los pasos se hacen **en orden**, porque comparten `ui.tsx` y `admin-messages.ts`, y trabajar en
    paralelo daría conflictos.
  - Al cerrar cada pantalla, un agente revisor recibe la maqueta y las capturas, compara región por
    región y devuelve las diferencias que queden.
  - Ese ciclo (corregir → capturar → revisar) se repite hasta que el revisor no encuentre diferencias
    de importancia. Después se hace el commit.

## Pasos

### Paso 0: documentar (sin código)
- Agregar `OPEN_ISSUES.md` §1h, "Fidelidad a las maquetas", con una fila por región: lo que difiere,
  sacado de los tres informes.
- Crear `docs/proposals/PENDIENTES_UI.md` con las preguntas abiertas (lista abajo).
- Actualizar LTR-190 (la descripción gana la "Etapa 8").
- Commit.

### Paso 1: base común (primitivas, colores y marco)
Archivos: `apps/web/src/components/ui.tsx`, `apps/web/src/app/globals.css`,
`apps/web/src/lib/status-chips.ts`, `apps/web/src/components/admin-shell.tsx`,
`apps/web/src/components/action-toast.tsx`.

- **`Button`:** `rounded-md font-medium`. Las alturas siguen la maqueta: `h-11` en el teléfono y
  `sm:h-9` desde `sm`. El tamaño `sm` deja de bajar el texto a 12 px. Iconos de lucide antes del
  texto, donde la maqueta los pone.
- **`Card` / `.card`:** sin `shadow-soft`. Variante de sección: cabecera
  `border-b px-4 py-3 h2.text-base.font-semibold` con la cuenta como chip
  (`bg-muted ring-1 ring-border`).
- **`PageHeader` / `.page-title`:** `font-semibold tracking-tight text-2xl md:text-[28px]`.
- **`Badge` y estado:**
  - Tonos con tinte y punto (`border-x/40 bg-x/10 text-x`).
  - `warning` pasa a ámbar (`text-warning-foreground dark:text-warning`) y se deja de usar
    `shop-accent` en los chips.
  - En `status-chips.ts`: In progress se tiñe de azul (no relleno sólido), Paused y High en ámbar,
    Critical con tinte rojo, y "… priority" en el encabezado de la WO.
- **Menús y popovers:** `bg-card rounded-lg p-1 shadow-xl`, ítems `h-11 sm:h-9 rounded-md` con
  icono, cabecera opcional y separador. **En el teléfono, hoja inferior** con agarradera. Se crea un
  componente común (`ResponsiveMenu`) basado en el `DropdownMenu` y el `Popover` de Radix, y se usa
  en el "…" de la WO, del Job y del Truck, y en el `MechanicPicker`.
- **Diálogos (`Modal`):** `bg-card`. Título `text-base font-semibold` con la descripción en la
  cabecera. Pie `flex-col-reverse sm:flex-row sm:justify-end` con "Back" y la confirmación, sin
  estirar los botones.
- **Toasts:** neutros (`bg-card border`), con icono de color; abajo a la derecha desde `sm` y por
  encima de la barra fija.
- **Avatares:** una paleta por mecánico (hash del id → sky, violet, emerald, rose, cyan, amber,
  slate), en un componente `MechanicAvatar` y `lib/mechanic-tone.ts` con su prueba. Se cuida el
  contraste AA (la Etapa 7 lo exigió).
- **Marco común (`admin-shell.tsx`), como la maqueta:**
  - El menú lateral ocupa todo el alto, con la marca arriba.
  - Ítems `h-9 rounded-md`; el activo `bg-accent font-medium`; los grupos sin negrita.
  - Barra superior con migas de pan (Work Orders › WO-010; Trucks › 601).
  - El cuerpo sin degradado.
  - El bloque de usuario al pie.
  - El cambio de tema se queda en el menú de perfil (decisión anterior, LTR-179).
- **CSS que viene de la maqueta:** animaciones `sheet-in`, `pop-in` y `flash`; el spinner de
  "Saving…"; el estilo `.seg`.
- **Commit:** "Stage 8.1: base primitives and shell match the mockups".

### Paso 2: Work Order (`admin-work-order-detail.tsx`, `admin-job-table.tsx`, `work-order-history.tsx`, `admin-blocker-resolve.tsx`, `next-step-action.tsx`, `close-work-order-dialog.tsx`)
Regiones según el informe de la WO (maqueta, líneas 324–790):
1. **Encabezado:**
   - "Truck 918" como título (si el dueño lo confirma); primero el estado y después la prioridad.
   - Una sola línea de datos: WO en letra mono • vehículo • Opened • Updated.
   - "Open Truck" como botón ghost.
   - Pause y Resume con icono.
   - El "…" sin Return to Service, con cabecera y separador.
   - "View only…" en solo lectura.
2. **Franja de métricas** (nuevo componente `WorkOrderMetrics`):
   - Progreso con barra segmentada: hechos, bloqueados y en taller externo.
   - Labor activa, espera, edad y avatares.
   - Versión compacta en el teléfono.
   - `operational-counts` sigue en el elemento nuevo.
3. **Aviso del siguiente paso** (nuevo componente `NextStepCallout`, que también usarán el Truck y el
   Dashboard):
   - Tonos warning, primary, success, muted y danger; recuadro con icono; antetítulo, título y
     subtítulo; acción a la derecha.
   - Los 8 estados de la WO más los tipos que da la API: inspect, add_missing_steps, qc y
     create_work_order. El tipo siempre sale de `data.nextStep`.
   - El blocker muestra solo el primero, con "(+N more)". Su formulario de resolver es de 2 filas.
   - Los blockers resueltos se pliegan en el pie del aviso.
   - La tarjeta "Complete Work Order" se une al aviso; la barra fija pasa a observar el aviso.
4. **Jobs:**
   - Tarjeta de sección con su cuenta y "+ Add work in Work Plan" en la cabecera.
   - Banda de candado sobre `bg-sunken` cuando no se puede editar.
   - Columnas de 200, 130 y 150 px; filas de 2 líneas en el teléfono.
   - La fila bloqueada se tiñe.
   - Mecánico: botón ghost con avatar de color. Sin dueño: "Assign" con borde punteado. QC: "Safety".
     Taller externo: "Part out" o "Truck out" con la nota.
   - Estado con icono: Done y la hora, Blocked, External y Cancelled.
   - "Complete" discreto (ghost) con icono.
   - El PM, en un menú; ya no es un select.
   - El grupo de cerrados **abierto por defecto**, con el estilo apagado de la maqueta.
   - Las líneas de detalle: QC, "Helps {owner}" y la del PM.
5. **Notas:** hilo con avatar; nombre en negrita y la hora. Los pedidos de trabajo en su recuadro. El
   campo de una línea lleva "Post" adentro, más su texto de ayuda.
6. **Columna derecha en 4 tarjetas:**
   - **Truck:** Unit, Vehicle, millaje en "mi", VIN con copiar, empresa · dueño y ubicación.
   - **Priority:** botones segmentados; Update y Reset solo cuando cambia.
   - **Labor by mechanic.**
   - **Repair history:** siempre visible, con el filtro en la cabecera.
7. **History:**
   - Siempre abierto, con las pestañas en la cabecera y su cuenta.
   - Actividad como línea de tiempo: icono y tono por evento, frases con negritas, 7 eventos más
     "Show all N".
   - Tiempos: 6 columnas; los tramos en un recuadro con la leyenda, chips con icono y los más nuevos
     primero.
   - Diálogo de corrección con errores separados y "Back".
   - Se adapta `openTimes()`, porque History deja de ser un `<details>`.
8. **Barra fija** con desenfoque y animación. Error con icono y "Reload" entre el encabezado y el
   aviso.

**Commit:** "Stage 8.2: Work Order matches the mockup".

### Paso 3: Truck (`admin-truck-detail.tsx`, `admin-truck-work-plan.tsx`, `admin-truck-next-step.tsx`, `truck-stepper.tsx`, `truck-actions-menu.tsx`, `side-sheet.tsx`, `work-plan-add-work.tsx`, `category-job-list.tsx`, `lib/truck-stepper.ts`)
1. **Encabezado:**
   - "Truck 601"; el chip de estado con punto y el paso actual ("Not Ready · PM"); "Ready to close"
     en ámbar.
   - El chip de la WO con icono, letra mono, el estado con su color y la prioridad.
   - "+ Add work" a todo el ancho en el teléfono.
   - El "…" con iconos y oculto en solo lectura; "View only…".
2. **Tarjeta de preparación:** pasos con su color (pendiente en ámbar, taller externo en azul, estado
   nuevo "waiting" para Close), separadores, máscara de desvanecido y tooltip. A la derecha: "N jobs
   left" y los avatares con "+N" y el número de mecánicos.
3. **Aviso del siguiente paso:** el mismo `NextStepCallout`, con un estado por tipo (ver la tabla del
   informe del Truck). "Issues found" como botón principal; "Mark QC complete" con borde; en solo
   lectura se ocultan los botones y sale el texto que lo explica.
4. **Work Plan:**
   - Una sola tarjeta con filas separadas por líneas; "Jobs on WO-004" en la cabecera.
   - Recuadro circular con color por estado; el detalle va en línea.
   - Inspection y Close nunca se pliegan.
   - Inspección registrada: "Change" como enlace, con las 2 opciones.
   - Filas de Job como la cuadrícula de la maqueta: nombre | dueño | estado | gestionar. Assign con
     borde punteado. Pendientes primero.
5. **Add work:**
   - Categorías como botones, con la primera ya elegida.
   - Búsqueda con icono; los chips de la plan aparecen con "· on plan" y deshabilitados.
   - "Custom job" con su etiqueta.
   - "To add (N)" con "Who does it?" en el selector, y **dueños por defecto** para PM, Alignment y
     Detailing.
   - Pie fijo con Cancel y "Add to Work Plan (N)".
   - Hoja inferior de 92 vh en el teléfono y panel de 460 px en escritorio, sobre `bg-card`.
6. **Columna derecha:**
   - Tarjeta Truck: Vehicle, "mi", VIN, empresa y dueño, estado operativo con color, ubicación.
   - Repair history con el filtro por categoría (el hook ya lo acepta), "by", chips y "Load more".
7. **Error** con icono y "Reload Truck" para cualquier acción fallida, más el toast.

**Commit:** "Stage 8.3: Truck matches the mockup".

### Paso 4: Dashboard (`admin-dashboard.tsx`)
- Encabezado con "Live" y el punto.
- Contadores: tabulares y `dark:text-warning`.
- Cola: tarjeta de sección, grupos sobre `bg-sunken`, "Truck 918" en las filas, título y detalle en 2
  líneas, botones con icono a la derecha.
- Blocker con su formulario de 2 filas.
- "Since" en las pausas, "All N Jobs are done" y "Dispatch: leaves" en Ready to Go.
- Pedidos de trabajo con el enlace al Truck.
- "Leaving soon" como en la maqueta, con "Open Truck →".
- Workspaces se queda donde está (es una decisión pendiente).

**Commit:** "Stage 8.4: Dashboard matches the mockup".

### Paso 5: Yard (`admin-yard-operations.tsx`, `admin-yard-data-boundary-cards.tsx`, `lib/yard-card.ts`)
1. **Pestañas:** sin relleno a los lados.
2. **Búsqueda y filtros en una sola fila:** chips con tinte y el chip **"Leaving soon"**. Se **quita**
   "More filters" (decisión del dueño). La URL sigue aceptando `readiness`, `phase`,
   `workOrderStatus` y `priority`, porque llegan enlaces desde otras pantallas, pero ya no hay
   controles para esos filtros.
3. **Línea de estado:** "N trucks in the shop" o "Showing N of M", más "filters stay…".
4. **Escritorio:** carriles dentro de **una sola** tarjeta, con la columna de 8 rem.
5. **Teléfono:** pasos plegables y los pasos vacíos ocultos.
6. **Tarjeta:**
   - El número en el color normal.
   - La alerta **o** el siguiente paso (no los dos), con icono y su tono.
   - La barra de progreso en verde.
   - Avatares de color.
   - Return to Service dentro de la tarjeta.
   - El borde ámbar cuando corresponde.
7. **Dispatch:**
   - El aviso en una sola frase, con icono.
   - 3 columnas: Arriving, Leaving y Where Dispatch has them. Llegadas y Salidas en filas con el chip
     de estado en el taller y "N jobs left".
   - "Dispatch didn't answer".

**Commit:** "Stage 8.5: Yard matches the mockup".

### Paso 6: datos que faltan en la API (aprobado; se hace **justo después del Paso 1**, antes de las pantallas)
Orden real de ejecución: 0 → 1 → 6 → 2 → 3 → 4 → 5 → 7. Son campos que se **agregan**, sin cambiar
los que ya existen, en `packages/shared/src/types.ts`, `apps/api/src/admin/*.service.ts` y el fixture
`apps/web/e2e/fixtures/admin-api.mjs`. Cada uno va con su prueba de API y su fila de `test:real`.
Commit: "Stage 8.6: additive API fields for the mockups".

| Campo | Para qué |
|---|---|
| `TruckWorkPlanDto.inspection.recordedAt` | "Issues found · Oct 4, 9:12 AM" |
| `WorkPlanJobDto.completedAt` | La hora de "Done" en el Work Plan |
| `workPlan.workOrder.completedAt` y `priority` | El paso Close y el chip de la WO |
| `AdminWorkOrderSummaryDto.phase` | El paso en "Leaving soon" y en "Unassigned" |
| `AdminOpenWorkRequestDto.truckId` | El enlace al Truck |
| `YardOperationsCountsDto.quick.leavingSoon` + el filtro `soon` | El chip "Leaving soon" |
| Totales por paso | El número de cada carril sobre todas las páginas |
| `YardDispatchShopTruckDto.phase`, `readyToGo` y `jobsLeft` | Las filas de Dispatch |
| `outOfShopJobName` | "Out of shop · Radiator Repair" |
| La razón de cancelación de la WO y del Job | Los avisos de cancelado |
| Bandera `corrected` en los tramos | El chip "Corrected" |

**Sin datos, no se muestra:** si no se aprueba un campo, se omite esa pieza visual y se anota en
PENDIENTES_UI.md. Nunca se inventa un dato.

### Paso 7: verificación final, documentación y cierre
- **`ui-audit`:** Manager, mecánico y Safety; claro y oscuro; teléfono y escritorio; inglés y
  español. `states.mjs`, más un estado nuevo con las hojas inferiores.
- **Pruebas:** la suite e2e completa, `test:real` (si hubo cambios de API) y las pruebas unitarias.
- **Docs:** se actualizan SYSTEM.md, USER_FLOWS, `design-system/components.md` y `foundations.md`
  (las primitivas nuevas) y los README de las 3 propuestas (que dirán "construido igual a la
  maqueta").
- **Pendientes:** `PENDIENTES_UI.md` queda como la lista final de preguntas para el dueño.
- **Linear:** LTR-190 con el resumen de la Etapa 8.
- **Commit y push**, sin PR.

## Preguntas abiertas (van a `docs/proposals/PENDIENTES_UI.md` para responderlas al final)
1. ¿Son confiables los datos de Dispatch? De esto depende "Leaving soon" (filtro y alerta).
2. ¿Return to Service por lotes desde el Yard?
3. ¿Inspección desde el Dashboard? Botones en la fila (como la maqueta) o solo un enlace al Truck.
4. ¿Dónde va el bloque Workspaces? Menú de perfil o lateral.
5. ¿La maqueta del Dashboard cierra una WO de un toque? Hoy la app pide confirmar (D27). Se mantiene
   D27 salvo que el dueño diga otra cosa.
6. ¿Se repite el stepper en el Dashboard o en las tarjetas del Yard?
7. Todo lo que el agente revisor marque como "diferencia menor aceptada" al cerrar cada pantalla.
   Se anota aquí para que el dueño lo vea al final.

## Archivos críticos
- **Primitivas y marco:** `apps/web/src/components/ui.tsx`, `admin-shell.tsx`, `action-toast.tsx`,
  `apps/web/src/app/globals.css`, `apps/web/src/lib/status-chips.ts`.
- **Nuevos:** `components/next-step-callout.tsx`, `components/work-order-metrics.tsx`,
  `components/mechanic-avatar.tsx`, `components/responsive-menu.tsx`, `lib/mechanic-tone.ts` (con su
  spec).
- **Pantallas:** las listadas en los Pasos 2 a 5.
- **Reutilizar:**
  - `truckSteps` / `truckStatusChip` (`lib/truck-stepper.ts`)
  - `yardCardAlert` / `dispatchShopConflicts` (`lib/yard-card.ts`)
  - `orderJobs` (`lib/work-order-jobs.ts`)
  - `groupDashboardQueue` (`lib/dashboard-queue.ts`)
  - `timeSegments` (`work-order-history.tsx`)
  - `laborByMechanic`, `profileInitials`, `shouldTakeInitialFocus`
  - `NextStepAction`, `CloseWorkOrderDialog`, `ReturnToServiceDialog`, `NewWorkOrderDialog`,
    `SideSheet`, `MechanicPicker`
  - `useAdminRepairHistory` (ya acepta `categoryId`)

## Verificación (por paso y al final)
1. **Capturas lado a lado**, maqueta y app, a 1366 px y 375 px, en claro y oscuro:
   - maquetas en el puerto 4460 (`mockups` en launch.json);
   - app en el 3032 con la API de prueba en el 3111 (`audit-web` / `audit-api`).

   El agente revisor compara región por región; el paso se cierra solo sin diferencias de
   importancia.
2. **Pruebas:**
   - `tsc` y las pruebas unitarias del web (`vitest --exclude 'e2e/**'`);
   - las e2e de la pantalla tocada (configuración alterna, puertos 3121/3014);
   - al final, la suite e2e completa y `ui-audit` sin contraste bajo, sin texto bajo 12 px y sin
     scroll lateral;
   - `test:real` si se tocó la API.
3. **Producción:** solo se mira, después de que el dueño fusione el PR.
