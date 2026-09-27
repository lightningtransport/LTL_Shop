# LTL Shop: flujos de trabajo y mejoras de usabilidad

**Fecha:** 2026-09-27
**Estado:** en análisis. Todavía no se programa nada de este documento.
**Autor de las decisiones:** Cristian

---

## 1. Por qué este documento

La auditoría del 24–25 de septiembre corrigió problemas pantalla por pantalla, y ese código ya está en producción. Aun así, al probar la app **no queda claro qué tiene que hacer cada usuario**.

Para entender por qué, recorrimos las tareas completas de cada rol, de principio a fin. Estas tareas son los *jobs to be done* (JTBD) del PRD, `docs/LIGHTNING_SHOP_MASTER_PRD.md` §4.

**Método:**
- Recorrido en local, con la misma configuración de flags que producción y solo datos demo.
- Manager en escritorio; mecánicos en pantalla de teléfono (375 px).
- En cada paso se evaluaron tres preguntas: ¿sabe dónde está?, ¿sabe qué hacer después?, ¿ve que su acción funcionó?

---

## 2. Resultado por tarea

### Shop Manager

| Tarea (JTBD) | Resultado | Dónde se pierde |
|---|---|---|
| Inicio del día: qué necesita mi atención | Confuso | "Needs attention" lista WOs sin decir por qué (WO-006 y WO-007: en realidad no tienen a nadie asignado). |
| **M01**: llega un truck; inspección y plan | Confuso | La inspección queda debajo de 11 datos del truck. El botón principal es "Add work", no el paso que toca. Después de agregar trabajo, la pantalla no sugiere nada. |
| **M02**: asignar mecánicos | Confuso | Solo se asigna en la WO, no en el Truck. Hay dos formas de asignar (por job y por equipo). Después de asignar un job, "Next step" olvida los que siguen sin asignar. |
| **M03**: qué bloquea un truck | Bien a medias | El Dashboard muestra "Waiting for Parts", pero no la nota del mecánico, quién la reportó ni cuándo. "Blocked", "paused" y "waiting" significan cosas distintas según la pantalla. |
| **M04 / cierre**: Ready to Go, cerrar, Return to Service | Confuso | Cerrar la WO y hacer Return to Service solo se puede desde la WO (Return to Service está en la 5.ª tarjeta). El Truck dice "completa la WO", pero no tiene botón. |

### Mecánico Standard

| Tarea (JTBD) | Resultado | Dónde se pierde |
|---|---|---|
| **MECH01**: qué me toca hoy | Confuso | Ve 5 jobs: 1 "Assigned to you" y 3 "inherits the Work Order team". No sabe si Alignment, Detailing y QC son suyos. No ve el bloqueo que él mismo reportó. |
| **MECH02**: terminar un job | Bien a medias | Tocar el job abre "Complete job" con una nota, y funciona bien. Pero nada indica que hay que tocarlo. Al terminar su único job, el tiempo sigue corriendo y no sabe si ya acabó. |
| **MECH03**: no puedo seguir | Roto | No tiene "Pausar"; solo "Report Blocker". La lista de motivos incluye Break, End of Shift y Working on Another WO. El bloqueo no detiene el tiempo. |

### Mecánico PM

| Tarea | Resultado | Dónde se pierde |
|---|---|---|
| Hacer el PM | Funciona, con ruido | Los datos del truck tapan el trabajo. Hay dos tarjetas llamadas "PM SERVICE". Aparece "Saved" antes de escribir nada. El inicio dice "termina o pausa WO-007", pero el PM no se puede pausar. |

---

## 3. Causas de fondo

1. **Una tarea salta entre dos pantallas.** Inspeccionar y agregar trabajo se hace en el Truck; asignar, cerrar y Return to Service, en la WO.
2. **El "siguiente paso" está incompleto y se contradice.**
   - Solo existe en la WO.
   - El mecánico nunca ve "terminaste tu parte".
   - Dashboard, Yard y Truck no coinciden. Ejemplo: en el truck 905, el Dashboard decía "listo para cerrar", el Yard decía "Next: Alignment" y el Truck decía "Not Ready — 0 remaining".
