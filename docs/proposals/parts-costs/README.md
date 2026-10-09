# Propuesta: Partes y costos por camión (etapa 1)

**Clasificación:** PROPUESTA — no es el estado actual de la app.
**Fecha:** 2026-10-07 · **Rama:** `claude/shop-workflow-revision-9afabe` · **Esperando la aprobación del dueño.**
**Pantallas (nuevas):**
- Parts & costs → **Purchases** (`/admin/parts/purchases`), **Outside repairs** (`/admin/parts/outside-repairs`),
  **Parts** (`/admin/parts/catalog`) y **Vendors** (`/admin/parts/vendors`).
- Truck → pestaña **Costs** (`/admin/trucks/[id]?tab=costs`), en `apps/web/src/components/admin-truck-detail.tsx`.

**Reglas que no cambian:**
- [D32](../../DECISIONS.md): etapa 1 = catálogo de partes, proveedores, compras con factura, reparaciones externas
  con factura y el historial de costos de cada camión. **Sin stock.** La mano de obra y la factura interna a
  Finanzas quedan **diseñadas, no construidas**.
- [D24](../../DECISIONS.md): "Enviar a taller externo" y "Regresó" siguen igual. Lo único que cambia es que ahora
  se puede cargar la factura del taller externo y asociarla a ese Job.
- D18 y D21: el tiempo es por mecánico y corre en un solo camión a la vez. Es la base del costo de mano de obra (§8).
- **El selector de partes del PM sigue igual** (HU-PM1, D-PM1, D-PM2): mismas partes, misma "más usada", mismo
  borrador en el teléfono. El mecánico no ve costos.

Hallazgos que cubre: UX-1-020, UX-5-004, UX-6-024 y UX-7-024 de la auditoría
[`docs/ux-audit/admin-setup/`](../../ux-audit/admin-setup/09-informe-final.md) (bloque S4 de
[`OPEN_ISSUES.md` §1m](../../OPEN_ISSUES.md)). La navegación sigue la estructura propuesta en
[`05-navegacion-ia.md`](../../ux-audit/admin-setup/05-navegacion-ia.md).

## 1. Cómo verla

Abre [`mockup.html`](mockup.html) en el navegador (un solo archivo, sin instalar nada). Arriba: teléfono o
computadora, claro u oscuro, **Fail next save** (la próxima acción de guardar falla) y **Demo**, con un botón
por situación:

- Purchases con datos (la pantalla de partida);
- primer uso (catálogo de la lista base sin costos, sin proveedores, sin compras);
- New purchase (el formulario, con una línea);
- factura repetida (FleetPride, la misma factura ya cargada);
- compra sin camión (para tener en el taller);
- factura repartida entre dos camiones;
- Outside repairs con datos;
- reparación externa abierta desde el Job "Radiator Repair" que se envió a taller externo;
- Parts (el catálogo por categoría del PM);
- desactivar una parte que está en un PM en curso (no deja);
- Vendors;
- Truck 601 → Costs;
- un camión sin costos;
- cargando;
- error al cargar.

Todo funciona con datos de ejemplo: buscar y filtrar, agregar o editar partes y proveedores, cargar una compra
con sus líneas (el total se calcula solo), adjuntar la factura, asociarla a uno o varios camiones, cargar una
reparación externa y ligarla al Job, anular un registro y ver cómo cambian los totales del camión.

## 2. Para qué sirve

Historia [J13](../../USER_FLOWS.md) y [HU-M12](../../USER_FLOWS.md): *el Manager compra partes o paga una
reparación afuera; quiere cargarla con su factura y asignarla al camión, para saber cuánto cuesta cada camión y,
después, cobrarle a Finanzas lo que hace el taller.*

El Manager lo hace una o dos veces por semana, en la computadora, con las facturas en papel o en PDF al lado.
Las pantallas responden cuatro preguntas:

- **Purchases:** ¿ya cargué esta factura? ¿qué compré y para qué camión?
- **Outside repairs:** ¿cuánto me cobró el taller externo y por qué Job?
- **Parts:** ¿qué partes usa el PM, para qué camiones sirven y cuánto cuestan?
- **Truck → Costs:** ¿cuánto lleva gastado este camión, en qué y cuándo?

## 3. Qué hay hoy

Revisado en el código el 2026-10-07. **No hay ninguna pantalla, tabla ni campo de dinero, proveedores o
archivos.** Lo que existe son las partes del PM:

