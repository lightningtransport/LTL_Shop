# Registro de decisiones de producto

**Actualizado:** 2026-09-29 (cuestionario de operación)

Esta es la **única** lista de decisiones vigentes. Antes estaban repartidas
entre Linear (doc 16), el Decision Log del PRD maestro, el contrato de
ownership y `ux/FLUJOS_Y_MEJORAS` (todos en `archive/`).

**Cómo agregar una:** siguiente número libre, fecha, quién decidió, a qué
reemplaza. Si reemplaza a otra, la vieja se marca **Reemplazada** aquí mismo;
no se borra.

## Vigentes

| # | Decisión | Fecha | Implementado en |
|---|---|---|---|
| **D1** | **Ready to Go solo cuando el WO está completo** (todos los pasos resueltos y WO `completed`). Se calcula, no se marca. El Truck sigue Ready to Go hasta Return to Service. Reemplaza el "Mark Ready" / "Ready for Approval" del modelo viejo de 6 requisitos. | 2026-09 | LTR-90, LTR-150 |
| **D2** | Un PM en curso por mecánico PM. El mecánico Standard sí puede tener Jobs en varios Trucks a la vez y pasar de uno a otro sin que nadie lo reasigne; **su reloj corre en uno solo a la vez (D21)**. | 2026-09-25 / 2026-09-29 | LTR-95, LTR-125 |
| **D4 + D9** | El PM es un Job obligatorio dentro del único WO del Truck (no un WO aparte). | 2026-09 | LTR-141, LTR-145 |
| **D5** | "Blocked" significa una parada real (bloqueo activo o pausa oficial), no "tiene trabajo abierto". | 2026-09 | LTR-92, LTR-98 |
| **D6** | Los Jobs se agregan desde el Truck / Work Plan. | 2026-09 | LTR-119 |
| **D8** | Las notas solo se agregan; existe "Pedir trabajo" (`work_request`). | 2026-09 | LTR-126 |
| **D10** | El millaje de PM no puede ser menor que el del Truck; un salto de más de 50 000 pide confirmación. | 2026-09 | — |
| **D11** | **Cada Job tiene un dueño.** El equipo del WO se deriva de los dueños. Un Job sin dueño no lo ejecuta nadie. `mechanic_assignments` queda como caché. | 2026-09-27 | LTR-154 |
| **D12** | **El mecánico no pausa; solo bloquea.** Pausar el WO es del Manager. (La excepción para WOs de PM legacy se retiró en LTR-180: ya no hay pausa del mecánico.) | 2026-09-27 | LTR-155, LTR-180 |
| **D13** | **Crear WO = solo Truck** (+ prioridad y nota). Nace con PM, Alignment, Detailing y QC. | 2026-09-27 | LTR-157 |
| **D14** | **La inspección la hace el Manager en el Truck:** "No issues found" o "Issues found". Con hallazgos agrega Jobs y elige quién los hace. | 2026-09-27 | LTR-158, #204 |
| **D15** | **Responsable por defecto por paso** (p. ej. PM → Daniel, Detailing → Anthony). La parte de QC ("lo completa el Manager") queda **reemplazada por D19**. | 2026-09-27 | LTR-157 |
| **D19** | **El Quality Check lo hace Safety.** Safety tiene cuenta propia (`quality_check.perform`) y una pantalla con los camiones que esperan revisión. QC no tiene dueño por defecto: cualquiera de las dos personas de Safety lo toma. Si encuentra algo mal, **devuelve el camión con una nota** (queda como bloqueo "Devuelto por Safety") y el Manager agrega el trabajo. Safety no interviene en la llegada, solo al final. El Manager conserva "Mark QC complete" como respaldo. | 2026-09-29 | LTR-185 |
| **D21** | **El reloj de un mecánico corre en un solo camión a la vez.** Al hacer Start/Continue en otro camión se cierra su reloj en el anterior (queda registrado "cambio de camión"); al volver toca Continue. Reemplaza la parte de D2 (LTR-125) que aceptaba el solape, porque el tiempo se usa para medir y costear. | 2026-09-29 | LTR-186 |
| **D20** | **Cierre del día.** El taller trabaja de lunes a viernes, 8:00 a.m.–5:00 p.m. (hora del Este). Todos los días hábiles a las **5:00 p.m.** la app cierra los relojes que sigan corriendo; el tiempo cuenta **hasta las 5:00**. No es una alerta: en un Work Order de varios días es el cierre normal de cada jornada (el mecánico no pausa, D12). El cierre se ve en los tiempos del Work Order como "cierre del día" y el Manager lo ajusta con la corrección de tiempo solo si alguien se fue antes. Al día siguiente el mecánico toca **Continue**; su inicio se lo recuerda. Un reloj que arranca después de las 5:00 o un día no hábil se cierra a las 11:59 p.m. de ese día. La hora y los días los cambia el Manager en Setup. | 2026-10-05 | LTR-186 |
| **D22** | **El Manager da de alta al personal del taller desde el Admin** (Mecánicos → "Agregar"): nombre, correo y tipo (Standard, PM o Safety). La app crea también la cuenta de acceso en Supabase con una **contraseña temporal** que el Manager le pasa a la persona; al primer inicio la app obliga a cambiarla. El Manager puede **desactivar** a alguien solo si no tiene Jobs pendientes ni tiempo corriendo; si los tiene, la app le dice qué reasignar primero. No se borra nada: la persona deja de entrar y de aparecer para asignar. Reactivar vuelve a dejarla entrar. **Camiones: fuera por ahora** (siguen llegando de Ninox); se decide después. | 2026-09-30 | LTR-187 |
| **D23** | **Ayudante en un Job.** Un Job sigue teniendo un solo dueño (D11). Para que otro mecánico ayude, el Manager toca **"Agregar ayudante"** en el `…` del Job y elige al mecánico: la app crea un Job aparte "<Job> · ayudante" (misma categoría) con ese dueño. El ayudante lo ve en "Tus Jobs", su reloj corre normal (D18, D20, D21) y lo completa cuando termina su parte. Un bloqueo del Job principal no bloquea el del ayudante. | 2026-10-05 | LTR-188 |
| **D24** | **Taller externo.** En el `…` de un Job, el Manager toca **"Enviar a taller externo"**, elige qué sale (**la pieza** o **el camión**) y escribe una nota (a dónde, cuándo vuelve). El Job queda "En taller externo": sin dueño, sin reloj y sin la alerta de "nadie asignado"; el resto de los Jobs sigue normal. Mientras haya un Job afuera, el camión no puede quedar Ready to Go y el siguiente paso dice "En taller externo: <Job>". Si sale el camión, el Yard lo muestra "Fuera del taller". Al volver, el Manager toca **"Regresó"** y lo completa o se lo asigna a un mecánico (para instalar o revisar). Todo queda en el Activity Log. No se registran costos del taller externo (la app costea solo horas de mecánicos). | 2026-10-05 | LTR-188 |
| **D16** | Pantalla **Setup → Shop workflow** para los pasos obligatorios y su responsable por defecto. La editan Manager o System Admin; aplica a WOs nuevos. | 2026-09-27 | LTR-156, LTR-157 |
| **D17** | **Ciclo del bloqueo:** siempre es de un Job; el mecánico lo reporta y puede agregar notas; **solo el Manager resuelve**; el Job vuelve a Pending. "Truck Unavailable", Break, End of Shift y Working on Another WO no son motivos de bloqueo (lo de todo el camión es pausa oficial). | 2026-09-27 | LTR-155 |
| **D18** | **Tiempo por mecánico.** Cada sesión tiene `user_id`; el tiempo del WO es la suma. El tiempo de un mecánico se detiene al terminar o bloquear su último Job disponible y vuelve a correr solo cuando toca Continue/Start. | 2026-09-27 | LTR-153, LTR-154 |

