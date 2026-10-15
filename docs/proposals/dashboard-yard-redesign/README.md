# Propuesta: rediseño de Dashboard y Yard Operations (Admin)

> **Estado (2026-10-14): construida y en producción** — PR 244 (Etapas 1–8, LTR-190). Cómo funciona hoy: [`SYSTEM.md`](../../SYSTEM.md). Esta propuesta queda como referencia de diseño.

**Clasificación:** PROPUESTA, ya construida (ver Etapa 8 abajo).
**Fecha:** 2026-10-05 · **Rama:** `claude/exciting-lehmann-09883c` · **Sin PR todavía.**
**Pantallas:** `/admin` → `admin-dashboard.tsx`; `/admin/yard-operations` → `admin-yard-operations.tsx`

**Etapa 8 (2026-10-06): construido igual a la maqueta** (`mockup.html`): el Dashboard con filas de dos líneas y botones con icono; el Yard con "Leaving soon" como filtro rápido (cuenta sobre todas las páginas), sin "More filters", carriles en una tarjeta con la cuenta de `byPhase`, pasos plegables en el teléfono y Dispatch en 3 columnas. Lo que quedó distinto está en [`PENDIENTES_UI.md`](../../archive/PENDIENTES_UI.md).

**Estado (2026-10-06):** construido en la rama `claude/exciting-lehmann-09883c` — Dashboard (Etapa 3)
y Yard (Etapa 6): filtros rápidos con conteo y "Mostrando N de M", carriles por paso, tarjeta con una
línea de alerta, pestañas Shop / Dispatch, Dispatch cruzado con el taller. **Pendiente:** "Leaving
soon" como filtro rápido del Yard (hoy es la alerta de la tarjeta y el bloque del Dashboard; depende
de la decisión sobre la confiabilidad de Dispatch, §6), grupos plegables en el teléfono y el conteo de
cada carril sobre todas las páginas.
**Base:** la auditoría [`docs/ux-audit/admin-dashboard-yard/`](../../ux-audit/admin-dashboard-yard/)
(05 navegación e IA, 04 jerarquía, 06 estados) y el reparto ya decidido para Truck y WO
([`truck-detail-redesign`](../truck-detail-redesign/README.md) §2).

El dueño confirmó el reparto (§2) el 2026-10-05. Faltan las decisiones de §6. Nada de esto
está construido.

## 1. Cómo verla

```bash
python3 -m http.server 4457 --bind 127.0.0.1 --directory docs/proposals/dashboard-yard-redesign
```

Abrir `http://127.0.0.1:4457/mockup.html`. Es una sola maqueta con las dos pantallas: el menú
cambia entre **Dashboard** y **Yard Operations**, y comparten el estado, así que lo que hagas en
una se ve en la otra.

El botón **Demo** tiene:
- Tres escenarios: Día normal, Todo al día (cola vacía) y Muchos Ready to Go.
- **Solo lectura**, **Simular error**, **Dispatch sin datos** y **Reiniciar**.

Revisada en 1280 y 375 px, en claro y en oscuro, sin scroll horizontal.

## 2. El reparto (decidido)

| Pantalla | Pregunta | Qué tiene |
|---|---|---|
| **Dashboard** | ¿Qué tengo que hacer ahora? | Cola de acciones; cada fila se resuelve ahí. Cuatro contadores que filtran la cola. "Leaving soon and not ready" (cruce con Dispatch) |
| **Yard Operations** | ¿Dónde está cada camión? | Carriles por paso, alertas en la tarjeta, filtros rápidos que se conservan al volver, Return to Service en Ready to Go. Pestaña Dispatch cruzada con el taller |
| **Trucks / Work Orders** (listas) | Directorio, búsqueda, historial | Sin acciones duplicadas (fuera de esta propuesta) |
| **Truck / WO** | Ya decidido | El Next step actúa donde estás; la WO es el único lugar con acciones de Job |

## 3. Qué cambia

### Dashboard

| Hoy | Propuesta |
|---|---|
| Título "Shop Operations" (el menú dice "Dashboard") | "Dashboard" + "Live · updated just now" |
| 7 métricas de 30 px (el tamaño del título) con descripción técnica; en el teléfono llenan la primera pantalla | **4 contadores** que **filtran la cola**: Blocked or paused, Ready to close, Ready to Go, Unassigned. La historia (open, completed today, last 7 days) va en una línea secundaria con enlaces |
| "Needs attention": hasta 8 WOs, en la práctica todas las abiertas "> 24 h"; Ready to Go no aparece | **"Needs you"**: una fila por cada cosa que espera al Manager, agrupada por tipo y en orden. Todo, sin corte en 8 |
| Botones del Next step que llevan al Truck | **La acción se hace en la fila** (ver la tabla de abajo) |
| Blocker repetido dos veces y textarea abierto | Una frase + quién, cuándo y la nota; **Resolve** abre la nota al pedirla |
| "Work requests" aparte, sin "Mark handled" | Grupo **Work requests** al final de la cola, con **Mark handled** y **Open Work Order** |
| (no existe) | **Leaving soon and not ready**: camiones que Dispatch da por salir hoy o mañana con Jobs pendientes |
| Vacío: "No open Work Orders need attention." | "Nothing waiting on you", con la hora: se sabe que no es un fallo |

