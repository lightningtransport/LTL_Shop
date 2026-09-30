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
11 fallan · 2 no aplican. **Hoy:** 53 funcionan · 1 falla (defectos #1, #2, #4 y #7
arreglados: LTR-175, LTR-176, LTR-177, LTR-182; queda la regla de Safety,
LTR-185). Matriz completa: `apps/api/test-real/results/matrix.md`. Las 11
fallas son 5 defectos:

| Defecto | Filas que fallan | Clase | Ticket |
|---|---|---|---|
| #8 → D19: solo Safety puede ser dueño de QC (por construir) | E9b | — | LTR-185 |

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

Orden: ~~#1~~ ~~#2~~ ~~#4~~ ~~#7~~ hechos (LTR-175, 176, 177, 182) → #9 (LTR-184) → #6 (LTR-178) → los C de §1b
(LTR-179). El #8 pasó a LTR-185 (D19: solo Safety puede ser dueño de QC).

**En paralelo:** construir el Quality Check de Safety (D19, LTR-185) antes
de salir en vivo. D20 y P7, P8, P11 se deciden antes de la Fase D. Cada PR: arreglo + su fila en `test-real/` pasa a
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
| 5 | **"Mechanic note: undefined"** *(solo visible en pantalla)* — C | Reportado en la revisión de UX del 27-sep. La auditoría confirma que las notas se guardan y se leen bien (fila A22); falta mirarlo en la pantalla del mecánico. | — |
| 6 | **Texto de QC contradice D15** — C, LTR-178 | `workPlanQcHint` y `workPlanReadyAutomatic` dicen que Quality Check es opcional; QC siempre es obligatorio. En ES además dice "Quality Check" en lugar de "Control de calidad". | `apps/web/src/lib/admin-messages.ts` (EN ~l. 712/731, ES ~l. 1449/1468; también `truckNextStepQc`) |
| 9 | **Sesiones de tiempo sin mecánico** — C, LTR-184 | El detalle Admin del WO lista las sesiones de trabajo sin decir de quién es cada una. Con dos mecánicos no se sabe cuál corregir. | `admin.service.ts` (~l. 2193, `laborSessions`) |


## 1c. Huecos de operación (cuestionario del 2026-09-29)

No son defectos: es trabajo del taller que la app no cubre. Cada uno
necesita su decisión en `DECISIONS.md` antes de construirse. Las historias
están en `USER_FLOWS.md` §6.

| # | El taller | La app hoy | Clase | Ticket |
|---|---|---|---|---|
| G1 | **El Quality Check lo hace Safety** (dos personas) — **decidido (D19)** | Lo marca el Manager; Safety no tiene cuenta ni pantalla | **B** para salir en vivo | LTR-185 |
| G2 | El tiempo olvidado debe detenerse solo a cierta hora; el tiempo se usa para costear | Corre hasta que alguien lo corrige a mano | C | LTR-186 |
| G3 | A veces dos mecánicos trabajan en la misma tarea | Un dueño por Job; el tiempo del ayudante se pierde | C | LTR-188 (P7) |
| G4 | A veces se manda trabajo a un taller externo | No existe | C | LTR-188 (P8) |
| G5 | El Manager da de alta camiones y mecánicos | Sin pantalla; el Manager no tiene permiso | C | LTR-187 |
| G6 | El taller también trabaja trailers | Solo camiones | por decidir cuándo | LTR-188 (P11), LTR-56 |
| G7 | El reloj debe correr en un solo camión a la vez — **decidido (D21)** | Corre en los dos (D2 viejo) | C | LTR-188 (P9) |

**Efecto en los defectos:**
- **#8 (LTR-183) quedó absorbido por LTR-185.** Con D19, el Quality Check sí
  tiene dueño: la persona de Safety que lo toma.
- **#9 (LTR-184) importa más:** las sesiones no dicen de quién son, y ese
  tiempo se usa para costear.

## 1b. Defectos menores de la UI móvil (LTR-165, revisión 2026-09-29) — LTR-179