### Decisiones "por defecto" (se adoptaron sin pregunta explícita)

Vigentes, pero conviene confirmarlas. Si alguna no es la intención, se
cambia aquí antes de construir encima.

| Tema | Decisión |
|---|---|
| Avisos | Solo dentro de la app (distintivo en el inicio del mecánico y "Needs attention" del Manager). Sin push. |
| Responsable por defecto inactivo | El paso nace Unassigned y el siguiente paso del Manager lo marca. |
| PM y "Create PM service" | Cualquier `mechanic.pm` que arranca el PM se lo autoasigna (respetando D2). |
| WOs abiertos antes de D13 | Sin backfill automático; botón "Agregar pasos que faltan" en el Truck. |
| Listas | "Truck 922 · 5 Jobs · Next: PM" en lugar de la categoría. |
| PM legacy (D12) | Sin pausa propia desde LTR-180; solo el Manager lo cierra o cancela. |

## Reemplazadas

| # | Decía | Reemplazada por |
|---|---|---|
| D3 | El bloqueo lo resuelve el mecánico o el Manager y no afecta el tiempo. | D17 + D18 |
| D7 | Una sesión de trabajo por WO, sin `user_id`; se cierra en el último Job. | D18 |
| PRD Q10 / Q17 | Un Job sin asignar lo ejecuta cualquier miembro del equipo; `mechanic_assignments` es el equipo. | D11 |
| PRD Q13 / contrato PM-02, PM-07 | El PM se crea solo y tiene pausa propia. | D4 + D9, D12 (solo aplica a PM legacy) |
| Modelo de readiness de 6 requisitos + "Mark Ready" / "Ready for Approval" (Yard Phase 1, V2.1) | — | D1 |
| Mecánico crea, prioriza y pausa WOs (PRD P0, PRD maestro §2/§29) | — | Cutover de ownership V2-002, D12, D13 |

