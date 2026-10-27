# Revisión de las sugerencias (2026-10-26)

El dueño pidió revisar todo después del error con "Visit". Cada afirmación y sugerencia de la
propuesta se clasifica como:

- ✅ **Comprobada:** se leyó el código o un documento, o salió de una prueba que corrió.
- ⚠️ **Supuesto:** es razonable, pero nadie la validó. No se construye sin confirmarla.
- ❌ **Corregida:** estaba mal; ya se arregló en los documentos.

## 1. Hechos sobre el código y los datos

| # | Afirmación | Estado | Base |
|---|---|---|---|
| 1 | Toda WO nace con PM A, Alignment, Detailing y QC | ✅ | `mandatory-jobs.ts:93`, `work-orders.service.ts:310` |
| 2 | El QC no se puede cancelar | ✅ | `admin.service.ts:1710` (`QC_NOT_CANCELLABLE`), D55 R9 |
| 3 | Un paso con todos sus Jobs cancelados cuenta como "no aplica" | ✅ | `yard-work-plan-derivation.ts`, `mandatoryPhase` |
| 4 | No se cierra sin inspección, salvo con motivo | ✅ | `work-order-close-rules.ts`, D55 R2 |
| 5 | Tomar de la cola es seguro si dos tocan a la vez | ✅ | `team-queue.service.ts:104-143` (`updateMany` condicionado) |
| 6 | Solo el dueño completa su Job | ✅ | `work-orders.service.ts:1303` |
| 7 | La cola de Safety ignora un QC cancelado | ✅ | `quality-check.service.ts:89` |
| 8 | El Yard tiene una tarjeta por camión, en una sola fase | ✅ | `yard-operations.service.ts:788` |
| 9 | `test:real` en `main`: 209 pasan, 2 se saltan a propósito | ✅ | Corrido el 2026-10-24 |
| 10 | Incoming lee solo `driver_pay` y descarta toda fila con Termination | ✅ | `yard-data-boundary.service.ts:251`, `yard-data-boundary.ts:147`. **Es a propósito** (LTR-254: `returns` trae toda la flota, filas sin fecha y fechas viejas), no un defecto |
| 11 | Por eso faltan camiones que vuelven (Fired, Early broke contract) | ❌ | Comparado con Ninox el 26-oct (`docs/reference/NINOX_COPIA_SUPABASE.md`, PR 435): el Shop calcula bien; las diferencias vienen de la copia en Supabase |
| 12 | Eso explica LTR-262 (Incoming no coincide con Ninox) | ❌ | La causa es que la copia en Supabase no actualiza las filas que cambian (PR 435). Pedido enviado a Ninox |
| 13 | "Fin de contrato" es la Return Date del chofer | ⚠️ | Supuesto; preguntado al dueño, sin respuesta |
| 14 | El menú del Manager tiene 19 entradas | ❌ | Son **15** (`admin-shell.tsx:20-53`). Corregido |
| 15 | El inicio del mecánico tiene 8 secciones | ⚠️ | Son 8 **posibles**; cada una sale solo si tiene algo. Un mecánico ve normalmente 3 o 4 |
| 16 | De la cola a terminado son 4 toques hoy | ✅ | Lo leyó un subagente en `detail-client.tsx`; no lo medí en pantalla |
| 17 | Llegan con 1–2 h de atraso (GPS y sincronización por hora) | ✅ | SYSTEM §8, D52 |

## 2. Sugerencias de diseño

