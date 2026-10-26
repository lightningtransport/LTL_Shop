# Inventario: dónde queda cada cosa y qué se podría romper

**Estado:** propuesta, parte de [`README.md`](README.md). Revisa **todo** lo que la app hace hoy (menú,
Dashboard, Work Order, mecánico, PM, Safety, Parts & costs, Setup) contra la arquitectura nueva, para
que nada quede sin lugar ni roto. Leído de `origin/main` `0e2f46a`.

**Regla:** lo que no está en la pizarra sigue en su pantalla de hoy, con la misma ruta. No se borra
ninguna ruta.

---

## 1. Menú del Manager (15 entradas hoy, `admin-shell.tsx:20-53`)

| Hoy | Dónde queda | Cambia |
|---|---|---|
| Dashboard `/admin` | **Board** (inicio). Su cola "Needs you" pasa a la franja "Needs your decision" (§2) | Pantalla nueva; el Dashboard de hoy queda en `/admin/dashboard` hasta que se apruebe la pizarra |
| Yard Operations → Shop | Board → **By truck** (el Kanban de hoy, igual) | Solo el lugar |
| Yard Operations → Dispatch | **Arrivals** (entrada propia) | Misma fuente y reglas (D50, D51) + `returns` (RP-5) |
| Yard → Full screen (TV, D53) | Board → Full screen | La TV muestra la pizarra; "By truck" sigue disponible |
| Work Orders (lista y detalle) | Lista: More → **Visits**. Detalle: **Visit details**, desde la tarjeta y desde el camión | Solo el nombre (P45). El detalle conserva **todas** sus acciones (§3) |
| Trucks (lista y ficha) | **Trucks**. La ficha suma arriba "Can it leave?" | Costs, Faults, Tires e historial siguen en sus pestañas |
| Purchases, Outside repairs, Parts, Vendors, Internal invoices | More → **Parts & costs** | Nada |
| People, Jobs, Shop workflow, Inspection checklist, Samsara, Shop rates | More → **Setup** | Nada. Shop workflow pasa a ser **la especialidad** de cada mecánico (sus equipos) |
| `/qc` (respaldo del Manager, D29) | Columna QC de la pizarra → "Open Quality Check" | Solo la entrada |

**Menú nuevo:** Board · Arrivals · Trucks · More (Visits, Parts & costs, Setup).

---

## 2. Cola "Needs you" del Dashboard → franja "Needs your decision"

Cada grupo de hoy (`lib/dashboard-queue.ts:18-29`) tiene un lugar. La franja muestra **solo los
contadores que no están en cero**, para no volver a una lista larga.

| Grupo de hoy (siguiente paso) | En la pizarra |
|---|---|
| `resolve_blocker` | Contador **Blocked** + tarjeta ámbar con Resolve |
| `resume` (pausa oficial del Manager) | Contador **Paused** + todas las tarjetas del camión dicen "Paused · motivo" con Resume |
| `inspect` | Columna **Inspection** |
| `add_missing_steps` | Desaparece con las plantillas. Queda solo para las WOs abiertas antes del cambio |
| `assign` | Casi desaparece (todo nace Available). Lo que nadie toma: contador **Not taken > 1 day** |
| `external` | La tarjeta en su columna dice "At outside shop · Part out / Truck out", con Returned |
| `qc` | Columna **QC** |
| `close` + `return_to_service` | Contador **Ready to release** → Release truck (una sola acción) |
| `cancel_work_order` (nada hecho, D55 R15) | Contador **Nothing done** → Cancel visit |
| Llegadas sin WO (LTR-261) | Contador **Arrived without a visit** → Arrivals |
| Sale pronto y no está listo | Badge "Leaves Tue" en las tarjetas + filtro |
| Hallazgos de Safety (SQ-3) | Con Job sugerido: nacen Available (P54). Sin Job: contador **Safety findings** |
| Pedidos de trabajo del mecánico (D8) | Contador **Work requests** → Add to visit / Mark handled |
| Salió de la yard sin Return to Service (D52) | Contador **Ready to release**, con "Left the yard" |

---

## 3. Acciones de un Job y de la visita (detalle de la WO de hoy)

Todas se quedan en **Visit details** (`admin-job-table.tsx:190-211`). Las frecuentes también salen en
el menú de la tarjeta de la pizarra.

| Acción | Tarjeta (pizarra) | Visit details |
|---|---|---|
| Assign / unassign | Sí | Sí |
| ★ prioridad | Sí | Sí |
| Resolve blocker | Sí | Sí |
| Add helper (D23) | — | Sí |
| Send to outside shop / Returned (D24) | — | Sí |
| Parts… (stock, compra, llantas a confirmar; D45, D47) | — | Sí |
| Add outside repair invoice | — | Sí |
| Cancel / Reopen Job | — | Sí |
| Mark QC complete (respaldo) | Columna QC → `/qc` | Sí |
| Pause / Resume, Cancel / Reopen visit, Correct time, notas, historial | — | Sí |

