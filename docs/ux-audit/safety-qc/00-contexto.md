# 00 · Contexto y acceso — Lightning Shop, pantalla de Safety (Quality Check)

**Fecha:** 2026-10-07 · **Auditor:** Claude (skill audit-ux) con el dueño del producto
**slug:** safety-qc

## 1. Producto
- **Qué es:** la pantalla de Safety dentro de Lightning Shop, la app del taller de
  camiones de Lightning Transport. Safety revisa cada camión cuando todo lo demás ya
  está hecho y lo aprueba o lo devuelve con lo que encontró (D19, J11).
- **Usuarios objetivo:** las dos personas de Safety, cada una con su cuenta
  (capacidad `quality_check.perform`). El Manager tiene un respaldo, "Mark QC complete",
  que vive en el Truck y no es parte de esta pantalla.
- **Contexto de uso:** en el patio, de pie junto al camión, con el teléfono
  (`docs/USER_FLOWS.md` §1). Revisa un camión a la vez; dos personas comparten la misma
  lista.
- **Plataformas:** web responsive e instalable (PWA). Objetivo principal: iPhone
  Safari a 375–390 px. Secundario: computadora.
- **Idioma(s) de la interfaz:** inglés y español, los dos completos.

## 2. Repositorio
- **Ruta local:** `/Users/cristianperez/LTL SHOP : ADMIN : MECHANICS/LTL_Shop`
  (worktree `.claude/worktrees/bold-shirley-def32d`, rama `claude/qc-screen-proposal`).
- **Estructura relevante:** `apps/web` (Next.js 15), `apps/api` (NestJS + Prisma),
  `packages/shared`.
- **Stack de frontend:** React 19, Tailwind 3, primitivas propias en
  `apps/web/src/components/ui.tsx` (estilo Etapa 8). Design system en
  `docs/design-system/`.
- **Dónde viven:**
  - Ruta: `apps/web/src/app/qc/page.tsx`.
  - Pantalla: `apps/web/src/components/quality-check-page.tsx`.
  - Datos: `apps/web/src/lib/quality-check-data.ts` (cola cada 20 s).
  - Textos: `messages.qc` en `apps/web/src/lib/locale-context.tsx` (EN y ES).
  - API: `apps/api/src/quality-check/` (`GET /api/qc/queue`, `POST /api/qc/:id/take|approve|return`).
  - Tokens: `apps/web/src/app/globals.css`, `apps/web/tailwind.config.js`.

## 3. Acceso a la app corriendo
- **Local con datos demo (principal):** base `ltl_shop_demo`
  (`npm run prisma:demo-local --workspace=@ltl-shop/api`, la reinicia). Servidores
  `qc-demo-api` (3151) y `qc-demo-web` (3052) en `.claude/launch.json`. Se entra con
  "Dev login" y las cuentas de Safety del seed (`apps/api/prisma/seed.ts`, líneas 38–39).
  En la demo, WO-006 (Truck 606) está listo para QC. Verificado el 2026-10-07: la
  lista carga y Take funciona (después del arreglo Q1, #250).
- **Producción:** `https://ltl-shop-web.vercel.app`, **solo lectura**, con la sesión que
  abra el dueño. La cuenta de Safety de producción la creó el dueño (G9, #249).
- **Roles para probar:** Safety (esta pantalla). Mecánico y Manager no pueden entrar
  (QC4); se comprueba que los redirige.
- **Datos de prueba:** la demo tiene un camión listo para QC. Para "tomado por la otra
  persona", "devuelto" y "lista vacía" se usan las dos cuentas de Safety y las acciones
  de la demo (se reinicia después).

## 4. Flujos críticos (en orden de importancia)
1. **Revisar y aprobar un camión** (HU-QC1, J11): ver la lista → Take → revisar →
   Approve. Ruta `/qc`. Rol: Safety.
2. **Devolver con lo que encontró** (HU-QC1, QC3): Take → Return con nota → el camión
   pasa a "Returned". Ruta `/qc`. Rol: Safety.
3. **Saber qué tomó la otra persona y qué está esperando al Manager** (QC2, QC3): la
   lista con camiones tomados y devueltos. Ruta `/qc`. Rol: Safety.

## 5. Alcance
- **Incluido:** `/qc` con la cuenta de Safety, en teléfono y computadora, claro y
  oscuro, inglés y español.
- **Excluido:** "Mark QC complete" del Manager (Truck, auditoría `admin-truck-wo`) y
  las pantallas de los mecánicos (auditorías `mecanico-general` y `mecanico-pm`).
- **Restricciones:** producción solo lectura. Las acciones se prueban en la demo local.

## 6. Lo que ya se sabe
- **Reglas que no se reportan como hallazgos:**
  - D19: el QC lo hace Safety, que toma, aprueba o devuelve con nota obligatoria.
  - Safety no registra tiempo.
  - Un camión devuelto no se puede tomar hasta que el Manager resuelva.
- **Trabajo previo:**
  - Q1 (la lista no cambiaba tras Take/Approve/Return) arreglado en #250.
  - Propuesta `docs/proposals/qc-screen-redesign/`, hecha antes de esta auditoría:
    estos archivos la confirman o la corrigen.
  - `docs/OPEN_ISSUES.md` §1j.

## 7. Pendientes
- **Qué revisa Safety físicamente en el camión** (luces, llantas, frenos…): define si
  hace falta una lista de revisión (D-QC4). Preguntar al dueño o a Safety.
- **Supuesto:** Safety usa sobre todo el teléfono. Confirmar con el dueño.