3. **No está claro de quién es cada job.** Con "Inherits the Work Order team", el Manager cree que ya asignó y el mecánico no sabe si le toca.
4. **Pausa y bloqueo están mezclados.** Solo el Manager puede pausar. El bloqueo no detiene el tiempo y su lista incluye descansos y fin de turno.
5. **Hay decisiones que el sistema podría tomar solo.** Cada WO obliga a elegir categoría y jobs, y a asignar todo a mano, aunque el flujo del truck siempre es el mismo.
6. **Vocabulario y jerarquía visual.**
   - Hay palabras de sistema en pantalla.
   - Los jobs pendientes aparecen como "In Progress".
   - "Inspection" se usa con tres significados distintos.
   - Las acciones raras o destructivas pesan igual que las principales.

---

## 4. Decisiones de producto

Continúan la numeración de la auditoría (D1–D10).

| # | Decisión |
|---|---|
| **D11** | **Cada job tiene un responsable.** El Manager asigna cada job, incluidos Alignment, Detailing y QC; desaparece "inherits the Work Order team". El mecánico ve solo sus jobs. Si QC queda asignado a quien hizo el trabajo, se muestra un aviso, pero no se bloquea. |
| **D12** | **El mecánico no tiene pausa, solo bloqueo.** Break, End of Shift y Working on Another WO salen de los motivos de bloqueo. Pausar la WO sigue siendo del Manager. |
| **D13** | **Flujo preconfigurado.** Al crear la WO solo se elige el truck (más prioridad y nota); ya no hay categoría ni selección de jobs. La WO nace con PM, Alignment, Detailing y QC, cada uno con su responsable por defecto. |
| **D14** | **La inspección la hace el Manager, en el Truck.** Resultado: "Sin hallazgos" o "Hallazgos". Si hay hallazgos, agrega los jobs extra y ahí mismo elige quién los hace. |
| **D15** | **Hay una persona fija por paso como responsable por defecto.** Ejemplo: Detailing → Anthony, PM → Daniel, QC → Manager. El Manager lo cambia en una WO concreta si esa persona falta. |
| **D16** | **Nueva pantalla "Flujo del taller"** en Admin → Setup. Lista los pasos obligatorios y el responsable por defecto de cada uno. La editan el Manager o el System Admin, y aplica a las WO nuevas. |
| **D17** | **Ciclo del bloqueo:** el mecánico reporta un bloqueo en su job; su tiempo se detiene y el job le aparece como "Bloqueado"; el Manager lo ve en la WO, el Truck y el Dashboard; el Manager lo resuelve; el job vuelve al mecánico como asignado y activo. |

### Propuestas dentro de D17 (por confirmar)

- **El bloqueo es del job, no de la WO.** Si el mecánico tiene otro job en el mismo truck que no está bloqueado, puede seguir con ese. Su tiempo se detiene cuando ya no le queda nada que pueda hacer ahí.
- **Solo el Manager resuelve.** Al mecánico se le quita "Mark resolved". Puede escribir una nota ("ya llegó la parte") para avisar al Manager.
- **El Manager resuelve desde tres lugares:**
  - "Needs attention" del Dashboard;
  - la parte de arriba del Truck;
  - la WO.

  En los tres hay un botón "Resolver" con nota opcional. Hoy solo se puede en la tarjeta "Reported blockers" de la WO, que es la 4.ª sección.

### Decisiones anteriores que siguen vigentes

- **D1**: Ready to Go solo cuando la WO está completa. El truck sigue Ready hasta Return to Service.
- **D2**: un PM en curso por mecánico PM.
- **D4 + D9**: el PM es un job obligatorio dentro de la única WO del truck.
- **D5**: "Blocked" significa una parada real.
- **D6**: los jobs se agregan desde el Truck / Work Plan.
- **D7**: la sesión de trabajo se cierra en el último job.
- **D8**: las notas son de solo agregar, y existe "Pedir trabajo".
- **D10**: no se acepta un millaje de PM menor que el del truck; un salto de más de 50 000 millas pide confirmación.

---

## 5. Flujo objetivo del truck

