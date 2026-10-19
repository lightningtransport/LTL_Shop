# Propuesta: Parts como inventario del taller, gestión del stock y retoques del menú (IA 2026-10)

**Estado:** **aprobada el 2026-10-18 → D47**. El dueño aceptó P32–P36 como se recomendaban y además metió las llantas en "Parts…" del Job. El mismo día se hizo una **revisión de UX/UI de la maqueta**, que el dueño aceptó: "Adjust" se divide en **Count stock** (en lote) y **Remove from stock**; hay una sola columna de costo y un panel de la parte; la hoja del Job del PM muestra qué se va a cobrar; las llantas aparecen solo en el Job de llantas. **Construido:** §2.1 y §2.2 (LTR-246, PRs 366 y siguiente), §2.5 (LTR-244 y LTR-245). **Falta:** §2.3 (LTR-247) y §2.4 (LTR-248). **Diferencia con la maqueta:** Parts sigue agrupado por categoría (las mismas secciones de antes) en lugar de una sola tabla; cada sección pone primero lo Low y lo que está en stock, y el menú "…" de la fila se queda junto al panel de la parte.
**Fecha:** 2026-10-18 · **Origen:** el dueño ve Parts & costs confuso y redundante. Hay un "Count" que no es gestionar el stock, y las "partes del PM" parecen una cosa y Stock otra. También pidió revisar la IA de todo el panel.
**Evidencia:** [`docs/ux-audit/admin-ia-2026-10/`](../../ux-audit/admin-ia-2026-10/):
- [`09-informe-final.md`](../../ux-audit/admin-ia-2026-10/09-informe-final.md)
- [`10-jtbd-parts-costs.md`](../../ux-audit/admin-ia-2026-10/10-jtbd-parts-costs.md)
- [`05-navegacion-ia.md`](../../ux-audit/admin-ia-2026-10/05-navegacion-ia.md)
- [`03-contenido.md`](../../ux-audit/admin-ia-2026-10/03-contenido.md)

**Maqueta:** [`mockup.html`](mockup.html). **Linear:** Epic LTR-243:
- LTR-244: textos;
- LTR-245: volver con filtros;
- LTR-246: HU-M20, P32/P33;
- LTR-247: Parts… en el Job, P35;
- LTR-248: menú, P34/P36.

El defecto es LTR-242.

## 1. El problema, en palabras del taller

- **Una parte es una sola cosa.** El filtro LF3654 está en el catálogo, tiene un costo, tiene cuántas hay en el estante y el PM lo puede elegir. La app la guarda así: un `Part` con su saldo.
- **Pero la pantalla la muestra en tres lugares:**
  - **Parts** dice "The parts the PM uses…";
  - **Stock** dice cuántas hay, pero no deja crear ni editar la parte;
  - el PM del mecánico dice "Parts used".
- **El Manager no tiene cómo cuidar el estante.** Solo tiene **Count**, que sirve para tres cosas distintas:
  1. cargar el primer día;
  2. corregir después de contar;
  3. destrabar una compra.

  No hay "agregar", ni "sacar por daño", y el mínimo se cambia en otra pantalla.
- **Para poner partes en un Job hay tres puertas** (Add parts invoice, Parts from stock, Tires to put). Hay que saber de dónde sale la parte antes de elegir la puerta.
- **Hay un defecto que cuesta dinero (LTR-242, clase B).** Completar un PM cobra otra vez una parte ya comprada para ese camión (filas A133 y A134, PR 360).
  - Se arregla aparte, primero.
  - Esta propuesta además evita que el Job del PM ofrezca sacar a mano lo que el PM ya saca solo.

## 2. Lo que se propone

### 2.1 Parts = el inventario del taller (P32)

- **Una sola pantalla Parts** (`/admin/parts/catalog`) reemplaza a Parts y Stock. Stock sale del menú y `/admin/parts/stock` redirige a `?view=stock`.
- **Arriba:**
  - un buscador por nombre, número o medida;
  - los filtros Type (All, PM, Repair, Tires), Fits, **In stock** y **Low only**;
  - el total: "N parts · N in stock · $X in stock · N low".
- **Botones:** **Count stock** es el principal. También están Add part, Add category y Add to stock.
- **Orden por defecto:** primero lo que hay en stock y lo que está Low, después el resto. Con un catálogo de 128 partes casi todas en 0, la vista no se llena de ceros. *(Revisión de UX, 2026-10-18.)*
- **Cada fila muestra:** Part (nombre y número) · Type · Fits · **In stock** · Minimum · **Cost** · Usual vendor.
  - **Cost es una sola columna.** Si hay stock, muestra el promedio ("what the truck pays"). Si no hay, muestra el de referencia en gris con la marca "ref". Así no hay dos costos lado a lado (UX-10-008).
  - El badge de Type es igual para PM, Repair y Tires. Ninguno se ve más importante.
