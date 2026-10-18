# 03 · Contenido y lenguaje — Parts & costs (después de D45)

**Fecha:** 2026-10-18 · **Alcance:** los textos de Parts & costs, del menú del Job sobre partes y del menú del panel · **Método:** `apps/web/src/lib/admin-messages-catalog.ts`, más el texto observado en local

**Resumen:**
- Hay 6 hallazgos: 3 de severidad 3, 2 de severidad 2 y 1 de severidad 1.
- **El patrón dominante:** los textos escritos para la etapa 1 (sin stock, catálogo solo del PM) **siguen en pantalla** después de D45. Dicen lo contrario de lo que hace la app con el dinero.
- **Casi todo es un quick win:** cambiar textos, sin tocar la lógica.

## Glosario propuesto (una palabra, una cosa)

| Término en la UI | Significa | No usar para |
|---|---|---|
| **Part** | Una parte del catálogo, de tipo PM, Repair o Tires | — |
| **Parts** (pantalla) | El inventario del taller: el catálogo con su saldo en el estante | "PM parts" como si fuera otro catálogo |
| **PM part** | Una parte de tipo PM: la que el mecánico de PM puede elegir | Una lista aparte |
| **Stock** ("on the shelf" en frases) | Lo que el taller tiene guardado, comprado "To stock" o cargado a mano | Las compras sin camión que son Shop supplies |
| **Stock** — destino de una línea | La línea entra al estante y se cobra al camión cuando sale | "shop stock" |
| **Shop supplies** — destino de una línea | Gasto del taller (aceite a granel, trapos). No se cuenta en ningún camión ni en el estante | "stock" |
| **No truck** | La compra no va entera a un camión; cada línea dice si va al estante o a Shop supplies | "No truck · shop stock" |
| **Add to stock** | Entra al estante sin compra, con costo (carga inicial, una parte que llegó sin factura) | "Count" |
| **Adjust** | Corregir el saldo con un motivo: Count (conteo), Damaged, Lost u Other | "Count" como botón |
| **Take from stock** | Una parte del estante pasa a un Job y se cobra al camión al costo promedio | — |
| **Return to stock** | Deshace un Take from stock, con motivo | — |
| **Average cost** | Lo que paga el camión cuando la parte sale del estante (P27) | "cost" a secas |
| **Reference cost** | El precio de referencia; se usa cuando el estante está vacío o la línea es "Other" | "unit cost" |

**Decisión pendiente (P36 en la propuesta):** decir **Shelf** o **Stock** en todo el panel. Hoy conviven "Stock" (menú, título), "To stock" (línea), "Parts from stock" y "Return to stock" (Job), y "shelf" en la ayuda. La recomendación es mantener **Stock** como nombre del concepto (es la palabra del taller y la de Randy) y usar "shelf" solo en frases. Así: "Goes to: **Stock** · Shop supplies", "**From stock**", "Add to stock" y "Adjust stock".

## Hallazgos

### UX-3-001 · La pantalla Parts dice que es "las partes del PM"
- **Dónde:** `admin-messages-catalog.ts:128` (`pcPartsSubtitle`) "The parts the PM uses, with their reference cost, usual vendor and the trucks they fit." · :129 (`pcFirstUse`) "These are the PM parts from the base list. Add a unit cost or a vendor to start tracking costs."
- **Evidencia:** `evidencia/03-parts-dice-partes-del-pm.jpg` (observado).
- **Criterio:** Nielsen H2 y H4. Desde ST-2 la pantalla tiene PM, Repair y Tires.
- **Severidad:** 3 · Es la primera frase de la pantalla y sostiene la idea de que "las partes del PM" son un catálogo aparte. Es la confusión que señala el dueño.
- **Recomendación:**
  - :128 "Every part the Shop uses (PM, repair and tires): what it fits, its reference cost and its usual vendor."
  - :129 "Start with the PM parts from the base list. Add repair parts and tires with Add category."
- **Esfuerzo:** S

