# 03 · Contenido: Yard Operations → Dispatch

**slug:** admin-yard-dispatch-2026-10 · **Fecha:** 2026-10-19 · **Fuente:** catálogo `apps/web/src/lib/admin-messages-catalog.ts` y `packages/shared/src/yard-data-boundary-copy.ts`, más la captura de producción.

## Hallazgos

### UX-3-001 · Cuatro palabras para "dónde está el camión"
- **Dónde:** `yardInShopPhase` / `yardNotInShop` (catálogo L1522-1523), `yardHasOpenWo` (L1524), `workLocation.label` "Dispatch status" (copy L28), `presenceInShop` / `presenceInYard` (D49).
- **Evidencia:** en la misma pantalla aparecen "In shop · Shop Work", "Not in shop", "301 Yard", "Outside" y "= has an open Work Order in the shop" (observado).
- **Criterio:** consistencia de vocabulario (un concepto, un término).
- **Severidad:** 3. El concepto es central y el Manager duda de si "In shop" es lugar o trabajo.
- **Recomendación:** usar solo los términos de D49:
  - **In shop** (en la yard con WO abierta).
  - **In yard** (en la yard, sin WO).
  - La **ciudad** si está afuera.
  - Quitar "Not in shop".
  - Lo que escribe Dispatch se presenta como cita: "Dispatch: 301 Yard".
- **Esfuerzo:** S

### UX-3-002 · El español dice "taller" donde D49 dice "shop"
- **Dónde:** `yardInShopPhase` ES "En el taller · {phase}", `yardNotInShop` ES "No está en el taller" (L3515-3516) frente a `presenceInShop` ES "En el shop".
- **Criterio:** consistencia entre idiomas.
- **Severidad:** 2.
- **Recomendación:** en ES, "En el shop" y "En la yard", igual que la lista de Trucks.
- **Esfuerzo:** S

### UX-3-003 · Un camión que no está en la app no tiene texto
- **Dónde:** `admin-yard-data-boundary-cards.tsx:300-302` (span sin etiqueta).
- **Criterio:** H9: un estado que no se nombra no se puede arreglar.
- **Severidad:** 3 (es el mismo problema que UX-1-002, visto desde el texto).
- **Recomendación:**
  - Etiqueta "Not in Shop app" ("No está en la app del shop").
  - Tooltip "Dispatch has this truck, but the Shop app does not."
  - Botón "Add from Samsara" ("Agregar desde Samsara").
- **Esfuerzo:** S

### UX-3-004 · El texto de arriba niega el GPS y repite la fuente dos veces
- **Dónde:** `yardOperationsPhase1Body` + `yardMovementSource` (L1111, L1120).
- **Evidencia:** "Reported by Dispatch: … These are not the Shop's Ready to Go, GPS presence, or dispatch confirmation. Reported by Dispatch · checked 10:27 PM" (observado).
- **Severidad:** 2.
- **Recomendación:**
  - EN: "Dispatch reports the expected arrivals and departures. Where each truck is comes from Samsara GPS."
  - ES: "Dispatch reporta las llegadas y salidas esperadas. Dónde está cada camión sale del GPS de Samsara."
- **Esfuerzo:** S

## Glosario propuesto

| Término | Sinónimos que se encontraron | Dónde |
|---|---|---|
| **In shop** / En el shop | In shop · phase (solo WO), "in the shop", En el taller | Filas de Dispatch, leyenda de la llave, Trucks (D49) |
| **In yard** / En la yard | 301 Yard (texto de Dispatch) | Dispatch status, Trucks (D49) |
| **Arrived** / Llegó | — (no existía) | Incoming |
| **Left** / Salió | — (no existía) | Departures |
| **Not in Shop app** / No está en la app del shop | número en blanco, sin texto | Filas y chips |
| **Dispatch: ‹texto›** | Dispatch status, Work location, Ubicación de trabajo | Tarjeta que se reemplaza |

## Guía de voz observada
Domina el inglés corto de etiqueta ("Not in shop", "Show less"), con términos de producto en mayúscula (Work Order, Jobs). Se rompe donde se mezcla "taller" con "shop" en ES. La recomendación es mantener la voz corta y usar el glosario de arriba.

## Lo que funciona bien
- Las fechas se leen claras ("Oct 19, 2026") y la fuente se dice ("Reported by Dispatch · checked …").

## Resumen
El problema más grave es que "In shop" tiene dos significados. Hay 4 términos inconsistentes. Esta pestaña no muestra errores de la API en crudo.
