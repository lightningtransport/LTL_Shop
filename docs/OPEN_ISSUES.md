# Pendientes: defectos, limpieza y salida en vivo

**Actualizado:** 2026-10-05 (G3 y G4 hechos, LTR-188; Fase A hecha; cuestionario de operación)

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

### Fase D — Salir en vivo (§5) — LTR-45 — **SIGUE**

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
| 3 | **Custom Jobs sin revisión** — **E (bajó de C), decidido D25 (2026-10-05)** | **Hecho (2026-10-05):** el Manager agrega y edita Jobs del catálogo (Admin → Job Catalog) y, en el Work Plan, puede marcar "Agregar también al catálogo" al crear un Job personalizado; un nombre repetido en la categoría no se acepta y se elige el que existe (fila A36; A26 sin 403 para el Manager). **Sigue:** los Custom Jobs viejos quedan en `pending_review` sin pantalla; la bandeja para revisarlos va después (LTR-57). | `work-orders.service.ts` (l. 367, 851), `admin.controller.ts` (catálogo) |
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

## 1e. Work Order Detail (Admin): rediseño propuesto (2026-10-05) — **EN CURSO** (Etapas 2, 5 y 7 hechas el 2026-10-06) · Linear [LTR-190](https://linear.app/ltransl/issue/LTR-190)

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

## 1f. Truck Detail (Admin) y reparto Truck ↔ Work Order (2026-10-05) — **EN CURSO** (Etapa 4 hecha el 2026-10-06) · Linear [LTR-190](https://linear.app/ltransl/issue/LTR-190)

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

## 1g. Dashboard y Yard Operations (Admin) (2026-10-05) — **EN CURSO** (Etapas 1, 3 y 6 hechas el 2026-10-06) · Linear [LTR-190](https://linear.app/ltransl/issue/LTR-190)

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

## 1i. Después del merge del rediseño (#244) (2026-10-06) — **EN CURSO**

