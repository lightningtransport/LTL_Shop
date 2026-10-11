# 06 · Estados del sistema — Lightning Shop, modo demo

**Fecha:** 2026-10-10 · **Alcance:** el Panel de demo y la entrada desde `/login` en cada estado (cargando, vacío, cambiando de cuenta, error, sesión vencida, datos consumidos, fuera de horario); las pantallas del producto solo en los estados que la demo provoca · **Método:** código (`demo-context.tsx`, `demo-panel.tsx`, `switch-user.ts`, `middleware.ts`, `login/page.tsx`) + navegador (ensayo completo y pruebas de esta pasada).
**Resumen:** 7 hallazgos, 2 de severidad 3–4. El estado más descuidado es **"cambiando de cuenta"**: entre que el presentador toca y la nueva página aparece no hay ningún indicador. El segundo es **"sesión de Admin vencida"**, que termina en otro host sin estado. Los errores sí existen y no bloquean, aunque hablan en jerga (skill 3).

## Matriz pantalla × estado

✓ existe y orienta · △ existe pero incompleto · ✗ no existe · — no aplica · ? no verificado

| Pantalla / estado | Cargando | Vacío | Cambiando / guardando | Error | Sesión vencida | Datos consumidos | Fuera de horario |
|---|---|---|---|---|---|---|---|
| `/login` + "Enter demo mode" | ✓ (loader y skeleton de sesión) | — | △ botón `disabled` mientras `busy` (UX-6-005) | ✓ `InlineAlert` con copia del catálogo | — | — | — |
| Panel · grilla de cuentas | △ botones activos antes de que llegue la lista (UX-6-001) | ✓ "Others" solo si hay | ✗ sin texto ni spinner (UX-6-002) | △ `InlineAlert` técnico (UX-3-003) | ✗ rebote a otro host (UX-6-004) | — | ✓ aviso "After 5 PM…" |
| Panel · historia y tarjeta de paso | ✓ reabre en el mismo paso tras recargar | △ "Finish" vuelve a "None" sin estado final (UX-1-009) | ✗ al cambiar de cuenta en un paso (UX-6-002) | ✓ camión/WO no encontrado: mensaje y no navega | ✗ (UX-6-004) | △ "Changes data" avisa antes, nada después (UX-6-006) | ✓ |
| Panel · lista de camiones (resolver) | △ "The truck list has not loaded yet. Try again in a second." pide reintentar a mano (UX-6-003) | — | — | ✓ | — | — | — |
| Pantalla del producto tras el cambio | △ "Loading work order" plano varios segundos con `next dev` (UX-6-007) | — | — | ✓ `LoadFailure` con Retry | ✓ `/login?next=` | — | — |
| Página "workspace not available" / acceso denegado | — | ✓ texto y "Go to your Shop home" | — | — | — | — | — |

## Hallazgos

### Cargando

### UX-6-001 · Los botones de cuenta se pueden tocar antes de saber si la cuenta existe
- **Dónde:** `demo-panel.tsx:107` (`const known = demo.users ? activeEmails.has(member.email) : true`)
- **Evidencia:** (inferido del código; observado que la lista tarda < 1 s en local) Mientras `demo.users` es `undefined`, todas las cuentas parecen disponibles; si la base no tiene una, el toque termina en el error de HTTP 403.
- **Criterio:** Estado cargando distinguible; no ofrecer acciones cuya validez no se conoce
- **Severidad:** 1 · Ventana muy corta en local.
- **Recomendación:** Mientras no haya lista, botones en estado "cargando" (opacidad y sin `onClick`), o una línea "Loading accounts…".
- **Esfuerzo:** S

### Cambiando de cuenta / guardando

### UX-6-002 · Entre tocar una cuenta y ver la nueva pantalla no hay ningún estado
- **Dónde:** `demo-context.tsx:96-118` (`setBusy(true)` → POST → `location.assign`), `demo-panel.tsx:112` (solo `disabled`)
- **Evidencia:** (observado) 3–10 s en el ensayo con `next dev`; el panel sigue mostrando la cuenta vieja como activa; en un caso el presentador volvió a tocar. Sin captura posible: el estado no pinta nada.
- **Criterio:** Durante una acción de más de 1 s, indicador de progreso con nombre de lo que pasa
- **Severidad:** 3 · Es la acción más repetida de la demo.
- **Recomendación:** Línea de estado en el panel: spinner + "Switching to MG1 · Mecánico General…"; la cuenta destino con el estilo activo; el resto en gris. Guardar en el estado de la demo `switchingTo` para que el documento nuevo pueda mostrar "Signed in as MG1" un segundo al llegar.
- **Esfuerzo:** S

