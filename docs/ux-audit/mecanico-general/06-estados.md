# 06 · Estados del sistema — Lightning Shop, pantallas del Mecánico General (Standard)

**Fecha:** 2026-10-07 · **Alcance:** inicio, Trucks, Completed y detalle del Work Order (Start, Continue, Complete job, Report Blocker, nota al bloqueo, notas y Request Work) con Anthony, teléfono 375 px, inglés y español · **Método:** código + navegador (demo local; los fallos se provocaron interceptando la API con Playwright: demoras, 500, 409, 403, 401 y `setOffline`)
**Resumen:** 8 hallazgos, ninguno de severidad 3. Carga, éxito y error **dentro de los diálogos** están bien resueltos (esqueletos, "Completing…", mensaje en la hoja con lo escrito intacto). Lo descuidado está **fuera de los diálogos**: el detalle que falla queda sin cabecera ni salida, un Work Order sin Jobs propios dice "PM Work Order", Start y Notas muestran errores en inglés con la app en español, y una sesión vencida devuelve al inicio sin lo escrito. 5 celdas `✗`.

## Matriz pantalla × estado

`✓` correcto · `△` existe pero deficiente · `✗` no existe · `–` no aplica · `?` no verificado

| Pantalla / acción | Vacío | Cargando | Parcial | Error | Éxito | Deshab. | Sesión | Sin conexión |
|---|---|---|---|---|---|---|---|---|
| Inicio (lista) | ✓ | ✓ | – | ✓ | – | – | ✓ (va a `/login`) | △ UX-6-007 |
| Start Work (lista) | – | ✓ | – | △ UX-6-006 | △ UX-1-002 | ✓ | ? | △ UX-6-006 |
| Trucks (buscar) | ✓ | ✗ UX-6-001 | – | △ UX-6-003 | – | – | ? | ? |
| Completed | ✓ | ✓ | – | ✓ | – | – | ? | ? |
| Detalle (carga) | – | ✓ | – | ✗ UX-6-002 | – | – | ✓ (va a `/login`) | ? |
| Detalle sin Jobs propios / 404 | – | – | – | ✗ UX-6-005, UX-6-002 | – | – | – | – |
| Continue (detalle) | – | ✓ | – | ✓ | ✓ | ✓ | ? | ? |
| Complete job (diálogo) | – | ✓ | – | ✓ | ✓ | ✓ | ✗ UX-6-008 | ✓ |
| Después de cerrar un diálogo con error | – | – | – | △ UX-6-004 | – | – | – | – |
| Report Blocker (diálogo) | – | ✓ | – | ✓ (inferido: mismo `run`) | ✓ | △ UX-7-004 | ✗ UX-6-008 (inferido) | ? |
| Nota al bloqueo | – | ✓ | – | ✓ (inferido) | ✓ | ✓ | ? | ? |
| Notas / Request Work | ✓ | ✓ | – | △ UX-6-006 | ✓ | ✓ | ? | △ UX-6-006 |

## Hallazgos

### Cargando

### UX-6-001 · Buscar unidad no muestra nada mientras carga la lista de camiones
- **Dónde:** `/mechanic/standard/trucks` · `apps/web/src/components/mechanic-trucks-page.tsx:45-47` (hay rama de error y de "sin resultados", no de carga)
- **Evidencia:** `evidencia/06-unidades-cargando.jpg` (observado, con la API demorada 4 s): título, campo "Truck number, e.g. 905" y la pantalla vacía debajo. Si el mecánico escribe "604" antes de que llegue la lista, tampoco aparece nada hasta que llega.
- **Criterio:** E2 cargando (indicador donde va a aparecer el contenido)
- **Severidad:** 1 · La lista llega rápido en el taller con buena señal; con mala señal el mecánico no sabe si la búsqueda funciona.
- **Recomendación:** `CardListSkeleton count={2}` debajo del campo mientras `trucks` es `undefined`.
- **Esfuerzo:** S

### Error

