# 00 · Contexto y acceso — Lightning Shop, pantallas de Setup del admin

**Fecha:** 2026-10-07 · **Auditor:** Claude (skill audit-ux) con el dueño del producto
**slug:** admin-setup

## 1. Producto
- **Qué es:** la sección "Setup" del panel de administración de Lightning Shop, la app
  del taller de camiones de Lightning Transport. Ahí el Shop Manager define:
  - los pasos obligatorios de cada Work Order (Shop workflow);
  - el catálogo de trabajos (Job Catalog);
  - las personas del taller (Mechanics).
- **Usuarios objetivo:**
  - El Shop Manager (rol `manager`, permiso `work_orders.manage`).
  - El System Admin (rol `admin`).
  - Los dos en la computadora de la oficina. No es una pantalla de campo.
- **Contexto de uso:** se usa de vez en cuando:
  - al alta o baja de una persona;
  - cuando aparece un trabajo nuevo;
  - cuando cambia quién hace cada paso.

  Los errores aquí no se notan en el momento: aparecen días después en el patio (un
  trabajo sin dueño, un carril vacío, una persona que no ve su trabajo).
- **Plataformas:** web, sobre todo computadora (≥ 1280 px). El teléfono es secundario.
- **Idioma(s) de la interfaz:** inglés y español (`apps/web/src/lib/admin-messages.ts`).

## 2. Repositorio
- **Ruta local:** `/Users/cristianperez/LTL SHOP : ADMIN : MECHANICS/LTL_Shop`
  (worktree `.claude/worktrees/shop-workflow-revision-9afabe`, rama
  `claude/shop-workflow-revision-9afabe`, al día con main en 93b26a0).
- **Estructura relevante:** `apps/web` (Next.js 15), `apps/api` (NestJS + Prisma),
  `packages/shared`.
- **Stack de frontend:**
  - React 19 y Tailwind 3, con datos por SWR (`apps/web/src/lib/admin-data.ts`).
  - Primitivas en `apps/web/src/components/ui.tsx`.
  - Design system en `docs/design-system/`.
- **Dónde viven:**
  - Shop workflow:
    - Página y componente: `apps/web/src/app/admin/setup/workflow/page.tsx` → `components/admin-shop-workflow.tsx`.
    - API: `apps/api/src/admin/shop-workflow.service.ts`.
    - Pasos al crear la WO: `apps/api/src/work-orders/mandatory-jobs.ts`.
  - Job Catalog:
    - Páginas: `apps/web/src/app/admin/catalog/page.tsx` y `.../categories/[id]/page.tsx`.
    - Componentes: `components/admin-catalog-list.tsx`, `admin-catalog-category-detail.tsx`, `admin-catalog-write.tsx`.
    - API de escritura: `apps/api/src/admin/system-admin-writes.service.ts`.
    - Recarga del catálogo base: `apps/api/prisma/job-catalog.ts`.
  - Mechanics:
    - Páginas: `apps/web/src/app/admin/mechanics/page.tsx` y `[id]/page.tsx`.
    - Componentes: `components/admin-mechanics-list.tsx`, `admin-mechanic-detail.tsx`, `admin-mechanic-roster.tsx`.
    - API: `system-admin-writes.service.ts` y `admin.service.ts`.
  - Partes (sin pantalla de admin hoy):
    - Modelos: `schema.prisma` `Part`, `PartCategory`, `PartFitment`, `PmServicePart`.
    - Carga: `apps/api/prisma/pm-parts.ts`.
  - Textos: `apps/web/src/lib/admin-messages.ts`, en EN y ES.

## 3. Acceso a la app corriendo
- **Local con datos demo (principal):** base propia `ltl_shop_setup_demo`, para no pisar
  `ltl_shop_demo`, que usan otras sesiones. Se crea con:
  `DEMO_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ltl_shop_setup_demo npm run prisma:demo-local --workspace=@ltl-shop/api`.
  - Servidores en `.claude/launch.json` de este worktree: `setup-demo-api` (3161) y `setup-demo-web` (3062).
  - Para entrar: email del Manager del seed (`apps/api/prisma/seed.ts`, línea 58) y "Dev login".
  - Verificado el 2026-10-07: Shop workflow carga como Manager.
