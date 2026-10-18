# 10 · Jobs to be done e historias — Parts & costs (después de D45)

**Fecha:** 2026-10-18 · **Alcance:** Parts & costs completo (Purchases, Outside repairs, Internal invoices, Stock, Parts, Vendors, Labor rate), el menú del Job y Truck → Costs · **Método:** documentos + código + navegador local (base `ltl_shop`, sin stock)

**Resumen:**
- Hay 9 hallazgos: 2 de severidad 4, 4 de severidad 3 y 3 de severidad 2.
- **El patrón dominante:** la app modela **una sola cosa** (la parte del catálogo y su saldo en el estante), pero la muestra como **tres** ("partes del PM", Parts y Stock). Además, a la gestión del estante le falta su verbo principal.
- **Count cumple tres trabajos con un solo nombre.** Gestionar el stock, en cambio, no tiene casa: agregar, corregir, fijar el mínimo, sacar por daño.
- **Hay un defecto B confirmado (LTR-242):** el PM cobra dos veces una parte.

## 1. El modelo real, en una frase

**Una parte** (`Part`, `schema.prisma:673`) es de tipo PM, Repair o Tires (`PartCategory.kind`, :655).

Su **stock** no es otra cosa: es la suma de sus movimientos (`StockMovement`, :722; `stock-ledger.ts:5-32`). Lo único que sube o baja el estante es:
- la compra "To stock";
- Count;
- "Parts from stock";
- Return to stock;
- Confirm tires;
- completar un PM.

Las "partes del PM" no son un catálogo aparte. Son las partes de tipo PM, que el mecánico de PM ve filtradas por camión (`work-orders.service.ts:1649-1662`).

**El usuario no ve ese modelo**, porque la pantalla le muestra tres cosas:

| Lo que ve el Manager | Dónde | Lo que es de verdad |
|---|---|---|
| "Parts — **The parts the PM uses**…" | `/admin/parts/catalog` (`admin-messages-catalog.ts:128-129`) | El catálogo de todas las partes (PM, Repair, Tires) |
| "Stock — What the Shop has on the shelf" | `/admin/parts/stock` (:79) | Las mismas partes, con su saldo |
| "Parts used" en el PM del mecánico | `pm-service-card.tsx:417-470` | Las partes de tipo PM que le quedan a ese camión |

## 2. Jobs por rol: qué promete la historia y qué hace la pantalla hoy

### Shop Manager y System Admin

| Job (historia) | Lo que promete | Dónde se hace hoy | ¿Cumple? | Fricción |
|---|---|---|---|---|
| **J13** compro partes o pago una reparación afuera → la asigno al camión (HU-M12) | Cargar y asignar | Purchases → New purchase; Outside repairs | Sí | El destino se elige en **dos niveles**: "Truck (optional): **No truck · shop stock**" arriba y "Goes to: To stock / Shop supplies" en cada línea (observado). "shop stock" mezcla dos destinos (UX-10-005). |
| **J22** sé, línea por línea, si va a un camión o al taller | Truck / To stock / Shop supplies | La misma compra | Sí | Igual que arriba. "Other — only on this invoice" no puede ir To stock, y la razón no se dice en la línea (`SYSTEM.md:437-440`). |
| **J23** sé qué tengo en el estante y qué falta | On hand, mínimo, Low | Stock | **A medias** | El mínimo se ve en Stock pero se cambia en Parts → Edit part (`pcMinStock`, :153). Una parte nueva no aparece en Stock hasta que se mueve o tiene mínimo (`stock.service.ts:62-63`) (UX-10-002). |
| **(sin historia) Gestionar el estante:** cargar el primer día, corregir, sacar lo dañado, fijar mínimos | Lo que pide el dueño | Solo **Count** | **No** | Count hace tres trabajos. No hay "agregar al estante", "sacar por daño o pérdida", ni un historial que se pueda corregir (UX-10-001). |
| **J24** algo sale del estante y se cobra al camión **una vez** | Un solo cobro | Menú del Job → Parts from stock; Confirm tires; completar el PM | **No** | **LTR-242**: el PM cobra otra vez una parte ya comprada al camión (A133, PR 360). El caso B también está confirmado, A134: Parts from stock en el Job del PM más la parte elegida por el mecánico (UX-10-003). |
| **J25** una llanta gastada se vuelve la llanta a poner en el Job | Propuesta → Confirm tires | Job → Tires to put | Sí (por código) | No se vio en local: no hay partes de tipo Tires. Lo tapa el texto "Add them in Parts → Tires", que apunta a una pestaña que no existe (:42) (UX-10-007). |
| **J26** la factura se lee sola | PDF → propuesta de líneas | New purchase → Read the invoice PDF | Sí (ST-6) | — |
| **HU-M12** cuánto cuesta cada camión | Truck → Costs | Truck → Costs | Sí | Sigue el texto "PM parts are not charged on their own; buy them with a purchase assigned to this truck" (:366), que contradice ST-5 (UX-10-006). |
| **J14 / HU-M13** cierro el mes para Finanzas | Internal invoices | Internal invoices | Sí | — (fuera de este cambio) |
| **(sin historia) Poner partes en un Job** | — | Menú del Job: Add parts invoice · Parts from stock · (Tires to put) | Sí, con tres puertas | Son tres entradas con nombres de mecanismo ("invoice", "stock"), no del trabajo ("poner partes en este Job"). El Manager tiene que saber de dónde viene la parte antes de elegir (UX-10-004). |

