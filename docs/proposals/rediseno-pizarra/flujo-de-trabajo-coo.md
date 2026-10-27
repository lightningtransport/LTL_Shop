# Flujo de trabajo del taller: lo que falta definir

**Para:** el COO · **De:** el dueño de Lightning Shop · **Fecha:** 2026-10-26 · Versión para imprimir: `Flujo-de-trabajo-COO.pdf`.

## Cómo llenarlo

- Este documento no es sobre pantallas. Es para definir **cómo trabaja el taller**: quién hace qué, en qué orden y con qué reglas. La app se construye sobre lo que aquí se decida.
- Cada sección dice primero **lo que ya está decidido o lo que la app ya hace hoy**, y después **lo que falta definir**. Marca una opción o escribe la regla con tus palabras.
- Las secciones con **▲ Necesario para empezar** son las que frenan los cambios. Las demás pueden esperar.
- Si una regla depende de algo (el cliente, el tipo de camión, el costo), escríbelo. Si algo no aplica en el taller, márcalo como no aplica.

## 1. Cómo llega un camión al taller — ▲ necesario para empezar

_Define cuándo empieza el trabajo de un camión y quién lo registra._

**Lo que ya se sabe**

- Tipos de visita propuestos: **fin de contrato** (vuelve cuando termina la asignación del chofer), **de paso** (entra por algo puntual) y **otro**.
- Ninox ya marca "Checked In" y tiene la lista de camiones que vuelven (Return Schedule).
- Samsara ya avisa cuando un camión entra a la yard (con hasta 1–2 horas de atraso).

**Lo que falta definir**

1. ¿Hay otros tipos de visita además de fin de contrato y de paso?
   ☐ No, son esos dos · ☐ Sí:

2. ¿Qué es "Check in"? ¿Qué se revisa en ese momento (llaves, millaje, daños, documentos)?

3. ¿Quién hace el Check in?
   ☐ Shop Manager · ☐ Cualquier mecánico · ☐ Dispatch · ☐ Otro:

4. ¿Las llaves se entregan siempre en la oficina al llegar?
   ☐ Sí, siempre · ☐ No siempre:

5. Un camión de paso, ¿cómo avisa que viene? ¿Quién avisa y con cuánta anticipación?

## 2. La inspección de llegada — ▲ necesario para empezar

_Define si todo camión se inspecciona, cuándo y quién lo hace._

**Lo que ya se sabe**

- La app ya tiene la hoja de inspección del taller: **53 puntos** (interior, motor y fluidos, exterior) y **las 10 llantas** con presión y tread.
- Cada defecto que se marca crea su trabajo. Hoy la hace el Shop Manager o un mecánico con permiso para inspeccionar.
- Límites de llantas en la app hoy: presión 110 (steer) / 95 (drive) PSI; tread mínimo 4/32 steer y 2/32 drive. En el mínimo se cambia la llanta.

**Lo que falta definir**

1. ¿Qué camiones se inspeccionan?

| | Fin de contrato | De paso | Otro |
|---|---|---|---|
| Inspección completa (53 puntos + llantas) | | | |
| Solo llantas | | | |
| No se inspecciona | | | |

2. ¿Cuándo se hace?
   ☐ Al llegar, antes de cualquier otro trabajo · ☐ El mismo día que llega · ☐ Cuando un mecánico tenga tiempo · ☐ Otro:

3. ¿Quién inspecciona?
   ☐ Shop Manager · ☐ Un mecánico en particular: · ☐ Cualquier mecánico · ☐ Safety

4. Si la inspección encuentra algo que no es del tipo de visita (por ejemplo, un camión de paso con frenos gastados), ¿se repara siempre? ¿Quién lo autoriza?

5. ¿Los límites de llantas de arriba están bien?
   ☐ Sí · ☐ No, los correctos son:

## 3. Qué trabajos lleva cada tipo de visita — ▲ necesario para empezar

_Es la "plantilla": lo que la app sugiere al abrir el trabajo de un camión. El manager puede agregar o quitar._

**Lo que ya se sabe**

- Hoy la app le pone a **todos** los camiones PM, Alignment, Detailing y Quality Check. Eso es lo que hay que cambiar.

**Lo que falta definir**

1. Marca S = siempre · A = a veces (escribe cuándo) · N = nunca

