# 03 · Contenido y lenguaje — Lightning Shop, modo demo

**Fecha:** 2026-10-10 · **Alcance:** todos los textos del Panel de demo y de "Enter demo mode" (`apps/web/src/components/demo-panel.tsx`, `apps/web/src/lib/demo/demo-context.tsx`, `apps/web/src/app/login/page.tsx`), el guion de las 23 historias (`apps/web/src/lib/demo/scripts.ts`, ~99 pasos), y los textos de la app que el guion cita en las pantallas de los flujos 2–7 (`admin-messages.ts`, `locale-context.tsx`) · **Método:** código (inventario completo del panel y el guion) + navegador (ensayo de las 23 historias).
**Resumen:** 9 hallazgos, 2 de severidad 3. El panel habla a veces como el repositorio ("USER_FLOWS", "AUTH_DEV_BYPASS", "auto-follow") y no como un presentador; el guion mezcla códigos de historia que nadie del taller conoce con nombres de persona que van a cambiar. Los errores de la API no llegan crudos al panel: tiene sus propios mensajes, pero técnicos.

## Hallazgos

### UX-3-001 · El selector de historias habla en código: "HU-M4", "J3", "USER_FLOWS"
- **Dónde:** Panel → selector · `demo-panel.tsx:153` ("Story · one of USER_FLOWS, step by step"), `:164` (optgroup `J3 · …`), `:166` (`HU-M4 · Unblock a truck (4 steps)`)
- **Evidencia:** `evidencia/04-panel-historia-dashboard-laptop.jpg` (observado). "USER_FLOWS" es el nombre de un archivo de `docs/`; "HU" y "J" son ids internos.
- **Criterio:** Lenguaje del usuario, no del sistema (Nielsen H2); vocabulario del taller
- **Severidad:** 3 · El presentador lo lee en voz alta con público; tiene que traducirlo cada vez.
- **Recomendación:** Caption "Story" a secas. Opciones sin código: "A truck arrives (973)", "Unblock a truck (605, 609)". Grupos por quién: "Manager Shop (MS)", "Mecánicos (MG, MA, MD)", "PM (MPM)", "Quality Check (QC)", "Admin (AS)". El id HU como etiqueta pequeña en la tarjeta ("HU-M4"). Ya decidido en PR C.
- **Esfuerzo:** S (texto) · va con PR C

### UX-3-002 · Nombres de persona donde la audiencia espera un rol
- **Dónde:** Grilla de cuentas (`cast.ts`: "Anthony", "Elliot", "Alejandro 1"…), guion (`scripts.ts`: 30 menciones: "blocked by Elliot", "PM on Daniel", "Handled by Shop Manager"), avatares e iniciales en toda la app ("A1", "DA", "S1")
- **Evidencia:** `evidencia/01-panel-abierto-pm.jpg` (observado). El dueño lo señaló el 2026-10-10: "estamos usando nombres de personas y deberíamos tener usuarios por rol (MG1, MPM, QC…)".
- **Criterio:** Correspondencia con el mundo real (H2); consistencia con el roster de producción (`test-roster-plan.ts` ya usa MG, MPM, MD, MA)
- **Severidad:** 3 · Cada pantalla de la demo repite el problema; la audiencia no sabe qué perfil está viendo.
- **Recomendación:** Ya decidido (PR B): cuentas "MS · Manager Shop", "AS · Admin Shop", "MG1–MG3 · Mecánico General", "MA · Mecánico Alineación", "MD · Mecánico Detailing", "MPM · Mecánico PM", "QC1/QC2 · Quality Check"; el guion dice "blocked by MG2"; las iniciales muestran el código (MG1, QC2).
- **Esfuerzo:** M · va con PR B

