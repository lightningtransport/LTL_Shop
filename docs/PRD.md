# PRD — Lightning Shop

**Actualizado:** 2026-10-14 · **Dueño del producto:** Cristian Perez

Este documento responde **qué es el producto, para quién, qué módulos tiene,
qué no hace y hacia dónde va**. Es corto a propósito: no repite el detalle,
enlaza a donde vive.

| Para saber… | Ve a |
|---|---|
| Cómo funciona hoy, pantalla por pantalla y regla por regla | [`SYSTEM.md`](SYSTEM.md) |
| Historias de usuario (HU), jobs (J) y flujos paso a paso, con su prueba | [`USER_FLOWS.md`](USER_FLOWS.md) |
| Por qué es así: decisiones D1–D42 y preguntas abiertas P | [`DECISIONS.md`](DECISIONS.md) |
| Qué falta hacer | **Linear**, equipo LTR, un proyecto por módulo (resumen en [`OPEN_ISSUES.md`](OPEN_ISSUES.md)) |

---

## 1. Qué es

Lightning Shop es la aplicación del taller de camiones de **Lightning
Transport**. Lleva cada camión desde que llega al taller hasta que vuelve a
servicio: qué hay que hacerle, quién lo hace, qué lo detiene, cuánto tiempo y
dinero costó, y si Safety lo aprobó.

Reemplaza las hojas en papel, los mensajes y las preguntas de pasillo con una
sola lista de trabajo por camión que el Manager ve en la computadora y cada
mecánico en su teléfono.

**Principio (D43): la base es nuestra.** Camiones, trabajo, personas y costos
viven en nuestra base. Ninox se usó una sola vez para cargar los camiones y ya
no se consulta. Samsara se lee cada hora para lo que solo él sabe (millas,
ubicación, fallas) y se guarda aparte, sin pisar nuestros datos. Un tercero se
consulta solo cuando nos falta un dato, siempre de solo lectura, y la app sigue
funcionando si no responde.

**Estado:** construida y en producción con datos reales de camiones. La salida
en vivo con todo el personal está **en espera** por decisión del dueño
(2026-10-09); ver [`GO_LIVE_CHECKLIST_ES.md`](GO_LIVE_CHECKLIST_ES.md).

## 2. Para quién

| Persona | Dónde la usa | Su trabajo en la app |
|---|---|---|
| **Shop Manager** | Computadora y teléfono | Abre el trabajo de cada camión, inspecciona, reparte, destraba, cierra y devuelve a servicio. Configura el taller, el personal, el catálogo y los costos. |
| **Mecánico General (Standard)** | Teléfono | Ve solo sus Jobs, los trabaja con su reloj, avisa si algo lo detiene. Si tiene el permiso, inspecciona. |
| **Mecánico PM** | Teléfono | Hace el mantenimiento preventivo: millaje, partes, listo. |
| **Safety (QC)** | Teléfono | Revisa los camiones terminados y los aprueba o los devuelve con una nota. |
| **System Admin** | Computadora | Lo mismo que el Manager, más correcciones con rastro. |
| **Finanzas** | Fuera de la app | Recibe el PDF de la factura interna de cada camión por mes. |

Detalle de permisos: [`SYSTEM.md`](SYSTEM.md) §2. Idioma: inglés y español
completos (el taller usa los dos).

## 3. Problemas que resuelve

Los 21 jobs to be done (J1–J21) están en [`USER_FLOWS.md`](USER_FLOWS.md) §1.
En resumen:

- **El Manager** quiere saber, sin caminar el taller, qué tiene cada camión, quién lo hace y qué lo frena (J1–J5, J15–J16, J21).
- **El mecánico** quiere ver solo lo suyo y que su tiempo quede registrado sin trámites (J6–J9, J17, J19).
- **Safety** quiere que ningún camión salga sin su visto bueno (J11).
- **El taller** quiere cobrarle a Finanzas lo que hizo sin armar la cuenta a mano (J13–J14).
- **Todos** quieren un historial confiable aunque haya errores (J10).

