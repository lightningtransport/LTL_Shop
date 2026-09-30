# Pendientes: defectos, limpieza y salida en vivo

**Actualizado:** 2026-09-29 (Fase A hecha; cuestionario de operación)

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
11 fallan · 2 no aplican. **Hoy:** 64 comprobaciones · **62 funcionan · 0 fallan** · 2 no aplican
(defectos #1, #2, #4 y #7 arreglados: LTR-175, 176, 177, 182; Quality Check
de Safety construido: LTR-185; personal del taller A29–A31: LTR-187). Matriz completa: `apps/api/test-real/results/matrix.md`. Las 11
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

### Fase B — Arreglar bloqueantes (B) y confusos (C), uno por PR — **SIGUE**

Orden: ~~#1~~ ~~#2~~ ~~#4~~ ~~#7~~ hechos (LTR-175, 176, 177, 182) → ~~#9 (LTR-184)~~ ~~#6 (LTR-178)~~ hechos → recorrido de
pantallas hecho (§1d, LTR-189) → los C de §1d (~~W1~~ ~~W2~~ ~~W4~~ ~~W11~~ ~~W12~~ ~~W14~~ ~~W15~~ ~~W17~~ ~~W9~~ ~~W5~~ hechos; ~~W16~~ ~~W3~~ ~~W6~~ ~~W7~~ ~~W8~~ ~~W10~~ ~~W13~~ **todos hechos**) → ~~los de §1b
(LTR-179)~~ hechos (2026-09-30) → Fase C. El #8 pasó a LTR-185 (D19: solo Safety puede ser dueño de QC).

**Hecho:** el Quality Check de Safety (D19, LTR-185). D20 y P7, P8, P11 se
deciden antes de la Fase D. Cada PR: arreglo + su fila en `test-real/` pasa a
PASA + `USER_FLOWS.md` pasa a ✅ + fila borrada de aquí.

### Fase C — Limpieza (§3, LTR-180) e idioma (§4, LTR-181)

Borrar el código heredado y unificar los textos, para que nadie vuelva a
construir sobre algo muerto.

### Fase D — Salir en vivo (§5) — LTR-45

Roster real, Auth real, bypass apagado, prueba con un Manager y un mecánico
reales. **El uso real es lo que confirma que está terminado.**

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
| 3 | **Custom Jobs sin revisión** — C, pendiente de P5 | Quedan en `review_status = pending_review` para siempre; nada los mapea al catálogo (ver P5 en `DECISIONS.md`). | `work-orders.service.ts` (l. 367, 951) |
| ~~5~~ | ~~"Mechanic note: undefined"~~ — cerrado | No se reproduce en el recorrido de pantallas del 2026-09-29 (§1d). | — |


## 1c. Huecos de operación (cuestionario del 2026-09-29)

No son defectos: es trabajo del taller que la app no cubre. Cada uno
necesita su decisión en `DECISIONS.md` antes de construirse. Las historias
están en `USER_FLOWS.md` §6.

| # | El taller | La app hoy | Clase | Ticket |
|---|---|---|---|---|
| G2 | El tiempo olvidado debe detenerse solo a cierta hora; el tiempo se usa para costear | Corre hasta que alguien lo corrige a mano | C | LTR-186 |
| G3 | A veces dos mecánicos trabajan en la misma tarea | Un dueño por Job; el tiempo del ayudante se pierde | C | LTR-188 (P7) |
| G4 | A veces se manda trabajo a un taller externo | No existe | C | LTR-188 (P8) |
| ~~G5~~ | **Hecho 2026-09-30 (D22, LTR-187):** el Manager da de alta al personal (Standard, PM, Safety) con cuenta de acceso y contraseña temporal; desactiva solo sin trabajo abierto; reinicia contraseñas. Filas A29–A31. Camiones: después | — | — | LTR-187 |
| G6 | El taller también trabaja trailers | Solo camiones | por decidir cuándo | LTR-188 (P11), LTR-56 |
| G7 | El reloj debe correr en un solo camión a la vez — **decidido (D21)** | Corre en los dos (D2 viejo) | C | LTR-188 (P9) |

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

Detalle en [`GO_LIVE_CHECKLIST_ES.md`](GO_LIVE_CHECKLIST_ES.md).

- Roster real y `work_orders.manage` para los Managers reales (P6), más las
  dos cuentas de Safety con `quality_check.perform` (hoy "Safety 1" y
  "Safety 2" en el seed local).
- Usuarios reales en Supabase Auth; `AUTH_DEV_BYPASS` apagado en producción.
- Carga única de camiones de Ninox, si la flota de producción no está completa.
- Smoke con un Manager y un mecánico reales, incluido Safari en un iPhone real.
- Validar en datos de producción: Truck Detail (LTR-59) y Ready vs Complete
  vs Return to Service (LTR-60, LTR-123). Cerrar la épica LTR-149.

## 6. Fuera de alcance (no se construye hasta decidirlo)

- Presencia física en el patio (Samsara), McLeod, Dispatch, Schedule_Teams.
- Off Duty (decidido: se lanza sin eso), sincronizar con Ninox (P4).
- Trailers como activos: el taller los necesita; falta decidir cuándo (P11).
- Pantallas para escribir catálogo, categorías y permisos (hoy solo por API
  o nada). Alta de camiones y mecánicos **sí** entra: LTR-187.
- Rendimiento por Job, tiempos por Job, espera por motivo.
- Espacios de trabajo de Detailing, Body Shop, Trailer e Inspector.
- Notificaciones push (decidido: solo dentro de la app).
