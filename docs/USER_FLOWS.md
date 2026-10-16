# Historias de usuario, flujos y casos límite

**Actualizado:** 2026-10-16 (D45 propuesta: J22–J26 y HU-M19 repuestos, stock y llantas, sin construir); antes 2026-10-15 (LTR-113: Make / Model se normalizan, fila A110); antes 2026-10-14 (HU-M18 alta de camiones y conectar Samsara construida, D44, filas A98–A109); antes 2026-10-14 (HU-M14 y HU-M15 Samsara construidas, filas A91–A97); antes 2026-10-13 (D41 construida: J20–J21, HU-M16 hoja de inspección, HU-ME7 el mecánico inspecciona, HU-M17 editar la hoja y dar el permiso; filas A82–A88. D42: J15–J19, HU-M14 flota con ubicación y fallas de Samsara, HU-M15 fallas → Jobs recomendados; no construidas)

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

**Resultado de la auditoría (2026-09-29):** 61 comprobaciones · 59 funcionan · 0 fallan
· 2 no aplican. Desde entonces se sumaron filas hasta A110; la cuenta al día la da
`npm run test:real --workspace=@ltl-shop/api`.

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
| J13 | Manager | compro partes o pago una reparación afuera | cargarla con su factura y asignarla al camión | saber cuánto cuesta cada camión y, después, cobrarle a Finanzas lo que hace el taller |
| J14 | Manager | cierro el mes | mandarle a Finanzas lo que el taller hizo por cada camión (partes, talleres externos y mano de obra) | que el taller cobre su trabajo sin armar la cuenta a mano |
| J15 | Manager | reviso la flota | ver dónde está cada camión y cuáles traen fallas graves (Samsara) | decidir qué camión llamo al taller primero |
| J16 | Manager | planeo el trabajo de un camión | que sus fallas activas me aparezcan como Jobs sugeridos | no olvidar reparar lo que el camión ya reportó |
| J17 | Mecánico | trabajo un Job que vino de una falla | ver el código y qué significa | diagnosticar sin buscar en otro sistema |
| J18 | Manager | se terminó el trabajo de una falla | saber si la falla se fue o volvió | no dar por reparado algo que sigue fallando |
| J19 | Mecánico PM | anoto las millas del tablero | ver lo que dice Samsara como referencia | detectar un tablero o un sensor mal |
| J20 | Manager o mecánico con permiso | inspecciono un camión que llega | recorrer la misma hoja de siempre (53 puntos y 10 llantas) y que cada defecto quede como trabajo | no olvidar nada ni escribir dos veces lo que encontré |
| J21 | Manager | miro un camión | ver la presión y el tread de sus llantas y si empeoraron desde la última vez | reparar o cambiar a tiempo, antes de que falle en la ruta |
| J22 | Manager | cargo una factura de un proveedor | decir, línea por línea, si es para un camión (y su Job) o para el taller | saber después qué compré, para qué y cuánto costó cada trabajo |
| J23 | Manager | voy a comprar o un mecánico pide una parte | ver qué hay en el taller y qué se está acabando | no comprar dos veces ni quedarme sin lo que más se usa |
| J24 | Manager | se usa algo del taller en un camión | que salga del stock y cueste a ese camión una sola vez | que el costo por camión y la factura a Finanzas digan la verdad |
| J25 | Manager | una inspección encuentra llantas malas | que el Job ya diga qué llanta va en cada posición (nueva o recap) y si la tengo | cambiarla ese mismo día sin escribir nada dos veces |
| J26 | Manager | llegan muchas facturas de proveedores | cargarlas rápido, y más adelante que se lean solas y yo solo confirme | dejar de teclear facturas enteras |

Cada historia se puede recorrer con el **modo demo local** (D36, [`reference/DEMO.md`](reference/DEMO.md)): el panel cambia de cuenta sin cerrar sesión y guía cada HU paso a paso; el **Demo flow** encadena los pasos de las HU en 14 capítulos (un día del taller). En el panel las historias se muestran con títulos en lenguaje de usuario y agrupadas por quién las hace; el guion vive en `apps/web/src/lib/demo/scripts.ts` y usa estos mismos ids (J y HU) como clave: mantenerlos estables.

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
   Order: el siguiente paso, o el "…", ofrece **New Work Order**, que abre un
   diálogo con prioridad y nota, crea el WO y deja al Manager en el Truck;
   antes puede registrar la inspección de llegada).
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

> **Reemplazada por D41 (construido):** la inspección es la hoja de 53 puntos y 10 llantas, y los defectos crean los Jobs solos (HU-M16). Los dos botones ya no existen; Add work sigue para el trabajo que no salió de la inspección. Las filas de abajo siguen valiendo para Add work.

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
| Quiere que ese Job quede en el catálogo | Al crearlo marca "Agregar también al catálogo": entra como Job de catálogo (D25) | ✅ | A36 |
| Quiere revisar los Custom Jobs (Job Catalog → **Custom Jobs to review**) | La bandeja los agrupa por categoría y nombre (sin importar mayúsculas, tildes ni espacios), con cuántas veces se usaron, en qué Work Orders y los Jobs del catálogo que se parecen | ✅ | A76 |
| …y uno es en realidad un Job del catálogo | **Unir:** todo el grupo queda ligado a ese Job del catálogo de una sola vez; el nombre viejo queda como alias para la próxima vez. La historia de los Work Orders no cambia | ✅ | A77 |
| …y es un trabajo que se repite y falta en el catálogo | **Agregar al catálogo:** crea el Job (con el nombre del grupo o uno corregido) y le liga todo el grupo; un nombre que ya existe no se acepta y propone unir | ✅ | A78 |
| …y fue un trabajo de una sola vez | **Dejar como único:** sale de la bandeja sin tocar el catálogo. Si se equivocó, **Deshacer** lo devuelve a la bandeja | ✅ | A79 |
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
| Mira la **lista** de Trucks o de Work Orders con un camión Ready to Go | Las dos dicen "Return to Service", igual que el Truck y el Yard (en Work Orders, la tarjeta y la columna Siguiente de la tabla; DM1) | ✅ | A19b |
| Cancela todos los Jobs pendientes | El Work Order se puede cerrar | ✅ | E16 |
| **Salida urgente:** el camión tiene que salir sin terminar todo | Con autorización del Manager: cancela con motivo los Jobs que no se harán y cierra | ✅ | E16 |
| El camión vuelve por algo que quedó mal | Se abre un Work Order nuevo (no se reabre el anterior) | ✅ | A17, E14 |

### HU-M6 · Cancelar y reabrir (J4, J10)

**Función:** Work Order → menú **…** (arriba, junto a Pause): Correct time…, Reopen, Cancel Work Order. **Return to Service** está en el aviso del siguiente paso cuando el WO está completado (Etapa 8). Cancelar o reabrir un Job: el **…** de su fila en la tabla de Jobs.

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
| Pedidos de trabajo de los mecánicos | Aparecen en el Dashboard hasta que se marcan atendidos (se marcan ahí mismo) | ✅ | A22 |
| Cola del Dashboard (Etapa 3) | Todo lo que espera al Manager, agrupado por acción, incluidos los Ready to Go, sin corte en 8; cada fila se hace ahí (D26). Contadores que filtran | 👁 | e2e `next-step-in-place`, `admin-shell` |
| Sale pronto y no está listo | Salidas de Dispatch de hoy o del siguiente día hábil, cruzadas con WOs abiertas | 👁 | unit `dashboard-queue.spec.ts` |

### HU-M8 · Configurar el flujo del taller (J2)

**Función:** Admin → **Setup → Shop workflow**.

