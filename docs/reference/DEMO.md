# Demo local: toda la app en uso

**Actualizado:** 2026-10-10 (ensayo completo del modo demo, D36)
**Para qué:** mostrarles la app a los usuarios (Manager, mecánicos, PM, Safety) con datos que hacen ver cada pantalla en uso.
**Dónde:** en esta máquina (base `ltl_shop_demo`) y, cuando esté publicada (D39, OPEN_ISSUES §1t), en un proyecto aparte con clave compartida. Nunca en el proyecto de producción.

## Armarla

```bash
npm run prisma:demo-local --workspace=@ltl-shop/api
```

Esto hace cuatro cosas:
1. Crea `ltl_shop_demo` si no existe y aplica las migraciones.
2. Corre el seed: personas, catálogo, piezas de PM, Shop workflow y camiones.
3. Corre `reset-demo-work-orders.ts --demo --apply`.
4. Si se vuelve a correr, borra todo y lo arma de nuevo. No da errores de proveedor o factura repetidos.

Es mejor **armarla la mañana de la demo**, porque las horas son relativas al momento en que corre:
- lo de hoy queda repartido entre las 7:00 y la hora en que corre;
- lo de ayer y los días anteriores, en horario de taller.

Si corre después de las 5:00 p.m., el cierre del día ya cortó los relojes de hoy.

Para verla:
1. `npm run start:demo` (desde la raíz). Compila `packages/shared` y la API y levanta las dos cosas:
   - la API en `http://127.0.0.1:3141` contra `ltl_shop_demo`, con `AUTH_DEV_BYPASS=true` y `YARD_READY_TO_GO_SINCE=2000-01-01T00:00:00Z`;
   - la web en `http://localhost:3042` con `NEXT_PUBLIC_E2E_DEV_LOGIN=1` (Dev Login y Panel de demo). Abrirla siempre como **localhost**, no `127.0.0.1`: el servidor de desarrollo redirige a `localhost` cuando vence la sesión del Admin, y para el navegador son dos sitios distintos (se perdería la sesión y el panel).

   Si un puerto está ocupado: `DEMO_API_PORT=3151 DEMO_WEB_PORT=3043 npm run start:demo`. Otra base: `DEMO_DATABASE_URL=…` (tiene que ser `localhost` y decir "demo").
2. Abrir `http://localhost:3042/login`, escribir `ms@lightning.local` y tocar **Enter demo mode (this machine only)**. No pide contraseña; con el correo vacío o inexistente lo dice y no enciende nada. (El botón **Dev login** de siempre sigue ahí: entra sin el panel; el modo se puede encender después desde el menú de perfil.)

## Modo demo (D36)

Con el modo demo encendido, el encabezado de todas las pantallas tiene un botón **Demo** (matraz) a la izquierda del perfil. Abre el **Demo panel**, el mismo panel flotante de las maquetas (`docs/proposals/*/mockup.html`), ahora dentro de la app. Sus textos están en inglés porque es una herramienta para presentar, no parte del producto. El guion cita los botones de la app **en inglés**: antes de presentar, dejar la app en English desde el menú del perfil (la cookie `ltl_shop_locale` del navegador manda; UX-3-008 en OPEN_ISSUES).

