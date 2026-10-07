# 06 · Estados del sistema — Lightning Shop, pantalla de Safety (Quality Check)

**Fecha:** 2026-10-07 · **Alcance:** `/qc` (lista, Take, Approve, Return) con Safety 1, teléfono 375 px · **Método:** código + navegador (demo local; los fallos se provocaron interceptando la API con Playwright)
**Resumen:** 5 hallazgos, 1 de severidad 3. Carga y error del servidor están bien resueltos con los componentes comunes (`CardListSkeleton`, `LoadFailure`). Lo descuidado es lo que pasa **después de una acción que falla**: el aviso de error de la lista convive con la lista vieja, y una sesión vencida a mitad de "Return" se lleva lo escrito.

## Matriz pantalla × estado

`✓` correcto · `△` existe pero deficiente · `✗` no existe · `–` no aplica · `?` no verificado

| Pantalla / acción | Vacío | Cargando | Parcial | Error | Éxito | Deshab. | Sesión | Sin conexión |
|---|---|---|---|---|---|---|---|---|
| Lista "To review" | △ UX-6-001 | ✓ | – | ✓ | – | △ UX-6-004 | – | △ UX-6-002 |
| Lista "Returned" | ✓ | ✓ | – | ✓ | – | – | – | ? |
| Take | – | ✓ | – | ✓ | ✓ | ✓ | ? | △ UX-6-002 |
| Approve | – | ✓ | – | ? | △ UX-6-005 | ✓ | ? | ? |
| Return (diálogo) | – | ✓ | – | ✓ (nota vacía) | ✓ | ✓ | ✗ UX-6-003 | ? |
| Otro rol entra a `/qc` | – | – | – | ✓ (redirige a su inicio) | – | – | – | – |

## Hallazgos

### Vacío

### UX-6-001 · La lista vacía no dice cuándo llegan camiones ni qué hacer mientras
- **Dónde:** `/qc` sin camiones listos · `apps/web/src/components/quality-check-page.tsx:84` (`<EmptyState>{t.empty}</EmptyState>`)
- **Evidencia:** `evidencia/06-vacio.jpg` (observado). "No trucks are waiting for Quality Check." y, debajo, "Nothing returned.". Es lo que Safety ve la mayor parte del día.
- **Criterio:** E1 vacío (explicar qué es y qué sigue) · Nielsen H10
- **Severidad:** 2 · No bloquea, pero no distingue "no hay nada" de "algo falló" y no ofrece ver lo que ya revisó.
- **Recomendación:** "Nothing to review. Trucks appear here when every other step is done." más el enlace a "Done" (lo revisado hoy), como en la propuesta.
- **Esfuerzo:** S

### Error y sin conexión

### UX-6-002 · Sin conexión, la pantalla dice que la lista no cargó mientras la muestra
- **Dónde:** `quality-check-page.tsx:62-65` (en el `catch` pone `actionError` **y** llama `mutate()`, que también falla y enciende `LoadFailure` de la línea 77)
- **Evidencia:** `evidencia/06-sin-conexion-take.jpg` (observado). Con la red cortada, tocar Take muestra dos avisos rojos apilados: "The Quality Check list could not be loaded. · Try again" y "Unable to reach the Shop. Please try again.", y debajo la lista completa con "Take" activo. No hay aviso previo de que no hay conexión.
- **Criterio:** E4 error de sistema / sin conexión · Nielsen H1 y H9
- **Severidad:** 2 · En el patio la señal se corta; Safety ve dos mensajes que se contradicen con lo que tiene debajo y no sabe si el Take se hizo.
- **Recomendación:** un solo aviso por causa: si hay datos en pantalla, mantenerlos con una franja "Offline · showing the list from 10:42" y desactivar las acciones; el error de la acción va junto a la tarjeta. Escuchar `online`/`offline` para reintentar solo.
- **Esfuerzo:** M

### UX-6-003 · Si la sesión vence al devolver, se pierde la nota
- **Dónde:** `apps/web/src/lib/api.ts:163-166` (un 401 borra el token y dispara `ltl-auth-expired`) y `quality-check-page.tsx:33` (la nota vive solo en el estado del componente)
- **Evidencia:** `evidencia/06-sesion-expirada.jpg` (observado). Pasos: 1) Take, 2) Return, 3) escribir "Session test note", 4) la API responde 401 → la app va a `/login`; la nota no se conserva.
- **Criterio:** E4 / transversal "sesión expirada": conservar lo que el usuario hacía · Nielsen H9
- **Severidad:** 3 · Es raro (la sesión se renueva sola), pero cuando pasa Safety pierde la descripción del defecto, que es lo único que el Manager recibe.
- **Recomendación:** guardar el borrador de la nota por camión en `sessionStorage` mientras se escribe y restaurarlo al volver a `/qc` (cubre también UX-1-006).
- **Esfuerzo:** S

### Transversales

### UX-6-004 · El "Take" apagado no dice por qué
- **Dónde:** `quality-check-page.tsx:117`
- **Evidencia:** `evidencia/01-other-sees-taken.jpg` (observado). Mismo caso que UX-1-008; aquí cuenta como estado deshabilitado sin explicación junto al control.
- **Criterio:** transversal "deshabilitado: se ve que no se puede y por qué"
- **Severidad:** 1 · La etiqueta "Taken by Safety 1" está encima y lo explica a medias.
- **Recomendación:** ver UX-1-008 (quitar el botón).
- **Esfuerzo:** S

### Éxito

### UX-6-005 · Approve confirma con un toast y el camión desaparece
- **Dónde:** `quality-check-page.tsx:56`
- **Evidencia:** `evidencia/01-after-approve.jpg` (observado). "Truck 606 approved" en un toast; la lista queda vacía y no hay rastro del camión.
- **Criterio:** E5 éxito proporcional a la consecuencia (el camión queda listo para cerrar)
- **Severidad:** 2 · Mismo efecto que UX-1-004: no se puede comprobar después.
- **Recomendación:** ver UX-1-004 (pestaña Done); el toast puede ofrecer "View" hacia esa pestaña.
- **Esfuerzo:** S (con la pestaña hecha)

## Lo que funciona bien
- **Cargando con esqueletos** del tamaño de las tarjetas, sin saltos (`evidencia/06-cargando.jpg`).
- **Error del servidor** con mensaje propio y "Try again" en su lugar (`evidencia/06-error-sistema.jpg`).
- **Choque entre las dos personas de Safety:** si la otra tomó el camión, sale "Another Safety reviewer already took this truck." y la lista se recarga (`evidencia/06-conflicto-take.jpg`).
- **Otro rol** que abre `/qc` vuelve a su propio inicio (un mecánico cae en `/mechanic/standard`).
- Todas las acciones deshabilitan los botones mientras corren.

## Fuera de alcance / no verificado
- **Approve y Return sin conexión:** solo se probó Take; usan el mismo `catch` y se espera lo mismo (inferido del código).
- **Recuperación al volver la red:** no se midió si los avisos se van solos; SWR revalida al recuperar foco o conexión.
- **Producción:** no verificado.
