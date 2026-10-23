# Propuesta: áreas en paralelo, un camión a la vez, tread en el mínimo y card de Tires (D57)

**Estado (2026-10-22): decidida por el dueño, sin construir.** El dueño trabajó el camión 911 en iPad el 2026-10-22, anotó lo que no entendió y después lo habló con el Shop Manager. Las respuestas de los dos están en §2 y son **D57** en [`DECISIONS.md`](../../DECISIONS.md). Las etapas AP-1 a AP-7 (§5) se construyen una por PR.
**Origen:** fotos del 911 en iPad (WO-026, Work Plan del camión y card de Tires) y la conversación con el Shop Manager.
**Linear:** Epic LTR-299. Etapas: AP-1 LTR-300, AP-2 LTR-301, AP-3 LTR-302, AP-4 LTR-303, AP-5 LTR-304, AP-6 LTR-305, AP-7 LTR-306.
**Fecha:** 2026-10-22 · **Rama:** `claude/truck-911-inspection-order-569a5d` (solo documentación).
**Pantallas:**
- Work Order del Admin, tabla Jobs (`apps/web/src/components/admin-job-table.tsx`, orden en `apps/web/src/lib/work-order-jobs.ts`)
- Truck del Admin, Work Plan y card Tires (`apps/web/src/components/admin-truck-work-plan.tsx`, `apps/web/src/lib/truck-stepper.ts`, `apps/web/src/components/truck-tires-card.tsx`)
- Hoja de inspección y Setup → Inspection checklist (`apps/web/src/components/inspection-sheet.tsx`, `apps/web/src/components/admin-inspection-checklist.tsx`, regla en `packages/shared/src/inspection.ts`)
- Yard Operations, tablero Shop (`apps/web/src/components/kanban.tsx`, fase en `apps/api/src/admin/yard-work-plan-derivation.ts`)
- Apps de mecánico General y PM (colas D28, `apps/web/src/app/work-orders/[id]/detail-client.tsx`)
- Siguiente paso (`packages/shared/src/truck-next-step.ts`, `apps/web/src/components/work-order-next-step.tsx`)

## 1. Lo que vio el dueño y lo que hay hoy

Leído del código en `origin/main` `6d53e24`. Clases: **B** bloquea · **C** confunde · **E** cosmético.