| # | Paso | Quién | Qué hace el sistema solo |
|---|---|---|---|
| 1 | **Crear WO** | Manager | Solo pide el truck. Agrega PM, Alignment, Detailing y QC con sus responsables por defecto (D13, D15). |
| 2 | **Inspección** | Manager, en el Truck | Es lo primero que se ve: "Sin hallazgos" o "Hallazgos". Con hallazgos, el Manager agrega los jobs extra y elige quién los hace (D14). |
| 3 | **Trabajo** | Cada mecánico | Cada uno ve solo sus jobs. Al terminar el último ve "Terminaste tu parte en el Truck N" y su tiempo se detiene. |
| 3b | **Bloqueo** | Mecánico → Manager | Ciclo D17. |
| 4 | **QC** | Responsable de QC | Cuando todo lo demás está completo, el Manager ve "Listo para cerrar". |
| 5 | **Cerrar → Ready to Go** | Manager | Botón en el mismo Truck, sin ir a la WO. |
| 6 | **Return to Service** | Manager | Desde el Truck o desde la tarjeta del Yard. El motivo es opcional. |

**Resultado:** el Manager toma **3 decisiones por truck**: crear la WO; registrar la inspección y decidir quién hace lo extra; cerrar. Hoy son alrededor de 15.

**Orden de los pasos obligatorios:** Inspection → Shop Work → PM → Alignment → Detailing → QC → Listo para cerrar → Ready to Go. El orden **se muestra, pero no se obliga**; los mecánicos pueden trabajar en paralelo.

---

## 6. Cambios por pantalla

### Manager

**Truck: su lugar de trabajo principal**
- Un solo **"Siguiente paso"** arriba, con su botón, que acompaña todo el ciclo:
  - inspeccionar;
  - asignar lo extra;
  - resolver bloqueos;
  - cerrar;
  - Return to Service.
- La inspección va arriba, antes de los datos del truck.
- Los datos del truck (11 campos) van colapsados o en un costado.
- **Work Plan con el responsable de cada job**, que se puede cambiar ahí mismo.
- Los estados de los jobs tienen que ser los reales: "Pendiente" no puede aparecer como "In Progress".
- Cerrar la WO y Return to Service se hacen en el Truck.
- "Mark complete" deja de ser el botón principal en jobs que nadie ha hecho. Pasa a ser una acción secundaria.

**WO: detalle y auditoría**
- Se mantiene para revisar tiempos, historial y Activity Log, y para las acciones poco frecuentes (cancelar, reabrir, corregir tiempo).
- Las acciones destructivas o raras van plegadas, no abiertas.

**Crear WO**
- Solo pide el truck, la prioridad y una nota. Sin categoría y sin jobs.

**Flujo del taller (nueva)**
- Tabla de pasos obligatorios con su responsable por defecto.
- Advertencia si el responsable está inactivo.

**Dashboard**
- Cada elemento de "Needs attention" dice **por qué** está ahí, por ejemplo: "Nadie asignado a Detailing", "Bloqueado: Waiting for Parts · Alejandro · hace 2 h", "Listo para cerrar".
- Tiene un botón directo a la acción (Resolver, Asignar, Cerrar).
- Muestra también cuántos trucks están Ready to Go.

**Yard**
- Usa la misma regla de "siguiente paso" que el Truck y el Dashboard, para que no se contradigan.
- La tarjeta dice el motivo del bloqueo.

### Mecánico Standard

**Inicio**
- Solo sus jobs, agrupados por truck, indicando cuál sigue.
- Los jobs bloqueados aparecen como "Bloqueado · motivo".
- Se quita la sección "Paused" (D12).

**WO**
- Sus jobs, con un texto que diga que al tocarlos se completan.
- Más abajo, "Otro trabajo en este truck", solo para mirar y sin botones.
- "Reportar bloqueo" se hace **por job**.
- Al terminar su último job ve "Terminaste tu parte".

**Completed**
- Con fechas y con los jobs que hizo él.

### Mecánico PM

- El trabajo del PM va arriba y los datos del truck, plegados.
- Una sola tarjeta "PM", sin el título duplicado.
- "Saved" aparece solo después de guardar algo.
- Los valores de solo lectura no se muestran como campos editables.
- Se quita "pausa" de sus mensajes.
- Puede reportar un bloqueo en su PM (D17).

---

## 7. Vocabulario común (EN / ES)

