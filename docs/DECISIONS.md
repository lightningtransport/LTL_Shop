# Registro de decisiones de producto

**Actualizado:** 2026-10-07 (revisión de Setup: D28–D32)

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
| **D25** | **El Manager mantiene el catálogo de Jobs.** Puede agregar y editar Jobs del catálogo (Admin → Job Catalog), igual que el System Admin; las categorías no cambian. Al agregar un Job personalizado en el Work Plan puede marcar **"Agregar también al catálogo"**: el Job entra al catálogo y al Work Order como Job de catálogo, no como personalizado. Objetivo: que el mismo trabajo se llame igual siempre y los reportes por tipo de trabajo salgan bien desde el día 1. La bandeja para revisar Custom Jobs viejos (unir a uno del catálogo, agregarlo o marcarlo de una sola vez) va después (LTR-57). | 2026-10-05 | LTR-57 |
| **D26** | **El siguiente paso actúa donde estás.** El botón del siguiente paso hace la acción en la pantalla en la que está el Manager (Dashboard, lista de Work Orders, Truck, Work Order): Resume, Mark QC complete, Close, Return to Service, Add missing steps y Assign (selector de mecánico con búsqueda). Solo navega lo que vive en otra pantalla: la inspección y un Work Order nuevo (Truck), "Regresó" de un taller externo (fila del Job en el Work Order). Sin permiso no hay botón. Decidido por el dueño al confirmar el reparto Truck ↔ Work Order y Dashboard ↔ Yard (auditorías `docs/ux-audit/`). | 2026-10-05 | Etapa 2 (`next-step-action.tsx`) |
| **D27** | **Cerrar un Work Order y Return to Service se confirman.** Close / Confirm completion abre un diálogo ("WO-x se cierra como Completado y el Truck queda Ready to Go; se puede reabrir con motivo"); Return to Service abre un diálogo con motivo opcional. Igual en Dashboard, Yard, Truck y Work Order. Completar **un Job** sigue siendo un toque. **Cambio del 2026-10-06 (P5):** en el **Dashboard**, Close Work Order cierra con un toque, como la maqueta (se puede reabrir desde el Work Order); en el Work Order y el Truck sigue confirmando. Return to Service confirma en todas partes. | 2026-10-05, cambio 2026-10-06 | Etapas 1–2 y 8.8 (`close-work-order-dialog.tsx`, `return-to-service-dialog.tsx`, `next-step-action.tsx`) |
| **D28** | **Cada paso obligatorio tiene un equipo y una cola.** En Setup → Shop workflow, el Manager elige **una o varias personas** por paso (PM, Alignment, Detailing, Quality Check). Si el equipo tiene una sola persona, el Job nace asignado a ella, como hoy. Si tiene varias, nace **sin dueño en la cola del equipo**: todos lo ven y el primero que lo **toma** queda como dueño. Puede **soltarlo** y vuelve a la cola. El Manager puede asignarlo directo a cualquiera del equipo. Cada Job sigue con un solo dueño (D11 no cambia), y el tiempo sigue siendo por persona (D18). Quality Check es la cola de Safety, como hoy (D19). El paso de PM se llama **"PM"**: "PM A Service" y "PM B Service" siguen siendo el alcance que elige el mecánico al hacer el PM; PM A es el de partida. Reemplaza el "responsable por defecto" único de D15. | 2026-10-07 | S1 (LTR-197, rama `claude/setup-s1`) |
| **D29** | **El Manager hace QC como respaldo desde la pantalla de Safety.** Si no hay nadie de Safety disponible, el Manager o el System Admin entran a `/qc` y toman, aprueban o devuelven igual que Safety, y queda registrado quién lo hizo. "Mark QC complete" sigue en el Truck. Amplía D19. | 2026-10-07 | S1 (LTR-197, rama `claude/setup-s1`) |
| **D30** | **El Manager maneja todo el catálogo, con protecciones.** Crea, renombra, activa y desactiva **categorías**. Crea, renombra, activa y desactiva **Jobs**. Agrega y quita **aliases**. **Borrar** solo se puede si el Job o la categoría **nunca se usó**; si se usó, se desactiva y la pantalla dice por qué. Los Jobs y categorías **del sistema** (PM, Alignment, Detailing, Quality Check) no se pueden desactivar ni borrar; renombrarlos no rompe nada, porque la app los reconoce por una clave fija y no por el nombre. Un Job usado por un paso obligatorio no se desactiva sin antes cambiar el paso. La carga del catálogo base en cada publicación **ya no pisa** lo que cambió el Manager. Reemplaza "las categorías no cambian" de D25; lo demás de D25 sigue. **Al construir (2026-10-08):** las categorías del sistema (PM, Detailing, Quality Check) tampoco se renombran, porque la app lee "PM" por nombre en muchos lugares; los Jobs del sistema sí se renombran sin romper nada. | 2026-10-07 | S2 (LTR-198, rama `claude/setup-s2`) |
| **D31** | **"Quitar del Shop" (Remove) conserva el historial.** Además de desactivar (D22), el Manager puede **quitar** a una persona: deja de entrar, desaparece de todas las listas y de los equipos de los pasos, y su nombre se sigue viendo en el historial (Work Orders, notas, tiempos). Solo se puede si no tiene trabajo abierto, igual que desactivar, y la app lo dice **antes** de confirmar. El **borrado real** existe solo para quien nunca hizo nada (por ejemplo, creado por error). Amplía D22. **Al construir (2026-10-09):** la dirección sigue siendo `/admin/mechanics` (el menú dice People / Personas) y la lista no suma a los Shop Managers; los dos cambios de la propuesta quedan para cuando haga falta. | 2026-10-07 | S3 (LTR-199, rama `claude/setup-s3`) |
| **D32** | **Partes y costos por camión, etapa 1.** Una sección nueva para: el **catálogo de partes** (el mismo que usa el PM, hoy cargado solo por código), los **proveedores**, las **compras** de partes con su factura (asociadas o no a un camión) y las **reparaciones externas** con su factura (asociadas a un camión y, si corresponde, al Job enviado a taller externo, D24). Cada camión tiene su **historial de costos** con totales. **Sin stock** en la etapa 1. **Diseñado, no construido:** costo de mano de obra (tarifa × horas registradas, D18) y una **factura interna por camión y período** para que el taller cobre sus servicios a Finanzas. Los datos de la etapa 1 se guardan de forma que estas dos cosas se agreguen después sin rehacer nada. Reemplaza "no se registran costos" de D24. | 2026-10-07 | S4: PC-1 construido (catálogo de partes y proveedores); PC-2 a PC-4 por construir |
| **D16** | Pantalla **Setup → Shop workflow** para los pasos obligatorios y su responsable por defecto. La editan Manager o System Admin; aplica a WOs nuevos. | 2026-09-27 | LTR-156, LTR-157 |
| **D17** | **Ciclo del bloqueo:** siempre es de un Job; el mecánico lo reporta y puede agregar notas; **solo el Manager resuelve**; el Job vuelve a Pending. "Truck Unavailable", Break, End of Shift y Working on Another WO no son motivos de bloqueo (lo de todo el camión es pausa oficial). | 2026-09-27 | LTR-155 |
| **D18** | **Tiempo por mecánico.** Cada sesión tiene `user_id`; el tiempo del WO es la suma. El tiempo de un mecánico se detiene al terminar o bloquear su último Job disponible y vuelve a correr solo cuando toca Continue/Start. | 2026-09-27 | LTR-153, LTR-154 |

