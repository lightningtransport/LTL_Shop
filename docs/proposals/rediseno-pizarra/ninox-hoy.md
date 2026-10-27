# Ninox hoy: qué muestra, qué se puede obtener y qué cambia en el rediseño

**Fecha:** 2026-10-26. **Fuente:** 5 capturas de Ninox que mandó el dueño:
- Bay Shop del 830
- Mechanics Work
- Kanban de TrucksDB
- Overview del 843
- Bay Work

**Página para validar con el manager:** [`validacion-hoy.html`](validacion-hoy.html). Pone los datos
de esas capturas en la versión resumida. **No es la app en vivo:** los datos están copiados de las
capturas a mano, y lo que la captura corta no se inventa.

**Marcas:**
- ✅ = comprobado (código, diccionario de datos o la captura misma).
- ⚠️ = supuesto o interpretación.

---

## 1. Lo que dijo el dueño (2026-10-26)

1. **PM o Fuel filter.**
   - **PM** (aceite y filtros) si el camión lleva **40,000 millas o más** desde el último PM.
   - **Fuel filter** solo, si tiene menos.
   - Debe ser automático cuando haya registros. Si Ninox no los tiene, los lleva la app.
2. **Detailers.**
   - No escriben ni eligen su nombre.
   - Solo marcan qué camión empezaron y cuándo terminaron.
   - Pueden tener varios camiones a la vez.
   - No hace falta saber quién lo hizo.
   - **Esto cierra P50, P51 y P52.**
3. **Mostrar los mismos datos y opciones de Ninox donde corresponda.** Por ejemplo, el Check in del
   camión ("cuando llega y tienen las llaves", según el dueño ⚠️), el Kanban y el trabajo de los
   mecánicos.
4. **Validar con el manager usando la información del día.**

---

## 2. Qué muestra cada pantalla de Ninox y de dónde podría salir

**Fuentes posibles:**
- **(A)** agent-reporting, la copia de Ninox en Supabase que la app **ya lee**: reportes `trucks`,
  `driver_pay`, `returns`, `out_schedule` y otros (`lightningtransport/data-reporting-kit`,
  `docs/data-dictionary.md`).
- **(B)** "shares" de Ninox sin contraseña, que el negocio ya aprobó (camiones off duty, camiones en
  la ruta).
- **(S)** Samsara, ya conectado.
- **(App)** lo registra la app.
- **(—)** no hay forma de obtenerlo hoy.

### Kanban (TrucksDB)

| Dato | Fuente | Nota |
|---|---|---|
| Estado: Checked In · Work in Progress · Heavy Work No ETA · Ready for Q.C. · Q.C. · Ready To Go | **(A)** `trucks.mechanic_status` ✅ | Columna Ninox `E.TA` ("OutWork" en Bay Shop). La app guardó una copia **una vez** (`ninox_mechanic_status`) y no la vuelve a leer. P4 seguía abierta |
| Ubicación (301 Yard, Outside) | **(A)** `trucks.yard_location` ✅ | Texto que escribe Dispatch. D50 ya lo cita junto a Samsara |
| Días en la yard | **(B)** share off duty, `Days In Yard` en milisegundos ✅ · **(S)** "In yard since" (D49) ✅ | Samsara da la hora de entrada; el share de Ninox da los días |
| Grupo (Group 1 / 2) | **(A)** `trucks.dispatcher` ✅ | Ya está en la app |

### Bay Work

| Lista | Fuente | Nota |
|---|---|---|
| View: camión + millas desde el último PM | **(—)** ⚠️ | No está en el diccionario. Vive en Bay Shop → PM Information |
| Alignment, Detail | **(—)** ⚠️ | Parecen camiones con ese trabajo **pendiente** (interpretación: el 830 dice "Alignment Done" y no está en la lista). Validar |
| Return Schedule + millas desde el último PM | **(A)** `returns` y `driver_pay` (fecha) ✅ · millas **(—)** | Es la lista de llegadas. La app lee `driver_pay` a propósito (LTR-254). Lo que no coincide viene de la copia atrasada en Supabase (PR 435) |