| Concepto | Palabra en UI | No usar |
|---|---|---|
| Job sin empezar | Pending / Pendiente | "In Progress" para jobs que no han empezado |
| Job en curso | In progress / En curso | — |
| Job detenido por un problema | Blocked / Bloqueado (+ motivo) | "paused", "waiting" |
| WO detenida por el Manager | Paused / Pausada (+ motivo) | "blocked" |
| Revisión de llegada | Inspection / Inspección (solo el paso) | Inspection como "categoría" de la WO |
| Truck listo | Ready to Go | — |
| Truck sale del taller | Return to Service | — |
| Job sin responsable | Sin asignar | "inherits the Work Order team" |

---

## 8. Errores concretos que se pueden arreglar ya

1. Aparece "Mechanic note: undefined" en jobs completados (detalle de WO del Admin).
2. En el Truck, los pasos obligatorios dicen "In Progress · 1" aunque sus jobs estén pendientes. El estado del job sigue al de la WO, no al del job.
3. En el Truck, "Current Work — Open maintenance work" muestra una WO ya completada.
4. La lista de mecánicos para asignar incluye cuentas admin ("iBrain Admin", "Cristian").
5. Al mecánico Standard se le ofrece "Complete job" en el PM de otro. La API lo rechaza, pero la pantalla no debería ofrecerlo.
6. Los selectores del detalle de WO no tienen etiqueta; un lector de pantalla solo anuncia "Select mechanic" varias veces.
7. El texto de Return to Service dice que no cambia Ready to Go, pero sí lo cambia: el truck sale de Ready to Go.
8. El Yard dice "1 Jobs pending" (gramática).
9. Las métricas del Dashboard son enlaces sin nombre accesible.
10. El resumen de la WO dice "Mechanics: Not recorded" en un lugar y "No mechanics assigned" en otro.
11. En el PM aparece "Saved" antes de escribir.
12. **Contradicción con WOs viejas.** Una WO creada antes de los jobs obligatorios aparece como "listo para cerrar" en el Dashboard, pero Not Ready en el Truck. Si el Manager la cierra, el truck queda Not Ready y sin WO donde agregar lo que falta.

---

## 9. Preguntas abiertas

1. **Tiempo después de resolver un bloqueo.** ¿Corre solo cuando el Manager resuelve, o cuando el mecánico toca "Continuar"? Propuesta: cuando el mecánico continúa, así no se cuenta tiempo si no está en el truck.
2. **Avisos.** ¿"Le llega un aviso" significa solo algo dentro de la app (un distintivo en el inicio) o una notificación al teléfono? Hoy no hay notificaciones push.
3. **Responsable por defecto inactivo o ausente.** Propuesta: el paso queda "Sin asignar" y el "Siguiente paso" del Manager lo marca.
4. **El PM y "Create PM service".** El mecánico PM puede seguir uniéndose a una WO abierta. Si el responsable por defecto del PM es Daniel, ¿otro mecánico PM puede tomarlo?
5. **WOs abiertas hoy.** No se cambian. ¿Se les agregan los pasos obligatorios que les falten (caso 905), o se cierran a mano?
6. **Categoría de la WO.** Si desaparece al crear la WO, ¿qué muestran las listas en su lugar? Propuesta: "Truck 922 · 5 jobs · Siguiente: PM".
7. **Bloqueos de toda la WO.** Hay casos que afectan a todo el truck, como "Truck Unavailable". ¿Siguen siendo por job, o se agrega "bloquear toda la WO" solo para el Manager, usando la pausa?

---

## 10. Propuesta de orden de trabajo

Cada paso sería un PR contra `main`. Los que tocan la base de datos llevan su migración en un PR aparte.

| # | PR | Contenido | Depende de |
|---|---|---|---|
| 1 | **Errores rápidos** | Puntos 1–11 de la sección 8 | — |
| 2 | **Vocabulario** | Sección 7 en EN y ES, y estados reales de los jobs | 1 |
| 3 | **Reglas del bloqueo** (D12, D17) | Bloqueo por job; el tiempo se detiene; solo el Manager resuelve; motivos recortados; migración (`job_id` en el bloqueo) | Preguntas 1 y 7 |
| 4 | **Dueño de cada job** (D11) | Se quita "inherits team"; el mecánico ve solo lo suyo; "Terminaste tu parte"; tiempo por mecánico | — |
| 5 | **Flujo del taller** (D15, D16) | Tabla de paso → responsable, pantalla en Setup, aplicación al crear la WO; migración | 4 |
| 6 | **Crear WO simple** (D13) | Solo el truck; sin categoría ni jobs | 5 |
| 7 | **Truck como lugar de trabajo** (D14) | "Siguiente paso" completo, inspección arriba, asignar en el Work Plan, cerrar y Return to Service en el Truck | 4, 5 |
| 8 | **Coherencia Dashboard / Yard** | Una sola regla de "siguiente paso" con motivos y botones; caso de WOs viejas (punto 12) | 7, pregunta 5 |