| # | Lo que vio | Hoy, en el código | Clase |
|---|---|---|---|
| H1 | En la WO-026 los Jobs salen PM, Alignment, Detailing, Tires, Flat Repair, Mirrors, Quality Check: "el problema es el orden y la agrupación" | La tabla no tiene orden propio. El API los manda por `addedAt` (`work-order.mapper.ts:545`, sin desempate por id) y la web solo mueve bloqueados arriba, externos después y QC al final (`work-order-jobs.ts:9-26`). PM, Alignment y Detailing nacen al abrir la WO (D13) y por eso van primero; Tires, Flat Repair y Mirrors nacen al guardar la inspección y van después | C |
| H2 | Tires y Flat Repair deberían estar con Alignment, "eso lo ve el mecánico de Alignment" | D54 §3 ya dice que los hace el mecánico de Alignment y el API se los asigna a ese equipo (`inspection.service.ts:428-458`). Pero el **área** la decide `classifyWorkPlanLane` por categoría ("Tires & Wheels" → Shop Work, `yard-work-plan-derivation.ts:106-134`) y no mira a quién se asignó. En el Work Plan y en el Yard salen en Shop Work | C |
| H3 | El Work Plan del camión "tiene más lógica": Inspection, Shop Work, PM, Alignment, Detailing, QC. ¿Detailing antes del QC? | SYSTEM §5: "el orden **se muestra, no se obliga**". Las pantallas lo dibujan como pasos 1 a 7 aunque nadie trabaja así. El orden está copiado a mano en cinco lugares (`TRUCK_STEPS`, `FLOW_ORDER`, `deriveWorkPlan`, `WORK_PLAN_YARD_PHASES`, enum `WorkPlanPhase`). `shop_workflow_steps.sort_order` existe, pero solo ordena cómo se insertan los Jobs obligatorios y nadie lo edita | E |
| H4 | "Los treads no queda claro cuándo se convierten en Job, no importa qué número escriba" | Regla en `tireReadingStatus` (`packages/shared/src/inspection.ts:113-125`): Job solo **por debajo** del mínimo (steer 3/32 o menos; drive 1/32 o menos). **Justo en el mínimo (4/32 steer, 2/32 drive) es Watch, sin Job.** Watch son las 2/32 por encima (`TIRE_TREAD_WATCH_MARGIN = 2`, fijo, no se edita ni se muestra). La hoja solo dice "Tread · min 4/32"; Setup dice "tread 2/32 above the minimum" sin números. En el 911: LF y RF a 3/32 crearon Job por tread (100 PSI es solo 9 % bajo, OK); RFI a 4/32 quedó en Watch. D54 §4 trae un ejemplo equivocado ("LRO · tread 3/32 (min 4)": LRO es drive, mínimo 2) | B |
| H5 | "La card de Tires me parece confusa, no muestra la información eficientemente" | `MiniTires` (`inspection-sheet.tsx:891-923`): cada chip muestra **solo PSI**, sin tread ni objetivo; el ícono de Fix es un `OctagonAlert` de 10 px que se lee como "i"; no hay leyenda; "3/10 OK" con 10 fijo; los chips son `<span>` a mano y no `Badge` (`docs/design-system/components.md` lo prohíbe). La lista de abajo repite PSI y tread sin decir cuál es Job y cuál Watch | E |
| H6 | En la fila del Job de la WO: "Tire LF: 100 PSI (target 110) · tread 3/32" sin decir por qué | La nota del Job la arma `inspection.service.ts:299` sin motivo. El mecánico sí ve "LF · tread 3/32 (min 4) · worn, replace" (D54 §4, `locale-context.tsx:808-811`) | C |
| H7 | "7 Jobs left · next: Tires" | `deriveTruckNextStep` ordena por `FLOW_ORDER` con Shop Work primero (`truck-next-step.ts:74-81`); Tires es el primer Job de Shop Work | E |
| H8 | El pill "Tires · 3 to confirm" se lee como "3 llantas mal" | Son dos cosas: el pill cuenta las **llantas propuestas del stock** por confirmar (D45/D47, `admin-job-table.tsx:367-385`); el estado de cada llanta (OK/Watch/Job) está en la card del camión. Se ven igual y no se explican | E |

## 2. Lo que dijo el Shop Manager y decidió el dueño (2026-10-22)

1. **Inspección primero, Quality Check último.** Eso no cambia (D19, D41, D55).
2. **En el medio no hay orden.** PM, Alignment, Detailing y los defectos de la inspección son obligatorios, pero se hacen según el día: un camión puede ir PM → Alignment → Detailing y otro Alignment → PM → Detailing. "Así el shop no para."
3. **El camión lo tiene una sola área a la vez.** El mecánico que toca Start en un Job "se lleva" el camión: mientras lo tenga, a los demás mecánicos ese camión **no les aparece**. Cuando termina su Job, el camión vuelve a quedar disponible y cualquiera de las áreas que falten lo toma.
4. **Tires y Flat Repair son del área Alignment.** Ahí está la máquina de llantas (D54 §3).
5. **Tread: en el mínimo ya se cambia.** 4/32 steer o 2/32 drive crea el Job Tires. Watch queda para las 2/32 por encima.
6. **Los mecánicos generales toman solos los defectos.** Los Jobs sin dueño del área Shop Work aparecen en la app del mecánico general y el primero que los toma queda como dueño, como las colas de D28. El Manager sigue pudiendo asignar.
7. **No se construye reordenar etapas.** Con 2 no hay orden que configurar.