### Mecánico de PM (HU-PM1)

| Job | Hoy | Fricción |
|---|---|---|
| Registrar qué cambió en el PM (una parte por categoría) | "Parts used", con un interruptor por categoría y la parte más usada ya elegida | No ve ni costo ni stock. Está bien así, pero el Manager no tiene una pantalla que le diga "lo que el PM va a sacar del estante al completar". |

### Mecánico General

| Job | Hoy | Fricción |
|---|---|---|
| Saber qué partes tiene su Job | Línea "Parts: …" en el Job, solo nombres (`detail-client.tsx:782-788`) | No toma partes del estante. P28 sigue abierta. |

## 3. Recorridos observados

1. **Primer día del stock** (`/admin/parts/stock`, local, sin stock):
   - La página dice "Nothing in stock yet. Count the shelf, or buy parts "To stock" in Purchases." (`evidencia/10-stock-vacio-primer-dia.jpg`).
   - El único botón es **Count**. El diálogo pide Part (un select con 91 partes, sin búsqueda), Counted, Cost of each one y Reason (`evidencia/10-count-dialogo-primer-dia.jpg`).
   - Un conteo de 10 a $12.50 deja "**1 parts** · $125.00 on the shelf" (observado).
   - Ese "1 parts" es el plural roto que ya estaba como DM3.
2. **La misma parte en Parts:** "Fleetguard Oil Filter LF3654 · All trucks · **No cost yet** · No vendor" (observado). Stock dice $12.50 de promedio y Parts dice "No cost yet": son dos costos (de referencia y promedio) sin relación visible (UX-10-008).
3. **Menú del Job en WO-009** (observado):
   - Alignment: "Add helper · Send to external shop · Add parts invoice · Parts from stock · Cancel Job…";
   - **PM A Service**: "Send to external shop · Add parts invoice · **Parts from stock** · Cancel Job…".

   El Job del PM ofrece sacar del estante a mano, aunque el PM ya saca solo al completar (UX-10-003).
4. **New purchase** (observado): "Truck (optional)" con la primera opción "**No truck · shop stock**". Cada línea tiene "Goes to: To stock | Shop supplies".

## Hallazgos

### UX-10-001 · El Manager no puede gestionar el estante: solo tiene "Count", que hace tres trabajos
- **Dónde:** Stock (`/admin/parts/stock`) · `apps/web/src/components/admin-stock.tsx:51,124,147-226` · `apps/api/src/parts-costs/stock.service.ts:121-150`
- **Evidencia:** `evidencia/10-count-dialogo-primer-dia.jpg` (observado). La ayuda dice "Type how many are on the shelf now. More than the stock says comes in at the cost you type; fewer leave at the average cost." Count se usa para:
  1. cargar el primer día: es la única forma de poner en el estante una parte sin compra;
  2. corregir después de contar;
  3. destrabar una compra que no se puede anular, "primero se devuelve o se cuenta" (`SYSTEM.md:462-463`, A121).

  Para sacar por daño hay que "contar menos". Fijar el mínimo se hace en otra pantalla.
