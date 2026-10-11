# 01 · Fundamentos de usabilidad — Lightning Shop, modo demo

**Fecha:** 2026-10-10 · **Alcance:** Panel de demo (botón, grilla de cuentas, selector de historia, tarjeta de paso, Reset/Leave), `/login` con "Enter demo mode", y las pantallas que recorren los flujos 2–7 del contexto en laptop (1290 px) con la base demo recién armada: Dashboard, Yard, Work Orders, Trucks, Truck, Work Order (Admin), People, Shop workflow, Job Catalog, History, Parts & costs; `/mechanic/standard` y sus pestañas, `/work-orders/[id]` (mecánico y PM), `/mechanic/pm`, `/qc`. · **Método:** código + navegador (ensayo completo de las 23 historias del 2026-10-09/10 y esta pasada).
**Resumen:** 12 hallazgos, 4 de severidad 3–4. El patrón dominante: **el presentador puede quedarse sin demo delante del público sin saber por qué** (sesión de Admin que vence y rebota a otro host, "Enter demo mode" inalcanzable una vez dentro, cambios de cuenta sin feedback). Las pantallas del producto que recorre la demo funcionan; lo que falla está en el borde entre el panel y la app.

## Hallazgos

### Flujo 1 · El presentador entra y cambia de cuenta

### UX-1-001 · Una vez dentro no hay forma de volver a encender el modo demo
- **Dónde:** `/login` · `apps/web/src/app/login/page.tsx:40-53` (redirige al inicio del usuario apenas hay token) y `:188-196` (el botón "Enter demo mode" vive solo ahí)
- **Evidencia:** (observado) con sesión de Daniel y el modo apagado tras "Leave demo mode", abrir `http://127.0.0.1:3042/login` lleva a `/mechanic/pm`; el botón nunca se ve. Única salida: menú de perfil → Sign out → volver a `/login`.
- **Criterio:** Nielsen H3 (control y libertad del usuario); H7 (flexibilidad)
- **Severidad:** 3 · Pasa cada vez que el presentador toca "Leave" por error o abre la app ya logueado; con público delante, salir y volver a entrar rompe el hilo.
- **Recomendación:** En builds locales, el menú de perfil (`ProfileDialog`, `ui.tsx`) ofrece "Demo mode: On/Off" (misma función que el botón de `/login`); y "Leave demo mode" dice dónde volver a encenderlo. Alternativa mínima: `/login?demo=1` no redirige y muestra el botón.
- **Esfuerzo:** S

### UX-1-002 · Al cambiar de cuenta la pantalla se queda muda entre 3 y 10 segundos
- **Dónde:** Panel → grilla de cuentas / paso que cambia de usuario · `apps/web/src/lib/demo/demo-context.tsx:96-118` (`switchTo`: POST cookie, token, `window.location.assign`) y `apps/web/src/components/demo-panel.tsx:109-120` (solo `disabled` mientras `busy`)
- **Evidencia:** (observado) en el ensayo cada cambio tardó 8–10 s con `next dev` (compila la ruta la primera vez); durante ese tiempo el botón queda gris y nada dice "switching…". El presentador tocó dos veces en una ocasión.
- **Criterio:** Nielsen H1 (visibilidad del estado del sistema)
- **Severidad:** 3 · Ocurre en todos los cambios de cuenta (≥ 15 por demo); el doble toque reinicia la navegación.
- **Recomendación:** Mientras `busy`, mostrar en el panel una línea "Switching to MG1 · Mecánico General…" con spinner, y el botón de la cuenta destino en estado activo. Para presentar, usar la variante con build de producción (`next build && next start`) que `start-demo.sh` podría ofrecer con `DEMO_FAST=1`.
- **Esfuerzo:** S (feedback) · M (build en el script)

### UX-1-003 · La sesión de Admin vence a la hora y el rebote cambia de host: la demo "desaparece"
- **Dónde:** `/admin/*` · `apps/web/src/middleware.ts:38-42` (`loginRedirect` arma `new URL('/login', request.url)`) y `apps/web/src/app/api/admin/session/route.ts:29` (`maxAge: 60 * 60`); el panel solo renueva la cookie en pasos de historia (`demo-context.tsx:141`)
- **Evidencia:** (observado) tras más de una hora como mecánico, escribir `http://127.0.0.1:3042/admin` llevó a `http://localhost:3042/login?next=%2Fadmin`: otro origen, sin token ni estado de demo en `localStorage`, formulario de login vacío y sin botón Demo. Para el presentador: "me sacó y perdí la demo".
- **Criterio:** Nielsen H1 (estado del sistema), H9 (recuperarse de errores)
- **Severidad:** 4 · Una demo dura más de una hora; navegar a mano al Admin es normal; el resultado parece una falla de la app.
- **Recomendación:** (1) `loginRedirect` toma el host del header `Host`/`x-forwarded-host`; comprobado que `next dev` igual reescribe la Location a su hostname, así que la demo se abre siempre en `http://localhost:3042` (DEMO.md y `start-demo.sh` lo dicen). (2) Con el modo demo encendido, renovar la cookie de Admin cada 20 min mientras el usuario tenga `admin.access` (un `setInterval` en `DemoModeProvider` que llame `refreshAdminSessionCookie`). (3) `/login?next=` recupera el estado del panel si el host coincide.
- **Esfuerzo:** S