- **User:** las diez cuentas demo agrupadas (Management, Mechanics, PM, Safety), cada una con una pista de qué muestra. Tocar una **cambia de usuario sin cerrar sesión**: la web pone la cookie de Admin con el token `dev:` nuevo y **recarga la página** en la pantalla de inicio de esa cuenta (Manager → Operaciones, mecánico → Mi trabajo, PM → PM, Safety → Quality Check). Nada del usuario anterior queda en pantalla. La cuenta actual sale marcada; una cuenta que no esté activa en la base sale como "inactive". Las cuentas que no son del reparto (por ejemplo `cristian@ltransl.com`) salen bajo **Others**.
- **Story:** arriba de todo, el **Demo flow** "A day at the shop": una sola historia continua en 14 capítulos que pasa por las diez cuentas (abajo la tabla). Debajo, las 23 historias de `USER_FLOWS.md` con nombres en lenguaje de usuario y agrupadas por quién las hace (Manager Shop, Mecánicos, Mecánico PM, Quality Check, Admin Shop); el id HU queda como etiqueta chica en la tarjeta. El panel muestra "Step n of m", quién (cambia de usuario solo si hace falta), dónde (navega a la pantalla), **Do** (qué tocar), **Say** (qué explicar) y **Expect** (qué debe verse). Botones Back / Next / Go to screen. "Changes data" marca los pasos que mutan. Con "Switch user and screen automatically" apagado, el panel solo indica y el presentador navega. El guion vive en `apps/web/src/lib/demo/scripts.ts` y usa los mismos ids que USER_FLOWS. Tabla de historias más abajo.
- **Start:** elegir una historia solo la muestra (paso 1, quién y dónde); nada cambia hasta tocar **Start**. Después, **Next** es el botón principal; "Follow each step" (encendido por defecto) hace que cada paso cambie de cuenta y de pantalla solo. Si la pantalla que se ve no es la del paso (por ejemplo tras tocar Atrás), el chip de la pantalla se pone ámbar y aparece "Go to this step's screen".
- **Back to the Manager dashboard:** cierra la historia y vuelve a Operaciones como Manager. **No rearma los datos**: para eso, `npm run prisma:demo-local`.
- **Turn demo mode off:** pregunta antes; esconde el panel y el botón, la sesión sigue. Se vuelve a encender desde el **menú de perfil** (iniciales arriba a la derecha → "Demo mode · Turn on") o desde `/login`.
- Mientras el modo está encendido y la cuenta puede entrar al Admin, la sesión del Admin se renueva sola cada 20 min (antes vencía a la hora y sacaba al presentador).
- El estado (encendido, panel abierto, historia y paso) queda en el navegador (`localStorage['ltl_shop_demo']`) y sobrevive a recargas y a cerrar sesión.
- **Pantalla:** con el panel abierto, la página le deja su propia columna a la derecha: desde 1000 px de ancho en las pantallas del mecánico y desde 1200 px en el Admin. En una ventana más angosta el panel flota encima: si tapa el botón que hay que tocar, cerrarlo con la X y volver a abrirlo con **Demo** (la historia y el paso se mantienen). Lo mejor es presentar con el navegador a pantalla completa.

Dónde no existe: en producción. El panel se monta solo donde está Dev Login (`DEMO_MODE_AVAILABLE`, `apps/web/src/lib/dev-login.ts`, `false` en el deploy) y cambiar de usuario necesita la API con `AUTH_DEV_BYPASS=true`; `GET /api/dev/demo/users` responde 404 sin esa variable. La suite e2e (`apps/web/e2e/demo-mode.spec.ts`) comprueba que sin el modo encendido el botón no está, aunque el build tenga Dev Login.

Antes de presentar: armar la base esa mañana (ver arriba) y, si la demo pasa de las 5:00 p.m., recordar que el cierre del día corta los relojes de hoy.

### Guía paso a paso (D39, DP2)

Al entrar a la demo, el panel ya tiene elegido "A day at the shop" y la app queda en inglés. **Start** abre la primera pantalla y, en cada paso, la pantalla se oscurece salvo lo que hay que tocar o mirar, con un globo que lo dice. Tocar lo iluminado apaga la luz y hace pulsar **Next** ("Done here? Tap Next"). En los pasos de dos toques (Resolve → Confirm resolve, Confirm completion → Close Work Order, New purchase → Save purchase…) se ilumina el segundo. Los pasos que son un solo toque (Start Work, Make draft, Create drafts for all) pasan solos al siguiente. Dentro de un formulario solo se marca el botón, sin oscurecer, para poder llenar los campos. "Got it" apaga la luz sin tocar nada. En teléfono el panel es una barra inferior con el paso y Back/Next; **More** muestra cuentas, historias y capítulos.