- **Criterio:** Nielsen H2 (coincidencia con el mundo real: el taller habla de "agregar", "sacar", "ajustar") y H6 (reconocer antes que recordar: el Manager tiene que saber que "Count" es la manera de cargar).
- **Severidad:** 3 · Frecuencia media (el primer día, cada conteo, cada daño), impacto alto (un número mal escrito cambia el valor del estante sin una acción con nombre que lo explique), persistente.
- **Recomendación:**
  - Convertir Stock en la casa del estante, con acciones que dicen lo que hacen:
    - **Add to stock**: entra sin compra, con costo, por ejemplo la carga inicial o una parte que llegó sin factura;
    - **Adjust**: el conteo físico, con motivo de una lista (Count, Damaged, Lost, Other);
    - **Edit minimum** desde la misma fila.
  - El nombre "Count" queda como motivo del ajuste, no como botón.
  - P25 ya está respondida (conteo inicial a mano), así que esto cambia el cómo, no el qué.
- **Esfuerzo:** M

### UX-10-002 · "Parts" y "Stock" son la misma lista de partes en dos menús, y cada uno edita la mitad
- **Dónde:** menú Parts & costs (`admin-shell.tsx:33-39`): Stock y Parts. `admin-parts-catalog.tsx` (Add part, Edit part con Minimum in stock) y `admin-stock.tsx` (On hand, Minimum, Low, Count).
- **Evidencia:**
  - El mínimo y "Low" se leen en Stock, pero solo se editan en Parts → Edit part.
  - Una parte recién creada en Parts no sale en Stock hasta que tiene un movimiento o un mínimo (`stock.service.ts:62-63`).
  - Parts no muestra cuántas hay; Stock no deja crear ni editar la parte.
  - En el menú, Stock va antes que Parts (inferido del código, confirmado en pantalla).
- **Criterio:** Nielsen H4 (consistencia) y H8 (diseño minimalista: dos pantallas para un objeto). IA: un objeto, un lugar.
- **Severidad:** 3 · Cada vez que el Manager gestiona partes tiene que ir y volver entre dos menús. Es el "redundante" que señala el dueño.
- **Recomendación:**
  - Una sola pantalla **Parts**, el inventario del taller. Cada fila muestra Type (PM / Repair / Tires), Fits, On hand, Minimum, Low, Average cost y Reference cost.
  - Arriba van Add part y Add category. En cada fila, Edit, Add to stock, Adjust y Movements.
  - El filtro "Low only" y el total del estante se quedan.
  - `/admin/parts/stock` redirige a `/admin/parts/catalog?view=stock` o se retira del menú.
- **Esfuerzo:** M

### UX-10-003 · Completar un PM cobra dos veces una parte (defecto B, LTR-242)
- **Dónde:** `apps/api/src/parts-costs/pm-charges.ts:39-55` (`syncWorkOrderPmCharges`) · menú del Job del PM (`admin-job-table.tsx:198-206`)
- **Evidencia:**
  - **Caso A, confirmado.** Fila **A133** de test:real (PR 360): filtro comprado directo al camión ($30) y también en el estante. El mecánico de PM lo elige y el Manager completa la WO. Resultado: el camión paga **$54** en vez de $30, y el estante baja de 2 a 1.
  - **Caso B, confirmado.** Fila **A134** (PR 360). El Job del PM ofrece "Parts from stock" (observado en WO-009). Si el Manager saca el filtro a mano y el mecánico también lo elige, el código solo descuenta lo que él mismo sacó (`pmServiceId`). El resultado es que el camión paga **$48** en vez de $24 y el estante baja 2.
