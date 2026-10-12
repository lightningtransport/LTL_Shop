# 10 · Task flows e historias — Parts & costs (Admin)

**Fecha:** 2026-10-11 · **Alcance:** los 5 flujos críticos del contexto (cargar compra, cargar factura del taller externo, ver costos del camión, corregir, cerrar el mes) · **Método:** código (`apps/api/src/parts-costs/*`, `apps/web/src/components/admin-*`) + navegador (demo `ltl_shop_parts_demo`)
**Resumen:** 8 hallazgos, 3 de severidad 3. Cada flujo, tomado solo, termina bien y deja el dato protegido (reversas, idempotencia, número único). Los huecos están en las **uniones**: la factura del taller externo llega cuando el Job ya volvió y la entrada desapareció; nada le dice al Manager si un gasto ya se cobró a Finanzas antes de corregirlo; y la factura de "septiembre" trae junio sin avisar. Tres de los ocho no son defectos sino consecuencias de decisiones (D-PC4, D32, D34) que el dueño debe confirmar; van marcados **P**.

Este archivo sale del esquema 0N de las skills pero usa el mismo formato de hallazgo (`UX-10-NNN`) para que la skill 9 lo consolide.

## Flujos observados (pantalla → acción → resultado)

**F1 · Cargar una factura de compra** (J13, HU-M12)
```
Sidebar Purchases → New purchase (diálogo)
  → Vendor (solo activos que venden partes; "+ Add vendor" inline)
  → Invoice date (hoy) → Invoice # (al salir del campo: ¿repetida? → aviso + "Open it", Save bloqueado)
  → Truck (opcional; "No truck · shop stock"; "Lines go to different trucks")
  → Lines (parte del catálogo u "Other — only on this invoice"; costo prellenado con último pagado/referencia)
  → Tax, Freight → Total en vivo y "All of it goes to Truck 991"
  → [Invoice file: oculto en la demo] → Notes
  → Save purchase (Idempotency-Key; servidor recalcula; TOTAL_MISMATCH si no cuadra)
  → router.push(detalle de la compra)                      ← desde un camión, no vuelve al camión (UX-5-002)
```
Pasos: 7 campos obligatorios mínimos (vendor, fecha, número, 1 línea con parte, qty, costo) y 1 clic. Bien.

**F2 · Cargar la factura del taller externo** (HU-M11 → HU-M12)
```
A) WO → Job "…" → "Add outside repair invoice"            ← solo mientras el Job está afuera o ya tiene factura (UX-10-001)
   → Outside repairs con ?new=1&truckId=&jobId= → diálogo con camión y Job elegidos ("From WO-067 · Air Bag Replacement")
   → Vendor (los que hacen reparaciones primero) → Date → Invoice # → What was done → Amount → Save
   → detalle de la reparación; el Job muestra el chip "Invoice $685.00 · Bay Area Body Shop"
B) Sidebar Outside repairs → New outside repair → Truck (obligatorio) → "Job sent out" (los de ese camión, afuera ahora o vueltos en 90 días; "Not linked to a Job") → …
```

**F3 · Ver cuánto lleva gastado un camión** (HU-M12)
```
Trucks → camión → pestaña Costs (o: factura interna → "Truck 614" ya en Costs)
  → período (This month / 3 months / Year / All; en estado, no en URL)
  → tarjetas Parts · Outside repairs · Total · Labor (h) · Charge to Finance (sin cifra: es un enlace)
  → By month → Movements (cada uno abre su compra / reparación / WO; reversas en negativo "Voided"/"Corrected")
  → "Add purchase" / "Add outside repair" con el camión elegido
```

**F4 · Corregir**
```
Detalle de compra → Edit purchase → (mismo diálogo) → Save → reversa de todo el ledger + reescritura (purchases.service.ts:230-232)
Detalle de compra → Void → motivo → cruzada, reversas, número libre; no se puede deshacer
Agregar el archivo después = Edit                               ← reescribe el ledger sin cambio de dinero (UX-10-004)
Nada dice si la compra ya está en una factura interna enviada    ← (UX-10-002)
```

