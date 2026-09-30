# Historias de usuario, flujos y casos límite

**Actualizado:** 2026-09-29 (auditoría LTR-174 + cuestionario de operación)

Este documento dice **qué quiere lograr cada persona, cómo lo hace en la app
paso a paso y qué pasa en los casos raros**. Cada historia está comprobada
contra el sistema real, no contra lo que creemos que hace.

- Cómo funciona por dentro (estados, permisos): [`SYSTEM.md`](SYSTEM.md).
- Por qué se decidió así: [`DECISIONS.md`](DECISIONS.md).
- Lo que está roto y en qué orden se arregla: [`OPEN_ISSUES.md`](OPEN_ISSUES.md).

## Cómo leerlo

| Marca | Significa |
|---|---|
| ✅ | Comprobado: funciona como dice aquí. |
| ❌ | Comprobado: **falla**. Lleva el número de defecto y su ticket. |
| 👁 | Solo se puede comprobar mirando la pantalla (no entra en la auditoría automática). |
| 🔲 | **No está construido.** El taller lo necesita o hay que decidirlo. Lleva su ticket. |

La columna **Fila** es el número de la prueba que lo comprueba
(`apps/api/test-real/`, resultados en `apps/api/test-real/results/matrix.md`).
Si cambias un flujo, cambias su prueba y esta tabla en el mismo PR.

**Resultado de la auditoría:** 61 comprobaciones · 59 funcionan · 0 fallan
· 2 no aplican.

**Resultado del cuestionario de operación** (Cristian, 2026-09-29): 12
respuestas confirman lo construido y 7 muestran huecos (sección 7).

---

## 1. Qué quiere lograr cada persona (jobs to be done)

| # | Quién | Cuando… | Quiero… | Para… |
|---|---|---|---|---|
| J1 | Manager | llega un camión al taller | abrirle su trabajo en un paso y saber qué hay que hacerle | que nadie pierda tiempo preguntando qué sigue |
| J2 | Manager | hay trabajo que repartir | decidir quién hace cada cosa | que cada mecánico sepa lo suyo y nada quede sin dueño |
| J3 | Manager | algo detiene un camión | enterarme enseguida, con el motivo | destrabarlo sin ir a buscar al mecánico |
| J4 | Manager | el trabajo está hecho | revisar, cerrar y devolver el camión a servicio | que el camión vuelva a producir |
| J5 | Manager | miro el taller completo | ver cada camión, en qué paso va y qué le falta | decidir prioridades sin abrir camión por camión |
| J6 | Mecánico | llego al turno | ver solo lo que me toca a mí | trabajar sin planear ni crear órdenes |
| J7 | Mecánico | estoy trabajando | marcar lo que termino y que mi tiempo quede registrado | que se sepa qué hice y cuánto tardé |
| J8 | Mecánico | algo me detiene | avisar con el motivo | no quedarme esperando sin que nadie sepa |
| J9 | Mecánico PM | hago un mantenimiento preventivo | registrarlo en minutos: millaje, partes, listo | dejar el servicio documentado y el odómetro al día |
| J10 | Admin | hubo un error de tiempo o de estado | corregirlo dejando rastro | que el historial siga siendo confiable |
| J11 | Safety (QC) | un camión terminó su trabajo | revisarlo y aprobarlo, o devolverlo con lo que encontré | que ningún camión salga sin el visto bueno de Safety |
| J12 | Manager | entra un camión o un mecánico nuevo | darlo de alta yo mismo en la app | no depender de nadie para empezar a trabajar |

**Quién usa qué:** los mecánicos, en el teléfono. El Manager, en el teléfono
(caminando por el taller) y en la computadora. Idioma: mezclado, así que
inglés y español tienen que estar completos los dos.

**No es trabajo de esta app:** despachar cargas, nómina, permisos por
autoservicio, reemplazar un sistema completo de flotas.

---

## 2. Manager

### HU-M1 · Recibir un camión (J1)

**Función:** crear Work Order.

**Flujo**
1. Admin → **Work Orders** → **New Work Order** (o desde el Truck sin Work
   Order: el siguiente paso ofrece **New Work Order**; antes puede registrar
   la inspección de llegada).