| ¿Qué pasa si…? | Respuesta | Estado | Fila |
|---|---|---|---|
| Cambia el responsable por defecto de un paso | Aplica a los Work Orders nuevos | ✅ | A25 |
| Pone dueño a Quality Check | No deja | ✅ | A25 |
| Pone un mecánico normal como dueño de PM, o un usuario inactivo | No deja | ✅ | A25 |
| Un Work Order viejo no tiene todos los pasos | El siguiente paso ofrece "Add missing steps" y los agrega con sus dueños | ✅ | A18 |
| El dueño de un paso cambia de tipo o se desactiva, y después cambia otro paso | Guarda; el dueño que ya no puede hacer el paso se ve marcado y los WOs nuevos dejan ese paso sin asignar | ✅ | A37 |
| Intenta desactivar el Job de un paso | No deja; dice que primero cambie el paso. Si ya estaba inactivo, Shop workflow lo marca como "no se agrega a los WOs nuevos" | ✅ | A38 |
| Sale de la pantalla con cambios sin guardar | Pregunta antes de salir; la fila cambiada se marca | 👁 revisar en pantalla | — |
| Pone **varias personas** en Detailing (D28) | El Job nace en la cola del equipo; todos lo ven en su inicio ("Team queue") y el primero que lo toma queda como dueño | ✅ | A41 |
| Hay una sola persona en el equipo | El Job nace asignado a ella, como hoy | ✅ | A42 |
| Uno del equipo toma el Job | Desaparece de la cola de los demás; lo puede soltar ("Let go") y vuelve a la cola, salvo con su reloj corriendo en ese camión | ✅ | A41 |
| El equipo de un paso queda vacío | El Job nace sin dueño, el Dashboard lo marca para asignar y Shop workflow lo avisa; guardar no se bloquea (D-SET1) | ✅ | A43 |
| El paso de PM | Se llama "PM"; el equipo es solo de mecánicos de PM; nace con PM A y el mecánico sigue eligiendo PM A o PM B | ✅ | A44 |

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
| La persona pierde la contraseña temporal | El Manager o el System Admin la **reinicia** desde el detalle: otra contraseña temporal y cambio obligatorio. Si la persona no tenía cuenta de acceso, la crea y la liga (G10). Donde no hay clave de Supabase (local) la app dice "Access accounts are not managed in this environment" y no cambia nada. Un mecánico, PM o Safety no puede | ✅ | A31 |
| Un mecánico intenta crear personal | No puede | ✅ | A26 |
| Falla la creación de la cuenta de acceso | No se crea nada; la app avisa y se reintenta | ✅ (unitaria: la API borra la cuenta si falla la fila) | A29 |
| Mira cuánto trabajo abierto tiene una persona | Cuenta los WOs donde tiene Jobs por hacer, también para PM y Safety | ✅ | A39 |
| Toca Deactivate con trabajo abierto | El diálogo muestra desde el principio qué Jobs reasignar, y Deactivate queda apagado | ✅ | A40 |
| Cambia el tipo de alguien que tiene Jobs pendientes (D-SET3) | No deja: primero se mueven sus Jobs. Sin Jobs, cambia y sale de los equipos que ya no puede hacer (D-SET2) | ✅ | A52 |
| **Quita del Shop** a alguien sin trabajo abierto (D31) | Deja de entrar y de aparecer en listas y equipos; su nombre sigue en el historial; solo se ve con el filtro "Quitadas del Shop" y no se puede reactivar | ✅ | A49 |
| Quita a alguien con trabajo abierto | La app lo dice **antes** de confirmar, dice qué pasa con sus equipos y manda a la cola los Jobs que vinieron de una cola; los demás se reasignan en su Work Order | ✅ | A50 |
| Borra a alguien creado por error, que nunca hizo nada | Se borra de verdad; con cualquier historial no deja y pide quitarlo del Shop | ✅ | A51 |

---

## 3. Mecánico Standard

### HU-ME1 · Ver lo que me toca (J6)

**Flujo**
1. Entra. La pantalla de inicio es **My Assigned Work** (pestañas abajo en el
   teléfono: My work · Trucks · Completed). Arriba, la **franja del reloj** dice
   en qué camión corre ("Your clock · Truck 922 · since 10:45 AM") o que está
   detenido. Hay un solo botón principal: el camión del reloj o el siguiente
   trabajo. Lo bloqueado va aparte ("Blocked · waiting on the Manager") y lo
   que ya terminé, en "Waiting on Manager".
2. Abre un Work Order: arriba el resumen (**Your Jobs N of M done · Your time**,
   solo su tiempo), el bloqueo si hay, **Your Jobs**, y **Other work on this
   Truck** plegado (solo lectura).

| ¿Qué pasa si…? | Respuesta | Estado | Fila |
|---|---|---|---|
| Tiene Jobs en un camión | Ve ese Work Order, con solo sus Jobs como suyos | ✅ | A5 |
| Quiere saber dónde corre su reloj | La franja del reloj lo dice en todas sus pantallas, y la tarjeta de ese camión dice "Clock running" | ✅ | E7 · e2e |
| Quiere saber cuánto lleva en un camión | "Your time" suma solo sus tramos en ese Work Order, todos los días (D-MG2); el total queda para el Manager | ✅ | E7 |
| Busca cuándo terminó un Job y qué nota dejó | Completed lo agrupa por día (hoy, ayer, antes) con la hora y la nota de cierre | ✅ | E7 · e2e |
| No tiene Jobs en un camión | No lo ve en su lista ni puede abrirlo | ✅ | A5 |
| Le cancelan su único Job | Deja de ver ese Work Order | ✅ | A16 |
| Intenta crear un Work Order, agregar Jobs, pausar o cerrar | No puede | ✅ | A26 |
| Tiene **Can inspect trucks** (D41) | Ve **To inspect** en My work y llena la hoja; sus defectos crean Jobs sin dueño. Es la única excepción a A26 (HU-ME7) | ✅ | A86 |
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
| Tiene trabajo en dos camiones a la vez | Puede pasar de uno a otro sin que nadie lo reasigne; al hacer Start/Continue en el segundo **se cierra su reloj en el primero** ("cambio de camión", D21). Al volver al primero toca Continue | ✅ | E7 |
| Vuelve al primer camión | Ve "Tu reloj está en el 944 · toca Continue"; al tocarlo se cierra el del 944 | ✅ | E7 |
| Hace Start en un camión mientras su reloj corre en otro | El aviso dice "Tu reloj pasó de la unidad 604 a la 922" (la respuesta de Start trae `clockMovedFrom`) | ✅ | E7 · e2e bloque A |
| Su reloj no corre en ninguno (terminó su último Job en el otro) | La tarjeta dice "Tu reloj está detenido · toca Continuar", ya no "pasó a otra unidad"; el botón de la tarjeta es **Continue** | ✅ | e2e bloque A |
| Cierra la hoja de "Complete job" con una nota escrita, o se le vence la sesión | La nota queda en el teléfono hasta completar el Job | ✅ | e2e bloque A |
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
| Quiere decir qué pieza falta | Puede escribirlo con cualquier motivo ("What is missing? (optional)"); con "Other" la nota es obligatoria y, si falta, se lo dice junto al campo | ✅ | e2e bloque A |
| Intenta resolver él mismo | No puede: solo el Manager | ✅ | A7 |
| Después de resuelto intenta completar sin tocar Continue | No deja: primero Continue | ✅ | A19 |

### HU-ME4 · Dejar notas y pedir trabajo (J7)

**Flujo:** en el Work Order, escribe una **nota** o un **Request Work**
(trabajo extra que encontró). Lo que escribe y no envía queda en el teléfono
hasta que lo publica con el botón (decisión del 2026-10-07, también para el PM).

| ¿Qué pasa si…? | Respuesta | Estado | Fila |
|---|---|---|---|
| Deja una nota o un pedido | Quedan con su nombre; el pedido llega al Dashboard del Manager | ✅ | A22 |
| El Manager lo marca atendido | Sale del Dashboard y queda la fecha | ✅ | A22 |
| Nota vacía | No deja | ✅ | A22 |
| No tiene Jobs en ese camión | No puede escribir | ✅ | A22 |
| El Work Order ya está cerrado | No deja (ni a él ni al Manager) | ✅ | A22 |
| Lo que encontró fue en la inspección (D41) | No usa Request Work: los defectos de la hoja ya crean Jobs (HU-ME7). Request Work sigue para lo que encuentra mientras trabaja | ✅ | A86 |

