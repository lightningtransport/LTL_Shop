# Auditoría UX — Lightning Shop, modo demo (Panel de demo y pantallas del flujo)

**Fecha:** 2026-10-10 · **Alcance:** el Panel de demo (D36) en laptop y teléfono, la entrada desde `/login`, y las pantallas de la app que recorre la demo en los cinco perfiles (flujos 1–8 de `00-contexto.md`) · **Dimensiones auditadas:** 1 (usabilidad), 3 (contenido), 4 (jerarquía visual), 5 (navegación), 6 (estados), 7 (formularios)
**Dimensiones no auditadas:** 2 (accesibilidad) y 8 (técnico y red): no cambian lo que se presenta y el panel no existe en producción. Las pantallas del producto se miraron solo en lo que afecta a la demo; sus auditorías completas están en `admin-setup`, `admin-truck-wo`, `admin-dashboard-yard`, `mecanico-general`, `mecanico-pm` y `safety-qc`.

## Resumen ejecutivo
La demo funciona de punta a punta: cada paso lleva a la pantalla correcta, la app responde a lo que el guion dice y ningún botón queda tapado en la laptop. Lo que falla está en los bordes, y son fallas que aparecen justo cuando hay público delante. La peor: después de una hora la sesión del Admin vence y, al entrar a mano a una pantalla del Admin, la app manda al presentador a otra dirección (`localhost` en vez de `127.0.0.1`) donde no hay sesión ni demo; parece que "se rompió". Las otras dos que más cuestan: cambiar de cuenta no muestra nada durante varios segundos (se vuelve a tocar), y una vez dentro no hay forma de volver a encender el modo demo sin cerrar sesión. Además, el panel habla en códigos (HU-M4, J3, USER_FLOWS) y en nombres de personas, cosa que el dueño ya decidió cambiar. Con los quick wins de esta semana, la demo deja de depender de la suerte: la sesión no vence, cada cambio de cuenta se ve, el modo se enciende desde el perfil y la entrada valida el correo.

## Cifras
| Severidad | Hallazgos |
|-----------|-----------|
| 4 · Catastrófico | 3 (un mismo defecto, la sesión de Admin vencida, contado desde tres dimensiones: UX-1-003, UX-5-006, UX-6-004) |
| 3 · Mayor | 10 |
| 2 · Menor | 20 |
| 1 · Cosmético | 12 |
| **Total** | 45 |

Por dimensión:

| Skill | Total | Sev 3–4 |
|---|---|---|
| 1 Usabilidad | 12 | 4 |
| 3 Contenido | 9 | 2 |
| 4 Jerarquía visual | 6 | 1 |
| 5 Navegación | 6 | 3 |
| 6 Estados | 7 | 2 |
| 7 Formularios | 5 | 1 |

Por flujo crítico:

| Flujo | Total | Sev 3–4 |
|---|---|---|
| 1 · Entrar y cambiar de cuenta | 14 | 7 |
| 8 · Seguir una historia paso a paso | 19 | 5 |
| 2–7 · Pantallas del producto | 12 | 1 |

## Patrones (insights)

### P1 · La demo se puede caer sola a mitad de la presentación
- **Qué pasa:** la cookie de Admin dura 60 min y nadie la renueva fuera de los pasos; el rebote a `/login` cambia de host y pierde token y estado. El botón Atrás del navegador abre pantallas de otra cuenta.
- **Hallazgos:** UX-1-003, UX-5-005, UX-5-006, UX-6-004
- **Causa probable:** el modo demo se montó sobre la sesión normal sin tratar la sesión como parte de la demo; el redirect del middleware usa `request.url`.
- **Qué cambiaría si se arregla:** una demo de dos horas sin un solo rebote; Atrás nunca sale de la cuenta actual.

### P2 · Las acciones del panel no muestran lo que están haciendo
- **Qué pasa:** cambiar de cuenta, elegir historia o resolver el camión no pintan ningún estado intermedio; el único feedback es un botón gris.
- **Hallazgos:** UX-1-002, UX-6-001, UX-6-002, UX-6-003, UX-6-005, UX-6-007
- **Causa probable:** el cambio de cuenta es una recarga completa y el estado `busy` solo deshabilita.
- **Qué cambiaría si se arregla:** el presentador no vuelve a tocar y sabe en cada momento quién es y qué pantalla viene.