| Pieza | Dónde | Qué hace hoy |
|---|---|---|
| `PartCategory` | `apps/api/prisma/schema.prisma:453` | Las 9 categorías del PM (Oil Filter 1 Unit, Oil Filter 2 Unit, Fuel Filter, Paper Fuel Filter, Cabin Air Filter, Desiccant Filter, Engine Air Filter, Wiper Blades, Coolant Filter): `slug`, `name` único, `aliases`, `sortOrder`, `active`. |
| `Part` | `schema.prisma:469` | `categoryId`, `partNumber` (opcional), `displayName`, `active`. Único por categoría + número + nombre. **Sin costo ni proveedor.** |
| `PartFitment` | `schema.prisma:487` | `make` y `model` opcionales. **Una parte sin filas sirve para todos los camiones**; con filas, solo para esas marcas o modelos. |
| `PmService` / `PmServicePart` | `schema.prisma:501`, `:517` | El PM guarda el millaje y **una parte por categoría** (D-PM2). `PmServicePart.partId` apunta a `Part` sin borrado en cascada: una parte usada en un PM no se puede borrar, solo desactivar. |
| `prisma/pm-parts.ts` | `apps/api/prisma/pm-parts.ts` | `PM_PART_CATEGORIES` (las 9) y `loadCanonicalPmParts()`, que lee el CSV, limpia los nombres ("PETERBILT" → "Peterbilt", "Papel" → "Paper"), une duplicados y **deduce para qué marcas sirve** cada parte por el texto (Peterbilt, Volvo, Mack, Freightliner; "Cascadia" como modelo). |
| `test/fixtures/pm-parts.csv` | `apps/api/test/fixtures/pm-parts.csv` | 93 filas exportadas de la lista vieja: `Id`, `Part Code`, `Part Description`, `Choice` (la categoría), `Is On Parts list?`, `Active`. Quedan **91 partes** (`src/parts/pm-parts-fixture.spec.ts`). **No trae costo ni proveedor.** |
| El seed | `apps/api/prisma/seed.ts:194-217` | La única forma de cargar partes. Primero **desactiva todas las partes** de las categorías del PM, después crea o reactiva las del CSV y **reescribe sus marcas**. Con un catálogo editable, correr el seed apagaría lo que agregó el Manager (lo arregla PC-1). |
| `getPmService` | `apps/api/src/work-orders/work-orders.service.ts:1569-1674` | Carga las categorías activas con sus partes activas, deja solo las que sirven para el camión (`partFitsTruck`, `:1903`) y calcula la más usada en ese modelo (D-PM1). Devuelve `id`, `partNumber` y `displayName`: **nunca un costo**. |
| `updatePmService` | `work-orders.service.ts:1676-1733` | En **cada** guardado vuelve a comprobar que todas las partes elegidas estén activas, sean de su categoría y sirvan para el camión. Si el Manager desactiva una parte, o le quita la marca, mientras un PM en curso la tiene elegida, el siguiente guardado del mecánico falla ("Invalid PM part selection" o "not compatible"). **Por eso el catálogo no deja hacer esos cambios mientras la parte esté en un PM en curso** (§4.3). |
| El selector del PM | `apps/web/src/components/pm-service-card.tsx` | Interruptores por categoría, con la parte más usada y el borrador en el teléfono. **No cambia.** |
| Taller externo (D24) | `schema.prisma:575-579` (`WorkOrderJob.external*`) y `apps/api/src/admin/admin.service.ts` | Mientras el Job está afuera tiene `externalSince`, `externalKind` (`part` o `truck`), `externalNote` y `externalById`. **"Regresó" borra esos cuatro campos** (`CLEAR_EXTERNAL`, `admin.service.ts:92`). El rastro queda en el Activity Log (`relevantValue.action` = `job_sent_external`, `:1917`, y `job_returned_external`, `:1943`). |
| Tiempo (D18, D21) | `schema.prisma:607` (`WorkSession`) | Una sesión por mecánico (`userId`, nulo en sesiones viejas), con `endReason` (`day_close`, `switched_truck`). Hay horas por camión y mecánico, **sin tarifa**. |
| `Truck` | `schema.prisma:194` | Sin ningún campo de costo. |
| Archivos | — | La app no guarda archivos. La API ya tiene `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`; **Supabase Storage no se usa todavía**. |
| Activity Log | `schema.prisma:724` | `workOrderId` es opcional y `eventType` es un enum. Sirve para registrar cambios fuera de un Work Order si se agregan valores al enum. |

En el menú (`apps/web/src/components/admin-shell.tsx:20-37`) solo están Operations, Setup (Mechanics, Job
Catalog, Shop workflow) y Audit. No hay sitio para partes ni costos (UX-5-004).

## 4. Qué cambia (la maqueta)

### 4.1 El menú

Un grupo nuevo, **Parts & costs**, entre Operations y Setup (se usa cada semana; Setup, de vez en cuando):

```
Operations    Dashboard · Yard Operations · Work Orders · Trucks (› pestaña Costs)
Parts & costs Purchases · Outside repairs · Parts · Vendors
Setup         (igual; lo reordena el bloque S2)
Audit         History
```

Solo lo ven el Manager y el System Admin (§5.6). Finanzas no tiene entrada hasta que exista (§8).

### 4.2 Purchases (compras de partes)

- **Lista**, la más nueva arriba. Cada fila: fecha, proveedor, número de factura en letra mono, cuántas líneas,
  a qué camión va ("Truck 606", "606, 918" o "No truck · shop stock") y el total. Un clip si tiene la factura
  adjunta; si no, el chip ámbar "No invoice file".
