# 01 · Usabilidad: Yard Operations → Dispatch

**slug:** admin-yard-dispatch-2026-10 · **Fecha:** 2026-10-19 · **Método:** heurísticas de Nielsen sobre la captura de producción del dueño y la lectura del código.

## Alcance
- `/admin/yard-operations?tab=dispatch`, en escritorio. Tres tarjetas: Incoming Trucks, Upcoming Departures y Dispatch status.
- No se cubrió: el teléfono. Se revisa después del rediseño con la skill `mobile-ui-check`.

## Flujo: cruzar Dispatch con el taller

### UX-1-001 · "In shop" no significa lo mismo aquí que en el resto de la app
- **Dónde:** filas de Incoming y Departures · `admin-yard-data-boundary-cards.tsx:303-308`
- **Evidencia:** `evidencia/00-dispatch-prod-2026-10-19.webp`, fila 608 "In shop · Shop Work" (observado). En el código, la regla es solo `truck?.openWorkOrder ? yardInShopPhase : yardNotInShop` (inferido del código).
- **Criterio:** Nielsen H4 (consistencia y estándares).
- **Severidad:** 3. Lo ve cada día el Manager. D49 dice que In shop es estar en la yard **y** tener WO abierta; aquí basta con tener WO, aunque el camión esté en la carretera. Un camión que está en la yard sin WO sale "Not in shop", que suena a "no está aquí".
- **Recomendación:** usar la regla de D49 (`truckPlace`). Los estados posibles: In shop · fase / In yard · desde / ciudad donde está / sin GPS.
- **Esfuerzo:** M

### UX-1-002 · Números de camión en blanco, sin link y sin explicación
- **Dónde:** filas y chips · `admin-yard-data-boundary-cards.tsx:300-302`, `shopChip` 226-228; emparejado exacto en `yard-data-boundary.service.ts:81`
- **Evidencia:** 975, 972 y 974 en blanco (observado). Pasa cuando el número que manda Dispatch no está en la tabla `trucks` (inferido del código).
- **Criterio:** Nielsen H1 (visibilidad del estado) y H9 (diagnosticar y recuperarse).
- **Severidad:** 3. El dueño no entendió por qué esos números no se abren, y la app no ofrece cómo arreglarlo.
- **Recomendación:** decir "Not in Shop app". Si Samsara tiene ese vehículo, ofrecer "Add from Samsara" (crea el camión con número, VIN, marca, modelo, año y placa, y lo conecta). Emparejar números normalizados, no exactos.
- **Esfuerzo:** M

### UX-1-003 · Incoming lista como "por llegar" camiones que ya llegaron
- **Dónde:** tarjeta Incoming Trucks · `yard-data-boundary.ts` `mapIncomingTrucks`
- **Evidencia:** 836, 838, 845… con Return Date Oct 19 aparecen en Incoming y a la vez en "301 Yard" de Dispatch status (observado).
- **Criterio:** Nielsen H2 (coincidencia con el mundo real) y H1.
- **Severidad:** 2. El Manager tiene que cruzar dos tarjetas para saber quién falta.
- **Recomendación:** si Samsara lo ve en la yard, mostrar "Arrived · In yard since…" y bajarlo al final. Arriba quedan los que faltan. En Departures, lo mismo con "Left".
- **Esfuerzo:** S

### UX-1-004 · "Dispatch status" parece la ubicación real, pero es texto que Dispatch escribe a mano
- **Dónde:** tarjeta Dispatch status · `WorkLocationItems`; fuente `trucks.yard_location` de agent-reporting
- **Evidencia:** "301 Yard · 28" frente a 82 camiones dentro de nuestros geofences según Samsara el mismo día (observado). El dueño: "no entiendo de dónde sale esa info".
- **Criterio:** Nielsen H1 y H2 (de dónde viene el dato y qué significa).
- **Severidad:** 3. Hay dos verdades sobre dónde está un camión, y la tarjeta no dice cuál es cuál.
- **Recomendación:** reemplazarla por "Where trucks are · Samsara" (In shop / In yard / Outside N). Lo que escribió Dispatch queda como aviso solo cuando no coincide.
- **Esfuerzo:** M

### UX-1-005 · El texto de arriba niega algo que ya existe
- **Dónde:** `yardOperationsPhase1Body` · `admin-messages-catalog.ts:1111`
- **Evidencia:** "These are not the Shop's Ready to Go, GPS presence, or dispatch confirmation." (observado).
- **Criterio:** Nielsen H2.
- **Severidad:** 2.
- **Recomendación:** "Dispatch reports the expected arrivals and departures. Where each truck is comes from Samsara GPS."
- **Esfuerzo:** S

## Decisiones del dueño (2026-10-19)
- Los que ya llegaron se marcan **Arrived**.
- **Dispatch status** se cambia por la tarjeta de Samsara.
- Los camiones que faltan se agregan **con los datos de Samsara**.
- Todo va en el PR 378. Queda registrado en **D50**.

## Para otras skills
- 03 (contenido): "Not in shop" y "In shop" chocan con D49 (UX-1-001); el texto de arriba (UX-1-005).
- 06 (estados): falta un estado para "sin GPS" o "no conectado a Samsara" en las filas.

## Resumen
5 hallazgos, 3 de severidad 3. El patrón que se repite: la pestaña mezcla lo que dice Dispatch con lo que sabe el taller, sin decir de dónde sale cada dato.