---

## 4. Mecánico PM

### HU-PM1 · Registrar un mantenimiento preventivo (J9)

**Flujo**
1. Inicio: el PM en curso arriba; "Waiting for PM" por prioridad y antigüedad, con
   "Next up · Start PM on Truck N" en el primero. O **Create PM service** → elige
   el Truck (el botón dice qué pasa: crear, "Add PM to WO-010", continuar).
2. Anota el **millaje observado**.
3. Elige las **partes** usadas (solo aparecen las que sirven para ese
   camión). El millaje y las partes se guardan solos; las notas se
   publican con **Add Note** y, mientras tanto, quedan en el teléfono.
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
| Ya tiene un PM en curso en otro camión | No deja empezar otro hasta terminar. La pantalla lo dice **antes** de tocar (inicio, Create PM service y el otro camión) y lleva al PM en curso | ✅ | A11 · e2e bloque A |
| Millaje con salto sin confirmar | Las piezas esperan: no se pueden elegir hasta confirmar el millaje (antes se veían elegidas sin guardarse) | ✅ | e2e bloque A |
| Borra el millaje para reescribirlo | No se guarda vacío; queda el último millaje guardado | ✅ | e2e bloque A |
| Se corta la conexión mientras anota | Dice "Not saved"; lo anotado queda en el teléfono (también si sale y vuelve) y se envía solo cuando vuelve la conexión | ✅ | e2e bloque A |
| Activa una pieza | Queda elegida la más usada en camiones de esa marca y modelo ("Most used on this model · 11 of 12 PMs"); sin historial, la elige él (D-PM1) | ✅ | A9c · e2e |
| Busca Finish | Va fijo abajo y dice exactamente qué falta ("Add at least one part", "Confirm the mileage above", "Choose the part for…") o "Ready to finish · 210,000 mi · 1 part"; la confirmación muestra el millaje y las piezas | ✅ | e2e |
| Cambia PM A ↔ PM B | Se aplica al elegir y ofrece "Undo" (D-PM5) | ✅ | A11 |
| Cambia de PM A a PM B | Cambia el mismo Job; nunca quedan dos PM | ✅ | A11 |
| Algo lo detiene | Bloquea su PM; no puede terminarlo hasta que el Manager resuelva | ✅ | A11 |
| Quiere cambiar algo de un PM terminado | Solo lectura | ✅ | E11 |
| Un mecánico normal intenta hacer un PM | No puede | ✅ | A26 |
| El mecánico PM (el único que hace PM) no está | Los camiones esperan en el paso PM. Si urge, el Manager cancela el PM con motivo (salida urgente) | ✅ | A16, E16 |
| El PM no cambia ninguna parte | Nunca pasa; la app exige al menos una parte | ✅ | E11 |
| Work Orders de PM del modelo viejo | Ya no se pueden crear y en producción no queda ninguno abierto (consultado el 2026-09-29: 0). No aplica | ✅ | A28 |

---

## 5. Safety

### HU-QC1 · Aprobar o devolver un camión (J11)

**Quién:** las dos personas de Safety, con cuenta propia.

**Flujo**
1. Entra y cae en **Quality Check** (pestañas *To review · Returned · Done*): los
   camiones donde todo lo demás ya está hecho, **lo más urgente primero** (sale
   pronto según Dispatch → Critical/High → el que lleva más tiempo listo).
2. **Tomar** un camión: se abre su **revisión** con qué se hizo (quién, cuándo y
   la nota de cierre), el PM (millaje y piezas), la inspección, los bloqueos que
   tuvo y las devoluciones anteriores.
3. **Aprobar** (pide confirmar), o **Devolver** escribiendo qué encontró y, si
   quiere, en qué Job. Si no puede seguir, **Let go** lo deja libre para la otra
   persona.

| ¿Qué pasa si…? | Respuesta | Estado | Fila |
|---|---|---|---|
| Un camión todavía tiene trabajo pendiente | No aparece en la lista; tampoco se puede tomar | ✅ | QC1 |
| Los dos toman el mismo camión | Gana el primero; el otro lo ve como tomado | ✅ | QC2 |
| Aprueba | El QC queda a su nombre; el Manager ve "listo para cerrar". Safety no registra tiempo | ✅ | QC2 |
| Devuelve sin decir qué encontró | No deja | ✅ | QC3 |
| Cierra la hoja de devolver con la nota escrita | La nota queda en el teléfono, por camión, hasta devolverlo | ✅ | e2e bloque A |
| Devuelve con nota | Pasa a "Devueltos"; el Manager lo ve como bloqueo "Devuelto por Safety" con la nota; nadie lo puede tomar hasta que el Manager resuelva | ✅ | QC3 |
| El Manager agrega el trabajo y los mecánicos lo terminan | Agregar el trabajo resuelve la devolución sola ("Work added: …", LTR-217); cuando los mecánicos lo terminan, el camión vuelve a la lista, para cualquiera de los dos | ✅ | QC3 |
| El Manager resuelve sin trabajo nuevo (LTR-217) | En la WO, el Truck y el Dashboard la devolución ofrece primero "Add work in the Work Plan"; "Resolve without new work" pide una nota para Safety (sin nota, `QC_RESOLVE_NOTE_REQUIRED`). Safety lee esa nota en la revisión del camión. La nota de Safety se muestra como "Safety: …", no "Mechanic: …" | ✅ | QC13 |
| El Manager toca "Mark complete" en el QC devuelto (LTR-216) | No se completa con un toque: un diálogo muestra el motivo de Safety y ofrece "Add work". "Complete anyway" exige un motivo, y el historial dice que se completó sobre la devolución. Sin confirmación ni motivo, la API lo rechaza (`QC_RETURNED_BY_SAFETY`, `QC_OVERRIDE_NOTE_REQUIRED`) | ✅ | QC12 |
| Intenta cerrar, asignar, inspeccionar o entrar a Admin | No puede | ✅ | QC4 |
| Un mecánico intenta usar la lista de Safety | No puede | ✅ | QC4 |
| Una persona de Safety no está en el equipo de Quality Check (D-SET7) | No ve camiones y la pantalla le dice que pida que la agreguen | ✅ | QC11 |
| Un mecánico elige el motivo "Devuelto por Safety" | No se le ofrece y la API lo rechaza | ✅ | QC4 |
| El Manager asigna el QC a alguien de Safety | Puede; esa persona lo ve como suyo | ✅ | QC5, E9b |
| No hay nadie de Safety y el Manager entra a la lista de Safety (D29) | Entra con una franja "respaldo de Safety"; toma, aprueba o devuelve, y queda a su nombre como respaldo. Llega desde Shop workflow, el Dashboard y el Truck (D-SET6) | ✅ | QC11 |
| Idioma | La pantalla existe en inglés y español | 👁 revisado 2026-09-29 | — |
| Toca Approve | Pide confirmar antes ("Approve Truck 606?") | ✅ | e2e qc-redesign |
| Tomó un camión y no puede seguir | **Let go**: el QC queda libre y la otra persona lo puede tomar; queda en el Activity Log | ✅ | QC6 |
| Quiere saber qué se le hizo | La revisión muestra los Jobs con quién, cuándo y su nota, el PM, la inspección, los bloqueos y las devoluciones anteriores; solo de camiones de su lista | ✅ | QC7 |
| Devuelve diciendo qué Job falló | La nota empieza con el Job ("Alignment: …") y el Manager la ve así | ✅ | QC8 |
| "¿Ya revisé el 606?" | Pestaña **Done**: lo que aprobó o devolvió en 7 días, lo más nuevo primero | ✅ | QC9 |
| Hay un Critical y uno listo hace más tiempo | El Critical va primero | ✅ | QC10 |

---

## 6. Admin

### HU-A1 · Corregir sin romper el historial (J10)