**Antes de programar:** hacer un boceto de pantallas (Truck del Manager, Flujo del taller, inicio y WO del mecánico) y aprobarlo.

---

## Anexo: hallazgos detallados

### Dashboard (inicio del Manager)
- Las 6 métricas son enlaces sin nombre accesible. "Open more than 24h: 1" no dice cuál es.
- "Needs attention" incluye WOs sin motivo. Solo "READY TO CLOSE" y "ACTIVE BLOCKER" explican por qué están ahí.
- No hay nada sobre jobs sin mecánico (M02) ni sobre trucks Ready to Go (M04).
- Dashboard (por WO) y Yard (por truck) compiten como punto de partida.

### Lista de trucks
- La descripción usa jerga: "operational status from recorded service-status events. Off Duty is not inferred."
- El 922 dice "In Service" aunque tiene una WO abierta y está Not Ready.
- No hay columna de "siguiente paso".

### Detalle de Truck (M01)
- Lo primero que se ve son los datos del truck; la inspección queda abajo.
- El botón principal es "Add work", no la inspección.
- "Inspection" aparece con tres significados: la categoría de la WO, la tarjeta de inspección y la tarjeta de estado ("4 remaining" se refiere a jobs).
- "Mandatory for every yard Truck" es jerga.
- "Mark complete" en azul en jobs que nadie ha hecho.
- No se puede asignar desde el Work Plan.
- En "Add work", la lista de lo seleccionado se titula "Jobs in this Work Order" antes de agregarse a la WO. El selector de categoría ofrece otra vez PM, Inspection, Detailing y QC.
- Después de "Add to Work Plan" no se sugiere el siguiente paso.
- "Add Alignment" no deja el job preseleccionado, y el botón sigue ahí después de agregarlo.
- Dejar un truck listo tomó unos 12 clics (agregar paso → elegir job → agregar → marcar completo, tres veces).
- "Every step is done. Complete the Work Order…", pero el Truck no tiene el botón para hacerlo.

### Detalle de WO (M02)
- "Next step" existe (bien), pero olvida los jobs sin asignar.
- Dos modelos de asignación: por job y "Assignments" (equipo). Asignar un job agrega también al mecánico al equipo, sin avisar.
- Cada job muestra 4 o 5 controles. "Confirm job cancellation" aparece siempre en rojo, y su campo de motivo está lejos, debajo de todos los jobs.
- El job de PM dice "PM started" pero su estado es TO DO.
- La página es muy larga y todo está abierto: pausa (deshabilitada), cancelar WO, datos del truck duplicados, historial.
- Return to Service está en la 5.ª tarjeta, con el mismo peso que "Reopen" y con motivo obligatorio.
- El panel "Complete Work Order" está bien destacado, pero su texto es de sistema y no dice que el truck pasa a Ready to Go.

### Bloqueo (M03)
- El Dashboard muestra el motivo, pero no la nota, quién la reportó ni cuándo.
- "Waiting / Paused: 0" en el Dashboard, mientras el Yard dice "1 paused (blocked)"; la WO no está pausada.
- La tarjeta del Yard muestra "Blocked" sin el motivo.

### Mecánico Standard
- La línea resumen lista categorías, no jobs ("Suspension & Steering, Detailing… · 0 of 5"). El total incluye el PM de otro mecánico.
- La prioridad aparece dos veces.
- Los únicos botones con nombre en la WO son "Mark resolved" y "Report Blocker"; los jobs son botones con un "○".
- "View completed work (3)" repite la pestaña Completed.
- Completed muestra WOs cerradas por el Manager como "trabajo que terminaste", sin fechas.

