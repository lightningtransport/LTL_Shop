# Ninox en vivo vs. la copia en Supabase

**Fecha:** 2026-10-26 · **Issues:** LTR-262 (Incoming Trucks), LTR-255 (Upcoming Departures) · **Estado:** pedido enviado a quien maneja Ninox; sin cambios en el Shop.

Yard Operations → Dispatch lee la copia de Ninox en Supabase (agent-reporting, `driver_pay` y `returns`). Para saber si las diferencias con Ninox eran del Shop o del dato, leímos Ninox directo y lo comparamos con lo que devuelve agent-reporting el mismo día.

## Conclusión

**El Shop calcula bien; la copia en Supabase está desactualizada.** Agrega filas a veces, pero no actualiza las que cambian.

DriverPay, última asignación por camión (163 camiones con salida desde junio):

| Resultado | Camiones |
|---|---|
| Misma salida y mismo regreso | 116 |
| Misma salida, **otra Return Date en Ninox** | 37 (ej. 601: Ninox 28-nov / Supabase 2-nov; 859: 21-dic / 2-nov; 913: 9-nov / 26-oct; 921: 26-oct / 1-nov) |
| Asignación nueva en Ninox que **no llegó** | 10 (ej. 968 sale el 27-oct) |
| Terminado en Ninox, no en Supabase | 929 |

Efecto en la app (semanas del 26-oct y del 2-nov):

- **Incoming Trucks:** el Shop muestra 55; con Ninox serían 38. Sobran 19 (601, 612, 819, 835, 859, 860, 868, 874, 913, 922, 929, 930, 939, 946, 952, 956, 966, 968, 971); faltan 863 y 881; 889, 890 y 921 tienen otra fecha. El 943 ya coincide.
- **Upcoming Departures:** Ninox tiene 15 salidas hoy o mañana; Supabase 12. Faltan 902, 911 y 968. Más allá de mañana no hay salidas en DriverPay: lo planeado vive en **Schedule_Teams**, que no se copia.
- **Returns pierde notas:** en Ninox, `Return_Date_` trae texto junto a la fecha ("Solo, this will don't show", "NEW DRIVER", "Temporal Driver", "Heavy Work No ETA"). Supabase guarda solo la fecha. Probablemente la vista "Truck returning" filtra con esas notas.
- `as_of` de agent-reporting es la hora de la consulta, no la de la última copia. Hoy no hay forma de saber qué tan vieja está la copia.

## Cómo se comparó (para repetirlo)

Con [MappingTool](https://github.com/lightningtransport/MappingTool) (solo GET), en la Mac del dueño, con su `.env.local` de Ninox. Los dos scripts son locales (no están en el repo de MappingTool) y guardan solo números de camión y fechas en `~/MappingTool/output/shop/`:

1. `node --import tsx src/cli/shopReturns.ts`: lee de Ninox DriverPay (`WD`) y Returns (`S`) completos.
2. `node --import tsx src/cli/shopSupabaseCopy.ts <ruta a apps/api/.env.production.local>`: lee agent-reporting. `driver_pay` exige un ancla de fecha (`out_from`); sin ella responde 400.

Las lecturas de producción las corre el dueño.

Nombres de campo en Ninox en vivo (el data-reporting-kit usa otros):

| Tabla | Campo | Qué es |
|---|---|---|
| DriverPay `WD` | `TruckNumber_` | número de camión |
| DriverPay `WD` | `Truck#` | **id de registro** del camión en Ninox, no el número |
| DriverPay `WD` | `Out Date`, `Return Date`, `Transfer`, `Termination` | iguales al kit |
| Returns `S` | `Truck` | número de camión |
| Returns `S` | `Return_Date_` | fecha **con notas** en texto |
| Returns `S` | `Date` | solo la fecha |

## Pedido enviado (2026-10-26)

Complementa [`pedido-ninox.md`](../proposals/rediseno-pizarra/pedido-ninox.md) (PR 434). El acceso a `returns` que pedía ese documento ya funciona con la llave actual. El mensaje no menciona la app del taller:

> Hola, gracias por el acceso. Te comparto lo que necesitaríamos, a ver qué se puede y en qué tiempos:
>
> **1. Un link de consulta (share) que devuelva JSON**, como el de "off duty", con una fila por camión (toda la flota) y estos campos:
> - Número de camión
> - PM: Last PM Odometer, Last PM Date, Miles From Last PM, Last PM location, Oil change every, NeedPM
> - Alineación y motor: Last Alignment Date, Last Alignment ODO, Miles From Last Alignment, Last Valve Adjustment Odometer, Last DPF Cleaning
> - Inspección anual: Anual Expiration
> - Fechas de la Bay Shop: Air Dryer Filter, PM, Alignment & Tires, Detail, Quality Control
>
> **2. Datos del último PM.** Hay valores que parecen errores de captura, por ejemplo el camión 830 con Last PM Odometer 540. ¿Se pueden revisar?
>
> **3. La copia de Ninox a Supabase.** Comparamos ambos y encontramos diferencias:
> - Cuando una fecha cambia en Ninox, el cambio no llega a Supabase. Por ejemplo, en DriverPay la Return Date del 601 (Ninox 28-nov, Supabase 2-nov), del 913 (9-nov / 26-oct) y del 921 (26-oct / 1-nov). Tampoco llegó la terminación del 929.
> - Faltan asignaciones nuevas, por ejemplo las salidas del 902, 911 y 968.
> - Lo más importante para nosotros es que la copia **actualice también los registros que cambian**, no solo los nuevos. En frecuencia, con una copia temprano en la mañana y otra al mediodía estaríamos bien; si se puede más seguido, mejor. También nos ayudaría que guarde la fecha y hora de la última copia.
>
> **4. Returns.** En Ninox, Return Date trae notas junto a la fecha ("Solo, this will don't show", "NEW DRIVER", "Temporal Driver", "Heavy Work No ETA") y en Supabase solo llega la fecha. ¿Se puede copiar el texto completo? ¿Y qué filtro usa la vista "Truck returning"?
>
> **5. Schedule_Teams.** ¿Se puede copiar también a Supabase? Necesitamos las salidas planeadas (Out Schedule).
>
> **Preguntas:**
> - ¿Cuándo podrían tener el link del punto 1?
> - ¿Hay un límite de consultas por hora para ese link?
>
> Muchas gracias.

## Qué sigue

- Con la respuesta, repetir la comparación. LTR-262 se cierra cuando Incoming Trucks coincide con la vista "Truck returning" de Ninox con datos del mismo día; LTR-255, cuando aparecen las salidas de Schedule_Teams.
- Abierto, decide el dueño: leer Ninox directo (solo GET) en lugar de la copia. Cambia D43 ("Ninox sirvió una sola vez").
