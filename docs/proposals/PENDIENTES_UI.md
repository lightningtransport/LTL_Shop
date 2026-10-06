# Preguntas pendientes de la UI (para responder después de la Etapa 8)

**Fecha:** 2026-10-06 · **Rama:** `claude/exciting-lehmann-09883c` · **Linear:** LTR-190

Estas son las decisiones que siguen abiertas al terminar la actualización de la UI (Etapa 8,
[`ETAPA8_PLAN.md`](ETAPA8_PLAN.md)). Cada una dice qué hace la app mientras tanto.

| # | Pregunta | Qué hace la app mientras tanto |
|---|---|---|
| P1 | ¿Son confiables día a día los datos de Dispatch? | Se usan, marcados como "reported by Dispatch": "Leaving soon" (Dashboard, chip y alerta del Yard) y la columna Dispatch |
| P2 | ¿Return to Service por lotes desde el Yard? | De a uno, con su diálogo |
| P3 | ¿Inspección desde el Dashboard (botones "No issues / Issues found" en la fila) o solo un enlace al Truck? | Enlace al Truck ("Go to the inspection") |
| P4 | ¿Dónde va el bloque Workspaces (accesos a las pantallas de mecánico)? | Sigue en el Dashboard |
| P5 | La maqueta del Dashboard cierra la WO de un toque; D27 pide confirmar. ¿Se mantiene D27? | Pide confirmar (D27) |
| P6 | ¿Se repite el stepper de pasos en el Dashboard o en las tarjetas del Yard? | Solo en el Truck |

## Diferencias menores aceptadas

Las que el revisor marque al cerrar cada pantalla de la Etapa 8 se anotan aquí.

- **Work Order (8.2):** el aviso en pausa no dice quién pausó ("by Crixcrox"): la pausa oficial no trae su autor en `currentPause`.
- **Truck (8.3):** "Add work" no pone los **dueños por defecto** de PM, Alignment y Detailing en el panel: la web no tiene esa configuración (Setup → Shop workflow); la API los aplica al crear los pasos obligatorios.
- **Truck (8.3):** el aviso "Blocker" del Truck no dice "(+N more)": el Truck solo trae el último blocker reportado.
- **Dashboard (8.4):** "Leaving soon" y "Unassigned" no dicen el paso (PM, Shop Work…): derivarlo para cada fila del resumen es caro en la API (decisión de la Etapa 8.6).
- **Dashboard (8.4):** la inspección sigue siendo un enlace al Truck, no los dos botones de la maqueta (pregunta P3 abierta).
- **Dashboard (8.4):** el bloque Workspaces sigue donde estaba (pregunta P4 abierta).

## Resuelto por el dueño el 2026-10-06

- **Título:** "Truck 918" / "Truck 601", como la maqueta.
- **Marco común:** igual a la maqueta (menú lateral a todo lo alto, migas de pan).
- **API:** se agregan los campos que faltan para las maquetas.
- **Yard:** sin "More filters"; solo la búsqueda y los filtros rápidos.
- **New Work Order:** un diálogo en el Truck.
- **Cerrar la WO:** pide confirmar.
- **"Pause Work Order…":** un atajo en el "…" del Truck.
