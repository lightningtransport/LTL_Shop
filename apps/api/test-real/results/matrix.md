# Matriz de flujos contra la API real

PASA 64 · FALLA 0 · NO APLICA 2 · SIN PROBAR 0

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
| A24 | Custom Job: agregar y duplicados (la revisión no existe: defecto #3) | PASA |
| A25 | Setup → Shop workflow: cambiar dueño por defecto; dueño inactivo → Unassigned | PASA |
| A26 | Permisos: mecánico 403 en crear/pausar/agregar/terminar y en el roster; Manager 403 en el catálogo | PASA |
| A27 | NO APLICA: login de Supabase, reset de contraseña, idioma, tema y app instalada son de la web (se prueban en el navegador) | NO APLICA |
| A28 | NO APLICA: WO de PM legacy (pausa, reanudar, terminar): ya no se pueden crear y no queda ninguno abierto | NO APLICA |
| A29 | Crear Standard, PM y Safety: entran al roster con su tipo; correo repetido y mecánico no pueden; Safety solo es dueño del QC | PASA |
| A30 | Desactivar: no deja con Jobs pendientes o tiempo corriendo (dice qué reasignar); sin trabajo abierto deja de entrar y de aparecer; reactivar | PASA |
| A31 | Reiniciar contraseña: sin cuenta de acceso la app lo dice (AUTH_ACCOUNT_MISSING); solo Manager o System Admin | PASA |
| A32 | Cierre del día: el reloj se cierra a las 5:00 p.m. (no a la hora en que alguien mira), el viernes no corre el fin de semana, fuera de horario a las 11:59 p.m., y al día siguiente "toca Continue" | PASA |
| A33 | Horario del taller en Setup: el Manager (o el System Admin) cambia la hora y los días; aplica desde ese momento; los demás roles no pueden; datos inválidos no | PASA |
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
| QC4 | Safety no puede hacer nada más; el motivo "Devuelto por Safety" es solo suyo | PASA |
| QC5 | El Manager conserva "Mark QC complete" como respaldo, y puede dar el QC a alguien de Safety | PASA |