- **Producción:** `https://ltl-shop-web.vercel.app`. Solo lectura y con la sesión del
  dueño. Las capturas del dueño del 2026-10-07 son de producción: equipos reales MA, MD,
  MG, MPM y QC.
- **Roles para probar:**
  - Manager.
  - System Admin (`admin@…` del seed), para comprobar diferencias de permiso.
  - Un mecánico: debe ser redirigido.
- **Datos de prueba:** la demo trae:
  - las personas del seed;
  - el catálogo completo, con Alignment y Air System inactivos;
  - las partes de PM;
  - el Shop workflow sin dueños.

  Se puede escribir libremente y se reinicia con el mismo comando.

## 4. Flujos críticos (en orden de importancia)
1. **Definir quién hace cada paso obligatorio** (HU-M8). Ruta `/admin/setup/workflow`, rol Manager.
   - Elegir dueño por paso y guardar.
   - Comprobar el efecto en una WO nueva.
2. **Mantener el catálogo de trabajos** (HU-A2, A24, A36). Ruta `/admin/catalog`, rol Manager.
   - Encontrar una categoría.
   - Agregar, renombrar o activar un Job.
   - Revisar sus aliases.
   - Activar una categoría inactiva.
3. **Dar de alta, cambiar o sacar a una persona** (HU-M9). Ruta `/admin/mechanics`, rol Manager.
   - Agregar una persona.
   - Cambiar su tipo.
   - Desactivarla o restablecer su contraseña.
   - Intentar borrarla.
4. **Saber de dónde salen las partes del PM** (sin historia todavía). Hoy no hay ruta:
   se audita la ausencia.

## 5. Alcance
- **Incluido:**
  - las 5 pantallas de Setup (workflow, catálogo lista y detalle, mechanics lista y detalle);
  - Shop hours, solo de pasada;
  - computadora y teléfono, claro y oscuro, inglés y español.
- **Excluido:**
  - Dashboard, Yard, Work Orders y Trucks (auditorías `admin-dashboard-yard` y `admin-truck-wo`);
  - las pantallas de campo (mecánico general, PM, Safety).
- **Restricciones:** producción solo lectura. Las escrituras se prueban en `ltl_shop_setup_demo`.

## 6. Lo que ya se sabe
- **Pedido del dueño (2026-10-07), con decisiones ya tomadas:**
  - **Equipos por paso con cola**: un Job sigue con un solo dueño. El Manager puede hacer QC como respaldo.
  - **El catálogo**: el Manager maneja categorías, Jobs y aliases, con protecciones.
  - **Mechanics**: "Remove" conserva el historial.
  - **Partes y costos por camión**, etapa 1.
  - Plan: `~/.claude/plans/revision-y-mejoras-te-abstract-locket.md`.
- **Reglas vigentes que estas decisiones cambian, por lo que no se reportan como defecto sino como "cambia por decisión":**
  - D11: un dueño por Job.
  - D19: QC de Safety.
  - D22: roster y desactivar.
  - D24: sin costos.
  - D25: las categorías no cambian.
- **Conocido:**
  - Alignment y Air System quedaron inactivos por la fusión LTR-24.
  - La cola de trabajos personalizados (`pending_review`, LTR-57) está pendiente.
  - W9 es el texto de QC en esta pantalla.

## 7. Pendientes
- **Supuesto:** el Manager usa estas pantallas en computadora. Confirmar con el dueño.
- **Preguntar al dueño:**
  - Cuántas personas hay hoy en Detailing y en Safety. Las capturas de producción muestran una sola de cada una.
  - Si los aliases los mantiene el Manager o alguien más.
