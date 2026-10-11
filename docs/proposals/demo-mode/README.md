# Modo demo local: cambio de usuario y historias guiadas (D36)

**Clasificación:** construida en dos etapas (PR 283: modo demo y cambio de usuario; PR siguiente: historias guiadas).
**Fecha:** 2026-10-09.
**Rama:** `claude/demo-mode-user-switching-074ce3`.
**Pantallas:** `/login` (botón "Enter demo mode"), el encabezado de los dos shells (botón Demo) y el panel flotante en todas las pantallas con sesión.
**Referencia copiada:** el "Panel de demo" de las maquetas (`docs/proposals/wo-detail-redesign/mockup.html`, líneas 113 y 136–163): botón con matraz en el encabezado, panel fijo arriba a la derecha (360 px; en teléfono abajo), grilla de botones, `details` con "qué hace cada botón" y un botón ancho al pie. Sin mezclar con otros productos.

## Reglas que no cambian

- Nada de esto se ve ni funciona en producción. El panel se monta solo donde está Dev Login (`DEMO_MODE_AVAILABLE = DEV_LOGIN_ENABLED`, `apps/web/src/lib/dev-login.ts`, constante de build que en el deploy es `false`) y el botón aparece solo con el modo encendido en `localStorage`. La API sirve `GET /api/dev/demo/users` solo con `AUTH_DEV_BYPASS=true` (404 si no), y cambiar de usuario usa los mismos tokens `dev:` que Dev Login.
- Los roles son los de siempre: Shop Manager, System Admin, Mecánico Standard, Mecánico PM y Safety. Finance no es un usuario (recibe un PDF).
- **Las cuentas de la demo se llaman por rol** (2026-10-10): MS, AS, MG1–MG3, MA, MD, MPM, QC1, QC2 y MG4 inactivo; nombre "MG1 · Mecánico General", correo `mg1@lightning.local`, avatar con el código. La tabla vive en `packages/shared/src/demo-roster.ts`; el armado de la demo (`reset-demo-work-orders.ts --demo`) renombra las cuentas del seed y quita del Shop a las que no son del roster. **El seed no cambia**: la base de pruebas y la fixture de Playwright dependen de sus cuentas.
- Las historias son las de `USER_FLOWS.md` (J1–J14, HU-M1…HU-A2), con los mismos ids. No se inventan historias para la demo.
- Los pasos guían; el presentador toca. La app no ejecuta acciones sola.
- La demo muta datos: se rearma con `npm run prisma:demo-local` la mañana de la demo. "Reset demo" no toca la base.
- Textos del panel y de las historias en inglés, dentro de `apps/web/src/lib/demo/`, fuera de los catálogos EN/ES.

## 1. Cómo verla

1. `npm run prisma:demo-local --workspace=@ltl-shop/api`.
2. `npm run start:demo` (API `:3141`, web `:3042`; `DEMO_API_PORT` / `DEMO_WEB_PORT` para cambiarlos).
3. `http://127.0.0.1:3042/login` → correo `manager@lightning.local` → **Enter demo mode (this machine only)**.
4. Botón **Demo** en el encabezado → panel → tocar una cuenta.

Guía completa: [`../../reference/DEMO.md`](../../reference/DEMO.md).

## 2. Cómo cambia de usuario

`switchDemoUser` (`apps/web/src/lib/demo/switch-user.ts`):
1. `POST /api/admin/session` con `Authorization: Bearer dev:<correo>`. El route handler lo valida contra `/api/auth/me` y escribe la cookie `ltl_shop_server_session` que lee `middleware.ts` en `/admin`. Si falla (cuenta inactiva, API apagada) el panel muestra el error y no cambia nada.
2. Guarda el token en `localStorage['ltl_shop_token']`.
3. `window.location.assign(inicio)`, con `inicio = defaultWorkspacePath(usuario)`.

Por qué recarga y no `logout()` + `loginDev()`: la pantalla del mecánico redirige a `/login` apenas el token queda en null, y el login reenvía al inicio del usuario, pisando la ruta a la que se quería ir; además la cookie de Admin tiene que existir antes de que el middleware vea la navegación. Con recarga el caché SWR nace vacío y no queda ninguna fila del usuario anterior.

## 3. Qué cambia (PR 1)