### Detalle de D28–D32 (el dueño aceptó las recomendaciones, 2026-10-08)

Las preguntas chicas de las propuestas `docs/proposals/admin-setup-redesign/` (D-SET) y `docs/proposals/parts-costs/` (D-PC) quedan decididas como se recomendaron. La explicación completa está en la §6 de cada propuesta.

| # | Decisión | Va con |
|---|---|---|
| D-SET1 | Un equipo vacío no bloquea guardar: la fila avisa y el Job nace sin dueño. | D28 · S1 |
| D-SET2 | Cambiar de tipo y "Quitar del Shop" sacan a la persona de los equipos; desactivar la deja marcada (no recibe Jobs nuevos). | D28, D31 · S1/S3 |
| D-SET3 | Cambiar de tipo con Jobs pendientes del tipo anterior se bloquea, como desactivar: primero se mueven. | D31 · S3 |
| D-SET4 | Renombrar un Job guarda el nombre viejo como alias (casilla marcada por defecto). | D30 · S2 |
| D-SET5 | Shop hours es una pestaña de Shop workflow con su URL (`/admin/setup/workflow/hours`). | S1 |
| D-SET6 | El Manager llega a `/qc` desde la fila Quality Check de Shop workflow, "Waiting for Safety" del Dashboard y el Truck; sin entrada en el menú. | D29 · S1 |
| D-SET7 | El equipo de Quality Check limita quién de Safety ve la cola; la migración pone a todo Safety activo. | D28 · S1 |
| D-SET8 | El Job de cada paso es su Job del sistema; no se elige otro. | D30 · S1/S2 |
| D-SET9 | Desactivar una categoría pide un motivo opcional de una línea. | D30 · S2 |
| D-PC1 | Solo USD; cada monto guarda `currency`. | D32 · S4 |
| D-PC2 | Impuestos y flete cuentan en el costo del camión, repartidos según las líneas. | D32 · S4 |
| D-PC3 | El catálogo de partes es solo el del PM en la etapa 1; lo demás entra como línea "Other". | D32 · S4 |
| D-PC4 | El costo de las partes del PM no se carga solo al camión (sin stock). | D32 · S4 |
| D-PC5 | Una compra sin camión no cuenta en ningún camión. | D32 · S4 |
| D-PC6 | El costo de referencia de la parte se pone a mano; se muestra "último pagado" al lado. | D32 · S4 |
| D-PC7 | Los costos los ven solo el Manager y el System Admin. | D32 · S4 |
| D-PC8 | Una factura repetida (mismo proveedor y número) se bloquea, con enlace a la existente. | D32 · S4 |
| D-PC9 | El camión se guarda por línea y se elige por factura en la pantalla, con opción de repartir. | D32 · S4 |
| D-PC10 | La factura adjunta es opcional; la fila sin archivo se marca. | D32 · S4 |

