# Matriz de flujos contra la API real

PASA 23 · FALLA 0 · NO APLICA 0 · SIN PROBAR 0

| # | Flujo | API real |
|---|---|---|
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
| A76 | El Job que volvió sin factura se sigue ofreciendo meses después, y la WO lo marca hasta que la tenga (PCA3) | PASA |
| A77 | Antes de guardar, la tarifa dice cuántos WOs recalcula; la última se puede quitar mientras nada facturado la use (PCA7) | PASA |
| A78 | La compra, la reparación y los movimientos dicen en qué factura se cobraron; la corrección de algo facturado dice de cuál viene (PCA4) | PASA |
| A79 | Agregar o cambiar el archivo, o solo las notas, no toca el libro del camión; cambiar el dinero sí (PCA6) | PASA |