2. Elige el **Truck**. Opcional: prioridad y una nota.
3. **Create**.

**Resultado:** el Work Order nace con los cuatro pasos obligatorios (PM,
Alignment, Detailing, Quality Check), cada uno con su responsable por defecto.
Quality Check nunca lleva responsable. El siguiente paso dice "inspeccionar".

| ¿Qué pasa si…? | Respuesta | Estado | Fila |
|---|---|---|---|
| Todo normal | Nace con los 4 pasos y sus dueños | ✅ | A1 |
| El camión ya tiene un Work Order abierto | No deja crear otro | ✅ | E1 |
| Se toca "Create" dos veces (red lenta) | No se duplica: devuelve el mismo | ✅ | E2 |
| El camión no existe o la prioridad es inválida | Rechaza con aviso | ✅ | E1 |
| El responsable por defecto está inactivo | El paso nace "Unassigned" y el siguiente paso lo marca | ✅ | A25 |
| El camión está Ready to Go (cerrado, sin Return to Service) | Deja abrir otro; el camión deja de estar Ready to Go | ✅ | E14 |
| …y ese Work Order nuevo | Empieza con la inspección pendiente, como cualquier visita nueva | ✅ | E14b |
| Se agrega trabajo a un camión sin Work Order | Crea el Work Order completo con ese trabajo | ✅ | E12 |

### HU-M2 · Inspeccionar y anotar hallazgos (J1)

**Función:** inspección en el Truck.

**Flujo**
1. Admin → **Trucks** → el camión. Arriba está el **siguiente paso**.
2. En la inspección elige **No issues found** o **Issues found**.
3. Con hallazgos: **Add work**, elige cada Job del catálogo y en
   **"Who does it?"** quién lo hace.

**Resultado:** sin hallazgos, el siguiente paso pasa a "trabajar". Con
hallazgos, cada Job extra queda en el plan con su dueño.

| ¿Qué pasa si…? | Respuesta | Estado | Fila |
|---|---|---|---|
| Sin hallazgos | Queda registrado; sigue "trabajar" | ✅ | A2 |
| Con hallazgos, un Job con dueño y otro sin dueño | El siguiente paso pide asignar el que falta, por nombre | ✅ | A3 |
| Quiere cambiar a "No issues found" con hallazgos ya en el plan | No deja; primero hay que cancelar esos Jobs | ✅ | E13 |
| Agrega dos veces el mismo Job de catálogo | No deja repetir | ✅ | A24 |
| Agrega un Job que no está en el catálogo (Custom) | Lo acepta y lo marca "pendiente de revisión" | ✅ | A24 |
| …y repite el nombre (aunque cambie mayúsculas o espacios) | No deja repetir | ✅ | A24 |
| Quiere revisar o mapear ese Custom Job | **No existe la función** | ❌ #3 · decisión P5 | A24 |
| Se cancela la visita y se abre otra | El Work Order nuevo empieza con la inspección pendiente | ✅ | A15c |

### HU-M3 · Repartir el trabajo (J2)

**Función:** un dueño por Job.

**Flujo**
1. En el Work Order, cada Job tiene su selector de mecánico (tabla
   `Job · Mecánico · Estado · Acción`).
2. Elige, cambia o quita el dueño. En el Truck (Work Plan) el selector solo
   aparece en los Jobs **sin dueño**: es el paso "asignar".

**Resultado:** el equipo del Work Order son los mecánicos que tienen al menos
un Job. Un Job sin dueño no lo puede hacer nadie.

| ¿Qué pasa si…? | Respuesta | Estado | Fila |
|---|---|---|---|
| Asigna, reasigna y quita dueño | El equipo se actualiza solo | ✅ | A4 |
| Cambia el dueño de un Job que ya está en curso | El reloj del mecánico anterior se detiene y ya no puede completarlo | ✅ | E8 |
| Asigna un mecánico PM a un Job normal, o al revés | No deja | ✅ | E9 |
| Asigna a una cuenta de administrador o a un usuario inactivo | No deja | ✅ | E9 |
| Asigna un dueño a Quality Check | Solo acepta a alguien de Safety | ✅ | E9b |
| Queda un Job sin dueño | Aparece en "Needs attention" y en el siguiente paso | ✅ | A3, A20 |

