# Preguntas pendientes de la UI (para responder después de la Etapa 8)

**Fecha:** 2026-10-06 · **Rama:** `claude/exciting-lehmann-09883c` · **Linear:** LTR-190

**La Etapa 8 terminó el 2026-10-06** (commits 8.1–8.7 en la rama, sin PR). Estas son las decisiones
que siguen abiertas al terminar la actualización de la UI (Etapa 8,
[`ETAPA8_PLAN.md`](ETAPA8_PLAN.md)). Cada una dice qué hace la app mientras tanto.

**Respondidas por el dueño el 2026-10-06** (se implementan en la Etapa 8.8):

| # | Pregunta | Decisión |
|---|---|---|
| P1 | ¿Son confiables día a día los datos de Dispatch? | Sí. "Leaving soon" (Dashboard, chip y alerta del Yard) y la pestaña Dispatch los siguen usando, marcados como "reported by Dispatch" |
| P2 | ¿Return to Service por lotes desde el Yard? | No hace falta: de a uno, con su diálogo |
| P3 | ¿Inspección desde el Dashboard? | **Dos botones en la fila**: "No issues found" se registra ahí; "Issues found" se registra y abre el Truck con Add work abierto. **Cambia con D41 (2026-10-13, no construido):** la fila tendrá un solo botón, **Start inspection**, que abre la hoja. |
| P4 | ¿Dónde va el bloque Workspaces? | **En el menú lateral**: un grupo "Workspaces" al final, solo para quien también es mecánico (Standard / PM). Sale del Dashboard |
| P5 | ¿Cerrar la WO de un toque? | **Solo en el Dashboard**, como la maqueta (se reabre desde la WO). En la WO y el Truck sigue confirmando (D27 cambiado) |
| P6 | ¿Stepper en el Dashboard o en el Yard? | **Solo en el Truck** (sin cambios): el Dashboard dice el paso en la fila y en el Yard el carril es el paso |

## Diferencias menores aceptadas

Lo que quedó distinto de las maquetas al cerrar cada pantalla. Ninguna cambia lo que el usuario puede hacer.

- **Marco (8.1):** la marca usa el logo real de Lightning en vez del rayo de la maqueta.
- **Marco (8.1):** en el teléfono el menú sigue en una hoja (botón ☰); la maqueta no define el teléfono.
- **Diálogos (8.2–8.5):** el botón para salir del diálogo dice "Back" (como la maqueta) en los diálogos de la WO; los diálogos compartidos de cerrar y Return to Service conservan su texto anterior.
- **Work Order (8.2):** el aviso en pausa no dice quién pausó ("by Crixcrox"): la pausa oficial no trae su autor en `currentPause`.
- **Truck (8.3):** "Add work" no pone los **dueños por defecto** de PM, Alignment y Detailing en el panel: la web no tiene esa configuración (Setup → Shop workflow); la API los aplica al crear los pasos obligatorios.
- **Truck (8.3):** el aviso "Blocker" del Truck no dice "(+N more)": el Truck solo trae el último blocker reportado.
- **Dashboard (8.4):** "Leaving soon" y "Unassigned" no dicen el paso (PM, Shop Work…): derivarlo para cada fila del resumen es caro en la API (decisión de la Etapa 8.6).
- **Yard (8.5):** las columnas de Dispatch se llaman "Incoming Trucks", "Upcoming Departures" y "Dispatch status" (no "Arriving / Leaving / Where Dispatch has them"): ese texto es compartido con la API y su prueba lo fija (decisión anterior: no traducir "Incoming Trucks").
- **Yard (8.5):** la tarjeta conserva la línea "Dispatch: expected in …" de las llegadas (la maqueta no la tiene; es un dato que ya se usaba).

- **Work Order (G2, después del merge):** "Complete" en un Job pendiente es un botón con borde que dice "Mark complete" (la maqueta lo tiene sin borde, con un check): así se leía como un estado.

## Verificación final (Etapa 8.7)

- e2e completa: 114/114 en Chromium y 114/114 en WebKit (perfil de teléfono, API de prueba).
- Pruebas unitarias del web: 218/218. `test:real` 67/67 en la Etapa 8.6 (la API no cambió después).
- `ui-audit` con Manager y Admin (solo lectura), EN y ES, claro y oscuro, iPhone y escritorio: 27 pantallas
  por combinación, sin scroll lateral ni texto con contraste bajo. Queda: en escritorio el filtro de Repair
  history usa letra de 14 px (en el teléfono es de 16 px, sin zoom).

## Resuelto por el dueño el 2026-10-06

- **Título:** "Truck 918" / "Truck 601", como la maqueta.
- **Marco común:** igual a la maqueta (menú lateral a todo lo alto, migas de pan).
- **API:** se agregan los campos que faltan para las maquetas.
- **Yard:** sin "More filters"; solo la búsqueda y los filtros rápidos.
- **New Work Order:** un diálogo en el Truck.
- **Cerrar la WO:** pide confirmar.
- **"Pause Work Order…":** un atajo en el "…" del Truck.