### UX-3-003 · Los mensajes de error del panel son para quien programó, no para quien presenta
- **Dónde:** `demo-context.tsx:112-113` ("The API did not answer. Is demo-api running (npm run start:demo)?"; "Could not switch to … (HTTP 403). Is the account active, and does the API have AUTH_DEV_BYPASS=true?"), `:131-132` ("Did you rebuild the demo (npm run prisma:demo-local)?"), `demo-panel.tsx:94` ("Does the API run with AUTH_DEV_BYPASS=true?"), `:230` ("needs a local build and an API with AUTH_DEV_BYPASS=true")
- **Evidencia:** (inferido del código; el error de "truck list not loaded" se observó una vez en el ensayo). Los comandos son correctos pero la frase no dice qué hacer primero.
- **Criterio:** Errores que dicen qué pasó y qué hacer, en lenguaje llano (H9)
- **Severidad:** 2 · Solo aparecen cuando algo está mal configurado, y el presentador es el dueño, que conoce los comandos.
- **Recomendación:** Dos niveles: frase llana primero, comando después en monoespaciado. "The demo server is not answering. Start it from a terminal: `npm run start:demo`." · "This account is not active in the demo database. Rebuild the demo: `npm run prisma:demo-local`." · "Truck 605 has no open Work Order here. The demo data was used up: rebuild it with `npm run prisma:demo-local`."
- **Esfuerzo:** S

### UX-3-004 · "Reset demo" promete lo que no hace; "Leave demo mode" no dice adónde lleva
- **Dónde:** `demo-panel.tsx:234-243`
- **Evidencia:** (observado) Reset = ir al Dashboard del Manager y cerrar la historia; Leave = esconder panel y botón. La aclaración está plegada en "What each button does".
- **Criterio:** Los botones dicen qué va a pasar (verbo + objeto)
- **Severidad:** 2
- **Recomendación:** "Back to the Manager dashboard" y, debajo, en gris: "Data stays as it is. To start over, rebuild the demo (`prisma:demo-local`)." · "Turn demo mode off" con la línea "Turn it on again from your profile menu." (depende de UX-1-001).
- **Esfuerzo:** S

### UX-3-005 · "Switch user and screen automatically" describe el mecanismo, no el beneficio; "Go to screen" compite con "Next"
- **Dónde:** `demo-panel.tsx:205` y `:209-217`
- **Evidencia:** (observado) la casilla está lejos de los botones a los que afecta; "Go to screen" aparece siempre aunque con auto-follow encendido casi nunca hace falta.
- **Criterio:** Etiquetas que dicen el efecto; ayuda donde se necesita
- **Severidad:** 1
- **Recomendación:** Casilla junto a los botones de paso: "Follow each step (switch account and open the screen)". "Go to screen" solo visible con la casilla apagada o cuando el presentador se fue de la pantalla del paso ("Back to this step's screen").
- **Esfuerzo:** S

### UX-3-006 · Rol del usuario en crudo en el pie del menú del Admin
- **Dónde:** `/admin`, pie de la barra lateral · `admin-shell.tsx:148` (`{user.role}` con `capitalize`)
- **Evidencia:** (observado) "Manager", "Admin" bajo el nombre; para una cuenta "MS · Manager Shop" diría "Manager" dos veces; para "mechanic" nunca aparece porque no entra al Admin.
- **Criterio:** Un término por concepto (glosario: "Shop Manager", "System Admin")
- **Severidad:** 1
- **Recomendación:** Usar las etiquetas del catálogo: `messages.roleManager` / `roleSystemAdmin` ("Shop Manager", "System Admin"; ES "Shop Manager", "System Admin").
- **Esfuerzo:** S

### UX-3-007 · Plurales con uno: "1 open Work Orders", "1 parts", "1 lines"
- **Dónde:** `admin-messages.ts:408` (`shopWorkflowMemberOpenWork`), `:83` (`pcVendorPartCountValue`), `:115` (`pcLinesCount`), `:976` (`dashboardOpenLink`)
- **Evidencia:** (observado) Shop workflow → Add: "1 open Work Orders" (John); Vendors: "1 parts" (FleetPride); Purchases: "1 lines". (OPEN_ISSUES DM3.)
- **Criterio:** Formato de cantidades
- **Severidad:** 1
- **Recomendación:** Plantillas con singular/plural ("{count, plural, one {# open Work Order} other {# open Work Orders}}" o dos claves) en EN y ES; hay un `fillPlaceholders` en `lib/admin-next-step.ts` que puede recibir `{count}` y elegir la clave.
- **Esfuerzo:** S (ya en OPEN_ISSUES §1p, DM3)