---

## 4. Mecánico, PM y Safety

| Hoy | Queda |
|---|---|
| To inspect (D41) | Arriba de "My work" en la pantalla nueva, solo para quien tiene el permiso |
| Team queue + Available in the shop | **Available for me** (una sola lista) |
| In progress / Ready to start / Blocked / Waiting on manager / Paused | **My work**, con el estado en la tarjeta |
| Aviso "tap Continue" (cierre del día, otro camión; D20, D21) | Igual, arriba de My work |
| Job de ayudante (D23) | En My work, con "· helper" |
| Notas y Request work (D8) | Igual, en el detalle del camión del mecánico |
| Pestañas Completed y Trucks (D-MG1) | Igual |
| PM (Waiting for PM, millaje, partes, Finish) | **Igual** (dueño, 2026-10-26) |
| Safety `/qc` | Igual, más **Coming** ([task flow](task-flow-safety.md)) |

---

## 5. Lo que se rompería si no se ajusta (y ya está en el plan)

Lo encontré revisando reglas que hoy dependen de los 4 pasos fijos. Cada uno queda dentro de su parte.

| # | Qué se rompería | Por qué | Arreglo | Parte |
|---|---|---|---|---|
| R-1 | **El 705 no se podría liberar** | D55 R2: una visita no se cierra sin inspección, salvo con motivo (`INSPECTION_NOT_DONE`) | Si la visita dice "Inspection · Not required · motivo", eso cuenta como el motivo | RP-1 |
| R-2 | **"Add missing steps"** pediría los pasos que la plantilla quitó | `resolveMandatoryJobs` y el siguiente paso `add_missing_steps` | La visita guarda qué no aplica; el paso solo sale en WOs viejas | RP-1 |
| R-3 | **El QC no se puede cancelar** | D55 R9 (`admin.service.ts:1710`) | Solo "Not required" del Manager, con motivo (P46) | RP-1 |
| R-4 | **Siguiente paso y fase del Yard** sin lugar para "QC to decide" | `truck-next-step.ts`, `yard-work-plan-derivation.ts`; el test de contrato A19 exige que todas las pantallas digan lo mismo | Nuevo paso `decide_qc` antes de `close`, en las dos derivaciones y en A19 | RP-1 |
| R-5 | **Create PM service** crearía Alignment, Detailing y QC que nadie pidió | `createOrJoinPm` llama los pasos obligatorios | Visita "Other" solo con el PM (P53) | RP-1 |
| R-6 | **Detailing compartido** no puede completar lo que empezó otro | `work-orders.service.ts:1303` (solo el dueño) y D21 (un reloj por persona) | Trabajo de equipo solo en Detailing (P50–P52) | RP-2 |
| R-7 | **Las pruebas e2e del navegador** buscan pantallas y `data-testid` de hoy | Playwright (10 ya fallan en `main`, LTR-241) | Se actualizan las de las pantallas que cambian, en el mismo PR | RP-2, RP-3 |
| R-8 | **El Dashboard de hoy** dejaría de ser el inicio de golpe | Cambio de hábito | La pizarra nace en una ruta nueva; el inicio cambia cuando el Shop Manager la apruebe | RP-3 |

---

## 6. Lo que **no** se toca y sigue igual

- **Parts & costs:** compras, reparaciones externas, stock, llantas, partes del PM, facturas internas,
  tarifas. No dependen de los pasos fijos.
  - "Release truck" cierra la visita igual que hoy. Por eso la mano de obra (D34) y el cobro del PM y
    del aceite (ST-5) se escriben en el mismo momento.
  - Un PM "Not required" es un Job cancelado: no descuenta stock ni cobra aceite, igual que hoy.
- **Samsara:** sincronización, fallas como Jobs sugeridos (en Open visit / Add work), presencia en la yard.
- **Inspección (D41):** la hoja, las llantas, Setup.
- **Personas, catálogo, Custom Jobs, horarios.**
- **El esquema de la base:** RP-1 a RP-3 no necesitan migración. Las llaves (RP-7) sí.
- **La demo local:** sigue congelada (OPEN_ISSUES); no se actualiza hasta que el dueño lo pida.

## 7. Lo que queda por decidir aquí

- **P45:** si "Visit" reemplaza "Work Order" en todas las pantallas, incluidas Costs y facturas (WO-026
  → Visit 026), o solo en las del día a día. Recomendación: en todas, para no tener dos nombres.
