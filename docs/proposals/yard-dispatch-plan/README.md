# Propuesta: Dispatch para planear la semana

> **Estado (2026-10-21): construida y en producción.** D51 se hizo en LTR-258 (PR 379) y D52 la amplió (LTR-260, PR 381). Cómo funciona hoy: [`SYSTEM.md`](../../SYSTEM.md), en la fila `/admin/yard-operations`, y [`USER_FLOWS.md`](../../USER_FLOWS.md) HU-M22. Esta propuesta queda como referencia de diseño.

**Decisión:** [D51](../../DECISIONS.md), que cambia D50 §3.
**Maqueta:** [`mockup.html`](mockup.html), armada con los datos reales del día 2026-10-19.

## Qué resolvió

El dueño preguntó si la pestaña Dispatch tenía lógica. La respuesta fue darle una sola tarea: **planear la semana**. Dónde está cada camión ahora se movió a los contadores del tablero Shop (*In shop* e *In yard without a Work Order*, D49).

- **Incoming Trucks** muestra por día los camiones que llegan. Primero va lo que pide acción: *Arrived · Needs a Work Order*, con Create WO.
- **Upcoming Departures** muestra por día los camiones que tienen que salir. Primero va *Not ready · N Jobs left* y al final *Left*. Desde D52, un Ready to Go que ya salió de la yard aparece arriba con *Left · Confirm Return to Service*.
- El filtro de Trucks *In yard without a Work Order* sale de los mismos contadores.

## Pendiente

- Departures solo trae las salidas de hoy (LTR-255, LTR-73).
- Incoming todavía no coincide del todo con Ninox (LTR-262).
