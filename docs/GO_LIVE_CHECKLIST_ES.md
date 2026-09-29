# Lista para abrir el Shop a usuarios reales

**Para:** Cristian
**Fecha:** 2026-09-20 (rutas y banderas actualizadas 2026-09-29)
**Preguntas abiertas:** se deciden en `docs/DECISIONS.md` (P1–P6)
**Idioma:** español, lenguaje claro
**Código de apoyo:** `docs/reference/NINOX_SHOP_MAPPING.md` y
`apps/api/src/integrations/ninox/ninox.mapping.ts`

Esta lista cierra lo que falta para que **personas reales** usen LTL_Shop.
No pide otro escaneo de MappingTool para camiones.

## Semilla de camiones (lunes)

Hay un job **de una sola vez**: baja TrucksDB `E` (solo GET), hace
**upsert** en Supabase por VIN + `truckNumber` (`E.A` / `E.CG`), y **no
vuelve a preguntar a Ninox**. Nunca escribe en Ninox. `E.X1`/`E.AN` van
a la ubicación reportada, **no** a Presence. `E.Y1`/`E.TA` no mueven el
tablero.

Comando: `npm run prisma:seed-ninox-trucks --workspace=@ltl-shop/api`

Detalle: `docs/reference/NINOX_TRUCK_SEED.md`.

## ¿Con el scan de MappingTool hecho, puede lanzar el Shop?

**Casi: el mapper ya no bloquea.** El Shop funciona con **Supabase / Prisma**.
El cliente Ninox de la API sigue siendo un stub. Para el lunes falta **correr
una vez** la semilla (migración + credenciales Ninox + script) si la flota
de producción no está completa.

La única llave de negocio que hacía falta ya está confirmada:

**número de camión del Shop (`truckNumber`) = `trucks.truck_number` = Ninox `E.A`**

Lo que falta para el go-live es trabajo de **producto, ingeniería, auth,
datos y ambiente del Shop**. No es un hueco de MappingTool, salvo que
decidan:

- meter **trailers UC** como activos (el ID de Ninox sigue **sin resolver**;
  no se inventa), o
- **sincronizar en vivo** el estado mecánico de Ninox (`E.TA`).

Las fases del patio / Work Plan **no** son `E.TA`.

---

## Hecho (DONE)

- MappingTool ya escaneó `lightningtransport.ninoxdb.com`: **163 tablas**.
- **TrucksDB = tabla `E`** (117 campos).
- **Número de camión = `E.A`.**
- **mechanic_status = `E.TA`.**
- El Shop guarda camiones en Postgres. La llave operativa es `truckNumber`.
- No hay IDs de tablas Ninox en Prisma (correcto). `ninox_external_id` es
  leftover de import, no la llave de cruce.
- El cliente Ninox solo responde un ping. `DATA_SOURCE=supabase`.
- Auth de producción es Supabase Auth + fila en `users` + capacidades
  (`admin.access`, `mechanic.standard`, `mechanic.pm`,
  `work_orders.manage`, `yard.operations.manage`).
- En local, `AUTH_DEV_BYPASS=true` y Dev Login sirven para desarrollo.
  Eso **no** es el modo de usuarios reales.
- El seed local crea 3 camiones de demo (`905`, `922`, `968`) y usuarios
  `@lightning.local`. **No se corre contra producción.**
- Producción ya tuvo ~162 camiones cargados de forma histórica (la mayoría
  con leftover Ninox/Samsara). El Shop **no** llama a Ninox ni a Samsara
  para buscar o mostrar el camión.
- Work Orders, PM, Admin y Yard Phase 1 ya existen en código.
- El camino de deploy (Vercel + Prisma migrate por el workflow aprobado)
  está documentado en `docs/reference/DEPLOY.md`.

---

## Falta de Ninox (NEED FROM NINOX)

Nada de esto bloquea abrir el Shop de **camiones** como está hoy.

- **Trailers UC:** tabla y campo en Ninox **siguen sin ID**. No inventar.
  En el Shop, “Trailer” hoy es una **categoría de trabajo**, no una flota
  de trailers sincronizada.
- **Valores de `E.TA`:** si más adelante quieren copiar el estado mecánico
  de Ninox, Ninox debe decir qué textos o códigos tiene ese campo.
