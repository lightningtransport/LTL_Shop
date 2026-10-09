# Modo demo local: cambio de usuario y historias guiadas (D36)

**Clasificación:** construida en dos etapas (PR 1: modo demo y cambio de usuario; PR 2: historias guiadas).
**Fecha:** 2026-10-09.
**Rama:** `claude/demo-mode-user-switching-074ce3`.
**Pantallas:** `/login` (botón "Enter demo mode"), el encabezado de los dos shells (botón Demo) y el panel flotante en todas las pantallas con sesión.
**Referencia copiada:** el "Panel de demo" de las maquetas (`docs/proposals/wo-detail-redesign/mockup.html`, líneas 113 y 136–163): botón con matraz en el encabezado, panel fijo arriba a la derecha (360 px; en teléfono abajo), grilla de botones, `details` con "qué hace cada botón" y un botón ancho al pie. Sin mezclar con otros productos.

## Reglas que no cambian

- Nada de esto se ve ni funciona en producción. El panel se monta solo donde está Dev Login (`DEMO_MODE_AVAILABLE = DEV_LOGIN_ENABLED`, `apps/web/src/lib/dev-login.ts`, constante de build que en el deploy es `false`) y el botón aparece solo con el modo encendido en `localStorage`. La API sirve `GET /api/dev/demo/users` solo con `AUTH_DEV_BYPASS=true` (404 si no), y cambiar de usuario usa los mismos tokens `dev:` que Dev Login.
- Los roles son los de siempre: Shop Manager, System Admin, Mecánico Standard, Mecánico PM y Safety. Finance no es un usuario (recibe un PDF).
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

## 4. Segunda etapa (PR 2): historias guiadas

Sección **Story** en el panel: un `select` agrupado por job to be done (J1…J14) con las 23 HU. Elegida una, el panel muestra "Step n of m", quién (cambia de usuario si hace falta), dónde (navega a la ruta; los camiones se resuelven por número de unidad con `GET /api/trucks`, que ya trae el Work Order abierto), **Do**, **Say**, **Expect**, y los botones Back / Next / Go to screen. Mapeo HU → cuentas → camiones → rutas: ver `reference/DEMO.md` cuando se construya.

## 5. Fuera de v1

- Resaltar en pantalla el botón que toca (product tour con `driver.js` y anclas `data-demo`).
- "Reset demo" que reconstruya la base desde el panel.
- Ejecutar las acciones de cada paso automáticamente.
- Textos en español; atajos de teclado.