### HU-M4 · Destrabar un camión (J3)

**Función:** resolver bloqueos y pausar.

**Flujo (bloqueo de un mecánico)**
1. El aviso aparece en **Dashboard → Needs attention**, en el Truck y en el
   Work Order, con motivo, quién y cuándo.
2. **Resolve**, con nota opcional.

**Flujo (problema de todo el camión)**
1. Work Order → **Pause** (arriba, junto al título) → el diálogo pide el motivo.
2. Cuando se resuelve: **Resume**.

**Resultado:** al resolver, el Job vuelve a "Pending". El reloj del mecánico
**no** arranca solo: corre cuando él toca Continue.

| ¿Qué pasa si…? | Respuesta | Estado | Fila |
|---|---|---|---|
| Resuelve un bloqueo | El Job vuelve al mecánico; su tiempo espera a Continue | ✅ | A7 |
| Pausa con dos mecánicos trabajando | Se detienen los dos relojes; Resume reabre los de esos mismos dos | ✅ | A8 |
| Pausa un Work Order que nadie ha empezado | No deja | ✅ | A8 |
| Pausa con motivo "otro" sin nota | No deja | ✅ | A8 |
| Un mecánico intenta pausar o resolver | No puede | ✅ | A7, A8 |
| Cancela un Job que estaba bloqueado | El bloqueo se resuelve solo ("Job cancelado") | ✅ | A16c |
| Completa él mismo un Job bloqueado | El bloqueo se resuelve solo ("completado por el Manager") y queda en el historial | ✅ | A16b |
| Cancela un Work Order con un bloqueo | Todos sus bloqueos se resuelven solos | ✅ | A15b |

### HU-M5 · Revisar, cerrar y devolver a servicio (J4)

**Función:** Quality Check, Close, Return to Service.

> El Quality Check lo hace **Safety** desde su pantalla (HU-QC1). El Manager
> conserva "Mark QC complete" como respaldo.
>
> **Return to Service se hace cuando el camión sale del patio**, horas o días
> después de cerrar. Por eso un camión pasa tiempo en Ready to Go, y los
> defectos #4 y #7 pegan más de lo que parecía.

**Flujo**
1. Cuando solo falta Quality Check, el camión aparece en la lista de Safety.
   El siguiente paso del Manager dice "esperando Quality Check" y ofrece
   **Mark QC complete** como respaldo.
2. Después ofrece **Close Work Order**. El camión pasa a **Ready to Go**.
3. **Return to Service** (motivo opcional), desde el Truck, el Work Order o
   la tarjeta del Yard. El camión sale del tablero.

| ¿Qué pasa si…? | Respuesta | Estado | Fila |
|---|---|---|---|
| Flujo normal | Safety aprueba → Close → Ready to Go → Return to Service | ✅ | QC2, A14 |
| Safety devuelve el camión | Aparece en Needs attention como "Devuelto por Safety", con la nota; el Manager agrega el trabajo y resuelve; el camión vuelve a Safety | ✅ | QC3 |
| Safety no puede entrar; el Manager marca QC él mismo | Funciona como respaldo | ✅ | QC5, A13a |
| Cierra con Jobs pendientes | No deja | ✅ | A13a |
| Completa Jobs él mismo desde Admin | Los completa (menos el PM, que se termina desde su pantalla) | ✅ | A12 |
| **Solo trabajó el mecánico PM y el Manager completó el resto** (caso WO-009) | Se cierra igual que cualquier otro | ✅ | A13b |
| Completa un Job en un Work Order que nadie empezó | El Work Order pasa a "en curso" | ✅ | A12b |
| Devuelve a servicio con el Work Order abierto o cancelado | No deja | ✅ | A14, E15 |
| Devuelve a servicio dos veces | No deja | ✅ | A14 |
| Mira la **lista** de Trucks o de Work Orders con un camión Ready to Go | Las dos dicen "Return to Service", igual que el Truck y el Yard | ✅ | A19b |
| Cancela todos los Jobs pendientes | El Work Order se puede cerrar | ✅ | E16 |
| **Salida urgente:** el camión tiene que salir sin terminar todo | Con autorización del Manager: cancela con motivo los Jobs que no se harán y cierra | ✅ | E16 |
| El camión vuelve por algo que quedó mal | Se abre un Work Order nuevo (no se reabre el anterior) | ✅ | A17, E14 |

