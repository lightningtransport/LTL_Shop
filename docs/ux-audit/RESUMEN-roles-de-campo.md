# Resumen: auditoría de las pantallas de Safety, Mecánico General y Mecánico de PM

**Fecha:** 2026-10-07 · **Para:** el dueño · **Estado:** decidido el 2026-10-07: todo como la recomendación. Se empieza por el bloque A.

## Cómo se hizo
- **Método:** se usaron las skills `audit-ux` del equipo, igual que en el Admin:
  - 0 · contexto;
  - 1 · usabilidad (Nielsen);
  - 4 · jerarquía visual;
  - 6 · estados (cargando, error, sin conexión, sesión vencida);
  - 7 · formularios, solo para los mecánicos.
- **Dónde se probó:** la demo local (`ltl_shop_demo`), con las cuentas de prueba de Safety, del mecánico general (Anthony) y del PM (Daniel). Teléfono de 375 px y computadora, claro y oscuro.
- **Cómo se provocaron los fallos:** sin red, error del servidor y sesión vencida se simularon interceptando la API. Producción no se tocó.
- **Detalle completo, con capturas y `archivo:línea`:**
  - [`safety-qc/`](safety-qc/00-contexto.md)
  - [`mecanico-general/`](mecanico-general/00-contexto.md)
  - [`mecanico-pm/`](mecanico-pm/00-contexto.md)

  Los defectos están anotados en `OPEN_ISSUES.md` §1j (Q), §1k (MG) y §1l (PM).

| Rol | Hallazgos | Graves (3) | El problema de fondo |
|---|---|---|---|
| Safety | 18 | 4 | Aprueba sin ver qué se le hizo al camión. |
| Mecánico General | 34 | 1 | No sabe dónde corre su reloj. |
| Mecánico de PM | 26 | 3 | Lo que ve en pantalla no siempre está guardado. |

No hay hallazgos de severidad 4 (que impidan terminar una tarea). Lo que funciona bien en los tres:
- Cargar y fallar al cargar están resueltos con los componentes comunes.
- No hay doble envío.
- Los otros roles no pueden entrar.

---

## 1. Safety (Quality Check)

**Lo grave:**
1. **Aprueba sin ver qué se hizo.** La tarjeta solo trae nombres de Jobs y de mecánicos. No muestra notas, PM, inspección ni bloqueos.
2. **Approve es un toque y no se deshace.** El camión queda listo para cerrar.
3. **Un camión tomado no se puede soltar.** Si Safety lo toma y se va, queda trabado hasta que el Manager reasigne.
4. **Si la sesión vence mientras escribe la devolución, la nota se pierde.**

**Lo demás:**
- La lista ordena por la apertura de la WO, no por urgencia.
- No hay historial de lo aprobado.
- Al devolver no se puede decir qué Job falló.
- Esc borra lo escrito.
- Sin conexión salen dos avisos rojos encima de la lista.
- Los Jobs cambian de orden entre cargas.
- La pantalla no usa los componentes de la Etapa 8.

**Qué haría:** la propuesta que ya viste (`docs/proposals/qc-screen-redesign/`). La auditoría la confirmó y le agregó Q9 (borrador), Q10 (sin conexión) y Q11 (orden). Faltan tus decisiones D-QC1 a D-QC7.

---

## 2. Mecánico General

**Lo grave:**
1. **El inicio no dice en qué camión corre el reloj.** Solo avisa cuando se detuvo. El mecánico puede creer que su tiempo se registra y no es así.

**Lo demás, en historias:**
- **El reloj:**
  - Si toca Start en otro camión, el reloj del primero se cierra sin aviso.
  - Después de terminar su último Job, el otro camión dice "Your clock moved to another Truck · tap Continue", pero el reloj no corre en ninguno. **Esto es un error de texto: el aviso miente.**
  - El aviso dice "tap Continue" y el botón de la tarjeta dice "View Work".
  - "Labor time · running" suma el tiempo de todos los mecánicos, no el suyo.
- **Bloqueos:**
  - Reportar un bloqueo es un select de 7 opciones.
  - Solo deja escribir qué falta si elige "Other".
  - Con "Other" vacío el botón queda gris sin explicar por qué.
  - En el inicio, un Job bloqueado no tiene color y el camión sigue en "In Progress" como los demás.
- **Mensajes equivocados:**
  - Si le quitan sus Jobs, el Work Order dice "You do not have access to this **PM** Work Order."
  - Con la app en español, los errores de Start y de Notas salen en inglés.
- **Lo escrito se pierde:** la nota de cierre y la de bloqueo se borran al cerrar la hoja o si vence la sesión.
- **Jerarquía:**
  - El inicio tiene 4 botones principales iguales.
  - "Other work" pesa lo mismo que "Your Jobs".
  - Con un bloqueo, lo primero que se ve es un campo de texto vacío.

---

## 3. Mecánico de PM

**Lo grave:**
1. **Sin conexión, la pieza o el millaje se ve elegido pero no se guarda.** El aviso sale lejos del campo, el guardado automático se detiene y, al recargar, se pierde.
2. **Si el millaje salta más de 50 000 y no lo confirma, las piezas que elige no se guardan y nada lo dice.** Al recargar desaparecen.
3. **"Finish Work" queda a casi dos pantallas**, detrás de "Service type" y nueve selects iguales.

**Lo demás:**
- **"Un PM a la vez" se descubre al tocar.** Con un PM en curso, tres lugares ofrecen empezar otro como botón principal y después dan error:
  - la tarjeta pausada del inicio;
  - Create PM service;
  - "Start PM service" en otro camión.

  (W14 lo arregló solo en "Ready to Start".)