| ¿Qué pasa si…? | Respuesta | Estado | Fila |
|---|---|---|---|
| Corrige la hora de una sesión de trabajo cerrada | El total se recalcula y queda en el historial con el motivo | ✅ | A23 |
| Corrige sin motivo | No deja | ✅ | A23 |
| Corrige una sesión que sigue abierta | No deja | ✅ | A23 |
| Un mecánico intenta corregir tiempos | No puede | ✅ | A23 |
| Quiere saber de qué mecánico es cada sesión | Cada sesión lleva su mecánico; "Labor by mechanic" muestra el tiempo por mecánico y cada tramo de History › Times dice de quién es | ✅ | A23 |

### HU-A2 · Catálogo y personal

| Qué | Respuesta | Estado | Fila |
|---|---|---|---|
| Crear o editar Jobs de catálogo | El Manager y el System Admin, en Admin → Job Catalog (D25) | ✅ | A36 |
| Agrega un Job personalizado y marca "Agregar también al catálogo" | Entra al catálogo y al Work Order como Job de catálogo; la próxima vez se elige de la lista | ✅ | A36 |
| Un Job con el mismo nombre ya está en esa categoría | No deja duplicarlo; ofrece elegir el que existe | ✅ | A36 |
| Un mecánico o Safety intenta escribir el catálogo | No puede | ✅ | A26 |
| Alta y baja de personal | El Manager y el System Admin (D22, HU-M9) | ✅ | A29–A31 |
| Usuario inactivo, desconocido o sin sesión | No entra | ✅ | E4 |
| Busca un Job o un alias por nombre | Encuentra Jobs y aliases de todas las categorías, sin importar tildes ni mayúsculas | ✅ | A47 |
| Se publica una versión nueva | La carga del catálogo base solo agrega lo que falta; no deshace nada del Manager ni duplica | ✅ | A48 |
| Crea, renombra, activa o desactiva una **categoría** (D30) | Puede; una inactiva dice por qué (motivo opcional) y no aparece al agregar trabajo; solo una vacía y nunca usada se borra | ✅ | A45 |
| Agrega o quita un **alias** | Puede; no deja repetir un alias de otro Job y dice de cuál Job y categoría es; las tildes no cuentan; el nombre del Job no se quita | ✅ | A47 |
| Borra un Job que nunca se usó | Se borra | ✅ | A45 |
| Borra un Job que ya está en Work Orders | No se borra; la pantalla dice en cuántos Work Orders está y ofrece desactivarlo | ✅ | A46 |
| Desactiva o borra PM, Alignment, Detailing o Quality Check | No deja (Jobs del sistema). Renombrar el Job no lo saca de su carril ni duplica el paso, y el nombre viejo queda como alias (D-SET4). Las categorías PM, Detailing y Quality Check no se renombran | ✅ | A46 |
| Desactiva un Job que usa un paso obligatorio | No deja (es un Job del sistema) | ✅ | A38 |
| Edita la hoja de inspección (D41) | El Manager y el System Admin, en **Setup → Inspection checklist** (HU-M17) | ✅ | A88 |
| Faltan Jobs para la hoja | Los 7 Jobs (Horn, Radio & Phone, Parking Brake, Seats & Belts, Safety Equipment, Fluid Top-Off, Belts & Tensioners) y los alias entran con la carga del catálogo en cada publicación (D41) | ✅ | prueba unitaria del catálogo |

---

## 7. Historias agregadas después del cuestionario de operación

Salen del cuestionario de operación. Ninguna se construye hasta que su
decisión esté escrita en [`DECISIONS.md`](DECISIONS.md).

HU-QC1 (aprobar un camión, D19) y HU-M9 (dar de alta al personal, D22) nacieron aquí y ahora viven en las secciones 5 y 2.

### HU-ME5 · Mi día de trabajo se cierra solo (J7) — ✅ construido (D20, LTR-186)

**Flujo**
1. El mecánico trabaja en un Job que dura varios días. A las **5:00 p.m.** se va
   sin terminarlo (no tiene pausa, D12).
2. A las 5:00 la app cierra su reloj: el tiempo cuenta hasta las 5:00 y queda
   como "cierre del día" en los tiempos del Work Order.
3. Al día siguiente su inicio dice **"Ayer quedó en curso · toca Continue"**;
   toca Continue y el reloj vuelve a correr.

| ¿Qué pasa si…? | Respuesta | Estado | Fila |
|---|---|---|---|
| El reloj sigue corriendo a las 5:00 p.m. de un día hábil | Se cierra a las 5:00; cuenta hasta las 5:00 | ✅ | A32 |
| Lo olvida el viernes | Se cierra el viernes a las 5:00; no corre el fin de semana | ✅ | A32 |
| Arranca después de las 5:00 (o un sábado) | Se cierra a las 11:59 p.m. de ese día | ✅ | A32 |
| Se fue antes de las 5:00 | El Manager ajusta el tramo con la corrección de tiempo; el cierre se ve como "cierre del día" | ✅ | A32 |
| Al día siguiente | Su inicio le recuerda tocar Continue en ese camión | ✅ | A32 |
| Nadie abrió la app a las 5:00 | Igual cuenta hasta las 5:00 (el cierre se aplica con la hora del cierre, no con la hora en que alguien mira) | ✅ | A32 |
| El Manager cambia la hora o los días en Setup | Aplica desde ese momento | ✅ | A33 |

### HU-ME6 · Mi reloj corre en un solo camión (J7) — ✅ construido (D21, LTR-186)

Ver la fila E7 en HU-ME2.

### HU-M12 · Saber cuánto cuesta cada camión (J13) — ✅ construido (D32, bloque S4: PC-1 a PC-4); el cobro a Finanzas es HU-M13 (D34)

**Quién:** el Manager (y el System Admin). Finanzas no entra a la app: recibe el PDF de HU-M13 (D34).

**Flujo (etapa 1)**
1. **Parts & costs → Parts:** mantiene el catálogo de partes (el mismo del PM), con costo unitario y proveedor.
2. **Purchases:** carga una compra con proveedor, fecha, número de factura, líneas de parte × cantidad × costo y la factura adjunta. Si la compra es para un camión, la asocia a ese camión.
3. **Outside repairs:** carga una reparación hecha fuera del taller con camión, proveedor, fecha, descripción, costo y factura. Si salió desde "Enviar a taller externo" (D24), la asocia a ese Job.
4. **Truck → Costs:** ve el historial de costos del camión, con totales por tipo y por período.