**F5 · Cerrar el mes y cobrarle a Finanzas** (J14, HU-M13)
```
Labor rate → Set a new rate (rate, From) → Save → recalcula WOs completadas desde esa fecha (sin preview; sin editar ni borrar; UX-10-005)
Internal invoices → New invoice → Truck + Month → borrador con TODO lo no cobrado hasta fin de mes (UX-10-003)
  → quitar/restaurar líneas → Send (número SHOP-AAAA-NNNN del año en que se envía; se congela)
  → Download PDF (diálogo de impresión del navegador) → Finanzas por fuera → Mark accepted | Void
  × 1 camión por vez; sin vista del mes                          ← (UX-10-006)
```

## Hallazgos

### UX-10-001 · La factura del taller externo llega después de "Regresó", y entonces el Job ya no ofrece cargarla
- **Dónde:** Work Order → Job "…" · `apps/web/src/components/admin-job-table.tsx:183` (`if (canSeeCosts && (isExternal || job.outsideInvoices?.length))`); `packages/shared/src/types.ts:463` (`external` solo "while the Job is at an external shop"); ventana de 90 días en `outside-repairs.service.ts:24` (`EXTERNAL_JOB_WINDOW_DAYS`)
- **Evidencia:** (inferido del código; la demo no trae un Job vuelto sin factura) Flujo real: el taller externo entrega el camión → el Manager marca "Regresó" (HU-M11) → días después llega la factura → abre la WO y el Job ya no tiene "Add outside repair invoice" ni ninguna marca de "sin factura". Tiene que ir a Outside repairs → New → elegir el camión → encontrar el Job en la lista de los últimos 90 días → y si pasaron más de 90 días, el Job ya no aparece y la factura queda "Not linked to a Job". (observado) En WO-067, que está afuera ahora, el menú sí ofrece la acción y el chip aparece una vez cargada.
- **Criterio:** JTBD: el job "pagar una reparación afuera" empieza cuando llega la factura, no cuando sale el camión · Nielsen H6 (reconocer antes que recordar) · callejón sin salida (IA §5).
- **Severidad:** 3 · Frecuencia alta (casi toda factura externa llega después del regreso), impacto medio-alto (3 pantallas y una búsqueda; riesgo de factura sin Job o Job sin factura), persistente.
- **Recomendación:** (1) El ítem "Add outside repair invoice" se muestra para todo Job que **alguna vez** salió (ya hay rastro en el Activity Log; exponer `wentExternal: true` en el DTO). (2) Mientras no tenga factura, el Job muestra un chip ámbar "Returned · no invoice yet" (solo MS/AS), que es la cola de trabajo real del Manager. (3) La ventana de 90 días pasa a "sin límite si no tiene factura". (4) Escribir en HU-M11 el paso "llega la factura".
- **Esfuerzo:** M
- **Clase:** C

### UX-10-002 · Nada dice si un gasto ya se cobró a Finanzas; corregirlo o anularlo no avisa
- **Dónde:** detalle de compra y de reparación (`admin-purchase-detail.tsx`, `admin-outside-repair-detail.tsx`: sin referencia a la factura interna); movimientos de Truck → Costs (`truck-costs.service.ts:68-78`: el DTO no trae la factura que lo cobró); diálogo Void (`admin-messages.ts:180`: "its cost comes off the trucks"); Edit sin aviso (`purchases.service.ts:206-244`)
- **Evidencia:** (observado) FP-48174, FP-48359 y FP-48618 están en SHOP-2026-0004 (enviada); sus detalles se ven iguales a los de cualquier compra sin facturar, con Edit y Void habilitados y sin mencionar la factura. (inferido del código) Al editar o anular, el ledger recibe las reversas y la factura del mes siguiente las arrastra como líneas negativas; el Manager se entera cuando arma el próximo borrador, o no se entera. Lo mismo al revés: desde la compra no se puede llegar a "¿en qué factura la cobré?".
- **Criterio:** Nielsen H1 (visibilidad del estado del sistema) · H5 (prevención de errores) · IA §5 (de un detalle a lo relacionado).
- **Severidad:** 3 · Frecuencia media (cada corrección sobre un mes cerrado), impacto alto (dinero que Finanzas ya aceptó cambia sin que nadie lo diga), persistente.
- **Recomendación:** (1) En el detalle y en cada movimiento: chip "Charged on SHOP-2026-0004 · Sent" con enlace; "Not charged yet" si no. (2) En Edit y Void de algo ya facturado, una línea en el diálogo: "This purchase is on SHOP-2026-0004 (sent Oct 3). The correction will appear as a credit on the next invoice for Truck 614." (3) En la factura interna, las líneas negativas que vienen de una corrección dicen de qué factura anterior vienen. El dato existe (`InternalInvoiceLine.costEntryId` → `TruckCostEntry.sourceId`).
- **Esfuerzo:** M
- **Clase:** C

