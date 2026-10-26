# Hoja de preguntas para validar la versión resumida de la app

**Para imprimir.** Ellos nunca han usado la app: se valida el boceto, no la app de hoy.
1) Boceto: https://claude.ai/artifact/RoLTBY4LTXWRy6r2moCLsE · 2) Página de hoy con datos de Ninox: https://claude.ai/artifact/A2ovHWUjopsnujphwDXohR (compartir las dos con Share). Versión PDF: la que se imprime.

Los códigos entre corchetes ([P46], [C1]…) son para pasar las respuestas a `DECISIONS.md` y al plan; no se leen en voz alta.

## Cómo usar esta hoja

- Ellos nunca han usado la app. No se valida la app de hoy: se valida la versión resumida (el boceto).
- Antes de empezar: comparte el boceto y la página de hoy (botón Share) o llévalos abiertos en tu teléfono o tablet.
- Empieza siempre con la pregunta abierta, sin mostrar nada. Muestra la pantalla solo cuando la hoja lo dice.
- Si alguien dice "así no trabajamos", esa es la respuesta útil. No defiendas el boceto.
- Anota con sus palabras, aunque no calce con la pregunta. ★ = importante: no la saltes.
- Al final, saca foto a las hojas y mándamelas.

## Para ti (no es para ellos)

- ¿Cargamos el último PM de cada camión desde un export de Ninox, y desde ahí lo lleva la app? (P58)
- ¿Quién mantiene la copia de Ninox en Supabase, por si pedimos agregar campos?
- ¿Se queda el nombre "Work Order"? (P45)
- ¿"Cerrar" solo cierra la Work Order y "Return to Service" sigue aparte? (P56) — compara con la pregunta de la salida del camión del Shop Manager.
- ¿OK para crear el Epic y los issues en Linear?
- ¿Cuándo es cada conversación?

## Shop Manager (~45 min)

**Primero, sin mostrar nada:** Cuéntame cómo fue ayer, desde que llegaste hasta que te fuiste. ¿Qué es lo que más tiempo te quita?

**La pizarra** — _Muestra la pantalla Board._

1. ¿Esto se parece a tu pizarra? ¿Qué columnas tiene la tuya? ¿Falta o sobra alguna? [P49]

2. ¿Cómo le dicen ustedes a las reparaciones generales? [P40]

3. ¿Qué significa el asterisco? ¿Hay más de un nivel (urgente, importante)?

4. Si un mecánico ya está trabajando un camión, ¿ese camión tiene que seguir viéndose en las otras columnas? [P48]

5. Lo terminado, ¿tiene que quedar tachado a la vista todo el día?

6. ¿Los mecánicos deberían ver toda la pizarra o solo su especialidad?

**Anotar el trabajo de un camión** — _Muestra la pantalla New Work Order._

7. ★ Un camión que vuelve por fin de contrato: ¿qué trabajos lleva SIEMPRE? ¿Cuáles solo a veces? [C1]

8. ★ Un camión que viene de paso: ¿qué lleva siempre, si lleva algo? ¿Cómo sabes si le toca PM? [C1]

9. ★ Si a un camión le quitas un trabajo que normalmente lleva (por ejemplo, Alignment): ¿tiene que quedar escrito por qué? ¿Quién puede quitarlo? [C3]

10. ¿Hay otros tipos de visita además de fin de contrato y de paso?

11. ¿La lista Return Schedule de Bay Work es la de los camiones que vuelven por fin de contrato? ¿Hay otra forma de saberlo? [Ninox]

**Los mecánicos**

12. Si anotas un trabajo sin decir quién lo hace, ¿cualquiera de esa especialidad lo puede tomar? [P44]

13. ★ Cuando un mecánico elige un trabajo, ¿empieza de una vez o primero va a buscar las llaves? [P47]

14. ¿Después de cuánto tiempo sin que nadie lo tome quieres que te avise? ¿Medio día? ¿Un día?

15. ¿Qué hace cada uno? (Alejandro 1, Alejandro 2, John, Anthony, Elliot, Daniel) [equipos]: Generales ___ · Alignment ___ · Detailing ___ · PM ___ · Safety ___

**La salida del camión**

16. ★ Cuando todo está hecho, ¿el camión se va de una vez o queda esperando al chofer? ¿Quién dice que ya salió? [P56]

17. Si el mecánico de PM empieza un PM en un camión que no tenías anotado, ¿ese camión lleva solo el PM o le agregas lo demás? [P53]

**Con los datos de hoy** — _Abre la página de hoy (segundo link) y ve pantalla por pantalla._

18. ★ Las listas de Bay Work (PM, Alignment, Detail), ¿son lo que falta hacer o lo que ya se hizo? [Bay Work]

19. En el Kanban, ¿quién mueve un camión de columna y cuándo? ¿"Checked In" es cuando llega y entregan las llaves? [Kanban]

20. ¿Qué significa exactamente "Heavy Work No ETA"? ¿Espera piezas, taller externo, una decisión? [Kanban]

21. El 845 y el 879 dicen Ready To Go, pero Alejandro 1 aparece trabajándolos. ¿Cuál es la verdad? ¿Quién actualiza eso en Ninox? [datos]