## 4. Módulos

Cada módulo es un **proyecto en Linear** con el mismo nombre. Estado: ✅ en
producción · 🟡 en producción con pendientes · ⏸ en espera.

### 4.1 Work Orders & Jobs — ✅
Una sola Work Order abierta por camión. Nace con PM, Alignment, Detailing y
Quality Check; el Manager agrega Jobs y cada Job tiene un dueño. El mecánico
bloquea con motivo; solo el Manager resuelve. Ready to Go se calcula, no se
marca. Incluye ayudante en un Job y taller externo.
**Decisiones:** D1, D4+D9, D5, D6, D8, D11–D13, D17, D18, D23, D24, D26, D27 · **Historias:** HU-M1, HU-M3–HU-M6, HU-M10, HU-M11, HU-A1.

### 4.2 Yard — 🟡
Dashboard "Needs you" con lo que espera al Manager, y tablero Kanban del patio
por paso, con filtros y la pestaña Dispatch.
**Decisiones:** D26, D33 · **Historias:** HU-M7.

### 4.3 Trucks & Inspección — 🟡
Lista y ficha del camión (trabajo, fallas, ubicación, costos, historial).
Hoja de inspección de 53 puntos y 10 llantas; cada defecto crea su Job.
Desde D44 (LTR-215) los camiones se crean, editan, desactivan y conectan a
Samsara desde el Shop; la sincronización solo propone por VIN.
**Pendiente:** API para terceros (P14).
**Decisiones:** D10, D41, D43, D44 · **Historias:** HU-M2, HU-M16, HU-M17, HU-M18, HU-ME7.

### 4.4 Mecánicos — 🟡
Espacios del Mecánico General y del PM en el teléfono: My work, Trucks,
Completed; un reloj por persona y en un solo camión a la vez; cierre del día a
las 5:00 p.m.
**Decisiones:** D2, D12, D18, D20, D21, D-MG1–5, D-PM1–5 · **Historias:** HU-ME1–HU-ME6, HU-PM1.

### 4.5 Safety / QC — ✅
Cola `/qc` de Safety: tomar, aprobar o devolver con nota; el Manager como
respaldo.
**Decisiones:** D19, D29, D-QC1–7 · **Historias:** HU-QC1.

### 4.6 Setup, People & Permisos — 🟡
Shop workflow (equipos y colas por paso), horario del taller, Job Catalog con
categorías y aliases, bandeja de Custom Jobs, People (alta, desactivar, quitar),
checklist de inspección, Setup → Samsara.
**Pendiente:** modelo de roles y permisos con pantalla propia (LTR-161).
**Decisiones:** D16, D22, D25, D28, D30, D31, D-SET1–9 · **Historias:** HU-M8, HU-M9, HU-A2.

### 4.7 Parts, Costs & Finance — ✅
Catálogo de partes, proveedores, compras y reparaciones externas con su factura,
costo por camión, tarifa de mano de obra, cierre del mes y factura interna
`SHOP-AAAA-NNNN` en PDF para Finanzas.
**Construido (D45, ST-1 a ST-6, en producción desde el 2026-10-16):** repuestos y
llantas en el catálogo, compra atada al Job, **stock** (entra con la compra o a
mano, sale a un Job o con el PM al costo promedio), llantas propuestas desde la
inspección y lectura de facturas de proveedores en PDF
([`proposals/parts-stock-tires/`](proposals/parts-stock-tires/README.md)).
**Defecto abierto:** LTR-242 (B), el PM cobra dos veces una parte ya comprada al camión.
**Aprobado (D47, sin construir):** Parts como inventario único (sin menú Stock aparte),
acciones de stock con nombre (Add to stock, Adjust, Edit minimum) y un solo
"Parts…" en el Job ([`proposals/parts-stock-ia-v2/`](proposals/parts-stock-ia-v2/README.md)).
**Decisiones:** D32, D34, D37, D45, D-PC1–10 · **Preguntas:** P24, P26, P28, P31 · **Decisión:** D47 · **Historias:** HU-M12, HU-M13, HU-M19, HU-M20.

