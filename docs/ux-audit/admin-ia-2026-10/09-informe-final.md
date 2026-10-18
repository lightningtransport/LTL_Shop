# 09 · Informe final — panel del Manager: IA completa y Parts & costs (2026-10)

**Fecha:** 2026-10-18 · **Fuentes:**
- [`00-contexto.md`](00-contexto.md)
- [`10-jtbd-parts-costs.md`](10-jtbd-parts-costs.md) (UX-10-001…009)
- [`05-navegacion-ia.md`](05-navegacion-ia.md) (UX-5-001…011)
- [`03-contenido.md`](03-contenido.md) (UX-3-001…006)

**Propuesta:** [`docs/proposals/parts-stock-ia-v2/`](../../proposals/parts-stock-ia-v2/README.md), con la maqueta `mockup.html`.

## Resumen ejecutivo

- **El dueño tiene razón:** Parts & costs es confuso y redundante.
  - La app guarda **una sola cosa**: la parte del catálogo y su saldo en el estante.
  - Pero la muestra en **tres lugares**: "las partes del PM", **Parts** y **Stock**. Cada uno edita la mitad.
  - Al Manager le falta el trabajo de **cuidar el estante**. Solo tiene "Count", que sirve para cargar el primer día, para corregir y para destrabar una compra. No hay "agregar", "sacar por daño" ni mínimo editable desde el estante.
  - El modelo de datos está bien. **El problema está en las pantallas y los nombres**, así que se arregla sin migraciones grandes.
- **Hay un defecto que cuesta dinero (LTR-242, clase B).** Completar un PM cobra dos veces una parte que ya se compró para ese camión. La fila A133 de test:real lo prueba: $54 en vez de $30 (PR 360). Un segundo camino, "Parts from stock" en el Job del PM, también está confirmado: $48 en vez de $24 (A134). **Va primero.**
- **La IA del resto del panel se retoca, no se rehace.** Casi todo lo pedido en las auditorías de octubre se cerró. Queda:
  - juntar Stock con Parts;
  - llevar History a Work Orders;
  - dos nombres ("Jobs" y "Shop rates");
  - que volver a Trucks o Work Orders conserve los filtros.

  El menú pasa de 21 entradas en 4 grupos a 19 en 3.

## Top 10 (por severidad y frecuencia)

| # | Hallazgo | Sev. | Esf. | Dónde |
|---|---|---|---|---|
| 1 | El PM cobra dos veces una parte (**LTR-242**) | 4 | S | UX-10-003 |
| 2 | No existe la historia "cuidar el estante", así que no hay pantalla para hacerlo | 4 (proceso) | S docs | UX-10-009 |
| 3 | El Manager solo tiene "Count", que hace tres trabajos | 3 | M | UX-10-001, UX-3-004 |
| 4 | Stock y Parts son el mismo objeto en dos menús | 3 | M | UX-10-002, UX-5-001 |
| 5 | Los textos dicen que las partes del PM no se cobran, y que Parts es "las partes del PM" | 3 | S | UX-10-006, UX-3-001, UX-3-002 |
| 6 | "No truck · shop stock" mezcla To stock con Shop supplies | 3 | S | UX-10-005, UX-3-003 |
| 7 | Volver desde un camión o una WO pierde los filtros | 3 | S | UX-5-008 |
| 8 | Hay tres puertas para poner partes en un Job | 3 | M | UX-10-004, UX-5-010 |
| 9 | Select de 91 partes sin búsqueda (Count, línea de compra) | 2→3 | S–M | UX-5-011 |
| 10 | "Job Catalog" y "Parts" (`/catalog`) se cruzan; "Labor rate" esconde el precio del aceite | 2 | S | UX-5-002, UX-5-003 |

## Quick wins (horas, sin decisión del dueño)

- **Textos** (`admin-messages-catalog.ts`):
  - :128 y :129, Parts como "las partes del PM";
  - :232, :312 y :340, "shop stock";
  - :42, "Parts → Tires";
  - el plural de "1 parts".
- **Texto que depende del arreglo:** :194 y :366, "PM parts are not charged". Va en el PR de **LTR-242**, porque la frase nueva tiene que ser cierta.
- **Volver con filtros:** `from` con la consulta en Trucks y Work Orders (UX-5-008). El breadcrumb del camión cae en "Trucks", no en "Yard Operations" (UX-5-006).
- **Breadcrumbs** en las pantallas de nivel 2 de Setup (UX-5-007).

## Patrones

1. **Los textos se quedan atrás de las decisiones.** D45 cambió "sin stock" por "con stock", pero los textos de la etapa 1 siguen en pantalla y en los documentos. Pasa en `PRD.md`, `USER_FLOWS.md` HU-M19 y G9, `SYSTEM.md` y el README de la propuesta D45. Este PR corrige los documentos.
2. **Se construyeron verbos sueltos, no trabajos.** Count, Parts from stock y Add parts invoice cumplen cada una un caso, pero nadie escribió el trabajo completo ("cuidar el estante", "ponerle partes a un Job"). La propuesta escribe HU-M20 antes de diseñar.
3. **El origen de la navegación no viaja completo.** El Yard pasa la consulta en `from`; Trucks, Work Orders y tres enlaces sueltos no. Por eso se pierden filtros y el breadcrumb miente.

## Plan

1. **LTR-242** (B): el arreglo del cobro doble, con A133 y A134 en verde. Incluye el texto :194/:366.
2. **Quick wins** de textos y de "volver", en un PR chico.
3. **Si el dueño dice sí a P32 y P33:** HU-M20 en `USER_FLOWS.md` con sus filas, después la pantalla Parts única con Add to stock, Adjust y Edit minimum.
4. **P35:** la hoja Parts… del Job.
5. **P34 y P36:** retoques del menú.

## Lo que no hay que tocar

- **El modelo de stock:** una parte, movimientos que no se borran, reversas, costo promedio y un solo cobro por salida.
- **El destino por línea en la compra, con el Job atado (ST-1).**
- **El PM del mecánico:** sin costo ni stock, con la parte más usada ya elegida.
- **El orden de los grupos del menú:** el día, la semana, la configuración.
- **El patrón `from` del Yard**, que es el modelo para el resto.