| ¿Qué pasa si…? | Respuesta | Estado | Fila |
|---|---|---|---|
| Le pone a una parte su costo, su proveedor habitual o para qué camiones sirve (PC-1) | Se guarda; el PM de ese camión sigue mostrando las mismas partes y la misma "más usada", y el mecánico nunca ve el costo | ✅ | A53 |
| Quiere desactivar una parte, o quitarle la marca de un camión, mientras está elegida en un PM en curso (PC-1) | No deja y dice en qué camión está; cuando ese PM termina, sí. El mecánico guarda su PM sin error | ✅ | A54 |
| Se vuelve a cargar la lista base de partes (seed) después de que el Manager cambió el catálogo (PC-1) | Solo agrega las partes de la lista que faltan: no apaga ni reactiva nada, no cambia marcas ni costos | ✅ | A55 |
| Carga un proveedor con un nombre que ya existe ("fleetpride") (PC-1) | No deja y dice cuál existe | ✅ | A55 |
| Un mecánico o Safety intenta ver el catálogo con costos o los proveedores | No puede (403) | ✅ | A56 |
| El PM usa una parte | La elige del mismo catálogo; el PM sigue igual que hoy | ✅ | A53 |
| Carga una compra de 3 líneas con impuesto y flete (PC-2) | La app calcula el total; si el total que manda la pantalla no cuadra, no guarda | ✅ | A57 |
| Carga dos veces la misma factura (mismo proveedor y número, sin importar espacios ni mayúsculas) | La app avisa al escribir el número y no deja guardar: dice cuál es y la abre. Anulada la primera, sí se puede cargar (D-PC8) | ✅ | A58 |
| Toca Guardar dos veces, o se repite el envío por mala señal | Se guarda una sola compra | ✅ | A59 |
| Una factura trae partes de dos camiones y otras sin camión | Cada camión recibe sus líneas más su parte del impuesto y el flete; lo sin camión no cuenta en ningún camión; la suma cuadra con el total (D-PC2, D-PC5, D-PC9) | ✅ | A60 |
| Corrige o anula una compra | El costo de los camiones se corrige con movimientos de reversa; nada de lo ya escrito cambia. Anular pide el motivo y no borra nada | ✅ | A61 |
| Agrega el archivo después, o solo cambia las notas | Se guarda sin tocar el costo del camión ni las facturas internas; solo un cambio de dinero, camión o fecha escribe reversas (PCA6) | ✅ | A79 |
| Quiere saber si una compra o un movimiento ya se cobró a Finanzas | El detalle y Truck → Costs dicen "Charged on SHOP-… · Sent" o "Not charged yet"; editar o anular algo facturado avisa que la corrección cae en la factura siguiente (PCA4) | ✅ | A78 |
| Adjunta la factura (PDF, JPG, PNG o HEIC, hasta 10 MB) | Se guarda en un lugar privado y se abre con un enlace que dura 5 minutos. Otro tipo de archivo, o uno más grande, no se acepta. Sin archivo también se guarda, marcada "No invoice file" (D-PC10) | ✅ | A62 |
| Un mecánico o Safety intenta ver o cargar compras | No puede (403) | ✅ | A62 |
| Compra partes para stock, sin camión | Se guarda sin camión (en la etapa 1 no hay stock). Con D45 la línea elige **To stock** o **Shop supplies** (HU-M19, 🔲) | ✅ | A60 |
| Carga la factura de un taller externo por un Job que mandó afuera (PC-3) | La liga al Job (afuera ahora o ya de regreso, sin límite de tiempo) y el monto va al camión; el Job muestra "Factura $… · proveedor" en el Work Order (solo Manager y System Admin), y mientras no tenga factura, "Regresó · sin factura todavía" con la acción para cargarla. Un Job de otro camión no se puede ligar | ✅ | A63, A76 |
| Manda un Job afuera, carga la factura y después marca Regresó (o al revés) | "Enviar a taller externo" y "Regresó" funcionan igual que antes, con o sin factura cargada; la factura sigue ligada al Job | ✅ | A64 |
| Carga como reparación una factura que ya cargó como compra (mismo proveedor y número) | La app avisa y no deja guardar: dice cuál es (D-PC8) | ✅ | A65 |
| Corrige o anula una reparación externa | Igual que una compra: reversas en el costo del camión, nada se borra; anular pide motivo | ✅ | A65 |
| Abre Truck → Costs y elige un período (este mes, 3 meses, este año, todo) (PC-4) | Ve el total de partes, de reparaciones externas y el total; las barras por mes; y cada movimiento (compra o reparación) con su WO, que abre su compra o reparación. Lo anulado o corregido sale como reversa en negativo y baja el total | ✅ | A66 |
| Quiere ver la mano de obra del camión | Las horas registradas en el período (sesiones cerradas, D18, D21) y, con la tarifa del taller (D34), su monto | ✅ | A67, A69 |
| Un mecánico o Safety intenta ver los costos de un camión; un PM se termina | No puede (403); terminar un PM no escribe nada en el costo del camión (D-PC4) | ✅ | A68 |
| Quiere cobrarle a Finanzas | Factura interna por camión y mes con partes al costo, reparaciones externas y mano de obra (HU-M13, D34) | ✅ | A72–A75 |

### HU-M13 · Cobrarle a Finanzas lo que hizo el taller (J14) — ✅ construido (D34: LB-1 tarifa y mano de obra, LB-2 factura interna)

**Quién:** el Manager. Finanzas recibe un PDF, no entra a la app.

**Flujo**
1. **Setup → Labor rate:** pone la tarifa por hora del taller y desde qué fecha vale.
2. Al completar un Work Order, su mano de obra (horas × tarifa) entra al costo del camión. Truck → Costs la muestra.
3. **Parts & costs → Internal invoices:** en "Month close" elige el mes y ve cada camión con lo que tiene sin cobrar; **Create drafts for all** arma los borradores que faltan de una vez (D37), o **New invoice** arma uno solo: camión y mes. Cada borrador trae lo que todavía no se cobró de ese camión hasta fin de mes (compras, reparaciones externas, mano de obra), al costo.
4. Revisa las líneas; puede sacar alguna (queda para la próxima). **Send**: la factura se congela con su número `SHOP-2026-0001` y se descarga en PDF para mandarla a Finanzas.
5. Cuando Finanzas la acepta, el Manager la marca **Accepted**. Si hay un error, la anula y arma otra.

| ¿Qué pasa si…? | Respuesta | Estado | Fila |
|---|---|---|---|
| Se completa un Work Order con 6 h registradas y la tarifa es $95/h | El camión suma $570.00 de mano de obra, con su WO, en Truck → Costs | ✅ | A69 |
| Cambia la tarifa desde una fecha | Lo calculado antes de esa fecha no cambia; los WO completados con sesiones desde esa fecha se recalculan con reversas | ✅ | A70 |
| Antes de guardar la tarifa, o se equivocó al escribirla | La pantalla dice cuántos WO recalcula y cuántos ya están facturados; la última tarifa se puede quitar mientras ninguna factura enviada la use (PCA7) | ✅ | A77 |
| Se reabre o se cancela un WO completado, o se corrige un tiempo | La mano de obra se corrige con reversas; nada de lo escrito cambia | ✅ | A70 |
| No hay tarifa todavía | La mano de obra no tiene monto; Costs muestra las horas y "Set a labor rate" | ✅ | A71 |
| Arma la factura de un camión y un mes | Trae los movimientos no cobrados del período, con subtotales por tipo; cada movimiento se cobra una sola vez | ✅ | A72 |
| La factura trae costos de meses anteriores que nadie cobró | Van aparte, como "Carried over from earlier months" con su subtotal, en pantalla y en el PDF; Send avisa cuánto es (PCA5). Un crédito por una corrección dice de qué factura viene (PCA4) | ✅ | A78 |
| Saca una línea antes de enviar | Queda sin cobrar y aparece en la próxima factura de ese camión | ✅ | A73 |
| Envía la factura | Queda congelada con su número, se descarga en PDF; una corrección posterior va a la del mes siguiente | ✅ | A74 |
| Anula una factura enviada | Sus movimientos quedan libres para otra factura; el número no se reusa | ✅ | A75 |
| Cierra el mes con varios camiones | "Month close" lista cada camión con lo sin cobrar y su factura; "Create drafts for all" arma los que faltan y no repite los que ya tienen factura (D37) | ✅ | A81 |
| Un mecánico o Safety intenta ver la tarifa o las facturas | No puede (403) | ✅ | A75 |

### HU-M14 · Ver la flota con ubicación y fallas de Samsara (J15, J19) — ✅ construido (S-1 a S-4, OPEN_ISSUES §1w–§1x; LTR-202)

**Quién:** el Manager (y el System Admin). El mecánico PM ve solo la referencia de millas.

**Función:** cada hora del día de taller (y una vez de madrugada) la app lee de Samsara millas, ubicación y fallas de todos los camiones; el Manager los ve sin salir de la app. Maqueta: [`proposals/samsara-trucks/mockup.html`](proposals/samsara-trucks/mockup.html), pantallas 1, 2 y 7.

