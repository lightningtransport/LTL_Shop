# Propuesta: repuestos, stock y llantas en Parts & costs (D45)

**Clasificación:** PROPUESTA, **pendiente del OK del dueño y de las respuestas de Randy (P24–P31)**. No se construye nada hasta entonces.
**Fecha:** 2026-10-16 · **Rama:** `claude/parts-stock-tires-proposal`
**Origen:** pedido de Randy (Manager del taller), traído por el dueño el 2026-10-16:

- Parts & costs debe servir para los **repuestos**, no solo para las partes del PM.
- Una compra debe poder atarse al **camión y al trabajo** donde se usa.
- Más adelante, las **facturas de los proveedores** entran a mano o solas.
- Las **llantas (cauchos)** se controlan:
  - la inspección dice cuál cambiar;
  - eso queda como Job en la Work Order;
  - la llanta sale del stock.
  - Delanteras siempre nuevas; traseras recap o nuevas.

**Respuestas del dueño (2026-10-16):**
1. Stock para **llantas y repuestos**. Se abre la etapa 2 que D32 dejó "solo para que conste".
2. **Se cambia P16 (D37):** cada línea de compra puede atarse, si se quiere, a un Job abierto de su camión.
3. **Recap o nueva en las traseras lo decide el Manager** al confirmar las llantas del Job. Las delanteras van siempre nuevas; las traseras van recap si nadie las cambia.
4. **Trailers fuera** de esta propuesta (siguen en LTR-56, P11).

## 1. Qué hay hoy (origin/main `cf27bbf`)

| Tema | Hoy | Dónde |
|---|---|---|
| Stock | **No existe.** "Sin stock" (D32, D-PC4). Una compra sin camión se guarda como "No truck · shop stock" y no cuenta en ningún lado (D-PC5) | `PRD.md` §5; `proposals/parts-costs/README.md` §8.3 |
| Catálogo | `Part` es solo la lista del PM (D-PC3). Lo demás entra en la factura como línea "Other" con descripción libre | `schema.prisma` `Part` |
| Compra ↔ camión | Sí, **por línea** (`PartPurchaseLine.truckId`), con reparto del impuesto y el flete (D-PC2, D-PC9) | `parts-costs/purchases.service.ts`, `admin-purchase-form.tsx` |
| Compra ↔ Work Order / Job | **No** (P16). Solo la reparación externa (`OutsideRepair`) se ata a un Job | `schema.prisma` `OutsideRepair.workOrderJobId` |
| Costo del camión | Ledger que solo crece (`TruckCostEntry`, `kind` = `part_purchase`, `outside_repair`, `labor` o `internal_invoice`). Las compras entran sin `workOrderId` | `purchases.service.ts` `writeLedger` |
| PM | El mecánico elige una parte por categoría (`PmServicePart`, sin cantidad ni costo). No descuenta nada y no cuesta al camión (D-PC4) | `work-orders.service.ts` `updatePmService` |
| Llantas | La inspección (D41) lee **PSI y tread de 10 posiciones** (LF, RF, LFO … RRO; steer + 2 drive, sin trailer) | `inspection.service.ts`, `TireReading` |
| Llanta mala → Job | Por tread crea **Tires**; por presión crea **Flat Repair**. Las dos son del catálogo "Tires & Wheels" y van ligadas con `WorkOrderJobSource` (`tire_reading`). Varias llantas se juntan en un solo Job "Tires" con una nota por posición | `inspection-plan.ts`, `inspection.service.ts` ~l.277 |
| Lo que **no** sabe | Qué llanta se puso (nueva o recap, medida), de dónde salió, cuánto costó y qué tenía antes esa posición | — |

**Lo que se reutiliza sin inventar nada:**
- El patrón "factura atada a un Job" de `OutsideRepair` (PC-3), que trae los Jobs con `GET external-jobs`.
- `WorkOrderJobSource`, que ya liga la lectura de una llanta con su Job.
- Las **reversas** del ledger (nunca se borra nada) y la anulación con motivo.
- El selector "la más usada en camiones de la misma marca y modelo" del PM.

## 2. Un día del Manager en el taller (caso de uso)