## 3. Propuesta

### 3.1 Un solo orden, escrito una vez

`WORK_AREAS` en `packages/shared`:

```
inspection → [ pm · alignment · shop_work · detailing ] (sin orden entre sí) → quality_check → close
```

Lo leen el Work Plan del camión, la tabla de la WO, el Siguiente paso, el tablero del Yard y `deriveWorkPlan`. Desaparecen las cinco copias. El orden del corchete es solo para pintar; no significa "primero" ni "después".

### 3.2 El área de un Job

`classifyWorkPlanLane` suma dos reglas antes de caer en Shop Work:

1. Un Job con `workflowStepKey` (cola de un equipo, D28) está en **esa** área.
2. Un Job de la categoría **Tires & Wheels** está en **Alignment** (D54 §3).

Lo demás sigue igual: PM por categoría, Detailing por nombre, QC por clave. Los Jobs ya creados cambian de área al instante (el área se calcula, no se guarda).

### 3.3 Quién tiene el camión

Calculado en el API, nunca guardado (`truckHolder`):

- **Lo tiene** el mecánico cuyo Job de esa WO está empezado (Start o Continue) y no está completado, bloqueado ni en taller externo. El cierre de las 5 p.m. (D20) **no** lo suelta: al día siguiente sigue siendo suyo hasta que lo termine o lo bloquee.
- **Lo suelta** completar el Job (D18), bloquearlo (D17) o mandarlo a taller externo (D24).
- **Excepciones:** el ayudante de ese mismo Job (D23) trabaja con él. Safety toma el QC solo con todo hecho (ya es así, D55).
- **Regla del API:** Start o Continue en un Job de un camión que tiene otro mecánico → 409 `TRUCK_BUSY` con quién lo tiene. Vale para Jobs ya asignados: "Tus Jobs" muestra el camión con **"With Daniel · PM · wait"** y el botón apagado.
- **Colas** (D28 y la nueva de Shop Work): no muestran los camiones que alguien tiene; los muestran al soltarse.

### 3.4 Work Plan del camión

- **Inspection** arriba, como hoy (paso con fecha, "View report", "Add defects").
- Un bloque **"Shop areas · any order, one at a time"** con cuatro grupos sin número: **PM · Alignment · Shop Work · Detailing**. Cada grupo: nombre, "N pending" o "Done", el equipo (D28), y los Jobs con mecánico, estado y enlace a la WO. El grupo que tiene el camión lleva el chip **"Daniel is here"** (variante `default` con punto). Tires y Flat Repair salen bajo Alignment.
- **Quality Check** y **Close Work Order** abajo, como hoy.
- Componentes: `SectionCard` + `SectionBlock` + `CountChip` + `Badge`; sin card dentro de card; `.group-title` 14 px para cada área; nada bajo 12 px.

### 3.5 Tabla de Jobs de la Work Order

Misma agrupación que el Work Plan, con una fila de encabezado por área (`.group-title`, fondo `sunken`): **PM · Alignment · Shop Work · Detailing · Quality Check**. Dentro de cada área: bloqueados primero, luego por `addedAt`, el ayudante bajo su Job, los de taller externo al final del área. QC siempre último. Hechos y cancelados aparte, igual que hoy. El API agrega desempate por `id` al `orderBy`.

Para el 911 queda: **PM** → PM A Service · **Alignment** → Alignment, Tires, Flat Repair · **Shop Work** → Mirrors · **Detailing** → Detailing · **Quality Check** → Quality Check.

### 3.6 Tread y PSI: la regla con números