**Flujo**
1. **Trucks:** cada camión muestra "Last location · Samsara" (dirección, hace cuánto, en movimiento o estacionado, link al mapa) y "Faults" (peor severidad y cuántas más). Filtro "With faults"; orden por severidad.
2. Toca el badge de fallas: abre el camión en la pestaña **Faults**. Arriba, banner "2 active faults, 1 with the STOP light".
3. **Faults:** activas (severidad, descripción, código SPN/FMI o DTC, desde cuándo, cuántas veces, qué Job se recomendará) e historial (Fixed in WO-x, Came back, Cleared, Dismissed).
4. En el panel Truck: millas confirmadas en el PM y, debajo, "Samsara 418,612 mi · hace 12 min"; ubicación de Samsara con link al mapa.
5. **PM:** bajo el campo de millas, "Samsara: 150,412 mi · 8 min ago" como referencia; el campo no se precarga. Si difiere en más de 50 mi, aviso ámbar que no bloquea (D35, P12, S4-1).

**Resultado:** el Manager decide qué camión llamar al taller mirando una lista. No hay alerta: basta con la lista (D42).

| ¿Qué pasa si…? | Respuesta | Estado | Fila |
|---|---|---|---|
| Samsara no tiene señal del camión | Se conserva la última lectura y su hora ("hace 4 d"); las fallas quedan como estaban | ✅ | A92 |
| El camión no está emparejado con Samsara | "Not paired with Samsara"; **Setup → Samsara** (S-1) lo lista con el motivo: sin coincidencia, ambiguo o compartido con otro camión. Sin token, la pantalla dice "no conectado" y no escribe nada | ✅ (Setup → Samsara) · 🔲 (ficha) | A91 |
| La sincronización corre dos veces | No duplica nada; nunca cambia las millas oficiales | ✅ | A92, A93 |
| La falla es *pending* (OBD-II) | Se ve en Faults como "Pending"; no se recomienda como Job (S-6) | ✅ (se ve) | — |
| Un mecánico abre el camión | No ve la pestaña Faults (como Costs) ni puede sincronizar; ve la falla solo dentro de su Job (HU-M15, S-6) | ✅ (403) | A91, A94 |

### HU-M15 · Convertir fallas de Samsara en trabajo (J16, J17, J18) — ✅ construido (D42, S-6, OPEN_ISSUES §1x; LTR-202)

**Quién:** el Manager. El mecánico ve la falla en su Job.

**Función:** las fallas activas de un camión se recomiendan como Jobs en **Add work**; el Job queda ligado a la falla y, al terminar, se sabe si la falla se fue o volvió. Maqueta: pantallas 3–6.

**Flujo**
1. En **Trucks** ve el badge STOP del 601 y abre su pestaña Faults.
2. **New Work Order:** la pantalla avisa "This truck has 2 active Samsara faults"; la WO nace solo con el camión (D13).
3. **Add work:** arriba, "Recommended from Samsara faults", cada falla STOP / warning / check engine con su Job **marcado**. Si el código ya se vio, viene con el Job que se usó la última vez; si es nuevo, elige el Job del catálogo (o escribe uno personalizado).
4. Elige quién lo hace y toca **Add 2 Jobs**. Cada Job queda ligado a su falla; la falla dice "In WO-1190" y deja de recomendarse.
5. El mecánico abre el Job y ve "Why: Samsara fault" con descripción, código, luz y veces.
6. Completado el Job: si Samsara deja de reportar la falla, el historial dice **Fixed in WO-1190**; si la reporta otra vez **dentro de 48 h**, **Came back** y vuelve a recomendarse.

**Resultado:** ninguna falla que el camión ya reportó se pierde al planear su trabajo, y el Manager sabe si la reparación sirvió.

| ¿Qué pasa si…? | Respuesta | Estado | Fila |
|---|---|---|---|
| Hay códigos de check engine y la luz STOP encendida | Se recomiendan los de check engine y, por la luz, también los demás códigos activos (J1939 no dice cuál la encendió); nunca los *pending* | ✅ | A95 |
| El código ya tiene Job aprendido | Viene marcado ("Add EGR Service"); al agregar, el Job queda ligado a la falla | ✅ | A96 |
| El camión ya tiene una WO abierta y el Job sugerido ya está en el plan | "Add to that Job": la falla se liga a ese Job, sin duplicarlo | ✅ | A96 |
| Dos fallas piden el mismo Job | Un solo Job, ligado a las dos | ✅ | A96 |
| Intentan ligar una falla que ya está en un Job abierto | Se rechaza (`FAULT_ALREADY_IN_WORK`) | ✅ | A96 |
| Otro camión reporta un código ya aprendido | Viene con el mismo Job sugerido | ✅ | A96 |
| El Manager no quiere hacerla ahora | "Not now" pide razón; sale de recomendados; Faults dice la razón; no vuelve hasta que la falla se cierre y reaparezca | ✅ | A97 |
| Se completa el Job y Samsara deja de reportarla | Historial "Fixed in WO-x" | ✅ | A97 |
| Vuelve dentro de 48 h después de completar el Job | "Came back after WO-x" y se recomienda otra vez | ✅ | A97 |
| Se completa el Job pero Samsara la sigue reportando | Se recomienda de nuevo: "Still reported after WO-x" | ✅ (regla) | — |
| La falla se cierra sola antes de entrar al taller | Sale de recomendados; historial "Cleared" | ✅ | A93 |
| Cancelan el Job ligado | La falla vuelve a recomendarse si sigue activa | ✅ (regla) | — |
| Código nuevo con un Job personalizado | El Job entra a Custom Jobs to review como cualquier otro; el código no aprende (no es del catálogo) | 👁 | — |
| El mecánico abre su Job | Ve "Samsara fault SPN 2659 · FMI 17: …" debajo del nombre | ✅ | A96 |

### HU-M16 · Inspeccionar con la hoja y las llantas (J1, J20, J21) — ✅ construido (D41, IN-1 a IN-6)

**Quién:** el Manager. El mecánico con permiso hace lo mismo desde My work (HU-ME7).

**Función:** la hoja en papel del taller pasa a la app. Reemplaza los dos botones de HU-M2. Maqueta: [`proposals/inspection-checklist/mockup.html`](proposals/inspection-checklist/mockup.html).

**Flujo**
1. Admin → **Trucks** → el camión. El siguiente paso dice **Inspect the truck · Start inspection**. En el Dashboard la fila de inspección tiene el mismo botón (reemplaza los dos botones de UI-P3 de `archive/PENDIENTES_UI.md`).
2. Recorre **Interior** (15), **Engine & fluids** (12) y **Exterior** (26), y marca cada punto **OK, Defect o N/A**. **Mark rest OK** marca lo que falta de una sección.
3. En un **Defect** escribe qué tiene. La hoja muestra qué Job va a crear, o "nota en Detailing" si es de limpieza.
4. **Tires:** toca cada llanta del diagrama (LF, RF, LFO … RRO) y anota **PSI** y **tread /32**. **Next tire** sigue en orden y se ve la lectura anterior. En la computadora también hay una tabla.
5. **Review** se habilita con los 53 puntos, las 10 llantas y la nota de cada defecto. Muestra:
   - **Jobs to create**, con los defectos del mismo Job juntos
   - las notas a pasos que la WO ya tiene
   - **To watch** (llantas cerca del límite)
6. Elige **quién hace** cada Job o deja "Assign later", firma ("I inspected Truck 601") y toca **Save · create N Jobs**.

**Resultado:** los Jobs quedan en Shop Work con su dueño o sin dueño, y el paso Inspection dice "Issues found · N Jobs · quién · cuándo · View report". Sin defectos queda "No issues found" y el camión sigue a PM. La tarjeta **Tires** del camión muestra la lectura y cuánto cambió desde la anterior.

