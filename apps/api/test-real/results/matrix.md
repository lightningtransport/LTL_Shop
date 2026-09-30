# Matriz de flujos contra la API real

PASA 1 · FALLA 0 · NO APLICA 0 · SIN PROBAR 4

| # | Flujo | API real |
|---|---|---|
| QC1 | Safety ve solo los camiones con todo lo demás hecho | PASA |
| QC2 | Tomar y aprobar: el primero gana; aprobar deja el camión listo para cerrar | SIN PROBAR |
| QC3 | Devolver con nota: el Manager lo ve, agrega el trabajo y el camión vuelve a Safety | SIN PROBAR |
| QC4 | Safety no puede hacer nada más; el motivo "Devuelto por Safety" es solo suyo | SIN PROBAR |
| QC5 | El Manager conserva "Mark QC complete" como respaldo, y puede dar el QC a alguien de Safety | SIN PROBAR |