### Mecánico PM
- En el inicio, "Work Order WO-007" aparece dos veces en la misma tarjeta.
- El título cambia según el rol: "PM Mechanic" en uno y "My Assigned Work" en el otro.
- Hay 9 selectores de partes, todos en "No part used", y no se indica qué partes suele llevar un PM A. Con una sola parte ya se puede terminar.
- La confirmación final ("actualizará el millaje de 97,000 a 97,450") está bien. Después vuelve al inicio con un aviso (bien).
- No ve el resto del trabajo del truck (por ejemplo, que el truck espera partes).

---

## 11. Revisión (2026-09-27)

**Contra qué se revisó:** PRD (`docs/LIGHTNING_SHOP_MASTER_PRD.md` §4, §9, §22, §27–28 y Decision Log), código en `main` (`974bcca`), Linear (doc 16 "Plan de mejora", decisiones D1–D10, épicas LTR-117 y LTR-141, issues LTR-98, LTR-124, LTR-145, LTR-123).

**Veredicto:** la lógica de fondo es correcta y sigue el PRD. Antes de programar hay que cerrar los puntos de 11.1, corregir el texto según 11.2 y reordenar el plan según 11.3.

### 11.1 Choques con decisiones vigentes (requieren decisión explícita)

| # | Choque | Qué hacer |
|---|---|---|
| R1 | **D17 reemplaza a D3** (LTR-98, 25-sep): D3 dice que el blocker lo resuelve "el mecánico o el Manager" y que "no afecta labor/waiting". El doc omite D3 en "decisiones que siguen vigentes". | Escribir "D17 reemplaza a D3" y anotarlo en el doc 16 de Linear y en LTR-98. |
| R2 | **"Su tiempo se detiene" no existe con el modelo actual.** La sesión de labor es por WO (`work_sessions` solo tiene `work_order_id`). D7 (LTR-124) decidió "labor por WO, sin `userId`". "Terminaste tu parte" y "el bloqueo detiene su tiempo" requieren labor por mecánico: migración y reversión de D7. Con dos mecánicos en la misma WO, hoy se detendría el reloj de ambos. | Decidir labor por mecánico (nueva decisión que reemplaza a D7) y responder: ¿labor de la WO = suma de mecánicos? ¿"Active labor" del Dashboard (LTR-94) cambia de significado? |
| R3 | **D11 revierte Q10 y Q17** del Decision Log del PRD ("un job sin asignar lo ejecuta cualquier miembro del equipo"; "`MechanicAssignment` sigue siendo el equipo general"). El doc 15 de Linear fija el PRD como autoridad. El doc no dice qué pasa con `mechanic_assignments` ni con el selector "Assignments" de la WO. | Registrar D11 en el Decision Log del PRD. Decidir: el equipo se deriva de los assignees por job (propuesta) o desaparece. |
| R4 | **D15 "QC → Manager" choca con la asignación.** Pickers y API asignan solo usuarios con capability de mecánico. Hoy el Manager completa jobs desde Admin con "Mark complete" (LTR-38), y este doc quiere degradar ese botón. | Decidir: (a) QC se asigna al Manager y se permiten assignees sin capability de mecánico, o (b) QC lo hace el Manager desde el Truck sin asignación y "Mark complete" sigue siendo primario solo en QC. |
| R5 | **D12 y el PM legacy.** Q13 mantiene la pausa del mecánico PM. Con `WORK_PLAN_PM_PHASE` el PM es un job dentro de la WO Standard y ya no hay pausa, pero las WO de PM viejas siguen con pausa. | D12 debe decir si también se quita la pausa a las WO de PM legacy. |

### 11.2 Hechos del doc que no coinciden con el código