### P3 · El panel habla como el repositorio, no como el presentador
- **Qué pasa:** códigos HU/J, "USER_FLOWS", "AUTH_DEV_BYPASS", "auto-follow"; nombres de personas en vez de roles; "Reset demo" que no reinicia datos.
- **Hallazgos:** UX-1-004, UX-1-005, UX-1-007, UX-3-001, UX-3-002, UX-3-003, UX-3-004, UX-3-005, UX-3-006, UX-5-003
- **Causa probable:** el guion se escribió desde los ids de `USER_FLOWS.md` y las cuentas del seed; la ayuda, desde los comandos.
- **Qué cambiaría si se arregla:** se lee en voz alta sin traducir. Las PRs B (cuentas por rol) y C (flujo con capítulos y títulos en lenguaje de usuario) resuelven la mayor parte; el resto son textos.

### P4 · Dónde estoy y cómo vuelvo no tienen respuesta dentro del panel
- **Qué pasa:** la tarjeta no compara la pantalla actual con la del paso, no hay capítulo ni lista para saltar, "Enter demo mode" solo existe en `/login`, "Leave" no dice cómo volver.
- **Hallazgos:** UX-1-001, UX-1-006, UX-1-009, UX-5-001, UX-5-002, UX-5-004
- **Causa probable:** el panel se diseñó como lista de historias, no como guía de un recorrido largo.
- **Qué cambiaría si se arregla:** el presentador se pierde y se recupera sin cerrar sesión ni leer la URL.

### P5 · En teléfono el panel tapa la app
- **Qué pasa:** a 375 px el panel ocupa el 75 % de la pantalla; para tocar hay que cerrarlo y reabrirlo en cada paso.
- **Hallazgos:** UX-1-010, UX-4-001, UX-4-005, UX-4-006
- **Causa probable:** copia fiel del panel de las maquetas, pensado para laptop.
- **Qué cambiaría si se arregla:** mostrar la app del mecánico en un teléfono real con la guía visible.

### P6 · Jerarquía invertida dentro del panel
- **Qué pasa:** Reset es el botón más grande; diez cuentas iguales; la casilla que cambia a Next está lejos de Next; el selector navega sin paso intermedio.
- **Hallazgos:** UX-4-002, UX-4-003, UX-4-004, UX-7-003, UX-7-004, UX-3-005
- **Causa probable:** el orden de las secciones sigue la maqueta (cuentas, luego historia) y no la frecuencia de uso en una demo (Next, Next, Next).
- **Qué cambiaría si se arregla:** Next a mano, cuentas en segundo plano, historia con capítulos arriba.

## Top 10 priorizado
| # | ID | Hallazgo | Sev | Esfuerzo | Flujo | Por qué está aquí |
|---|----|----------|-----|----------|-------|-------------------|
| 1 | [UX-1-003](01-usabilidad.md) | La sesión de Admin vence a la hora y el rebote cambia de host: la demo "desaparece" | 4 | S | 1 | Rompe la demo con público; arreglo pequeño (host del redirect + renovar cookie) |
| 2 | [UX-1-002](01-usabilidad.md) | Cambiar de cuenta deja la pantalla muda 3–10 s | 3 | S | 1 | Pasa en cada cambio; provoca dobles toques |
| 3 | [UX-1-001](01-usabilidad.md) | No hay forma de volver a encender el modo demo sin cerrar sesión | 3 | S | 1 | Un toque en "Leave" cuesta un sign-out |
| 4 | [UX-7-001](07-formularios.md) | "Enter demo mode" con correo vacío enciende el modo y falla con otro mensaje | 3 | S | 1 | Es la puerta; mensaje engañoso |
| 5 | [UX-6-002](06-estados.md) | Sin estado "cambiando de cuenta" | 3 | S | 8 | Misma causa que el 2; se arregla junto |
| 6 | [UX-5-005](05-navegacion-ia.md) | Atrás del navegador aterriza en pantallas de otra cuenta | 2 | S | 1 | Reflejo frecuente; `replace` en vez de `assign` |
| 7 | [UX-5-001](05-navegacion-ia.md) | El paso no dice si la pantalla visible es la del paso | 2 | S | 8 | Orienta tras Atrás o un desvío |
| 8 | [UX-1-005](01-usabilidad.md) · [UX-3-004](03-contenido.md) · [UX-4-002](04-jerarquia-visual.md) | "Reset demo": promete reiniciar datos, es el botón más grande | 2 | S | 8 | Tres dimensiones apuntan al mismo botón |
| 9 | [UX-3-003](03-contenido.md) | Errores del panel en jerga de desarrollador | 2 | S | 1 | Cuando aparecen, el presentador necesita saber qué hacer |
| 10 | [UX-7-003](07-formularios.md) | El selector cambia de cuenta y pantalla al instante | 2 | S | 8 | Con teclado o picker nativo salta a la cuenta equivocada |