### UX-6-002 · Si el detalle no carga, la pantalla queda sin cabecera ni salida
- **Dónde:** `apps/web/src/app/work-orders/[id]/detail-client.tsx:160-162` (devuelve solo `LoadFailure`, sin `PageHeader` ni pestañas)
- **Evidencia:** `evidencia/06-detalle-error.jpg` (observado, API 500): un recuadro rojo "Internal server error" con "Retry work order" en una pantalla en blanco, sin flecha de volver. Con un Work Order que no existe (`evidencia/06-detalle-404.jpg`, observado): "Work Order not found" y "Retry work order", que vuelve a fallar.
- **Criterio:** E4 error de sistema y 404 (página propia con forma de volver) · Nielsen H3 y H9
- **Severidad:** 2 · Pasa con un enlace viejo o un fallo del servidor; la única salida es el botón atrás del teléfono, que en la app instalada no siempre está.
- **Recomendación:** mantener la cabecera con la flecha a `/mechanic/standard`; con 404, "This Work Order no longer exists." y "Back to My work" en lugar de "Retry".
- **Esfuerzo:** S

### UX-6-003 · El error de Trucks dice "Unable to load work orders"
- **Dónde:** `mechanic-trucks-page.tsx:45` (`messages.unableToLoadWorkOrders`)
- **Evidencia:** `evidencia/06-unidades-error.jpg` (observado, API 500 en `/api/trucks`).
- **Criterio:** E4 (el error dice qué falló) · Nielsen H9
- **Severidad:** 1 · El mecánico entiende que algo falló, pero el mensaje habla de otra cosa.
- **Recomendación:** "Unable to load trucks." / "No se pudieron cargar las unidades."
- **Esfuerzo:** S

### UX-6-004 · El error de un diálogo queda en la página después de cerrarlo
- **Dónde:** `detail-client.tsx:134` (`setError` en `run`) y `:259-261` (se muestra arriba cuando no hay diálogo abierto); cerrar el diálogo no lo limpia (`:492-496`)
- **Evidencia:** `evidencia/06-error-tras-cerrar.jpg` (observado). Pasos: 1) sin conexión, Complete job → el diálogo dice "Unable to reach the Shop. Please try again.", 2) Esc, 3) volver la conexión → el aviso rojo sigue arriba del detalle, sobre "Truck Information", hasta la siguiente acción.
- **Criterio:** E4 / E6 (volver al estado ideal tras el error)
- **Severidad:** 1 · Confunde poco (el Job sigue sin completar), pero el aviso ya no corresponde a nada en pantalla.
- **Recomendación:** limpiar `error` al cerrar cualquier diálogo.
- **Esfuerzo:** S

### UX-6-005 · Un Work Order sin Jobs propios dice "You do not have access to this PM Work Order."
- **Dónde:** `detail-client.tsx:147-158` (todo 403 usa `noAccessToPmWorkOrder`, `locale-context.tsx:390` y `:724`)
- **Evidencia:** `evidencia/06-wo-ajena.jpg` (observado): Anthony abre WO-003 (Truck 603, sin Jobs suyos) y lee "You do not have access to this PM Work Order." y "Back to Home". Es lo mismo que verá cuando el Manager le cancele su único Job (HU-ME1, fila A16) o se lo reasigne.
- **Criterio:** E4 sin permiso (página propia que explica) · Nielsen H2 y H9
- **Severidad:** 2 · Pasa cada vez que el Manager le quita un Job mientras tiene el camión abierto (el detalle se refresca cada 15 s). "PM" le hace pensar que abrió algo equivocado, no que le quitaron el trabajo.
- **Recomendación:** "You have no Jobs on Truck 603 anymore. The Manager may have reassigned or cancelled them." (ES "Ya no tienes Jobs en la unidad 603…") y "Back to My work".
- **Esfuerzo:** S

### UX-6-006 · Start desde la lista y Notas muestran el error en inglés con la app en español
- **Dónde:** `apps/web/src/app/page.tsx:423` y `apps/web/src/components/work-order-notes-thread.tsx:49` (`err.message` en lugar de `apiErrorMessage`)
- **Evidencia:** `evidencia/06-es-iniciar-sin-conexion.jpg` y `evidencia/06-es-nota-sin-conexion.jpg` (observado, idioma español, sin conexión): "Unable to reach the Shop. Please try again." dentro de "Unidad 931 · Iniciar trabajo" y debajo del campo de Notas. En el mismo estado, el diálogo de completar dice bien "No se pudo conectar con el Shop. Inténtalo de nuevo." (usa `apiErrorMessage`, `detail-client.tsx:134`). En inglés, Start y Notas muestran el mensaje crudo de la API (por ejemplo "Internal server error").
- **Criterio:** E4 (el error se entiende y dice qué hacer) · Nielsen H9
- **Severidad:** 2 · Afecta a los mecánicos que usan la app en español, en los dos lugares donde más falla la red (empezar el día, escribir una nota).
- **Recomendación:** usar `apiErrorMessage(err, messages, messages.actionFailed)` en los dos `catch`.
- **Esfuerzo:** S