### HU-M6 · Cancelar y reabrir (J4, J10)

**Función:** Work Order → menú **…** (arriba, junto a Pause): Cancel Work Order, Reopen, Return to Service. Cancelar o reabrir un Job: el **…** de su fila en la tabla de Jobs.

| ¿Qué pasa si…? | Respuesta | Estado | Fila |
|---|---|---|---|
| Cancela un Work Order (con motivo) | Se detienen relojes y pausa; el camión queda libre; pasa a History | ✅ | A15 |
| Cancela sin motivo | No deja | ✅ | A15 |
| Cancela un paso obligatorio (ej. Alignment) | El paso cuenta como "no aplica" y no se vuelve a pedir | ✅ | A16 |
| Reabre un Job cancelado | Vuelve a pendiente, con su dueño | ✅ | A16 |
| Reabre un Work Order completado | Vuelve a "en curso"; los Jobs siguen hechos; se puede volver a cerrar | ✅ | A17 |
| Reabre un Work Order cancelado que nunca empezó | Vuelve a "created" con la inspección de esa visita; el mecánico puede hacer Start | ✅ | A17 |
| Reabre cuando el camión ya tiene otro Work Order abierto | No deja | ✅ | A17 |
| Reabre uno que nunca empezó y tiene todo hecho | Se puede cerrar | ✅ | A17b |
| Cancela o cierra algo ya completado o ya cancelado | No deja | ✅ | E15 |
| Dos Managers cambian el mismo Work Order a la vez | Gana el primero; el segundo recibe aviso y no pisa nada | ✅ | E3 |

### HU-M7 · Ver el taller completo (J5)

**Función:** Dashboard y Yard Operations.

| Qué | Respuesta | Estado | Fila |
|---|---|---|---|
| "Needs attention" | Ordena: pausados, bloqueados, con Jobs sin dueño, abiertos hace más de 24 h, y al final el resto. Cada uno con su siguiente paso | ✅ | A20 |
| Prioridad crítica | Sube al principio | ✅ | E17 |
| Yard por fase | Cada camión con trabajo aparece en su fase. Inspection + In the Shop + Ready to Go suman el tablero; Blocked es un subgrupo | ✅ | A21 |
| Presencia física | Siempre "desconocida"; no se inventa | ✅ | A21 |
| Pestaña Movement | Dice "sin conexión"; no muestra listas falsas | ✅ | A21 |
| Siguiente paso | Truck, Work Order, listas y Yard dicen lo mismo en cada etapa, incluida Ready to Go | ✅ | A19, A19b |
| Pedidos de trabajo de los mecánicos | Aparecen en el Dashboard hasta que se marcan atendidos | ✅ | A22 |

### HU-M8 · Configurar el flujo del taller (J2)

**Función:** Admin → **Setup → Shop workflow**.

| ¿Qué pasa si…? | Respuesta | Estado | Fila |
|---|---|---|---|
| Cambia el responsable por defecto de un paso | Aplica a los Work Orders nuevos | ✅ | A25 |
| Pone dueño a Quality Check | No deja | ✅ | A25 |
| Pone un mecánico normal como dueño de PM, o un usuario inactivo | No deja | ✅ | A25 |
| Un Work Order viejo no tiene todos los pasos | El siguiente paso ofrece "Add missing steps" y los agrega con sus dueños | ✅ | A18 |

---

### HU-M9 · Dar de alta al personal (J12) — ✅ (D22, LTR-187)

**Función:** Admin → **Mecánicos → Agregar**. El Manager (y el System Admin)
crea mecánicos Standard, PM y Safety; la app crea también la cuenta de acceso.

**Flujo**
1. Agregar → nombre, correo, tipo (Standard / PM / Safety) → **Crear**.
2. La app muestra una **contraseña temporal** una sola vez; el Manager se la
   pasa a la persona.