### Mechanics Work

| Dato | Fuente | Nota |
|---|---|---|
| Qué camión tiene cada mecánico y si está trabajando | **(—)** en Ninox · **(App)** ✅ | En la app sale solo de Take y Start del mecánico (D11, D18). No hace falta traerlo de Ninox |
| Nombres: Alejandro 1, Daniel (PM), Alejandro 2, John, Anthony, Elliot | Captura ✅ | Sirve para armar los equipos (pregunta 15 del Shop Manager). Falta la especialidad de cada uno |

### Bay Shop (830)

| Dato | Fuente | Nota |
|---|---|---|
| Odómetro | **(A)** `trucks.odometer_miles` ✅ · **(S)** ✅ | Samsara cada hora |
| Shop Phases (PM, Mechanics, Alignment, Detail, Q.C.: Pending / Done) | **(—)** | Es lo que en la app son los trabajos de la Work Order y su estado (App) ✅ |
| Interruptores con fecha: Air Dryer Filter, PM, Alignment/Tires, Detail, Quality Control | **(—)** | En la app: completar el trabajo guarda quién y cuándo (App) ✅. "Air Dryer Filter" no es un trabajo del catálogo de pasos ⚠️ |
| PM Information: NeedPM, Days OTR since last PM, Miles from last PM, Last PM Odometer, Last PM Date, Last PM location, Oil change every (miles) | **(—)** | **Lo que necesita la regla PM / Fuel filter.** No está en la copia que la app lee |
| Alignment Information: last alignment date y ODO, miles from last alignment, last valve adjustment, last DPF cleaning | **(—)** | Igual |
| Work Notes Shop ("FF") | **(—)** | En la app: notas de la Work Order (App) ✅ |
| "Pay Attention PM" | **(—)** | Aviso calculado en Ninox |

### Overview (843)

| Dato | Fuente | Nota |
|---|---|---|
| Owner, Dispatch, Insurance, Type, VIN, Size, Year, Plate, Odometer | **(A)** `trucks` ✅ y ya en la app (D43, D44) | |
| Truck Status "Checked In", "Truck Off Duty", Return Schedule "Off Duty" | **(A)** `mechanic_status` ✅ · **(B)** share off duty ✅ | |
| Annual expiration, days to next annual inspection | **(—)** | No está en el diccionario |
| Repair in house / outside total expenses | **(App)** ✅ | Truck → Costs (D32, D34) |
| Historic mechanic work (hours) | **(App)** ✅ | Las horas por mecánico del labor |

---

## 3. La regla PM / Fuel filter

**La regla (dueño, precisada el mismo día):**

| Millas desde el último PM | Qué toca |
|---|---|
| Menos de 30,000 | **Fuel filter** solo |
| 30,000 a 39,999 | **Aviso**: el manager decide PM o Fuel filter según lo cerca que esté de 40,000. La app no decide; muestra cuánto le falta |
| 40,000 o más | **PM** (aceite y filtros) |

**Qué hace falta para que sea automática:**
1. **Millas de hoy:** Samsara ✅ (cada hora, D35).
2. **Millaje del último PM.** Tres caminos, del más rápido al más lento:
   - **a.** Que el equipo de datos agregue `last_pm_odometer` y `last_pm_date` de Ninox a la copia de
     Supabase. La app los leería como lee `trucks`. Eso es un pedido a quien mantiene
     `data-reporting-kit`.
   - **b.** Cargar una vez desde un export de Ninox (CSV con camión, millaje y fecha del último PM),
     como se hizo con los camiones (D43). Después la app lleva el registro.
   - **c.** Que la app lo aprenda sola: cada PM que se cierra en la app ya guarda su millaje
     (`pm_services`, `truck_mileage_adjustments`) ✅. Hasta el primer PM de cada camión en la app, el
     manager decide.
   - **Recomendación ⚠️:** **b** ahora, más **c** de ahí en adelante. **a** solo si Ninox va a
     seguir siendo donde se anota el PM.