| # | Sugerencia | Estado | Qué hay detrás |
|---|---|---|---|
| 18 | Decir "Visit" en lugar de "Work Order" | ❌ | Sin evidencia. **Se queda Work Order**, con un campo "Visit type" (P45) |
| 19 | Decir "Repairs" en lugar de "Shop Work" | ⚠️ | El mismo problema que "Visit": es mi gusto. Pasa a "validar con el Shop Manager" (P40) |
| 20 | Pizarra con una tarjeta por trabajo y columnas por especialidad | ✅ | Lo pide el prompt (§6) y lo dijo el dueño ("mostrar el tablero como ellos lo usan") |
| 21 | Columnas PM · Repairs · Alignment · Detailing, con Inspection y QC a los lados | ⚠️ | Las especialidades salen del prompt; el orden y los lados son míos (P49) |
| 22 | ★ = prioridad | ✅ | El prompt: "el manager identifica camiones prioritarios mediante asteriscos" |
| 23 | Tomar = empezar el tiempo | ⚠️ | Sugerencia mía para ahorrar un toque. El prompt dice "distinguir tomar y comenzar **si hace falta**" (P47) |
| 24 | Todo trabajo sin dueño queda disponible | ✅ / ⚠️ | El prompt lo pide (§7). Que vaya a la cola de su especialidad es decisión (P44) |
| 25 | Plantillas por tipo de visita | ✅ | Lo pide el prompt (§5) |
| 26 | Que plantillas digan End of contract = todo y Passing through = nada fijo | ⚠️ | Supuesto. El prompt dice que las reglas definitivas "deben depender de las reglas operativas aprobadas" |
| 27 | Lo que la plantilla no trae queda "Not required" sin pedir motivo | ⚠️ | Decisión de diseño para no cargar al Manager (prompt §9). El prompt también pide "registrar quién autorizó y por qué"; aquí el porqué es el tipo de visita. Hay que validarlo |
| 28 | QC con estado propio y "Not required" solo del Manager | ✅ / ⚠️ | El estado propio lo pide el prompt (§8.1 E). Que lo decida solo el Manager es supuesto (P46) |
| 29 | **"Release truck" hace Close + Return to Service juntos** | ❌ | **No lo marqué como cambio de regla.** Hoy son dos pasos a propósito (D1, D52: el camión puede quedar listo y seguir en la yard; Departures lo usa). Ahora es P56; recomiendo que Release haga solo Close |
| 30 | La devolución de Safety crea sola el trabajo correctivo | ⚠️ | El prompt lo pone como P1. Cambia D46 §4 (P54) |
| 31 | Detailing en tablet con "nombre con un toque" | ⚠️ | Idea mía. **Subestimé el costo:** que la tablet registre a otra persona sin su contraseña es un cambio de autenticación. Hay que diseñarlo con cuidado (quién puede, cómo queda en el historial). Probablemente más de las 5–7 h estimadas |
| 32 | La gerencia usa el rol Admin de solo lectura | ✅ | SYSTEM §6, "Shop Admin · read only" |
| 33 | La pizarra entra primero en una ruta nueva | ✅ | Ahora es coherente en todos los documentos (el inventario decía otra cosa; corregido) |

## 3. Estimaciones y alcance

| # | Afirmación | Estado | Qué pasa |
|---|---|---|---|
| 34 | "RP-1 a RP-3 sin migración" | ❌ | **Probablemente necesita una migración pequeña y aditiva.** Para distinguir "QC por decidir" de una WO vieja a la que le falta el QC, y para guardar el tipo de visita, hace falta una columna. Eso implica Release safety después del merge. Corregido |
| 35 | Las horas (24 h → 32 h → 46 h) | ⚠️ | Son estimaciones mías, sin desglose por archivo. Subieron porque creció el alcance (pizarra, pantalla del mecánico, Detailing, Safety), no porque la parte inicial se moviera. Hay que tomarlas como orden de magnitud |
| 36 | "Más del 90 % se reutiliza" (primer informe) | ⚠️ | Lo calculé con líneas de código tocadas; mide poco. Lo que sí vale: el esquema, las reglas, la cola, el reloj y Safety ya existen |
| 37 | Task flow del Manager: "25–30 toques en el día" | ⚠️ | Contado sobre mi boceto, no medido contra la app de hoy |
| 38 | En el boceto, Anthony toma con dos toques y Luis con uno | ⚠️ | Son dos variantes para decidir P47; en una demo puede confundir. Hay que explicarlo |

## 4. Qué cambió en los documentos

- **P45:** recomendación "se queda Work Order".
- **P40:** pasa a "validar".
- **P56 (nueva):** qué hace exactamente "Release truck".
- **Migración:** el plan, el inventario y el task flow de Safety dicen "probable", no "sin migración".
- **Inventario:** la pizarra entra en una ruta nueva, igual que dice R-8.
- **Menú:** 15 entradas.
- **Boceto (actualizado el 2026-10-26):** dice "New Work Order" con "Visit type" (P45), "Close Work Order" con Return to Service aparte (la opción segura de P56), y la franja "Needs your decision" muestra solo los contadores que no están en cero, como el inventario (incluye Not taken > 1 day y Work requests).

## 5. Lo que sigue firme

El diagnóstico y el núcleo del rediseño salen del prompt y del código, no de mis gustos:

- los pasos fijos para todos los camiones son el choque principal;
- la pizarra con una tarjeta por trabajo;
- todo trabajo sin dueño queda disponible;
- el QC tiene su propio estado.