3. La persona entra con correo y contraseña temporal; la app la obliga a
   **cambiarla** antes de seguir.
4. Desde el detalle de la persona el Manager puede **desactivar** (y
   reactivar) y **reiniciar la contraseña**.

En local y en las pruebas de flujo la API no tiene la service key de
Supabase: la persona se crea sin cuenta de acceso y la app lo dice.

| ¿Qué pasa si…? | Respuesta | Estado | Fila |
|---|---|---|---|
| El correo ya existe | No deja; dice que ya hay una cuenta con ese correo | ✅ | A29 |
| Crea un Safety | Aparece en la cola de Quality Check y puede ser dueño de ese paso; no puede tomar Jobs de mecánico | ✅ | A29 |
| Crea un PM | Puede iniciar servicios de PM y ser dueño del paso PM | ✅ | A29 |
| Desactiva a alguien con Jobs pendientes o tiempo corriendo | No deja; la app dice qué reasignar primero | ✅ | A30 |
| Desactiva a alguien sin trabajo abierto | Deja de entrar y de aparecer para asignar; su historial se conserva | ✅ | A30 |
| Reactiva | Vuelve a entrar con su misma contraseña | ✅ | A30 |
| La persona pierde la contraseña temporal | El Manager la **reinicia** desde el detalle: otra contraseña temporal y cambio obligatorio (en local: "sin cuenta de acceso") | ✅ | A31 |
| Un mecánico intenta crear personal | No puede | ✅ | A26 |
| Falla la creación de la cuenta de acceso | No se crea nada; la app avisa y se reintenta | ✅ (unitaria: la API borra la cuenta si falla la fila) | A29 |

---

## 3. Mecánico Standard

### HU-ME1 · Ver lo que me toca (J6)

**Flujo**
1. Entra. La pantalla de inicio es **My Assigned Work**.
2. Abre un Work Order: arriba **Your Jobs**, abajo **Other work on this
   truck** (solo lectura).

| ¿Qué pasa si…? | Respuesta | Estado | Fila |
|---|---|---|---|
| Tiene Jobs en un camión | Ve ese Work Order, con solo sus Jobs como suyos | ✅ | A5 |
| No tiene Jobs en un camión | No lo ve en su lista ni puede abrirlo | ✅ | A5 |
| Le cancelan su único Job | Deja de ver ese Work Order | ✅ | A16 |
| Intenta crear un Work Order, agregar Jobs, pausar o cerrar | No puede | ✅ | A26 |
| Intenta entrar a Admin | No puede | ✅ | A26 |

### HU-ME2 · Trabajar y terminar (J7)

**Flujo**
1. **Start** (o **Continue**). Su reloj empieza a correr.
2. Toca cada Job para completarlo.
3. Al terminar el último ve **"Terminaste tu parte"** y su reloj se detiene.

| ¿Qué pasa si…? | Respuesta | Estado | Fila |
|---|---|---|---|
| Hace Start | El Work Order pasa a "en curso" y corre su reloj (solo el suyo) | ✅ | A6 |
| Completa un Job y le queda otro | Su reloj sigue | ✅ | A6 |
| Completa el último | Su reloj se detiene; el Work Order **no** se cierra | ✅ | A6 |
| Completa sin haber hecho Start | No deja: primero Start | ✅ | E6 |
| Completa un Job que ya estaba completado | No deja | ✅ | E6 |
| Completa el Job de otro | No deja | ✅ | A5 |
| Hace Start donde no tiene Jobs, o cuando ya terminó los suyos | No deja | ✅ | E5 |
| Tiene trabajo en dos camiones a la vez | Puede pasar de uno a otro sin que nadie lo reasigne. **Decidido (D21): al hacer Start en el segundo se detiene el reloj del primero.** Hoy corren los dos | 🔲 LTR-188 | E7 |
| Almuerzo o descanso | No detiene su tiempo; al taller no le importa | ✅ | — |
| Falta o se va a mitad de turno | Sus Jobs esperan a que vuelva; el Manager puede reasignar uno si urge | ✅ | A4, E8 |
| El Work Order está pausado, cerrado o cancelado | No puede trabajar en él | ✅ | A8, E15 |