### Decisiones "por defecto" (se adoptaron sin pregunta explícita)

Vigentes, pero conviene confirmarlas. Si alguna no es la intención, se
cambia aquí antes de construir encima.

| Tema | Decisión |
|---|---|
| Avisos | Solo dentro de la app (distintivo en el inicio del mecánico y "Needs attention" del Manager). Sin push. |
| Responsable por defecto inactivo | El paso nace Unassigned y el siguiente paso del Manager lo marca. Con D28: el Job va a la cola del equipo; si el equipo queda vacío, nace Unassigned y Shop workflow lo marca. |
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
| D15 (parte) | Un solo responsable por defecto por paso. | D28 (equipo y cola) |
| D24 (parte) | No se registran costos del taller externo. | D32 |
| D25 (parte) | Las categorías del catálogo no cambian. | D30 |

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
| ~~P5~~ | **Cerrada 2026-10-05 → D25:** el Manager mantiene el catálogo y puede guardar un Job personalizado en el catálogo al crearlo; la bandeja de revisión de los viejos va después (LTR-57). |
| ~~P6~~ | **Cerrada 2026-10-05:** el roster del día 1 lo arma el Manager desde la app (D22) en la fase 4 de [`GO_LIVE_CHECKLIST_ES.md`](GO_LIVE_CHECKLIST_ES.md): Daniel (PM), los mecánicos (Standard), Safety 1 y 2 (Safety). |
| ~~D20~~ | **Decidida 2026-10-05:** ver D20 en Vigentes (cierre del día a las 5:00 p.m., el tiempo cuenta hasta el cierre). |
| ~~P7~~ | **Cerrada 2026-10-05 → D23:** Job aparte para el ayudante. |
| ~~P8~~ | **Cerrada 2026-10-05 → D24:** "Enviar a taller externo" en el Job (sale la pieza o el camión), sin costos. |
| ~~P9~~ | **Cerrada 2026-09-29 → D21:** el reloj corre en un solo camión a la vez. |
| ~~P10~~ | **Cerrada 2026-09-29:** nunca hay PM sin partes. La app está bien como está (exige al menos una). |
| ~~P11~~ | **Cerrada 2026-10-05:** trailers **después** de salir en vivo, cuando Cristian lo indique (LTR-56). |