| # | Problema | Dónde |
|---|---|---|
| U1 | **Archivo de build en git:** `apps/web/.next-d14/trace` quedó en el repo (#207) y `.gitignore` no cubre `.next-d14`. | `.gitignore`, `apps/web/.next-d14/` |
| U2 | `next-env.d.ts` apunta a `./.next-e2e/types/routes.d.ts` (ruta local generada). | `apps/web/next-env.d.ts:3` |
| U3 | En el teléfono, las listas con solo búsqueda (Trucks) ya no tienen botón **Clear** (solo se muestra desde `md`). | `apps/web/src/components/ui.tsx` ~l. 862 |
| U4 | iPad con la app instalada: el bloque de nombre/rol del menú lateral queda debajo del indicador de inicio (se quitó el padding seguro del contenedor). *(LTR-171)* | `apps/web/src/components/admin-shell.tsx:62` |
| U5 | El color de la barra de estado sigue al tema del sistema, no al tema elegido en la app (sistema oscuro + app en Light = barra oscura sobre app blanca). *(LTR-171)* | `apps/web/src/app/layout.tsx:50` |
| U6 | Con cambio de contraseña pendiente, el botón de perfil abre primero la hoja de contraseña; para cambiar de idioma hay que cerrarla. | `apps/web/src/components/ui.tsx` ~l. 414 |
| U7 | `moreActionsHelp` dice que "More actions" incluye corrección de tiempos; ahora está en "History and audit". | `admin-messages.ts` (~l. 35 / 773) |
| U8 | Nueve textos del catálogo Admin quedaron sin uso al quitar descripciones (`completeWorkOrderDescription`, `jobsDescription`, `workRequestHint`, …). | `admin-messages.ts` |
| U9 | Admin en español todavía dice "unidad(es)" en algunos textos y en el selector de Truck de Nuevo Work Order (la regla de LTR-170 es "Trucks"). | `admin-messages.ts` (~l. 988, 1007, 1382–1393) |
| U10 | `POST …/work-plan/jobs`: si falla a mitad de camino, quedan Jobs agregados sin registro de idempotencia y el reintento recibe `VERSION_CONFLICT`; dos reintentos simultáneos con la misma clave chocan en el índice único. *(Existía antes de #206.)* | `apps/api/src/admin/yard-work-plan.service.ts` ~l. 255–290 |
| U11 | `@vercel/speed-insights` está en `apps/web/package.json` pero no en `package-lock.json`: `tsc` de la web falla en local hasta correr `npm install` (LTR-171). | `package-lock.json` |

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

## 3. Limpieza de código — LTR-180

Código que confunde porque ya no es parte del flujo (ver `SYSTEM.md` §11):

- Endpoints de readiness sin pantalla: `POST /admin/trucks/:id/readiness-assessments`,
  `PATCH /admin/readiness-assessments/:id/requirements/:type`, `…/mark-ready`,
  `…/close`. `deriveReadiness` (`yard-operations-derivation.ts`) ya no se
  llama. Textos `markReady*` sin usar en `admin-messages.ts`.
- Endpoints de equipo `POST/DELETE /admin/work-orders/:id/mechanics`
  (`@deprecated`).
- `POST /admin/work-orders/:id/jobs` (la UI usa `trucks/:id/work-plan/jobs`).
- `POST /work-orders/:id/jobs` del mecánico (siempre responde 403).
- Formulario Standard muerto en `apps/web/src/app/work-orders/new/page.tsx`
  (categoría, Jobs, "Select mechanics").
- Pausa/reanudar/terminar del mecánico: solo sirven para WOs de PM legacy.
  En producción no queda ninguno abierto (2026-09-29), así que se puede
  quitar ese código y la vista `PmWorkOrderDetail`.
- Columna `pmAuthorized`.
- Comentarios viejos: `schema.prisma` en `ShopWorkflowStep` ("runtime still
  reads MANDATORY_WORK_PLAN_JOBS") y la migración `20260928030000`.
- `supabase/migrations/20260825140000_init_domain.sql`: copia congelada;
  borrarla o dejarle un README que lo diga.

## 4. Idioma — LTR-181

- 62 textos `locale === 'es' ? … : …` escritos directo en 13 archivos, fuera
  de los catálogos (más en `reset-password`, `trucks/[id]/history`,
  `ui.tsx`). LTR-167 agregó 5 en el menú de perfil (Idioma, Tema, Claro,
  Oscuro, Auto) aunque la clave `language` ya existe en el catálogo.
- Textos solo en inglés en pantallas de PM legacy y nuevo WO ("Resume Work",
  "Change Pause Reason", "Jobs To Do", "Create failed", "Action failed"…).
- 29 lugares leen `.message` de errores de la API (siempre en inglés) y lo
  muestran al usuario, también en español. `app/error.tsx` y
  `global-error.tsx` ya están traducidos (LTR-170).

## 5. Para salir en vivo — LTR-45

Detalle en [`GO_LIVE_CHECKLIST_ES.md`](GO_LIVE_CHECKLIST_ES.md).

- Roster real y `work_orders.manage` para los Managers reales (P6).
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
