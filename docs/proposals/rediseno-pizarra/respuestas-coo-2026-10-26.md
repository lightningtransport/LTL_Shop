# Respuestas de la COO (2026-10-26)

**Fuente:** correo de Jessica Bennett (COO) al dueño, 26-oct, 11:03 a.m. Copiado tal cual abajo.
**Estado:** pasado a `DECISIONS.md` (P57 cambia, P60–P66). Responde parte de [`flujo-de-trabajo-coo.md`](flujo-de-trabajo-coo.md): secciones 1, 2, 3, 4 y 5.

## El correo

> PM - Daniel
> Alignment/Tires - Tim
> Body Shop - Silvio & Elliot
> Trailer Mechanics - Alejandro 3 & Rey
> Detailers - Cairo, Daniel Salgado, Guillermo, Giusy
> Mechanics - Anthony, Alejandro 1, Alejandro 2, John
>
> Trucks passing through do not get inspections, they only receive the service they are here for.
>
> Every truck should run through Daniel's bay for inspection (even if it doesn't need a PM) if there are fewer than 20 trucks coming down for the week.
> Alignment & detail are done at every check in.
> PM is done if it has more than 30k since the last PM. Fuel filters should be changed at every check in if a PM is not being performed.
> Notate all cosmetic damage on the inspection form as well. (so we can document new damages)
> I want mechanics to complete their job notes before moving to the next job. Please make completing job notes before changing jobs required.

## Lo que define, y qué significa para la app

**Marcas:**
- ✅ = la app ya lo hace hoy.
- ✏️ = cambio en algo que existe.
- 🆕 = nuevo.
- ❓ = falta una respuesta (sección 4).

| # | Regla de la COO | En la app | Estado |
|---|---|---|---|
| 1 | **Equipos:** PM Daniel · Alignment/Tires Tim · Body Shop Silvio y Elliot · Trailer Mechanics Alejandro 3 y Rey · Detailers Cairo, Daniel Salgado, Guillermo, Giusy · Mechanics Anthony, Alejandro 1, Alejandro 2, John | PM, Alignment, Detailing y la cola de generales ya existen como equipos (Setup → Shop workflow) ✅. Hay que dar de alta a quien falte (Tim, Silvio, Rey, Alejandro 3 y los 4 detailers) | ✅ + datos |
| 1b | **Body Shop** como especialidad | No existe como equipo ni columna. Habría que sumarlo como especialidad, con su cola y su columna en la pizarra | 🆕 ❓ |
| 1c | **Trailer Mechanics** | **La app no maneja trailers**: solo camiones. Está anotado como pendiente con bloqueo (LTR-56) | ❓ |
| 2 | **Los camiones de paso no se inspeccionan**; solo reciben el servicio por el que vienen | La plantilla "de paso" no trae inspección ni pasos fijos. Encaja con lo propuesto | ✏️ (RP-1) |
| 3 | **Todo camión pasa por la bahía de Daniel para inspección** (aunque no lleve PM), si esa semana vienen **menos de 20 camiones** | Daniel puede inspeccionar con el permiso "Can inspect trucks" (D41) ✅. Lo nuevo: la inspección se le asigna a Daniel y depende del número de camiones que vuelven esa semana. Ese número sale de Arrivals, que hoy no coincide con Ninox porque la copia en Supabase está atrasada (PR 435, pedido a Ninox enviado) | ✏️ 🆕 ❓ |
| 4 | **Alignment y Detail en cada check in** | Plantilla "fin de contrato": Alignment y Detailing siempre | ✏️ (RP-1) |
| 5 | **PM si tiene más de 30,000 millas desde el último PM; si no, Fuel filter en cada check in** | Cambia la regla que había dicho el dueño (aviso en 30,000, decidir hasta 40,000). Ver conflicto A | ✏️ ❓ |
| 6 | **Anotar todo daño cosmético en la hoja de inspección**, para documentar daños nuevos | La hoja de 53 puntos no tiene una sección de daños cosméticos. Hay que agregarla (dónde y qué) y que cada inspección muestre los daños de la anterior, para saber cuál es nuevo. Las fotos están anotadas para más adelante (SQ-4) | 🆕 ❓ |
| 7 | **Notas obligatorias antes de pasar al siguiente trabajo** | Hoy la nota al completar es opcional. Cambio: Complete pide la nota, y el mecánico no puede tomar ni empezar otro trabajo con uno completado sin nota | ✏️ ❓ |