- **Criterio:** P29 ("si no están en el estante no se cobran: ya se cargaron al camión al comprarlas", `DECISIONS.md:200`) · Nielsen H5 (prevención de errores).
- **Severidad:** 4 · Pasa en cada PM cuya parte se compró al camión, y el error llega a la factura de Finanzas.
- **Recomendación:**
  - El arreglo va aparte, docs y test primero.
  - El PM descuenta del estante solo lo que el Job del PM no tiene ya, ni por compra ni por "Parts from stock".
  - En el Job del PM, "Parts from stock" no debería ofrecer las partes de tipo PM que ya eligió el mecánico. También sirve explicar que el PM saca solo al completar.
- **Esfuerzo:** S (código) + una fila más de test

### UX-10-004 · Poner partes en un Job tiene tres puertas con nombre de mecanismo
- **Dónde:** menú del Job · `admin-job-table.tsx:198-206`: Add parts invoice · Parts from stock · Tires to put / Confirm tires
- **Evidencia:** observado en WO-009. El Manager tiene que decidir primero *de dónde* sale la parte (una factura nueva o el estante) para encontrar la acción. Las tres terminan en el mismo lugar: la parte en el Job y el costo en el camión (`stock-ledger.ts:89-116`, `purchases.service.ts`).
- **Criterio:** Nielsen H2 (lenguaje del usuario: "le pongo partes a este Job") · IA: agrupar por tarea, no por fuente.
- **Severidad:** 2 · Se aprende, pero cada Manager nuevo se equivoca de puerta y en el menú compiten con Add helper y Send to external shop.
- **Recomendación:**
  - Un solo ítem **Parts…** en el menú del Job, que abre una hoja con:
    - lo que el Job ya tiene, con Return to stock;
    - "From stock", con la cantidad disponible;
    - "Buy for this Job", que abre New purchase con el camión y el Job puestos.
  - Las llantas siguen en "Tires to put", porque nacen de la inspección.
- **Esfuerzo:** M

### UX-10-005 · "No truck · shop stock" mezcla dos destinos distintos
- **Dónde:** New purchase → Truck (optional) · `admin-messages-catalog.ts:232` (`pcNoTruckOption`), :312, :340 · línea "Goes to" (`pcLineToStock` :122, `pcLineShopSupplies` :123)
- **Evidencia:** observado: "Truck (optional): **No truck · shop stock**" y en la línea "Goes to: To stock | Shop supplies". "Shop stock" suena a To stock, pero una línea sin camión puede ser Shop supplies (gasto, no cuenta) o To stock (entra al estante). :340 dice "No truck: it stays as shop stock and counts on no truck."
- **Criterio:** Nielsen H2 y H4 (la misma palabra para dos cosas).
- **Severidad:** 3 · Pasa en cada compra sin camión, y una línea mal puesta deja el estante corto o sobrante sin aviso.
- **Recomendación:** La opción de arriba se llama "**No truck**", sin "shop stock". La línea dice "Goes to: **Stock** · **Shop supplies (not counted)**". Sacar "shop stock" de :312 y :340.
- **Esfuerzo:** S

### UX-10-006 · Textos que todavía dicen que no hay stock o que el PM no cobra
- **Dónde:** `admin-messages-catalog.ts`:
  - :128 "The parts the PM uses…";
  - :129 "These are the PM parts from the base list…";
  - :194 "PM parts are not charged to the truck on their own…";
  - :366 "PM parts are not charged on their own; buy them with a purchase assigned to this truck."
- **Evidencia:** `evidencia/03-parts-dice-partes-del-pm.jpg` (observado en Parts). Los textos de :194 y :366 contradicen ST-5 (`pm-charges.ts`) y :72, que ya dice que salen del stock.
- **Criterio:** Nielsen H1 (estado del sistema) y H4.
- **Severidad:** 3 · El Manager lee justo lo contrario de lo que hace la app con el dinero. Si sigue ":366" compra al camión, y eso dispara LTR-242.
- **Recomendación:** Ver `03-contenido.md` (textos propuestos). Es un quick win.
- **Esfuerzo:** S