Qué ilumina cada paso está en `SPOTLIGHTS` (`apps/web/src/lib/demo/scripts.ts`), por historia y número de paso, con el texto en inglés del botón o un selector. No hay marcas de demo en las pantallas del producto. Si un texto de la app cambia, el paso deja de iluminar (el panel sigue funcionando): la prueba `scripts.spec.ts` exige que todo paso del flujo tenga su luz, y la e2e de demo comprueba una.

### Demo flow: "A day at the shop" (15 capítulos, 56 pasos)

Con el flujo elegido, el panel muestra la lista de capítulos (tocar uno salta a su primer paso) y la tarjeta dice "Chapter n of 15 · título" sobre "Step n of 56". Los pasos son los mismos ya ensayados de las historias; el orden evita que un capítulo rompa uno posterior (el bloqueo del 605 se resuelve una sola vez, el 606 queda para el respaldo de QC, el 931 se cierra después de que QC1 aprueba el 616).

| # | Capítulo | Cuenta(s) | Camiones | Pasos | Muta datos |
|---|---|---|---|---|---|
| 1 | Start of the day: a clock left running yesterday | MG3 | 944 | 2 | no |
| 2 | A truck arrives: a Work Order in one tap | MS | 973 | 3 | sí (crea el WO) |
| 3 | Inspect, add work, assign | MS | 601, 602 | 5 | sí |
| 4 | My work: clock, team queue, notes and requests | MG1 | 604, 613 | 3 | sí (Request Work) |
| 5 | A blocker: the mechanic reports, the Manager resolves | MG2, MS, MG2 | 605 | 4 | sí |
| 6 | Pause and resume; cancel and reopen | MS | 609, 613, 615 | 3 | sí (Resume) |
| 7 | Alignment: start and finish | MA | 603 | 3 | sí |
| 8 | PM: mileage, parts, finish | MPM | 968 | 2 | opcional |
| 9 | Detailing: the team queue and a helper | MD | 957, 612 | 2 | sí (Take) |
| 10 | Quality Check: take, approve, return; the backup | QC1, QC2, MS | 616, 922, 905 | 6 | sí |
| 11 | Close, Ready to Go, Return to Service; the whole shop | MS | 931, 607, Yard | 5 | sí |
| 12 | Purchases and outside repairs: the cost lands on the truck | MS | 605, 612, 611 | 6 | sí (carga una compra y una reparación externa) |
| 13 | Month close: the internal invoice for Finance | MS | todos los del mes pasado | 6 | sí (Make draft, Create drafts for all, Send) |
| 14 | Admin: correct time, people, catalog | AS | 617 | 4 | sí (Correct…) |
| 15 | Setup: the shop workflow and the hours | MS | — | 2 | no |

Capítulos 12 y 13 (D39, DP1): Parts & costs se usa, no solo se mira. En el 12 se carga una compra de FleetPride al 605 con dos líneas, impuesto y flete, se ve en Costos del 605, y se carga una reparación externa sin Job (DPF en Diesel Pro, camión 612); el número de factura es libre, pero el mismo número para el mismo proveedor se rechaza (si alguien ya lo usó hoy, otro número). En el 13, Month close (el mes pasado, unos 20 camiones por cobrar con la base recién armada) arma un borrador, luego "Create drafts for all", y se envía uno con su PDF.

### Historias guiadas: cuentas, camiones y pantallas