| | Fin de contrato | De paso | Otro |
|---|---|---|---|
| PM o Fuel filter (sección 4) | | | |
| Air Dryer Filter | | | |
| Alineación y llantas | | | |
| Valve adjustment | | | |
| DPF cleaning | | | |
| Reparaciones de la inspección | | | |
| Detailing | | | |
| Quality Check (Safety) | | | |

2. Si el manager quita un trabajo que normalmente va (por ejemplo, no hace Alignment a un fin de contrato), ¿tiene que escribir por qué? ¿Quién puede quitarlo?

3. ¿Hay un orden obligatorio entre trabajos?
   ☐ No, se hacen en cualquier orden; Quality Check al final · ☐ Sí, este orden:

## 4. PM o Fuel filter — ▲ necesario para empezar

_Define qué servicio de mantenimiento lleva cada camión._

**Lo que ya se sabe**

- **Decidido (dueño):** menos de 30,000 millas desde el último PM → solo Fuel filter. De 30,000 a 39,999 es el aviso: se decide según lo cerca que esté de 40,000. 40,000 o más → PM.
- Las millas de hoy llegan de Samsara. El último PM está en Ninox y algunos datos están mal (el 830 dice que el último PM fue con 540 millas).
- La app hoy tiene dos PM: **PM A** y **PM B**, que elige el mecánico de PM.

**Lo que falta definir**

1. Entre 30,000 y 40,000: ¿qué se mira para decidir? (millas que faltan, cuánto va a estar en la ruta, fecha de salida, otro)

2. ¿Quién decide en esa zona?
   ☐ Shop Manager · ☐ Mecánico de PM · ☐ COO · ☐ Otro:

3. ¿Qué incluye el PM? (aceite, filtro de aceite, filtro de combustible, filtro de aire, Air Dryer, engrase, otro)

4. ¿Qué diferencia hay entre PM A y PM B? ¿Siguen existiendo los dos?

5. Si no toca PM, ¿siempre se cambia el Fuel filter?
   ☐ Sí, siempre · ☐ Solo si:

6. Cuando el dato del último PM no es confiable, ¿qué se hace?
   ☐ Se hace PM igual · ☐ Lo revisa el Shop Manager y decide · ☐ Otro:

## 5. Quién hace qué — ▲ necesario para empezar

_Define la especialidad y las tareas de cada persona. Con esto, cada mecánico ve solo los trabajos que le tocan._

**Lo que ya se sabe**

- **Decidido (dueño):** los detailers usan una tablet del equipo, no ponen su nombre, pueden tener varios camiones a la vez y cualquiera termina lo que empezó otro.
- **Decidido (dueño):** el mecánico de PM sigue igual.
- Hoy en Ninox: Alejandro 1, Daniel (PM), Alejandro 2, John, Anthony, Elliot.

**Lo que falta definir**

1. Marca qué hace cada uno (puede ser más de uno)

| | Inspección | PM / Fuel filter | Alineación y llantas | Reparaciones generales | Detailing | Otro |
|---|---|---|---|---|---|---|
| Alejandro 1 | | | | | | |
| Alejandro 2 | | | | | | |
| John | | | | | | |
| Anthony | | | | | | |
| Elliot | | | | | | |
| Daniel | | | | | | |
| Detailers (equipo) | | | | | | |

2. ¿Hay trabajos que solo puede hacer una persona? ¿Cuáles y quién?

3. Shop Manager: ¿qué hace y qué no debería hacer (por ejemplo, no registrar el trabajo de los mecánicos)?

## 6. Cómo se reparte el trabajo — ▲ necesario para empezar

_Define si el mecánico elige su trabajo o se lo asignan, y qué va primero._

**Lo que ya se sabe**

- Propuesta: todo trabajo sin dueño queda disponible para los de esa especialidad; el primero que lo toma lo hace. El manager asigna solo cuando hace falta.
- Hoy la app: un camión lo trabaja **un solo mecánico a la vez** (si alguien lo tiene, los demás esperan).

**Lo que falta definir**

1. ¿El mecánico elige el trabajo?
   ☐ Sí, lo toma de la lista de su especialidad · ☐ No, se lo asigna el manager · ☐ Las dos cosas:

2. ¿Qué va primero? (camión que sale pronto, prioridad marcada, el que lleva más días, otro)

3. ¿Un camión lo trabaja un solo mecánico a la vez?
   ☐ Sí · ☐ No, pueden trabajar varios a la vez · ☐ Depende:

