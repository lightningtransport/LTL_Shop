# Pedido a quien maneja Ninox

**Fecha:** 2026-10-26 · **De:** el dueño de Lightning Shop · **Estado:** listo para enviar (actualizado con las respuestas del dueño del mismo día).

## Cómo vamos a trabajar con Ninox

1. **Ninox sigue siendo la fuente** de lo que ya mantiene. La app del taller lo **consulta**; no lo copia ni lo cambia.
2. **La app del taller registra solo el trabajo del taller** (PM, alineación, trabajos, quién y cuándo). Empieza cuando tenga el **historial inicial** que sale de Ninox.
3. **El historial inicial se lee una vez de Ninox.** Desde ahí, esos registros los hace la app, y **si Ninox los necesita, los consulta de nuestro lado**. La app no escribe en Ninox.

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
| Estado del Kanban (Checked In, Work in Progress…) | **Ninox hasta el arranque**; después, **la app** | Lo calcula la app. Solo lo usa el taller; quien lo necesite tendrá acceso a la vista de la app (se define después) |
| Último PM: odómetro, fecha, lugar | **Ninox hasta el arranque**; después, **la app** | Lee el historial una vez y registra cada PM nuevo. Solo lo usa el taller. Si Ninox lo quiere, lo consulta de la app |
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

## Decidido por el dueño (2026-10-26)

- **El último PM y la alineación solo los usa el taller.** Después del arranque, la fuente es la app. La app **no escribe** en Ninox: si Ninox necesita esos datos, **los consulta de nuestro lado**. Es la API de solo lectura que ya está planeada (P14, LTR-203).
- **El estado del Kanban solo lo ve el taller.** Después del arranque lo calcula la app. Ninox no tiene que mantenerlo al día. Si otro equipo lo necesita, se le da acceso a esa vista de la app; se define más adelante.

## Preguntas para quien maneja Ninox

1. ¿Cuándo pueden crear el link?
2. ¿Hay un límite de cuántas veces por hora se puede consultar? La app lo consultaría cada pocos minutos.
3. Cuando la app sea la fuente del último PM, ¿Ninox quiere leerlo de nuestro lado? ¿Qué campos y con qué frecuencia? (Para diseñar la API de solo lectura, P14.)