| ¿Qué pasa si…? | Respuesta | Estado | Fila |
|---|---|---|---|
| Quedan puntos sin revisar o llantas sin lectura | **Review** no se habilita; la barra dice cuántos faltan | ✅ | A84 |
| Un Defect no tiene nota | No deja avanzar ("1 defect without a note") | ✅ | A84 |
| Dos defectos piden el mismo Job (p. ej. Fog lamps y Brake lights → Lights) | Se crea **un** Job con las dos notas; el catálogo no acepta repetidos (A24) | ✅ | A82 |
| El Job ya está en la WO | No lo repite; suma la nota a ese Job | ✅ | A85 |
| El defecto es de limpieza (Windows, Interior o Exterior clean) | No crea Job: va como nota al paso **Detailing**, que la WO ya trae (D13) | ✅ | A82 |
| Una llanta a más de ±20 % del objetivo o bajo el tread mínimo | Crea **Flat Repair** (presión) o **Tires** (tread) | ✅ | A82 (presión) |
| Una llanta a ±10–20 % o con el tread cerca del mínimo | "Watch": se ve en el reporte y en Tires, sin Job | ✅ | A82 |
| Deja un Job sin dueño | El siguiente paso de hoy: "Nobody is assigned to Lights · Assign" (A3) | 👁 revisado en pantalla | — |
| Cierra la app a mitad de la hoja | Lo marcado sigue en el teléfono hasta guardar | sin prueba | — |
| Encuentra algo después de guardar | **Add defects** reabre la hoja solo para agregar. El defecto nuevo crea su Job o suma su nota, y el reporte lo marca "Added later · quién · hora" | ✅ | A85 |
| Marcó un defecto que no era | Lo guardado no cambia; cancela ese Job en la WO, con las reglas de hoy | sin prueba | — |
| Quiere cambiar una lectura de llanta ya guardada | No se cambia; si la llanta tiene un problema, marca **Tire condition** como defecto con Add defects | 👁 revisado en pantalla | — |
| Otra persona ya guardó la inspección de esa visita | Al guardar le dice "Already inspected by …"; al volver a abrir ve el reporte con Add defects | ✅ | A83 |
| Se cancela la visita y se abre otra | La WO nueva empieza con la inspección pendiente, como hoy (A15c) | sin prueba | — |
| La visita se inspeccionó con los botones de antes de D41 | Arriba de la hoja: "Recorded before the inspection sheet: Issues found · quién · cuándo"; la hoja se llena igual y al guardarla queda el reporte (IN-8) | ✅ | A90 |

**Construido (2026-10-13):** pruebas `test:real` A82–A85; probado a mano con la app real (OPEN_ISSUES §1v).

### HU-ME7 · Inspeccionar un camión desde My work (J20) — ✅ construido (D41, IN-1 a IN-6)

**Quién:** un mecánico Standard o PM con **Can inspect trucks** encendido en People.

**Flujo**
1. En **My work** aparece **To inspect**, con los camiones que esperan inspección: número, WO y desde cuándo están.
2. **Start** abre la misma hoja de HU-M16.
3. En Review ve los Jobs que se van a crear, con "Manager assigns". Firma y guarda.

**Resultado:** el camión sale de "To inspect". Los Jobs nacen **sin dueño** y el Manager los ve en el Truck ("Nobody is assigned to …") y en el Dashboard (Unassigned). El reporte dice quién inspeccionó: "Luis Ramos (Mechanic)".

| ¿Qué pasa si…? | Respuesta | Estado | Fila |
|---|---|---|---|
| No tiene el permiso | No ve "To inspect" ni puede abrir la hoja (A26 sigue) | ✅ | A86 |
| Le quitan el permiso con la hoja a medias | No la puede guardar (403); lo marcado sigue en el teléfono | sin prueba | — |
| Quiere ver los Jobs que creó | Los ve solo si el Manager se los asigna (A5); el reporte queda en el historial del camión | sin prueba | — |
| Encuentra algo después de guardar | El camión sigue en "To inspect" como "Inspected by you" con **Add defects**, mientras la WO siga abierta; no aparecen los que inspeccionó otro (IN-7) | ✅ | A89 |
| Intenta agregar Jobs fuera de la inspección | No puede (A26) | ✅ | A86 |
| Es de Safety | No tiene el permiso; Safety solo hace QC (QC4, D19) | ✅ | A87 |

**Construido (2026-10-13):** pruebas A86 y A87; probado a mano (Alejandro 2 con el permiso inspecciona el 905).

### HU-M17 · Editar la hoja de inspección y dar el permiso (J2, J12) — ✅ construido (D41, IN-1 a IN-6)

**Quién:** el Manager y el System Admin.

**Flujo (la hoja)**
1. Admin → **Setup → Inspection checklist**.
2. Ve las tres secciones con sus puntos. Cada punto dice qué Job crea un defecto o si va como nota a Detailing.
3. **Add check** pide el nombre y el Job que crea. El "…" de cada punto tiene Rename, Change Job y Deactivate, y se pueden reordenar arrastrando.
4. En **Tires** cambia el PSI objetivo por eje y el tread mínimo.
5. **Save** (barra "Unsaved changes", como el resto de Setup).

**Flujo (el permiso)**
1. Admin → **People** → el mecánico.
2. En **Extra permissions** enciende **Can inspect trucks**.

**Resultado:** la próxima inspección usa la hoja nueva y los umbrales nuevos, y el mecánico ve "To inspect" en su próximo inicio.

| ¿Qué pasa si…? | Respuesta | Estado | Fila |
|---|---|---|---|
| Cambia la hoja con una inspección ya guardada | La guardada no cambia: guarda la lista que usó | ✅ | A88 |
| Cambia la hoja con una inspección a medias | Al guardar avisa que la lista cambió y pide recargar la hoja (INSPECTION_CHECKLIST_CHANGED) | sin prueba | — |
| Un punto apunta a un Job que no está en el catálogo | Lo avisa arriba ("… point to a Job that is no longer active") y se le cambia el Job | sin prueba | — |
| Desactiva un punto | Deja de salir en las inspecciones nuevas y sigue en los reportes viejos | ✅ | A88 |
| Desactiva en el catálogo un Job que usa la hoja | No deja hasta cambiar el Job de esos puntos (igual que con los pasos, A38) | ✅ | A88 |
| Un mecánico o Safety intenta editar la hoja | No puede (como el catálogo, A26) | ✅ | A88 |
| Da el permiso a alguien de Safety | La casilla no aparece; Safety solo hace QC | ✅ | A87 |

**Construido (2026-10-13):** prueba A88; probado a mano en Setup → Inspection checklist.

### HU-M18 · Dar de alta un camión y conectarle Samsara (J12, J15) — ✅ construido (D44, LTR-215)

**Quién:** el Manager y el System Admin.

**Flujo (alta)**
1. Admin → **Trucks** → **Add truck**.
2. Escribe el número (obligatorio) y lo que sepa: VIN, marca, modelo, año, placas, dueño, compañía, dispatcher, aseguradora.
3. **Save.** El camión aparece en Trucks y en New Work Order.

**Flujo (conectar Samsara, cuando el camión ya está en el patio)**
1. En la ficha del camión, **Connect Samsara**.
2. La lista muestra los vehículos de Samsara sin camión; arriba, el que coincide por VIN o número, marcado "Suggested".
3. Elige el vehículo. Si nada difiere se conecta de una vez; si algo difiere, aparece lado a lado ("Yours · Samsara": lo vacío "will be filled", en lo distinto queda lo suyo salvo que elija Samsara).
4. **Connect.** La app sincroniza enseguida: el camión ya tiene millas, ubicación y fallas.

Una propuesta de la sincronización (VIN exacto) se ve en la ficha (banda con **Connect**), en Trucks ("Samsara: proposed") y en Setup → Samsara (**Proposed**, con **Connect**); se conecta de un toque cuando nada difiere.

**Resultado:** un camión nuevo entra al taller sin pasar por Ninox ni por un script, y su ficha queda completa con Samsara.

