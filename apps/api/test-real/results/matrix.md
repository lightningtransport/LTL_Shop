# Matriz de flujos contra la API real

PASA 23 · FALLA 0 · NO APLICA 0 · SIN PROBAR 0

| # | Flujo | API real |
|---|---|---|
| A82 | La hoja crea un Job por Job del catálogo: dos luces → un Lights, la limpieza va a Detailing y una llanta baja crea Flat Repair; queda Issues found | PASA |
| A83 | Sin defectos ni llantas fuera de rango queda No issues found; la segunda vez dice quién ya inspeccionó | PASA |
| A84 | No se guarda incompleta: faltan puntos, faltan llantas o un defecto sin nota | PASA |
| A85 | Add defects solo agrega: un OK pasa a defecto y crea su Job o suma su nota; un defecto guardado no cambia | PASA |
| A86 | Sin el permiso no ve "To inspect" ni guarda; con el permiso inspecciona y sus Jobs nacen sin dueño | PASA |
| A87 | Safety no recibe el permiso, y cambiar a Safety lo quita | PASA |
| A88 | El Manager agrega, renombra y desactiva puntos y cambia umbrales; la inspección guardada no cambia y el mecánico no edita | PASA |
| A89 | En "To inspect" quedan los camiones que inspeccioné (Add defects, IN-7); no los que inspeccionó otro | PASA |
| A90 | Una visita inspeccionada con los botones viejos lo dice y deja llenar la hoja | PASA |
| A128 | Tomar, devolver y aprobar: el Manager y el mecánico ven "Safety", nunca la persona; Safety sí la ve | PASA |
| A129 | La revisión trae la hoja de inspección: defectos con su nota, llantas a vigilar y notas; sin hoja, nada | PASA |
| QC1 | Safety ve solo los camiones con todo lo demás hecho | PASA |
| QC2 | Tomar y aprobar: el primero gana; aprobar deja el camión listo para cerrar | PASA |
| QC3 | Devolver con nota: el Manager lo ve, agrega el trabajo y el camión vuelve a Safety | PASA |
| QC4 | Safety no puede hacer nada más; el motivo "Devuelto por Safety" es solo suyo; un mecánico no entra a la lista de Safety | PASA |
| QC5 | El Manager conserva "Mark QC complete" como respaldo; el QC no se asigna, Safety lo toma (D46) | PASA |
| QC6 | Let go: Safety suelta el camión que tomó y la otra persona lo puede tomar (D-QC2) | PASA |
| QC7 | Revisión del camión: qué se hizo, con quién, cuándo y la nota; el PM; solo para camiones de la lista (Q2) | PASA |
| QC8 | Devolver diciendo qué Job falló: el Manager lo lee al principio de la nota (D-QC3) | PASA |
| QC9 | Done: lo que aprobé y devolví, lo más nuevo primero; cada persona ve lo suyo (D-QC6) | PASA |
| QC10 | Orden por urgencia: Critical y High antes que el que lleva más tiempo listo (D-QC5) | PASA |
| QC12 | LTR-216: el Manager no completa con un toque el QC que Safety devolvió; solo con confirmación y motivo | PASA |
| QC13 | LTR-217: resolver una devolución sin trabajo nuevo exige decirle a Safety por qué | PASA |
