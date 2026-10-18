# Propuesta: Parts como inventario del taller, gestión del stock y retoques del menú (IA 2026-10)

**Estado:** **aprobada el 2026-10-18 → D47** (el dueño aceptó P32–P36 como se recomendaban, y además puso las llantas dentro de "Parts…" del Job). Lista para construir en el orden de §5.
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

- **Una sola pantalla Parts** (`/admin/parts/catalog`) reemplaza a Parts + Stock. Stock sale del menú y `/admin/parts/stock` redirige a `?view=stock`.
- **Arriba:**
  - un buscador (nombre, número o medida);
  - Type (All, PM, Repair, Tires) y Fits;
  - los filtros **In stock** y **Low only**;
  - el total "N parts · $X in stock · N low".
- **Botones:** Add part · Add category · **Add to stock**.
- **Cada fila muestra:** Part (nombre y número) · Type · Fits · **In stock** · Minimum · **Avg cost** · Reference cost · Usual vendor · menú "…".
  - El menú "…" tiene: Edit part · Add to stock · Adjust · Movements · Deactivate.
- **Una parte nueva sale en la lista enseguida, con 0 en stock.** Hoy aparece en Stock solo cuando se mueve.
- **Avg cost vs Reference cost:** Avg cost es "what the truck pays". Reference cost es "used when stock is empty or for Other lines". Si hay promedio, no se muestra "No cost yet" (UX-10-008).
- Los datos no cambian: `Part` + `StockMovement`. Es un cambio de pantalla.

### 2.2 Cuidar el stock: acciones con nombre (P33)

| Acción | Para qué | Pide | Movimiento que escribe (ya existe) |
|---|---|---|---|
| **Add to stock** | Carga inicial, una parte que llegó sin factura, una devolución del proveedor que vuelve al estante | Part, Qty, Cost of each one (sugiere el promedio o el de referencia), Note opcional | `adjust` positivo con costo |
| **Adjust** | El conteo físico, o sacar lo dañado o perdido | Part, **New count** o **Remove N**, **Reason**: Count · Damaged · Lost · Other (con nota) | `adjust` positivo o negativo al costo promedio |
| **Edit minimum** | Cuándo sale "Low" | Minimum | Edita `Part.minStock` (hoy solo desde Edit part) |
| **Movements** | Ver de dónde viene cada número | — | Lista que ya existe; agrega el motivo del ajuste |

- **"Count" deja de ser un botón** y queda como motivo de Adjust.
- P25 (conteo inicial a mano) sigue valiendo, ahora con Add to stock.
- Los ajustes no se borran: se corrigen con otro ajuste, como hoy.
- **Lo que no cambia:** el costo promedio (P27), las reversas de compras, y que solo el Manager mueve el stock (P28 sigue abierta para Randy).

### 2.3 Un solo "Parts…" en el Job (P35)

El menú del Job cambia "Add parts invoice" y "Parts from stock" por **Parts…**, que abre una hoja con:

- **On this Job:** las partes que ya tiene, con su origen (compra o stock) y **Return to stock**.
- **From stock:** buscar una parte → "3 in stock · $12.50 each" → Qty → **Take from stock**.
  - Si no hay stock, la hoja lo dice y ofrece **Buy for this Job** ahí mismo, sin mandar a Count.
- **Buy for this Job:** abre New purchase con el camión y el Job ya puestos (lo mismo de hoy).
- **En el Job del PM**, la hoja dice "PM parts leave stock when the Work Order is completed" y no ofrece las partes de tipo PM ya elegidas por el mecánico. Esto evita el caso A134 de LTR-242.
- **Las llantas también van aquí** (D47: "tires es una parte"). Arriba de la hoja sale **Tires from the inspection**, con lo que propuso la inspección por posición (RF · New 11R22.5) y **Confirm**, que saca la llanta del stock como hoy. **"Tires to put" sale del menú del Job.**

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
  - "Como Manager, quiero cargar lo que hay en el estante el primer día, recibir partes sin factura, contar y ajustar con motivo, sacar lo dañado y fijar mínimos, para que el número del estante sea el real y sepa qué comprar."
  - Filas de prueba propuestas: Add to stock con costo; Adjust (Count) arriba y abajo; Adjust (Damaged) sin costo nuevo; Edit minimum hace aparecer Low; una parte nueva sale en Parts con 0 en stock.
- **HU-M12** suma: "Poner partes en un Job desde una sola hoja" (P35). El Job del PM no ofrece sacar a mano lo que el PM saca solo.
- **HU-M19** pasa de "🔲 propuesta" a construida (ST-1 a ST-6). Ya se corrige en este PR.

## 4. Preguntas para el dueño (`docs/DECISIONS.md`)

| # | Pregunta | Recomendación |
|---|---|---|
| **P32** | ¿Parts y Stock se juntan en una sola pantalla Parts (el inventario)? | **Sí.** Es el mismo objeto y hoy cada pantalla edita la mitad. |
| **P33** | ¿"Count" se reemplaza por **Add to stock**, **Adjust** (Count, Damaged, Lost, Other) y **Edit minimum**? | **Sí.** Cada acción dice lo que hace; el modelo de datos no cambia. |
| **P34** | ¿History pasa a ser el filtro "Closed" de Work Orders? ¿O el dueño quiere una bitácora de actividad (quién cambió qué)? | **Filtro Closed.** La bitácora, si hace falta, es otra cosa. |
| **P35** | ¿El menú del Job tiene un solo **Parts…** (lo que tiene, from stock, buy for this Job)? | **Sí.** Una puerta por tarea. |
| **P36** | Nombres: ¿"Jobs" (por Job Catalog), "Shop rates" (por Labor rate) y **Stock** como única palabra (no "shelf") en botones y destinos? | **Sí** a los tres. |

## 5. Orden de trabajo, si el dueño dice que sí

1. **LTR-242** (B): el arreglo del cobro doble del PM, con A133 y A134 en verde.
2. **Quick wins** de textos y de "volver" (§2.5), en un PR chico.
3. **P32 + P33**: la pantalla Parts única y las acciones de stock (web, más una ruta de API para Add to stock y para el motivo de Adjust), con las filas de HU-M20.
4. **P35**: la hoja Parts… del Job.
5. **P34 + P36**: el menú.

La demo sigue congelada: nada de esto se lleva a la demo hasta que el dueño avise.
