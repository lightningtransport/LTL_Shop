# Pedido a quien maneja Ninox

**Fecha:** 2026-10-26 · **De:** el dueño de Lightning Shop · **Estado:** listo para enviar.

## Cómo vamos a trabajar con Ninox

1. **Ninox sigue siendo la fuente** de lo que ya mantiene. La app del taller lo **consulta**; no lo copia ni lo cambia.
2. **La app del taller registra solo el trabajo del taller** (PM, alineación, trabajos, quién y cuándo). Empieza cuando tenga el **historial inicial** que sale de Ninox.
3. **El historial inicial se lee una vez de Ninox.** Desde ahí, esos registros los hace la app.

Para eso necesitamos:
- un link de Ninox que se pueda consultar (como el de "off duty");
- acuerdo sobre quién mantiene cada dato.

## Quién mantiene cada dato

| Dato | Quién lo mantiene | La app |
|---|---|---|
| Camión: dueño, dispatch/grupo, seguro, VIN, placa, año, marca | **Ninox** | Consulta |
| Ubicación, días en la yard, fuera de la ruta / en la ruta | **Ninox** | Consulta (ya lo hace con "off duty" y "on the road") |
| Return Schedule / camiones que vuelven (fin de contrato) | **Ninox** | Consulta (`returns` y `driver_pay`) |
| Inspección anual (vencimiento) | **Ninox** | Consulta |
| Estado del Kanban (Checked In, Work in Progress…) | **Ninox**, mientras el taller lo siga usando | Consulta. Ver pregunta 3 |
| Último PM: odómetro, fecha, lugar | **Ninox hasta el arranque**; después, **la app** | Lee el historial una vez y registra cada PM nuevo |
| Última alineación, valve adjustment, DPF cleaning | **Ninox hasta el arranque**; después, **la app** | Igual |
| Fechas de Air Dryer Filter, PM, Alignment & Tires, Detail, Quality Control (Bay Shop) | **Ninox hasta el arranque**; después, **la app** | Igual |
| Quién trabaja qué camión, tiempos, Q.C., llaves, Check in | **La app** | Lo registra desde el primer día; no hace falta de Ninox |

## Lo que pedimos

### 1. Un link público de Ninox (share), igual al de "off duty"

Que devuelva JSON con **una fila por camión**, todos los camiones de la flota, y estos campos:

**PM**
- número de camión
- Last PM Odometer
- Last PM Date
- Miles From Last PM
- Last PM location
- Oil change every (miles)
- NeedPM

**Alineación y motor**
- Last Alignment Date
- Last Alignment ODO
- Miles From Last Alignment
- Last Valve Adjustment Odometer
- Last DPF Cleaning

**Inspección anual**
- Anual Expiration

**Fechas de la Bay Shop**
- Air Dryer Filter
- PM
- Alignment & Tires
- Detail
- Quality Control

### 2. Acceso al reporte `returns`

Para la llave de agent-reporting de la app del taller, además de `driver_pay`. Así sale completa la lista de camiones que vuelven.

### 3. Corregir antes del arranque los datos malos del último PM

Por ejemplo, el 830 tiene "Last PM Odometer 540" y por eso Ninox calcula 543,878 millas desde el PM. Lo que se lea mal en el historial inicial queda mal en la app.

## Preguntas para quien maneja Ninox

1. ¿Cuándo pueden crear el link?
2. **Cuando la app empiece a registrar los PM, ¿alguien más en la empresa lee el último PM en Ninox?**
   - Dispatch, por ejemplo, para "Pay Attention PM".
   - Si es así, hay que decidir cómo se mantiene Ninox al día: lo anota alguien a mano, o se agrega después una forma de que la app lo escriba en Ninox. Hoy la app **no escribe** en Ninox.
3. El estado del Kanban (`mechanic_status`): cuando el taller trabaje en la app, ¿quién lo sigue actualizando en Ninox? ¿Lo usan otros equipos?
4. ¿Hay un límite de cuántas veces por hora se puede consultar el link? La app lo consultaría cada pocos minutos.