- **Formato de `E.A`:** si quieren reconciliar listas (ceros a la
  izquierda, espacios, `#`), Ninox/ops debe confirmar cómo se escribe el
  número allá versus `truckNumber` aquí.
- **Token / API de Ninox:** solo si deciden un sync futuro. El código
  actual **no** lee secretos `NINOX_*`. No hace falta para el lanzamiento.

---

## Falta decisión de producto (NEED PRODUCT DECISION)

- **¿Lanzamos el Shop sin sync Ninox?** Recomendación: **sí**. El scan ya
  cerró la llave. Dual-write permanente sigue diferido a propósito.
- **¿Se muestra o se escribe `E.TA` (mechanic_status)?** Hoy el Shop usa
  sus propios eventos (por ejemplo Returned to Service / Unknown) y fases
  de patio derivadas. No usa `E.TA`.
- **¿Los trailers son activos propios o solo un tipo de trabajo?** Mientras
  sean solo categoría de Job, el ID UC no bloquea.
- **¿Quién da de alta un camión nuevo?** Hoy no hay editor Admin de
  camiones. Sin Ninox en vivo, alguien tiene que cargar o importar la
  fila en `trucks`.
- **Roster real:** qué personas entran el día 1, con qué capacidad
  (mecánico Standard, PM, Manager con `work_orders.manage`, Admin).
- **Off Duty:** no hay mutación todavía. ¿Se lanza sin eso?
- **No correr `db:seed` en producción.** Eso pisaría camiones CTC reales
  `905` / `922` / `968` con datos de demo.

---

## Falta ingeniería / ops (NEED ENGINEERING)

- Crear usuarios **reales** en Supabase Auth. El email debe coincidir con
  la fila activa en `users` y con las capacidades correctas.
- En producción: **`AUTH_DEV_BYPASS` apagado o ausente.** Nunca
  `NEXT_PUBLIC_` para service role ni tokens de Ninox.
- Completar env de Vercel (web + api): `DATABASE_URL`, `DIRECT_URL`,
  `NEXT_PUBLIC_SUPABASE_*`, `SUPABASE_JWT_SECRET` o JWKS, `CORS_ORIGIN`,
  `NEXT_PUBLIC_SITE_URL`, `DATA_SOURCE=supabase`.
- Confirmar que la lista de camiones de producción cubre la flota que
  el taller va a buscar. El cruce futuro con Ninox es **solo** `E.A`.
  Tres filas con pinta de demo (`9050`, `9220`, `9680`) no tienen id
  Ninox leftover; no son los CTC `905` / `922` / `968`.
- Aplicar la migración `20260920020000_ninox_truck_seed` y correr
  **una vez** `prisma:seed-ninox-trucks` con `NINOX_*` de servidor.
  Después borrar el token. No usar `db:seed` de demo en producción.
- **No implementar** el adapter Ninox en la API para el día 1. Si
  `DATA_SOURCE=ninox`, el ping de runtime falla: el adapter no existe.
- Smoke con un Manager y un mecánico reales: login → crear OT → Start
  Work → completar job → blocker → PM si aplica → patio.
- Migraciones Prisma solo por el workflow de Release safety. Un deploy
  verde en Vercel no prueba que la base se migró.
- Catalogo y partes PM: aplicar por el path de release
  (`prisma:apply-catalog`), no con el seed completo de demo.

---

## Qué no es bloqueo de mapper

| Tema | ¿Bloquea el launch del Shop? |
|---|---|
| Faltan IDs de las otras 162 tablas Ninox | No |
| Cliente Ninox es stub | No. Así debe quedar para el día 1 |
| Prisma no guarda table IDs de Ninox | No. La llave es el número de camión |
| `E.TA` no mueve el Work Plan | No. Son sistemas distintos |
| Trailer UC sin ID | No, si Trailer sigue siendo categoría de Job |
| Samsara / McLeod / Dispatch | No. Presencia sigue `UNKNOWN` |

---

## Orden sugerido para Cristian

1. Decidir: **Shop abre sin Ninox en vivo** (recomendado).
2. Cerrar roster y capacidades. Invitar Auth de verdad.
3. Revisar que los camiones de producción tengan el número correcto
   (`truckNumber` = el mismo que Ninox `E.A` cuando comparen listas).
4. Apagar Dev Bypass. Smoke con gente real.
5. Dejar trailers UC y sync `E.TA` para después, con IDs verificados,
   sin inventar campos.