- **Al hacer clic en la fila se abre el panel de la parte.** Muestra:
  - In stock, Cost (promedio y referencia, explicados);
  - **Minimum editable ahí mismo**;
  - Fits y Usual vendor;
  - **Movements** (de dónde viene cada número, con el motivo);
  - las acciones Add to stock · Remove from stock · Edit part · Deactivate.

  El menú "…" de la fila se va.
- **Una parte nueva sale en la lista enseguida, con 0 en stock.** Hoy solo aparece en Stock cuando se mueve.
- **En el teléfono, la tabla se vuelve tarjetas:** nombre, número, In stock y Low.
- Los datos no cambian: `Part` + `StockMovement`. Es un cambio de pantalla.

### 2.2 Cuidar el stock: tres acciones, cada una con un solo significado (P33, ajustado tras la revisión de UX)

| Acción | Para qué | Pide | Movimiento que escribe (ya existe) |
|---|---|---|---|
| **Count stock** (en lote) | **El primer día** y cada conteo físico | Una lista filtrable por tipo o categoría, con un campo **Counted** por parte. Al final muestra un resumen ("12 changed · +$1,240 · −$25 · 3 need a cost") y se guarda con un solo **Save count**. Pide el costo **solo** para las partes que suben y no tienen promedio ni costo de referencia | Un `adjust` por cada parte que cambió (motivo Count): sube al costo indicado, baja al promedio |
| **Add to stock** | Partes que llegaron **sin factura** | Part, Qty, Cost of each one (sugiere el promedio o el de referencia), Note opcional | `adjust` positivo con costo (motivo Received) |
| **Remove from stock** | Algo **dañado, perdido** u otro motivo | Part, **Qty to remove**, **Reason**: Damaged · Lost · Other (con nota). Muestra la vista previa "2 leave stock at $12.50 · −$25.00 · no truck is charged" | `adjust` negativo al costo promedio |

- **Cada campo significa una sola cosa.** Count escribe **cuántas hay**; Remove escribe **cuántas salen**. La primera versión de la propuesta tenía "Adjust" con un solo campo que cambiaba de significado según el motivo, y eso arriesgaba sacar 8 en vez de 2. Además "Add to stock" y "Adjust → Count" hacían lo mismo con saldo 0.
- **"Count" vuelve como pantalla en lote**, no como el botón por parte de hoy. P25 (el conteo inicial a mano) se hace aquí.
- **El mínimo** se edita en el panel de la parte o en Edit part.
- Los movimientos no se borran: se corrigen con otro, como hoy.
- **Lo que no cambia:** el costo promedio (P27), las reversas de compras, y que solo el Manager mueve el stock (P28 sigue abierta para Randy).

### 2.3 Un solo "Parts…" en el Job (P35)

El menú del Job reemplaza "Add parts invoice", "Parts from stock" y "Tires to put" por **Parts…**. Se abre una hoja con:

- **Tires from the inspection**, **solo en el Job de llantas**, que es el Job donde la inspección (ST-4) deja la llanta a cambiar. Muestra lo propuesto por posición (RF · New 11R22.5 · 4 in stock · $410) con **Confirm**, que saca la llanta del stock como hoy (D47: "tires es una parte"). En los demás Jobs esta sección no aparece.
- **On this Job:** las partes que ya tiene, con su origen (stock o compra) y su costo.
  - **Return to stock** pide **cuántas** (puede ser 1 de 2) y **por qué**.
  - Una compra muestra "Open purchase".
- **From stock:** buscar una parte → "3 in stock · $12.50 each" → **Qty** (con etiqueta) → **Take from stock**.
  - Si no hay stock, la hoja lo dice y ofrece **Buy for this Job** ahí mismo.
- **Buy for this Job:** abre New purchase con el camión y el Job ya puestos. **Al guardar, vuelve a la WO** con la hoja abierta (`from`).
- **Abajo, el total:** "Parts on this Job · $224.40".
- **En el Job del PM**, la hoja dice qué va a pasar con **cada** parte elegida por el mecánico, antes de completar:
  - "Leaves stock at $12.50 when the WO is completed";
  - "Already bought for this Job · not charged again";
  - "Not in stock · not charged".

  También dice que una compra al camión **sin Job** sí se vuelve a cobrar, y ofrece atarla al Job del PM. Es lo que aprendimos de LTR-242. "From stock" no lista las partes de tipo PM ya elegidas, para evitar el caso A134.