> **Randy, martes 7:40 a.m.**
>
> 1. Llega la factura de FleetPride:
>    - 2 filtros de combustible para el **601**, que ya tiene abierto el Job "Fuel Filters";
>    - 4 llantas **recap 11R22.5** para tener en el taller;
>    - 1 caja de fusibles, también para el taller.
> 2. Randy abre **Parts & costs → Purchases → New purchase**:
>    - las líneas de filtros van al **601 · Job Fuel Filters**;
>    - las recaps y los fusibles quedan **To stock**.
>
>    Al guardar:
>    - el 601 carga los filtros, que se ven en su Job;
>    - **Stock** sube a 4 recaps 11R22.5 y 1 caja de fusibles;
>    - ningún camión carga lo que fue al stock.
> 3. A las 9:00 un mecánico con "Can inspect trucks" inspecciona el **615**:
>    - **RF** tiene 3/32 de tread y **LRO** tiene 1/32;
>    - al guardar se crea el Job **Tires** como hoy, y ahora trae dos **llantas a poner**: RF · **New** (fijo, es steer) y LRO · **Recap** (propuesta).
> 4. Randy ve en el Job "Tires · confirm 2 tires":
>    - deja la LRO en recap;
>    - el 615 usa 11R22.5 atrás (lo recuerda de la última vez);
>    - para la RF no hay nuevas 11R22.5 en stock, así que la app dice **"Not in stock · buy 1"**;
>    - Randy confirma.
>
>    Resultado:
>    - la recap **sale del stock** y su costo va al 615 en ese Job;
>    - la RF queda "por comprar";
>    - cuando cargue la factura de la nueva, la ata a ese Job y el costo va directo al camión.
> 5. Fin de mes: la factura interna del 615 trae las llantas como siempre, al costo (D34). No hay nada nuevo que aprender.

## 3. Trabajos por hacer del Manager (JTBD)

Siguen la numeración de [`USER_FLOWS.md`](../../USER_FLOWS.md) (J1–J21).

| # | Quién | Cuando… | quiero… | para… |
|---|---|---|---|---|
| J22 | Manager | cargo una factura de un proveedor | decir, línea por línea, si es para un camión (y su Job) o para el taller | saber después qué compré, para qué y cuánto costó cada trabajo |
| J23 | Manager | voy a comprar o un mecánico pide una parte | ver qué hay en el taller y qué se está acabando | no comprar dos veces ni quedarme sin lo que más se usa |
| J24 | Manager | se usa algo del taller en un camión | que salga del stock y cueste a ese camión una sola vez | que el costo por camión y la factura a Finanzas digan la verdad |
| J25 | Manager | una inspección encuentra llantas malas | que el Job ya diga qué llanta va en cada posición (nueva o recap) y si la tengo | cambiarla ese mismo día sin escribir nada dos veces |
| J26 | Manager | llegan muchas facturas de proveedores | cargarlas rápido, y más adelante que se lean solas y yo solo confirme | dejar de teclear facturas enteras |

## 4. Historias de usuario

Formato de las historias de hoy: quién, flujo, resultado y "¿qué pasa si…?". Todas son **🔲 no construidas**.
El mecánico **nunca ve costos** (D32). Ve qué parte o llanta va, nunca su precio.

### A. Catálogo de repuestos y llantas (J22, J23)

**HU-R1 · El catálogo tiene repuestos y llantas, no solo el PM.**
- Parts & costs → **Parts** gana un filtro **PM · Repair · Tires**.
- Una parte nueva lleva categoría, número de parte, proveedor habitual, costo de referencia y mínimo de stock (opcional).
- Una llanta lleva además **medida** (p. ej. 11R22.5, 295/75R22.5) y **tipo New o Recap**.
- El selector del PM sigue mostrando solo las partes del PM (D-PM1 y D-PM2 no cambian).

**HU-R2 · Pasar una línea "Other" al catálogo.**
- En una compra, una línea "Other" que se repite ofrece **Add to catalog**. Lleva la descripción y el número de parte.

| ¿Qué pasa si…? | Respuesta |
|---|---|
| La parte ya existe con otro nombre | Avisa por número de parte, como hoy con los proveedores repetidos |
| Se desactiva una parte que tiene stock | No deja hasta que el stock sea 0 o se ajuste con motivo |

### B. La compra se ata al camión y al Job (J22). Cambia P16.