| Historia | J | Cuentas (en orden) | Camiones | Pasos | Muta datos |
|---|---|---|---|---|---|
| HU-M1 A truck arrives | J1 | MS | 973 | 3 | sí (crea el WO) |
| HU-M2 Inspect and add work | J1 | MS | 601, 602 | 4 | sí (inspección del 601) |
| HU-M3 Split the work | J2 | MS | 602 | 3 | sí (asigna) |
| HU-M4 Unblock a truck | J3 | MS, MG2, MS | 605, 609 | 4 | sí (Resolve, Resume) |
| HU-M5 Close and return to service | J4 | MS | 931, 607, 606 | 4 | sí (Close 931, Return 607) |
| HU-M6 Cancel and reopen | J4 | MS | 613, 615 | 3 | no |
| HU-M7 See the whole shop | J5 | MS | — | 5 | no |
| HU-M8 Set up the shop workflow | J2 | MS, MG1, MS | 957 | 4 | no |
| HU-M9 Add staff | J12 | MS | — | 3 | opcional (Add) |
| HU-M10 A helper on a Job | J2 | MS, MD | 612 | 2 | no |
| HU-M11 Send work to an outside shop | J3 | MS | 610, 611 | 4 | no |
| HU-M12 What each truck costs | J13 | MS | 611 | 5 | no |
| HU-M13 Charge Finance | J14 | MS | 603 | 4 | opcional (Send) |
| HU-ME1 See my work | J6 | MG1 | 604, 957 | 4 | no |
| HU-ME2 Work and finish | J7 | MA | 603 | 3 | sí (Start, Complete) |
| HU-ME3 Report a blocker | J8 | MG2, MS, MG2 | 605 | 4 | sí (Resolve, Continue) |
| HU-ME4 Notes and work requests | J7 | MG1, MS | 613 | 3 | sí (nota, Mark handled) |
| HU-ME5 The day closes by itself | J7 | MG3, MS | 944 | 4 | no |
| HU-ME6 One clock across trucks | J7 | MG1 | 604, 612 | 3 | sí (mueve el reloj) |
| HU-PM1 Record a PM | J9 | MPM | 968, 603 | 4 | opcional (Finish) |
| HU-QC1 Approve or return a truck | J11 | QC1, QC2, MS | 616, 617, 606, 905, 922, 931 | 7 | sí (Take, Approve/Return) |
| HU-A1 Correct a mechanic's time | J10 | AS | 617 | 2 | sí (Correct…) |
| HU-A2 Catalog and people | — | AS | — | 3 | no |

Orden recomendado: **HU-ME1 antes de HU-ME6** (mueve el reloj de MG1); **HU-M4 y HU-ME3 comparten el 605** (una u otra, o rearmar entre las dos); HU-M5 deja el 606 para HU-QC1. Lo que no se ve en local (contraseña temporal en HU-M9, Dispatch en HU-M7, el cierre de las 5 PM en vivo en HU-ME5) lo dice la nota del primer paso.

**Auditoría UX (2026-10-10):** `docs/ux-audit/demo-mode/09-informe-final.md`; lo corregido y lo pendiente, en `OPEN_ISSUES.md` §1q.

**Ensayo completo (2026-10-09/10):** se recorrieron las 23 historias tocando lo que dice cada paso, con la base recién armada; los textos se ajustaron a la pantalla real. El armado deja el Shop workflow como en el taller: PM → MPM, Alignment → MA, Detailing → equipo de dos (MG1 y MD), Quality Check → QC1 y QC2. Por eso un Work Order nuevo (HU-M1) nace con sus dueños. Defectos encontrados: `OPEN_ISSUES.md` §1p.

## Cuentas

Las cuentas de la demo se llaman por rol, como en el taller (y como el roster de prueba de producción). Las crea el armado de la demo a partir de las cuentas del seed; el nombre visible es el código y el rol, y el avatar muestra el código.

| Código | Nombre en la app | Correo | Qué ve |
|---|---|---|---|
| MS | MS · Manager Shop | `ms@lightning.local` | Operaciones, Yard, Work Orders, Trucks, Partes y costos (con tarifa y facturas a Finanzas), Setup |
| AS | AS · Admin Shop | `as@lightning.local` | Todo lo del Manager; corrige tiempos |
| MG1 | MG1 · Mecánico General | `mg1@lightning.local` | Reloj corriendo en el 604, cola del equipo, Jobs por iniciar, completados |
| MG2 | MG2 · Mecánico General | `mg2@lightning.local` | El Job bloqueado del 605 esperando piezas |
| MG3 | MG3 · Mecánico General | `mg3@lightning.local` | "Yesterday's work is still open · tap Continue" (944) |
| MA | MA · Mecánico Alineación | `ma@lightning.local` | Alineaciones por hacer (603) y hechas |
| MD | MD · Mecánico Detailing | `md@lightning.local` | Detailing; ayudante en el 612; cola del equipo (957) |
| MPM | MPM · Mecánico PM | `mpm@lightning.local` | PM en curso (968), "Waiting for PM" con "Last PM", PM pausado (609) |
| QC1, QC2 | QC1 · Quality Check, QC2 · Quality Check | `qc1@`, `qc2@lightning.local` | Por revisar, Devueltos, Hechos; QC2 tiene tomado el 905 |