- `reading.tread <= minTread` → **Job** (Tires). `reading.tread < minTread + margen` → **Watch**. Lo demás OK. PSI sigue igual (Watch a ±10 %, Job a ±20 %, Flat Repair).
- El margen pasa a `inspection_settings.tread_watch_margin` (migración, valor 2) y se edita en **Setup → Inspection checklist → Tires** junto a los otros seis números.
- **Las lecturas guardadas no se reclasifican:** cada `tire_reading` guarda su `status`. Una inspección vieja con 4/32 sigue diciendo Watch.
- **Los números se ven**, calculados de los límites, en los tres lugares:
  - Diálogo de la llanta: "Tread · **Job at 4/32 or less · Watch 5–6/32 · OK from 7/32**" (steer) y "Job at 2/32 or less · Watch 3–4/32 · OK from 5/32" (drive). El badge vivo sigue ("Fix — creates a Job").
  - Leyenda bajo el diagrama de la hoja: una línea por eje con los mismos números.
  - Setup: la fila Tires muestra la tabla OK / Watch / Job por eje al lado de los campos.
- D41 §7 pasa a decir "en el mínimo o por debajo crea Job; Watch hasta N/32 por encima (editable)". D54 §4 corrige el ejemplo a "RRO · tread 1/32 (min 2) · worn".

### 3.7 Card Tires del camión

- **Chip por llanta** con PSI **y** tread: `100 · 3/32`, hecho con `Badge` (`success` / `warning` / `destructive` + ícono `Check` / `Eye` / `OctagonAlert` a 12 px; nunca solo color). En táctil ≥ 44 px de alto; en el iPad caben las 10 en las tres filas Steer / Drive 1 / Drive 2.
- **Leyenda** debajo del diagrama, la misma de la hoja: `OK` · `Watch (no Job)` · `Job`.
- **Encabezado:** "Tires · 3/10 OK" con `tires.length`, no 10 fijo.
- **Lista** agrupada por estado y con el motivo, con el mismo formateador que ve el mecánico:
  - **Job:** LF 100 PSI · 3/32 (min 4) · worn — RF … — RRI 158 PSI (should be 95) · high pressure
  - **Watch:** RFI 111 PSI · 4/32
- Pie igual: "Checked Oct 22 by Crixcrox · previous Sep 30" y el bloque "Mounted" (D45).

### 3.8 Fila del Job en la Work Order

- La descripción del Job Tires / Flat Repair usa el formateador del mecánico (`tireFindingReason`): "LF · tread 3/32 (min 4) · worn", "RRI · 158 PSI (should be 95) · high pressure". Una línea por llanta.
- El pill **"Tires · 3 to confirm"** (D47) se queda, con `title`/aria "3 tires proposed from stock · confirm in Parts…". En el teléfono, al tocarlo abre Parts… como hoy.

### 3.9 Siguiente paso y tablero del Yard

- **Siguiente paso** (Dashboard, Truck, WO, Yard): si alguien tiene el camión, "**Daniel is on PM A Service** · Alignment, Detailing and 1 repair left"; si nadie, "**Waiting for a mechanic** · Alignment, Detailing and 1 repair left", con **Assign** si hay Jobs sin dueño (D26).
- **Tablero Shop del Yard** (D33, D53): la columna dice **dónde está el camión ahora**:

  | Columna | Camiones |
  |---|---|
  | Inspection | Sin inspección |
  | **Waiting for a mechanic** | En el shop y nadie lo tiene. La tarjeta lista lo que falta como chips: `PM ✓` `Alignment` `Detailing` `2 repairs` |
  | PM · Alignment · Shop Work · Detailing | Alguien lo tiene. La tarjeta dice "Daniel · PM A Service" y, pasadas 24 h sin tocar, "since yesterday" en ámbar |
  | Quality Check | Todo hecho, espera a Safety |
  | Ready to close · Ready to Go | Igual que hoy |

  Son 9 columnas (hoy 8). En la app siguen como Trello (288 px, scroll lateral); en la TV (`?display=board`) caben a ~213 px. `WorkPlanPhase` suma `waiting_for_mechanic`. Los filtros, Full screen y la lista plegable del teléfono no cambian. El Dashboard agrupa igual, con "Waiting for a mechanic" arriba.

### 3.10 Cola de Shop Work para mecánicos generales