### HU-ME3 · Avisar que algo me detiene (J8)

**Flujo**
1. En su Job: **Report blocker**, elige el motivo, nota opcional.
2. Puede agregar notas al bloqueo ("ya llegó la pieza").
3. Espera. Cuando el Manager resuelve, ve **"Resolved · tap Continue"**.

**Motivos válidos:** esperando partes, aprobación, proveedor, equipo, bahía,
conductor, otro.

| ¿Qué pasa si…? | Respuesta | Estado | Fila |
|---|---|---|---|
| Reporta un bloqueo | El Job queda "Blocked". El Work Order **no** se pausa ni suma tiempo de espera | ✅ | A7 |
| Era su último Job disponible | Su reloj se detiene | ✅ | A7 |
| Intenta completar el Job bloqueado | No deja | ✅ | A7 |
| Reporta un segundo bloqueo en el mismo Job | No deja: uno a la vez | ✅ | A7 |
| Elige "descanso", "fin de turno", "otro camión" o "camión no disponible" | No son bloqueos; no deja | ✅ | E10 |
| Bloquea el Job de otro, o uno ya terminado | No deja | ✅ | E10 |
| Intenta resolver él mismo | No puede: solo el Manager | ✅ | A7 |
| Después de resuelto intenta completar sin tocar Continue | No deja: primero Continue | ✅ | A19 |

### HU-ME4 · Dejar notas y pedir trabajo (J7)

**Flujo:** en el Work Order, escribe una **nota** o un **Request Work**
(trabajo extra que encontró).

| ¿Qué pasa si…? | Respuesta | Estado | Fila |
|---|---|---|---|
| Deja una nota o un pedido | Quedan con su nombre; el pedido llega al Dashboard del Manager | ✅ | A22 |
| El Manager lo marca atendido | Sale del Dashboard y queda la fecha | ✅ | A22 |
| Nota vacía | No deja | ✅ | A22 |
| No tiene Jobs en ese camión | No puede escribir | ✅ | A22 |
| El Work Order ya está cerrado | No deja (ni a él ni al Manager) | ✅ | A22 |

---

## 4. Mecánico PM

### HU-PM1 · Registrar un mantenimiento preventivo (J9)

**Flujo**
1. Inicio → **Create PM service** → elige el Truck.
2. Anota el **millaje observado**.
3. Elige las **partes** usadas (solo aparecen las que sirven para ese
   camión). Las notas se guardan solas.
4. **Finish**.

**Resultado:** el PM queda completado, el odómetro del camión se actualiza y
queda el registro del cambio. El Work Order sigue abierto para los demás pasos.

| ¿Qué pasa si…? | Respuesta | Estado | Fila |
|---|---|---|---|
| El camión ya tiene Work Order abierto | Se une a ese; no crea otro | ✅ | A9 |
| El camión no tiene Work Order | Crea el Work Order completo con los 4 pasos | ✅ | A10 |
| Arranca el PM | El PM queda suyo aunque el dueño por defecto fuera otro | ✅ | A9 |
| Arranca el PM y nadie más ha hecho Start | El Work Order pasa a "en curso"; su reloj corre y se detiene al terminar | ✅ | A9b |
| Millaje menor que el del camión | No deja | ✅ | E11 |
| Millaje con un salto de más de 50 000 | Pide confirmar | ✅ | E11 |
| Finish sin millaje o sin partes | No deja | ✅ | E11 |
| Ya tiene un PM en curso en otro camión | No deja empezar otro hasta terminar | ✅ | A11 |
| Cambia de PM A a PM B | Cambia el mismo Job; nunca quedan dos PM | ✅ | A11 |
| Algo lo detiene | Bloquea su PM; no puede terminarlo hasta que el Manager resuelva | ✅ | A11 |
| Quiere cambiar algo de un PM terminado | Solo lectura | ✅ | E11 |
| Un mecánico normal intenta hacer un PM | No puede | ✅ | A26 |
| Daniel (el único que hace PM) no está | Los camiones esperan en el paso PM. Si urge, el Manager cancela el PM con motivo (salida urgente) | ✅ | A16, E16 |
| El PM no cambia ninguna parte | Nunca pasa; la app exige al menos una parte | ✅ | E11 |
| Work Orders de PM del modelo viejo | Ya no se pueden crear y en producción no queda ninguno abierto (consultado el 2026-09-29: 0). No aplica | ✅ | A28 |