### 4.8 Samsara — ✅
Sincronización cada hora (millas, ubicación, fallas) solo de lectura. Las fallas
se recomiendan como Jobs, el sistema aprende el Job de cada código y sabe si la
falla se fue o volvió.
**Decisiones:** D35, D42 (P12 cerrada) · **Historias:** HU-M14, HU-M15.

### 4.9 Demo & Landing — ✅
Modo demo que cambia de usuario sin cerrar sesión, con guía, cursor y Play;
publicado por link con clave en un proyecto aparte de producción; landing
pública. Producción nunca tiene la demo.
**Decisiones:** D36, D39, D40 · **Guía:** [`reference/DEMO.md`](reference/DEMO.md).

### 4.10 Plataforma y Go-live — ⏸
Salida en vivo, deploy y migraciones (Release safety), login, app instalable
(PWA), idioma EN/ES, rendimiento (D38), pruebas y CI, sistema de diseño.
**Referencia:** [`reference/`](reference/), [`design-system/`](design-system/README.md).

### 4.11 Integraciones V3 — ⏸
Presencia en el patio por geocerca, trailers como activos, API para terceros
y, solo si hace falta un dato que no tenemos, leer algo de Ninox (P4). Nada se
empieza sin decisión (etiqueta **Gated** en Linear).
**Preguntas:** P4, P13, P14.

## 5. Qué NO hace

- Despachar cargas, nómina, reemplazar un sistema completo de flotas.
- Off Duty, notificaciones push (solo avisos dentro de la app).
- Inventario de partes (stock): propuesto en D45, no se construye hasta el OK y P25–P27.
- Rendimiento o tiempos por Job, espera por motivo.
- Espacios propios para Detailing, Body Shop, Trailer o Inspector.
- Escribir en Samsara o en Ninox (solo lectura).
- Finanzas no entra a la app.

## 6. Cómo sabemos que funciona

**Hoy (comprobado):** las pruebas de flujo contra la API real
(`npm run test:real`, filas A1–A110 de `USER_FLOWS.md`) definen "funciona".
La salida en vivo termina cuando el taller trabaja un día completo con usuarios
reales sin un defecto B.

**Métricas de producto (propuesta, por confirmar con el dueño):**

| Métrica | Qué dice | De dónde sale |
|---|---|---|
| Días en el taller por camión (llegada → Return to Service) | Si el taller es más rápido | Work Orders |
| % de camiones con QC de Safety antes de salir | Si se respeta el visto bueno | Quality Check |
| Horas de mecánico registradas vs. horas de turno | Si el reloj se usa de verdad | Sesiones de trabajo |
| Camiones con inspección guardada al llegar | Si la hoja reemplazó al papel | Inspecciones |
| Fallas STOP / warning con Job abierto en < 24 h | Si Samsara llega al taller | Samsara + Jobs |
| Facturas internas enviadas a tiempo cada mes | Si el taller cobra su trabajo | Internal invoices |

## 7. Hacia dónde va

| Cuándo | Qué | Proyecto Linear |
|---|---|---|
| **Ahora** | Alta de camiones y conectar Samsara (D44); pendientes chicos de UX por módulo | Yard, Trucks & Inspección, Mecánicos, Setup |
| **Salida en vivo** | Retomar la checklist, roster real, un día de prueba | Plataforma y Go-live |
| **Después** | Roles y permisos (LTR-161), trailers, API para terceros (P14), geocerca | Setup, Integraciones V3 |

## 8. Cómo se mantiene este documento

- Un módulo nuevo o un cambio de alcance se escribe aquí y se crea su proyecto en Linear.
- Una decisión nueva va a `DECISIONS.md` y se suma a la ficha del módulo.
- El estado de cada módulo (✅ 🟡 ⏸) se actualiza cuando cambia el de su proyecto en Linear.