- **Filtros:** buscar por factura, proveedor o parte; proveedor; camión ("No truck" incluido); período.
- Arriba, el total de lo filtrado y lo que quedó sin camión ("7 purchases · $2,470.34 · No truck: $1,135.67").
- **New purchase** (panel a la derecha en la computadora; pantalla completa en el teléfono):
  1. **Vendor** con autocompletar sobre los que ya existen y "Add vendor ‘…’" si no está (UX-7-024).
  2. **Invoice date**, hoy por defecto; se puede escribir.
  3. **Invoice #**. Al salir del campo, si ese proveedor ya tiene esa factura, aviso ámbar:
     *"FleetPride invoice 88412093 is already saved (Oct 6 · $612.40)."* con **Open it**. Al guardar, la API
     la rechaza igual (§5.5).
  4. **Truck (optional)**: "No truck · shop stock" por defecto. Si se viene desde un camión, ya viene elegido.
     Con **Lines go to different trucks**, cada línea tiene su camión.
  5. **Lines**: parte del catálogo (busca por nombre o número, agrupadas por categoría del PM) u **Other (not in
     catalog)** con su descripción; cantidad; costo unitario (se llena con el costo de referencia de la parte);
     el total de la línea se calcula solo. **Add line** y quitar línea.
  6. **Tax** y **Freight & other**, opcionales.
  7. **Total**, en vivo, con "Assigned to trucks: $X · No truck: $Y" cuando hay reparto.
  8. **Invoice file**: arrastrar o elegir; "PDF, JPG or PNG · up to 10 MB" antes de elegir; progreso y quitar.
  9. **Notes**, opcional.

  Los montos aceptan "1,250.00" y "1250" (`inputmode="decimal"`, moneda visible). Los errores salen junto a cada
  campo. **Save purchase** pasa a "Saving…" y se desactiva; el envío lleva una clave de idempotencia (§5.5).
  Cerrar con cambios pregunta "Discard this purchase?".
- **Detalle** de una compra: las líneas, el reparto por camión con enlace a cada uno, la factura (abrir o
  descargar) y quién la cargó y cuándo. En `…`: **Edit** y **Void**. Anular pide el motivo y no borra nada: el
  registro queda tachado y los costos del camión se descuentan (§5.4).

### 4.3 Parts (el catálogo)

Es **el mismo catálogo que usa el PM**. La pantalla lo deja ver y mantener.