### UX-3-008 · El texto del paso cita cadenas de la app que cambian con el idioma del perfil
- **Dónde:** `scripts.ts` (`do`/`expect` citan "Needs you", "Ready to Start", "Yesterday's work is still open…")
- **Evidencia:** (observado) con la app en español (cookie `ltl_shop_locale=es`) la pantalla dice "Te necesita", "Listos para iniciar"; el guion sigue en inglés y las citas ya no coinciden con lo que ve la audiencia.
- **Criterio:** Coherencia entre lo que se lee y lo que se ve
- **Severidad:** 2 · Solo si el presentador pone la app en español para la audiencia (probable, contexto §1).
- **Recomendación:** O bien la guía de DEMO.md fija "presentar con la app en inglés", o bien el panel muestra un aviso cuando `locale === 'es'`: "The app is in Spanish; the step quotes the English labels." Las citas entre comillas en los pasos se reducen a lo imprescindible (botones), que el presentador reconoce en cualquier idioma por posición.
- **Esfuerzo:** S (aviso) · M (citas bilingües)

### UX-3-009 · Dos nombres para la misma pestaña: "Dispatch" en pantalla, "Movement" en la URL y en el guion anterior
- **Dónde:** `/admin/yard-operations?tab=movement` (pestaña visible "Dispatch"); `admin-yard-operations.tsx:57,119`
- **Evidencia:** (observado) el guion decía "Movement tab" y la pestaña se llama "Dispatch"; corregido en PR 285, pero la URL conserva `movement`.
- **Criterio:** Un término por concepto
- **Severidad:** 1
- **Recomendación:** Dejar `?tab=dispatch` (aceptando `movement` como alias viejo) o documentar el alias en el glosario.
- **Esfuerzo:** S

## Glosario propuesto

| Término recomendado | Sinónimos encontrados | Dónde |
|---|---|---|
| Story (una historia de la demo) | "HU-M4", "user story", "USER_FLOWS" | panel, selector, `scripts.ts` |
| Demo flow (el recorrido con capítulos) | — (no existe aún) | PR C |
| Account (cuenta de la demo) / role code (MS, MG1…) | "user", "cast", "Anthony", "Alejandro 1" | panel, `cast.ts`, docs |
| Shop Manager / System Admin | "Manager", "Admin", "manager", "admin" | pie del menú Admin, grupo "Others" |
| Quality Check (paso) / Safety (persona) | "QC", "Safety 1", "Safety (Quality Check)" | `/qc`, People, panel |
| Dispatch (pestaña del Yard) | "Movement", `tab=movement` | Yard, URL |
| Demo server | "demo-api", "API", "AUTH_DEV_BYPASS" | errores del panel |
| Rebuild the demo (`prisma:demo-local`) | "reset", "rearmar", "Reset demo" | panel, DEMO.md |

## Guía de voz observada

Domina una voz directa y en segunda persona ("Tap Resolve", "Show the card"), en inglés, igual que la app. Se rompe en los errores y en la ayuda del panel, que pasan al registro del desarrollador (nombres de archivos, variables de entorno, comandos sin contexto). Recomendación: en el panel, primero la frase para el presentador en lenguaje llano y después, si hace falta, el comando en monoespaciado; nunca una variable de entorno sin explicar qué es.

## Lo que funciona bien
- "Do / Say / Expect" es un formato que se lee de un vistazo y separa lo que se hace de lo que se explica.
- Las pistas de cada cuenta ("Clock running on 604; team queue") dicen qué se va a ver antes de cambiar.
- Los textos de la app que recorre la demo son consistentes con el glosario del producto (Work Order, Truck, Job, Ready to Go, Return to Service) en inglés y en español.
- Los errores de la API no llegan crudos: el panel los traduce a frases propias.

## Fuera de alcance / no verificado
- Ortografía del guion en inglés: revisada por lectura, no con corrector.
- La versión en español del panel no existe por decisión del dueño; no se audita.
