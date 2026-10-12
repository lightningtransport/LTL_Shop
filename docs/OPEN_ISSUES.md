# Pendientes: defectos, limpieza y salida en vivo

**Actualizado:** 2026-10-12 (§1s: revisión de velocidad y "feel", PF1–PF14; §1r: auditoría de IA y task flows de Parts & costs; §1q: auditoría UX del modo demo)

Una sola lista de lo que falta. Cuando algo se arregla, se borra de aquí
(el historial queda en git y en Linear). El orden es el orden de trabajo.

## 0. Cómo terminamos esto (plan de cierre)

**Linear:** épica [LTR-173](https://linear.app/ltransl/issue/LTR-173). Cada fase y cada defecto B/C tiene su issue hijo; el número va en su fila.

### Por qué siguen apareciendo defectos

No es mala suerte ni datos corruptos. Son tres causas, y las tres se
arreglan con método, no con más trabajo:

1. **Nunca se revisó el sistema completo de una vez.** Cada revisión miró
   un ticket (una pantalla, un texto, un botón). Los defectos que quedan son
   de **flujo**: pasan cuando dos partes se combinan (el PM arranca, el
   Manager completa, nadie hizo Start). Eso no lo ve una revisión por ticket.
2. **Las pruebas no prueban el sistema real.** Las 16 pruebas e2e corren
   contra una API falsa. "Pasa las pruebas" hoy no significa "funciona".
3. **Cada defecto nuevo se sentía como empezar de cero**, porque no había
   una lista cerrada. Ahora la hay: este documento. Un defecto nuevo se
   anota aquí, se clasifica y se sigue con el plan. No se reinicia nada.

### Reglas mientras cerramos

- **Alcance congelado.** No entra ninguna función nueva hasta terminar la
  Fase C. Lo nuevo va a §6 y espera.
- **Todo defecto se clasifica** al anotarlo:
  **B** bloqueante (un flujo no se puede terminar o deja datos mal),
  **C** confuso (se puede terminar, pero el usuario no sabe cómo),
  **E** estético. Antes de salir en vivo se arreglan B y C. Los E, después.
- **Un flujo está "terminado" solo cuando su fila de la matriz dice PASA
  contra el sistema real** (`npm run test:real`). No cuando "se ve bien".
- Un PR que arregla un defecto trae su prueba y borra la fila de aquí.

### Fase A — Auditoría única de flujos — LTR-174 — **HECHA (2026-09-29)**

Se recorrieron todas las historias de [`USER_FLOWS.md`](USER_FLOWS.md) una
vez, contra el sistema real (API real + base de datos local, no la API
falsa). Quedó como prueba repetible:

```bash
npm run test:real:setup --workspace=@ltl-shop/api   # una vez: crea y carga la base ltl_shop_test
npm run test:real --workspace=@ltl-shop/api         # corre todo y escribe la matriz
```

**Resultado (al cierre de la Fase A):** 56 comprobaciones · 43 funcionan ·
11 fallan · 2 no aplican. **Hoy:** 69 comprobaciones · **67 funcionan · 0 fallan** · 2 no aplican
(defectos #1, #2, #4 y #7 arreglados: LTR-175, 176, 177, 182; Quality Check
de Safety construido: LTR-185; personal del taller A29–A31: LTR-187; cierre del día y un reloj por mecánico A32, A33, E7: LTR-186; ayudante y taller externo A34, A35: LTR-188; el Manager mantiene el catálogo A36: D25). Matriz completa: `apps/api/test-real/results/matrix.md`. Las 11
fallas son 5 defectos:

| Defecto | Filas que fallan | Clase | Ticket |
|---|---|---|---|

Con esto **la lista de defectos de flujo está cerrada**. Lo que aparezca
después se anota en §1 con su clase y su fila de prueba, pero no cambia el
plan.

**Lo que la auditoría no cubre** (se revisa en pantalla, `USER_FLOWS.md` §7):
inicio de sesión real, idioma, tema, app instalada, textos y pantallas
vacías/de error.

**Fila A28 (Work Orders de PM del modelo viejo):** no aplica. Ya no se pueden
crear y en producción no queda ninguno abierto (consulta de solo lectura del
2026-09-29: 0). El código de pausa / reanudar / terminar del mecánico PM se
puede borrar en la limpieza (§3).

### Fase B — Arreglar bloqueantes (B) y confusos (C), uno por PR — **HECHA (2026-10-05)**

Orden: ~~#1~~ ~~#2~~ ~~#4~~ ~~#7~~ hechos (LTR-175, 176, 177, 182) → ~~#9 (LTR-184)~~ ~~#6 (LTR-178)~~ hechos → recorrido de
pantallas hecho (§1d, LTR-189) → los C de §1d (~~W1~~ ~~W2~~ ~~W4~~ ~~W11~~ ~~W12~~ ~~W14~~ ~~W15~~ ~~W17~~ ~~W9~~ ~~W5~~ hechos; ~~W16~~ ~~W3~~ ~~W6~~ ~~W7~~ ~~W8~~ ~~W10~~ ~~W13~~ **todos hechos**) → ~~los de §1b
(LTR-179)~~ hechos (2026-09-30) → Fase C. El #8 pasó a LTR-185 (D19: solo Safety puede ser dueño de QC).

**Hecho:** el Quality Check de Safety (D19, LTR-185); alta del personal (D22,
LTR-187); cierre del día y un reloj por mecánico (D20, D21, LTR-186); ayudante
y taller externo (D23, D24, LTR-188). P11 (trailers) queda para después de
salir en vivo. Regla que sigue vigente para cualquier arreglo: su fila en
`test-real/` pasa a PASA + `USER_FLOWS.md` pasa a ✅ + fila borrada de aquí.

### Fase C — Limpieza (§3, LTR-180) e idioma (§4, LTR-181) — **HECHA (2026-09-30)**

Borrar el código heredado y unificar los textos, para que nadie vuelva a
construir sobre algo muerto.

### Fase D — Salir en vivo (§5) — LTR-45 — **EN ESPERA** (2026-10-09: el dueño decidió no salir en vivo todavía)

Paso a paso en [`GO_LIVE_CHECKLIST_ES.md`](GO_LIVE_CHECKLIST_ES.md): migrar y
desplegar, cuentas reales, bypass apagado, un día de prueba con gente real.
**El uso real es lo que confirma que está terminado.**

### Cómo saber que terminamos

- Todas las filas de `apps/api/test-real/results/matrix.md` dicen PASA o
  NO APLICA.
- Todas las historias de `USER_FLOWS.md` están en ✅ (o 👁 revisadas a mano).
- §1 y §1b no tienen ningún B ni C.
- Hay usuarios reales trabajando un día completo sin un defecto B.

Todo lo demás es mejora, y va a §6 hasta que se decida.

## 1. Defectos: flujos que se atoran

| # | Problema | Qué pasa | Dónde |
|---|---|---|---|
| ~~3~~ | **Custom Jobs sin revisión** — **E (bajó de C), decidido D25 (2026-10-05)** | **Hecho (2026-10-05):** el Manager agrega y edita Jobs del catálogo (Admin → Job Catalog) y, en el Work Plan, puede marcar "Agregar también al catálogo" al crear un Job personalizado; un nombre repetido en la categoría no se acepta y se elige el que existe (fila A36; A26 sin 403 para el Manager). **Sigue:** los Custom Jobs viejos quedan en `pending_review` sin pantalla; la bandeja para revisarlos va después (LTR-57). | `work-orders.service.ts` (l. 367, 851), `admin.controller.ts` (catálogo) **Cerrado (2026-10-09):** la bandeja **Job Catalog → Custom Jobs to review** agrupa los Custom Jobs y los liga al catálogo, los agrega o los deja como únicos, con Deshacer (LTR-57, A76–A79). |
| ~~5~~ | ~~"Mechanic note: undefined"~~ — cerrado | No se reproduce en el recorrido de pantallas del 2026-09-29 (§1d). | — |


## 1c. Huecos de operación (cuestionario del 2026-09-29)

No son defectos: es trabajo del taller que la app no cubre. Cada uno
necesita su decisión en `DECISIONS.md` antes de construirse. Las historias
están en `USER_FLOWS.md` §6.

| # | El taller | La app hoy | Clase | Ticket |
|---|---|---|---|---|
| ~~G2~~ | **Hecho 2026-10-05 (D20, LTR-186):** a las 5:00 p.m. de cada día hábil la app cierra los relojes que sigan corriendo; el tiempo cuenta hasta las 5:00 ("cierre del día"); fuera de horario, a las 11:59 p.m. El Manager cambia hora y días en Setup. Sin programador: cierre perezoso en cada lectura/escritura de tiempo + Vercel Cron de respaldo. Filas A32, A33 | — | — | LTR-186 |
| ~~G3~~ | **Hecho 2026-10-05 (D23, LTR-188):** "Agregar ayudante" en el `…` del Job crea un Job aparte "· ayudante" con su dueño; su reloj corre normal; el bloqueo o la cancelación del principal no lo tocan. Fila A34 | — | — | LTR-188 |
| ~~G4~~ | **Hecho 2026-10-05 (D24, LTR-188):** "Enviar a taller externo" (sale la pieza o el camión, con nota): sin dueño ni reloj, siguiente paso "En taller externo", el WO no cierra, el Yard dice "Fuera del taller"; "Regresó" → completar o asignar. Fila A35 | — | — | LTR-188 |
| ~~G5~~ | **Hecho 2026-09-30 (D22, LTR-187):** el Manager da de alta al personal (Standard, PM, Safety) con cuenta de acceso y contraseña temporal; desactiva solo sin trabajo abierto; reinicia contraseñas. Filas A29–A31. Camiones: después | — | — | LTR-187 |
| G6 | El taller también trabaja trailers — **después de salir en vivo, cuando Cristian lo indique** | Solo camiones | diferido | LTR-56 |
| ~~G7~~ | **Hecho 2026-10-05 (D21, LTR-186):** Start/Continue en otro camión cierra el reloj del anterior ("cambio de camión"); al volver, "Tu reloj está en la unidad … · toca Continuar". Fila E7 | — | — | LTR-186 |

**Efecto en los defectos:**

## 1b. Defectos menores de la UI móvil (LTR-165, revisión 2026-09-29) — LTR-179 — **HECHO (2026-09-30)**

| # | Problema | Dónde |
|---|---|---|
| ~~U1~~ | ~~Archivo de build en git~~ — **hecho** (2026-09-30): `apps/web/.next-d14/trace` fuera del repo; `.gitignore` cubre `.next-*`. | `.gitignore` |
| ~~U2~~ | ~~`next-env.d.ts` apunta a `.next-e2e`~~ — ya apuntaba a `./.next` en main (2026-09-30). | `apps/web/next-env.d.ts` |
| ~~U3~~ | ~~Sin botón Clear en el teléfono~~ — **hecho** (2026-09-30): aparece en cuanto hay algo que limpiar. | `ui.tsx` |
| ~~U4~~ | ~~iPad: nombre/rol bajo el indicador de inicio~~ — **hecho** (2026-09-30): padding seguro en el bloque. | `admin-shell.tsx` |
| ~~U5~~ | ~~Barra de estado sigue al sistema, no al tema de la app~~ — **hecho** (2026-09-30): un solo `theme-color`, actualizado por `BrowserThemeColor`. | `layout.tsx` |
| ~~U6~~ | ~~Cambio de contraseña pendiente bloquea el menú de perfil~~ — **hecho** (2026-09-30): el menú abre siempre; el cambio pendiente es un aviso dentro con botón. | `ui.tsx` |
| ~~U7~~ | ~~`moreActionsHelp` menciona corrección de tiempos~~ — **hecho** (2026-09-30). | `admin-messages.ts` |
| ~~U8~~ | ~~Textos sin uso del Admin~~ — **hecho** (2026-09-30): 11 descripciones borradas de EN/ES. Quedan ~130 claves sin uso en `admin-messages.ts` (Yard fase 1, readiness legacy): las retira LTR-180. | `admin-messages.ts` |
| ~~U9~~ | ~~Admin en español dice "unidad(es)"~~ — **hecho** (2026-09-30): 15 textos a "Truck(s)", incluido Nuevo Work Order. | `admin-messages.ts` |
| ~~U10~~ | ~~Reintento de `work-plan/jobs` recibe `VERSION_CONFLICT` tras un fallo a mitad~~ — **hecho** (2026-09-30): si el primer Job hijo ya quedó registrado, se salta la verificación de versión y cada hijo replica; dos reintentos simultáneos no chocan (P2002 se ignora). | `yard-work-plan.service.ts` |

## 1d. Recorrido de pantallas (2026-09-29, teléfono, EN/ES, API real) — LTR-189

Recorrido completo de las historias de `USER_FLOWS.md` con los 9 escenarios de
demo (`reset-demo-work-orders --local --apply`) contra la API real, en un
viewport de 375 px, en español y con muestreo en inglés. Ningún flujo se atora:
todo lo que falla aquí es **C (confuso)** o **E (estético)**, salvo W4 que
lanza un error real en consola. Se arreglan en este orden, uno o dos por PR,
empezando por W1 (el que reportó el dueño).

| # | Clase | Rol | Problema | Dónde |
|---|---|---|---|---|
| ~~W1~~ | C | Manager | ~~Tarjeta "Jobs" del Work Order sin jerarquía~~ — **hecho** (2026-09-30): fila de acciones por Job y diálogo con motivo para cancelar/reabrir. | `admin-work-order-detail.tsx` |
| ~~W2~~ | C | Manager | ~~"Completar Work Order" visible con error antes de tiempo~~ — **hecho** (2026-09-30): la tarjeta solo existe cuando el Work Order ya puede cerrarse. | `admin-work-order-detail.tsx` |
| ~~W3~~ | C | Manager | ~~Panel repite "Atención" y "Siguiente paso"~~ — **hecho** (2026-09-30): la línea de atención solo sale cuando no hay paso siguiente. | `admin-work-order-item.tsx` |
| ~~W4~~ | C | Manager | ~~Error de hidratación de React en la lista de Trucks~~ — **hecho** (2026-09-30): el badge va en un `<div>`. | `admin-trucks-list.tsx` |
| ~~W5~~ | C | Manager | ~~"Estado operacional: Unknown — no hay un evento…"~~ — **hecho** (2026-09-30): dice "Sin registro" / "Not recorded". | `admin-messages.ts` |
| ~~W6~~ | E | Manager | ~~Buscador cortado y "Aplicar filtros" primario en Trucks~~ — **hecho** (2026-09-30): "Buscar Trucks" y botón "Buscar". | `admin-trucks-list.tsx` |
| ~~W7~~ | C | Manager | ~~Work Plan: "Marcar completado" sin jerarquía; "Categoría: Inspection"~~ — **hecho** (2026-09-30): botón visible (primario solo en QC) y sin categoría legacy en "Trabajo actual". | `admin-truck-work-plan.tsx`, `admin-truck-detail.tsx` |
| ~~W8~~ | C | Manager | ~~Lista de Work Orders repite "N Jobs · Siguiente"; subtítulo en jerga~~ — **hecho** (2026-09-30): con paso siguiente la línea solo cuenta Jobs; subtítulo "Todos los Work Orders del Shop, abiertos y cerrados." | `admin-work-order-item.tsx`, `admin-messages.ts` |
| ~~W9~~ | C | Manager | ~~Setup → Shop workflow: QC dice "Manager, sin asignación"~~ — **hecho** (2026-09-30): "Safety (Control de calidad) lo toma de la cola". | `admin-messages.ts` |
| ~~W10~~ | E | Manager | ~~Subtítulo "WO-005 · Inspection"~~ — **hecho** (2026-09-30). | `admin-work-order-detail.tsx` |
| ~~W11~~ | C | Mecánico | ~~"Completados" solo listaba Work Orders cerrados~~ — **hecho** (2026-09-30): lista los Jobs que el mecánico completó, en Work Orders abiertos o cerrados. | `mechanic-completed-page.tsx`, `lib/my-completed-jobs.ts` |
| ~~W12~~ | C | Mecánico | ~~Sin botón "Completar" visible en el detalle~~ — **hecho** (2026-09-30): cada Job mío es una tarjeta con "Completar Job" (primario) y "Reportar bloqueo" al lado. | `app/work-orders/[id]/detail-client.tsx` |
| ~~W13~~ | E | Mecánico | ~~Ayuda escondida en el diálogo de bloqueo~~ — **hecho** (2026-09-30): va encima de los botones. | `detail-client.tsx` |
| ~~W14~~ | C | PM | ~~Cinco "Iniciar servicio PM" primarios con otro PM activo~~ — **hecho** (2026-09-30): con un PM en curso, las tarjetas "Listos para iniciar" ofrecen "Ver trabajo" (secundario) y el aviso dice "Termina WO-xxx antes de iniciar otro". | `app/page.tsx` |
| ~~W15~~ | C | PM | ~~Sin pausa ni notas; "Guardado" escondido; dos tarjetas "Servicio de PM"~~ — **hecho** (2026-09-30): el PM no pausa (D17: reporta bloqueo) y el aviso ya no lo promete; hilo de notas en el detalle; "Guardado automáticamente" junto al título; la primera tarjeta se llama "Tipo de servicio". | `pm-job-detail.tsx`, `pm-service-card.tsx` |
| ~~W16~~ | E | Safety | ~~"Tomar" secundario~~ — **hecho** (2026-09-30): "Tomar" es primario. El aviso antes del refresco de la tarjeta queda como está (es SWR, medio segundo). | `quality-check-page.tsx` |
| ~~W17~~ | C | Safety | ~~Dice "Truck" donde el mecánico dice "Unidad"; etiquetas del diálogo Devolver~~ — **hecho** (2026-09-30): "Unidad 968 es tuya", "Devolver unidad 968", campo "Qué encontraste", botón "Cancelar". | `lib/locale-context.tsx`, `quality-check-page.tsx` |

Confirmado en el recorrido: U9 (Nuevo Work Order dice "Unidad"). El defecto #5
("Mechanic note: undefined") **no se reproduce**: la nota del mecánico se ve
bien en el Admin ("Mechanic note: Batería nueva instalada.") y en el detalle
del mecánico; queda cerrado.

## 1e. Work Order Detail (Admin): rediseño propuesto (2026-10-05) — **CERRADO** (Etapas 1–8, #244, en producción el 2026-10-06) · Linear [LTR-190](https://linear.app/ltransl/issue/LTR-190)

Revisión de la pantalla en producción (WO-010). Ningún flujo se atora: son
**C** y **E**. La propuesta completa (maqueta navegable, qué hace cada
botón, plan y decisiones pendientes) está en
[`proposals/wo-detail-redesign/`](proposals/wo-detail-redesign/README.md).
Se retoma cuando el dueño responda sus decisiones (§5 de la propuesta).

| # | Clase | Problema | Dónde |
|---|---|---|---|
| ~~R1~~ | C | ~~Datos repetidos: el Truck 3 veces, los tiempos 2, los mecánicos 3~~ — **hecho** (2026-10-06, Etapa 5): una tarjeta Truck (millaje, VIN, empresa), tiempos con barras por mecánico y prioridad; sin Operational summary ni Truck details; los tiempos completos solo en Historial › Tiempos | `admin-work-order-detail.tsx` |
| ~~R2~~ | C | ~~"Next step" y la caja de blockers dicen lo mismo; textarea de Resolve siempre abierto~~ — **hecho** (2026-10-06, Etapa 5): cuando el paso es resolver, el blocker vive en el aviso del Next step; la nota se abre con Resolve; los resueltos van plegados | `admin-work-order-detail.tsx`, `admin-blocker-resolve.tsx` |
| ~~R3~~ | E | ~~Todo es tarjeta con el mismo peso; "Mark complete" con borde en cada fila~~ — **hecho** (2026-10-06, Etapa 5): Jobs bloqueados arriba con borde ámbar, estado como punto + texto, "Mark complete" discreto (primario solo en QC), selector de mecánico con búsqueda y "Quitar asignación", hechos y cancelados plegados | `admin-job-table.tsx`, `lib/work-order-jobs.ts` |
| ~~R4~~ | E | ~~Activity Log plano; corrección de tiempo como formulario siempre visible~~ — **hecho** (2026-10-06, Etapa 5): Historial con pestañas (Actividad por día con "Ver todo", Tiempos, Pausas); "Corregir…" en cada tramo abre un diálogo que valida fin > inicio y motivo | `work-order-history.tsx` |
| ~~R5~~ | E | ~~"…" (WO y Job) abre un modal para 1–2 opciones~~ — **hecho** (2026-10-06, Etapa 5): menús desplegables; el "…" de la WO suma "Corregir tiempo…" | `admin-work-order-detail.tsx`, `admin-job-table.tsx` |
| ~~R6~~ | C | ~~Tema oscuro: `--card`, `--muted` y `--accent` son el mismo color; `bg-muted` y el hover no se ven sobre tarjetas~~ — **hecho** (2026-10-06, Etapa 7): en oscuro `--muted` 0.31 y `--accent` 0.33 (antes = `--card`); token nuevo `--sunken` (cabecera de la tabla de Jobs y grupos plegados). `ui-audit` sin contraste bajo en claro ni oscuro | `globals.css` |
| ~~R7~~ | E | ~~"Labor segments" en mayúsculas; los tramos salen dos veces (lista y select)~~ — **hecho** (2026-10-06, Etapas 1 y 5): `group-title` y una sola lista de tramos | `work-order-history.tsx` |
| ~~R8~~ | E | ~~Error de "Send to external shop" con `text-destructive`~~ — **hecho** (2026-10-06, Etapa 1): `text-destructive-text` | `admin-job-table.tsx` |
| ~~R9~~ | E | ~~Las clases con transparencia sobre colores del tema no generan CSS~~ — **hecho** (2026-10-06, Etapa 7): `tailwind.config.js` define cada color del tema con `color-mix(in oklch, var(--x) calc(<alpha-value> * 100%), transparent)`; `bg-primary/10` es 10 % y `bg-primary` sigue siendo el color completo. Aparecen los fondos y bordes que el código ya pedía (p. ej. `InlineAlert` en rojo). También: avatares a 12 px con contraste ≥ 4.5 y filtros rápidos del Yard a 44 px | `tailwind.config.js`, `globals.css` |
| ~~R10~~ | E | ~~Prueba e2e inestable: en la suite completa, `admin-system-admin-writes` "manager adds a Safety person…" a veces recibe "Enter a valid email." en el segundo "Add person". **Causa:** `Modal` pone el foco en el primer campo en un `requestAnimationFrame`; si alguien (o la prueba) ya empezó a escribir en otro campo, ese foco tardío se lo quita y el texto cae en Name, con Email vacío. Con la máquina cargada pasa en la prueba; con una persona rápida, en la app. La primera vez la prueba espera el foco; la segunda no~~ — **hecho** (2026-10-06): el foco tardío solo se mueve si el foco sigue fuera del diálogo (`shouldTakeInitialFocus`); la prueba espera el foco antes de escribir y una prueba nueva fuerza la carrera (falla sin el arreglo). Suite completa 114/114 | `ui.tsx` (`Modal`), `lib/modal-initial-focus.ts`, `e2e/admin-system-admin-writes.spec.ts` |

## 1f. Truck Detail (Admin) y reparto Truck ↔ Work Order (2026-10-05) — **CERRADO** (Etapas 1–8, #244, en producción el 2026-10-06) · Linear [LTR-190](https://linear.app/ltransl/issue/LTR-190)

Auditoría en [`ux-audit/admin-truck-wo/`](ux-audit/admin-truck-wo/05-navegacion-ia.md) y
propuesta con maqueta en [`proposals/truck-detail-redesign/`](proposals/truck-detail-redesign/README.md).
El dueño confirmó el reparto: el Truck responde "¿puede salir?" y la Work Order ejecuta; el Next
step actúa donde estás. Se retoma con las decisiones de §6 de esa propuesta.

| # | Clase | Problema | Dónde |
|---|---|---|---|
| ~~T1~~ | C | ~~El Truck en Ready to Go dice "Open Work Order: WO-x" y "No open Work Orders"~~ — **hecho** (2026-10-06, Etapa 1): el enlace dice "WO-x · Completed", sin "0 Jobs left · N mechanics" ni el badge "Ready to Go" repetido | `admin-truck-detail.tsx` |
| ~~T2~~ | C | ~~El Next step de la WO lleva al Truck para Resolve / Assign / Close / Return to Service~~ — **hecho** (2026-10-06, Etapa 2): `NextStepAction` actúa en la WO (Resolve lleva al bloque de blockers; Assign abre el selector; Close y Return to Service piden confirmar). Solo la inspección y un WO nuevo van al Truck | `next-step-action.tsx`, `admin-work-order-detail.tsx` |
| ~~T3~~ | C | ~~Next step `external` sin acción~~ — **hecho** (2026-10-06, Etapa 1): botón "Open in Work Order" | `admin-truck-next-step.tsx` |
| ~~T4~~ | C | ~~Jobs del Truck sin enlace a su fila en la WO; la WO vuelve siempre a la lista~~ — **hecho** (2026-10-06, Etapa 4): cada Job del Truck tiene ↗ "Manage in Work Order" (`#job-<id>`, la fila se resalta) y la WO abierta desde el Truck dice "Back to Truck 601" | `admin-truck-work-plan.tsx`, `admin-work-order-detail.tsx`, `admin-job-table.tsx` |
| ~~T5~~ | C | ~~Add work se abre al final del Work Plan, fuera de la vista; el deep link de la WO no lo abre~~ — **hecho** (2026-10-06, Etapa 4): panel lateral (hoja en el teléfono); `#add-work` lo abre | `work-plan-add-work.tsx`, `side-sheet.tsx` |
| ~~T6~~ | C | ~~Errores con nombres de permisos ("requires work_orders.manage"); el error de asignar reusa el de agregar trabajo~~ — **hecho** (2026-10-06, Etapa 4): "Only a Shop Manager can…" y error propio para asignar | `admin-messages.ts`, `admin-truck-work-plan.tsx` |
| ~~T7~~ | E | ~~La carga fallida del Truck dice "Unable to load Yard Operations."~~ — **hecho** (2026-10-06, Etapa 4): "Unable to load Truck details." | `admin-truck-detail.tsx` |
| ~~T8~~ | E | ~~Aviso de Job custom duplicado con texto equivocado~~ — **hecho** (2026-10-06, Etapa 1): "A Job with this name is already on the Work Plan or in this list." | `work-plan-add-work.tsx` |
| ~~T9~~ | E | ~~Pasos y Jobs con el mismo estilo y 12 badges; "Issues found" registrado como botón primario; textarea de Return to Service siempre abierto~~ — **hecho** (2026-10-06, Etapas 1 y 4): un chip de estado, stepper de pasos, cada paso con icono y resumen (los terminados plegados), Jobs con punto de estado; la inspección registrada es texto con "Change" | `admin-truck-detail.tsx`, `admin-truck-work-plan.tsx`, `truck-stepper.tsx` |
| T10 | E | ~~Éxito dos veces (banner + toast); h3 sin h2; Repair history sin paginar~~ — **hecho** (2026-10-06, Etapa 4): solo toast, error en línea bajo el encabezado con "Reload Truck", títulos h2, Repair history con "Load more". **Sigue:** tarjeta dentro de tarjeta en `CategoryJobList` (dentro del panel Add work) | `category-job-list.tsx` |

## 1g. Dashboard y Yard Operations (Admin) (2026-10-05) — **CERRADO** (Etapas 1–8, #244, en producción el 2026-10-06) · Linear [LTR-190](https://linear.app/ltransl/issue/LTR-190)

Auditoría en [`ux-audit/admin-dashboard-yard/`](ux-audit/admin-dashboard-yard/05-navegacion-ia.md)
y propuesta con maqueta en [`proposals/dashboard-yard-redesign/`](proposals/dashboard-yard-redesign/README.md).
El dueño confirmó el reparto: el Dashboard responde "¿qué hago ahora?" (cola de acciones en el
sitio) y el Yard "¿dónde está cada camión?". Se retoma con las decisiones de §6 de esa propuesta.

| # | Clase | Problema | Dónde |
|---|---|---|---|
| ~~D1~~ | C | ~~"Needs attention" lista las WOs abiertas > 24 h, deja fuera los Ready to Go, máximo 8~~ — **hecho** (2026-10-06, Etapa 3): el Dashboard es una cola "Needs you" con todo lo que espera al Manager (API `queue`: WOs abiertas + Truck Ready to Go), agrupada por acción y sin corte; cada fila actúa ahí (D26). "View all" se reemplazó por los enlaces de historia | `admin.service.ts` (`getDashboardQueue`), `admin-dashboard.tsx`, `lib/dashboard-queue.ts` |
| ~~D2~~ | C | ~~Los botones del Next step del Dashboard llevan al Truck; en solo lectura "Resolve" es un callejón sin salida~~ — Etapa 1 (sin permiso no hay botón) y **hecho** (2026-10-06, Etapa 2): el mismo `NextStepAction` actúa en el Dashboard y en la lista de Work Orders | `admin-work-order-item.tsx`, `next-step-action.tsx` |
| ~~D3~~ | C | ~~Métricas del Dashboard y resumen del Yard~~ — **hecho** (2026-10-06, Etapas 3 y 6): el Dashboard tiene 4 contadores que filtran; el Yard cambia sus 3 tarjetas por filtros rápidos con conteo (Todos, Bloqueados, Prioridad alta, Fuera del taller) y "Mostrando N de M camiones" | `admin-dashboard.tsx`, `admin-yard-operations.tsx` |
| ~~D4~~ | C | ~~Volver del Truck al Yard pierde filtros, búsqueda, vista y pestaña~~ — **hecho** (2026-10-06, Etapa 1): `yardOperationsFromPath` | `admin-yard-operations.tsx`, `lib/yard-operations-routing.ts` |
| ~~D5~~ | C | ~~El Yard no se refresca solo~~ — **hecho** (2026-10-06, Etapa 1): cada 30 s | `lib/admin-data.ts` |
| ~~D6~~ | C | ~~Contadores del Yard globales con filtro activo; columnas que cuentan solo lo cargado~~ — **hecho** (2026-10-06, Etapa 6): la API cuenta sobre el filtro (todas las páginas): `matching`, `total` y `quick`. **Sigue:** el número de cada carril cuenta lo cargado (25 por página) | `yard-operations.service.ts` (`getCounts`) |
| ~~D7~~ | C | ~~Return to Service del Yard sin confirmar~~ — **hecho** (2026-10-06, Etapa 1): diálogo compartido (`ReturnToServiceDialog`, motivo opcional, error específico) en el Yard y en el Truck. La WO conserva el suyo hasta su rediseño | `return-to-service-dialog.tsx` |
| ~~D8~~ | C | ~~Dispatch sin cruce con el taller; chips sin enlace; "Updated" con la hora de la consulta~~ — **hecho** (2026-10-06, Etapa 6): la API agrega `shop` (Truck, WO abierta, fuera del taller); los chips abren el Truck y marcan los que tienen WO abierta (primero en Llegadas y Salidas); aviso "Dispatch y el taller no coinciden" cuando Dispatch dice Outside y hay WO abierta; la línea dice "consultado <hora>" (Dispatch no manda la hora del dato) y "Reintentar" si no respondió | `yard-data-boundary.service.ts`, `admin-yard-data-boundary-cards.tsx` |
| ~~D9~~ | E | ~~Tablero con 5 columnas vacías y scroll horizontal; tarjeta a 12 px con badge de fase repetido; "Apply filters" como único primario~~ — **hecho** (2026-10-06, Etapa 6): carriles por paso de arriba abajo (un paso vacío es una línea), sin scroll lateral; tarjeta con el número en 16 px, una línea de alerta ámbar (bloqueado, en pausa, fuera del taller, sale pronto con Jobs pendientes, nadie en un Job), progreso y avatares, sin badge de fase; filtros rápidos al tocar y el resto en "More filters" | `admin-yard-operations.tsx`, `lib/yard-card.ts` |
| D10 | E | ~~Título "Shop Operations"; "Ready to close WO"~~ — **hecho** (2026-10-06, Etapas 1 y 6): "Ready to close"; pestañas "Shop" / "Dispatch". **Sigue:** "UNAVAILABLE" y "Unable to load current administrative data." | `admin-messages.ts`, `yard-data-boundary-copy.ts` |
| ~~D11~~ | C | ~~Filtros de prioridad y estado del Yard también miran WOs cerradas~~ — **confirmado y hecho** (2026-10-06, Etapa 6): se comparan en memoria con la WO actual del camión; la base ya no filtra "alguna WO del camión" | `yard-operations.service.ts` (`matchesDerivedFilters`) |

## 1h. Fidelidad a las maquetas (Admin) (2026-10-06) — **CERRADO** (Etapas 8.1–8.7) · Linear [LTR-190](https://linear.app/ltransl/issue/LTR-190)

Las Etapas 1–7 construyeron el comportamiento, pero sobre los componentes de antes; las pantallas no se
ven como las maquetas aprobadas (`docs/proposals/{wo,truck}-detail-redesign/mockup.html`,
`dashboard-yard-redesign/mockup.html`). Plan: [`proposals/ETAPA8_PLAN.md`](proposals/ETAPA8_PLAN.md).
Preguntas para el final: [`proposals/PENDIENTES_UI.md`](proposals/PENDIENTES_UI.md).
Decidido por el dueño el 2026-10-06:
- Título "Truck N".
- Marco común igual a la maqueta.
- Se agregan los campos de API que faltan.
- El Yard sin "More filters".

**Cierre (Etapa 8.7):** F1–F11 hechos. Lo que quedó distinto, y por qué, está en
[`PENDIENTES_UI.md`](proposals/PENDIENTES_UI.md) ("Diferencias menores aceptadas"). Verificación: e2e
completa 114/114 en Chromium y en WebKit (teléfono), web unit 218/218, `ui-audit` (Manager y Admin, EN/ES,
claro/oscuro, iPhone y escritorio, 27 pantallas cada vez) sin scroll lateral ni contraste bajo en texto.

| # | Clase | Problema | Dónde |
|---|---|---|---|
| F1 | E | **Primitivas distintas a la maqueta:** `Button` `rounded-lg font-semibold` (maqueta `rounded-md font-medium`, `h-11 sm:h-9`); `Card` con `p-4 shadow-soft` (maqueta sin sombra, cabecera `border-b px-4 py-3`); `.page-title` `font-bold` (maqueta `font-semibold md:text-[28px]`); el botón `sm` baja el texto a 12 px — **Base hecha** (2026-10-06, 8.1): `Button` rounded-md medium, 44 px con dedo y 36 px con ratón; `.card` sin sombra; `.page-title` semibold 28 px; `SectionCard`, `CountChip` y `DialogActions` nuevos. | `ui.tsx`, `globals.css` |
| F2 | C | **Color equivocado:** `Badge warning` usa `shop-accent` (azul), así que "Not Ready", "Paused" y "High" salen azules en vez de ámbar; "In progress" es un relleno sólido; "Critical" es sólido en vez de tinte; los chips no tienen punto — **Hecho** (8.1): los chips llevan tinte y punto; warning es ámbar; In progress con tinte azul; Critical con tinte rojo. | `ui.tsx`, `lib/status-chips.ts` |
| F3 | E | **Menús, popovers y diálogos:** usan `bg-popover`, que en oscuro es el color del fondo (no el de la tarjeta). No tienen iconos, cabecera ni separador, y no son hoja inferior en el teléfono. Diálogos: título `text-xl font-bold`, botones estirados, "Cancel" en vez de "Back" — **Base hecha** (8.1): los diálogos van sobre `bg-card`, son hoja inferior en el teléfono, tienen título de 16 px y descripción en la cabecera; `ResponsiveMenu` (desplegable u hoja); `MechanicPicker` es hoja en el teléfono. Falta: usarlos en cada pantalla. | `ui.tsx` (`Modal`), menús, `mechanic-picker.tsx` |
| F4 | E | **Toasts sólidos** (verde o rojo) y centrados; en la maqueta son neutros, con icono, abajo a la derecha — **Hecho** (8.1): toasts neutros con icono, abajo a la derecha, y `--toast-lift`. | `action-toast.tsx` |
| F5 | E | **Avatares grises:** la maqueta usa un color por mecánico — **Base hecha** (8.1): `MechanicAvatar` y `lib/mechanic-tone.ts`. Falta: usarlos en cada pantalla. — **Hecho** (8.2–8.5): avatares de color en Jobs, notas, métricas, Truck, Dashboard y Yard. | Truck, WO, Yard |
| F6 | C | **Marco:** en la maqueta el menú lateral va a todo lo alto con la marca y hay migas de pan ("Work Orders › WO-010"). Los ítems son `h-9`, sin negrita, y el activo `bg-accent`. La app tiene la barra a todo lo ancho, sin migas, y el ítem activo con borde. El cuerpo tiene un degradado que la maqueta no tiene — **Hecho** (8.1): menú lateral a todo lo alto con la marca, ítems de la maqueta, barra con migas de pan (`useAdminBreadcrumb`), cuerpo en `text-sm` y sin degradado. `darkMode: 'class'` para que `dark:` siga el tema elegido. | `admin-shell.tsx`, `globals.css` |
| F7 | C | **WO:**<br>• **Encabezado:** "918" en vez de "Truck 918"; prioridad antes que estado; sin "Opened" ni WO en letra mono.<br>• Falta la franja de métricas.<br>• **Siguiente paso:** sin tonos, sin icono y sin título/subtítulo; el blocker va en una caja dentro de otra; "Complete Work Order" es una tarjeta aparte.<br>• **Jobs:** columnas apretadas a anchos medianos, mecánico como botón con borde, estado sin icono, PM en un select, cerrados plegados por defecto.<br>• **Notas:** sin avatar y con un campo de 112 px.<br>• **Columna derecha:** sin ubicación, la prioridad en un select.<br>• **History:** plegado y sin línea de tiempo<br>**Cerrado en la Etapa 8.2:** encabezado "Truck 918" con estado y luego prioridad, franja de métricas, aviso del siguiente paso con tonos (blocker con "+N more" y resueltos en su pie; Return to Service y Confirm completion dentro del aviso), Jobs en cuadrícula con avatares, PM en menú y cerrados abiertos, notas con avatar y "Post" adentro, 4 tarjetas a la derecha, History siempre abierto con línea de tiempo. En el teléfono la miga de pan muestra "‹ padre" para volver. | `admin-work-order-detail.tsx`, `admin-job-table.tsx`, `work-order-history.tsx`, `work-order-next-step.tsx` |
| F8 | C | **Truck:**<br>• **Encabezado:** "601" en vez de "Truck 601"; el chip sin el paso ni el punto; el chip de la WO sin icono.<br>• **Pasos:** sueltos (no van en una tarjeta con "N jobs left" y avatares); el pendiente sale neutro (debe ser ámbar) y el externo ámbar (debe ser azul).<br>• **Siguiente paso:** una sola caja para todos los tipos.<br>• **Work Plan:** cajas dentro de la tarjeta; iconos sin color; inspección plegable.<br>• **Add work:** categorías en un select; los Jobs que ya están se ocultan en vez de mostrar "· on plan"; sin pie fijo ni dueños por defecto.<br>• **Repair history:** sin filtro<br>**Cerrado en la Etapa 8.3:** "Truck 601" con el chip "Not Ready · paso" (ámbar) y el chip de la WO con icono, estado en color y prioridad; tarjeta de pasos con colores (pendiente ámbar, externo azul, Close en espera neutro), "N jobs left" y avatares; un aviso por tipo de siguiente paso ("Issues found" principal, "Mark QC complete" con borde, solo lectura explicado); Work Plan en una tarjeta con "Jobs on WO", filas en cuadrícula, Assign punteado y "Change" como enlace; panel Add work de 460 px (hoja de 92 vh en el teléfono) con categorías como botones, chips "· on plan", "To add (N)" y pie fijo; tarjetas Truck y Repair history con filtro. | `admin-truck-*.tsx`, `truck-stepper.tsx`, `work-plan-add-work.tsx` |
| F9 | E | **Dashboard:**<br>• **Filas:** "918" en vez de "Truck 918"; una sola frase (maqueta: título y detalle); botones sin icono.<br>• **Grupos:** `bg-muted/60` (maqueta `bg-sunken`).<br>• **"Leaving soon":** sin el paso y sin "Open Truck".<br>• **Pedidos de trabajo:** sin enlace al Truck<br>**Cerrado en la Etapa 8.4:** encabezado con "Live · updated" y su punto; contadores tabulares con su color; "Leaving soon" con "Truck N", la fecha en negrita y "Open Truck →"; la cola en una tarjeta con grupos sobre `bg-sunken`, filas "Truck 918" de 2 líneas (blocker con su formulario de 2 filas, "Since" en pausas, "All N Jobs are done", "Dispatch: leaves" en Ready to Go) y botones con icono; pedidos con el enlace al Truck. | `admin-dashboard.tsx` |
| F10 | C | **Yard:**<br>• **Filtros:** "More filters" de sobra; falta el chip "Leaving soon".<br>• **Carriles:** cada uno es una caja propia (maqueta: una sola tarjeta con filas); en el teléfono no hay grupos plegables.<br>• **Tarjeta:** muestra la alerta **y** el siguiente paso; avatares grises; Return to Service fuera de la tarjeta.<br>• **Dispatch:** en una columna de cajas pequeñas (maqueta: 3 columnas con estado en el taller); sin "Dispatch didn't answer"<br>**Cerrado en la Etapa 8.5:** encabezado con "Live"; pestañas sin relleno; búsqueda y chips en una fila con el chip **"Leaving soon"** (la web manda `soonTrucks` y la API cuenta y filtra en todas las páginas); sin "More filters" (la URL sigue aceptando readiness, phase, workOrderStatus y priority); línea "N trucks in the shop" / "Showing N of M" + "filters stay…"; en escritorio los carriles en una sola tarjeta (columna de 8 rem, vacíos en una línea, cuenta de `byPhase`); en el teléfono pasos plegables y los vacíos ocultos; tarjeta con el número en color normal, la alerta **o** el siguiente paso con icono y tono, barra verde, avatares y Return to Service dentro; Dispatch en 3 columnas con filas (estado en el taller, "N jobs left" si sale pronto) y "Dispatch didn't answer". | `admin-yard-operations.tsx`, `admin-yard-data-boundary-cards.tsx` |
| F11 | C | **Datos que la API no manda:**<br>• fecha de la inspección;<br>• hora en que se completó cada Job del Work Plan;<br>• prioridad y fecha de cierre de la WO en el Work Plan;<br>• paso de la WO en el resumen;<br>• `truckId` de los pedidos de trabajo;<br>• "Leaving soon" en el Yard;<br>• totales por paso;<br>• estado en el taller para Dispatch;<br>• nombre del Job fuera del taller;<br>• motivo de cancelación (WO y Job);<br>• tramo "corregido" — **Hecho** (8.6): campos agregados sin cambiar los existentes, con su prueba de API y `test:real`. Sin derivar: el paso de la WO en el resumen del Dashboard (caro); el motivo de cancelación y el tramo corregido se leen del Activity Log en la web. | `packages/shared/src/types.ts`, `apps/api/src/admin/*` |

## 1i. Después del merge del rediseño (#244) (2026-10-06) — **CERRADO** (2026-10-07) · Linear [LTR-191](https://linear.app/ltransl/issue/LTR-191)

| # | Clase | Problema | Estado |
|---|---|---|---|
| ~~G1~~ | B | **La API de producción no se publicaba desde el 2026-09-30.** 15 despliegues seguidos fallaron porque 4 migraciones de `main` no estaban aplicadas (`safety_quality_check_ltr185`, `drop_pm_authorized_ltr180`, `day_close_ltr186`, `helper_external_jobs_ltr188`) y el build no publica con migraciones pendientes. Producción mezclaba la web nueva con la API del ~30 de septiembre. | Migraciones aplicadas con `release-safety.yml` (run 37526676075, verde). **Hecho 2026-10-07:** la API se publicó de nuevo con el #245 y las pantallas se revisaron en producción con Manager, mecánico General, PM y QC. |
| ~~G2~~ | E | **"✓ Complete" en la fila de un Job pendiente parece un estado**, no un botón (botón sin borde con un check). El dueño leyó que Detailing de WO-004 estaba completado, pero el Job está "To do" y el selector de mecánico está bien habilitado. | **Hecho** (#245, 2026-10-06): botón con borde y "Mark complete". |
| ~~G3~~ | E | **Truck con un paso obligatorio faltante:** el chip dice "Not Ready · PM" (el primer paso sin hacer) mientras el aviso dice que falta Detailing. Visto con los datos demo (Truck 944). | **Hecho** (#245, 2026-10-06): el chip nombra primero el paso que falta. |
| ~~G4~~ | E | **Mismo Job, dos palabras:** el Work Plan del Truck dice "Pending" y el Work Order "To do". | **Hecho** (#245, 2026-10-06): "To do" en los dos. |
| ~~G5~~ | E | **Work Order › Repair history:** el título es "Recent repair history" y se parte en dos líneas junto al filtro; la maqueta y el Truck dicen "Repair history". | **Hecho** (#245, 2026-10-06): "Repair history". |
| ~~G6~~ | B | **Datos de prueba en producción que ven todos:** la nota de cierre "Ready Putos" de Fuel Filters (WO-010, guardada en el evento `job_completed` del Activity Log) y el pedido de trabajo "jlkhl" (WO-010). Revisión de producción del 2026-10-07. | **Hecho 2026-10-07** (aprobado por el dueño): sin la nota del evento `job_completed` (ff996aea…); borrados la nota `work_request` "jlkhl" (a0a38956…) y su evento `note_added` (fb5b0a2f…). Verificado: no quedan. |
| ~~G7~~ | E | **Mecánico › "Waiting on Manager" dice "The Manager closes them"** aunque queden Jobs de otros (PM, Quality Check): el Manager todavía no puede cerrar. | **Hecho** (#247, 2026-10-07): "…The Manager closes it when every step is done" y, en el detalle, "Your Jobs are done… when every step is done" (EN/ES). |
| ~~G8~~ | B | **Reloj de 38 h:** MG tiene en WO-004 una sesión del 2026-09-29 9:15 a. m. al 2026-09-30 11:21 p. m. El cierre del día (D20, LTR-186) no estaba en la API de producción hasta el 2026-10-06. | Además, **`CRON_SECRET` no está configurado en la API de producción**: `GET /api/internal/day-close` responde 503 "CRON_SECRET is not configured", así que el respaldo de Vercel Cron no corre. **`CRON_SECRET` hecho 2026-10-07:** el dueño lo agregó en Vercel (ltl-shop-api, Production, Secret) y volvió a publicar; `/api/internal/day-close` sin secreto ahora responde 401. **Sesión corregida 2026-10-07** desde History › Times con sesión de Manager: fin el 2026-09-29 a las 5:00 p. m. (como la habría cortado D20), con motivo; el tramo muestra "Corrected" y la labor activa de WO-004 pasó de 38 h 6 min a 7 h 45 min. **G8 cerrado.** |
| ~~G9~~ | B | **Mechanics › el detalle de una persona de Safety dice "This mechanic could not be found"**: la lista incluye Safety (LTR-185) pero `GET /admin/mechanics/:id` solo buscaba Standard y PM, así que no se podía abrir ni editar. Visto al crear la primera cuenta de Safety en producción (2026-10-07). Editar y reiniciar la contraseña ya aceptaban Safety. | **Hecho** (#249, 2026-10-07): el detalle usa el mismo filtro que la lista; verificado en producción con la cuenta QC. |
| ~~G10~~ | B | **La cuenta QC no puede iniciar sesión:** la API de producción no tiene `SUPABASE_SERVICE_ROLE_KEY`, así que al crear a QC (2026-10-07) la app guardó la persona sin cuenta de acceso en Supabase Auth (el aviso "Access account not created in this environment" se pasa por alto). Y "Reset password" respondía `AUTH_ACCOUNT_MISSING`, así que no había cómo crearla. Los otros 6 usuarios activos sí tienen cuenta. | Arreglo: "Reset password" crea la cuenta que falta, la liga y muestra la contraseña temporal. **Hecho 2026-10-07** (#251): el dueño agregó `SUPABASE_SERVICE_ROLE_KEY` (Secret, Production). Un "Redeploy" del despliegue del #250 dejó producción con el código anterior hasta que se volvió a publicar el del #251. Después, Reset password creó la cuenta de QC; QC inicia sesión, ve `/qc` y queda fuera de `/admin` y de las pantallas del mecánico. El enlace del Admin bloqueado decía "Return to mechanic Home" también para Safety; ahora dice "Return to your Home" / "Volver a tu inicio" (lleva al inicio de cada persona). |

## 1j. Pantalla de Safety (Quality Check) (2026-10-07) — **CERRADO salvo Q10** (rediseño en #259; Q10 va con el bloque C) · Linear [LTR-193](https://linear.app/ltransl/issue/LTR-193), [LTR-195](https://linear.app/ltransl/issue/LTR-195)

Revisión de `/qc` con la base demo local, antes de proponer su rediseño (como las Etapas 1–8 del Admin).

| # | Clase | Problema | Estado |
|---|---|---|---|
| ~~Q1~~ | B | **La lista no cambia al tocar Take, Approve o Return.** La API arma la respuesta leyendo la base fuera de la transacción, antes de guardar el cambio, y devuelve la lista vieja: después de "Take" la tarjeta sigue diciendo "Take" (con el aviso "Truck 606 is yours"); después de "Approve" el camión sigue en la lista. Se corrige al recargar o a los 20 s. Las pruebas reales pedían la lista con un GET aparte y no lo veían. | **Hecho** (#250, 2026-10-07): la respuesta lee dentro de la misma transacción; `test:real` revisa la respuesta de cada botón. |
| ~~Q2~~ | C | **Safety no ve qué se le hizo al camión** que va a aprobar: solo nombres de Jobs y de mecánicos (UX-1-001). | **Hecho** (rediseño de Safety, #259, 2026-10-07). |
| ~~Q4~~ | C | **Approve es un toque, sin confirmar**, y Safety no lo puede deshacer (UX-1-002). | **Hecho** (rediseño de Safety, #259, 2026-10-07). |
| ~~Q5~~ | B | **Un camión tomado no se puede soltar**: si Safety lo toma y se va, queda trabado hasta que el Manager reasigne (UX-1-007). | **Hecho** (rediseño de Safety, #259, 2026-10-07). |
| ~~Q9~~ | C | **Lo escrito al devolver se pierde** al cerrar la hoja o si vence la sesión (UX-1-006, UX-6-003). | **Hecho** (bloque A, #257, 2026-10-07). |
| ~~Q10~~ | C | **Sin conexión salen dos avisos rojos** que dicen que la lista no cargó, encima de la lista con "Take" activo (UX-6-002). | **Hecho** (rediseño del PM y aviso único de sin conexión, rama `claude/pm-redesign`, 2026-10-07). |
| ~~Q11~~ | E | **Los Jobs y los mecánicos cambian de orden** entre cargas: `addedAt` empata y no hay desempate (UX-1-009). | **Hecho** (bloque A, #257, 2026-10-07). |

Auditoría completa (skills audit-ux 0, 1, 4 y 6): `docs/ux-audit/safety-qc/`. Propuesta: `docs/proposals/qc-screen-redesign/`.

## 1k. Pantallas del Mecánico General (2026-10-07) — **HECHO** (bloque A y rediseño, #261) · Linear [LTR-192](https://linear.app/ltransl/issue/LTR-192), [LTR-194](https://linear.app/ltransl/issue/LTR-194)

Auditoría con las skills audit-ux 0, 1, 4, 6 y 7 en la base demo local (cuenta de Anthony): `docs/ux-audit/mecanico-general/`. Aquí van los B y C; los E y el detalle están en la auditoría.

| # | Clase | Problema | Estado |
|---|---|---|---|
| ~~MG1~~ | C | **El inicio no dice en qué camión corre el reloj**; solo avisa cuando se detuvo. El mecánico puede creer que su tiempo se registra cuando no (UX-1-001). | **Hecho** (rediseño del Mecánico General, #261, 2026-10-07). |
| ~~MG2~~ | C | **Start Work desde la lista cierra el reloj de otro camión sin decirlo** (UX-1-002). | **Hecho** (bloque A, #257, 2026-10-07). |
| ~~MG3~~ | B | **"Your clock moved to another Truck · tap Continue" cuando el reloj no corre en ninguno**: después de completar el último Job en el camión al que se cambió, el otro camión sigue con el aviso (`clock-stopped.ts:17-19` usa el texto genérico si `elsewhereWorkOrder` es `null`) (UX-1-003). | **Hecho** (bloque A, #257, 2026-10-07). |
| ~~MG4~~ | C | **El aviso dice "tap Continue" y el botón de la tarjeta dice "View Work"** (UX-1-004). | **Hecho** (bloque A, #257, 2026-10-07). |
| ~~MG5~~ | C | **"Labor time · running" suma el tiempo de todos los mecánicos** (UX-1-007). | **Hecho** (rediseño del Mecánico General, #261, 2026-10-07). |
| ~~MG6~~ | C | **Un Work Order sin Jobs propios dice "You do not have access to this PM Work Order."** (UX-6-005). | **Hecho** (bloque A, #256, 2026-10-07). |
| ~~MG7~~ | C | **Errores en inglés con la app en español** al hacer Start desde la lista y en Notas (UX-6-006). | **Hecho** (bloque A, #257, 2026-10-07). |
| ~~MG8~~ | C | **Report Blocker:** la nota solo aparece con "Other", y con "Other" vacío el botón queda gris sin explicar (UX-7-003, UX-7-004). | **Hecho** (bloque A, #257, 2026-10-07). |
| ~~MG9~~ | C | **Lo escrito al completar o bloquear se pierde** al cerrar el diálogo o si vence la sesión (UX-7-002, UX-6-008). | **Hecho** (bloque A, #257, 2026-10-07). |

## 1l. Pantallas del Mecánico de PM (2026-10-07) — **HECHO** (bloque A y rediseño) · Linear [LTR-192](https://linear.app/ltransl/issue/LTR-192), [LTR-194](https://linear.app/ltransl/issue/LTR-194)

Auditoría con las skills audit-ux 0, 1, 4, 6 y 7 en la base demo local (cuenta de Daniel): `docs/ux-audit/mecanico-pm/`.

| # | Clase | Problema | Estado |
|---|---|---|---|
| ~~PM1~~ | B | **Sin conexión, la pieza o el millaje que elige se ve pero no se guarda**; el aviso sale al pie de la tarjeta, el guardado automático se detiene después del error (`pm-service-card.tsx:144`) y al recargar se pierde (UX-6-001). | **Hecho** (bloque A, #256, 2026-10-07). |
| ~~PM2~~ | B | **Con un salto de millaje sin confirmar, las piezas que elige no se guardan y nada lo dice** (`persist` sale sin guardar, `pm-service-card.tsx:138`) (UX-7-004). | **Hecho** (bloque A, #256, 2026-10-07). |
| ~~PM3~~ | C | **Borrar el millaje guarda el campo vacío** y esconde las piezas (UX-7-003). | **Hecho** (bloque A, #256, 2026-10-07). |
| ~~PM4~~ | C | **"Finish Work" queda a casi dos pantallas**, detrás de "Service type" y nueve selects iguales (UX-4-001, UX-7-005). | **Hecho** (rediseño del PM y aviso único de sin conexión, rama `claude/pm-redesign`, 2026-10-07). |
| ~~PM5~~ | C | **La regla "un PM a la vez" se descubre al tocar**: la tarjeta pausada del inicio, Create PM service y "Start PM service" en otro camión la ofrecen como botón principal y responden con error (UX-1-001, UX-1-002, UX-1-003). W14 lo arregló solo en "Ready to Start". | **Hecho** (bloque A, #256, 2026-10-07). |
| ~~PM6~~ | C | **Las notas no se guardan solas como dice HU-PM1**: se publican con "Add Note" y lo no enviado se pierde al salir (UX-7-001). | **Hecho** (bloque A, #257, 2026-10-07). |

## 1m. Setup del Admin: Shop workflow, Job Catalog, Mechanics (2026-10-07) — **CERRADO** (2026-10-09: etapa 0 y S1–S4 hechos) · Linear [LTR-196](https://linear.app/ltransl/issue/LTR-196) (etapa 0), [LTR-197](https://linear.app/ltransl/issue/LTR-197) (S1), [LTR-198](https://linear.app/ltransl/issue/LTR-198) (S2), [LTR-199](https://linear.app/ltransl/issue/LTR-199) (S3), [LTR-200](https://linear.app/ltransl/issue/LTR-200) (S4)

Revisión pedida por el dueño el 2026-10-07. Se usaron las skills audit-ux 0, 1, 3, 4, 5, 6, 7 y 9 en la base demo local `ltl_shop_setup_demo`, con la cuenta del Manager. Todo está en `docs/ux-audit/admin-setup/`; el resumen es `09-informe-final.md`.

Aquí van los defectos de lo que ya está construido. Lo que cambia por las decisiones del dueño (D28–D32) va en la segunda tabla, como bloques S1–S4.

| # | Clase | Problema | Estado |
|---|---|---|---|
| ~~SW1~~ | B | **Shop workflow deja de guardar sin decir por qué.** Pasa cuando el dueño de un paso deja de poder hacerlo (cambió de tipo o se desactivó). `save()` manda todos los pasos y la API rechaza el lote con `OWNER_NOT_ELIGIBLE`. La pantalla dice "Refresh and try again", y refrescar no lo arregla (`admin-shop-workflow.tsx:43-50`, `shop-workflow.service.ts:81-87`). Reproducido en la demo (UX-6-005, UX-7-005). | **Hecho** (arreglos de Setup, rama `claude/setup-fixes`, 2026-10-07): solo se mandan los pasos cambiados; el dueño no elegible se marca; test-real A37. |
| ~~SW2~~ | B | **Un paso obligatorio deja de crearse en silencio** si su Job o su categoría se desactivan (`mandatory-jobs.ts:70`). Shop workflow lo sigue mostrando como configurado (UX-6-008, UX-1-004). | **Hecho** (arreglos de Setup, rama `claude/setup-fixes`, 2026-10-07): el paso se marca en Shop workflow y el Job de un paso no se puede desactivar; test-real A38. |
| ~~SW3~~ | C | **Cambiar el tipo de una persona, o desactivarla, no avisa que es dueña de un paso.** Las WOs nuevas nacen con ese paso sin dueño, y la persona se queda con sus Jobs abiertos de otro tipo (`system-admin-writes.service.ts:145-162`) (UX-7-017, UX-1-003, UX-6-009). | **Hecho** (arreglos de Setup, rama `claude/setup-fixes`, 2026-10-07): cambiar el tipo avisa de qué pasos es dueña y cuántos Jobs le quedan; desactivar también; test-real A40. |
| ~~SW4~~ | C | **Los cambios sin guardar se pierden al salir, sin aviso.** Nada marca la fila cambiada, y hay dos botones "Save" en la página sin decir qué guarda cada uno (UX-6-016, UX-7-004, UX-1-008, UX-4-001). | **Hecho** (arreglos de Setup, rama `claude/setup-fixes`, 2026-10-07): aviso al salir con cambios, fila marcada "Changed", "Save steps" / "Save shop hours". |
| ~~SW5~~ | C | **Renombrar un Job que es paso lo saca de su carril en Yard.** Alignment, Detailing y QC se reconocen por nombre (`yard-work-plan-derivation.ts:78-120`). El diálogo de renombrar no avisa nada (UX-1-009). | **Hecho** (S2, rama `claude/setup-s2`, 2026-10-08): los Jobs del sistema tienen `system_key` y cada Job de un WO lo copia (trigger); los carriles leen la clave antes que el nombre; test-real A46. |
| ~~JC1~~ | B | **Cada publicación nueva deshace cambios del Manager en el catálogo.** `applyJobCatalog` corre en cada Release: re-crea con su nombre viejo los Jobs renombrados, reactiva los desactivados y les quita los aliases a quien los tenga (`apps/api/prisma/job-catalog.ts:332-427`) (UX-1-010). | **Hecho** (S2, rama `claude/setup-s2`, 2026-10-08): `applyJobCatalog` solo crea lo que falta (por `seed_key`), nunca renombra, reactiva ni quita aliases; test-real A48. |
| ~~JC2~~ | C | **El buscador del catálogo solo encuentra categorías**, no Jobs ni aliases (`admin-catalog-list.tsx:21`). Para encontrar un Job hay que abrir hasta 17 categorías, y se terminan creando duplicados (UX-5-014). | **Hecho** (S2, rama `claude/setup-s2`, 2026-10-08): búsqueda de Jobs y aliases en todas las categorías (`GET /admin/catalog/search`); test-real A47. |
| ~~JC3~~ | C | **Una categoría inactiva no explica por qué** (Alignment y Air System quedaron así al fusionarse en LTR-24). En sus Jobs, "Activate" dice que funcionó aunque no tiene efecto real (UX-6-010). | **Hecho** (S2, rama `claude/setup-s2`, 2026-10-08): las categorías se activan y desactivan con motivo opcional; Alignment y Air System dicen "Merged into … (LTR-24)"; test-real A45. |
| ~~JC4~~ | C | **El primer clic en una categoría no abre el detalle.** La lista usa el `Link` común y no `AdminNavLink` (UX-1-013, UX-5-008). | **Hecho** (arreglos de Setup, rama `claude/setup-fixes`, 2026-10-07): la lista usa `AdminNavLink`. |
| ~~JC5~~ | E | **Aliases casi duplicados** ("lineas" y "líneas de combustible"): el normalizador borra las letras con tilde en vez de quitarles la tilde (`job-catalog.service.ts:4-5`) (UX-3-017). | **Hecho** (S2, rama `claude/setup-s2`, 2026-10-08): `normalizeCatalogText` quita tildes; la migración recalculó `alias_norm` y unió los casi duplicados; test-real A47. |
| ~~JC6~~ | E | **Textos viejos o repetidos.** "Read-only…" en un catálogo editable. "Manager or System Admin…" aparece en 8 lugares, también dentro de Rename. Usa jerga como "The Job id stays the same" (UX-3-001, UX-3-002, UX-3-015). | **Hecho** (arreglos de Setup, rama `claude/setup-fixes`, 2026-10-07): textos reescritos y sin el párrafo dentro de los diálogos. |
| ~~ME1~~ | C | **"Open Work Orders" no es el trabajo real.** Cuenta `mechanic_assignments`, no los Jobs de la persona. En la demo, Daniel (PM) muestra 0 con 9 Jobs pendientes, y Alejandro 1 muestra 10 cuando tiene 7 (`admin.service.ts:2504-2525`) (UX-1-014, UX-3-010, UX-6-011). | **Hecho** (arreglos de Setup, rama `claude/setup-fixes`, 2026-10-07): cuenta los Jobs por hacer de la persona; test-real A39. |
| ~~ME2~~ | C | **Desactivar avisa del bloqueo recién después de confirmar**, y desde ahí no se puede reasignar (UX-6-013, UX-3-013, UX-7-018). | **Hecho** (arreglos de Setup, rama `claude/setup-fixes`, 2026-10-07): el bloqueo se ve al abrir el diálogo; test-real A40. |
| ~~ME3~~ | C | **Esc o un clic fuera cierra "Add person" y se pierde lo escrito**, incluida la contraseña temporal que se ve una sola vez (`ui.tsx:1170`) (UX-7-002). | **Hecho** (arreglos de Setup, rama `claude/setup-fixes`, 2026-10-07): el diálogo no se cierra con Esc ni con un clic fuera mientras hay algo escrito o la contraseña a la vista. |
| ~~ME4~~ | E | **El detalle se contradice.** Dice "Completed Jobs: 3" y al lado "No closed Work Orders". Además, "Job labor time is not available" es un texto fijo (UX-6-012, UX-3-011, UX-3-012). | **Hecho** (arreglos de Setup, rama `claude/setup-fixes`, 2026-10-07): los WOs cerrados son los de sus Jobs completados; se quitó el texto fijo; test-real A39. |
| ~~ME5~~ | E | **La sección se llama "Mechanics" y lista Safety y admins.** "Capabilities" mezcla el tipo de la persona con permisos (UX-3-008, UX-3-009, UX-5-003). | **Hecho** (S3, rama `claude/setup-s3`, 2026-10-09): la sección se llama People / Personas; la lista muestra un tipo por persona (System Admin para una fila de admin), sus equipos y sus Jobs pendientes. |

**Cambia por decisión del dueño** (D28–D32, 2026-10-07). No son defectos: es trabajo nuevo, con propuesta y maqueta antes de construir.

| Bloque | Qué | Decisión | Hallazgos que lo piden |
|---|---|---|---|
| ~~S1~~ | **Hecho** (rama `claude/setup-s1`, 2026-10-08): equipo y cola por paso, Take / Let go en el inicio del mecánico, el Manager hace QC como respaldo desde `/qc`, el paso se llama "PM", Shop hours en su pestaña (D-SET5); test-real A41–A44 y QC11 | D28, D29 | UX-7-020, UX-6-019, UX-5-009, UX-1-005, UX-1-006, UX-1-007 |
| ~~S2~~ | **Hecho** (rama `claude/setup-s2`, 2026-10-08): categorías (crear, renombrar, activar/desactivar con motivo, borrar vacía), Jobs (borrar si nunca se usó, si no desactivar), aliases (agregar/quitar, el choque dice de qué Job), búsqueda, Jobs y categorías del sistema protegidos, la recarga no pisa; test-real A45–A48 | D30 | UX-7-022, UX-6-021, UX-4-004, UX-4-007, UX-1-011, UX-5-002 |
| ~~S3~~ | **Hecho** (rama `claude/setup-s3`, 2026-10-09): Quitar del Shop (conserva el historial, bloqueo antes de confirmar), borrado real solo sin historial, detalle con cabecera de estado, Jobs pendientes con "mandar a la cola", equipos y Jobs completados, cambio de tipo bloqueado con Jobs pendientes (D-SET3); test-real A49–A52 | D31 | UX-7-023, UX-6-023, UX-4-009, UX-5-011, UX-1-016 |
| ~~S4~~ | **Hecho** (2026-10-09, PRs 269–271 y la rama `claude/setup-s4-pc4`): PC-1 catálogo de partes y proveedores (A53–A56), PC-2 compras con factura y el libro de costos (A57–A62), PC-3 reparaciones externas ligadas al Job (A63–A65), PC-4 Truck → Costs con totales, meses, movimientos y horas de mano de obra sin monto (A66–A68). El cobro a Finanzas y la tarifa de mano de obra quedan diseñados (§8 de la propuesta) | D32 | UX-1-020, UX-5-004, UX-6-024, UX-7-024 |

Orden acordado:
1. **Arreglos sin rediseño:** SW1–SW4, JC3 (en parte), JC4, JC6 y ME1–ME4. Un PR, como el "bloque A" de los roles de campo. JC5 (normalizar tildes en aliases) pide recalcular `alias_norm` con una migración y pasa a S2; ME5 (nombre "People") pasa a S3.
2. **Bloques S1 → S2 → S3 → S4**, un PR cada uno. JC1, JC2, JC3 y SW5 se cierran en S2.

## 1n. Tablero Kanban del Yard (2026-10-09) — **HECHO** (rama `claude/kanban-board-component-c15dff`)

El dueño pidió que el tablero del Yard sea un Kanban real, con columnas verticales, y que se pueda abrir a pantalla completa (D33).

| # | Clase | Problema | Dónde |
|---|---|---|---|
| ~~K1~~ | E | ~~Los pasos se ven como carriles horizontales (filas), no como columnas de un tablero Kanban; con muchos camiones el tablero crece hacia abajo y no se ve el flujo de un vistazo~~ — **hecho**: listas verticales de 18 rem como Trello (también las vacías, con su título arriba), cada lista desplaza sus tarjetas por dentro, scroll lateral solo dentro del tablero; e2e `yard-operations.spec.ts` (D33) | `admin-yard-operations.tsx` |
| ~~K2~~ | E | ~~No hay forma de ver el tablero a pantalla completa (por ejemplo, en una TV del taller)~~ — **hecho**: botón Full screen (API Fullscreen del navegador + capa fija desde el borde de arriba, así los diálogos siguen abriendo encima), Esc sale. Primera versión corregida el mismo día: dejaba 20 px arriba (margen de la página) y las columnas vacías iban angostas con el título de lado; e2e (D33) | `admin-yard-operations.tsx` |

## 1o. Parts & costs: formulario de compra y detalle (2026-10-09) — **HECHO** (rama `claude/parts-costs-form-fixes`)

El dueño lo reportó al usar Purchases en producción, con capturas. Se evaluó con las skills audit-ux-7 (formularios) y audit-ux-4 (jerarquía); los hallazgos están en `docs/ux-audit/admin-setup/07-formularios.md` (corrida 2) y `04-jerarquia-visual.md`.

| # | Clase | Problema | Estado |
|---|---|---|---|
| ~~PC1~~ | B | **Al guardar con datos faltantes no dice qué falta.** Solo bordes rojos y un texto, sin resumen ni foco en el primer campo (UX-7-026). También en Outside repairs. | **Hecho:** Resumen arriba ("Complete these to save:") con cada faltante como enlace, "Required" junto a cada campo, foco en el primero; los opcionales dicen "(optional)". También en Outside repairs. |
| ~~PC2~~ | C | **No explica lo que calcula o llena solo:** el costo unitario viene del último pagado o del costo de referencia, el total de línea, el reparto del impuesto y el flete; el recuadro de totales no muestra Tax ni Freight (UX-7-027). | **Hecho:** El costo dice de dónde salió (último pagado a ese proveedor o costo de referencia); "Line total = Qty × Unit cost"; el recuadro muestra Subtotal, Tax, Freight y Total, y a dónde va ("All of it goes to Truck 277" o el reparto). |
| ~~PC3~~ | C | **"Other (not in catalog)" parece una forma de agregar piezas**; no dice que queda solo en esa compra ni dónde se agregan al catálogo (UX-7-028). | **Hecho:** La opción se llama "Other — only on this invoice" y al elegirla dice que no se agrega a Partes, con el enlace para agregar una parte al catálogo. |
| ~~PC4~~ | B | **"Discard this purchase?" sale al final del formulario**, fuera de la vista; Cancel parece no hacer nada (UX-7-029). | **Hecho:** Los botones quedan fijos abajo del diálogo; "Discard this purchase?" aparece ahí, en lugar de los botones. Outside repairs ahora también pregunta antes de descartar. |
| ~~PC5~~ | E | **El detalle de la compra está desordenado:** el total al final y suelto, "Per truck" repetido con un solo camión, archivo, notas y autor mezclados (UX-4-012). | **Hecho:** Arriba, un resumen: proveedor, factura, fecha, camión, archivo, Subtotal/Tax/Freight/Total y quién la cargó; Lines debajo; "Per truck" solo con varios camiones; Notes aparte. |

## 1p. Ensayo completo del modo demo (2026-10-09/10) — **ABIERTO: DM1–DM3** (DM4–DM6 hechos) · Linear [LTR-204](https://linear.app/ltransl/issue/LTR-204)

Se recorrieron en el navegador las 23 historias del Panel de demo (D36) contra `ltl_shop_demo` recién armada, tocando lo que dice cada paso. Los textos de los pasos que no coincidían con la pantalla se corrigieron en `apps/web/src/lib/demo/scripts.ts`. Esto es lo que salió del producto y de la demo:

| # | Clase | Problema | Dónde | Estado |
|---|---|---|---|---|
| DM1 | C | **La lista de Work Orders no dice "Return to Service"** para un camión Ready to Go: la columna Next dice "4 Jobs · all done". La lista de Trucks sí lo dice. USER_FLOWS (HU-M5, fila A19b) dice que las dos listas lo muestran. | `/admin/work-orders`, columna Next | Abierto |
| DM2 | E | **People: el filtro no refleja la URL.** Con `?status=all` la lista muestra a los inactivos (Luis), pero el selector "Show" sigue diciendo "Active". | `/admin/mechanics` | Abierto |
| DM3 | E | **Plurales con 1:** "1 open Work Orders" (Shop workflow → Add), "1 parts" (Vendors), "1 lines" (Purchases). | Admin, varios | Abierto |
| ~~DM4~~ | C | **Truck → Costs decía "Charge to Finance · coming later"** (gris, deshabilitado) aunque las facturas internas existen desde D34. | `admin-truck-costs.tsx` | **Hecho:** la tarjeta dice "Charge to Finance" y abre Internal invoices (EN/ES). |
| ~~DM5~~ | C | **En la demo, un Work Order nuevo nacía sin dueño en PM y Alignment**: el armado dejaba vacíos esos equipos del Shop workflow, y HU-M1 dice que cada paso nace con su dueño. | `reset-demo-work-orders.ts --demo` | **Hecho:** al final del armado, PM → Daniel y Alignment → Alejandro 1 (Detailing y QC ya tenían equipo). |
| ~~DM6~~ | C | **El Panel de demo tapaba botones de la derecha** (Resolve en el Admin, Request Work en el mecánico); el presentador tenía que cerrarlo en cada paso. | `globals.css`, `demo-panel.tsx` | **Hecho:** con el panel abierto la página le deja su columna: desde 1000 px en las pantallas del mecánico, desde 1200 px en el Admin. Más angosto, flota como antes y se cierra con la X. |

## 1q. Auditoría UX del modo demo (2026-10-10) — **ABIERTO: UX-1-010/UX-4-001, UX-1-011, UX-6-006, UX-6-007, UX-3-008, UX-3-009** (el resto hecho o en las PRs de cuentas por rol y flujo) · Linear [LTR-204](https://linear.app/ltransl/issue/LTR-204)

Se corrieron las skills audit-ux 0, 1, 3, 4, 5, 6, 7 y 9 sobre el Panel de demo y las pantallas que recorre la demo: `docs/ux-audit/demo-mode/` (45 hallazgos, informe en `09-informe-final.md`). Lo corregido en la misma rama: sesión de Admin que vencía y rebotaba a otro host (UX-1-003), estado "Switching to…" (UX-1-002, UX-6-002), encender/apagar desde el menú de perfil (UX-1-001), "Turn demo mode off" con confirmación (UX-1-006), "Back to the Manager dashboard" en vez de "Reset demo" (UX-1-005, UX-3-004, UX-4-002), Next como acción principal y "Follow each step" junto a los botones (UX-3-005, UX-7-004), la historia se previsualiza y arranca con "Start" (UX-7-003), chip ámbar y "Go to this step's screen" cuando la pantalla no es la del paso (UX-5-001, UX-1-008), Atrás del navegador ya no vuelve a la cuenta anterior (UX-5-005), el resolver espera la lista de camiones (UX-6-003), saludo al entrar (UX-6-005), errores en lenguaje llano (UX-3-003), rol del pie del Admin desde el catálogo (UX-3-006), validación del correo en "Enter demo mode" (UX-7-001), cuentas en "cargando" hasta tener la lista (UX-6-001).

| # | Clase | Problema | Dónde | Estado |
|---|---|---|---|---|
| UX-1-010 / UX-4-001 | C | **En teléfono el panel tapa el 75 % de la pantalla**; hay que cerrarlo y reabrirlo en cada paso. Propuesta: barra inferior de una línea con Back/Next que se despliega al tocar. | `demo-panel.tsx`, < 1000 px | Abierto (esfuerzo M; el teléfono es secundario en la demo) |
| UX-1-011 | C | **La pestaña Trucks del mecánico es solo un buscador**: exige recordar el número de unidad. Propuesta: lista "Trucks with your Jobs" debajo. | `/mechanic/standard/trucks`, `/mechanic/pm/trucks` | Abierto (también en `mecanico-general/01`) |
| UX-6-006 | C | **Nada avisa que una historia ya se ejecutó en esta base** (sus datos cambiaron). Propuesta: fecha de armado expuesta por la API y "· done" en la opción. | panel, `scripts.ts` | Abierto (esfuerzo M) |
| UX-6-007 | E | **"Loading work order" en texto plano** en la pantalla del mecánico; el Admin usa `PageSkeleton`. | `work-orders/[id]/detail-client.tsx` | Abierto |
| UX-3-008 | C | **Con la app en español, el guion cita etiquetas en inglés** ("Needs you" vs "Te necesita"). Propuesta: aviso en el panel cuando `locale === 'es'`, o presentar en inglés (DEMO.md). | panel, `scripts.ts` | Abierto |
| UX-3-009 | E | **La pestaña "Dispatch" del Yard se llama `movement` en la URL.** | `admin-yard-operations.tsx` | Abierto |
| UX-1-007 / UX-3-001 / UX-5-003 / UX-4-004 / UX-5-002 | C | Historias por código HU/J, sin capítulos ni contexto. | panel | **Va en la PR del flujo de demo (plan aprobado 2026-10-10)** |
| UX-3-002 / UX-1-004 / UX-4-003 | C | Nombres de persona en vez de roles; cuentas del dueño en "Others". | demo build, `cast.ts` | **Va en la PR de cuentas por rol (plan aprobado 2026-10-10)** |
| UX-1-012 / UX-3-007 | C/E | DM1 y DM3 de §1p. | Admin | Ver §1p |
| DM4 | B | **Ensayo del Demo flow (2026-10-11, base recién armada, 49 pasos):** (a) en los pasos cuya ruta lleva query (`/qc?tab=returned`, `/admin/history?status=cancelled`, `?tab=movement`) y en el paso siguiente, el panel decía "This is not the step's screen" aunque la pantalla era la correcta: `onStepScreen` leía `window.location.search` durante el render, antes de que Next actualizara el historial; (b) cuatro textos del flujo no cuadraban con los datos que los capítulos anteriores ya habían cambiado (el reloj de MA corre en el 609 tras Resume; "nine waiting · 609 paused" en PM; "Team queue · 1" cuando el 973 del capítulo 2 ya está; el número de la compra anulada cambia en cada armado). | `demo-context.tsx`, `scripts.ts` | **Hecho (PR del ensayo del flujo, 2026-10-11)**: la query se sigue por `pushState`/`replaceState`/`popstate`; los pasos del flujo llevan su propio texto con `pick(…, patch)`. |
| UX-7-005 | C | "Add to team" aplica pero no guarda hasta "Save steps"; en la demo el guard de cambios sin guardar corta el paso. | `admin-shop-workflow.tsx` | Abierto (el guion de HU-M8 recuerda guardar) |

## 1r. Parts & costs: arquitectura de información y task flows (2026-10-11) — **ABIERTO: PCA8–PCA15 y P15–P17** (PCA1–PCA7 hechos, rama `claude/parts-costs-flow-fixes`)

El dueño preguntó si lo nuevo de facturas de piezas y repuestos está bien pensado. Se auditó lo construido (PRs 269–272, 275–277) con las skills audit-ux-0 y audit-ux-5 más un recorrido de task flows contra las historias J13/J14 y HU-M11/M12/M13, en la demo `ltl_shop_parts_demo`. Los hallazgos completos, con evidencia y mapa de navegación, están en `docs/ux-audit/admin-parts-costs/` (`05-navegacion-ia.md`, `10-task-flows.md`). Veredicto: el modelo y cada pantalla están bien; lo que falta son los eslabones entre pantallas. Los siete de clase C se arreglaron el 2026-10-12 (rama `claude/parts-costs-flow-fixes`); los E y las preguntas siguen.

| # | Clase | Problema | Dónde | Estado |
|---|---|---|---|---|
| ~~PCA1~~ | C | ~~**Volver desde un detalle pierde los filtros** de Purchases, Outside repairs, Parts y el período de Truck → Costs~~ (UX-5-001) | `use-url-filters.ts` | **Hecho:** los filtros y el período viven en la URL (`useUrlFilters`), la búsqueda se escribe con pausa; Back, recargar y compartir el enlace los conservan. |
| ~~PCA2~~ | C | ~~**"Volver" lleva siempre a la lista, no a donde se venía**~~ (UX-5-002) | `admin-truck-origin.ts` (`adminPartsOrigin`, `adminTruckCostsHref`) | **Hecho:** todo enlace entre Costs, compras, reparaciones, facturas internas y WO lleva `?from=`; "Back" vuelve a donde se venía ("Back to the Truck’s costs", "…invoice", "…Work Order"); el camión abre en Costs con su crumb; el alta desde el camión o el Job (`?new=1&forTruck=&from=`) vuelve ahí al cerrar o guardar. |
| ~~PCA3~~ | C | ~~**La factura del taller externo llega después de "Regresó" y el Job ya no ofrece "Add outside repair invoice"**~~ (UX-10-001) | `admin-job-table.tsx`, `outside-repairs.service.ts` | **Hecho:** el Job trae `wentExternal`; vuelto sin factura muestra "Returned · no invoice yet" y mantiene la acción; la lista de Jobs para ligar no tiene ventana de 90 días (A76). |
| ~~PCA4~~ | C | ~~**Nada dice si un gasto ya se cobró a Finanzas**~~ (UX-10-002) | `admin-charged-on.tsx`, `cost-ledger.ts` | **Hecho:** "Charged to Finance" en compra y reparación, chip en cada movimiento de Costs, aviso en Edit y Void de algo facturado, y el crédito en la factura siguiente dice "Correction of SHOP-…" (A78). |
| ~~PCA5~~ | C | ~~**La factura interna de "Sep 2026" trae junio y agosto sin decirlo**~~ (UX-10-003) | `admin-internal-invoice-detail.tsx` | **Hecho:** sección "Carried over from earlier months" con subtotal en pantalla y en el PDF, y el diálogo de Send avisa cuánto es. La regla de D34 no cambia; si Finanzas no acepta el arrastre, es P18. |
| ~~PCA6~~ | C | ~~**Agregar el archivo después = Edit**, que reversa y reescribe el ledger aunque no cambió dinero~~ (UX-10-004) | `admin-invoice-file-dialog.tsx`, `PATCH …/attachment` | **Hecho:** "Add invoice file" / "Replace file" en el detalle sin pasar por Edit; Edit solo reescribe el libro si cambió algo que llega a él (A79). |
| ~~PCA7~~ | C | ~~**La tarifa de mano de obra no se puede corregir ni borrar**, y una fecha pasada recalcula sin preview~~ (UX-10-005) | `admin-labor-rate.tsx`, `labor-rates.service.ts` | **Hecho:** debajo del formulario dice cuántos WO recalcula y cuántos ya están facturados; la última tarifa se quita (con reversas) mientras ninguna factura enviada la use (A77). |
| PCA8 | E | **El grupo del menú mezcla cuatro ritmos** (semanal, catálogo, ajuste, cierre de mes) en 6 ítems planos; Internal invoices queda último. Propuesta: Labor rate a Setup, Internal invoices tercero (UX-5-003) | `admin-shell.tsx:26-38` | Abierto |
| PCA9 | E | **Vendors es un callejón sin salida** (sin enlace a sus facturas); los filtros Vendor listan proveedores que no hacen ese tipo de trabajo y al inactivo (UX-5-004) | `admin-vendors.tsx`, filtros de `admin-purchases.tsx` / `admin-outside-repairs.tsx` | Abierto |
| PCA10 | E | **Desde la WO no se llega a Costs del camión ni se ve lo que costó** (solo el chip del Job afuera) (UX-5-005) | `admin-work-order-detail.tsx` | Abierto |
| PCA11 | E | **Los detalles no tienen migas ni título de pestaña** ("Lightning Shop — Admin" en todas) (UX-5-006) | detalles de compra, reparación y factura interna; `app/admin/layout.tsx:7` | Abierto |
| PCA12 | E | **Un admin sin el par Manager entra por URL y ve el error genérico de carga** en vez de "sin acceso" (UX-5-007) | páginas `/admin/parts/*`, `admin-purchases.tsx:100` | Abierto |
| PCA13 | E | **Móvil: seis filtros apilados empujan la lista fuera de pantalla**; no usan `AdminFilterToolbar` (UX-5-008). Sube a C si el dueño carga desde el teléfono (P17) | `admin-purchases.tsx`, `admin-outside-repairs.tsx` | Abierto |
| PCA14 | E | **Internal invoices sin filtros ni totales**; el borrador se lista como "Draft" sin camión; la anulada dice "0 lines" (UX-5-009) | `admin-internal-invoices.tsx:43`, `internal-invoices.service.ts:52` | Abierto |
| PCA15 | E | Dos envíos simultáneos de la misma factura interna pueden numerar dos veces: el borrador se comprueba antes del lock (técnico; la UI deshabilita el botón) | `internal-invoices.service.ts:146-148` | Abierto |

**Preguntas al dueño (deciden tres hallazgos; se responden en DECISIONS):**
- **P15 · Cierre de mes por camión o por mes.** Hoy son 27 veces New invoice → Send → PDF → Accepted. ¿Una vista "By month" con todos los camiones y "Create drafts for all"? D34 no cambia (sigue una factura por camión y mes), solo se agrupa (UX-10-006).
- **P16 · Compras atadas a la WO.** Hoy "¿cuánto costó la WO-065?" solo se responde para mano de obra y talleres externos. ¿Campo opcional Work Order en la compra, prellenado con la WO abierta del camión? Si no, dejarlo escrito en D32 (UX-10-007).
- **P17 · Cargar facturas desde el teléfono.** La propuesta asume la computadora; D32 y USER_FLOWS dicen que el Manager también usa el teléfono. ¿Hace falta la historia "foto de la factura en el mostrador" y terminarla en el escritorio? Decide la severidad de PCA13 (UX-10-008).

## 1s. Velocidad y sensación de respuesta (2026-10-12) — **ABIERTO: PF1, PF9 (c, d), PF10–PF14 y P19–P23** (PF2, PF4, PF5, PF8 y PF9 a/b/e hechos en #296–#298; PF3 no es defecto; PF6 y PF7 son comportamiento deliberado)

El dueño pidió revisar rapidez y "feel" sin cambiar comportamiento. Se leyó el camino de cada clic (middleware, SWR, API, Prisma, esquema) y se midió producción y el build (`docs/reference/PERFORMANCE.md`, "Línea base 2026-10-12"). Nada de esto cambia lo que el usuario ve o puede hacer; solo *cuándo* se pinta y *cuántos viajes* cuesta. Las metas siguen siendo las de PERFORMANCE.md (P75: app usable < 2 s, navegación autenticada < 1 s, API caliente < 500 ms). Lo que sí cambiaría una regla va como pregunta P. Plan: PRs pequeños, uno por grupo (PR 0 docs, PR 1 Admin, PR 2 mecánico y sesión, PR 3 red, PR 4 API, PR 5 índices, PR 6 bundle solo si `next build` demuestra ganancia).

| # | Clase | Problema | Dónde | Estado |
|---|---|---|---|---|
| PF1 | C | **Cada clic de la barra lateral del Admin espera un viaje edge → API (`pdx1`) antes de pintar nada.** El middleware llama `GET /api/admin/access` con `no-store` en toda petición `/admin/*`, incluida la carga RSC de cada navegación; con el API frío son 2–5 s en blanco. `prefetch` está apagado a propósito (#129). Quitar el viaje cambia la regla de autorización (P19); mientras, lo que sí se puede es abaratar lo que cuelga de él (PF8, PF9). | `middleware.ts:10`, `admin-nav-link.tsx:15` | Abierto (P19) |
| ~~PF2~~ | C | ~~**Las acciones del Work Order (Admin) descartan la respuesta y vuelven a pedir todo.**~~ `runMutation` hace `await operation()` y luego `await mutate()` (refetch completo) antes del toast y de liberar el botón; el API ya devuelve el `AdminWorkOrderDetailDto` completo y se tira. Igual `refreshAfterAction`, `correctTime` y el detalle del camión. Un viaje extra por asignar, completar, pausar, reanudar, helper, external… | `admin-work-order-detail.tsx`, `admin-mutation-result.ts` | **Hecho** (PR 1): la respuesta de la acción se escribe al cache cuando es este Work Order (`workOrderDetailFromResult`); si no lo es, se vuelve a pedir como antes. El detalle del camión sigue igual: sus acciones no devuelven el DTO del camión. |
| ~~PF3~~ | — | ~~**Tres diálogos piden el detalle completo solo para leer `.version`** cuando no reciben `expectedVersion`.~~ | `close-work-order-dialog.tsx`, `return-to-service-dialog.tsx`, `next-step-action.tsx` | **No es defecto** (2026-10-12): el detalle y el camión ya pasan `expectedVersion`; el GET queda solo donde el padre tiene un resumen (lista, Dashboard, Yard), y el resumen no trae `version` a propósito. |
| ~~PF4~~ | C | ~~**Las listas del Admin parpadean a esqueleto aunque ya tengan datos.**~~ `adminInfiniteOptions` lleva `revalidateOnMount`, dedupe de 1 s, `persistSize: false` y no `keepPreviousData`; volver a Work Orders, Trucks, Mechanics, History o Yard, o cambiar un filtro, reemplaza la lista por `PageSkeleton`. El refresco tras mutaciones (#109) se conserva; solo se deja de ocultar lo que ya está. Catálogo, Parts, Purchases e Invoices ya usan `keepPreviousData`: ese es el patrón. | `admin-data.ts`, `admin-work-orders-list.tsx`, `admin-yard-operations.tsx` | **Hecho** (PR 1): `adminInfiniteOptions` lleva `keepPreviousData` y el dedupe global de 5 s; el esqueleto sale solo sin datos. El refresco al montar (#109) sigue. |
| ~~PF5~~ | C | ~~**El Yard carga dos veces y muestra dos esqueletos.**~~ La lista dispara sin `soonTrucks`; al llegar el boundary cambia la key y vuelve a pedir, y sin `keepPreviousData` vuelve el esqueleto completo. | `admin-yard-operations.tsx`, `yard-operations-routing.ts` | **Hecho a medias** (PR 1): el segundo esqueleto ya no aparece (PF4). Las dos peticiones siguen a propósito: hacer que la lista espere al boundary sería cambiar un parpadeo por una espera en cadena (el boundary llama a un servicio externo). |
| ~~PF6~~ | — | ~~**La home del mecánico espera el perfil antes de pedir Work Orders.**~~ `hasWorkspaceAccess` depende de `user.capabilities`, así que `useWorkOrders` y `TeamQueueCard` esperan a `/api/auth/me` (cadena JS → token → `/me` → lista). Va contra "las pantallas cargan con token, no con perfil" de ENGINEERING_PRACTICES. | `app/page.tsx` | **No se toca** (2026-10-12): es a propósito desde `6f7c1d0` (e2e "restored session verifies current capabilities before loading work orders"): el perfil decide qué lista se puede pedir. Si el dueño quiere revisarlo es P23, no un arreglo. |
| ~~PF7~~ | — | ~~**`/api/auth/me` se pide dos veces por carga**~~ (el cliente y la ruta `POST /api/admin/session`, que vuelve a llamar al API), también para mecánicos, que no usan la cookie de Admin. Un refresh de token de Supabase revalida **todas** las keys de SWR. | `auth-context.tsx`, `app/api/admin/session/route.ts` | **No se toca** (2026-10-12): se probó establecer la cookie solo para quien tiene `admin.access` y rompe la pantalla 403 "Shop Admin access denied" que ve un mecánico al entrar a `/admin` a mano (e2e `admin-shell.spec.ts` "secure forbidden screen"): sin cookie el middleware manda a `/login`. La segunda llamada a `/me` es el precio de ese 403 en servidor; la ruta de la cookie podría validar el JWT localmente, pero eso es P19. La revalidación por cambio de token solo alcanza hooks montados (SWR), así que no era un costo real. |
| ~~PF8~~ | C | ~~**Casi toda lectura al API paga un preflight CORS.**~~ El API está en otro origen y no fija `Access-Control-Max-Age` (el navegador cachea ~5 s); el cliente pone `Content-Type: application/json` también en GET, lo que fuerza el preflight. Dos viajes por lectura, incluidas las de polling. Verificado en producción: la respuesta OPTIONS no trae `max-age`. | `apps/api/src/main.ts`, `api.ts` | **Hecho** (PR 3): `Access-Control-Max-Age: 600` en el API y `Content-Type` solo en peticiones con cuerpo (todo lo que no es GET/HEAD lo conserva). |
| PF9 | C | **El API repite trabajo en el camino caliente** — (a), (b) y (e) hechos en PR 4; (c) y (d) abiertos. (a) `closeDue()` (un `workSession.findMany`) corre antes de cada lectura del mecánico, del detalle Admin, del work plan y de cada mutación, y `clockOf` va en serie aunque no depende de la lista. (b) Dashboard: `countReadyToGoTrucks` (carga el tablero del Yard completo) y `getDashboardQueue` van en serie después del `Promise.all`; dentro, abiertas y completadas en serie; `getAttention` hace 6 `findMany` con `summaryInclude` sobre las mismas WOs abiertas que luego carga la cola (~100 sentencias por llamada, cada 30 s por admin). (c) Yard: `list`, `getCounts`, `countReadyToGoTrucks` y `shopStatusByTruckNumber` cargan cada uno el tablero completo en la misma petición. (d) Mutaciones de WO: `requireWo` con ~10 relaciones 2 veces + recarga final + `this.detail(id)` + otra en `persistWorkOrderMutation`. (e) `AuthGuard` solo se provee en `AuthModule`; los demás módulos crean instancias propias con su propio cache JWKS, y se intenta JWKS antes de HS256 aunque el token diga `alg`. | `labor-clock.service.ts`, `work-orders.service.ts`, `admin.service.ts`, `yard-operations.service.ts`, `auth.guard.ts` | **Parcial** (PR 4): (a) `closeDue` sigue primero (puede escribir) y luego `clockOf` y las filas salen juntas, en la lista y en el detalle del mecánico; (b) Dashboard: Ready to Go y la cola entran al `Promise.all`, y abiertas/completadas de la cola van juntas (las 6 listas de atención siguen como consultas: derivarlas de la cola cambiaría el resultado con más de 200 WOs abiertas); (e) un solo cache JWKS por proceso y un token HS256 va directo al secreto. **Abierto:** (c) el Yard carga el tablero completo en `list`, `getCounts` y `countReadyToGoTrucks` (su spec fija el orden de las llamadas al mock; se hace con su propia reescritura de la prueba); (d) relecturas de `requireWo` y `this.detail(id)` en las mutaciones. |
| PF10 | C | **Faltan índices en columnas por las que se filtra u ordena**: `work_orders(updated_at)` y `(status, completed_at)`; `work_sessions(ended_at) WHERE ended_at IS NULL` (lo lee `closeDue` en cada request); `truck_cost_entries(reverses_entry_id)` (el `reversals: { none: {} }` del ledger hace NOT EXISTS sin índice), `(work_order_id)`, `(vendor_id)`; `activity_logs(user_id, created_at)` y `(entity_type, event_type, created_at)`; `work_order_jobs(completed_by_id)`, `(is_custom, review_status)`, `(external_since)`; `work_order_notes(kind, handled_at)`; `pause_events(work_order_id, is_official_pause, resolved_at)`. `Truck @@index([truckNumber])` es redundante con el `@unique`. Solo índices, por migración y Release safety. | `prisma/schema.prisma` | Abierto (PR 5) |
| ~~PF11~~ | E | ~~**El JS compartido por toda página es 343 kB gz**~~ (en 2026-08 eran 133–135 kB por ruta; hoy 340–450 kB). Dentro: Sentry Replay 38 kB cargada en el bundle de todas las páginas (Sentry la ofrece lazy), y los **guiones del demo ("A day at the shop") viajan a producción** en el chunk del layout porque `DemoModeProvider`/`DemoPanel` se importan sin condición. | `instrumentation-client.ts`, `components/demo-mode.tsx` | **Hecho** (PR 6): Replay se carga con `Sentry.lazyLoadIntegration` después de pintar (mismas tasas 0.1 / 1.0); el proveedor y el panel del demo viven en un chunk `next/dynamic` que producción nunca pide. `next build`: compartido 225 → 187 kB; cada ruta −38 kB (ej. `/admin` 413 → 375, `/mechanic/standard` 348 → 309). |
| PF12 | E | **El catálogo de textos del Admin (2 995 líneas, en+es) va en el bundle cliente** (chunk de 42 kB gz compartido por las páginas admin) por 34 imports de `getAdminMessages`/`adminPauseReasonLabel` desde componentes, además de viajar en el payload RSC de cada página (`layout` y cada `page` pasan `messages`). | `lib/admin-messages.ts`, `truck-information-fields.tsx`, `admin-yard-data-boundary-cards.tsx` | Abierto: son 34 imports en componentes cliente; mover el catálogo a props o a un contexto es una PR propia, medida (chunk `336`, 42 kB gz). |
| PF13 | E | Sin `optimizePackageImports` para `radix-ui`; logo del Admin 1536×894 con `priority` mostrado a 28 px. | `next.config.js`, `admin-shell.tsx` | **Parcial** (PR 6): `optimizePackageImports: ['radix-ui']` entró, pero el build no mostró ganancia medible (< 1 kB); el logo sigue igual (next/image ya sirve un tamaño por `sizes`; verificar en producción qué variante baja antes de tocarlo). |
| PF14 | E | **Polling superpuesto**: Dashboard 30 s + boundary 30 s; Yard lista 30 s + boundary 30 s; WO list 15 s; WO detail 15 s; mecánico 30/15 s; team queue 20 s; QC 20 s; `revalidateOnFocus` global. No es defecto; infla la carga del API y la probabilidad de pegar un arranque frío en el clic. Los intervalos están en ENGINEERING_PRACTICES y **no se cambian** en esta revisión; PF8 y PF9 abaratan cada tick. | `shop-data.ts`, `admin-data.ts`, `quality-check-data.ts` | Anotado |

Preguntas (van a `DECISIONS.md` cuando el dueño las decida):

- **P19 · Middleware del Admin sin viaje al API.** Hoy cada navegación `/admin/*` valida el token llamando al API. Alternativa: verificar el JWT en el edge (jose + JWKS de Supabase, como hace el API) y llevar nombre/rol en una cookie firmada que se renueva con `POST /api/admin/session`. Quita 1 viaje (y el arranque frío) de cada clic; una desactivación tardaría hasta 60 min en cortar la **vista** (las acciones las sigue negando el API). Cambia la regla de autorización → decisión.
- **P20 · Cache del usuario en el guard del API (30 s por instancia).** Ahorra 2 consultas por request; una desactivación tarda hasta 30 s en aplicar.
- **P21 · Acotar "Completed" en la lista del mecánico.** `GET /api/work-orders` trae **todas** las WOs completadas visibles para el mecánico, con detalle completo (sesiones, pausas, notas, actividad), sin fecha ni `take`: crece para siempre. Acotarla (p. ej. 30 días) cambia el número de "View completed work (N)". ¿Cuánto hacia atrás necesita ver el mecánico?
- **P23 · Home del mecánico sin esperar el perfil.** `GET /api/work-orders?mode=` podría salir con el token y el modo de la URL (la capacidad sigue decidiendo qué se muestra). Hoy se espera a `/me` a propósito (`6f7c1d0`). ¿Se mantiene?
- **P22 · `connection_limit` del `DATABASE_URL` de producción.** `.env.example` usa `connection_limit=1` con pgbouncer; si producción lo copia, cada `Promise.all` del API corre en serie sobre una conexión. Lo ve el dueño en Vercel → ltl-shop-api → Environment Variables (no se imprime aquí). Si es 1, subir a 3–5 es un cambio de env, no de código.

## 2. Pruebas

- **Pruebas de flujo contra el sistema real** (`apps/api/test-real/`, LTR-174):
  56 comprobaciones, una por fila de `USER_FLOWS.md`. Son la definición de
  "funciona". No corren en `npm test` ni en CI todavía (necesitan Postgres);
  ponerlas en CI es parte de la Fase B (el CI ya levanta Postgres y corre
  `prisma migrate deploy`, así que solo falta el seed y el paso).
- CI (`.github/workflows/ci.yml`) corre los specs del API, su `tsc` y el
  `next build`, pero **no** los vitest de la web (58 archivos `*.spec.ts`) ni
  Playwright; conviene añadir `npm run test --workspace=@ltl-shop/web` al
  workflow (hallazgo 2026-10-12, revisión de velocidad §1s).
- Las pruebas e2e de la web (28 archivos) corren **solo contra la API falsa**
  (`apps/web/e2e/fixtures/admin-api.mjs`). Sirven para la pantalla, no para
  saber si el flujo funciona.
- La API falsa responde con una lista a cualquier `POST /api/work-orders*`
  que no conoce (mismo error que arregló LTR-172 para notas).
- Sin prueba de pantalla: marcar un pedido de trabajo como atendido, "Add
  missing steps", `/reset-password`, `/access-denied`, tarjetas de las listas
  en el teléfono, padding seguro del menú lateral, idioma de
  `global-error.tsx`.

## 3. Limpieza de código — LTR-180 — **HECHO (2026-09-30)**

**HECHO (2026-09-30, LTR-180).** Ver `SYSTEM.md` §11. La migración `drop_pm_authorized` va por el flujo Release safety antes de desplegar la API.

- ~~Endpoints de readiness sin pantalla: `POST /admin/trucks/:id/readiness-assessments`,
  `PATCH /admin/readiness-assessments/:id/requirements/:type`, `…/mark-ready`,
  `…/close`. `deriveReadiness` ya no se llama. Textos `markReady*` sin usar.~~
  Quitados los cuatro endpoints, `markReady`/`closeAssessment` del servicio,
  `deriveReadiness` y sus esquemas. Se conservan `startAssessment` y
  `updateRequirement` del servicio porque la inspección del Work Plan
  (`yard-work-plan.service.ts`) los usa por dentro.
- ~~Endpoints de equipo `POST/DELETE /admin/work-orders/:id/mechanics`.~~ Quitados.
- ~~`POST /admin/work-orders/:id/jobs`.~~ Quitado; `addJobByManager` sigue
  porque el Work Plan lo usa.
- ~~`POST /work-orders/:id/jobs` del mecánico.~~ Quitado.
- ~~Formulario Standard muerto en `work-orders/new/page.tsx`.~~ La página solo
  tiene "Create PM service" (801 → ~430 líneas).
- ~~Pausa/reanudar/terminar del mecánico y la vista `PmWorkOrderDetail`.~~
  Quitados los endpoints `POST /work-orders/:id/{pause,pause-reason,resume,complete}`,
  la vista y los enlaces de pausa/reanudar del inicio del mecánico PM. Un WO de
  PM legacy que quedara abierto solo lo cierra o cancela el Manager. Los e2e
  de Daniel ahora corren sobre el PM job del WO del camión.
- ~~Columna `pmAuthorized`.~~ Migración `20260930120000_drop_pm_authorized_ltr180`
  (`DROP COLUMN IF EXISTS`, irreversible; el dato se deriva de `mechanic.pm`).
  Fuera del esquema, la API, los DTOs, el seed y los fixtures.
- ~~Comentario viejo en `schema.prisma` (`ShopWorkflowStep`).~~ Corregido. El
  comentario de la migración `20260928030000` ("Schema only… until LTR-154")
  se queda tal cual: es una migración aplicada y no se reescribe.
- ~~`supabase/migrations/20260825140000_init_domain.sql`.~~ Se deja con un
  `README.md` que dice que es copia congelada y que Prisma manda.
- ~~Textos de Admin sin usar en `admin-messages.ts`.~~ 117 claves fuera de
  `en` y `es` (readiness Phase 1, feeds del patio, "Add job" viejo, etc.).

## 4. Idioma — LTR-181

- ~~62 textos `locale === 'es' ? … : …` escritos directo en 13 archivos, fuera
  de los catálogos (más en `reset-password`, `trucks/[id]/history`,
  `ui.tsx`). LTR-167 agregó 5 en el menú de perfil (Idioma, Tema, Claro,
  Oscuro, Auto) aunque la clave `language` ya existe en el catálogo.~~ —
  hecho (LTR-181): 53 textos pasaron a claves de `locale-context.tsx`; los 12
  restantes eran etiquetas `Intl` (`'es-US' : 'en-US'`), no copy, y ahora
  salen de `intlLocale()` en `shop-locale.ts`. En `apps/web/src` ya no queda
  ningún `=== 'es' ?` fuera de los catálogos.
- ~~Textos solo en inglés que quedan en el mecánico ("Create failed", "Action
  failed", "Unable to load shop reference data", la nota de búsqueda parcial
  de camiones…).~~ — hecho (LTR-181): 15 textos con versión en español
  (también `access-denied`, el aviso de fin del PM y los errores de sesión de
  `auth-context`). Las pantallas de PM legacy y el formulario Standard ya no
  existen (LTR-180).
- ~~29 lugares leen `.message` de errores de la API (siempre en inglés) y lo
  muestran al usuario, también en español.~~ — hecho (LTR-181): todos pasan
  por `apiErrorMessage()` (`lib/api-error-message.ts`), que traduce los 43
  `code` de la API (`lib/api-error-copy.ts`, expuesto como `apiError` en los
  dos catálogos), usa la copia de red/timeout y, si no hay código, muestra el
  texto crudo solo en inglés; en español siempre cae al respaldo del
  catálogo. Los errores de Supabase Auth (credenciales, correo sin confirmar,
  límite de intentos, contraseña débil o repetida) también se mapean.
  `app/error.tsx` y `global-error.tsx` ya estaban traducidos (LTR-170).
- Queda, a propósito:
  - `updatePasswordSheetCopy()` en `lib/password-change-prompt.ts` es un
    mini-catálogo aparte (la hoja de contraseña y `reset-password` lo
    comparten). Mudarlo a `locale-context.tsx` es cosmético.
  - Los errores de configuración de desarrollo ("Supabase is not
    configured…") siguen en inglés: no los ve un usuario del taller.
  - Los valores por defecto de `PageSkeleton`, `LoadFailure` y `MultiSelect`
    en `ui.tsx` son ingleses, pero ningún llamador los usa (todos pasan copy
    del catálogo).

## 5. Para salir en vivo — LTR-45

Paso a paso en [`GO_LIVE_CHECKLIST_ES.md`](GO_LIVE_CHECKLIST_ES.md) (2026-10-05):
mirar producción, variables, migrar y desplegar, cuentas (el Manager da de alta
al personal, D22), configurar el taller, limpiar datos de prueba, un día de
prueba en iPhone real. Terminado cuando el taller trabaja un día completo con
usuarios reales sin un defecto B.

## 6. Fuera de alcance (no se construye hasta decidirlo)

- **Samsara** (millaje de referencia, ubicación, fallas) y **camiones propios** con API para terceros: decidido en parte (D35), **propuesta** en `docs/proposals/samsara-trucks/`, sin construir; preguntas P12–P14.
- Presencia física en el patio (geocerca de Samsara, LTR-55), McLeod, Dispatch, Schedule_Teams.
- Off Duty (decidido: se lanza sin eso), sincronizar con Ninox (P4).
- Trailers como activos: el taller los necesita; falta decidir cuándo (P11).
- Pantalla de permisos. Alta de mecánicos **sí** entra (LTR-187, D22), y
  también los Jobs del catálogo (D25). Las **categorías y los aliases** entran
  desde D30 (2026-10-07). Camiones, después (P13, propuesta en `docs/proposals/samsara-trucks/`).
- Inventario de partes (stock, entradas y salidas): diseñado en D32 (§8.3 de la
  propuesta `docs/proposals/parts-costs/`), **no se construye** todavía. La mano de
  obra y la factura interna a Finanzas **ya están construidas** (D34, 2026-10-09).
- Rendimiento por Job, tiempos por Job, espera por motivo.
- Espacios de trabajo de Detailing, Body Shop, Trailer e Inspector.
- Notificaciones push (decidido: solo dentro de la app).