`MG4 · Mecánico General` (`mg4@lightning.local`) está **inactivo**: sirve para mostrar el filtro de People. Las cuentas reales del seed que no son del roster (`cristian@ltransl.com`, `ibrain@ltransl.com`, `cristian240588@hotmail.com`) quedan "Removed from the Shop" en la base demo: no aparecen en pickers, People ni en el panel. La tabla vive en `packages/shared/src/demo-roster.ts`.

## Qué muestra cada camión

### Hoy en el taller
Algunos Work Orders se crearon días atrás, así que salen como "abierto hace más de 24 h".

| Camión | Situación | Historia de usuario |
|---|---|---|
| 601 | Recién llegado | Como Manager, registro la inspección de llegada. |
| 602 | Inspección con hallazgos, de hace 2 días | Como Manager, asigno Brake Inspection y Lights. |
| 603 | Sin hallazgos | Como mecánico, veo mi Job listo para iniciar. |
| 604 | Trabajo en curso | Como MG1, veo mi reloj corriendo en la 604. |
| 605 | Bloqueado, esperando piezas, de hace 2 días | Como Manager, veo el bloqueo con la nota y lo resuelvo. La compra de la bolsa de aire ya está cargada hoy. |
| 606 | Solo falta QC (Normal) | Como Safety, lo tomo y lo apruebo o lo devuelvo. Como Manager, también puedo hacerlo (respaldo). |
| 607 | Ready to Go | Como Manager, lo devuelvo al servicio (Return to Service). |
| 608 | De vuelta en servicio hoy | El Work Order queda en el historial. |
| 609 | En pausa oficial, esperando aprobación | Como Manager, lo reanudo. Como PM, lo veo en "pausados". |
| 610 | Pieza en taller externo | La fila del Job dice "Part out", con el botón Returned. |
| 611 | Camión fuera, en taller externo, de hace 3 días | En el Yard sale "Out of shop". La factura de Bay Area Body Shop está ligada al Job. |
| 612 | Job con ayudante | "Brake Inspection · helper". |
| 613 | Job cancelado y pedido de trabajo abierto | Como Manager, marco el pedido como atendido. |
| 614 | Le falta un paso obligatorio | "Add missing steps". |
| 615 | Work Order cancelado | Se ve el motivo. El camión queda sin WO abierto. |
| 616 | Solo falta QC (Critical) | Sale primero en "Por revisar" de Safety. |
| 617 | Solo falta QC (High) | Sale segundo. |
| 905 | QC tomado por QC2 | QC1 lo ve como "Taken by QC2". |
| 922 | Devuelto por QC1 | Safety lo ve en "Devueltos". El Manager lo ve bloqueado con la nota y lo resuelve. |
| 931 | QC aprobado | Como Manager, lo veo en "Listos para cerrar" y lo cierro. |
| 944 | Reloj de ayer | Como MG3, veo "Yesterday's work is still open": el cierre del día lo cortó a las 5:00 p.m. |
| 957 | Detailing en la cola del equipo | Setup: Detailing tiene un equipo de dos. MG1 y MD lo ven en "Team queue". |
| 968 | PM en curso | Como MPM, continúo el PM. |
| 973, 986, 991 | Sin Work Order abierto (visitas recientes) | Como Manager, creo un Work Order nuevo. |

Los números de camión son los del seed. El script imprime la tabla real al terminar.

### Historia: unos 4 meses