## Conflictos con lo que ya estaba decidido

**A. PM.**
- El dueño había dicho: menos de 30,000 millas → Fuel filter; de 30,000 a 40,000 es un aviso y se decide; 40,000 o más → PM.
- La COO dice: **más de 30,000 → PM**, sin zona de decisión.
- Coincide con lo que dice Ninox ("Oil change every 30,000").
- **Recomendación:** seguir la regla de la COO, que es más simple y no deja decisiones abiertas. Confirmarlo con el dueño (P57).

**B. Notas obligatorias contra "un toque".**
- El rediseño buscaba que el mecánico no llene formularios.
- La COO pide la nota antes de cambiar de trabajo. Es su decisión y se respeta.
- **Propuesta para que no pese:** un solo campo de texto al completar, corto, con dictado del teléfono.
- Falta saber qué tiene que decir la nota y si aplica también a Detailing y al PM (pregunta 6).

**C. Detailers.**
- El dueño decidió que los detailers no ponen su nombre (P50–P52). La lista de la COO es el equipo y no lo contradice.
- Pero si las notas son obligatorias también en Detailing, la nota queda a nombre del equipo, no de la persona.

## Preguntas para la COO (borrador del correo, en inglés)

> Hi Jessica, thanks, this answers most of what we needed. A few follow-ups so we build it right:
>
> 1. **PM:** so the rule is simply PM at more than 30,000 miles since the last PM, and fuel filter only below that, with no judgment zone up to 40,000?
> 2. **Inspection with 20 or more trucks coming that week:** who inspects them then, or are they not inspected?
> 3. **"Check in":** does it mean every truck that comes back at the end of a contract? Do unplanned arrivals that are not passing through count as check ins too?
> 4. **Quality Check (Safety):** which trucks need it: every check in, only some, or also trucks passing through?
> 5. **Body Shop:** should it be its own column on the board, with its own list for Silvio and Elliot? Does body work come from the cosmetic damage found in the inspection?
> 6. **Job notes:** what should a note say at minimum? Does it apply to detailers and to the PM too? If a job is blocked (waiting for parts), does the mechanic also need a note before moving on?
> 7. **Cosmetic damage:** is a written description per area enough, or do you need photos? Should the form show the damages from the previous inspection, so new ones stand out?
> 8. **Trailers:** the app only handles trucks today. Should trailer work (Alejandro 3 and Rey) be included now, or later?
> 9. **Air dryer filter, valve adjustment and DPF cleaning:** when are they done?

## Qué cambia en el plan

- **RP-1 (Work Order con lo que aplica):** las plantillas ya tienen contenido.
  - **Fin de contrato:** inspección por Daniel (si son menos de 20 en la semana), Alignment, Detailing y PM o Fuel filter (regla de 30,000).
  - **De paso:** solo lo que viene a hacer, sin inspección.
  - Sigue abierto si llevan Quality Check (pregunta 4).
- **RP-2 (pantalla del mecánico):** nota obligatoria al completar, y no se toma otro trabajo con uno sin nota.
- **Nuevo, sin parte asignada todavía:**
  - Body Shop como especialidad.
  - Daños cosméticos en la hoja de inspección.
  - Contar los camiones que vuelven en la semana para la regla de los 20 (depende de que la copia de Ninox se actualice: PR 435, LTR-262).
- **Fuera por ahora:** trailers, hasta que la COO responda la pregunta 8.
