# PROPUESTA: camiones propios, Samsara y API para terceros

**Estado:** diseñado, **no construido** (2026-10-09). Sale de dos chats del dueño: "Base de datos propia de camiones" e "Integración API Samsara para camiones". Decisión: D35 en [`DECISIONS.md`](../../DECISIONS.md); preguntas abiertas P12–P14. Linear: épica [LTR-46](https://linear.app/ltransl/issue/LTR-46); Samsara [LTR-202](https://linear.app/ltransl/issue/LTR-202); camiones propios y API [LTR-203](https://linear.app/ltransl/issue/LTR-203).

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
1. **Millaje: dos valores.** El oficial lo sigue fijando el mecánico en el PM con el tablero físico (D10 igual). La lectura de Samsara se guarda aparte y se muestra como referencia ("Samsara: 412,300 mi · hace 2 h"). En el PM el campo **no se precarga**; si la diferencia pasa de un umbral, aviso suave que no bloquea.
2. **Fallas: solo lectura**, en una pestaña **Faults** del camión, solo para el Manager (como Costs): activas arriba (código, descripción, severidad STOP / warning / check engine, desde cuándo), historial abajo. Sin acciones en la primera versión.
3. **Ubicación:** dirección y hora de Samsara en la ficha, con link al mapa. Sigue siendo informativa; la presencia en el patio por perímetro es LTR-55.

**Recomendado (falta confirmar, P12):** un **cron cada 15–30 min** que lee el feed de Vehicle Stats de Samsara (`obdOdometerMeters`/`gpsOdometerMeters`, `gps`, `faultCodes`). Millaje y ubicación no tienen webhook, así que el cron hace falta igual; el webhook de fallas queda para después si hace falta enterarse al minuto.

**Cómo se construiría (resumen):**
- Token de Samsara de **solo lectura** como secreto `SAMSARA_API_TOKEN` (solo servidor).
- Emparejar camiones por `samsara_id`, luego VIN, luego número; los que no casan se listan, no se adivinan.
- Migración: campos `samsara_odometer_*`, `samsara_lat/lng/location_at` en `trucks`; tablas `truck_faults` (abre/actualiza/cierra con `cleared_at`) y `samsara_sync_state` (cursor, última corrida, error). Por Release safety.
- `POST/GET /api/internal/samsara-sync` con secreto de cron (patrón `day-close.controller.ts`); idempotente; **nunca** escribe `trucks.mileage`.
- Estado en Integrations (última corrida, errores, sin emparejar).

**Etapas:** S-1 token y lectura de prueba (no escribe) · S-2 millaje y ubicación · S-3 fallas · S-4 referencia en el PM · S-5 (opcional) webhook de fallas.

### Paso 3 — Darle nuestros datos a esa persona
API de **solo lectura** con su propia llave revocable, solo los campos que necesita y formato **versionado** (patrón de `/api/admin/yard/data-boundary` con `AGENT_REPORTING_KEY`). Durante la transición no se le corta lo que hoy recibe: primero tiene nuestra API, después dejamos la suya.

## Riesgos
- Límite de consultas de Samsara: por eso se lee en segundo plano, nunca al abrir una pantalla.
- Crons de menos de un día requieren **Vercel Pro**.
- El token lo crea un admin de la cuenta de Samsara.

## Preguntas abiertas (en DECISIONS)
- **P12** Samsara: plan de Vercel, quién crea el token, umbral de diferencia de millaje, cron confirmado.
- **P13** Alta de camiones en Admin: ¿cuándo?, ¿qué campos de Ninox se conservan?
- **P14** API para la otra persona: ¿qué datos usa hoy (solo camiones o también estado de WOs)?