## Cómo trabaja el taller (cuestionario de operación, Cristian, 2026-09-29)

Respuestas que **confirman** lo construido:

| Tema | Respuesta | Coincide con |
|---|---|---|
| Aparatos | Mecánicos en teléfono; Manager en teléfono y computadora | App instalable y Admin adaptable |
| Pasos obligatorios | Todos los camiones pasan siempre por PM, Alignment, Detailing y Quality Check | D13 |
| Inspección de llegada | Siempre el Manager | D14 |
| El camión vuelve por algo que quedó mal | Se abre un trabajo nuevo | Una WO abierta por Truck |
| Salida urgente sin terminar todo | Sí, con autorización del Manager | Cancelar Jobs con motivo y cerrar |
| Mecánico ausente | Sus trabajos esperan a que vuelva | Reasignar uno por uno alcanza |
| Descansos y almuerzo | No hace falta detener el tiempo | D12 (el mecánico no pausa) |
| PM sin partes | Nunca pasa | El PM exige al menos una parte |
| Safety en la llegada | No; solo al final | D14 (inspecciona el Manager) |
| Piezas | Las pide el Manager | D17 |
| Resolver un bloqueo | Solo el Manager | D17 |
| PM | Solo una persona (Daniel) | D2 |
| Return to Service | El Manager, cuando el camión sale del patio | Acción separada de cerrar (D1) |
| Off Duty | No se pidió | Se lanza sin Off Duty |
| Idioma | Mezclado | Inglés y español completos (LTR-181) |

Respuestas que **no coinciden** con lo construido: G1–G7 en
[`OPEN_ISSUES.md`](OPEN_ISSUES.md) §1c.

## Preguntas abiertas

Se deciden aquí; mientras tanto, no se construye nada que dependa de ellas.

| # | Pregunta |
|---|---|
| ~~P1~~ | **Cerrada 2026-09-29:** el Manager da de alta camiones y mecánicos, desde la app. Detalle en **D22** (2026-09-30): personal sí, con cuenta y contraseña temporal; camiones después. |
| ~~P2~~ | **Cerrada 2026-09-29:** se lanza sin Off Duty. |
| ~~P3~~ | **Cerrada 2026-09-29:** el taller trabaja trailers; hacen falta como activos. Falta el cuándo (P11). |
| P4 | ¿Se muestra o se escribe el `mechanic_status` de Ninox (`E.TA`)? Hoy no. |
| P5 | ¿Quién revisa los Custom Jobs y cómo se mapean al catálogo? |
| ~~P6~~ | **Cerrada 2026-10-05:** el roster del día 1 lo arma el Manager desde la app (D22) en la fase 4 de [`GO_LIVE_CHECKLIST_ES.md`](GO_LIVE_CHECKLIST_ES.md): Daniel (PM), los mecánicos (Standard), Safety 1 y 2 (Safety). |
| ~~D20~~ | **Decidida 2026-10-05:** ver D20 en Vigentes (cierre del día a las 5:00 p.m., el tiempo cuenta hasta el cierre). |
| ~~P7~~ | **Cerrada 2026-10-05 → D23:** Job aparte para el ayudante. |
| ~~P8~~ | **Cerrada 2026-10-05 → D24:** "Enviar a taller externo" en el Job (sale la pieza o el camión), sin costos. |
| ~~P9~~ | **Cerrada 2026-09-29 → D21:** el reloj corre en un solo camión a la vez. |
| ~~P10~~ | **Cerrada 2026-09-29:** nunca hay PM sin partes. La app está bien como está (exige al menos una). |
| ~~P11~~ | **Cerrada 2026-10-05:** trailers **después** de salir en vivo, cuando Cristian lo indique (LTR-56). |
