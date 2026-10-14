# Matriz de flujos contra la API real

PASA 132 · FALLA 0 · NO APLICA 2 · SIN PROBAR 0

| # | Flujo | API real |
|---|---|---|
| A1 | M01: crear WO solo con Truck → nace con PM, Alignment, Detailing, QC y dueños por defecto | PASA |
| A2 | M01: inspección "No issues found" | PASA |
| A3 | M01: inspección "Issues found" → agregar Jobs con dueño (D14) | PASA |
| A4 | M02: asignar / reasignar / quitar dueño; equipo derivado | PASA |
| A5 | MECH01: el mecánico ve solo sus Jobs; "Other work" solo lectura | PASA |
| A6 | MECH02: Start → WO pasa a in_progress, abre sesión → completar Jobs → "Terminaste tu parte" cierra sesión | PASA |
| A7 | MECH03: reportar bloqueo → notas → Manager resuelve → Continue | PASA |
| A8 | M03: pausa oficial → cierra sesiones → Resume reabre las mismas | PASA |
| A9 | PM: Create PM service se une al WO abierto; millaje; partes; Finish actualiza millaje | PASA |
| A9b | Arrancar el PM pone el WO en curso y registra el tiempo del mecánico PM [defecto #1] | PASA |
| A9c | Pantalla nueva del PM: pieza más usada del modelo, millaje y piezas en la lista, último PM (D-PM1) | PASA |
| A10 | PM: Create PM service en Truck sin WO → WO completo con los 4 pasos | PASA |
| A11 | PM: bloquear el PM; D2 un PM en curso por mecánico; cambio PM A ↔ PM B | PASA |
| A12 | M04: Manager completa Jobs desde Admin ("Mark complete") | PASA |
| A12b | Si el Manager completa un Job, el WO deja de estar "created" [defecto #1] | PASA |
| A13a | M04: QC "Mark complete" → Ready to close → Close WO (un mecánico hizo Start) | PASA |
| A13b | M04: Close WO cuando nadie hizo Start (PM + Manager) — caso WO-009 [defecto #1] | PASA |
| A14 | M04: Ready to Go → Return to Service desde Truck, WO y Yard | PASA |
| A15 | Cancelar WO (con motivo) → cierra sesiones y pausas; el Truck queda libre | PASA |
| A15b | Cancelar un WO con un Job bloqueado resuelve el bloqueo | PASA |
| A15c | Tras cancelar, el siguiente WO del Truck empieza con la inspección pendiente | PASA |
| A16 | Cancelar Job / reabrir Job; paso con todos sus Jobs cancelados = no aplica | PASA |
| A16b | Completar desde Admin un Job bloqueado resuelve su bloqueo | PASA |
| A16c | Cancelar un Job bloqueado resuelve su bloqueo | PASA |
| A17 | Reabrir WO completado/cancelado → in_progress o created | PASA |
| A17b | Reabrir un WO que nunca empezó, con todos los Jobs hechos: se puede cerrar [defecto #1] | PASA |
| A18 | "Agregar pasos que faltan" en WO viejo | PASA |
| A19 | Siguiente paso: todas las pantallas dicen lo mismo en cada etapa de un WO | PASA |
| A19b | Siguiente paso de un Truck Ready to Go: igual en Truck, WO, listas y Yard | PASA |
| A20 | Dashboard "Needs attention": bloqueo, pausa, sin dueño, +24 h | PASA |
| A21 | Yard: tablero por fase y contadores (Movement sin integración) | PASA |
| A22 | Notas y "Pedir trabajo" → Manager marca atendido; WO cerrado rechaza notas | PASA |
| A23 | Corrección de tiempos (admin); cada sesión dice de qué mecánico es | PASA |
| A24 | Custom Job: agregar y duplicados; nace pendiente de revisión (la bandeja es A76–A79) | PASA |
| A25 | Setup → Shop workflow: cambiar dueño por defecto; dueño inactivo → Unassigned | PASA |
| A26 | Permisos: mecánico 403 en crear/pausar/agregar/terminar, en el roster y en el catálogo; Safety 403 en roster y catálogo | PASA |
| A27 | NO APLICA: login de Supabase, reset de contraseña, idioma, tema y app instalada son de la web (se prueban en el navegador) | NO APLICA |
| A28 | NO APLICA: WO de PM legacy (pausa, reanudar, terminar): ya no se pueden crear y no queda ninguno abierto | NO APLICA |
| A29 | Crear Standard, PM y Safety: entran al roster con su tipo; correo repetido y mecánico no pueden; Safety solo es dueño del QC | PASA |
| A30 | Desactivar: no deja con Jobs pendientes o tiempo corriendo (dice qué reasignar); sin trabajo abierto deja de entrar y de aparecer; reactivar | PASA |
| A31 | Reiniciar contraseña: sin clave de Supabase la app lo dice (AUTH_NOT_CONFIGURED) y no toca nada; solo Manager o System Admin | PASA |
| A32 | Cierre del día: el reloj se cierra a las 5:00 p.m. (no a la hora en que alguien mira), el viernes no corre el fin de semana, fuera de horario a las 11:59 p.m., y al día siguiente "toca Continue" | PASA |
| A33 | Horario del taller en Setup: el Manager (o el System Admin) cambia la hora y los días; aplica desde ese momento; los demás roles no pueden; datos inválidos no | PASA |
| A34 | Ayudante: Job aparte "· ayudante" con su dueño; su reloj corre a su nombre en ese WO; no deja al mismo dueño, a quien no hace Standard, ni en PM / QC / otro ayudante; el bloqueo del principal no lo bloquea; cancelar el principal no lo cancela; solo el Manager | PASA |
| A35 | Taller externo: sale la pieza o el camión con nota; sin dueño, sin reloj y sin "sin asignar"; siguiente paso "En taller externo" igual en todas las pantallas; no se puede cerrar; los demás Jobs siguen; el Yard dice "Fuera del taller"; solo el Manager; "Regresó" → completar o asignar | PASA |
| A36 | El Manager crea un Job de catálogo, entra al Work Order como Job de catálogo; mismo nombre en la categoría no se duplica; mecánico y Safety no pueden | PASA |
| A37 | SW1: el dueño de un paso deja de poder hacerlo (desactivado) → se ve marcado y no impide guardar los otros pasos | PASA |
| A38 | SW2 + JC3: el Job de un paso no se puede desactivar; un Job de una categoría inactiva no se puede activar | PASA |
| A39 | ME1 + ME4: el trabajo abierto de una persona son sus Jobs por hacer (también para PM); los cerrados coinciden con sus Jobs completados | PASA |
| A40 | ME2 + SW3: el detalle de una persona dice antes de confirmar qué bloquea desactivarla y de qué pasos es dueña | PASA |
| A41 | Equipo de 3 en Detailing: el Job nace en la cola; el primero que lo toma es el dueño; los otros ya no pueden; soltarlo lo devuelve | PASA |
| A42 | Equipo de 1: el Job nace asignado a esa persona, como antes | PASA |
| A43 | Equipo vacío o con alguien que ya no puede: el Job nace sin dueño y el Manager lo ve para asignar; guardar no se bloquea | PASA |
| A44 | El paso de PM: equipo de mecánicos de PM; nace con PM A y el mecánico sigue eligiendo A o B | PASA |
| A45 | Categorías: crear, renombrar, desactivar con motivo, activar y borrar solo vacía; las del flujo del taller no cambian | PASA |
| A46 | Jobs: borrar solo si nunca se usó; si se usó, desactivar; los del sistema no; renombrar Alignment no lo saca de su carril y el nombre viejo queda como alias | PASA |
| A47 | Aliases: agregar y quitar; el choque dice de qué Job es; las tildes no cuentan; la búsqueda encuentra Jobs y aliases de todas las categorías | PASA |
| A48 | La carga del catálogo de cada publicación no deshace lo que cambió el Manager ni duplica nada | PASA |
| A49 | Quitar del Shop a alguien sin trabajo: no entra, sale de las listas y de los equipos; su nombre sigue en el historial | PASA |
| A50 | Quitar con trabajo pendiente: se niega con la lista; después de mandar sus Jobs a la cola del equipo, se puede | PASA |
| A51 | Borrar: solo a alguien que nunca hizo nada; con historial se niega y pide quitar del Shop | PASA |
| A52 | Cambiar de tipo: con Jobs pendientes se niega; sin Jobs, sale de los equipos que ya no puede hacer | PASA |
| A53 | Costo, proveedor habitual y "Fits": el PM sigue mostrando lo mismo y nunca recibe un costo | PASA |
| A54 | Una parte elegida en un PM en curso no se desactiva ni pierde ese camión; al terminar el PM, sí | PASA |
| A55 | La lista base no deshace el catálogo del Manager; un proveedor no se repite | PASA |
| A56 | Mecánicos y Safety no ven el catálogo con costos ni los proveedores | PASA |
| A57 | Compra de 3 líneas con impuesto y flete: la API calcula el total y rechaza uno que no cuadra | PASA |
| A58 | La misma factura del mismo proveedor: el aviso lo dice y guardar responde 409; anulada la primera, sí | PASA |
| A59 | Dos envíos con la misma Idempotency-Key guardan una sola compra | PASA |
| A60 | Una factura de dos camiones: cada uno recibe su parte con el impuesto repartido y la suma cuadra | PASA |
| A61 | Corregir y anular escriben reversas; ninguna fila del libro cambia | PASA |
| A62 | La factura adjunta: tipo y tamaño se revisan; mecánicos y Safety no ven ni cargan compras | PASA |
| A63 | La factura se liga al Job enviado afuera y va al camión; el Job lo muestra; un Job de otro camión no | PASA |
| A64 | Enviar a taller externo y Regresó siguen igual, con la factura cargada antes o después | PASA |
| A65 | Factura repetida entre compra y reparación; corregir y anular con reversas; mecánicos y Safety no entran | PASA |
| A66 | Totales por tipo y por mes = suma del libro en el período; anular una compra los baja | PASA |
| A67 | Las horas de mano de obra son las de las sesiones cerradas del camión en el período (el monto llega con la tarifa, A69) | PASA |
| A68 | Mecánicos y Safety no ven los costos del camión; terminar un PM no escribe en el libro (D-PC4) | PASA |
| A69 | Al completar un WO, su mano de obra (horas × tarifa) entra al costo del camión con su WO | PASA |
| A70 | Una tarifa nueva recalcula con reversas; reabrir el WO la saca y volver a cerrarlo la pone | PASA |
| A71 | Sin tarifa no hay monto (solo horas); mecánicos y Safety no ven ni cambian la tarifa | PASA |
| A72 | El borrador trae lo no cobrado del camión hasta fin de mes, con subtotales; cada movimiento se cobra una vez | PASA |
| A73 | Una línea que se saca queda sin cobrar: no vuelve al traer lo nuevo y entra en la factura siguiente | PASA |
| A74 | Enviada: número SHOP, congelada; una corrección posterior cae en la siguiente; Finanzas la acepta | PASA |
| A75 | Anular una enviada libera sus movimientos; el número no se reusa; mecánicos y Safety no entran | PASA |
| A76 | La bandeja agrupa por categoría y nombre (sin mayúsculas ni espacios), con cuántos, en qué WO y sugerencias | PASA |
| A76 | El Job que volvió sin factura se sigue ofreciendo meses después, y la WO lo marca hasta que la tenga (PCA3) | PASA |
| A77 | Unir: todo el grupo queda ligado al Job del catálogo de una vez; el nombre queda como alias; el WO no cambia | PASA |
| A77 | Antes de guardar, la tarifa dice cuántos WOs recalcula; la última se puede quitar mientras nada facturado la use (PCA7) | PASA |
| A78 | Agregar al catálogo: crea el Job y le liga el grupo; un nombre que ya existe no se acepta | PASA |
| A78 | La compra, la reparación y los movimientos dicen en qué factura se cobraron; la corrección de algo facturado dice de cuál viene (PCA4) | PASA |
| A79 | Dejar como único: sale de la bandeja sin tocar el catálogo; Deshacer lo devuelve | PASA |
| A79 | Agregar o cambiar el archivo, o solo las notas, no toca el libro del camión; cambiar el dinero sí (PCA6) | PASA |
| A80 | El proveedor dice cuántas facturas tiene; la lista de facturas filtra por mes; la WO dice lo que lleva gastado (PCA9, PCA10, PCA14) | PASA |
| A81 | El cierre del mes lista los camiones con algo por cobrar y arma los borradores que faltan de una vez (PCA16, D37) | PASA |
| A82 | La hoja crea un Job por Job del catálogo: dos luces → un Lights, la limpieza va a Detailing y una llanta baja crea Flat Repair; queda Issues found | PASA |
| A83 | Sin defectos ni llantas fuera de rango queda No issues found; la segunda vez dice quién ya inspeccionó | PASA |
| A84 | No se guarda incompleta: faltan puntos, faltan llantas o un defecto sin nota | PASA |
| A85 | Add defects solo agrega: un OK pasa a defecto y crea su Job o suma su nota; un defecto guardado no cambia | PASA |
| A86 | Sin el permiso no ve "To inspect" ni guarda; con el permiso inspecciona y sus Jobs nacen sin dueño | PASA |
| A87 | Safety no recibe el permiso, y cambiar a Safety lo quita | PASA |
| A88 | El Manager agrega, renombra y desactiva puntos y cambia umbrales; la inspección guardada no cambia y el mecánico no edita | PASA |
| A89 | En "To inspect" quedan los camiones que inspeccioné (Add defects, IN-7); no los que inspeccionó otro | PASA |
| A90 | Una visita inspeccionada con los botones viejos lo dice y deja llenar la hoja | PASA |
| E1 | Un Truck con WO abierto no acepta un segundo WO | PASA |
| E2 | Reintento de crear WO (misma clave) no crea otro | PASA |
| E3 | Dos Managers cambian el mismo WO: gana el primero, el segundo recibe aviso | PASA |
| E4 | Usuario inactivo o desconocido no entra | PASA |
| E5 | Mecánico: Start donde no tiene Jobs, o cuando ya terminó los suyos | PASA |
| E6 | Completar un Job sin Start, o uno ya completado | PASA |
| E7 | Un mecánico con trabajo en dos Trucks: su reloj corre en uno solo; Start en el segundo cierra el del primero ("cambio de camión") y al volver toca Continue (D21) | PASA |
| E8 | Quitar o cambiar el dueño de un Job en curso detiene el tiempo de ese mecánico | PASA |
| E9 | Asignar a quien no corresponde | PASA |
| E9b | Solo una persona de Safety puede ser dueño del Quality Check (D19) | PASA |
| E10 | Bloqueo: motivos que no son bloqueo, Job ajeno, Job terminado | PASA |
| E11 | PM: millaje menor, salto grande, terminar sin millaje o sin partes (D10) | PASA |
| E12 | Agregar trabajo a un Truck sin WO abierto crea el WO completo | PASA |
| E13 | Inspección: no se puede pasar a "No issues found" con hallazgos en el plan | PASA |
| E14 | Truck Ready to Go sin Return to Service: se puede abrir otro WO y deja de estar Ready to Go | PASA |
| E14b | Un WO nuevo sobre un Truck Ready to Go empieza con la inspección pendiente | PASA |
| E15 | Cerrar, cancelar y devolver a servicio en el estado equivocado | PASA |
| E16 | Cancelar todos los Jobs pendientes: el WO se puede cerrar | PASA |
| E17 | Prioridad crítica sube en "Needs attention"; el PM no cambia de prioridad | PASA |
| QC1 | Safety ve solo los camiones con todo lo demás hecho | PASA |
| QC2 | Tomar y aprobar: el primero gana; aprobar deja el camión listo para cerrar | PASA |
| QC3 | Devolver con nota: el Manager lo ve, agrega el trabajo y el camión vuelve a Safety | PASA |
| QC4 | Safety no puede hacer nada más; el motivo "Devuelto por Safety" es solo suyo; un mecánico no entra a la lista de Safety | PASA |
| QC5 | El Manager conserva "Mark QC complete" como respaldo, y puede dar el QC a alguien de Safety | PASA |
| QC6 | Let go: Safety suelta el camión que tomó y la otra persona lo puede tomar (D-QC2) | PASA |
| QC7 | Revisión del camión: qué se hizo, con quién, cuándo y la nota; el PM; solo para camiones de la lista (Q2) | PASA |
| QC8 | Devolver diciendo qué Job falló: el Manager lo lee al principio de la nota (D-QC3) | PASA |
| QC9 | Done: lo que aprobé y devolví, lo más nuevo primero; cada persona ve lo suyo (D-QC6) | PASA |
| QC10 | Orden por urgencia: Critical y High antes que el que lleva más tiempo listo (D-QC5) | PASA |
| QC11 | El Manager hace QC como respaldo en la pantalla de Safety: toma y aprueba a su nombre; Safety fuera del equipo no ve la cola; un mecánico sigue sin entrar | PASA |