### UX-10-003 · La factura de "Sep 2026" trae costos de junio y agosto sin decirlo
- **Dónde:** `/admin/parts/internal-invoices/[id]` · `internal-invoices.service.ts:194-212` (`available`: `occurredOn: { lte: periodEnd }`, sin cota inferior) y `:149` (el número usa el año del envío, no del período)
- **Evidencia:** (observado) SHOP-2026-0004 · Truck 614 · **Sep 2026** lista FP-48174 (19 de junio), TP-48359 (6 de agosto), WO-004 (junio) y WO-023 (agosto) junto a lo de septiembre, bajo los mismos encabezados "Parts 3" y "Labor 3". El total $2,509.60 es correcto, pero Finanzas lee "septiembre" y ve junio. `evidencia/10-factura-interna-sep-con-junio.jpg`.
- **Criterio:** Nielsen H2 (correspondencia con el mundo real: "la factura de septiembre" significa algo para Finanzas) · H1.
- **Severidad:** 3 · Frecuencia alta mientras se pongan al día (todo lo anterior a la primera factura cae en ella) y luego media (cada corrección), impacto alto (reclamo de Finanzas, desconfianza en el número), persistente.
- **Recomendación:** Mantener la regla de D34 (lo no cobrado se arrastra) pero **hacerla visible**: una sección "Carried over from earlier months" con su subtotal, separada de "September", en pantalla y en el PDF; y en el borrador, antes de enviar, un aviso "This invoice includes $1,299.53 from June–August that was never charged." Si el dueño prefiere, ofrecer "Only September" como opción al crear.
- **Esfuerzo:** S (pantalla y PDF) + decisión del dueño
- **Clase:** C (y pregunta P: ¿Finanzas acepta el arrastre?)

### UX-10-004 · Agregar el archivo después obliga a "editar" la compra, y eso reescribe el costo del camión
- **Dónde:** detalle de compra → Edit · `parts-costs.controller.ts` (no hay ruta de "solo adjuntar": `POST attachments` da la URL firmada y el enlace se hace en create/edit); `purchases.service.ts:230-232` (`reverseSource` + `writeLedger` en todo Edit, cambie o no el dinero); igual en `outside-repairs.service.ts:190-192`
- **Evidencia:** (inferido del código; en la demo el campo está oculto) El flujo normal es cargar la factura rápido y adjuntar el PDF cuando lo escanean (la demo trae 47 de 47 "No invoice file", y la lista tiene un filtro "Without invoice file" justamente para volver después). Cada "volver después" produce en Truck → Costs un par de movimientos −$281.53 / +$281.53 marcados "Corrected", sin que nada haya cambiado; y si la compra ya estaba facturada, el par cae en la factura del mes siguiente (ver UX-10-002).
- **Criterio:** Nielsen H8 (ruido en el historial) · H1 (el historial dice "corregida" cuando no lo fue).
- **Severidad:** 2 · Frecuencia alta (si adjuntan después, siempre), impacto medio (historial sucio, facturas con pares que se anulan), persistente.
- **Recomendación:** Acción propia "Add invoice file" en el detalle (sin pasar por Edit, sin tocar el ledger). En Edit, reescribir el ledger solo si cambió algo que afecta el costo o el camión (vendor, fecha, líneas, impuesto, flete, reparto); si solo cambió el archivo o las notas, no.
- **Esfuerzo:** S
- **Clase:** C