### UX-1-004 · Las cuentas reales del dueño aparecen en "Others" y en los selectores de la app
- **Dónde:** Panel, grupo "Others" (`demo-panel.tsx:126-148`); Admin → Work Order → selector de mecánico; People
- **Evidencia:** `evidencia/01-panel-abierto-pm.jpg` (observado): "Cristian · mechanic", "Cristian Perez · admin", "iBrain Admin · admin" con el rol crudo en minúsculas.
- **Criterio:** Nielsen H8 (diseño minimalista); H2 (correspondencia con el mundo real)
- **Severidad:** 2 · Confunde a la audiencia ("¿quién es iBrain?") pero no bloquea.
- **Recomendación:** Ya decidido (PR B): el armado de la demo saca del Shop a las cuentas que no son del roster; el panel deja de mostrar "Others" salvo que exista alguna.
- **Esfuerzo:** S (va en PR B)

### UX-1-005 · "Reset demo" sugiere que reinicia los datos y no lo hace
- **Dónde:** Panel, pie · `demo-panel.tsx:234-236`; explicación escondida en "What each button does" (`:228`)
- **Evidencia:** (observado) el botón es el más grande del panel; su efecto real es "ir al Dashboard del Manager y cerrar la historia". El texto que lo aclara está dentro de un `<details>` plegado.
- **Criterio:** Nielsen H2 (lenguaje del usuario); H5 (prevención de errores)
- **Severidad:** 2 · Un presentador que espera "datos como al principio" lo descubre a mitad de la historia.
- **Recomendación:** Renombrar a "Back to the Manager dashboard" y mover la frase "Data is not rebuilt; run `prisma:demo-local`" debajo del botón, visible.
- **Esfuerzo:** S

### UX-1-006 · "Leave demo mode" se ejecuta con un toque y no explica cómo volver
- **Dónde:** Panel, pie · `demo-panel.tsx:237-243`
- **Evidencia:** (observado) un toque esconde el panel y el botón Demo; no hay confirmación ni aviso. Combinado con UX-1-001, volver cuesta un sign-out.
- **Criterio:** Nielsen H3 (control y libertad), H5 (prevención de errores)
- **Severidad:** 2
- **Recomendación:** Confirmación en línea ("Leave demo mode? You can turn it on again from the profile menu.") o deshacer en un toast de 5 s.
- **Esfuerzo:** S

### Flujo 8 · El presentador sigue una historia paso a paso

### UX-1-007 · Las historias se llaman por código (HU-M4, J3) y nadie del taller sabe qué significa
- **Dónde:** Panel → selector "Story" · `demo-panel.tsx:160-175`
- **Evidencia:** (observado) opciones "HU-M4 · Unblock a truck (4 steps)" agrupadas bajo "J3 · Something stops a truck…"; el dueño lo señaló el 2026-10-10 ("las historias de usuario no me quedan claro").
- **Criterio:** Nielsen H2 (correspondencia con el mundo real); H6 (reconocer antes que recordar)
- **Severidad:** 3 · El presentador tiene que traducir el código mentalmente con público delante.
- **Recomendación:** Ya decidido (PR C): un "Demo flow" continuo con capítulos y, debajo, las historias agrupadas por quién las hace con títulos en lenguaje de usuario ("A truck arrives (973)"); el id HU queda como etiqueta pequeña en la tarjeta.
- **Esfuerzo:** M (va en PR C)

### UX-1-008 · Con el seguimiento automático apagado, el paso no dice que hay que cambiar de cuenta
- **Dónde:** Tarjeta de paso · `demo-panel.tsx:184-186` (badge ámbar con el nombre, sin texto)
- **Evidencia:** (observado) HU-M4 paso 3 con auto-follow apagado y sesión de Manager: el chip "Elliot" cambia a ámbar y nada más; "Do" habla de la tarjeta de Elliot que el Manager no ve.
- **Criterio:** Nielsen H1 (estado del sistema); H6 (reconocer)
- **Severidad:** 2 · Solo con auto-follow apagado (uso poco frecuente), pero sin pista.
- **Recomendación:** Debajo de los chips: "You are MS; this step is MG2's. Go to screen switches for you."
- **Esfuerzo:** S