- **Agrupado por las 9 categorías del PM**, en el orden del PM. Cada fila: número de parte (mono), nombre,
  **Fits** ("All trucks", "Volvo", "Freightliner Cascadia"), costo de referencia, **último pagado** ("$24.10 ·
  Oct 6 · FleetPride"), proveedor habitual y el estado (Active / Inactive).
- Una parte sin costo muestra **"No cost yet"** como dato pendiente, no un "—" (UX-6-024).
- **Filtros:** buscar por nombre o número; "Fits" por marca; mostrar inactivas.
- **Primer uso:** *"These are the PM parts from the base list. Add a unit cost or a vendor to start tracking
  costs."* (UX-6-024).
- **Add part / Edit part:** categoría, número, nombre, Fits ("All trucks" o marcas y modelo), costo de referencia,
  proveedor habitual y Active. Muestra "Used in 38 PMs · last on Oct 6".
- **Protección del PM:** si la parte está elegida en un PM **en curso**, no deja desactivarla ni quitarle la marca
  de ese camión: *"Used in the PM in progress on Truck 968. Change it after that PM is finished."* (porque
  `updatePmService` volvería a validar y el mecánico no podría guardar, §3).
- No se puede borrar una parte, solo desactivarla (los PM viejos la siguen mostrando).
- **Sin categorías nuevas en la etapa 1** (D-PC3): las compras de cosas que no son del PM (pastillas de freno,
  aceite a granel) van como **Other** con su descripción.

### 4.4 Vendors (proveedores)

- **Lista** con nombre, qué hace (**Parts**, **Outside repairs** o los dos), teléfono, cuántas compras y
  reparaciones tiene y lo gastado este año. Inactivos al final, atenuados.
- **Add vendor / Edit vendor:** nombre (no se repite, sin importar mayúsculas: "Fleetpride" avisa que ya existe
  "FleetPride"), qué hace, teléfono, correo, número de cuenta del taller con ese proveedor, notas y Active.
- Un proveedor con registros no se borra; se desactiva y deja de salir en el autocompletar.

### 4.5 Outside repairs (reparaciones externas)

- **Lista**: fecha, camión, proveedor, descripción, el Job ligado ("Radiator Repair · WO-001 · part") y el monto.
- **New outside repair**: **Truck** (obligatorio), Vendor (los que hacen reparaciones primero), Date, Invoice #
  (el mismo aviso de factura repetida), **What was done**, **Amount (USD)**, Invoice file y **Job sent to an
  external shop**:
  - opciones: los Jobs de ese camión que están afuera ahora, o que salieron en los últimos 90 días (del Activity
    Log, §5.3), con el WO, qué salió (pieza o camión) y cuándo; y "Not linked to a Job";
  - si se abre desde el Job (en el `…` del Job: **Add outside repair invoice**, y un enlace después de
    **Regresó**), el camión y el Job ya vienen elegidos: "From WO-001 · Radiator Repair".
- El Job ligado muestra en el Work Order un chip "Invoice $1,840.00 · Diesel Pro" (solo Manager y System Admin).

### 4.6 Truck → Costs

Una pestaña nueva en el detalle del camión: **Overview** (lo de hoy) · **Costs**.

- **Período**: This month · Last 3 months · This year · All time.
- **Totales**: Parts · Outside repairs · **Total**. Al lado, dos lugares reservados y desactivados:
  - **Labor · coming later**, con las horas que ya existen en las sesiones (D18): "44.75 h recorded in this
    period" (Truck 601, últimos 3 meses). Sin tarifa no hay monto.
  - **Charge to Finance · coming later**: "An internal invoice per truck and period" (§8).
- **Por mes**: barras simples, una por mes, partidas por tipo.
- **Movimientos**: fecha, tipo (chip), qué fue ("FleetPride · 88412093 · Fuel Filter LFF8897 × 2"), el WO o Job
  si lo hay, y el monto. Cada uno abre su compra o su reparación. Los anulados salen como **Voided** con el monto
  negativo.
- **Add purchase** y **Add outside repair** con el camión ya elegido.
- **Vacío**: *"No costs for Truck 612 yet. Purchases and outside repairs assigned to this truck show up here."*
- **Las partes del PM no se cuentan solas** (D-PC4): una nota corta lo dice y enlaza a Purchases.

### 4.7 Estados (todas las pantallas)

- Cargando con esqueletos (`PageSkeleton`, `CardListSkeleton`).
- Error al cargar con **Retry** (`LoadFailure`).
- Vacío con la acción principal ("No purchases yet" → **New purchase**) y "sin resultados" distinto de vacío.
- Error al guardar: el formulario queda abierto con lo escrito y un mensaje propio ("Could not save the purchase.
  Nothing was saved. Try again.").
- Éxito: toast ("Purchase saved · $612.40 · 2 trucks") y la fila nueva resaltada.
- El borrador de New purchase y New outside repair queda en `sessionStorage` hasta guardar o descartar (más de
  5 campos, UX-7-024).

## 5. Modelo de datos y API (todo aditivo)

Ninguna tabla ni columna existente cambia de tipo ni se borra. Cada etapa es una migración de Prisma que solo
**agrega**, y va a producción por el workflow **Release safety** (`docs/reference/DEPLOY.md`) antes de desplegar
la API.

### 5.1 Reglas de dinero

- **Centavos enteros** (`Int`, `amount_cents`): nunca `Float`. $1,250.00 = `125000`.
- Cada monto lleva `currency` (`char(3)`, `'USD'` por defecto), aunque hoy solo hay dólares (D-PC1).
- La cantidad es `Decimal(10,2)` (galones de aceite, 2 unidades de filtro). El total de la línea =
  cantidad × costo unitario, **redondeado al centavo en la API**. La API recalcula todos los totales y rechaza un
  total que no cuadre: el navegador solo los muestra.
- Fechas de factura como `date` (sin hora). El período de un costo es la fecha de la factura (`occurred_on`), no
  la de carga.

### 5.2 Tablas nuevas y columnas nuevas (etapa 1)

| Tabla / columna | Campos | Notas |
|---|---|---|
| **`vendors`** | `id`, `name`, `does_parts` bool, `does_repairs` bool, `phone`, `email`, `account_number`, `notes`, `active`, `created_by_id`, `created_at`, `updated_at` | Índice único sobre `lower(name)` (SQL en la migración). |
| **`parts`** + | `unit_cost_cents Int?`, `default_vendor_id uuid?` → `vendors`, `source` (`seed` \| `app`, por defecto `seed`) | `unit_cost_cents` es el **costo de referencia**. `source` deja que el seed no apague lo que creó el Manager. Nada de esto sale en `getPmService`. |
| **`part_purchases`** | `id`, `vendor_id`, `invoice_number`, `invoice_date` (date), `tax_cents`, `freight_cents`, `total_cents`, `currency`, `notes`, `idempotency_key` (único), `created_by_id`, `created_at`, `updated_at`, `voided_at`, `voided_by_id`, `void_reason` | Único `(vendor_id, lower(invoice_number))` **mientras no esté anulada** (índice parcial, SQL en la migración). |
| **`part_purchase_lines`** | `id`, `purchase_id`, `part_id?` → `parts`, `description` (copia del nombre, o el texto de "Other"), `part_number` (copia), `quantity Decimal(10,2)`, `unit_cost_cents`, `line_total_cents`, `truck_id?` → `trucks`, `sort_order` | El camión va **por línea** (una factura puede ser de varios camiones). La pantalla lo llena igual en todas cuando se elige un solo camión. |
| **`outside_repairs`** | `id`, `truck_id` (obligatorio), `vendor_id`, `invoice_number`, `invoice_date`, `description`, `amount_cents`, `currency`, `work_order_id?`, `work_order_job_id?` → `work_order_jobs`, `external_kind?` (copia de `part`/`truck`), `idempotency_key`, `created_by_id`, timestamps, `voided_*` | Mismo índice parcial de factura. El Job debe ser de ese camión. |
| **`attachments`** | `id`, `bucket`, `object_path`, `file_name`, `content_type`, `size_bytes`, `sha256`, `owner_type` (`part_purchase` \| `outside_repair`, después `internal_invoice`), `owner_id`, `uploaded_by_id`, `created_at`, `deleted_at` | Los archivos viven en **Supabase Storage**, bucket **privado** `invoices`. PDF, JPG, PNG o HEIC, hasta 10 MB. |
| **`truck_cost_entries`** (el libro) | `id`, `truck_id`, `kind` (`part_purchase` \| `outside_repair` \| `labor` \| `internal_invoice`), `amount_cents` (puede ser negativo), `currency`, `occurred_on` (date), `source_type`, `source_id`, `work_order_id?`, `vendor_id?`, `description` (copia), `reverses_entry_id?`, `created_by_id`, `created_at` | Índices `(truck_id, occurred_on)` y `(source_type, source_id)`. El enum se crea **con los cuatro valores**; en la etapa 1 la API solo escribe los dos primeros. |

**El libro de costos (`truck_cost_entries`) es lo que permite agregar lo de §8 sin rehacer nada:**

- Cada compra con camión escribe **una fila por camión** (la suma de sus líneas más su parte proporcional de tax y
  freight, D-PC2). Cada reparación externa escribe una fila. Una compra sin camión no escribe nada (D-PC5).
- Las filas **no se editan ni se borran**. Editar o anular una compra escribe filas de **reversa** (mismo monto,
  negativo, con `reverses_entry_id`) y, si se editó, las filas nuevas. Todo en la misma transacción que el cambio.
- La pestaña Costs **solo lee el libro**: suma por `kind` y por mes.
- Mañana, la mano de obra escribe filas `labor` y la factura interna toma filas del libro: ninguna de las dos
  toca las compras ni las reparaciones. Como lo ya cobrado nunca cambia (solo se agregan reversas), una factura
  enviada no se descuadra.

**Sin stock:** no hay existencias, entradas ni salidas. El PM sigue eligiendo partes sin descontar nada.

### 5.3 Endpoints (bajo `/api/admin`, mismos guards que el resto del Admin)

| Endpoint | Para qué |
|---|---|
| `GET/POST/PATCH /parts-costs/vendors` | Lista, alta y edición. 409 `VENDOR_NAME_TAKEN`. |
| `GET /parts-costs/parts` · `POST` · `PATCH /:id` | El catálogo con `unitCostCents`, `lastPaid` (de la última línea de compra), `defaultVendor`, `fits`, `usedInPmCount` y `openPm` (Truck y WO si está en un PM en curso). `PATCH` responde 409 `PART_IN_OPEN_PM` si desactiva o quita una marca que deja fuera ese camión. |
| `GET /parts-costs/purchases` (filtros) · `GET /:id` · `POST` · `PATCH /:id` · `POST /:id/void` | Compras. `POST` y `PATCH` reciben las líneas; la API calcula los totales y escribe el libro. |
| `GET /parts-costs/invoices/check?vendorId=&number=` | El aviso al salir del campo: `{ exists, kind, id, invoiceDate, totalCents }`. Mira compras y reparaciones del mismo proveedor. |
| `GET /parts-costs/outside-repairs` · `GET /:id` · `POST` · `PATCH /:id` · `POST /:id/void` | Reparaciones externas. |
| `GET /parts-costs/external-jobs?truckId=` | Los Jobs para ligar: los que están afuera (`externalSince`) y los que salieron en 90 días (Activity Log `job_sent_external`), con WO, qué salió y fechas. |
| `POST /parts-costs/attachments` | Pide subir un archivo: valida tipo y tamaño y devuelve `{ id, uploadUrl }` (URL firmada de Supabase para subir directo, sin pasar por el límite de 4.5 MB de las funciones de Vercel). |
| `GET /parts-costs/attachments/:id` | Una URL firmada de 5 minutos para abrir o descargar. |
| `GET /trucks/:id/costs?from=&to=` | Totales por tipo y por mes, los movimientos y `laborHours` (solo horas, de `work_sessions`). |

`getPmService` y `updatePmService` **no cambian**. La única regla nueva cerca del PM vive en el `PATCH` del
catálogo (`PART_IN_OPEN_PM`).

### 5.4 Editar y anular

- **Edit** se permite mientras el registro no esté anulado. Escribe reversas y filas nuevas en el libro.
- **Void** pide el motivo, marca `voided_at` y escribe las reversas. El número de factura queda libre para
  cargarla bien.
- Nada se borra. Un archivo adjunto que se quita queda con `deleted_at` (el objeto en Storage se borra a los 30
  días con una tarea, no al momento).

### 5.5 Factura repetida y doble envío

- **Factura repetida:** proveedor + número de factura es único entre compras **y** reparaciones no anuladas. La
  API lo comprueba en la transacción (con un `pg_advisory_xact_lock` por proveedor) y responde 409
  `DUPLICATE_INVOICE` con el registro que ya existe; la pantalla muestra **Open it**. El índice parcial de cada
  tabla es la red de seguridad. Comparación sin mayúsculas ni espacios: "inv 88412093" = "INV88412093".
- **Doble envío:** `POST` lleva el encabezado `Idempotency-Key` (un UUID por formulario abierto). La misma clave
  devuelve el mismo registro, sin crear otro (UX-7-024: es dinero, el doble envío sería severidad 4).

### 5.6 Quién puede

- **Leer y escribir:** Manager y System Admin (`admin.access` + `work_orders.manage`, como el resto del Admin).
- **Mecánicos y Safety:** 403 en todo `/parts-costs/*` y en `/trucks/:id/costs`. No ven costos en ninguna
  pantalla; el selector del PM sigue sin costo.
- Finanzas (futuro) tendrá su propio permiso (§8).

### 5.7 Activity Log

Valores nuevos en `ActivityEventType` (agregar valores a un enum es aditivo):
`vendor_saved`, `part_catalog_updated`, `part_purchase_saved`, `part_purchase_voided`, `outside_repair_saved`,
`outside_repair_voided`. Guardan antes y después (montos en centavos). Las reparaciones ligadas a un Job llevan
`workOrderId`, así salen también en la historia de ese Work Order. History (Audit) los muestra con el filtro
"Parts & costs".

## 6. Decisiones (aceptadas por el dueño el 2026-10-08 tal como se recomiendan; registradas en `DECISIONS.md`, D32)

| # | Pregunta | Recomendación |
|---|---|---|
| D-PC1 | **¿Solo dólares?** | **Sí, USD.** Se guarda `currency` en cada monto para no rehacer nada si un día hay otra moneda, pero la pantalla no la deja elegir. |
| D-PC2 | **¿Impuestos y flete cuentan en el costo del camión?** | **Sí.** Se cargan como Tax y Freight & other en la compra y se reparten entre los camiones de la factura en proporción a sus líneas (el centavo que sobra va a la línea más grande). Así la suma de los camiones más lo que no tiene camión es igual al total de la factura. |
| D-PC3 | **¿El catálogo incluye partes que no son del PM?** | **No en la etapa 1.** Si se agregan categorías nuevas, el PM las mostraría (carga todas las activas). Lo que no es del PM va como "Other" con su descripción. Si después se quiere, se agrega a `PartCategory` un `used_in_pm` (por defecto verdadero) y el PM filtra por él. |
| D-PC4 | **¿El costo de las partes que usa el PM se carga solo al camión?** | **No en la etapa 1.** Sin stock, la misma parte se contaría dos veces (en la compra y en el PM) o habría que adivinar el precio. El costo llega por la compra asociada al camión. Con stock (etapa 2), el PM descontaría la parte y escribiría su costo en el libro. |
| D-PC5 | **¿Una compra sin camión cuenta en algún camión?** | **No.** Queda en Purchases como "No truck · shop stock", con su total aparte. Sin stock no se puede saber en qué camión terminó. |
| D-PC6 | **¿El costo de referencia de la parte se actualiza con la última compra?** | **Se muestra "último pagado" al lado, pero el costo de referencia lo cambia el Manager.** La compra nueva se llena con el último pagado a ese proveedor (o con el de referencia si no hay). Así un precio raro de una vez no cambia el catálogo. |
| D-PC7 | **¿Quién ve los costos?** | **Manager y System Admin**, como el resto del Admin. Mecánicos y Safety, nunca. Cuando exista Finanzas, su permiso propio (§8). |
| D-PC8 | **¿Factura repetida bloquea o solo avisa?** | **Bloquea** (mismo proveedor y número, sin anular), con **Open it** para ir a la que ya está. Si el proveedor de verdad repite números, se anula la vieja o se agrega un sufijo. |
| D-PC9 | **¿El camión va por factura o por línea?** | **Por línea en los datos; por factura en la pantalla**, con "Lines go to different trucks" para el caso de una factura de varios camiones. |
| D-PC10 | **¿La factura adjunta es obligatoria?** | **No**, para no frenar la carga; la fila sin archivo lleva el chip "No invoice file" y Purchases tiene el filtro. |

## 7. Plan de implementación (cuando el dueño apruebe)

Un PR por etapa, cada una con su migración aditiva (Release safety antes de desplegar la API), pruebas unitarias,
e2e de la pantalla y filas nuevas en `test:real` (`apps/api/test-real/rows/parts-costs.real.spec.ts`, contra
`ltl_shop_test`). Los números de fila (A-PC1…) se cambian por el siguiente libre de la matriz al construir,
porque S1–S3 también agregan filas. Cada etapa se compara con la maqueta en teléfono y computadora, claro y
oscuro. Antes de construir, las filas de HU-M12 en `USER_FLOWS.md` se completan con estas.

**PC-1 · Esquema base y catálogo de partes**
- Migración: `vendors`, columnas nuevas de `parts`, `attachments`, `truck_cost_entries` (con los 4 valores del
  enum) y los valores nuevos del Activity Log. Las tablas de compras y reparaciones van en PC-2 y PC-3.
- Seed: deja de apagar todas las partes; solo crea o reactiva las del CSV con `source = 'seed'` y no toca las de
  `source = 'app'` ni el costo.
- API y pantalla **Parts** con el grupo de menú **Parts & costs**.

| Fila | Qué prueba |
|---|---|
| A-PC1 | El Manager cambia costo, proveedor habitual y "Fits" de una parte; el PM de un Volvo sigue mostrando las mismas partes y la misma "más usada"; el PM no recibe costos. |
| A-PC2 | No deja desactivar una parte elegida en un PM en curso (409 `PART_IN_OPEN_PM`); al terminar ese PM, sí. El mecánico guarda su PM sin error en los dos casos. |
| A-PC3 | Correr el seed otra vez no apaga una parte creada por el Manager ni le borra el costo. |
| A-PC4 | Mecánico Standard, PM y Safety reciben 403 en el catálogo. |

**Cómo quedó PC-1 (2026-10-09, rama `claude/setup-s4-pc1`).** Construido con las filas A53–A56, con dos cambios:
- **Vendors entra en PC-1**, no en PC-2: el formulario de la parte pide el proveedor habitual, y sin la pantalla de
  proveedores ese campo quedaba vacío.
- **La lista base solo agrega lo que falta.** No reactiva ni rehace las marcas de las partes que ya existen, aunque
  vengan de la lista (no solo las de `source = 'app'`). Es la misma regla que la recarga del catálogo de Jobs (JC1).

**PC-2 · Compras**
- Migración: `part_purchases`, `part_purchase_lines` e índices parciales.
- Subida de archivos a Supabase Storage (bucket privado, URL firmada).
- Pantalla **Purchases** (lista, New purchase, detalle, Edit, Void). Vendors ya está desde PC-1.

| Fila | Qué prueba |
|---|---|
| A-PC5 | Compra de 3 líneas con tax: la API calcula el total; un total que no cuadra se rechaza. |
| A-PC6 | La misma factura del mismo proveedor: el aviso lo dice y guardar responde 409 con la que ya existe; anulada la primera, se puede cargar. |
| A-PC7 | Dos envíos con la misma `Idempotency-Key` crean una sola compra. |
| A-PC8 | Compra con dos camiones: cada camión recibe su parte (tax repartido) y la suma cuadra con el total; sin camión no escribe en ningún camión. |
| A-PC9 | Editar y anular escriben reversas; el libro nunca cambia una fila ya escrita. |
| A-PC10 | Proveedor con nombre repetido ("fleetpride") responde 409. |

**Cómo quedó PC-2 (2026-10-09, rama `claude/setup-s4-pc2`).** Construido con las filas A57–A62, con tres notas:
- El número de factura se compara sin espacios, guiones ni mayúsculas (columna `invoice_norm`), así "INV 5521" =
  "inv-5521".
- El bucket privado `invoices` se crea solo la primera vez que se sube un archivo. Donde no hay Storage
  configurado (local, pruebas) el campo del archivo no aparece y la compra se guarda sin él.
- New purchase es un diálogo ancho (no un panel lateral); en el teléfono ocupa la pantalla como los demás.

**PC-3 · Reparaciones externas y el Job enviado afuera**
- Migración: `outside_repairs`.
- Pantalla **Outside repairs**; **Add outside repair invoice** en el `…` del Job externo y el enlace después de
  **Regresó**; el chip de la factura en el Job (solo Admin).

| Fila | Qué prueba |
|---|---|
| A-PC11 | Reparación ligada al Job "Enviado a taller externo" (afuera o ya de regreso); un Job de otro camión se rechaza. |
| A-PC12 | Enviar a taller externo y Regresó siguen igual que A35 con y sin factura cargada. |
| A-PC13 | La factura repetida se detecta entre una compra y una reparación del mismo proveedor. |

**Cómo quedó PC-3 (2026-10-09, rama `claude/setup-s4-pc3`).** Construido con las filas A63–A65, con dos notas:
- "Add outside repair invoice" está en el `…` del Job mientras está afuera (y en uno que ya tiene factura, para
  cargar otra). Después de **Regresó** no se agrega un enlace aparte: el Job sigue apareciendo en el formulario
  entre los que salieron en los últimos 90 días.
- Un Job que nunca salió a un taller externo no se puede ligar (`JOB_NEVER_EXTERNAL`).

**PC-4 · Truck → Costs**
- API `GET /trucks/:id/costs` y la pestaña **Costs** con los lugares reservados de Labor y Charge to Finance.
- Verificación final: `ui-audit` con la cuenta del Manager, inglés y español, claro y oscuro, teléfono y
  computadora; docs: `SYSTEM.md`, `USER_FLOWS` HU-M12, `design-system` y `OPEN_ISSUES` §1m (S4).

| Fila | Qué prueba |
|---|---|
| A-PC14 | Los totales por tipo y por mes son la suma del libro en el período; una anulación los baja. |
| A-PC15 | "Labor hours" es la suma de las sesiones cerradas del camión en el período (D18, D21) y no tiene monto. |
| A-PC16 | Mecánicos y Safety reciben 403 en los costos del camión; terminar un PM no escribe nada en el libro (D-PC4). |

## 8. Futuro: mano de obra y factura interna a Finanzas (diseñado, **no se construye**)

Nada de esto entra en la etapa 1. Se describe para comprobar que el modelo de §5 lo soporta **solo agregando
tablas y valores**.

### 8.1 Costo de mano de obra

- **Tabla `labor_rates`** (no se construye): `id`, `user_id?` (tarifa de un mecánico; nula = tarifa general del
  taller), `rate_cents_per_hour`, `currency`, `effective_from` (date), `effective_to?`, `created_by_id`,
  `created_at`. Nunca se edita una tarifa ya usada: se cierra y se abre otra.
- **Cálculo:** por cada sesión **cerrada** con `user_id` (D18) de un WO del camión: minutos × la tarifa vigente
  ese día (la del mecánico o, si no tiene, la general). Las sesiones viejas sin `user_id` (D7) usan la general y
  salen marcadas. Las sesiones abiertas no cuentan hasta cerrarse. D21 asegura que no hay dos horas a la vez.
- **Cuándo se escribe:** al **completar** el WO, una fila `labor` en el libro por mecánico y WO
  (`source_type = 'work_order_labor'`). Si después alguien corrige un tiempo ("Correct time…") o reabre el WO,
  se escribe la reversa y la fila nueva, como en las compras.
- **Pantalla:** Setup → **Labor rates** (tarifa general y excepciones por mecánico). En Truck → Costs, la tarjeta
  "Labor" deja de estar reservada.

### 8.2 Factura interna por camión y período

- **Tabla `internal_invoices`** (no se construye): `id`, `number` ("SHOP-2026-0001", secuencial), `truck_id`,
  `period_start`, `period_end`, `status` (`draft` → `sent` → `accepted`; y `void`), `subtotal_parts_cents`,
  `subtotal_outside_cents`, `subtotal_labor_cents`, `total_cents`, `currency`, `notes`, `created_by_id`,
  `sent_at`, `sent_by_id`, `accepted_at`, `accepted_by_id`, `pdf_attachment_id`.
- **Tabla `internal_invoice_lines`** (no se construye): `id`, `invoice_id`, `cost_entry_id` **único** (cada fila
  del libro se cobra una sola vez), `kind`, `description`, `amount_cents` (copia).
- **Flujo:**
  1. **Draft:** el Manager elige camión y período (por ejemplo, septiembre). La app toma las filas del libro de ese
     camión y período que todavía no se cobraron. Se pueden quitar filas (quedan para la próxima).
  2. **Sent:** se congela; se genera el PDF y Finanzas lo ve. Ya no cambia.
  3. **Accepted:** Finanzas lo acepta. Si lo rechaza, vuelve a Draft con una nota.
- Una corrección después de enviada (reversa o fila nueva) **no toca la factura**: cae en la del período siguiente.
- El valor `internal_invoice` del libro queda para cargos que solo existen en la factura interna (por ejemplo,
  insumos del taller o un ajuste acordado con Finanzas).
- **Permiso nuevo** `finance.review` (valor nuevo en `AppCapability`): ve las facturas enviadas y las acepta o
  rechaza. No ve el resto del Admin. La entrada del menú **Finance** aparece solo entonces.
- **Por decidir entonces:** si hay recargo sobre las partes, si se cobran las partes sin camión, quién numera.

### 8.3 Stock (etapa 2, solo para que conste)

Existencias por parte, la compra sin camión como entrada y el PM como salida, que escribiría el costo de la parte
en el libro del camión (D-PC4). Tampoco cambia lo de §5: agrega tablas de movimientos.

## 9. Notas de la maqueta

- Los datos son de ejemplo:
  - camiones 601 (2024 Mack Anthem), 606 (2024 Freightliner Cascadia), 612 (2023 Kenworth T680, sin costos),
    918 (2026 Peterbilt 579), 931 (2022 Volvo VNL 760), 944 (2024 Freightliner Cascadia) y 968 (2025 Volvo VNL 860);
  - proveedores FleetPride, TruckPro, Rush Truck Center, Diesel Pro (Barstow) y Premier Truck Glass;
  - las partes son de `apps/api/test/fixtures/pm-parts.csv` con sus nombres ya limpios; **los costos son
    inventados**;
  - el Job externo es "Radiator Repair" del WO-001 del camión 601, como en la maqueta del Truck.
- "Hoy" es el 7 de octubre de 2026. El usuario es Cristian (Manager).
- La maqueta está en inglés. La app tendrá los dos idiomas completos (`locale-context.tsx`).
- Las acciones cambian la maqueta sin guardar nada. "Reset" la vuelve al principio. **Fail next save** hace
  fallar el próximo guardado para ver el error.
- Los colores (tokens) son los mismos que en las maquetas del Truck, de Safety y del PM, y que `globals.css`.
- La subida del archivo se simula (barra de progreso); no se lee el archivo.
- La pestaña **Overview** del camión es un resumen: la pantalla real es la de la propuesta del Truck, que no cambia.