---

## 5. Safety

### HU-QC1 · Aprobar o devolver un camión (J11)

**Quién:** las dos personas de Safety, con cuenta propia.

**Flujo**
1. Entra y cae en **Quality Check**: la lista de camiones donde todo lo demás
   ya está hecho, con qué se hizo y quién.
2. **Tomar** un camión.
3. Revisa. **Aprobar**, o **Devolver** escribiendo qué encontró.

| ¿Qué pasa si…? | Respuesta | Estado | Fila |
|---|---|---|---|
| Un camión todavía tiene trabajo pendiente | No aparece en la lista; tampoco se puede tomar | ✅ | QC1 |
| Los dos toman el mismo camión | Gana el primero; el otro lo ve como tomado | ✅ | QC2 |
| Aprueba | El QC queda a su nombre; el Manager ve "listo para cerrar". Safety no registra tiempo | ✅ | QC2 |
| Devuelve sin decir qué encontró | No deja | ✅ | QC3 |
| Devuelve con nota | Pasa a "Devueltos"; el Manager lo ve como bloqueo "Devuelto por Safety" con la nota; nadie lo puede tomar hasta que el Manager resuelva | ✅ | QC3 |
| El Manager agrega el trabajo y los mecánicos lo terminan | El camión vuelve a la lista, para cualquiera de los dos | ✅ | QC3 |
| Intenta cerrar, asignar, inspeccionar o entrar a Admin | No puede | ✅ | QC4 |
| Un mecánico o el Manager intenta usar la lista de Safety | No pueden | ✅ | QC4 |
| Un mecánico elige el motivo "Devuelto por Safety" | No se le ofrece y la API lo rechaza | ✅ | QC4 |
| El Manager asigna el QC a alguien de Safety | Puede; esa persona lo ve como suyo | ✅ | QC5, E9b |
| Idioma | La pantalla existe en inglés y español | 👁 revisado 2026-09-29 | — |

---

## 6. Admin

### HU-A1 · Corregir sin romper el historial (J10)

| ¿Qué pasa si…? | Respuesta | Estado | Fila |
|---|---|---|---|
| Corrige la hora de una sesión de trabajo cerrada | El total se recalcula y queda en el historial con el motivo | ✅ | A23 |
| Corrige sin motivo | No deja | ✅ | A23 |
| Corrige una sesión que sigue abierta | No deja | ✅ | A23 |
| Un mecánico intenta corregir tiempos | No puede | ✅ | A23 |
| Quiere saber de qué mecánico es cada sesión | Cada sesión lleva su mecánico; "History and audit" muestra el tiempo por mecánico y el selector de corrección dice de quién es cada una | ✅ | A23 |

### HU-A2 · Catálogo y personal

| Qué | Respuesta | Estado | Fila |
|---|---|---|---|
| Crear o editar Jobs de catálogo y mecánicos | Solo la cuenta System Admin, y hoy **sin pantalla** | ✅ (sin pantalla: fuera de alcance) | A26 |
| El Manager intenta esas escrituras | No puede | ✅ | A26 |
| Usuario inactivo, desconocido o sin sesión | No entra | ✅ | E4 |

---

## 7. Historias que el taller necesita y no están construidas

Salen del cuestionario de operación. Ninguna se construye hasta que su
decisión esté escrita en [`DECISIONS.md`](DECISIONS.md).

### HU-QC1 · Aprobar un camión (J11) — ✅ construido (D19)

Ahora vive en la sección 5, "Safety".

### HU-ME5 · Mi tiempo se detiene solo si lo olvido (J7) — 🔲 LTR-186

**Hoy:** si el mecánico se va con un Job a medias, su reloj corre toda la
noche. Solo se arregla a mano, después.