### UX-10-005 · Una tarifa equivocada no se puede corregir, y una tarifa con fecha pasada recalcula sin avisar cuánto
- **Dónde:** `/admin/parts/labor-rate` · `parts-costs.controller.ts:146-151` (solo `GET` y `POST`); `labor-rates.service.ts:39-41` (`LABOR_RATE_DATE_TAKEN`) y `:55-59` (recalcula todas las WOs completadas con sesiones desde esa fecha, sin preview; devuelve `recalculatedWorkOrders` después)
- **Evidencia:** (observado) La pantalla ofrece "Set a new rate" con "Rate per hour" y "From", y una tabla History sin acciones. (inferido del código) Si el Manager escribe $150 en vez de $105, la única salida es otra tarifa desde mañana: la de hoy queda en el historial y en las WOs completadas hoy. Si pone "From" un mes atrás, se recalculan N WOs (algunas ya facturadas) y el aviso llega después, no antes.
- **Criterio:** Nielsen H3 (deshacer) · H5 (prevención: decir las consecuencias antes) · D34 ("una tarifa nueva no cambia lo ya calculado antes de su fecha" se cumple; lo que falta es el preview y el arrepentimiento).
- **Severidad:** 2 · Frecuencia baja (una o dos veces al año), impacto alto cuando pasa (mano de obra mal cobrada en varias WOs), persistente.
- **Recomendación:** (1) Antes de guardar, "This rate will recalculate 7 completed Work Orders from Sep 1 (2 of them already on sent invoices)". (2) Permitir borrar la última tarifa mientras ninguna WO facturada la haya usado (o editar su monto con la misma condición), con reversas como el resto del sistema.
- **Esfuerzo:** M
- **Clase:** C

### UX-10-006 · "Cerrar el mes" se hace camión por camión, sin una vista del mes
- **Dónde:** `/admin/parts/internal-invoices` · `internal-invoices.service.ts:52-61` (lista por `status` y `truckId`; nada por mes); New invoice pide **un** camión y **un** mes
- **Evidencia:** (observado) Con 27 camiones y costos en casi todos, el cierre de un mes son 27 veces New invoice → camión → mes → revisar → Send → Download PDF → mandar → Mark accepted, y no hay ninguna pantalla que diga "octubre: 12 camiones con costos sin facturar, 3 borradores, 9 enviadas". J14 dice "cierro el mes"; la app no tiene el mes como unidad.
- **Criterio:** JTBD (J14: "sin armar la cuenta a mano") · Nielsen H7 (eficiencia).
- **Severidad:** 2 hoy; 3 si se facturan más de ~10 camiones al mes.
- **Recomendación:** Vista "By month" en Internal invoices: una fila por camión con costos sin cobrar en el mes, estado y total, y "Create drafts for all"; el envío sigue siendo uno por uno (el PDF es por camión, D34). Esto es una **pregunta al dueño**: D34 fijó "por camión y mes"; no cambia, solo se agrupa.
- **Esfuerzo:** M–L
- **Clase:** P