Fuera del top 10 aunque son severidad 3: UX-1-007, UX-3-001, UX-5-003 (códigos HU/J) y UX-3-002 (nombres de persona) ya tienen decisión y PR (B y C); UX-4-001 (panel en teléfono) es esfuerzo M y el teléfono es secundario en la demo.

## Quick wins
Esfuerzo S y severidad ≥ 2 (26): UX-1-001, UX-1-002, UX-1-003, UX-1-004 (con PR B), UX-1-005, UX-1-006, UX-1-008, UX-1-012 (DM1), UX-3-001 (con PR C), UX-3-003, UX-3-004, UX-3-008, UX-4-002, UX-4-003 (con PR B), UX-4-004 (con PR C), UX-5-001, UX-5-002 (con PR C), UX-5-004, UX-5-005, UX-5-006, UX-6-002, UX-6-003, UX-6-004, UX-7-001, UX-7-003, UX-7-005.

Los que se hacen **en esta misma PR** (panel y entrada, sin depender de B y C): UX-1-001, UX-1-002/UX-6-002, UX-1-003/UX-5-006/UX-6-004, UX-1-005/UX-3-004/UX-4-002, UX-1-006, UX-1-008, UX-3-003, UX-3-005/UX-7-004, UX-5-001, UX-5-005, UX-6-003, UX-6-005, UX-7-001, UX-7-003, UX-3-006.

## Matriz impacto × esfuerzo
|              | Esfuerzo S | Esfuerzo M | Esfuerzo L |
|--------------|-----------|-----------|-----------|
| Sev 4        | UX-1-003 (= UX-5-006, UX-6-004) | — | — |
| Sev 3        | UX-1-001, UX-1-002, UX-3-001, UX-5-004, UX-6-002, UX-7-001 | UX-1-007, UX-3-002, UX-4-001, UX-5-003 | — |
| Sev 2        | UX-1-004, UX-1-005, UX-1-006, UX-1-008, UX-1-012, UX-3-003, UX-3-004, UX-3-008, UX-4-002, UX-4-003, UX-4-004, UX-5-001, UX-5-002, UX-5-005, UX-6-003, UX-7-003, UX-7-005 | UX-1-010, UX-1-011, UX-6-006 | — |

## Plan sugerido
- **Ahora (esta PR):** P1 y P2 completos (sesión, host, Atrás, estado "switching", resolver que espera), P4 en lo que no depende del flujo (encender desde el perfil, "Leave" con confirmación y aviso, chip "no estás en la pantalla del paso"), P6 (Next primario, Reset como enlace renombrado, casilla junto a Next, selector sin navegar hasta "Start"), textos de errores y del pie, validación del correo en la entrada.
- **Siguiente (PRs B y C, ya aprobadas):** P3: cuentas por rol (UX-3-002, UX-1-004, UX-4-003) y flujo con capítulos + títulos en lenguaje de usuario (UX-1-007, UX-3-001, UX-5-002, UX-5-003, UX-4-004).
- **Después:** P5 (barra inferior en teléfono, UX-4-001/UX-1-010), "Trucks with your Jobs" en la pestaña del mecánico (UX-1-011), historias "ya ejecutadas" (UX-6-006), DM1–DM3 del producto (UX-1-012, UX-3-007), esqueleto en el Work Order del mecánico (UX-6-007), alias `tab=dispatch` (UX-3-009).