Cada camión tiene de 1 a 3 visitas cerradas en los últimos 4 meses. Algunas son de los últimos días, incluida ayer. Cada visita pasó por el ciclo completo:
1. inspección;
2. reparaciones con su nota de cierre;
3. PM con piezas y millaje;
4. Alignment y Detailing;
5. QC aprobado por Safety;
6. cierre;
7. Return to Service.

Algunas visitas tuvieron un bloqueo resuelto, y dos fueron devueltas por Safety. Una, de hace un mes, mandó la transmisión a Diesel Pro.

Así se pueden mostrar:
- **Truck → Resumen:** historial de reparaciones, con filtro por categoría.
- **Truck → Costos:** barras por mes, movimientos (con una compra corregida y una anulada) y mano de obra en horas y en dinero.
- **Mecánicos → Completados:** agrupados en Ayer y Antes, con notas.
- **PM:** "Último PM: millas · fecha" en cada camión, y la pieza más usada por modelo.
- **Safety → Hechos:** lo de los últimos 7 días.
- **Operaciones:** completados hoy y en los últimos 7 días.

### Custom Jobs por revisar (Catálogo de Jobs → Custom Jobs to review)
Algunas visitas de la historia tienen Jobs que no están en el catálogo, escritos como los escribiría alguien en el taller (con mayúsculas y espacios distintos):
- **Por revisar:**
  - "Check engine light" (3, escrito de 3 formas; la bandeja sugiere Engine Repair);
  - "Cambiar foco de cabina" (3);
  - "Air horn" (2);
  - "Tire pressure check" (1).

  Como Manager, ligo un grupo a un Job del catálogo, lo agrego al catálogo o lo dejo así.
- **Revisados hace unos días:**
  - "Brake inspec" quedó ligado a Brake Inspection (y es su alias);
  - "Load bar repair" se dejó así.

  Deshacer los devuelve a la bandeja.

### Partes y costos
- **Proveedores:** FleetPride, TruckPro, Rush Truck Centers, Diesel Pro Repair y Bay Area Body Shop. Old Supply Co está **inactivo**.
- **Partes:** todas las piezas de PM tienen precio de referencia. Las que se usan tienen proveedor habitual. Hay una creada en la app: "Wiper blade 22 in heavy duty".
- **Compras:** unas 45 en 4 meses. Incluyen:
  - varias líneas, con impuesto y flete;
  - una repartida entre dos camiones;
  - una para el estante, sin camión;
  - una **corregida** y una **anulada**.
- **Reparaciones externas:**
  - la transmisión (Diesel Pro), ligada al Job que regresó;
  - la del camión 611, que está afuera ahora;
  - un DPF y un parabrisas, sin Job.
- **Tarifa de mano de obra (Partes y costos → Tarifa de mano de obra):** $95/h desde hace unos 4 meses y medio, y $105/h desde el 1 de este mes. Cada Work Order cerrado tiene su mano de obra en Costos, por ejemplo en el camión 603 "WO-037 · … h × $95.00/h" (las horas cambian un poco en cada armado), a la tarifa del día en que se hizo el trabajo.
- **Facturas internas a Finanzas (Partes y costos → Facturas internas):**
  - dos **aceptadas**, de hace dos meses;
  - una **enviada** y una **anulada** (con su motivo), del mes pasado;
  - un **borrador** de este mes.

  Los números son `SHOP-AAAA-NNNN`. El PDF se descarga desde la factura.

## Video de introducción
Un video de 44 s, "A day at the shop", para mostrar antes de entrar al link de la demo (D39). Abre con el loader de Lightning dibujando el logo y la promesa "Every truck. Every mechanic. Every dollar. One app.". Siguen 8 escenas en el orden del Demo flow, de 6:00 AM a 4:30 PM: Dashboard, Yard, el mecánico en su teléfono, un blocker, Quality Check, Ready to Go, costos por camión y Month close. Cada escena lleva rol y un título que dice lo que gana el taller, y dura unos 4.3 s para que se alcance a leer. Está en 1080p, sin audio, y usa pantallas reales de esta demo.