**Acciones de la cola** (todas actúan en el sitio, con toast al terminar):

| Grupo | Fila | Acción |
|---|---|---|
| Blocked or paused | "<Job> is blocked · <motivo>" + mecánico, hora, nota / "Paused · <motivo>" | **Resolve** (nota opcional) / **Resume** |
| Ready to close | "All N Jobs are done" | **Close Work Order** → el camión pasa a Ready to Go (en la cola y en el Yard) |
| Ready to Go | "Ready to Go · Dispatch: leaves Oct 6" | **Return to Service** → diálogo con motivo opcional |
| Unassigned | "Nobody is assigned to <Job>" | **Assign** → selector con búsqueda |
| Inspection to record | "Arrival inspection not recorded" | **No issues found** / **Issues found**. Con hallazgos lleva al Truck con Add work abierto |
| Waiting for Safety | "Everything else is done" | **Mark QC complete** (respaldo, outline) |
| Work requests | La nota del mecánico | **Mark handled** · **Open Work Order** |

Sin permiso: no hay botones y cada fila dice "Only a Shop Manager can take this step." (hoy
"Resolve" lleva al Truck, donde tampoco se puede).

### Yard Operations

| Hoy | Propuesta |
|---|---|
| Pestañas "Shop readiness" / "Movement (Dispatch)" | **Shop** / **Dispatch** |
| 3 contadores globales (ignoran filtros) + "N paused (blocked) among these trucks" | Los contadores van **en los filtros rápidos** (All, Blocked, Leaving soon, High priority, Out of shop) y una línea "Showing N of M trucks" |
| Filtros Readiness / Phase / Blockers / More filters + **Apply** | Filtros rápidos que se aplican al tocar + búsqueda con placeholder visible ("Truck, Work Order or mechanic"); **Clear** |
| Tablero de 8 columnas con scroll horizontal; 5 vacías | **Carriles por paso** de arriba abajo (1. Inspection … 8. Ready to Go). Los vacíos son una línea "No trucks". Sin scroll horizontal |
| Tarjeta: badge de fase repetido, 12 px, Next step gris, Dispatch en una línea gris | Número del Truck en 16 px; **una línea de alerta en color** (Blocked, Paused, "Leaves Oct 6 · 3 jobs left", Out of shop, "Nobody on <Job>") con borde ámbar; barra de progreso + avatares; sin badge de fase |
| Return to Service: un clic, sin confirmar, error genérico | El mismo **diálogo** que el Dashboard, el Truck y la WO |
| Volver del Truck pierde filtros, búsqueda, vista y pestaña | El enlace al Truck lleva `from` con la query completa; la línea de estado lo dice |
| Sin refresco automático | Se refresca cada 30 s y dice "Live · updated just now" |
| Teléfono: lista por paso | Igual, con grupos plegables; los pasos vacíos se ocultan y se avisa |

**Pestaña Dispatch:**
- "Reported by Dispatch… Dispatch data updated <hora del dato>": la hora del **dato**, no la de
  la consulta.
- **Aviso de contradicción**: "Truck 277: Dispatch says Outside, but it has an open Work Order
  in the shop."
- Tres listas: **Arriving** y **Leaving** (Truck · estado en el taller · fecha; primero los que
  están en el taller; "N jobs left" en ámbar si sale pronto) y **Where Dispatch has them**.
  Cada chip **abre el Truck** y los que tienen WO abierta van marcados.
- Sin datos: "Dispatch didn't answer" con **Try again**. El tablero del taller sigue funcionando.

## 4. Coherencia entre pantallas

- **Blocked** significa lo mismo en todas partes: pausas oficiales **y** blockers de mecánicos
  (D5). Desaparecen "Waiting / Paused" y "paused (blocked)".
- **Return to Service:** un solo diálogo en Dashboard, Yard, Truck y WO.
- **Next step:** la misma regla (LTR-159); el Dashboard la agrupa por tipo de acción.
- "Ready to close" (no "Ready to close WO"); "Ready to Go"; "Leaving soon".

## 5. Mapa a la auditoría