**Lo que pide el taller:** que se detenga solo a cierta hora. Por decidir: a
qué hora, y si queda marcado en el historial.

### HU-M9 · Dar de alta al personal (J12) — decidido (D22)

Ahora vive en la sección 2, "Manager". Camiones: fuera por ahora.

### Por decidir — 🔲 LTR-188

| # | Situación del taller | Hoy en la app |
|---|---|---|
| P7 | A veces dos mecánicos trabajan juntos en una tarea | Un dueño por Job; el tiempo del ayudante no se registra |
| P8 | A veces se manda trabajo a un taller externo | No existe; un Job sin dueño sale como problema |
| ~~P9~~ | Decidido (D21): el reloj corre en un solo camión a la vez; al hacer Start en otro se detiene el anterior | Hoy corren los dos: **por construir** (LTR-188) |
| ~~P10~~ | Nunca hay PM sin partes | Correcto como está |
| P11 | El taller también trabaja trailers | Solo camiones |

---

## 8. Lo que solo se comprueba en pantalla

No entran en la auditoría automática. Se revisan a mano antes de salir en vivo
(`GO_LIVE_CHECKLIST_ES.md`).

- Inicio de sesión real, cambio y recuperación de contraseña.
- Idioma (English / Español) y tema (Light / Dark / Auto).
- App instalada en el teléfono: ícono, nombre, barra de estado, zonas seguras.
- Pantallas vacías, de carga y de error.
- Textos: que cada pantalla diga lo que dice este documento.

**Recorrido del 2026-09-29** (teléfono, EN/ES, API real, los 9 escenarios de
demo): ninguna historia se atora. Los 17 hallazgos quedaron arreglados el
2026-09-30 (LTR-189). Lo que confundía está en
[`OPEN_ISSUES.md` §1d](OPEN_ISSUES.md) (W1–W17, LTR-189). Lo que le pega a
una historia:

| Historia | Hallazgo |
|---|---|
| HU-M3 (asignar y completar Jobs) | ~~W1 tarjeta "Jobs" sin jerarquía~~ ✅ (2026-09-30); ~~W2 "Completar" visible antes de tiempo~~ ✅ (2026-09-30) |
| HU-M1 (ver el taller) | ~~W3, W4, W5, W6~~ ✅ (2026-09-30) |
| HU-ME1 (ver lo que me toca) | ~~W11 "Completados" no muestra los Jobs que terminé~~ ✅ (2026-09-30) |
| HU-ME2 (trabajar y terminar) | ~~W12 no hay botón "Completar" visible~~ ✅ (2026-09-30) |
| HU-PM1 (registrar un PM) | ~~W14 "Iniciar" primario con otro PM activo; W15 sin pausa, "Guardado" escondido~~ ✅ (2026-09-30) |
| HU-QC1 (aprobar o devolver) | ~~W16 "Tomar" secundario~~ ✅; ~~W17 dice "Truck" donde el mecánico dice "Unidad"~~ ✅ (2026-09-30) |

---

## 9. Resumen de lo que falla y de lo que falta

| # | Qué falla | A quién le pega | Clase | Ticket | Filas |
|---|---|---|---|---|---|
| 3 | No existe revisión de Custom Jobs | Manager | C | decisión P5 | — |
| W1–W17 | Pantallas que confunden (recorrido 2026-09-29, §8) | Todos | C / E | LTR-189 | — |

**B** bloqueante · **C** confuso · **E** estético. Detalle técnico en
[`OPEN_ISSUES.md`](OPEN_ISSUES.md).

### Huecos de operación (no construido)

| # | Qué falta | A quién le pega | Ticket |
|---|---|---|---|
| G2 | El tiempo olvidado debe detenerse solo | Mecánico, costeo | LTR-186 |
| ~~G5~~ | El Manager da de alta al personal — **hecho (D22, HU-M9, 2026-09-30)**. Camiones: después | Manager | LTR-187 |
| G7 | El reloj corre en un solo camión a la vez (D21) | Mecánico, costeo | LTR-188 |
| G3, G4, G6 | Dos mecánicos en una tarea, taller externo, trailers | Manager | LTR-188 |