Se rehace con un comando, con la demo levantada: `DEMO_VIDEO_BASE_URL=http://localhost:3042 npm run demo:video --workspace=@ltl-shop/web`. El resultado sale en `apps/web/e2e/demo-video/out/`. Los detalles y cómo cambiar textos u orden están en `apps/web/e2e/demo-video/README.md`.

## Demo publicada (D39, DP3)

La misma demo, en internet, para mandar por link. Vive en proyectos **aparte** de producción: su propia base (Supabase gratis) y dos proyectos Vercel (web y API). Los datos son los de `prisma:demo-local` y se rearman solos cada noche.

**Cómo se entra:** el link abre una pantalla que pide la **clave de acceso** (se manda junto con el link). Con la clave correcta aparece "Start the demo", que entra como MS en el flujo guiado. La API rechaza cualquier pedido `dev:` sin la clave (`demoAccessGranted`, `apps/api/src/dev-demo/dev-bypass.guard.ts`), así que conocer la URL de la API no basta. Todos los que abren la demo comparten los mismos datos: si alguien ya hizo un paso hoy, se ve hecho; a la mañana siguiente vuelve a estar como nuevo.

**Producción no cambia:** su build no tiene `NEXT_PUBLIC_DEMO_HOSTED`, ni la API tiene `AUTH_DEV_BYPASS`. El armado de la demo rechaza la base de producción aunque se configure por error (`demoDatabaseRefusal`, `apps/api/src/dev-demo/demo-target.ts`).

### Armarla una vez

1. **Supabase:** crear un proyecto gratis `ltl-shop-demo` (no el de producción). Anotar su *ref* (20 letras, en la URL del dashboard). Copiar la cadena **Session pooler** (puerto 5432) desde Connect. La cadena directa `db.<ref>.supabase.co` es solo IPv6 y GitHub no llega.
2. **GitHub → Settings → Environments → New environment `demo`:**
   - secret `DEMO_DATABASE_URL` = la cadena del pooler;
   - variable `DEMO_SUPABASE_REF` = el ref.
3. **Actions → Demo reset → Run workflow:** migra, siembra y arma la demo en esa base. Después corre solo cada día a las 5:15 AM (hora del Este).
4. **Vercel, proyecto API demo** (raíz `apps/api`, mismo repo, rama `main`). Variables:

   | Variable | Valor |
   |---|---|
   | `DATABASE_URL` | pooler en modo *transaction* (puerto 6543) con `?pgbouncer=true` |
   | `DIRECT_URL` | la cadena de pooler del paso 1 |
   | `AUTH_DEV_BYPASS` | `true` |
   | `DEMO_HOSTED` | `1` |
   | `DEMO_ACCESS_CODE` | la clave que se va a mandar |
   | `DATA_SOURCE` | `supabase` |
   | `YARD_READY_TO_GO_SINCE` | `2000-01-01T00:00:00Z` |
   | `CORS_ORIGIN` | la URL de la web demo |

   Sin `CRON_SECRET`: el cierre del día de las 5 PM no corre en la demo.
5. **Vercel, proyecto web demo** (raíz `apps/web`). Variables:
   - `NEXT_PUBLIC_DEMO_HOSTED` = `1`;
   - `NEXT_PUBLIC_API_URL` = la URL del API demo;
   - `ADMIN_PROFILE_SECRET` = cualquier texto largo, distinto del de producción.
6. **Probar y mandar:** abrir la URL de la web demo. Sin la clave no se ve nada; con la clave, "Start the demo". Mandar el link y, aparte, la clave.

**Cambiar la clave:** cambiar `DEMO_ACCESS_CODE` en el API demo y volver a desplegarlo. Los navegadores con la clave vieja vuelven a ver la pantalla de la clave.

## Lo que la demo local no puede mostrar
- **Dispatch, Movement y "Sale pronto":** vienen de agent-reporting, que no está conectado en local. La pantalla dice que no respondió.
- **Samsara y la ubicación física:** no están conectados.
- **Archivos de factura:** necesitan Supabase Storage; en local el campo no aparece.
- **Contraseñas temporales y "Quitar del Shop":** necesitan Supabase Auth.