**HU-C1 · Cada línea va a un camión (y su Job) o al stock.**
- En **New purchase**, cada línea tiene **Goes to**: el camión, **To stock** o **Shop supplies** (gasto del taller, no se cuenta).
- Si eligió un camión, puede elegir, si quiere, un **Job abierto** de ese camión. Es la misma lista que usa Outside repairs.
- El impuesto y el flete se reparten como hoy (D-PC2).

**HU-C2 · El Job muestra sus partes.**
- En la Work Order, el Job dice **Parts · 2 · $84.10** al Manager y al System Admin.
- Al mecánico le dice **Parts: Fuel filter ×2**, sin precio.
- Truck → Costs muestra el Job en cada movimiento que lo tenga.

| ¿Qué pasa si…? | Respuesta |
|---|---|
| El Job ya está terminado o la WO cerrada | Se puede atar igual (la factura llega tarde), como en Outside repairs |
| Se cambia el camión de una línea ya atada a un Job | Se quita el Job; reversas como hoy (A61) |
| Se cancela el Job | La compra no cambia: el camión sigue cargando la parte (se compró para él). Si la parte vuelve al taller, se mueve al stock con **Return to stock** (HU-S4) |
| Compras viejas, de antes de D45 | Quedan sin Job; nada se reescribe |

### C. Stock (J23, J24)

**HU-S1 · Lo comprado "To stock" entra al stock.**
- Al guardar la compra, cada línea To stock suma su cantidad y su costo a la parte.
- Si la línea era "Other", primero pide elegir o crear la parte (HU-R2). El stock solo existe para partes del catálogo.

**HU-S2 · Ver el stock.**
- Parts & costs → **Stock**, una pantalla nueva, muestra por parte (o por medida y tipo, en llantas):
  - cuántas hay y su costo promedio;
  - la última compra;
  - **Low** cuando están bajo el mínimo.
- Al tocar una parte se ven sus movimientos: entradas, salidas a camiones y ajustes.

**HU-S3 · Usar algo del stock en un Job.**
- En el Job, el Manager toca **Add part from stock**, elige parte y cantidad, y confirma.
- El stock baja y el camión carga ese costo en ese Job: es un movimiento nuevo del ledger, `stock_issue`, y entra en la factura interna como parte al costo.
- Si no alcanza, la app dice cuántas hay y no deja sacar más (la cuenta no baja de 0).

**HU-S4 · Corregir sin borrar.**
- Anular una compra que metió stock lo resta.
- **Return to stock** desde un Job lo devuelve, con reversa en el camión.
- **Adjust** (conteo físico) pide motivo.
- Nada se borra (igual que A61).

| ¿Qué pasa si…? | Respuesta |
|---|---|
| Se anula una compra cuyo stock ya se usó | No deja anular hasta devolver o ajustar. Dice qué camiones lo usaron |
| Dos personas sacan la última unidad a la vez | Solo una sale; la otra ve "0 in stock" |
| Se usa una parte del stock en un Job y luego se cancela la WO | La parte no vuelve sola: el Job la muestra con **Return to stock** |
| El primer día no hay stock cargado | Conteo inicial con **Adjust** (P25) |

**HU-S5 · El PM descuenta del stock (etapa ST-5, decisión abierta P29).**
- Hoy el PM elige partes sin cantidad y sin costo (D-PC4).
- Para que salgan del stock hay que decidir si el mecánico dice la cantidad o si se usa una por categoría, y si el costo del PM empieza a contar en el camión. Eso cambia D-PC4.
- **No se toca el teléfono del PM hasta que el dueño lo decida.**

### D. Llantas desde la inspección (J25)

**HU-T1 · La inspección propone qué llanta poner.**
- Igual que hoy, una llanta con tread bajo el mínimo crea (o suma a) el Job **Tires**.
- Ahora el Job trae además una **llanta a poner** por posición:
  - **Steer (LF, RF): New**, siempre (regla del taller);
  - **Drive (LFO, LFI, RFI, RFO, LRO, LRI, RRI, RRO): Recap**, propuesto.
- La **medida** sale de la última llanta puesta en ese eje del camión. Si no hay, del catálogo; si no, se pide (P26).
- La presión fuera de rango sigue creando **Flat Repair**, sin llanta a poner (se repara, no se cambia).
- Lo que ve el mecánico que inspeccionó no cambia (D41).