**PM o Fuel filter** — _Pantalla "PM or fuel filter"._

22. ¿Así es la regla: menos de 30,000 millas solo Fuel filter; entre 30,000 y 40,000 es un aviso y tú decides; con 40,000 o más, PM? [P57]

23. ★ Entre 30,000 y 40,000, ¿qué miras para decidir si haces el PM? ¿Cuánto le falta para 40,000? ¿Cuánto tiempo va a estar en la ruta? ¿Cuántas millas hace por semana? [P57]

24. ¿Quién decide en esa zona: tú, Daniel u otra persona? [P57]

25. Mira el 905 (35,260 millas): ¿le harías PM o solo Fuel filter? ¿Por qué? [P57]

26. Si en esa zona decides no hacer el PM, ¿se cambia el Fuel filter? ¿Y debajo de 30,000, siempre? [P57]

27. ¿Te serviría que la app te diga "le faltan 4,740 millas, unas X semanas de ruta" para decidir? [P57]

28. ¿El Air Dryer Filter va con el PM o aparte? [P57]

29. ★ ¿Las millas desde el último PM de Ninox son confiables? El 830 dice que el último PM fue con 540 millas. ¿Quién corrige esos datos? [P58]

30. ¿Se puede sacar de Ninox una lista con el odómetro y la fecha del último PM de cada camión? [P58]

**El día**

31. ¿Planeas el trabajo en la mañana o la noche anterior?

32. Las llaves: ¿dónde suelen quedar? ¿Cuándo se pierden? [llaves]

## Safety (~15 min · las dos personas si se puede)

**Primero, sin mostrar nada:** ¿Cómo deciden que un camión está bien para salir?

1. ★ ¿Qué camiones necesitan su revisión y cuáles no? ¿Depende del tipo de visita, de lo que se le hizo, del cliente? [P46]

2. ★ ¿Quién puede decidir que un camión NO necesita revisión? ¿El Shop Manager solo, ustedes, o los dos? [P46]

_Muestra la pantalla Quality Check._

3. Cuando devuelven un camión porque algo está mal, ¿quieren que el arreglo aparezca solo en la pizarra o que el Shop Manager lo revise primero? [P54]

4. Después de que se arregla, ¿siempre lo vuelven a revisar? ¿Hay casos en que no hace falta? [P55]

5. ¿Les sirve ver los camiones que todavía tienen trabajo y les van a llegar?

6. ¿Usan teléfono o tablet?

## Carlos (gerencia) (~15 min)

**Primero, sin mostrar nada:** ¿Qué te gustaría saber del taller sin tener que preguntar?

1. ★ ¿Está bien que el Shop Manager decida solo que un camión no necesita revisión de Safety? Si no, ¿quién autoriza esa excepción? [P46]

2. ★ ¿Quién aprueba qué trabajos lleva cada tipo de visita (fin de contrato, de paso)? [C1]

3. El PM es obligatorio a las 40,000 millas, con aviso desde 30,000. ¿Ese intervalo lo pone el fabricante, el seguro o la empresa? ¿Se puede pasar de 40,000 si el camión está en la ruta? [P57]

4. Cuando un trabajo que normalmente se hace no se hace, ¿necesitas saber quién lo decidió y por qué? [C3]

_Muestra la pantalla Shop today._

5. ¿Estos 7 números te dicen lo que necesitas? ¿Cuál sobra y cuál falta?

6. ★ Las horas de cada mecánico se cobran a Finanzas. ¿El tiempo debe contar desde que toma el trabajo, aunque vaya primero por las llaves? (En Detailing ya se decidió: las horas quedan a nombre de "Detailing", sin persona.) [P47]

## Mecánico general (~10 min)

**Primero, sin mostrar nada:** ¿Cómo eliges qué trabajo hacer cuando llegas?

_Muestra la pantalla My work en un teléfono._

1. ¿Entiendes qué es tuyo y qué está libre para tomar?

2. Cuando eliges un trabajo, ¿empiezas de una vez o primero buscas las llaves? [P47]

3. ¿Qué te detiene más seguido?  ☐ piezas   ☐ aprobación   ☐ el camión no está   ☐ otro: ________

4. Al terminar, ¿te molesta que te pregunte dónde dejaste las llaves? [llaves]

5. ¿Usarías tu teléfono o prefieres una tablet del taller?

6. Hoy, cuando terminas un camión, ¿quién lo anota en Ninox o en la pizarra?

## Detailer (~10 min)

**Primero, sin mostrar nada:** ¿Cómo se reparten el trabajo entre ustedes?

_Muestra "Detailing tablet" en la página de hoy. (Ya decidido: no ponen su nombre, varios camiones a la vez, cualquiera termina.)_

1. ¿Entiendes qué está en curso y qué falta?

2. ¿Es así de simple como lo necesitan? ¿Qué le quitarían o le pondrían?

3. ¿Dónde pondrían la tablet? ¿Hay señal de internet ahí?

4. ¿Qué los detiene más seguido? (agua, químicos, el camión no está, otro)

5. Al terminar, ¿les molesta que les pregunte dónde quedaron las llaves? [llaves]