Los Jobs sin dueño del área Shop Work (defectos de la inspección, pedidos de Safety, Add work sin asignar) aparecen en la app del mecánico general bajo **"Available in the shop"**, igual que las colas de D28: Take lo hace dueño, Release lo devuelve; el camión que alguien tiene no se muestra (§3.3). El Manager sigue asignando directo. Internamente es `workflowStepKey = shop_work` con capability `MECHANIC_STANDARD`; si hace falta una fila en `shop_workflow_steps` se decide al diseñar AP-6.

## 4. Reglas (D57)

1. Inspección primera, Quality Check último (D19, D41, D55 siguen).
2. PM, Alignment, Shop Work y Detailing son **áreas sin orden entre sí**. No se reordenan ni se bloquean entre ellas. Un área sin Jobs vivos es "no aplica", como hoy.
3. **Un camión lo tiene una sola área a la vez.** Quien empieza un Job se lo lleva; completar, bloquear o taller externo lo sueltan; el ayudante de ese Job está exento. El API lo frena (`TRUCK_BUSY`).
4. **Tires y Flat Repair son del área Alignment** (amplía D54 §3). Un Job con cola de equipo está en el área de ese equipo.
5. Los Jobs sin dueño de Shop Work tienen **cola** para mecánicos generales (amplía D28). El Manager sigue asignando.
6. **Tread en el mínimo o por debajo crea el Job Tires**; Watch hasta N/32 por encima, N editable en Setup (cambia D41 §7). Las lecturas guardadas no cambian.
7. Reemplaza en SYSTEM §5 la secuencia "Inspection → Shop Work → PM → Alignment → Detailing → …" por las áreas.

## 5. Etapas de construcción

Una rama y un PR por etapa. Cada PR trae `SYSTEM.md` y `USER_FLOWS.md`; un push por PR (Vercel Hobby). "Funciona" = `test:real` verde.

| Etapa | Qué | Linear | Migración | Pruebas |
|---|---|---|---|---|
| **AP-1** | `WORK_AREAS` único; Tires & Wheels y `workflowStepKey` → área; Siguiente paso con "areas left" | LTR-300 | No | `yard-work-plan-derivation.spec`, `truck-next-step.spec` (shared y web), A3 (manager-plan), A152/A153 (inspection), `harness.ts laneOf`, e2e orden de columnas del Kanban |
| **AP-2** | Work Plan del camión y tabla de la WO agrupadas por área (§3.4, §3.5); desempate por `id` en el API | LTR-301 | No | `work-order-jobs.spec`, `truck-stepper.spec`, e2e `admin-truck-work-plan`, `admin-truck-detail`, `admin-work-order`; tablet walk iPad |
| **AP-3** | Tread en el mínimo; `tread_watch_margin` en Setup; números a la vista (§3.6); D41 §7 y D54 §4 | LTR-302 | **Sí** → Release safety al mergear | `inspection.spec.ts` (nuevos casos 4/32 steer = fix, 5/32 = watch), filas HU-M16, e2e inspección y Setup |
| **AP-4** | Card Tires y descripción del Job con motivo (§3.7, §3.8) | LTR-303 | No | e2e truck detail y WO; `mobile-ui-check` iPad ~980 px y iPhone |
| **AP-5** | Docs: SYSTEM §5 y WO, USER_FLOWS HU-M16/HU-ME7, glosario (áreas, "Waiting for a mechanic") | LTR-304 | No | `git diff --check` (se reparte en cada PR) |
| **AP-6** | Cola de Shop Work para mecánicos generales (§3.10) | LTR-305 | Probable | filas nuevas tipo cola (Take, Release, el Manager asigna encima), e2e home del mecánico, tablet walk |
| **AP-7** | Un camión a la vez: `truckHolder`, `TRUCK_BUSY`, colas y "Tus Jobs" lo respetan, columna "Waiting for a mechanic", fase nueva, tarjeta del Yard con quién lo tiene / qué falta, Dashboard y Siguiente paso (§3.3, §3.9) | LTR-306 | No (se calcula de las sesiones) | filas nuevas: dos mecánicos en un camión → `TRUCK_BUSY`; completar lo suelta; bloquear lo suelta; el ayudante pasa; cierre de las 5 p.m. no lo suelta. e2e Kanban 9 columnas y TV, home del mecánico |