### UX-6-003 · El resolver pide "intentar de nuevo en un segundo" en vez de esperar él
- **Dónde:** `demo-context.tsx:123-126`
- **Evidencia:** (observado una vez) al elegir una historia justo después de entrar, "The truck list has not loaded yet. Try again in a second." y el paso no navega hasta volver a tocar Next.
- **Criterio:** Las esperas cortas se absorben, no se delegan al usuario
- **Severidad:** 2
- **Recomendación:** Si `trucks` no está, esperar a la promesa de `useTrucks` (o reintentar automáticamente hasta 5 s) y navegar; mostrar "Loading trucks…" mientras tanto.
- **Esfuerzo:** S

### Sesión vencida

### UX-6-004 · La sesión de Admin vence en silencio y el rebote cambia de host
- **Dónde:** `middleware.ts:38-42`, `api/admin/session/route.ts:29` (60 min)
- **Evidencia:** (observado) ver UX-1-003.
- **Criterio:** Sesión expirada: avisar, conservar el sitio y el estado, volver al mismo lugar
- **Severidad:** 4 · (contado en UX-1-003; aquí por la matriz)
- **Recomendación:** Conservar el host en el redirect; renovar la cookie cada 20 min con el modo demo encendido; `/login?next=` vuelve al paso.
- **Esfuerzo:** S

### Éxito / confirmación

### UX-6-005 · "Enter demo mode" no confirma que el modo quedó encendido
- **Dónde:** `login/page.tsx:80-83` (escribe el estado y llama a `onDevLogin`)
- **Evidencia:** (observado) la única señal es el botón "Demo" en el encabezado de la siguiente pantalla, que el presentador puede no ver.
- **Criterio:** Éxito con contenido: qué pasó y qué sigue
- **Severidad:** 1
- **Recomendación:** Abrir el panel al llegar (ya lo hace, `panelOpen: true`) con una primera línea "Demo mode is on · you are MS · Manager Shop. Pick a story or an account." que desaparece al primer toque.
- **Esfuerzo:** S

### Datos consumidos

### UX-6-006 · Nada avisa cuando una historia ya se ejecutó y sus datos cambiaron
- **Dónde:** `scripts.ts` (`mutates: true` por paso) y `demo-panel.tsx:188` (badge "Changes data")
- **Evidencia:** (observado) HU-ME2 por segunda vez: el 603 ya no está en "Ready to Start"; el paso dice "Find 603 under Ready to Start" y no está. El resolver solo detecta camión sin WO abierto.
- **Criterio:** Estado "ya hecho" visible antes de repetir
- **Severidad:** 2 · Sucede al repetir una historia en la misma base; el presentador sabe que debe rearmar (DEMO.md), pero el panel podría recordárselo.
- **Recomendación:** Guardar en el estado de la demo qué historias se ejecutaron en esta base (fecha del armado = `max(created_at)` de los WOs demo, expuesta por `GET /api/dev/demo/users` o un endpoint `GET /api/dev/demo/build`); marcar la opción con "· done" y mostrar "You already ran this story on this build; rebuild the demo to repeat it."
- **Esfuerzo:** M

### Cargando (producto)

### UX-6-007 · Tras el cambio, la pantalla del mecánico muestra "Loading work order" en texto plano
- **Dónde:** `/work-orders/[id]` · `apps/web/src/app/work-orders/[id]/detail-client.tsx` (estado de carga)
- **Evidencia:** (observado) al entrar al Work Order de 613 como Anthony: "Loading work order" solo, 2–3 s; el Admin usa `PageSkeleton`.
- **Criterio:** Carga con esqueleto que anticipa la estructura (consistencia entre pantallas)
- **Severidad:** 1
- **Recomendación:** `PageSkeleton` (ya existe en `ui.tsx`) también aquí.
- **Esfuerzo:** S

## Lo que funciona bien
- El panel sobrevive a recargas y a cerrar sesión: vuelve a la misma historia y paso.
- Un camión sin Work Order abierto o inexistente no rompe nada: mensaje claro y el paso no navega.
- Las pantallas del producto que la demo recorre tienen cargando, vacío, error y confirmación diseñados (auditorías anteriores) y responden a cada acción del guion con un toast o un cambio visible.
- El aviso de las 5 PM aparece solo cuando aplica.

## Fuera de alcance / no verificado
- API caída a mitad de la demo: no se probó apagando el servidor (otra sesión usa la base); por código el panel muestra "The API did not answer…" y el producto `LoadFailure`.
- Celdas `?`: ninguna; lo no probado se marca en la columna correspondiente como inferido.