### UX-1-009 · "Finish" en el último paso borra la historia sin cerrar nada
- **Dónde:** Tarjeta de paso · `demo-panel.tsx:203`
- **Evidencia:** (observado) al tocar Finish el selector vuelve a "None" y aparece la grilla completa de cuentas; no hay un "Done · 4 of 4" ni sugerencia de qué sigue.
- **Criterio:** Nielsen H1 (estado del sistema)
- **Severidad:** 1
- **Recomendación:** Al terminar, dejar la tarjeta en estado "Story finished" con "Next story" (la siguiente del mismo grupo) y "Close".
- **Esfuerzo:** S

### UX-1-010 · En teléfono el panel tapa casi toda la pantalla y hay que cerrarlo en cada paso
- **Dónde:** Panel a < 1000 px · `demo-panel.tsx:74` (`inset-x-3 bottom-3 max-h-[75vh]`) y `globals.css` (columna reservada solo desde 1000/1200 px)
- **Evidencia:** (observado) a 375 px el panel abierto ocupa el 75 % de alto; para tocar el botón del paso hay que cerrarlo con la X y reabrirlo con "Demo".
- **Criterio:** Nielsen H7 (flexibilidad y eficiencia); H8 (minimalismo)
- **Severidad:** 2 · El teléfono es secundario en la demo (contexto §1), pero es donde se muestra la app del mecánico.
- **Recomendación:** En teléfono, el panel abierto se reduce a una barra inferior con "Step n of m · título" y Back/Next; el detalle (Do/Say) se despliega al tocarla.
- **Esfuerzo:** M

### Flujos 2–7 · Las pantallas que recorre la demo

### UX-1-011 · La pestaña "Trucks" del mecánico exige recordar el número de unidad
- **Dónde:** `/mechanic/standard/trucks` y `/mechanic/pm/trucks` · `apps/web/src/components/mechanic-trucks-page.tsx`; copia `locale-context.tsx:842` ("Find a Truck")
- **Evidencia:** (observado) la pantalla es un buscador vacío; el mecánico no ve sus camiones ni los del taller hasta escribir "605". En la demo, el paso tuvo que decir "type 605".
- **Criterio:** Nielsen H6 (reconocer antes que recordar)
- **Severidad:** 2 · En el taller el mecánico tiene el número a la vista; en una demo, el presentador necesita el guion. (Ya señalado en `mecanico-general/01-usabilidad.md`; se repite porque afecta al flujo de demo.)
- **Recomendación:** Debajo del buscador, "Trucks with your Jobs" (sus Work Orders abiertos) como lista de acceso rápido.
- **Esfuerzo:** M

### UX-1-012 · La lista de Work Orders no dice el siguiente paso de un camión Ready to Go
- **Dónde:** `/admin/work-orders`, columna Next · `apps/web/src/components/admin-work-orders-list.tsx`
- **Evidencia:** (observado) WO-063 de 607 muestra "4 Jobs · all done" mientras la lista de Trucks dice "Ready to Go. Return it to service when it leaves the shop." (OPEN_ISSUES DM1).
- **Criterio:** Nielsen H4 (consistencia)
- **Severidad:** 2
- **Recomendación:** Reusar el helper del siguiente paso (`lib/admin-next-step.ts`) en la columna Next.
- **Esfuerzo:** S (ya en OPEN_ISSUES §1p, DM1)

## Lo que funciona bien
- Cambiar de cuenta recarga la página: nunca queda una fila del usuario anterior y la cookie de Admin llega antes que el middleware (ensayo completo sin un solo rebote por este motivo).
- La tarjeta de paso separa "Do / Say / Expect" y marca "Changes data": el presentador sabe qué toca, qué dice y qué debe ver.
- El panel deja su columna libre en laptop: ningún botón del producto queda tapado (corregido en PR 285).
- Las cuentas que no existen en la base aparecen deshabilitadas con "inactive" en vez de fallar con un 403 al tocarlas.
- Las pantallas del producto responden a cada acción del guion con el texto que el guion cita (Resolve, Resume, Close, Return to Service, Take/Approve, Mark handled).

## Fuera de alcance / no verificado
- Teléfono real (solo emulación a 375 px); Safari.
- El build de producción para la demo (`next start`) no se midió: los tiempos de UX-1-002 son de `next dev`.
- Dispatch/Samsara/archivos: no existen en local.

## Para otras skills
- Textos del panel con jerga ("USER_FLOWS", "AUTH_DEV_BYPASS", "auto-follow"): skill 3.
- Jerarquía dentro del panel (Reset más grande que Next; grilla de 10 botones iguales): skill 4.
- Estado "loading" tras el cambio de cuenta y mensajes de error del panel: skill 6.