**Orden:** AP-1 → AP-2. AP-3 y AP-4 en paralelo con AP-2 (archivos distintos). AP-6 y AP-7 después de AP-1. AP-7 es la más grande y toca el tiempo (D18–D21): la construye la sesión principal.

## 6. Agentes, skills y modelos

Para no malgastar tokens y cerrar cada etapa en un loop hasta verde:

- **Fable 5.1 (sesión principal):** lo que decide reglas o toca el esquema: `classifyWorkPlanLane`, `tireReadingStatus`, la migración, `truckHolder` y `TRUCK_BUSY`, la revisión final del diff.
- **Sonnet 5.5 (subagentes `general-purpose`):** lo mecánico y repetible: catálogos de texto EN/ES (`admin-messages-catalog.ts`, `inspection-copy.ts`, `locale-context.tsx`), actualizar specs y filas de `test:real`, e2e, `SYSTEM.md` / `USER_FLOWS.md`, la maqueta.
- **Haiku 5.5 (`Explore`):** localizar usos antes de tocar, `git diff --check`, formato.
- **Skills:** `mobile-ui-check` (tablet walk iPad ~980 px + iPhone) en AP-2, AP-4 y AP-7 antes del PR; `code-review` (medium) en cada PR; `audit-ux-4-jerarquia-y-claridad-visual` solo si la card de Tires o la tarjeta del Yard no convencen a la primera.
- **Loop por etapa:** construir → unit + `npm run test:real --workspace=@ltl-shop/api` + e2e → `mobile-ui-check` → `/code-review` → corregir → repetir. **Corte:** todo verde, docs en el mismo PR, captura de iPad en el PR, un push.

## 7. Preguntas abiertas (para el dueño y el Shop Manager)

- **P39** Si Safety devuelve el camión y vuelve al shop después del Detailing, ¿la app ofrece reabrir Detailing? Hoy el dueño lo pidió como duda; en v1 el Manager agrega un Detailing nuevo con Add work.
- **P40** ¿El área "Shop Work" se llama **"Repairs"** para el Manager? Hoy mezcla defectos de la inspección, hallazgos de Safety y pedidos.
- **P41** ¿El Manager puede dejar que dos áreas trabajen el mismo camión a la vez (override con motivo)? **v1: nunca.**
- **P42** Un camión que alguien tiene desde ayer y no ha vuelto a tocar Continue, ¿sigue tomado? **v1: sí**, hasta completar o bloquear; el Manager lo ve en la columna del área con "since yesterday" en ámbar y puede bloquear el Job para soltarlo.

## 8. Qué no cambia

- D11: cada Job tiene un solo dueño. D28: las colas por equipo. D18–D21: el reloj por persona, uno a la vez.
- D19 y D55: el QC lo hace Safety, no se cancela y no se aprueba con trabajo pendiente.
- D47: las llantas propuestas viven dentro de "Parts…" del Job Tires.
- D41: Watch no crea Job; una inspección guardada no se edita.
- Las lecturas de llantas ya guardadas y su estado.
- El Yard dentro de la app sigue como Trello (D33) y la TV entera en pantalla (D53).

## 9. Cómo ver la maqueta

```bash
python3 -m http.server 4459 --bind 127.0.0.1 --directory docs/proposals/areas-en-paralelo
```

Abrir `http://127.0.0.1:4459/mockup.html`. HTML estático con Tailwind por CDN y los datos del 911; claro y oscuro; iPad y teléfono con el botón de ancho.