| # | Clase | Problema | Estado |
|---|---|---|---|
| G1 | B | **La API de producción no se publicaba desde el 2026-09-30.** 15 despliegues seguidos fallaron porque 4 migraciones de `main` no estaban aplicadas (`safety_quality_check_ltr185`, `drop_pm_authorized_ltr180`, `day_close_ltr186`, `helper_external_jobs_ltr188`) y el build no publica con migraciones pendientes. Producción mezclaba la web nueva con la API del ~30 de septiembre. | Migraciones aplicadas con `release-safety.yml` (run 37526676075, verde). Falta publicar la API de nuevo y revisar las pantallas en producción. |
| G2 | E | **"✓ Complete" en la fila de un Job pendiente parece un estado**, no un botón (botón sin borde con un check). El dueño leyó que Detailing de WO-004 estaba completado, pero el Job está "To do" y el selector de mecánico está bien habilitado. | Arreglo: botón con borde y "Mark complete". |
| G3 | E | **Truck con un paso obligatorio faltante:** el chip dice "Not Ready · PM" (el primer paso sin hacer) mientras el aviso dice que falta Detailing. Visto con los datos demo (Truck 944). | Arreglo: el chip nombra primero el paso que falta. |
| G4 | E | **Mismo Job, dos palabras:** el Work Plan del Truck dice "Pending" y el Work Order "To do". | Arreglo: "To do" en los dos. |
| G5 | E | **Work Order › Repair history:** el título es "Recent repair history" y se parte en dos líneas junto al filtro; la maqueta y el Truck dicen "Repair history". | Arreglo: "Repair history". |
| G6 | B | **Datos de prueba en producción que ven todos:** la nota de cierre "Ready Putos" de Fuel Filters (WO-010, guardada en el evento `job_completed` del Activity Log) y el pedido de trabajo "jlkhl" (WO-010). Revisión de producción del 2026-10-07. | **Hecho 2026-10-07** (aprobado por el dueño): sin la nota del evento `job_completed` (ff996aea…); borrados la nota `work_request` "jlkhl" (a0a38956…) y su evento `note_added` (fb5b0a2f…). Verificado: no quedan. |
| G7 | E | **Mecánico › "Waiting on Manager" dice "The Manager closes them"** aunque queden Jobs de otros (PM, Quality Check): el Manager todavía no puede cerrar. | Arreglo: "…The Manager closes it when every step is done" y, en el detalle, "Your Jobs are done… when every step is done" (EN/ES). |
| G8 | B | **Reloj de 38 h:** MG tiene en WO-004 una sesión del 2026-09-29 9:15 a. m. al 2026-09-30 11:21 p. m. El cierre del día (D20, LTR-186) no estaba en la API de producción hasta el 2026-10-06. | Además, **`CRON_SECRET` no está configurado en la API de producción**: `GET /api/internal/day-close` responde 503 "CRON_SECRET is not configured", así que el respaldo de Vercel Cron no corre. **`CRON_SECRET` hecho 2026-10-07:** el dueño lo agregó en Vercel (ltl-shop-api, Production, Secret) y volvió a publicar; `/api/internal/day-close` sin secreto ahora responde 401. Falta corregir la sesión como la habría cortado D20 (fin el 2026-09-29 a las 5:00 p. m.), desde History › Times con sesión de Manager. |
| G9 | B | **Mechanics › el detalle de una persona de Safety dice "This mechanic could not be found"**: la lista incluye Safety (LTR-185) pero `GET /admin/mechanics/:id` solo buscaba Standard y PM, así que no se podía abrir ni editar. Visto al crear la primera cuenta de Safety en producción (2026-10-07). Editar y reiniciar la contraseña ya aceptaban Safety. | **Hecho** (#249, 2026-10-07): el detalle usa el mismo filtro que la lista; verificado en producción con la cuenta QC. |
| G10 | B | **La cuenta QC no puede iniciar sesión:** la API de producción no tiene `SUPABASE_SERVICE_ROLE_KEY`, así que al crear a QC (2026-10-07) la app guardó la persona sin cuenta de acceso en Supabase Auth (el aviso "Access account not created in this environment" se pasa por alto). Y "Reset password" respondía `AUTH_ACCOUNT_MISSING`, así que no había cómo crearla. Los otros 6 usuarios activos sí tienen cuenta. | Arreglo: "Reset password" crea la cuenta que falta, la liga y muestra la contraseña temporal. **Hecho 2026-10-07** (#251): el dueño agregó `SUPABASE_SERVICE_ROLE_KEY` (Secret, Production). Un "Redeploy" del despliegue del #250 dejó producción con el código anterior hasta que se volvió a publicar el del #251. Después, Reset password creó la cuenta de QC; QC inicia sesión, ve `/qc` y queda fuera de `/admin` y de las pantallas del mecánico. El enlace del Admin bloqueado decía "Return to mechanic Home" también para Safety; ahora dice "Return to your Home" / "Volver a tu inicio" (lleva al inicio de cada persona). |

## 1j. Pantalla de Safety (Quality Check) (2026-10-07) — **EN CURSO**

Revisión de `/qc` con la base demo local, antes de proponer su rediseño (como las Etapas 1–8 del Admin).

| # | Clase | Problema | Estado |
|---|---|---|---|
| Q1 | B | **La lista no cambia al tocar Take, Approve o Return.** La API arma la respuesta leyendo la base fuera de la transacción, antes de guardar el cambio, y devuelve la lista vieja: después de "Take" la tarjeta sigue diciendo "Take" (con el aviso "Truck 606 is yours"); después de "Approve" el camión sigue en la lista. Se corrige al recargar o a los 20 s. Las pruebas reales pedían la lista con un GET aparte y no lo veían. | Arreglo: la respuesta lee dentro de la misma transacción; `test:real` revisa la respuesta de cada botón. |

## 2. Pruebas

- **Pruebas de flujo contra el sistema real** (`apps/api/test-real/`, LTR-174):
  56 comprobaciones, una por fila de `USER_FLOWS.md`. Son la definición de
  "funciona". No corren en `npm test` ni en CI todavía (necesitan Postgres);
  ponerlas en CI es parte de la Fase B (el CI ya levanta Postgres y corre
  `prisma migrate deploy`, así que solo falta el seed y el paso).
- Las 16 pruebas e2e de la web corren **solo contra la API falsa**
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

- Presencia física en el patio (Samsara), McLeod, Dispatch, Schedule_Teams.
- Off Duty (decidido: se lanza sin eso), sincronizar con Ninox (P4).
- Trailers como activos: el taller los necesita; falta decidir cuándo (P11).
- Pantallas para escribir categorías y permisos. Alta de mecánicos **sí**
  entra (LTR-187, D22) y los Jobs del catálogo también (D25); camiones después.
- Rendimiento por Job, tiempos por Job, espera por motivo.
- Espacios de trabajo de Detailing, Body Shop, Trailer e Inspector.
- Notificaciones push (decidido: solo dentro de la app).
