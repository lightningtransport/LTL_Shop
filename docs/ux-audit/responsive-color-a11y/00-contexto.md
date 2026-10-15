# 00 · Contexto y acceso — Lightning Shop (web: Admin y espacios móviles)

**Fecha:** 2026-10-15 · **Auditor:** Claude (skill audit-ux) con Cristian Perez
**slug:** responsive-color-a11y

## 1. Producto
- **Qué es:** la app del taller de camiones de Lightning Transport (ver [`../../PRD.md`](../../PRD.md)).
- **Usuarios objetivo:** Shop Manager y System Admin (Admin), Mecánico General y PM, Safety (QC).
- **Contexto de uso:** el Manager en computadora (incluida una MacBook Pro con pantalla ancha) y en teléfono caminando por el taller; mecánicos y Safety en teléfono, de pie, con prisa.
- **Plataformas:** web responsive / PWA instalable · **Navegadores:** Chrome y Safari de escritorio, Safari iOS.
- **Idioma(s):** inglés y español completos.

## 2. Repositorio
- **Estructura relevante:** `apps/web` (Next.js). Se ignora `apps/api` salvo para datos.
- **Stack de frontend:** Next.js + Tailwind + componentes propios estilo shadcn en `apps/web/src/components/ui.tsx`.
- **Dónde viven:**
  - **Tokens:** `apps/web/src/app/globals.css` y `apps/web/tailwind.config.js`, documentados en `docs/design-system/foundations.md`.
  - **Componentes:** `docs/design-system/components.md`.
  - **Patrones:** `docs/design-system/patterns.md`.
  - **Marco del Admin:** `apps/web/src/components/admin-shell.tsx` (`max-w-[1440px]`).
  - **Textos:** `apps/web/src/lib/admin-messages-catalog.ts` y `apps/web/src/lib/locale-context.tsx`.

## 3. Acceso a la app corriendo
- **Cómo arrancarla:** `.claude/launch.json` → `d44-api` (puerto 3941) y `d44-web` (puerto 3041), sobre la rama de trabajo.
- **URL local:** http://127.0.0.1:3041 · **Producción:** solo lectura visual, sin cambios.
- **Credenciales:** Dev login (bypass local) con las cuentas por rol del armado de la demo (`packages/shared/src/demo-roster.ts`).
- **Roles:** Manager (MS), mecánicos (MG1, MPM…), Safety (QC1).
- **Datos:** copia local `ltl_shop_review_208` de la base demo `ltl_shop_demo_d41`, con todas las pantallas en uso.

## 4. Flujos críticos (los que se recorren en cada ancho)
1. Ver el taller — Dashboard y Yard (`/admin`, `/admin/yard-operations`) — Manager.
2. Trabajar un camión — Truck y Work Order (`/admin/trucks/[id]`, `/admin/work-orders/[id]`) — Manager.
3. Listas con búsqueda y filtros — Trucks, Work Orders, Purchases, People — Manager.
4. Setup — Shop workflow, People, Job Catalog — Manager.
5. Mi trabajo en el teléfono — `/mechanic/standard`, `/mechanic/pm`, `/qc` — Mecánico y Safety.

## 5. Alcance
- **Incluido:**
  - **Responsive:** 375, 768, 1024, 1280, 1440, 1728 y 1920+ px. Espacios vacíos en pantallas anchas, columnas angostas, textos y placeholders cortados.
  - **Color semántico:** estados y componentes en el sistema de diseño.
  - **Accesibilidad de color y tipografía:** WCAG 2.2 AA (contraste, tamaño y foco), en claro y oscuro.
- **Excluido:** demo publicada, landing, flujos de datos (ya cubiertos en otras auditorías).
- **Restricciones:** no se toca producción ni las bases de demo originales.

## 6. Lo que ya se sabe
- **Reporte del dueño (2026-10-15):**
  - El Yard en una MacBook Pro deja grandes franjas vacías a los lados.
  - Hay placeholders de búsqueda que no se leen completos ("Truck, Work Order or mechani…").
  - En Shop workflow el chip de un miembro se parte en dos líneas y las iniciales "MPM" no caben en el avatar.
- **Auditorías previas:** `../admin-dashboard-yard/`, `../admin-truck-wo/`, `../admin-trucks-list/`, `../RESUMEN-roles-de-campo.md`.
- **Decisiones intencionales:**
  - Yard con columnas Kanban de 272–288 px y scroll lateral dentro del tablero (D33).
  - Nombres del dominio en inglés.

## 7. Pendientes
- Confirmar con el dueño la resolución exacta de su MacBook Pro (se asume 1728 px de ancho en el navegador).