| Hallazgo | Dónde se resuelve |
|---|---|
| UX-5-002, UX-4-002 (lo urgente repartido, ítems largos) | Cola "Needs you" |
| UX-5-003, UX-4-001 (métricas) | 4 contadores que filtran + línea de historia |
| UX-5-004, UX-4-007 (Dispatch aislado) | "Leaving soon and not ready", alerta en la tarjeta, pestaña Dispatch cruzada |
| UX-5-005, UX-6-003 (botones que llevan al Truck; callejón en solo lectura) | Acciones en la fila; sin permiso, sin botón |
| UX-5-006 (volver pierde filtros) | `from` con la query |
| UX-5-008, UX-6-006 (Return to Service distinto) | Diálogo único |
| UX-5-009, UX-6-002 (filtros y contadores) | Filtros rápidos con conteo y "Showing N of M" |
| UX-4-004/005/006 (tablero) | Carriles, alerta en color, sin badge de fase, sin "Apply" |
| UX-6-001 (sin refresco) | "Live" + refresco de 30 s |
| UX-6-007/008 (vacíos y Dispatch sin datos) | Vacíos con lo buscado y "Clear"; "Dispatch didn't answer" + "Try again" |

## 6. Decisiones pendientes (las responde el dueño)

- [ ] **Datos de Dispatch:** ¿son confiables día a día? Si no, "Leaving soon and not ready" y la
      alerta de la tarjeta se ocultan hasta que lo sean. La maqueta los muestra marcados como
      "reported by Dispatch".
- [ ] **Return to Service por lotes:** ¿devolver varios camiones a la vez desde el Yard? La
      maqueta lo hace de a uno.
- [ ] **"Leaving soon":** ¿hoy y mañana (como la maqueta) o los próximos N días?
- [ ] **Inspección desde el Dashboard:** con "Issues found", ¿se registra y lleva al Truck (como
      la maqueta) o solo lleva al Truck?
- [ ] **Bloque Workspaces** (accesos a las pantallas de mecánico para quien tiene ambos roles):
      no está en la maqueta. ¿Se mueve al menú de perfil?

## 7. Plan de implementación

Antes: sincronizar la rama con `main`. Los defectos están en `docs/OPEN_ISSUES.md` §1g.

1. **API** (`apps/api/src/admin/admin.service.ts`, `yard-operations.service.ts`):
   - El Dashboard devuelve la cola completa agrupada por tipo de acción (sin
     `ATTENTION_LIMIT`), con Ready to Go y "inspect".
   - Contadores Blocked (pausas + blockers), Ready to close, Ready to Go, Unassigned.
   - "Leaving soon" cruzando `upcomingDepartures` con las WOs abiertas.
   - Yard: contadores **con el filtro aplicado**; filtros sobre la WO abierta (no las cerradas);
     `chip` = blocked | soon | high | out.
2. **Componentes compartidos** (de las propuestas de WO y Truck): Next step con acción, diálogo
   de Return to Service, selector de mecánico, fila con borde ámbar y avatares.
3. **Dashboard** (`admin-dashboard.tsx`, `admin-work-order-item.tsx`): contadores que filtran, cola
   por grupos, Work requests con "Mark handled", "Leaving soon".
4. **Yard** (`admin-yard-operations.tsx`):
   - Carriles; tarjeta con alerta y sin badge de fase.
   - Filtros rápidos en la URL.
   - `adminTruckHref(id, pathname + search)`.
   - `refreshInterval: 30_000` en `useAdminYardOperations`.
   - Dispatch con la hora del dato, el aviso de contradicción y los chips como enlace.
5. **Textos** en EN y ES (`admin-messages.ts`, `yard-data-boundary-copy.ts`); "Data unavailable"
   en sentence case.
6. **Docs:** `SYSTEM.md` §6, `USER_FLOWS.md` HU-M7 (el orden de la cola) y
   `reference/YARD_DATA_BOUNDARY.md` ("Dispatch status").
7. **Verificar:**
   - `npm run lint` y `npm test`.
   - e2e `admin-shell.spec.ts` (título "Shop Operations" y los enlaces de las métricas
     **cambian**), `ui-consistency.spec.ts` (aria-label de las métricas), `yard-operations.spec.ts`
     (pestañas, filtros, Board/List **cambian**), `yard-work-plan-board-cutover.spec.ts`.
   - `npm run ui-audit` y `npm run test:real`.

**Selectores que deben seguir:** `yard-truck-card`, `yard-card-next-step`, `yard-card-dispatch`,
`yard-card-out-of-shop`, `yard-data-boundary-*`, `yard-movement-source`,
`work-order-next-step` (+ `data-kind`), `attention-reason`, `admin-blocker`.

## 8. Notas de la maqueta

- Los datos son de demostración, inspirados en los de producción del 2026-10-05.
- "Opens Truck X" o "Opens Work Order" son avisos: la maqueta no navega fuera de las dos
  pantallas.