### UX-3-002 · Dos textos dicen que las partes del PM no se cobran solas
- **Dónde:** `admin-messages-catalog.ts:194` (`pcNoCostNote`) "PM parts are not charged to the truck on their own: a truck's parts cost comes from the purchases assigned to it." · :366 (`pcCostsPmNote`) "PM parts are not charged on their own; buy them with a purchase assigned to this truck."
- **Evidencia:** contradice ST-5 (`pm-charges.ts`) y :72 (`pcOilPriceHelp`), que ya dice "Parts the mechanic picks in the PM leave the stock when you complete the Work Order."
- **Criterio:** Nielsen H1 (estado del sistema) y H4.
- **Severidad:** 3 · Lleva al Manager a comprar la parte al camión, que es justo el caso que dispara LTR-242.
- **Recomendación:**
  - :194 "PM parts are charged to the truck when the Work Order is completed: each one leaves the stock at the average cost. A part bought straight for this truck is not charged again."
  - :366 "PM parts are charged when the Work Order is completed, from stock at the average cost, plus the PM oil change price."

  La segunda frase de :194 tiene que ser cierta, así que va después del arreglo de LTR-242.
- **Esfuerzo:** S

### UX-3-003 · "No truck · shop stock" usa "stock" para lo que puede no ser stock
- **Dónde:** :232 (`pcNoTruckOption`), :312 (`pcNoTruckShare`) "No truck · shop stock" · :340 (`pcAllNoTruck`) "No truck: it stays as shop stock and counts on no truck."
- **Evidencia:** observado en New purchase. Ver `10-jtbd-parts-costs.md` UX-10-005.
- **Criterio:** Nielsen H4 (la misma palabra para dos cosas).
- **Severidad:** 3
- **Recomendación:**
  - :232 y :312 "No truck";
  - :340 "No truck: each line goes to Stock or to Shop supplies.";
  - la línea: "Goes to: Stock · Shop supplies (not counted)".
- **Esfuerzo:** S

### UX-3-004 · "Count" nombra tres acciones distintas
- **Dónde:** :88 (`pcStockEmpty`) "Nothing in stock yet. Count the shelf, or buy parts "To stock" in Purchases." · :120 (`pcStockNoParts`) "Nothing in stock. Count the shelf or buy "To stock" first." · el botón y el diálogo de Count (:88-99)
- **Evidencia:** observado. "Count the shelf" es la instrucción para cargar el primer día, para corregir y para destrabar una compra.
- **Criterio:** Nielsen H2.
- **Severidad:** 2 · Depende de la propuesta P33.
- **Recomendación** (con P33):
  - :88 "Nothing in stock yet. Add what is on the shelf today, or buy parts to Stock in Purchases."
  - :120 "Nothing in stock for this part. Add it to stock, or buy it for this Job."
- **Esfuerzo:** S

### UX-3-005 · "Add them in Parts → Tires" apunta a una pestaña que no existe
- **Dónde:** :42 (`pcTireNoCatalog`)
- **Recomendación:** "No tires in the catalog yet. In Parts, use Add category → Tires, then Add part." Ver UX-10-007.
- **Severidad:** 2 · **Esfuerzo:** S

### UX-3-006 · Plural roto en el total del estante
- **Dónde:** Stock, la línea del total: observado "**1 parts** · $125.00 on the shelf · 0 low"
- **Criterio:** Nielsen H4. Es el mismo patrón que DM3 ("1 lines", "1 parts").
- **Severidad:** 1
- **Recomendación:** plural con `Intl.PluralRules` o la función de plural que usan los otros textos con `{count}`.
- **Esfuerzo:** S

## Lo que funciona bien
- **La ayuda del precio del aceite (:72) ya explica bien el modelo de ST-5:** qué se cobra, cuándo y qué no se cuenta. Es el tono que deberían tener :194 y :366.
- **Los errores del API tienen un código y un texto claro** (`STOCK_COST_REQUIRED`, `STOCK_COUNT_SAME`, `STOCK_ALREADY_USED`).
- **"Other — only on this invoice"** dice exactamente qué pasa con la línea.

## Fuera de alcance / no verificado
- **El español de la interfaz:** solo se leyó. El taller usa el inglés.
- **Los textos del PM del mecánico y de Safety:** no se revisaron.
