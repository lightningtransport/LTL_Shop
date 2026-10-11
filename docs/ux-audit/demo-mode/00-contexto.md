# 00 · Contexto y acceso — Lightning Shop, modo demo (Panel de demo y pantallas del flujo)

**Fecha:** 2026-10-10 · **Auditor:** Claude (skill audit-ux) con el dueño del producto
**slug:** demo-mode

## 1. Producto
- **Qué es:** el **modo demo** de Lightning Shop (D36, PRs 283–285): un panel flotante,
  solo en builds locales, con el que el dueño presenta la app a la gente del taller
  cambiando de cuenta sin iniciar sesión y siguiendo historias guiadas paso a paso.
  La auditoría cubre el panel y **las pantallas de la app que recorre la demo** en los
  cinco perfiles (Manager, Admin, mecánico general/alineación/detailing, PM, Safety),
  porque lo que se presenta es la app, no el panel.
- **Usuarios objetivo:**
  - **El presentador** (el dueño, en su laptop): usa el panel, lee "Do / Say / Expect",
    toca lo que dice cada paso. Lo usa pocas veces, con público delante y sin tiempo
    para buscar.
  - **La audiencia** (Manager, mecánicos, PM, Safety del taller): ve las pantallas y
    tiene que entender qué hace cada perfil y por qué. No toca nada.
- **Contexto de uso:** laptop a pantalla completa, proyectada o compartida. Puede
  haber una segunda pasada en teléfono para mostrar la app del mecánico. Público en
  español; textos del panel en inglés por decisión del dueño (2026-10-09); la app se
  puede poner en español desde el perfil.
- **Plataformas:** web (Chrome/Safari en macOS a ≥ 1200 px); teléfono 375–390 px solo
  para las pantallas del mecánico, PM y Safety.
- **Idioma(s) de la interfaz:** app en inglés y español; panel y guion solo en inglés.

## 2. Repositorio
- **Ruta local:** `/Users/cristianperez/LTL SHOP : ADMIN : MECHANICS/LTL_Shop`
  (worktree `.claude/worktrees/demo-mode-user-switching-074ce3`, rama
  `claude/demo-ux-audit`, desde main `f1c723f`).
- **Estructura relevante:** `apps/web` (Next.js 15, React 19, Tailwind 3, SWR),
  `apps/api` (NestJS + Prisma), `packages/shared`.
- **Stack de frontend:** primitivas propias en `apps/web/src/components/ui.tsx`,
  design system en `docs/design-system/`.
- **Dónde viven:**
  - Panel: `apps/web/src/components/demo-panel.tsx` (botón Demo, grilla de cuentas,
    selector de historia, tarjeta de paso, Reset/Leave).
  - Estado y acciones: `apps/web/src/lib/demo/` (`state.ts`, `demo-context.tsx`,
    `switch-user.ts`, `resolve-target.ts`, `cast.ts`, `scripts.ts` = 23 historias,
    ~99 pasos, en inglés).
  - Entrada: `apps/web/src/app/login/page.tsx` ("Enter demo mode").
  - Puerta: `apps/web/src/lib/dev-login.ts` (`DEMO_MODE_AVAILABLE`); API
    `apps/api/src/dev-demo/` (`GET /api/dev/demo/users`, 404 sin `AUTH_DEV_BYPASS`).
  - Columna reservada para el panel: `apps/web/src/app/globals.css`
    (`html[data-demo-panel='open']`).
  - Datos de la demo: `apps/api/prisma/reset-demo-work-orders.ts --demo` y
    `demo-*.ts`; guía del presentador `docs/reference/DEMO.md`.
  - Textos de la app: `apps/web/src/lib/admin-messages.ts` (Admin) y
    `apps/web/src/lib/locale-context.tsx` (mecánico, PM, Safety), EN y ES.
  - Pantallas que recorre el flujo: `apps/web/src/app/admin/**` (Dashboard, Yard,
    Work Orders, Trucks, Parts & costs, People, Job Catalog, Shop workflow, History),
    `apps/web/src/app/mechanic/{standard,pm}/**`, `apps/web/src/app/work-orders/[id]`,
    `apps/web/src/app/qc`.

## 3. Acceso a la app corriendo
- **Cómo arrancarla:** `npm run prisma:demo-local --workspace=@ltl-shop/api` (arma
  `ltl_shop_demo`; hacerlo la mañana de la demo) y `npm run start:demo`
  (`start-demo.sh`: API `:3141`, web `:3042`). En esta máquina el 3141 lo ocupa otra
  sesión, así que: `DEMO_API_PORT=3151 DEMO_WEB_PORT=3042 npm run start:demo`.
- **URL local:** `http://localhost:3042` (siempre `localhost`: ver UX-1-003) · **Staging/prod:** no (el modo demo no existe
  ahí).
