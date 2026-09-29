# Registro de decisiones de producto

**Actualizado:** 2026-09-29

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
| **D2** | Un PM en curso por mecánico PM. **El mecánico Standard sí puede tener trabajo en curso en varios Trucks a la vez**; se acepta que su tiempo se solape entre Work Orders (obligarlo a pausar sería fricción que no van a seguir). | 2026-09-25 | LTR-95, LTR-125 |
| **D4 + D9** | El PM es un Job obligatorio dentro del único WO del Truck (no un WO aparte). | 2026-09 | LTR-141, LTR-145 |
| **D5** | "Blocked" significa una parada real (bloqueo activo o pausa oficial), no "tiene trabajo abierto". | 2026-09 | LTR-92, LTR-98 |
| **D6** | Los Jobs se agregan desde el Truck / Work Plan. | 2026-09 | LTR-119 |
| **D8** | Las notas solo se agregan; existe "Pedir trabajo" (`work_request`). | 2026-09 | LTR-126 |
| **D10** | El millaje de PM no puede ser menor que el del Truck; un salto de más de 50 000 pide confirmación. | 2026-09 | — |
| **D11** | **Cada Job tiene un dueño.** El equipo del WO se deriva de los dueños. Un Job sin dueño no lo ejecuta nadie. `mechanic_assignments` queda como caché. | 2026-09-27 | LTR-154 |
| **D12** | **El mecánico no pausa; solo bloquea.** Pausar el WO es del Manager. Excepción: los WOs de PM legacy conservan su pausa. | 2026-09-27 | LTR-155 |
| **D13** | **Crear WO = solo Truck** (+ prioridad y nota). Nace con PM, Alignment, Detailing y QC. | 2026-09-27 | LTR-157 |
| **D14** | **La inspección la hace el Manager en el Truck:** "No issues found" o "Issues found". Con hallazgos agrega Jobs y elige quién los hace. | 2026-09-27 | LTR-158, #204 |
| **D15** | **Responsable por defecto por paso** (p. ej. PM → Daniel, Detailing → Anthony). **QC no tiene dueño**: el Manager lo completa desde el Truck; "Mark complete" es botón primario solo en QC. | 2026-09-27 | LTR-157 |
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
| PM legacy (D12) | Conserva su pausa. |

## Reemplazadas

| # | Decía | Reemplazada por |
|---|---|---|
| D3 | El bloqueo lo resuelve el mecánico o el Manager y no afecta el tiempo. | D17 + D18 |
| D7 | Una sesión de trabajo por WO, sin `user_id`; se cierra en el último Job. | D18 |
| PRD Q10 / Q17 | Un Job sin asignar lo ejecuta cualquier miembro del equipo; `mechanic_assignments` es el equipo. | D11 |
| PRD Q13 / contrato PM-02, PM-07 | El PM se crea solo y tiene pausa propia. | D4 + D9, D12 (solo aplica a PM legacy) |
| Modelo de readiness de 6 requisitos + "Mark Ready" / "Ready for Approval" (Yard Phase 1, V2.1) | — | D1 |
| Mecánico crea, prioriza y pausa WOs (PRD P0, PRD maestro §2/§29) | — | Cutover de ownership V2-002, D12, D13 |

## Preguntas abiertas

Se deciden aquí; mientras tanto, no se construye nada que dependa de ellas.

| # | Pregunta |
|---|---|
| P1 | ¿Quién da de alta un camión nuevo? Hoy no hay editor de camiones. |
| P2 | ¿Se lanza sin Off Duty? (existe el estado, nada lo escribe) |
| P3 | ¿Los trailers son activos propios o solo una categoría de Job? |
| P4 | ¿Se muestra o se escribe el `mechanic_status` de Ninox (`E.TA`)? Hoy no. |
| P5 | ¿Quién revisa los Custom Jobs y cómo se mapean al catálogo? |
| P6 | Roster real del día 1: quién entra y con qué capabilities. |