**HU-T2 · El Manager confirma las llantas.**
- El Job dice **Tires · confirm N tires**. El Manager ve cada posición con su lectura y su llanta propuesta.
- En drive puede cambiar Recap ↔ New y la medida. En steer, New no se cambia.
- **Confirm** saca del stock lo que hay y deja "Not in stock · buy N" para lo que falta.
- El mecánico ve en su Job **"RF · New 11R22.5 · LRO · Recap 11R22.5"**, sin precio.

**HU-T3 · Falta en el stock.**
- Lo que falta queda **por comprar**: se ve en el Job y en Stock como **Needed for jobs**.
- Al cargar la factura de esa llanta y atarla al Job (HU-C1), queda cubierta.
- El Job **no se bloquea** por falta de stock: el trabajo sigue las reglas de hoy.

**HU-T4 · Historial de llantas del camión.**
- La tarjeta **Tires** del camión (D41) muestra, por posición: la llanta puesta (New o Recap, medida, fecha, WO) y las lecturas.
- Las lecturas guardadas siguen sin cambiar.

| ¿Qué pasa si…? | Respuesta |
|---|---|
| Se confirma y después se cancela el Job o la WO | Las llantas no vuelven solas; **Return to stock** en el Job (HU-S4) |
| El mecánico encuentra otra llanta mala trabajando | **Add defects** (D41) la suma al mismo Job y queda por confirmar |
| Steer con recap en el stock y sin nuevas | No se puede poner recap en steer. Queda "buy 1 New" |
| Un trailer necesita llantas | Fuera de alcance (P24, LTR-56). Se carga como compra al camión que lo arrastra o como Shop supplies |
| La inspección se hizo antes de D45 | Su Job Tires no trae llantas a poner. El Manager las agrega con **Add part from stock** |

### E. Facturas de proveedores (J26)

**HU-F1 · Carga manual (ya existe).** Purchases con su archivo (D-PC10), en la computadora (P17). Con HU-C1 se suma "Goes to" por línea.

**HU-F2 · Leer la factura (etapa ST-6, después).**
- El Manager sube el PDF o la foto. La app propone proveedor, número, fecha y líneas, y busca cada línea en el catálogo por número de parte.
- El Manager revisa, elige "Goes to" y guarda. **Nada se guarda sin que lo confirme** (como D43 y D44).
- La entrada automática por correo o por el portal del proveedor queda abierta (P30).

## 5. Reglas nuevas (para D45)

1. **Stock etapa 2.** Existe para partes del catálogo y llantas. Se lleva como **movimientos** (entrada, salida, ajuste, reversa); la cantidad es su suma. El **costo es el promedio** de lo que hay (P27 confirma o pide FIFO).
2. **Un costo cuenta una sola vez.** Una compra a un camión cuesta al camión al guardarla (como hoy). Una compra al stock no cuesta a nadie. Una salida del stock cuesta al camión en ese momento (`stock_issue`). Shop supplies no cuenta en ningún camión.
3. **P16 cambia.** Una línea de compra puede atarse a un Job de su camión, si se quiere. Si no, queda por camión y fecha como hoy.
4. **Llantas:** steer siempre nueva; drive recap por defecto, y el Manager puede elegir nueva. Trailers fuera.
5. **Sale del stock al confirmar**, no al terminar el Job. Se corrige con Return to stock.
6. **El mecánico no ve costos** y no saca partes del stock en esta etapa: lo hace el Manager (P28 decide si el mecánico confirma lo usado).

## 6. Qué no se rompe

- **PM:** mismo selector, mismas partes, misma "más usada" y mismo borrador en el teléfono hasta ST-5 (D-PM1, D-PM2, HU-PM1).
- **Inspección:** la hoja, los umbrales, Flat Repair y Tires y Add defects siguen igual (D41). Solo se agrega la llanta propuesta al Job.
- **Factura interna y cierre de mes (D34, D37 P15/P18):** `stock_issue` es una línea más de partes al costo. No cambia el número, el envío ni el arrastre.
- **Compras viejas:** no se reescriben. "No truck · shop stock" de antes de D45 no entra al stock solo (P25).
- **Permisos:** Parts & costs y Stock siguen siendo de Manager y System Admin (A56, A62).

