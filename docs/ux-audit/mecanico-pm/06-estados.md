# 06 · Estados del sistema — Lightning Shop, pantallas del Mecánico de PM

**Fecha:** 2026-10-07 · **Alcance:** inicio, Create PM service, detalle del PM (cargar, guardar solo, Finish) y Completed, teléfono 375 px · **Método:** código + navegador (demo local; los fallos se provocaron interceptando la API con Playwright y con `context.setOffline(true)`)
**Resumen:** 5 hallazgos, 1 de severidad 3. Cargar y fallar al cargar están cubiertos con los componentes comunes (`CardListSkeleton`, `LoadFailure`). Lo descuidado es **el guardado automático cuando no guarda**: sin red, lo que Daniel eligió queda solo en la pantalla, el aviso sale lejos del campo, no se reintenta solo y se pierde al salir. Los errores de carga del detalle dejan una pantalla sin título ni salida.

## Matriz pantalla × estado

`✓` correcto · `△` existe pero deficiente · `✗` no existe · `–` no aplica · `?` no verificado

| Pantalla / acción | Vacío | Cargando | Parcial | Error | Éxito | Deshab. | Sesión | Sin conexión |
|---|---|---|---|---|---|---|---|---|
| Inicio `/mechanic/pm` | △ UX-1-005 | △ UX-1-002 | – | △ UX-6-003 | – | ✓ | ✓ (va a `/login`) | ? |
| Create PM service | ✓ | ✓ | – | △ UX-1-003 | ? | ✓ | ? | ? |
| Detalle: cargar el WO | – | ✓ | – | △ UX-6-004 | – | – | ✓ | ? |
| Detalle: cargar el PM (millaje, piezas) | – | △ UX-6-005 | – | ✓ | – | – | – | ? |
| Start PM service | – | ✓ | – | △ UX-1-003 | ? | – | ? | ? |
| Guardado automático (millaje, piezas) | – | ✓ ("Saving…") | – | △ UX-6-003 | ✓ ("Saved automatically") | – | △ UX-6-002 | ✗ UX-6-001 |
| Service type A ↔ B | – | ✓ | – | ? | △ UX-1-006 | ✓ | ? | ? |
| Finish | – | ✓ | – | ? | ? (inferido: toast + inicio) | △ UX-7-006 | ? | ? |
| Report Blocker | – | ✓ | – | ? | ? | △ UX-7-009 | ? | ? |
| Notas | ✓ ("No notes yet.") | ✓ | – | ? | ✓ (toast) | ✓ | ? | ✗ UX-7-001 |
| PM terminado (WO-006) | – | ✓ | – | – | ✓ | ✓ (solo lectura) | – | – |
| Completed | ? | ✓ | – | ? | – | – | – | ? |
| WO inexistente (404) | – | – | – | △ UX-6-004 | – | – | – | – |

## Hallazgos

### Error y sin conexión

### UX-6-001 · Sin conexión, lo que elige queda solo en la pantalla y se pierde al salir
- **Dónde:** detalle del PM · `apps/web/src/components/pm-service-card.tsx:125-128` (el `catch` deja `saveError`), `:144` (con `saveError` el guardado automático se detiene) y `:296-304` (el aviso va al pie de la tarjeta)
- **Evidencia:** pasos (observado) en WO-016: 1) cortar la red, 2) elegir "LF3654 — Fleetguard Oil Filter" → el select muestra la pieza (`evidencia/07-sin-conexion-pieza.jpg`); el aviso "Unable to reach the Shop. Please try again. · Try again" aparece debajo de "Coolant Filter", unos 700 px más abajo (`evidencia/06-sin-conexion.jpg`), 3) cambiar el millaje a 211,000 → mismo aviso, 4) volver la red y esperar 3 s → el aviso sigue (no reintenta solo), 5) recargar → millaje 210,000 y la pieza que estaba antes: los dos cambios se perdieron. No hay aviso al salir de la pantalla.
- **Criterio:** E4 sin conexión (detectar, avisar, reintentar solo) · Nielsen H1 y H9
- **Severidad:** 3 · En el taller la señal se corta; Daniel ve la pieza elegida en el select, el aviso queda fuera de la vista y, si se va, cree que quedó guardado. Lo descubre cuando Finish no se activa o cuando el Manager ve el PM incompleto.
- **Recomendación:** guardar el borrador (millaje y piezas) en `localStorage` por WO mientras no se confirme el guardado; franja fija arriba "Offline · your changes are kept on this phone and will be sent when you're back online"; escuchar `online` y reintentar solo; marcar en la fila el cambio pendiente; avisar al salir si queda algo sin enviar.
- **Esfuerzo:** M