| Sección | Dice el doc | Realidad | Corrección |
|---|---|---|---|
| §3.5, D13, PR 6 | "Cada WO obliga a elegir categoría y jobs" | El formulario no pide categoría; la deriva del primer job. Sí exige ≥1 job. Con el flag encendido los 4 obligatorios ya se agregan solos (LTR-145, `apps/api/src/work-orders/mandatory-jobs.ts`). | D13 ya está a medias. Lo que falta: quitar el requisito de ≥1 job y agregar responsables por defecto. PR 6 es más chico. |
| D12 | Break, End of Shift y Working on Another WO están en los motivos de bloqueo | Correcto. Causa: el blocker se guarda como `PauseEvent` y reutiliza el enum `PauseReason` (11 valores). | PR 3 crea un `BlockerReason` propio (junto con `job_id`), no solo filtra en UI. |
| §3.2, PR 8 | "Dashboard, Yard y Truck no coinciden" | "Needs attention" ya tiene una sola regla con motivo por item (LTR-121, `packages/shared/src/attention.ts`) y el Dashboard sí muestra el motivo. Lo que no está unificado es el **siguiente paso**: cuatro implementaciones (`yard-work-plan-derivation.ts` en API, `work-plan.ts` en Truck, `yard-card.ts` en Yard, `admin-next-step.ts` en WO, esta última basada solo en el estado de la WO). | PR 8 = unificar esas cuatro funciones en una. El Dashboard solo necesita el botón directo a la acción. |
| §8.2, PR 2 | "Estados reales de los jobs" como cambio de vocabulario | Los jobs Standard nunca tienen `startedAt` (solo el PM lo usa). "En curso" a nivel job no existe; el paso copia el estado de la WO. | PR 2 no es solo copy: hace falta setear `startedAt` en el job (al primer toque o con "Start job"). Mover a PR 4 o a un PR propio. |
| §8.1 | "Mechanic note: undefined" | No reproducible en `main`: la línea solo se renderiza si hay nota y la API devuelve string o null. Probable web/API desincronizadas (LTR-142) o ya cerrado por LTR-86. | Verificar en prod antes de meterlo en PR 1. |
| §8.4 | "La lista de mecánicos incluye cuentas admin" | La API filtra por capability `mechanic.standard` / `mechanic.pm`, no por rol. Esas cuentas tienen capability de mecánico en el roster (LTR-99). Además el picker carga solo la primera página de 25 mecánicos. | Arreglo de datos (quitar capability) o filtrar por rol; decidir cuál. Agregar paginación del picker a PR 1. |
| §8.7 | El texto de Return to Service dice que no cambia Ready to Go, pero sí | Confirmado: `apps/api/src/admin/yard-ready-window.ts` saca el truck de Ready to Go al hacer RTS. | Sin cambio. |
| §6 Mecánico Standard | "Se quita la sección Paused" | Esa sección muestra WOs pausadas oficialmente por el Manager. Si se quita, el mecánico no sabe por qué su WO no avanza. | Renombrar a "Pausada por el Manager", solo lectura. |
| §5 completo | Flujo objetivo | Asume `YARD_WORK_PLAN_SLICE1`, `SLICE2` y `WORK_PLAN_PM_PHASE` encendidos; las tres siguen "default off" en código. | Agregar **PR 0: flags como único modo** (retirar código flag-off, incluir `YARD_READY_TO_GO_SINCE`). Sin esto PR 6 y 7 no tienen sentido. |

### 11.3 Ajustes al orden de trabajo (sección 10)

| Cambio | Motivo |
|---|---|
| Agregar **PR 0: flags como único modo** | Ver 11.2, última fila. |
| Agregar **PR de migración** antes de PR 3 y PR 4: `work_sessions.user_id`, `pause_events.job_id`, enum `BlockerReason` | Regla 9 del plan de mejora: migraciones en PR propio. PR 3 ("el tiempo se detiene") depende de la labor por mecánico que hoy está en PR 4. |
| PR 3 depende de la migración y de PR 4, no solo de las preguntas 1 y 7 | R2. |
| PR 4 incluye la decisión sobre `mechanic_assignments` y el `startedAt` de jobs Standard | R3 y §8.2. |
| PR 7 = **LTR-123** (backlog, hijo de LTR-117) | Ya existe; enlazar en vez de crear otro. |
| PR 8 nombra las cuatro funciones de "siguiente paso" a unificar | 11.2. |
| Crear épica en Linear con D11–D17 | Ninguna de las siete decisiones existe en Linear. LTR-117 sigue In Progress; LTR-59 (Truck Detail canónico) y LTR-60 (Ready vs Complete vs RTS) cubren parte de los pasos 5 y 6 y deben colgar de la épica nueva o cerrarse. |

### 11.4 Respuestas propuestas a preguntas abiertas