### UX-10-007 · "Add them in Parts → Tires" apunta a un lugar que no existe
- **Dónde:** `admin-messages-catalog.ts:42` (`pcTireNoCatalog`), en el diálogo de llantas del Job
- **Evidencia:** inferido del código. Parts no tiene pestaña Tires: Tires es un valor del filtro Type y un tipo de categoría (`admin-parts-catalog.tsx:131-132, 205-250`).
- **Criterio:** Nielsen H6 y H10 (ayuda que lleva a donde dice).
- **Severidad:** 2 · Solo aparece mientras no hay llantas cargadas, pero es justo el primer día de llantas.
- **Recomendación:** "No tires in the catalog yet. In Parts, Add category → Tires, then Add part." Mejor aún, un enlace a `/admin/parts/catalog?type=tire`.
- **Esfuerzo:** S

### UX-10-008 · Dos costos de la misma parte sin relación visible
- **Dónde:** Parts muestra "Reference cost" (`Part.unitCostCents`) y Stock muestra "Average cost" (`stock-ledger.ts`)
- **Evidencia:** observado: después del Count a $12.50, Parts sigue diciendo "**No cost yet**" para LF3654.
  - El costo de referencia se usa como respaldo del Count y para el "Other".
  - El promedio es el que se cobra al camión (P27).
  - Ninguna pantalla explica cuál manda.
- **Criterio:** Nielsen H1 y H2.
- **Severidad:** 2 · Confunde cuando el Manager compara, pero no cambia el cobro.
- **Recomendación:** En la pantalla única de Parts (UX-10-002), mostrar "Avg cost (what the truck pays)" y "Reference cost (when the shelf is empty)". Si hay promedio, "No cost yet" no se muestra.
- **Esfuerzo:** S (con UX-10-002)

### UX-10-009 · No existe la historia de "gestionar el estante"
- **Dónde:** `docs/USER_FLOWS.md`: J23 (:61), HU-M19 (:825-841) · `docs/proposals/parts-stock-tires/README.md` HU-S1–S5 (:127-159)
- **Evidencia:**
  - Las historias de stock son de **entrada** (HU-S1, compra a stock) y **salida** (HU-S2, a un Job). La "gestión" solo aparece como un "Adjust (conteo físico)" (:146).
  - HU-M19 sigue marcada "🔲 propuesta (D45, sin construir)" (:825), aunque su tabla dice ✅.
  - `PRD.md:108-115` dice "Sin inventario (stock)".
- **Criterio:** completitud del JTBD: un job que el usuario hace (cuidar el estante) no tiene historia, así que no tiene pantalla.
- **Severidad:** 4 para el proceso, porque sin historia la próxima etapa vuelve a construir verbos sueltos · 2 para el usuario hoy.
- **Recomendación:**
  - Escribir **HU-M20 · Cuidar el estante**, con estos pasos:
    - cargar el primer día;
    - recibir sin factura;
    - contar y ajustar con motivo;
    - sacar por daño o pérdida;
    - fijar mínimos;
    - ver qué falta comprar.
  - Corregir HU-M19 y el PRD a "construido".
  - Ver la propuesta en `docs/proposals/parts-stock-ia-v2/`.
- **Esfuerzo:** S (docs)

## Lo que funciona bien
- **El modelo de datos ya es el correcto.** Una parte, un saldo que es la suma de movimientos que no se borran, reversas en vez de ediciones (`stock-ledger.ts`). La propuesta solo cambia pantallas y nombres, no la base.
- **El costo promedio y "un solo cobro por salida"** (`source_type: stock_issue`) dejan el ledger del camión auditable. Por eso A133 se pudo probar con números exactos.
- **La compra decide el destino por línea**, con el Job atado (ST-1). Ese es el momento en que el Manager sabe para qué compra.
- **El mecánico de PM no ve costo ni stock** y la parte más usada ya viene elegida. Ese es el trabajo correcto para él.
- **Count exige motivo y rechaza el mismo número** (`STOCK_COUNT_SAME`): la protección ya existe, falta darle nombre.

## Fuera de alcance / no verificado
- **Llantas (J25):** en la base local no hay partes de tipo Tires. Se revisaron por código.
- **Read the invoice PDF:** no hay Storage en local.
- **Las capturas son de ancho de teléfono** (el panel del navegador quedó angosto). Lo de computadora se cita con texto observado.