### 2.4 Retoques del menú (P34, P36)

```
Operations       Dashboard · Yard Operations · Work Orders (+ filtro Closed) · Trucks
Parts & costs    Purchases · Outside repairs · Parts · Vendors · Internal invoices
Setup            People · Jobs · Shop workflow · Inspection checklist · Samsara · Shop rates
```

- **History → filtro "Closed" en Work Orders** (P34). Se retira el grupo Audit, que tiene un solo ítem.
- **"Job Catalog" → "Jobs"** y **"Labor rate" → "Shop rates"** (labor rate + PM oil change) (P36).
- **"Internal invoices" baja al final del grupo:** se usa una vez al mes y "Parts" pasa a ser semanal.
- Son 19 entradas en vez de 21, y 3 grupos en vez de 4.

### 2.5 Quick wins que no esperan decisiones

Son textos que hoy dicen lo contrario de lo que hace la app (`03-contenido.md`):
- UX-3-001: "The parts the PM uses";
- UX-3-002: "PM parts are not charged on their own", que va después de LTR-242;
- UX-3-003: "No truck · shop stock";
- UX-3-005: "Parts → Tires";
- UX-3-006: "1 parts".

En la orientación (`05-navegacion-ia.md`):
- UX-5-008: volver a Trucks o Work Orders con los filtros;
- UX-5-006: el breadcrumb del camión que cae en "Yard Operations";
- UX-5-007: el breadcrumb de las pantallas de Setup.

Ninguno cambia datos.

## 3. Historias que se escriben (docs primero)

- **HU-M20 · Cuidar el stock** (nueva, en `USER_FLOWS.md`, rol Manager):
  - "Como Manager, quiero contar todo el estante de una vez (el primer día y cada mes), recibir partes sin factura, sacar lo dañado o perdido con motivo y fijar mínimos, para que el número del estante sea el real y sepa qué comprar."
  - Filas de prueba propuestas:
    - Count stock en lote, con partes que suben, bajan y una sin costo;
    - Add to stock con costo;
    - Remove from stock (Damaged) al promedio, sin cobrar a ningún camión;
    - editar el mínimo hace aparecer Low;
    - una parte nueva sale en Parts con 0 en stock;
    - la hoja del Job del PM muestra lo que se va a cobrar.
- **HU-M12** suma: "Poner partes en un Job desde una sola hoja" (P35). El Job del PM no ofrece sacar a mano lo que el PM saca solo.
- **HU-M19** pasa de "🔲 propuesta" a construida (ST-1 a ST-6). Ya se corrige en este PR.

## 4. Preguntas para el dueño (`docs/DECISIONS.md`)

| # | Pregunta | Recomendación |
|---|---|---|
| **P32** | ¿Parts y Stock se juntan en una sola pantalla Parts (el inventario)? | **Sí.** Es el mismo objeto y hoy cada pantalla edita la mitad. |
| **P33** | ¿"Count" se reemplaza por **Add to stock**, **Adjust** (Count, Damaged, Lost, Other) y **Edit minimum**? | **Sí.** Cada acción dice lo que hace; el modelo de datos no cambia. *(Ajustado tras la revisión de UX: Adjust se divide en **Count stock**, en lote, y **Remove from stock**; ver §2.2.)* |
| **P34** | ¿History pasa a ser el filtro "Closed" de Work Orders? ¿O el dueño quiere una bitácora de actividad (quién cambió qué)? | **Filtro Closed.** La bitácora, si hace falta, es otra cosa. |
| **P35** | ¿El menú del Job tiene un solo **Parts…** (lo que tiene, from stock, buy for this Job)? | **Sí.** Una puerta por tarea. |
| **P36** | Nombres: ¿"Jobs" (por Job Catalog), "Shop rates" (por Labor rate) y **Stock** como única palabra (no "shelf") en botones y destinos? | **Sí** a los tres. |

## 5. Orden de trabajo, si el dueño dice que sí

1. **LTR-242** (B): el arreglo del cobro doble del PM, con A133 y A134 en verde.
2. **Quick wins** de textos y de "volver" (§2.5), en un PR chico.
3. **P32 + P33**: la pantalla Parts única con su panel de parte, Count stock en lote, Add to stock y Remove from stock. Es trabajo de web más una ruta de API para el conteo en lote y el motivo del movimiento. Va con las filas de HU-M20.
4. **P35**: la hoja Parts… del Job.
5. **P34 + P36**: el menú.

La demo sigue congelada: nada de esto se lleva a la demo hasta que el dueño avise.