### UX-10-007 · Las compras no se atan a la Work Order: "¿cuánto costó la WO-065?" no tiene respuesta para las partes
- **Dónde:** `apps/api/prisma/schema.prisma:747-767` (`PartPurchaseLine` sin `workOrderId`/`jobId`); `purchases.service.ts:323-330` (el movimiento de compra no lleva `workOrderId`); Truck → Costs ordena por fecha
- **Evidencia:** (observado) En Costs de Truck 991, FP-48840 (8 de octubre) y la mano de obra de WO-054 (8 de octubre) son dos filas sin relación visible; el usuario infiere por la fecha. En la WO no hay cifra de partes. (inferido) Si un camión tiene dos visitas en el mes, no se puede decir qué partes fueron de cuál.
- **Criterio:** JTBD (el Manager piensa en visitas, no en meses) · IA §5.
- **Severidad:** 2 · Frecuencia media, impacto medio, persistente. Es consecuencia de D-PC4 y D32 (sin stock, partes del PM no se cobran solas), no un defecto.
- **Recomendación:** Si el dueño quiere la pregunta respondida: campo opcional "Work Order" en la compra (y en la línea cuando se parte), prellenado con la WO abierta del camión al momento de la factura; Truck → Costs agrupa por visita cuando lo tiene. Si no la quiere, dejarlo escrito en D32 ("los costos son por camión y fecha, no por WO").
- **Esfuerzo:** M
- **Clase:** P

### UX-10-008 · La historia del teléfono no está escrita, y las pantallas no la contemplan
- **Dónde:** `docs/proposals/parts-costs/README.md` §2 ("en la computadora"); `docs/USER_FLOWS.md` §dispositivos ("Manager en teléfono y computadora"); formulario de compra en móvil (diálogo a pantalla completa, 6 filtros apilados: UX-5-008); sin captura con cámara en el campo de archivo
- **Evidencia:** (observado, 375 px) Todo funciona, nada está pensado para hacerlo de pie: el diálogo de compra tiene 9 bloques; el archivo se elige del sistema, no se fotografía; no hay "cargar después" (un borrador con foto y número para completar en el escritorio). `evidencia/05-purchases-movil-filtros.jpg`.
- **Criterio:** JTBD (el momento del job: en el mostrador del proveedor, cuando el taller externo entrega) · contexto del usuario (00-contexto §1).
- **Severidad:** 2 con el supuesto de escritorio; **3 si el dueño confirma que carga desde el teléfono**.
- **Recomendación:** Preguntar primero. Si sí: HU nueva "Cargo la factura desde el mostrador": foto + proveedor + número + camión, estado "incomplete", y la lista la marca para terminar en el escritorio. Si no: dejarlo escrito en el contexto y bajar UX-5-008 a 2.
- **Esfuerzo:** L (si sí)
- **Clase:** P

## Lo que funciona bien
- **El dato está protegido de punta a punta:** número único por proveedor entre compras y reparaciones (bloqueo por proveedor), Idempotency-Key en el alta, total recalculado en el servidor, reversas en vez de borrados, factura enviada congelada, y 23 escenarios `test:real` (A53–A75) que lo prueban contra la base real.
- **Los atajos en contexto están donde se necesitan:** "Add purchase" / "Add outside repair" desde el camión con el camión puesto; "Add outside repair invoice" desde el Job afuera con camión y Job puestos; "Set a labor rate" desde Costs cuando falta.
- **El formulario de compra explica lo que calcula** (PR 275): de dónde sale el costo unitario, cómo se reparte el impuesto, a dónde va el dinero, qué falta para guardar.
- **La factura interna se lee como una cuenta:** totales por tipo, cada línea con su origen enlazado, acciones claras (Download PDF, Mark accepted, Void) y el camión enlazado directo a su pestaña Costs.
- **Corregir es seguro y visible:** Edit y Void dejan rastro ("Corrected"/"Voided" en negativo), nada se pierde, y el número de la anulada queda libre.

## Fuera de alcance / no verificado
- El archivo adjunto en vivo (sin Storage en la demo): UX-10-004 es inferido.
- Un Job vuelto del taller externo sin factura (no hay en la demo): UX-10-001 es inferido de `admin-job-table.tsx:183`.
- Carreras (dos envíos simultáneos de la misma factura interna numeran dos veces: `internal-invoices.service.ts:146-148` comprueba el borrador antes del lock). Es técnico, no de experiencia; se deja anotado para OPEN_ISSUES.
- El PDF (diálogo de impresión del navegador): no se abrió.