| Pregunta | Propuesta |
|---|---|
| 4 (PM y "Create PM service") | Cualquier `mechanic.pm` que arranca el PM job se lo autoasigna, respetando D2 (un PM en curso por mecánico). Hoy el mecánico PM asignado ya puede cambiar A↔B, así que el modelo lo permite. |
| 5 (WOs abiertas hoy) | LTR-145 decidió "sin backfill". Botón "Agregar pasos que faltan" en el Truck, por WO, en lugar de migración automática. Cubre el punto 8.12. |

### 11.5 Lo que está bien y no necesita cambio

- D1, D2, D4+D9, D5, D6, D8 y D10 coinciden con Linear y con el código.
- D14 coincide con el código: registrar la inspección requiere `yard.operations.manage`; los mecánicos no pueden.
- La sección 7 de vocabulario es consistente con el glosario aprobado en LTR-118.
- Las preguntas 1, 2, 3, 6 y 7 son las correctas y siguen abiertas.

---

## 12. Decisiones cerradas (Cristian, 2026-09-27)

Cierran los puntos R1–R5 de la sección 11.1 y las preguntas abiertas de la sección 9. Estas decisiones mandan sobre el texto anterior del documento cuando se contradicen.

| # | Decisión | Origen |
|---|---|---|
| **D17 reemplaza a D3** | Solo el Manager resuelve el bloqueo. El mecánico puede agregar una nota al bloqueo ("ya llegó la parte") pero no lo cierra. | R1, elegido |
| **D18 — Labor por mecánico (reemplaza a D7)** | La sesión de labor lleva `userId`. La labor de la WO es la suma de sus mecánicos. El tiempo de un mecánico se detiene al terminar su último job en la WO o al bloquear el último job que le quedaba disponible ahí. Vuelve a correr cuando el mecánico toca **Continuar** o **Start**, nunca solo porque el Manager resolvió. | R2 + pregunta 1, elegido |
| **D11 — Equipo derivado** | El equipo de la WO = mecánicos con al menos un job asignado. Desaparece el selector "Assignments" de la WO. La tabla `mechanic_assignments` se conserva como cache derivado, sincronizado en assign/unassign, porque la lectura de la WO por el mecánico depende de ella. | R3, elegido |
| **D15 — QC sin responsable** | QC no lleva assignee. El Manager lo completa desde el Truck con "Mark complete", que queda como botón primario **solo** en QC. En los demás jobs pasa a secundario. | R4, elegido |
| **D12 — PM legacy** | Las WO de PM legacy (creadas antes de `WORK_PLAN_PM_PHASE`) conservan su pausa (Q13). No se tocan. El PM dentro de la WO del truck no tiene pausa. | R5, por defecto |
| **D17 — Solo por job** | El bloqueo siempre es de un job. "Truck Unavailable" sale de los motivos del mecánico. Si algo afecta a todo el truck, el Manager usa la pausa oficial. | Pregunta 7, elegido |
| **Avisos** | Solo dentro de la app: distintivo en el inicio del mecánico y "Needs attention" del Manager. No hay push. | Pregunta 2, por defecto |
| **Responsable por defecto inactivo** | El paso nace "Sin asignar" y el "Siguiente paso" del Manager lo marca. | Pregunta 3, propuesta del doc adoptada |
| **PM y "Create PM service"** | Cualquier `mechanic.pm` que arranca el PM job se lo autoasigna, respetando D2 (un PM en curso por mecánico). | Pregunta 4, propuesta 11.4 adoptada |
| **WOs abiertas hoy** | Sin backfill automático. Botón "Agregar pasos que faltan" en el Truck, por WO. Cubre 8.12. | Pregunta 5, propuesta 11.4 adoptada |
| **Listas sin categoría** | "Truck 922 · 5 jobs · Siguiente: PM". | Pregunta 6, propuesta del doc adoptada |

Las filas marcadas "por defecto" o "adoptada" se eligieron sin pregunta explícita. Si alguna no es la intención, cambiarla aquí antes de ejecutar el PR que la usa.

**Ejecución:** el orden definitivo de PRs, con prompts listos para un modelo de menor costo, está en `docs/agents/FLUJO_V3_RUNBOOK.md`. Los issues viven en la épica de Linear **LTR-149** (hijos LTR-150 a LTR-159).