4. ¿El tiempo del mecánico empieza al tomar el trabajo o cuando empieza de verdad (con las llaves)?
   ☐ Al tomar el trabajo · ☐ Al empezar · ☐ No importa

5. Si un trabajo nadie lo toma, ¿después de cuánto tiempo hay que avisarle al manager?

## 7. Partes, aprobaciones y talleres de afuera

_Define qué pasa cuando un trabajo se frena._

**Lo que ya se sabe**

- Hoy en la app, el mecánico marca el bloqueo con un motivo (piezas, aprobación, proveedor, equipo, bahía, chofer, otro) y solo el manager lo resuelve.
- Hoy en Ninox, 13 camiones están en "Heavy Work No ETA" (consulta del 26-oct); algunos con más de 40 días.

**Lo que falta definir**

1. ¿Quién pide las piezas? ¿Quién aprueba la compra?

2. ¿Hay un monto a partir del cual una reparación necesita aprobación? ¿De quién?

3. ¿Qué significa "Heavy Work No ETA"? ¿Quién decide mandar un camión a un taller de afuera (Nextran, otro)?

4. ¿Cada cuánto se revisan los camiones parados? ¿Quién los destraba?

## 8. Quality Check (Safety) — ▲ necesario para empezar

_Define qué camiones revisa Safety y qué pasa si algo está mal._

**Lo que ya se sabe**

- Hoy la app: Safety toma el camión, revisa lo que se hizo (trabajos, PM, inspección, llantas, notas), aprueba o lo devuelve con una nota. Lo devuelto crea trabajo y vuelve a Safety cuando se arregla.
- Hoy la app: **todos** los camiones pasan por Safety y no se puede saltar.

**Lo que falta definir**

1. ¿Qué camiones necesitan Quality Check?

| | Fin de contrato | De paso | Otro |
|---|---|---|---|
| Siempre | | | |
| Solo si se hizo cierto trabajo (escribe cuál) | | | |
| Nunca | | | |

2. ¿Quién puede decidir que un camión no necesita Quality Check?
   ☐ Shop Manager · ☐ Safety · ☐ COO · ☐ Nadie, siempre se hace

3. ¿Qué revisa Safety? ¿Tiene una lista?

4. Después de arreglar lo que Safety devolvió, ¿siempre se vuelve a revisar?
   ☐ Sí · ☐ No, depende:

## 9. Cuándo sale el camión — ▲ necesario para empezar

_Define qué significa "listo" y quién lo libera._

**Lo que ya se sabe**

- Hoy la app: "listo" se calcula cuando todo el trabajo está hecho y el manager cierra; el camión queda "Ready To Go" hasta que sale (Return to Service).
- Hoy en Ninox: 14 camiones dicen Ready To Go; 7 llevan 14 días o más en la yard (consulta del 26-oct).

**Lo que falta definir**

1. ¿Qué tiene que estar hecho para que un camión esté listo?

2. ¿Quién decide que está listo?
   ☐ Shop Manager · ☐ Safety (con el Quality Check) · ☐ Otro:

3. ¿Cuándo se da por salido?
   ☐ Cuando el chofer lo recoge · ☐ Cuando el manager lo cierra · ☐ Otro:

4. ¿A quién hay que avisarle que está listo (Dispatch, el chofer, otro)? ¿Cómo?

5. ¿Por qué un camión listo se queda muchos días en la yard? ¿Es normal?

## 10. Las llaves

_Define dónde deben estar las llaves para que nadie pierda tiempo buscándolas._

**Lo que ya se sabe**

- Problema descrito: las llaves pasan de mano en mano, quedan en los camiones o se pierden.

**Lo que falta definir**

1. ¿Dónde deben quedar las llaves cuando nadie trabaja el camión?
   ☐ En la oficina · ☐ En el camión · ☐ Otro:

2. ¿Se registra quién las tiene?
   ☐ Sí, al tomar y al terminar · ☐ No hace falta

## 11. Qué quieres ver como COO

_Define los números del tablero de gerencia._

**Lo que ya se sabe**

- Propuesta: camiones en el taller, trabajos en curso, disponibles, bloqueados, hechos hoy, mecánicos trabajando, listos para salir.

**Lo que falta definir**

1. ¿Qué números necesitas ver todos los días? ¿Cuál de la propuesta sobra?

2. ¿Quieres ver tiempos (cuánto tarda cada trabajo) o productividad por mecánico? ¿Desde cuándo?

