# PROPUESTA: camiones propios, Samsara y API para terceros

**Estado:** diseñado, **no construido** (2026-10-09; ampliado 2026-10-13). Sale de dos chats del dueño: "Base de datos propia de camiones" e "Integración API Samsara para camiones". Decisiones: D35 y **D42** (fallas → Jobs recomendados) en [`DECISIONS.md`](../../DECISIONS.md); preguntas abiertas P12–P14. **Maqueta:** [`mockup.html`](mockup.html) (7 pantallas; ábrela en el navegador). Linear: épica [LTR-46](https://linear.app/ltransl/issue/LTR-46); Samsara [LTR-202](https://linear.app/ltransl/issue/LTR-202); camiones propios y API [LTR-203](https://linear.app/ltransl/issue/LTR-203).

## Qué quiere el dueño

> "Quiero cambiar el juego": que los camiones sean **nuestros**, traer de **Samsara** millaje, fallas y ubicación, y que la persona que hoy nos da su API pase a **consumir la nuestra**.

## Dónde estamos hoy (revisado en `origin/main`)

- Los camiones **ya viven en nuestra base** (`trucks` en Supabase). Ninox se usó una sola vez para cargarlos; la app no lo vuelve a consultar ([SYSTEM.md §8](../../SYSTEM.md)).
- **La dependencia real:** no hay pantalla para dar de alta ni editar camiones (D22: "Camiones: fuera por ahora"). Un camión nuevo hoy pasa por Ninox.
- **Samsara no está conectado.** Existen `samsara_id`, `samsara_truck_location` y `samsara_last_connected_date`, pero son datos viejos de aquella carga. El millaje solo cambia al terminar un PM (`pm-finish.ts`, D10: no baja).

## Tres pasos; cada uno vale solo

### Paso 1 — Los camiones son nuestros
El Manager da de alta, edita y desactiva camiones desde Admin, como hoy hace con la gente (D22/D31). Antes: una última comparación con Ninox por número de camión para no perder lo que solo tiene él (dispatcher, aseguradora, placas). Con este paso solo, ya no dependemos.

### Paso 2 — Datos de Samsara (sincronización automática)
**Decidido por el dueño (D35):**
1. **Millaje: dos valores.** El oficial lo sigue fijando el mecánico en el PM con el tablero físico (D10 igual). La lectura de Samsara se guarda aparte y se muestra como referencia ("Samsara: 412,300 mi · hace 2 h"). En el PM el campo **no se precarga**; si la diferencia pasa de **50 mi** (P12), aviso suave que no bloquea.
2. **Fallas**, en una pestaña **Faults** del camión para el Manager (como Costs): activas arriba (código, descripción, severidad STOP / warning / check engine, desde cuándo), historial abajo. **Ampliado por D42 (2026-10-13):** las fallas se recomiendan como Jobs en Add work y el mecánico ve la falla dentro de su Job (ver "Paso 2b").
3. **Ubicación:** dirección y hora de Samsara en la ficha, con link al mapa. Sigue siendo informativa; la presencia en el patio por perímetro es LTR-55.

**Decidido (P12, D42, 2026-10-13):** una sincronización **cada 15–30 min** que lee el feed de Vehicle Stats de Samsara (`obdOdometerMeters`/`gpsOdometerMeters`, `gps`, `faultCodes`), **sin webhook** (basta con la lista). La dispara un **workflow programado de GitHub Actions** (como `.github/workflows/demo-reset.yml`) que llama a `POST /api/internal/samsara-sync` con el secreto de cron, porque Vercel Hobby solo permite crons una vez al día. No va en `apps/api/vercel.json`.

**Cómo se construiría (resumen):**
- Token de Samsara de **solo lectura** como secreto `SAMSARA_API_TOKEN` (solo servidor). **Creado 2026-10-13:** "LTL Shop", solo Read Vehicles y Read Vehicle Statistics (P12); el valor lo tiene el dueño.
- Emparejar camiones por `samsara_id`, luego VIN, luego número; los que no casan se listan, no se adivinan.
- Migración: campos `samsara_odometer_*`, `samsara_lat/lng/location_at` en `trucks`; tablas `truck_faults` (abre/actualiza/cierra con `cleared_at`) y `samsara_sync_state` (cursor, última corrida, error). Por Release safety.
- `POST/GET /api/internal/samsara-sync` con secreto de cron (patrón `day-close.controller.ts`); idempotente; **nunca** escribe `trucks.mileage`.
- Estado en Integrations (última corrida, errores, sin emparejar).

**Etapas:** S-1 token y lectura de prueba (no escribe) — **hecho 2026-10-14: Setup → Samsara** (OPEN_ISSUES §1w) · S-2 millaje y ubicación · S-3 fallas · S-4 referencia en el PM · S-6 fallas → Jobs recomendados (D42). ~~S-5 webhook de fallas~~: **descartado** el 2026-10-13, al dueño le basta la lista (D42).

### Paso 2b — Fallas → Jobs recomendados (D42)

El dueño quiere ver la última ubicación y las fallas de **todos** sus camiones y que una falla no se quede en una pantalla: que llegue al taller como trabajo sugerido. Maqueta: [`mockup.html`](mockup.html).

**Cómo funciona hoy (revisado en `origin/main`, 2026-10-13):** la WO nace solo con el camión (D13, `admin-new-work-order.tsx` manda `jobs: []`); los Jobs se agregan en **Add work** del camión (`work-plan-add-work.tsx`, D6): categoría → Jobs del catálogo o uno personalizado. Un `WorkOrderJob` no tiene origen ni severidad y no existe ninguna lógica de "Jobs recomendados". Lo más parecido es la bandeja de **Custom Jobs to review** (LTR-57): agrupa por nombre normalizado, sugiere Jobs del catálogo y deja rastro.

**Decidido por el dueño (2026-10-13):**

| # | Pregunta | Respuesta |
|---|---|---|
| 1 | ¿Dónde aparecen los Jobs recomendados? | En **Add work**. New Work Order solo avisa "este camión tiene N fallas activas" (D13 no cambia) |
| 2 | ¿Qué fallas se recomiendan? | **STOP, warning y check engine** (confirmadas). Las *pending* de OBD-II solo se ven en la pestaña |
| 3 | ¿El sistema aprende qué Job corresponde a cada código? | **Sí.** La primera vez el Manager elige el Job del catálogo; las siguientes, ese código viene con ese Job |
| 4 | ¿Quién ve las fallas? | El Manager ve la pestaña Faults; **el mecánico ve la falla dentro de su Job** |
| 5 | ¿Alerta cuando un camión en ruta prende STOP? | **No, basta con la lista** (orden por severidad y filtro "With faults"). Sin webhook |
| 6 | ¿Cuándo una falla "volvió"? | Si Samsara la reporta otra vez **dentro de 48 h** después de completar el Job |

**Pantallas (maqueta):**
1. **Trucks:** columnas "Last location · Samsara" (dirección, hace cuánto, en movimiento o estacionado, link al mapa) y "Faults" (peor severidad + cuántas más). Filtro "With faults", orden por severidad. Sin señal: "No Samsara signal · last seen…"; sin emparejar: "Not paired with Samsara".
2. **Truck → Faults:** banner "2 active faults, 1 with the STOP light"; activas (severidad, descripción, código SPN/FMI o DTC, desde cuándo, cuántas veces, Job que se recomendará) e historial con cuatro finales: **Fixed in WO-x**, **Came back**, **Cleared** (sola), **Dismissed** (con razón y quién).
3. **New Work Order:** solo el aviso.
4. **Add work:** sección "Recommended from Samsara faults" antes del catálogo, cada falla con su Job marcado; código nuevo → elegir el Job del catálogo (o uno personalizado, que va a la bandeja); "Dismiss with reason".
5. **Job del mecánico:** bloque "Why: Samsara fault" con descripción, código, luz y veces.
6. **Después de la WO:** Fixed o Came back (48 h).
7. **PM:** referencia de Samsara bajo el campo de millas, sin precargar; aviso suave si difiere (D35).

**Jobs to be done** (J15–J19 en [`USER_FLOWS.md`](../../USER_FLOWS.md) §1):

| # | Quién | Cuando… | Quiero… | Para… |
|---|---|---|---|---|
| J15 | Manager | reviso la flota | ver dónde está cada camión y cuáles traen fallas graves | decidir qué camión llamo al taller primero |
| J16 | Manager | planeo el trabajo de un camión | que sus fallas activas me aparezcan como Jobs sugeridos | no olvidar reparar lo que el camión ya reportó |
| J17 | Mecánico | trabajo un Job que vino de una falla | ver el código y qué significa | diagnosticar sin buscar en otro sistema |
| J18 | Manager | se terminó el trabajo de una falla | saber si la falla se fue o volvió | no dar por reparado algo que sigue fallando |
| J19 | Mecánico PM | anoto las millas del tablero | ver lo que dice Samsara como referencia | detectar un tablero o un sensor mal |

**Task flow (el sistema):**
1. Un workflow de GitHub Actions llama cada 15–30 min a la sincronización, que lee Samsara (millas, GPS, fallas).
2. Falla nueva → se abre en `truck_faults`. Deja de venir → se cierra (`cleared_at`).
3. En Add work la app lista las fallas activas STOP / warning / check engine que **no** están cubiertas por un Job abierto ni descartadas.
4. Job sugerido por falla: el del mapa aprendido código → Job del catálogo; si el código es nuevo, el Manager elige uno (o escribe uno personalizado, que entra a la bandeja de Custom Jobs como cualquier otro).
5. Al aceptar se crea el `WorkOrderJob` ligado a la falla; la falla muestra "In WO-x"; el mapa código → Job se guarda.
6. Job completado y falla cerrada → "Fixed in WO-x". Falla de nuevo dentro de 48 h → "Came back", vuelve a Activas y se recomienda otra vez.
7. Descartar pide razón y guarda quién; no se recomienda otra vez hasta que la falla se cierre y reaparezca.

**User flow del Manager (HU-M15 en `USER_FLOWS.md` §7):** ve en Trucks el badge STOP del 601 → abre el camión, pestaña Faults → New Work Order (aviso de 2 fallas) → Add work: 2 recomendados marcados; en el código nuevo elige "Coolant leak diagnosis" → "Add 2 Jobs", elige quién → el mecánico ve la falla en su Job → días después el historial dice "Fixed in WO-1190" (o "Came back").

**Qué cambia en los datos (además de lo de D35):**
- Tabla puente `work_order_job_faults` (un Job puede cubrir varias fallas; una falla, un Job abierto a la vez).
- `truck_faults`: `dismissed_at`, `dismissed_by_id`, `dismiss_reason`, `resolved_work_order_id`, `came_back_at`.
- `fault_code_jobs`: código normalizado (protocolo + SPN/FMI o DTC) → `catalog_job_id`, último que lo usó y cuándo. Misma idea que `JobAlias` y `normalizeCatalogText`.
- Pantallas: `admin-trucks-list.tsx`, `admin-truck-detail.tsx` (pestaña Faults), `admin-new-work-order.tsx` (aviso), `work-plan-add-work.tsx` (recomendados), la vista del Job del mecánico y `pm-service-card.tsx`.

### Paso 3 — Darle nuestros datos a esa persona
API de **solo lectura** con su propia llave revocable, solo los campos que necesita y formato **versionado** (patrón de `/api/admin/yard/data-boundary` con `AGENT_REPORTING_KEY`). Durante la transición no se le corta lo que hoy recibe: primero tiene nuestra API, después dejamos la suya.

## Riesgos
- Límite de consultas de Samsara: por eso se lee en segundo plano, nunca al abrir una pantalla.
- Un código "aprendido" mal (el Manager eligió el Job equivocado una vez) se repite: el Job sugerido siempre se puede cambiar y el cambio reemplaza el aprendido.
- La propuesta de inspección (`proposals/inspection-checklist/`, D41 reservada) también crea Jobs desde hallazgos: al construir, que las dos usen el mismo origen de Job.
- Vercel Hobby solo permite crons una vez al día. **Resuelto (P12, 2026-10-13):** la sincronización la dispara un workflow programado de **GitHub Actions** cada 15–30 min; Vercel sigue en Hobby.
- El token ya existe ("LTL Shop"); si se pierde el valor, se regenera en Samsara y se cambia el secreto en Vercel.

## Preguntas abiertas (en DECISIONS)
- ~~**P12**~~ Samsara: **cerrada 2026-10-13** — sin webhook, GitHub Actions dispara la sincronización, token "LTL Shop" de solo lectura creado, aviso de millas a 50 mi.
- **P13** Alta de camiones en Admin: ¿cuándo?, ¿qué campos de Ninox se conservan?
- **P14** API para la otra persona: ¿qué datos usa hoy (solo camiones o también estado de WOs)?