- `apps/api/src/dev-demo/`: `DevBypassGuard` (404 sin `AUTH_DEV_BYPASS`), `DevDemoController` (`GET /api/dev/demo/users`: activos y no quitados, con capacidades), registrado en `app.module.ts`.
- `apps/web/src/lib/dev-login.ts`: `DEMO_MODE_AVAILABLE`.
- `apps/web/src/lib/demo/`: `state.ts` (estado en `localStorage`), `switch-user.ts`, `cast.ts` (las diez cuentas con su pista), `demo-context.tsx` (`DemoModeProvider`, `useDemoMode`).
- `apps/web/src/components/demo-panel.tsx`: `DemoHeaderButton` y `DemoPanel`.
- `apps/web/src/components/ui.tsx` (`AppHeaderActions`), `app/layout.tsx` (provider y panel, hermano de `AppFrame` para que el admin no lo recorte), `app/login/page.tsx` (botón "Enter demo mode").
- `start-demo.sh` + `npm run start:demo`; `.env.example`.
- Pruebas: unit (`state.spec.ts`, `switch-user.spec.ts`, `dev-bypass.guard.spec.ts`, `dev-demo.controller.spec.ts`) y Playwright (`apps/web/e2e/demo-mode.spec.ts`, con `/api/dev/demo/users` en la fixture).
- Docs: D36, `SYSTEM.md` §6 y §9, `USER_FLOWS.md` §1, `reference/DEMO.md`, este README.

## 4. Historias guiadas y el Demo flow (PRs 284 y C)

Sección **Story** en el panel. Primero el **Demo flow** "A day at the shop" (PR C, 2026-10-10): una historia continua de 14 capítulos y 49 pasos que pasa por las diez cuentas; los pasos son los de las HU ya ensayadas (`pick()` en `scripts.ts`), en un orden que no rompe capítulos posteriores. El panel muestra la lista de capítulos (clic = ir al primer paso del capítulo) y "Chapter n of 14 · título" sobre "Step n of 49". Debajo, las 23 HU agrupadas por quién las hace (`who`: MS, Mecánicos, MPM, QC, AS) con **títulos en lenguaje de usuario** ("A truck arrives (973) · 3 steps"); el id HU va como etiqueta chica en la tarjeta. Elegir una historia la previsualiza; **Start** abre el primer paso; Next/Back/Go to this step's screen como en PR 286. Los camiones se resuelven por número de unidad con `GET /api/trucks` (`lib/demo/resolve-target.ts`). Tabla de capítulos y de historias: [`../../reference/DEMO.md`](../../reference/DEMO.md).

- `scripts.spec.ts`: las 23 HU en el orden de USER_FLOWS, títulos sin códigos, cada J con historia, cada paso con una cuenta del roster en una ruta que sus capacidades permiten, camiones de DEMO.md; el flujo tiene 14 capítulos, 49 pasos y visita a las diez cuentas.
- e2e `demo-mode.spec.ts`: HU-M7 paso a paso y el flujo (Start como MG3, salto por la lista de capítulos).

## 4b. Cuentas por rol (PR B)

- `packages/shared/src/demo-roster.ts`: `DEMO_ROSTER` (código, nombre, rol en palabras del taller, correo, correo del seed que reemplaza, rol, capacidades, activo) y `demoRosterCodeOf(name)`.
- `apps/api/prisma/reset-demo-work-orders.ts --demo --apply`: `applyDemoRoster()` antes de resolver actores: renombra cada cuenta del seed a su fila (si el seed volvió a crear la cuenta persona, borra ese duplicado sin historia o lo quita del Shop si una FK lo impide), deja MG4 inactivo y marca "Removed from the Shop" a las cuentas activas fuera del roster. `resolveActors` en modo demo asigna por código: MS, MPM, MA, MD, MG1–MG3, QC1–QC2.
- `apps/web/src/lib/demo/cast.ts` se construye desde el roster; `profileInitials` devuelve el código para un nombre del roster ("MG1 · Mecánico General" → "MG1").
- La fixture e2e suma `ms@`, `as@`, `mg1@`, `mpm@` sin quitar las cuentas persona que usan las demás pruebas.

## 5. Fuera de v1

- Resaltar en pantalla el botón que toca (product tour con `driver.js` y anclas `data-demo`).
- "Reset demo" que reconstruya la base desde el panel.
- Ejecutar las acciones de cada paso automáticamente.
- Textos en español; atajos de teclado.