- **Credenciales de prueba:** cuentas del seed (`apps/api/prisma/seed.ts`) con "Dev
  login"; con el panel no hace falta escribir ninguna. Entrar por `/login` →
  "Enter demo mode (this machine only)" con la cuenta del Manager.
- **Roles disponibles para probar:** Shop Manager (`/admin`), System Admin (`/admin`),
  mecánico general / alineación / detailing (`/mechanic/standard`), mecánico PM
  (`/mechanic/pm`), Safety (`/qc`). Las cuentas se van a renombrar por rol (MS, AS,
  MG1–3, MA, MD, MPM, QC1–2) en la PR siguiente; esta auditoría las ve todavía con
  nombres de persona.
- **Datos de prueba:** la base demo trae 21 Work Orders abiertos, uno por situación
  (601–617, 905–968), 4 meses de historia, Partes y costos, tarifa y facturas. La
  tabla por camión está en `docs/reference/DEMO.md`. Algunas historias mutan datos
  (Start, Approve, Close…): se rearma la base para repetirlas.

## 4. Flujos críticos (en orden de importancia para el negocio)
Son los capítulos del flujo de demo que se va a construir (plan aprobado 2026-10-10);
hoy existen como historias sueltas en el panel.
1. **El presentador entra y cambia de cuenta** — si esto falla no hay demo — `/login`
   → panel → grilla de cuentas — presentador.
2. **Llega un camión: Work Order, inspección, reparto** — es el núcleo del Manager —
   `/admin/trucks` → Truck 973 / 601 / 602 — Manager.
3. **El mecánico trabaja y se bloquea; el Manager destraba** — reloj, cola del equipo,
   notas, bloqueo — `/mechanic/standard`, `/work-orders/[id]`, `/admin/trucks/[id]` —
   mecánico general + Manager.
4. **PM, Alignment y Detailing** — `/mechanic/pm`, `/work-orders/[id]?view=pm`,
   `/mechanic/standard` — PM, alineación, detailing.
5. **Safety aprueba o devuelve; el Manager cierra y devuelve a servicio** — `/qc`,
   `/admin/work-orders/[id]`, `/admin/trucks/[id]` — Safety + Manager.
6. **Ver el taller y la operación** — `/admin`, `/admin/yard-operations`,
   `/admin/work-orders`, `/admin/history` — Manager.
7. **Costos y Finanzas; Setup y personal** — `/admin/parts/*`, `/admin/setup/*`,
   `/admin/mechanics`, `/admin/catalog` — Manager y Admin.
8. **El presentador sigue una historia paso a paso** — selector, tarjeta de paso,
   Back/Next/Go to screen, auto-follow — presentador.

## 5. Alcance
- **Incluido:** el Panel de demo en todos sus estados; `/login` con "Enter demo mode";
  cada pantalla que tocan los flujos 2–7 en los cinco perfiles, en laptop (≥ 1200 px)
  y, para mecánico/PM/Safety, también a 390 px.
- **Excluido y por qué:** Dispatch/Movement, Samsara, archivos de factura y
  contraseñas temporales (no existen en local, `DEMO.md` lo dice); producción;
  accesibilidad formal (skill 2) y técnico/red (skill 8), que no cambian lo que se
  presenta; las pantallas ya auditadas en `admin-setup`, `admin-truck-wo`,
  `admin-dashboard-yard`, `mecanico-general`, `mecanico-pm` y `safety-qc` solo se
  vuelven a mirar en lo que afecta a la demo (no se repite la auditoría completa).
- **Restricciones:** base local descartable; se puede mutar todo. No tocar las bases
  `ltl_shop` ni `ltl_shop_test` ni la API del 3141 (otra sesión).

## 6. Lo que ya se sabe
- Ensayo completo del 2026-10-09/10 (PR 285): textos de los pasos ajustados a la
  pantalla; el panel tapaba botones (corregido con la columna reservada); defectos
  abiertos DM1–DM3 en `docs/OPEN_ISSUES.md` §1p (lista de Work Orders sin "Return to
  Service"; filtro de People que no refleja la URL; plurales con 1).
- Decisiones del dueño que **no** se reportan como hallazgos: textos del panel en
  inglés; los pasos guían y el presentador toca (sin ejecutar acciones ni resaltar
  elementos en v1); copia fiel del panel de las maquetas; nombres de cuenta por rol y
  flujo continuo con capítulos ya están decididos y se construyen en las PRs B y C
  (los hallazgos sobre nombres de persona y títulos "HU-M4 · …" se anotan pero se
  resuelven ahí).
- Auditorías previas por perfil en `docs/ux-audit/*` y el resumen
  `RESUMEN-roles-de-campo.md`.

## 7. Pendientes
- Asumido (dueño no consultado en esta corrida): la audiencia ve la app en español;
  el presentador la deja en inglés o la cambia desde el perfil antes de empezar.
- Asumido: la demo se da en laptop; el teléfono se usa solo para enseñar la app del
  mecánico en mano.