### Sin conexión

### UX-6-007 · La app no detecta que no hay conexión
- **Dónde:** `apps/web` no escucha `online`/`offline` ni tiene service worker (búsqueda de `serviceWorker` y `navigator.onLine` en `src/` y `public/`: sin resultados fuera de pruebas)
- **Evidencia:** (observado) sin conexión, cada acción falla por separado con su mensaje (`evidencia/06-completar-sin-conexion.jpg`: bien resuelto en el diálogo) y nada avisa antes de tocar. Recargar sin conexión deja la pantalla en blanco (servidor de desarrollo; en producción depende del navegador, inferido).
- **Criterio:** E4 sin conexión (se detecta, se avisa, se reintenta solo)
- **Severidad:** 2 · En el taller la señal se corta; el mecánico escribe la nota o toca Complete y se entera al fallar. Lo escrito se conserva en el diálogo, así que no pierde trabajo.
- **Recomendación:** una franja "Offline · your changes are not sent" (ES "Sin conexión · no se envía nada") al detectar `offline`, y revalidar al volver `online`.
- **Esfuerzo:** M

### Sesión

### UX-6-008 · Si la sesión vence al completar o bloquear, se pierde lo escrito y vuelve al inicio
- **Dónde:** `apps/web/src/lib/api.ts:163-166` (un 401 borra el token y dispara `ltl-auth-expired`) y `detail-client.tsx:79`, `:82` (la nota de cierre y la del bloqueo viven solo en el estado del componente)
- **Evidencia:** `evidencia/06-sesion-expirada.jpg` (observado). Pasos: 1) Complete job en 604, 2) escribir "Replaced the leaking air line fitting at the rear axle.", 3) la API responde 401 → la app va a `/login`; 4) al volver a entrar llega a `/mechanic/standard`, no a Truck 604, y la nota no está.
- **Criterio:** transversal "sesión expirada": conservar lo que el usuario hacía y devolverlo ahí · Nielsen H9
- **Severidad:** 2 · Es raro (la sesión se renueva sola), la nota de cierre es opcional y el Job no se completó, así que no hay dato falso; pero el mecánico tiene que volver a buscar el camión y escribir de nuevo.
- **Recomendación:** guardar el borrador de la nota (de cierre y de bloqueo) por Job en `sessionStorage` y, tras entrar, volver a la ruta donde estaba.
- **Esfuerzo:** S

## Lo que funciona bien
- **Cargando con esqueletos** en el inicio y el detalle, con la cabecera y las pestañas ya puestas en el inicio (`evidencia/06-inicio-cargando.jpg`, `evidencia/06-detalle-cargando.jpg`).
- **Error del inicio** con mensaje y "Try again" en su lugar, debajo de las pestañas (`evidencia/06-inicio-error.jpg`).
- **Los diálogos conservan lo escrito ante un error** del servidor o sin conexión y muestran el mensaje dentro de la hoja (`evidencia/06-completar-error.jpg`, `evidencia/06-completar-sin-conexion.jpg`); el Job vuelve a su estado si el servidor rechaza (actualización optimista revertida, `detail-client.tsx:131-133`).
- **Éxito con contenido:** "You finished your part on Truck 604. Your time stopped…" (`evidencia/06-terminaste-tu-parte.jpg`), "Blocker reported. The Manager will resolve it." y el bloqueo aparece arriba (`evidencia/06-bloqueo-reportado.jpg`), "Work request sent to your Manager." con la entrada "Waiting for Manager" (`evidencia/07-pedir-trabajo-enviado.jpg`).
- **Vacíos con texto:** inicio sin trabajo ("No assigned work in progress. Ask your Shop Manager to create a Work Order.", `evidencia/06-inicio-vacio.jpg`) y búsqueda sin resultados ("No trucks found.", `evidencia/06-unidades-sin-resultados.jpg`).

## Fuera de alcance / no verificado
- **Vacío del inicio:** se simuló vaciando la respuesta de la API (Anthony tiene trabajo).
- **Report Blocker y nota al bloqueo con error:** no se provocaron; usan el mismo `run` que Complete job (inferido del código).
- **Recuperación sola al volver la red:** SWR revalida al recuperar foco o conexión; no se midió.
- **Producción y la app instalada (PWA):** no verificado.
- **"Paused by the Manager" con datos y el aviso de la pausa en el detalle (`detail-client.tsx:344-346`):** WO-009 no es de Anthony.