| ¿Qué pasa si…? | Respuesta | Estado | Fila |
|---|---|---|---|
| Agrega un camión con solo el número | Aparece en Trucks y en New Work Order; las millas no se escriben aquí | ✅ | A98 |
| El número ya existe | No deja guardar y lo dice | ✅ | A99 |
| El VIN ya es de otro camión | Lo avisa con enlace al otro camión | ✅ | A99 |
| Edita la ficha | Cambia solo lo que tocó; lo que borra queda vacío | ✅ | A100 |
| Make y Model al revés, juntos o repetidos ("CASCADIA / Freightliner", "Mack Anthem", "PETERBILT / PETERBILT 579") | Se guardan bien (Freightliner / CASCADIA, Mack / Anthem, Peterbilt / 579) y la marca se escribe de una sola forma; igual al importar de Ninox y al conectar Samsara (LTR-113) | ✅ | A110 |
| La sincronización ve un VIN que coincide exacto | Lo propone en la ficha, en Trucks y en Setup → Samsara; no conecta solo; por número no propone | ✅ | A106 |
| Conecta la propuesta y nada difiere | Se conecta de un toque | ✅ | A109 |
| Connect Samsara | Arriba el que coincide por VIN y luego por número ("Suggested") | ✅ | A103 |
| Algo difiere de Samsara | Pide elegir; lo vacío se llena; trae millas y ubicación enseguida | ✅ | A104 |
| El vehículo de Samsara ya es de otro camión | No aparece en la lista; conectarlo igual se niega | ✅ | A103, A105 |
| Se desconecta Samsara | Deja de sincronizar; las últimas lecturas y las fallas quedan en el historial | ✅ | A107 |
| Samsara deja de listar el vehículo de un camión conectado | Sigue conectado con sus últimas lecturas; Setup → Samsara lo avisa | ✅ | A108 |
| Desactiva un camión con una Work Order abierta | No deja; dice cuál cerrar primero | ✅ | A101 |
| Desactiva un camión sin trabajo abierto | Sale de las listas y de New Work Order; su historial y costos siguen; se reactiva | ✅ | A101 |
| Borra un camión | Solo si nunca tuvo nada; si no, se desactiva | ✅ | A102 |
| Un mecánico o Safety intenta agregar o editar | No puede (403) | ✅ | A99 |

### HU-M19 · Repuestos, stock y llantas (J22–J26) — 🔲 propuesta (D45, sin construir)

**Quién:** el Manager (Randy). El mecánico ve qué parte o llanta va en su Job, nunca su costo.

Las historias completas, con su "¿qué pasa si…?", están en
[`proposals/parts-stock-tires/README.md`](proposals/parts-stock-tires/README.md) §4:

| Historia | Qué | Etapa | Estado |
|---|---|---|---|
| HU-R1, HU-R2 | Catálogo con repuestos y llantas (medida, New o Recap); pasar una línea "Other" al catálogo | ST-2 | 🔲 |
| HU-C1, HU-C2 | Cada línea de compra va a un camión (y, si se quiere, su Job), al stock o a Shop supplies; el Job muestra sus partes | ST-1 | 🔲 |
| HU-S1–HU-S4 | Stock: entra con la compra, sale a un Job, devoluciones, ajustes y reversas; pantalla Stock con "Low" | ST-3 | 🔲 |
| HU-S5 | El PM descuenta del stock | ST-5 | 🔲 (P29) |
| HU-T1–HU-T4 | La inspección propone la llanta (steer New, drive Recap); el Manager confirma y sale del stock; historial por posición | ST-4 | 🔲 |
| HU-F2 | Leer la factura del proveedor (PDF o foto) y confirmar | ST-6 | 🔲 (P30) |

Las filas de prueba se agregan con cada etapa.

### HU-M10 · Poner un ayudante en un Job (J2) — ✅ construido (D23, LTR-188)

**Flujo**
1. Work Order → `…` del Job (por ejemplo "Air Leak") → **Agregar ayudante** → elige al mecánico.
2. La app crea "Air Leak · ayudante" con ese dueño.
3. El ayudante lo ve en "Tus Jobs", toca Start, ayuda y lo completa.

| ¿Qué pasa si…? | Respuesta | Estado | Fila |
|---|---|---|---|
| El ayudante trabaja | Su reloj corre a su nombre en ese Work Order | ✅ | A34 |
| Elige como ayudante al mismo dueño, o a alguien que no puede hacer trabajo Standard | No deja | ✅ | A34 |
| El Job principal se bloquea | El del ayudante sigue; si a él también le afecta, lo reporta | ✅ | A34 |
| El Job principal se cancela | El Manager decide si cancela también el del ayudante (no se cancela solo) | ✅ | A34 |

### HU-M11 · Mandar trabajo a un taller externo (J3) — ✅ construido (D24, LTR-188)

**Flujo**
1. Work Order → `…` del Job → **Enviar a taller externo** → elige **sale la pieza** o **sale el camión** → nota (a dónde, cuándo vuelve).
2. El Job queda "En taller externo": sin dueño, sin reloj, sin alerta de "nadie asignado".
3. Cuando vuelve: **Regresó** → completarlo o asignarlo a un mecánico.

| ¿Qué pasa si…? | Respuesta | Estado | Fila |
|---|---|---|---|
| Un Job está afuera | El camión no puede quedar Ready to Go; el siguiente paso dice "En taller externo: <Job>" | ✅ | A35 |
| Sale el camión | El Yard lo muestra "Fuera del taller" | ✅ | A35 |
| Otros Jobs del mismo camión | Siguen normal | ✅ | A35 |
| El Job tenía dueño y reloj corriendo | Al enviarlo se le quita el dueño y se cierra su reloj en ese Work Order si no le queda otro Job | ✅ | A35 |
| Regresa y hay que instalarlo | "Regresó" → asignar a un mecánico; su reloj corre normal | ✅ | A35 |
| Un mecánico intenta enviarlo afuera | No puede (solo Manager) | ✅ | A35 |

### Decisiones de operación (LTR-188) — todas cerradas

| # | Situación del taller | Hoy en la app |
|---|---|---|
| ~~P7~~ | Decidido y construido (D23, LTR-188): Job aparte para el ayudante | — |
| ~~P8~~ | Decidido y construido (D24, LTR-188): "Enviar a taller externo" (pieza o camión) | — |
| ~~P9~~ | Decidido y construido (D21, LTR-186) | — |
| ~~P10~~ | Nunca hay PM sin partes | Correcto como está |
| ~~P11~~ | Trailers: después de salir en vivo, cuando Cristian lo indique | Solo camiones (LTR-56) |

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
| — | **Nada abierto** (2026-10-09). El #3 (Custom Jobs sin revisar) se cerró con la bandeja de revisión (LTR-57, filas A76–A79) | — | — | — | — |

**B** bloqueante · **C** confuso · **E** estético. Lo pendiente vive en Linear;
resumen en [`OPEN_ISSUES.md`](OPEN_ISSUES.md) e historial en
[`archive/OPEN_ISSUES_HISTORIAL_2026-10.md`](archive/OPEN_ISSUES_HISTORIAL_2026-10.md).

### Huecos de operación (no construido)

| # | Qué falta | A quién le pega | Ticket |
|---|---|---|---|
| ~~G2~~ | El tiempo olvidado se detiene solo — **hecho (D20, HU-ME5, 2026-10-05)** | Mecánico, costeo | LTR-186 |
| ~~G5~~ | El Manager da de alta al personal — **hecho (D22, HU-M9, 2026-09-30)**. Camiones: después | Manager | LTR-187 |
| ~~G7~~ | El reloj corre en un solo camión a la vez — **hecho (D21, HU-ME6, 2026-10-05)** | Mecánico, costeo | LTR-186 |
| ~~G3, G4~~ | Ayudante en un Job y taller externo — **hechos (D23, D24, HU-M10, HU-M11, 2026-10-05)** | Manager | LTR-188 |
| G6 | Trailers — después de salir en vivo (P11) | Manager | LTR-56 |
| G9 | Repuestos fuera del PM, compra atada al Job, stock y llantas desde la inspección — propuesta D45 (HU-M19) | Manager | LTR-220 (ST: LTR-221–226) |
| ~~G8~~ | Datos de Samsara (millas, ubicación, fallas) y fallas → Jobs recomendados — **hecho (D35, D42, HU-M14, HU-M15)** | Manager, mecánico | LTR-202 |