### UX-6-002 · Si la sesión vence mientras anota el millaje, se pierde y vuelve al inicio, no al camión
- **Dónde:** `apps/web/src/lib/api.ts:163-166` (un 401 borra el token y dispara `ltl-auth-expired`) · el millaje vive solo en el estado del componente (`pm-service-card.tsx:50`)
- **Evidencia:** `evidencia/06-sesion-vencida.jpg` (observado). Pasos: 1) en WO-016 escribir 212,345, 2) el guardado responde 401 → la app va a `/login`, 3) al entrar de nuevo cae en `/mechanic/pm`, no en el WO; el millaje no se guardó.
- **Criterio:** transversal "sesión expirada": conservar lo que hacía y devolverlo ahí · Nielsen H3 y H9
- **Severidad:** 2 · Es raro (la sesión se renueva sola) y el dato es corto, pero Daniel tiene que buscar el camión otra vez y volver a leer el odómetro.
- **Recomendación:** guardar la ruta y el borrador antes de ir a `/login` y volver ahí después (el mismo borrador de UX-6-001).
- **Esfuerzo:** S

### UX-6-003 · Los errores del servidor salen con el texto crudo de la API y siempre ofrecen "Try again"
- **Dónde:** `pm-service-card.tsx:126` (`err.message` directo, sin `apiErrorMessage`) · inicio vía `apps/web/src/lib/api-error-message.ts:41` (en inglés pasa el mensaje de la API tal cual)
- **Evidencia:** (observado) guardado con 500 → "Internal server error · Try again"; guardado con 409 (PM ya terminado) → "PM service is already completed. · Try again", donde reintentar no sirve; inicio con 500 → "boom · Try again" (`evidencia/06-error-inicio.jpg`, el texto de prueba que devolvió el servidor). En español, `pm-service-card.tsx:126` mostraría el mensaje de la API en inglés (inferido del código).
- **Criterio:** E4 error de sistema (decir que no es su culpa y qué hacer) · Nielsen H9
- **Severidad:** 2 · Daniel no sabe si fue él, si se guardó o si debe avisar; ante un 409 reintenta sin fin.
- **Recomendación:** pasar el error por `apiErrorMessage` con textos propios: 5xx → "The Shop could not save this. Your entry is still here; try again in a moment."; 409 de PM terminado → "This PM was already finished. Reload to see it." con "Reload" en lugar de "Try again".
- **Esfuerzo:** S

### UX-6-004 · Si el Work Order no carga o no existe, la pantalla queda sin título ni forma de volver
- **Dónde:** `apps/web/src/app/work-orders/[id]/detail-client.tsx:146` y `:160-161`
- **Evidencia:** `evidencia/06-wo-no-existe.jpg` y `evidencia/06-error-wo.jpg` (observado). Un id que no existe muestra solo "Work Order not found · Retry work order"; un 500 muestra "Request failed (500) · Retry work order". Sin encabezado, sin pestañas, sin flecha atrás. En el 404, reintentar no sirve.
- **Criterio:** E4 404 / error de sistema (página propia con forma de volver)
- **Severidad:** 2 · Pasa poco (enlace viejo, WO cancelado o borrado), pero la única salida es el botón atrás del teléfono.
- **Recomendación:** mantener el encabezado y las pestañas; 404 → "This Work Order no longer exists." con "Back to My work"; 5xx → mensaje propio, "Try again" y "Back to My work".
- **Esfuerzo:** S

### Cargando

### UX-6-005 · Mientras carga el PM, Finish ya aparece desactivado con su requisito
- **Dónde:** `pm-service-card.tsx:172` · `apps/web/src/components/pm-job-detail.tsx:153-154`
- **Evidencia:** `evidencia/06-cargando-pm.jpg` (observado, PM demorado 4 s): una línea "Loading PM service details…" y, debajo, "Finish Work" gris con "Finish requires a saved observed mileage and at least one part.", como si faltaran datos. Al llegar, el formulario empuja Finish y las notas más de 1000 px hacia abajo.
- **Criterio:** E2 cargando (indicador donde va el contenido, sin saltos)
- **Severidad:** 1 · Dura poco con buena señal; con mala, Daniel lee un requisito que no aplica.
- **Recomendación:** esqueleto con la forma del formulario (`CardListSkeleton`) y ocultar Finish hasta tener datos.
- **Esfuerzo:** S

## Lo que funciona bien
- **Guardado automático visible:** "Saving…" y luego "Saved automatically" junto al título de la tarjeta (W15), y el millaje y las piezas sobreviven a recargar cuando hay red.
- **Inicio cargando con esqueletos** del tamaño de las tarjetas (`evidencia/06-cargando-inicio.jpg`).
- **Error de carga del PM acotado a su tarjeta:** "Unable to load PM service details. · Try again", y el resto de la pantalla sigue usable (`evidencia/06-error-pm.jpg`).
- **Conflictos con mensaje propio:** "Finish WO-016 before starting another PM service." y "Finish your PM service in progress before starting another."
- **Los botones se desactivan mientras corre una acción** (`busy`), así que no hay doble envío en Start, Finish ni Report Blocker.

## Fuera de alcance / no verificado
- **Éxito de Finish** y **Finish sin conexión:** no se terminó ningún PM (ver `00-contexto.md` §3). Finish usa el mismo `run` que muestra el error dentro de la hoja (`pm-job-detail.tsx:231`).
- **Inicio sin conexión:** no se probó; la lista usa SWR y se espera el mismo `LoadFailure` del 500.
- **Inicio vacío** (sin PM en curso ni camiones esperando): no hay ese caso en la demo.
- **Producción:** no verificado.