3. **Datos malos.** El 830 dice "Last PM Odometer 540" con odómetro 544,418. La resta da 543,878
   millas, que es imposible. El 941 da 199,919.
   - La app no puede decidir con esos datos. Propuesta ⚠️: más de 120,000 millas se marca **"Check
     the last PM"** y el manager decide.
   - El límite de 120,000 es mío; hay que validarlo.
4. **El 30,000 de Ninox** ("Oil change every (miles) 30,000" en el 830) es el aviso, no el intervalo
   (dueño, 26-oct). Falta saber qué mira el manager para decidir entre 30,000 y 40,000 (P57).

**Cómo se ve:** en la pizarra, la columna PM dice "PM · 49,812 mi", "Fuel filter · 17,426 mi" o
"Check the last PM". En Arrivals, al hacer Check in, el camión entra con lo que le toca.

**Con los datos de hoy** (lista View de Bay Work, 13 camiones):
- **PM:** 2 (863 y 968).
- **Decide (30,000–40,000):** 1 (905, 35,260).
- **Fuel filter:** 8.
- **Check the last PM:** 2 (830 y 941).

---

## 4. Lo que no cuadra en los datos de hoy

| Camión | Qué | Dónde |
|---|---|---|
| 845 | Ready To Go en el Kanban, pero está en las listas de PM y Alignment, y Alejandro 1 aparece trabajándolo | Kanban · Bay Work · Mechanics Work |
| 879 | Ready To Go, pero Alejandro 1 aparece trabajándolo | Kanban · Mechanics Work |
| 818 | Ready To Go, pero está en la lista de PM | Kanban · Bay Work |
| 830 | Último PM con odómetro 540 | Bay Shop |
| 941 | 199,919 millas desde el último PM | Bay Work |
| 905 | En la lista de PM (en la yard) y en Return Schedule para el 26 de noviembre (en la ruta) | Bay Work |
| 834 | Heavy Work No ETA hace 35 días; asignado a Anthony, pero sin trabajar | Kanban · Mechanics Work |
| 832 | Heavy Work No ETA hace 47 días | Kanban |

**Por qué importa:** en Ninox el estado se escribe a mano y queda viejo. En la versión resumida,
"listo" se **calcula** del trabajo abierto (D1 ✅), y lo que hace cada mecánico sale de su propio
toque.

---

## 5. Qué cambia en el rediseño

| Tema | Cambio |
|---|---|
| **Detailing (P50–P52 cerradas)** | Una cuenta de equipo en la tablet. Varios camiones a la vez y cualquiera termina. Las horas quedan a nombre de "Detailing". En la app hay que permitir varias sesiones a la vez para esa cuenta (hoy, un reloj por persona, D21) y que cualquiera complete (hoy, solo el dueño, `work-orders.service.ts:1303`). Ya no hace falta el frente C |
| **Check in** | Acción en Arrivals: llegó y las llaves están en la oficina. Es el "Checked In" de Ninox. Entra a la pizarra con PM o Fuel filter según la regla |
| **Estados de Ninox** | La vista "By truck" usa las mismas columnas del Kanban, para que el manager reconozca el tablero. En la app se **calculan**; no se escriben |
| **PM / Fuel filter** | La columna PM muestra cuál toca. La plantilla de la visita usa la regla |
| **Datos de Ninox que faltan** | Último PM, alineación, anual: hace falta camino a, b o c (§3) |

## 6. Preguntas nuevas

| # | Pregunta |
|---|---|
| P57 | Entre 30,000 y 40,000, ¿qué mira el manager para decidir y quién decide? ¿El Fuel filter se cambia siempre que no hay PM? ¿El Air Dryer Filter va con el PM? |
| P58 | ¿De dónde sale el millaje del último PM: pedirlo a la copia de Ninox (a), cargarlo una vez de un export (b) o que la app lo aprenda (c)? Recomendación: b + c |
| — | Las listas de Bay Work, ¿son pendientes o hechas? (página de validación, pantalla Board) |
| — | ¿Qué significa "Heavy Work No ETA" y quién mueve los estados del Kanban? |
