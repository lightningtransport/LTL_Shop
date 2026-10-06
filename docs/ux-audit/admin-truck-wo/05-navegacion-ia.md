# 05 · Navegación y arquitectura de información — Lightning Shop Admin (Truck y Work Order)

**Fecha:** 2026-10-05 · **Alcance:** `/admin/trucks/[id]`, `/admin/work-orders/[id]` y sus
entradas (Dashboard, Yard, listas) · **Método:** código + navegador (producción en solo lectura:
Trucks 601 y 282, WO-010).

**Resumen:** 7 hallazgos, 4 de severidad 3. El patrón dominante: **el Truck y la Work Order
tienen la misma lista de Jobs y casi el mismo "Next step", pero con poderes distintos y botones
que mandan de una pantalla a la otra**. El Manager no puede saber cuál es "la buena" para cada
tarea. El reparto que dicen los documentos (Truck = ¿puede salir?, WO = ejecutar el trabajo)
tiene lógica. Lo que falla es que la UI no lo respeta. Se propone una estructura en
[Estructura propuesta](#estructura-propuesta).

## Mapa de navegación observado

| Ruta | Etiqueta | Cómo se llega | Clics desde el menú | Rol |
|---|---|---|---|---|
| `/admin` | Dashboard | Menú | 1 | Manager |
| `/admin/yard-operations` | Yard Operations | Menú | 1 | Manager |
| `/admin/trucks` | Trucks | Menú | 1 | Manager |
| `/admin/trucks/[id]` | "Truck 601" (título = número) | Lista de Trucks; tarjeta del Yard; botón del Next step en el Dashboard y en las listas; título y "Open Truck" de la WO; deep link `#truck-work-plan-title` ("Add work in the Work Plan") | 2 | Manager; solo lectura para los demás |
| `/admin/work-orders` | Work Orders | Menú | 1 | Manager |
| `/admin/work-orders/[id]` | "918" (número del Truck) + "Work Order WO-010" | Lista de WOs; "Open Work Order: WO-x" y "Current Work" del Truck; Repair history | 2 (desde la lista) · 3 (Yard → Truck → WO) | Manager |
| `/admin/work-orders/new` | New Work Order | Lista de WOs; Next step `create_work_order` del Truck | 2–3 | Manager |

**Volver:**
- El Truck usa `?from=` y su back link dice "Back to Trucks / Work Order / Work Orders /
  Dashboard / Yard Operations" según de dónde vienes (`lib/admin-truck-origin.ts`).
- La WO **siempre** dice "Back to Work Orders" (`admin-work-order-detail.tsx:215`).

### Matriz tarea × pantalla (hoy)

✅ = se hace aquí · → = el botón lleva a la otra pantalla · — = no está.

| Tarea del Manager (historia) | Dashboard / Yard | **Truck** | **Work Order** | Clics hoy (desde el Truck) |
|---|---|---|---|---|
| Registrar inspección (HU-M2) | → Truck | ✅ | → Truck ("Go to the inspection") | 1 |
| Agregar trabajo (HU-M2, D6) | → Truck | ✅ (el formulario se abre al final del Work Plan) | → Truck (deep link; no abre el formulario) | 5–6 |
| Asignar un Job **sin dueño** (HU-M3) | → Truck | ✅ (selector en la fila; el Next step "Assign" lleva al selector) | ✅ | 2 |
| Reasignar / quitar dueño (HU-M3) | — | — | ✅ | 3 (Truck → WO → selector) |
| Completar un Job (HU-M5) | — | Solo QC (Next step) | ✅ | 3 |
| Ayudante (HU-M10) | — | — | ✅ ("…" → modal → diálogo) | 5 |
| Mandar a taller externo / "Returned" (HU-M11) | — | Muestra el estado; **sin acción ni enlace** | ✅ | 5 / 3 |
| Resolver un blocker (HU-M4) | ✅ (Dashboard, en línea) | ✅ (Next step) | ✅ en el bloque de blockers **y** → Truck desde el Next step | 2 |
| Pausar (HU-M4) | — | — | ✅ | 2 (Truck → WO → Pause) |
| Reanudar (HU-M4) | → Truck | ✅ (Next step) | ✅ | 1 |
| Cerrar la WO (HU-M5) | → Truck | ✅ (Next step "Close Work Order") | ✅ ("Confirm completion") **y** → Truck desde el Next step | 1 |
| Return to Service (HU-M5) | ✅ (tarjeta del Yard) | ✅ (Next step) | ✅ ("…" → diálogo) **y** → Truck desde el Next step | 1 |
| Notas, pedidos de trabajo (HU-ME4) | — | — | ✅ | 2 |
| Prioridad | — | — | ✅ | 2 |
| Tiempos y corrección (HU-A1) | — | — | ✅ | 2 |
| Cancelar / reabrir WO o Job (HU-M6) | — | — | ✅ | 3 |
| Datos del camión, historial de reparaciones | — | ✅ | ✅ (los mismos datos, plegados) | 1 |

Lectura de la matriz:
- **Lo exclusivo del Truck:** la inspección y agregar trabajo. Es su razón de ser.
- **Lo exclusivo de la WO:** ejecución y control (reasignar, completar, ayudante, taller
  externo, pausar, notas, tiempos, cancelar).
- **Se duplica en las dos:** la lista de Jobs, el Next step, Resolve, Resume, Close, Return
  to Service, los datos del camión y el historial.

## Hallazgos

### ¿Dónde estoy?

### UX-5-001 · El Truck dice que hay una Work Order abierta y, en el mismo lugar, que no hay ninguna
- **Dónde:** Truck Detail, encabezado y columna "Current Work" · `admin-truck-detail.tsx:128-149` y `openCurrentWork`
- **Evidencia:** `evidencia/05-truck-282-ready-to-go-contradiccion.jpg` (observado). El Truck 282
  (WO-002 completada) muestra el botón "Open Work Order: WO-002" y, a la derecha, "No open Work
  Orders are linked to this Truck." El botón aparece siempre que `workPlan.workOrder` existe,
  aunque esté completada.
- **Criterio:** Orientación; un contenido, un lugar; Nielsen H4 (consistencia).
- **Severidad:** 3 · Frecuente (todo camión en Ready to Go, que dura horas o días), confunde
  justo antes de Return to Service, persistente.
- **Recomendación:** En el encabezado, el enlace dice qué es la WO: "WO-002 · Completed" (enlace
  secundario) o "Open WO-004" solo cuando está abierta. "Current Work" desaparece y el encabezado
  lleva el chip de la WO actual.
- **Esfuerzo:** S

### UX-5-002 · Llegar a la Work Order desde el Truck y "volver" lleva a la lista, no al Truck
- **Dónde:** WO Detail, back link · `admin-work-order-detail.tsx:215`
- **Evidencia:** Pasos (inferido del código y observado el texto): Truck 918 → "Open Work Order"
  → la WO muestra "Back to Work Orders" → lleva a `/admin/work-orders`. El Truck sí usa `?from=`.
- **Criterio:** Movimiento ("volver lleva a donde estaba el usuario").
- **Severidad:** 2 · El camino Truck ↔ WO es el más usado del Manager; obliga a buscar el camión otra vez.
- **Recomendación:** La WO acepta `?from=` como el Truck (`adminTruckHref` ya existe) y el back
  link dice "Back to Truck 918" cuando vienes del Truck.
- **Esfuerzo:** S

### ¿Qué hay aquí?

### UX-5-003 · La misma lista de Jobs vive en dos pantallas, con poderes distintos y sin decir cuál es cuál
- **Dónde:** Truck Detail → Work Plan (`admin-truck-work-plan.tsx`, `admin-readiness-tracker.tsx`) y WO Detail → Jobs (`admin-job-table.tsx`)
- **Evidencia:** `evidencia/04-truck-601-work-plan.jpg` y `evidencia/05-wo-010-pagina-completa.webp`
  (observado).
  - En el Truck cada Job sale con dueño y estado, pero solo se puede asignar si no tiene dueño.
  - Reasignar, completar, cancelar, ayudante y taller externo están solo en la WO.
  - Ninguna fila del Truck lleva a su Job en la WO.
- **Criterio:** Organización ("un contenido, un lugar"); Nielsen H6 (reconocer antes que recordar).
- **Severidad:** 3 · Cada vez que el Manager quiere cambiar algo de un Job desde el Truck tiene
  que saber que eso está en otra pantalla, ir y volver a encontrar el Job.
- **Recomendación:** Mantener las dos vistas, cada una con su propósito explícito. El Truck
  muestra los Jobs como **lista de readiness por paso** (compacta, de lectura, solo con el paso
  `assign` para los Jobs sin dueño). Cada fila lleva un enlace **"Manage in Work Order"** a
  `/admin/work-orders/[id]#job-<id>`, que abre la WO con esa fila resaltada. La WO es el único
  lugar con acciones de Job. **No se copian las acciones de la WO al Truck.**
- **Esfuerzo:** M

### UX-5-004 · Desde la Work Order, el botón del "Next step" te saca al Truck para hacer algo que la Work Order ya tiene
- **Dónde:** WO Detail, Next step · `admin-work-order-detail.tsx:259-264` (el `Link` a `truckHref`)
- **Evidencia:** `evidencia/05-wo-010-resolve-manda-al-truck.jpg` (observado). En WO-010 el Next
  step dice "Blocked · Air Dryer: Waiting for Parts" con el botón "Resolve". Su `href` es
  `/admin/trucks/1ec48640…?from=/admin/work-orders/…`, pero 3 bloques más abajo la misma WO
  tiene "Resolve" en línea. Pasa igual con Assign (la WO tiene el selector en la fila), Close
  (la WO tiene "Confirm completion") y Return to Service (la WO lo tiene en "…").
- **Criterio:** Movimiento (navegar vs actuar); Nielsen H4 (consistencia) y H7 (eficiencia).
- **Severidad:** 3 · Cada blocker o cierre visto desde la WO cuesta una navegación de ida y una de vuelta.
- **Recomendación:** Regla única: **el Next step actúa donde estás**. Se usa el mismo componente
  en las dos pantallas, con acciones en línea:
  - Resolve con nota a pedido.
  - Resume, Mark QC complete, Close y Return to Service en diálogo.
  - Add missing steps.
  - Assign abre el selector de mecánico ahí mismo.

  Solo navega lo que vive en la otra pantalla:
  - En la WO, `inspect` → "Go to the inspection" (Truck).
  - En el Truck, `external` → "Open in Work Order" (fila del Job, donde está Returned).
- **Esfuerzo:** M

### ¿A dónde puedo ir?

### UX-5-005 · El Truck dice "esperando taller externo" y no ofrece cómo marcar que regresó
- **Dónde:** Truck Detail, Next step `external` · `admin-truck-next-step.tsx` (sin control) y filas del Work Plan (sin "Returned")
- **Evidencia:** (inferido del código; en producción no hay un Truck en ese estado)
  - El Next step muestra "At external shop: {job}" sin botón.
  - La fila del Job muestra "At external shop · part" sin acción.
  - `SYSTEM.md` §5 dice "'Regresó' está en la fila del Job", que solo existe en la WO.
- **Criterio:** Callejón sin salida.
- **Severidad:** 3 · Es exactamente cuando el Manager mira el Truck para saber si ya puede seguir;
  no tiene siguiente acción y no sabe que está en la WO.
- **Recomendación:** En el Truck, el Next step `external` lleva el botón **"Open in Work Order"**
  (a `#job-<id>`) y la fila externa el mismo enlace. La WO conserva "Returned".
- **Esfuerzo:** S

### UX-5-006 · "Add work in the Work Plan" lleva al Truck pero no abre el formulario
- **Dónde:** WO Detail → Jobs → "Add work in the Work Plan" (`#truck-work-plan-title`); Truck → "Add work" (el formulario se despliega al final del Work Plan)
- **Evidencia:** Pasos (observado en el Truck 601):
  1. Clic en "Add work" (encabezado).
  2. El formulario aparece debajo de "Close Work Order", fuera de la vista.
  3. Desde la WO el enlace solo hace scroll al título.
- **Criterio:** Profundidad; Nielsen H1 (visibilidad del estado).
- **Severidad:** 2 · Agregar trabajo es la tarea central del Truck (D6) y cuesta 5–6 clics
  y un scroll.
- **Recomendación:** "Add work" abre un **panel lateral** (hoja inferior en el teléfono) junto al
  botón, decidido el 2026-10-05. El enlace de la WO usa `#add-work` y abre ese panel al cargar.
- **Esfuerzo:** M

### UX-5-007 · Pausar solo existe en la Work Order, pero el Truck ofrece reanudar
- **Dónde:** Truck Detail, Next step `resume`; WO Detail, encabezado
- **Evidencia:** (inferido del código) `pauseAdminWorkOrder` solo se usa en `admin-work-order-detail.tsx`;
  `resumeAdminWorkOrder` se usa en las dos pantallas.
- **Criterio:** Consistencia del modelo ("un contenido, un lugar").
- **Severidad:** 1 · Tiene sentido por la regla única del Next step (reanudar es lo que sigue),
  pero el Manager no encuentra "Pause" en el Truck cuando lo busca para todo el camión.
- **Recomendación:** Dejarlo así y escribirlo: **Pause** es control de la ejecución (WO).
  **Resume** aparece donde el Next step lo pida. En el "…" del Truck, la entrada "Pause Work
  Order…" lleva a la WO.
- **Esfuerzo:** S

## Estructura propuesta

El reparto de `SYSTEM.md` se mantiene. Se hace **visible y sin solapes**:

```
Truck 601  — "¿Puede salir y, si no, qué lo frena?"   (vida: todas las visitas)
├── Encabezado: estado de readiness (un chip) · WO actual (chip + enlace) · Add work · …
├── Next step (actúa aquí; mismo componente que la WO)
├── Readiness: stepper Inspection → Shop Work → PM → Alignment → Detailing → QC → Close
│   ├── Inspection: No issues / Issues found  (SOLO aquí, D14)
│   └── Jobs por paso, compactos y de lectura · assign solo sin dueño · "Manage in Work Order" ↗
├── Panel Add work  (SOLO aquí, D6)
└── Contexto: Truck (datos, ubicación, estado operativo) · Repair history (todas las visitas)

Work Order WO-004 — "¿Qué hacemos, quién, cuánto falta, qué pasó?"   (vida: una visita)
├── Encabezado: Truck ↗ · estado · prioridad · Pause/Resume · …(Cancel, Reopen, Return to Service)
├── Next step (actúa aquí; "Go to the inspection" ↗ Truck es la única salida)
├── Jobs: tabla de ejecución — dueño, Complete, helper, taller externo, Returned, cancelar  (SOLO aquí)
├── Notes · Priority · Labor
└── History: Activity · Times (corrección) · Pauses  (SOLO aquí)
```

Qué se mueve y por qué:

| Cambio | Por qué |
|---|---|
| El Next step deja de mandar a la otra pantalla y actúa en las dos (UX-5-004) | Un mismo botón no puede actuar en una pantalla y navegar en otra |
| Las filas de Jobs del Truck: solo lectura + assign + "Manage in Work Order" (UX-5-003) | La WO es el único lugar con acciones de Job; el Truck no duplica controles |
| "Current Work" del Truck → chip de la WO en el encabezado (UX-5-001) | Elimina la contradicción y un bloque repetido |
| Los datos del camión y el historial se quedan en el Truck; en la WO, una tarjeta Truck compacta con enlace | Son del camión, no de la visita |
| Back link de la WO con `?from=` (UX-5-002) | El camino Truck ↔ WO es de ida y vuelta |
| Add work en panel lateral; `#add-work` lo abre (UX-5-006) | La tarea central del Truck queda a 1 clic de verse |

**Clics después del cambio** (desde el Truck):
- Reasignar un Job: 2 ("Manage in Work Order" → selector).
- Returned: 2.
- Resolve, Close o Return to Service desde la WO: 1 (antes 2 y una navegación).
- Agregar trabajo: el panel se abre a la vista.

## Lo que funciona bien
- **Una sola regla de Next step** para todas las pantallas (`packages/shared/src/truck-next-step.ts`,
  LTR-159): el texto es el mismo en el Dashboard, el Yard, las listas, el Truck y la WO.
- El back link del **Truck** sabe de dónde vienes (`?from=`) y lo dice ("Back to Work Order",
  "Back to Dashboard").
- Agregar trabajo e inspeccionar viven **solo** en el Truck (D6, D14): no hay dos formularios
  de alta.
- El Dashboard y las listas mandan siempre al Truck como lugar de trabajo; el camino es predecible.
- La URL de cada detalle es legible (`/admin/trucks/[id]`, `/admin/work-orders/[id]`).

## Fuera de alcance / no verificado
- Ningún Truck de producción estaba en el estado `external`, `qc` o `add_missing_steps`: se
  dedujeron del código (`admin-truck-next-step.tsx`) y del inventario.
- No se pulsó ningún botón que cambie datos en producción: los efectos de Resolve, Close y
  Return to Service se tomaron del código.
- Búsqueda y filtros de las listas, y el menú en el teléfono: fuera del foco de esta pregunta.