## 7. Datos (boceto para el diseño técnico, no definitivo)

- `Part`: `kind` (`pm` | `repair` | `tire`), `tireSize?`, `tireType?` (`new` | `recap`), `minStock?`.
- `PartPurchaseLine`:
  - `workOrderJobId?`;
  - `destination` (`truck` | `stock` | `shop_supplies`); hoy "sin camión" equivale a `stock` o `shop_supplies`, y se decide en la migración.
- `StockMovement` (nuevo, solo crece): `partId`, `kind` (`purchase_in` | `issue` | `return` | `adjust` | `reversal`), `quantity`, `unitCostCents`, `purchaseLineId?`, `workOrderJobId?`, `truckId?`, `reason?`, `reversesId?`.
- `WorkOrderJobPart` (nuevo): `workOrderJobId`, `partId`, `quantity`, `tirePosition?`, `status` (`proposed` | `issued` | `to_buy` | `returned`), `stockMovementId?`, `purchaseLineId?`.
- `TruckCostEntry.kind` suma `stock_issue`.
- Migraciones por **Release safety** (como siempre).
- Filas nuevas en `test:real` y `USER_FLOWS.md` en el mismo PR de cada etapa.

## 8. Etapas (cada una se entrega y sirve sola)

Linear: Epic **LTR-220**; ST-1 a ST-6 son **LTR-221 a LTR-226**. La demo no se actualiza con estas etapas hasta que el dueño avise (2026-10-16).

| Etapa | Qué | Historias | Depende de |
|---|---|---|---|
| **ST-1** ✅ | La compra se ata al Job; el Job muestra sus partes (construida, LTR-221, filas A111–A113) | HU-C1 (sin stock), HU-C2 | — |
| **ST-2** ✅ | Catálogo de repuestos y llantas (construida, LTR-222, filas A114–A116) | HU-R1, HU-R2 | — |
| **ST-3** ✅ | Stock: entra con la compra, sale a un Job, ajustes y reversas, pantalla Stock (construida, LTR-223, filas A117–A121) | HU-S1–S4, HU-C1 completo | ST-1, ST-2, P25, P27 |
| **ST-4** ✅ | Llantas desde la inspección (construida, LTR-224, filas A122–A124; sin P26, el camión recuerda la medida) | HU-T1–T4 | ST-3, P26 |
| **ST-5** ✅ | El PM descuenta del stock y cobra el aceite a precio fijo (construida, LTR-225, filas A125–A127) | HU-S5 | ST-3, P29 |
| **ST-6** ✅ | Leer facturas en PDF (construida, LTR-226: en el navegador, nada se guarda sin el Manager) | HU-F2 | ST-2, P30 |

**Recomendación:** empezar por **ST-1**, que es chica, no necesita stock y cumple la parte de Randy que dice "atar la compra al camión y al trabajo". **ST-2** puede ir en paralelo. ST-3 y ST-4 van después de que Randy responda P25–P27.

## 9. Preguntas abiertas para Randy (P24–P31)

| # | Pregunta | Recomendación |
|---|---|---|
| P24 | ¿Las llantas de trailer entran después, con los trailers (LTR-56)? | Sí, con LTR-56 |
| P25 | Para arrancar el stock, ¿se cuenta a mano lo que hay en el taller (un conteo inicial)? | Sí, con **Adjust** el primer día |
| P26 | ¿Qué medidas usan steer y drive? ¿Son las mismas en toda la flota? | Que el camión recuerde la última medida por eje |
| P27 | ¿Costo promedio, o el de la factura de cada llanta (FIFO)? | Promedio |
| P28 | ¿El mecánico confirma lo que usó, o solo lo hace el Manager? | Solo el Manager en esta etapa |
| P29 | ¿El PM debe descontar filtros y aceite del stock y cobrarlos al camión (cambia D-PC4)? | Decidirlo después de ST-3 |
| P30 | ¿Qué proveedores mandan factura por correo o portal, y en qué formato? | Leer PDF subido primero (ST-6) |
| P31 | ¿La llanta vieja (casing) vuelve al recapador con un crédito que haya que llevar? | Fuera de esta etapa salvo que Randy lo pida |