- **El millaje:**
  - Borrar el campo guarda el millaje vacío.
  - "No puede ser menor" aparece desde el primer dígito y esconde las piezas mientras escribe.
- **Mensajes:**
  - Los errores del servidor salen con el texto crudo de la API.
  - La búsqueda de camión tiene textos fijos en inglés.
- **Lo que falta mostrar:**
  - "Ready to Start" no ayuda a elegir qué camión sigue: no muestra prioridad ni antigüedad.
  - "Completed" no dice cuándo ni con qué millaje se hizo cada PM.
  - La confirmación de Finish no muestra lo que queda registrado.
- **Una diferencia con lo escrito:** HU-PM1 dice "las notas se guardan solas", pero en la pantalla se publican con "Add Note". Lo no enviado se pierde.

---

## 4. Correcciones que haría

Van en tres bloques. En cada uno, primero se anota en `OPEN_ISSUES` (ya hecho) y después se arregla con su prueba. Cada bloque va en un PR que sale de `main`.

### Bloque A · Arreglos sin rediseño (no cambian cómo se ve la pantalla)
Son errores o textos. Se pueden hacer ya, sin maqueta:

| # | Corrección | Rol |
|---|---|---|
| A1 | Con el salto de millaje sin confirmar, las piezas quedan desactivadas con "Confirm the mileage first"; "Confirm mileage" pasa a botón principal del aviso (PM2). | PM |
| A2 | Borrar el millaje no guarda el campo vacío; dice "Enter the mileage" y conserva el último valor (PM3). | PM |
| A3 | El guardado automático no se detiene para siempre después de un error: reintenta al volver la conexión, y el borrador (millaje y piezas) queda en el teléfono hasta que se guarda (PM1). | PM |
| A4 | Con un PM en curso, la tarjeta pausada, Create PM service y "Start PM service" en otro camión dicen "You have a PM in progress on Truck 968" y llevan a ese camión, en lugar de ofrecer empezar (PM5). | PM |
| A5 | Errores del servidor con texto propio, en inglés y en español, en PM, Start y Notas (UX-6-003 PM, MG7); los textos fijos en inglés de la búsqueda pasan a los dos idiomas. | PM, MG |
| A6 | "Your clock is stopped · tap Continue" cuando el reloj no corre en ninguno; el botón de esa tarjeta dice "Continue" (MG3, MG4). | MG |
| A7 | Al hacer Start en otro camión, el aviso dice "Clock moved from Truck 604 to Truck 922." (MG2). | MG |
| A8 | "You have no Jobs on Truck 603 anymore…" con "Back to My work", en lugar del mensaje de PM (MG6). | MG |
| A9 | Report Blocker: el campo "What is missing?" siempre visible (obligatorio solo con "Other"), y el botón explica qué falta en vez de quedar gris (MG8). | MG |
| A10 | Borrador de las notas (cierre, bloqueo, devolución de Safety) guardado por Job hasta enviarse; se recupera al cerrar la hoja o si vence la sesión (MG9, Q9). | MG, Safety |
| A11 | Orden fijo de los Jobs en la lista de Safety (Q11). | Safety |
| A12 | Si el Work Order no carga o ya no existe, la pantalla mantiene la cabecera y ofrece "Back to My work". | MG, PM |

Cada arreglo lleva su prueba e2e de la pantalla. Si toca la API, también su fila de `test:real`.

### Bloque B · Rediseño con maqueta (como QC y el Admin)
Esto cambia cómo se ve la pantalla. Primero se hace la maqueta, tú la apruebas y después se construye:
- **Safety:** la propuesta actual (lista por urgencia, revisión del camión, Approve con confirmación, Let go, Job al devolver, pestañas Returned y Done).
- **Mecánico General:**
  - Una franja fija con el estado del reloj ("Your clock · Truck 922 · since 10:45").
  - Botón principal solo en el camión donde trabaja.
  - Bloqueados aparte, en ámbar.
  - "Your time" en lugar del tiempo de todos.
  - "Other work" compacto.
  - Report Blocker con opciones grandes en lugar del select.
  - Nota y Request Work separados.
- **Mecánico de PM:**
  - Resumen arriba ("Mileage ✓ · Parts 1 of 9").
  - Finish fijo abajo.
  - Las piezas como interruptores con la pieza más usada ya elegida.
  - Campos de solo lectura como texto.
  - "Waiting for PM" con prioridad y antigüedad.
  - Completed con fecha y millaje.
  - Confirmación de Finish con el resumen.

### Bloque C · Común a los tres
- Aviso único de **sin conexión** ("Offline · your changes are not sent"), escuchando cuando vuelve la red, en lugar de los avisos rojos que salen hoy.
- Las tres pantallas pasan a las primitivas de la Etapa 8: `SectionCard`, `CountChip`, `MechanicAvatar` y `PriorityBadge`.

---

## 5. Decisiones (2026-10-07: todas como la recomendación)
1. **D-QC1 a D-QC7** (pantalla de Safety). Mi recomendación está en el README de la propuesta.
2. **Notas del PM (PM6):** ¿se guardan solas, como dice HU-PM1, o se queda el botón "Add Note" y se corrige el documento? Recomiendo **guardar el borrador solo y publicar con el botón**: así no se pierde nada y la nota no sale a medias.
3. **Tiempo del mecánico (MG5):** ¿el mecánico ve solo **su** tiempo y el total queda para el Manager? Recomiendo que sí.
4. **Orden de trabajo.** Mi propuesta:
   1. El **Bloque A** primero, en dos PR (PM y MG/Safety), porque son errores que afectan hoy.
   2. Después, el rediseño de **Safety**, que ya tiene maqueta.
   3. Después, las maquetas del **Mecánico General** y del **PM**, para que las apruebes antes de construir.