## Lo que funciona bien
- Cada paso navega solo a la pantalla correcta resolviendo el camión por número; en el ensayo no hubo un destino equivocado.
- Cambiar de cuenta recarga la página: nunca queda una fila del usuario anterior y la cookie llega antes que el middleware.
- "Do / Say / Expect" y "Changes data" separan de un vistazo qué se hace, qué se dice y qué toca datos.
- El panel usa los componentes y tokens del producto y deja su columna libre en laptop.
- Las cuentas que no existen se muestran deshabilitadas en vez de fallar; un camión sin Work Order abierto da un mensaje y no navega.
- El panel sobrevive a recargas y a cerrar sesión.
- Las pantallas del producto responden a cada acción del guion con confirmaciones con contenido, borradores en el teléfono y guardado automático en el PM.
- Los filtros se conservan al volver desde un detalle; las rutas de otro rol tienen salida.

## Hallazgos completos por dimensión
- [01-usabilidad.md](01-usabilidad.md): UX-1-001 · Volver a encender el modo demo · 3 · S — UX-1-002 · Cambio de cuenta mudo · 3 · S — UX-1-003 · Sesión de Admin vencida, otro host · 4 · S — UX-1-004 · Cuentas reales en "Others" · 2 · S — UX-1-005 · "Reset demo" ambiguo · 2 · S — UX-1-006 · "Leave" sin confirmación · 2 · S — UX-1-007 · Historias por código · 3 · M — UX-1-008 · Auto-follow apagado sin pista · 2 · S — UX-1-009 · "Finish" sin estado final · 1 · S — UX-1-010 · Panel en teléfono · 2 · M — UX-1-011 · Pestaña Trucks exige recordar · 2 · M — UX-1-012 · Lista de WOs sin "Return to Service" · 2 · S
- [03-contenido.md](03-contenido.md): UX-3-001 · Selector en código · 3 · S — UX-3-002 · Nombres de persona · 3 · M — UX-3-003 · Errores en jerga · 2 · S — UX-3-004 · Reset/Leave · 2 · S — UX-3-005 · Auto-follow / Go to screen · 1 · S — UX-3-006 · Rol crudo en el pie · 1 · S — UX-3-007 · Plurales · 1 · S — UX-3-008 · Citas en inglés con la app en español · 2 · S — UX-3-009 · Dispatch/Movement · 1 · S
- [04-jerarquia-visual.md](04-jerarquia-visual.md): UX-4-001 · Panel es la pantalla en teléfono · 3 · M — UX-4-002 · Reset el más grande · 2 · S — UX-4-003 · Diez cuentas iguales · 2 · S — UX-4-004 · Título del paso sin contexto · 2 · S — UX-4-005 · Aviso 5 PM y casilla · 1 · S — UX-4-006 · Scroll interno · 1 · S
- [05-navegacion-ia.md](05-navegacion-ia.md): UX-5-001 · Pantalla actual vs paso · 2 · S — UX-5-002 · Sin capítulo · 2 · S — UX-5-003 · Organización por JTBD · 3 · M — UX-5-004 · Entrada solo en /login · 3 · S — UX-5-005 · Atrás del navegador · 2 · S — UX-5-006 · Rebote a otro host · 4 · S
- [06-estados.md](06-estados.md): UX-6-001 · Cuentas antes de la lista · 1 · S — UX-6-002 · Sin estado "cambiando" · 3 · S — UX-6-003 · Resolver pide reintentar · 2 · S — UX-6-004 · Sesión vencida · 4 · S — UX-6-005 · Entrada sin confirmación · 1 · S — UX-6-006 · Historias ya ejecutadas · 2 · M — UX-6-007 · "Loading work order" plano · 1 · S
- [07-formularios.md](07-formularios.md): UX-7-001 · Entrada con correo vacío · 3 · S — UX-7-002 · Enter no entra en demo · 1 · S — UX-7-003 · Selector navega al instante · 2 · S — UX-7-004 · Casilla lejos de Next · 1 · S — UX-7-005 · Add to team sin guardar · 2 · S

## Anexos
- Contexto: `00-contexto.md`
- Evidencia: `evidencia/` (01-panel-abierto-pm, 04-panel-historia-dashboard-laptop, 04-panel-historia-telefono, 05-atras-tras-cambio-de-cuenta, 07-login-entrada-demo)
- Fuera de alcance y no verificado: teléfono y Safari reales; build de producción para la demo (tiempos medidos con `next dev`); API caída a mitad de la demo (otra sesión usa la base); Dispatch/Samsara/archivos (no existen en local); tablet; contraste y teclado con lector de pantalla (skill 2); ortografía del guion con corrector.
