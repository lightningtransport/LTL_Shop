# 00 · Contexto y acceso — Lightning Shop, panel del Manager (IA completa) y Parts & costs a fondo

**Fecha:** 2026-10-18 · **Auditor:** Claude (skills audit-ux-0, audit-ux-5, audit-ux-3 y audit-ux-9, más un recorrido de JTBD), a pedido del dueño
**slug:** admin-ia-2026-10

## 1. Producto

- **Qué es:** el panel de administración de Lightning Shop (`/admin/*`), donde el taller planea, asigna, cobra y configura.
- **Por qué se audita:** el dueño ve Parts & costs confuso y redundante:
  - el Manager tiene "Count" pero no puede gestionar el stock (agregar, cambiar, sacar);
  - las "partes del PM" parecen una cosa y Stock otra.
  - Además, la arquitectura de información (IA) del panel cambió mucho desde las auditorías anteriores.
- **Qué cambió desde las auditorías anteriores** (Dashboard/Yard, Truck/WO y Setup del 2026-10-07; Parts & costs del 2026-10-11):
  - D41 (inspección con llantas);
  - D42 y D44 (Samsara y camiones);
  - D45 (repuestos, stock y llantas, ST-1 a ST-6);
  - D46 (Safety);
  - el tablero Kanban del Yard (D33);
  - la ronda de rendimiento LTR-237.
- **Usuarios objetivo:**
  - **Shop Manager** (rol `manager`, con el par `admin.access` + `work_orders.manage`). Pide las partes, carga las facturas, planea el día y cierra el mes.
  - **System Admin** (rol `admin`). Ve lo mismo.
  - **Mecánico General, mecánico de PM y Safety:** quedan fuera del panel. Solo se consideran donde el panel decide lo que ellos ven (las partes del PM, las partes de un Job).
  - **Finanzas:** no entra a la app (D34).
- **Contexto de uso:**
  - **Computadora, en la oficina:** facturas (D37), cierre del mes, catálogo, Setup.
  - **Teléfono, caminando por el taller:** Dashboard, Yard, Work Orders, inspección.
  - El stock se cuenta de pie frente al estante, así que el teléfono importa para Count.
- **Plataformas:** web responsive. Menú lateral desde `lg`; debajo, un menú que se abre con el botón (`admin-shell.tsx`).
- **Idioma:** inglés en la interfaz del taller. Los textos viven en `apps/web/src/lib/admin-messages-catalog.ts` (inglés y español).

## 2. Repositorio

- **Ruta local:** `/Users/cristianperez/LTL SHOP : ADMIN : MECHANICS/LTL_Shop`. Esta auditoría corre en el worktree `.claude/worktrees/sync-cursor-changes-0e5f2e`, al día con `main` en 9323783 (PR 359).
- **Stack:** `apps/web` (Next.js 15, React 19, Tailwind, SWR), `apps/api` (NestJS + Prisma) y `packages/shared`.
- **Dónde viven las cosas:**
  - **Menú:** `apps/web/src/components/admin-shell.tsx:16-60` (`navigationGroups`).
  - **Rutas:** `apps/web/src/app/admin/**`. Parts & costs está en `apps/web/src/app/admin/parts/{purchases,outside-repairs,internal-invoices,stock,catalog,vendors,labor-rate}`.
  - **Componentes de Parts & costs:** `admin-purchases.tsx`, `admin-purchase-form.tsx`, `admin-purchase-detail.tsx`, `admin-stock.tsx`, `admin-parts-catalog.tsx`, `admin-job-stock-dialog.tsx`, `admin-job-tires-dialog.tsx`, `admin-job-table.tsx` (menú del Job), `admin-truck-costs.tsx`, `admin-internal-invoice*.tsx` y `admin-labor-rate.tsx`.
  - **API:** `apps/api/src/parts-costs/` (`stock.service.ts`, `stock-ledger.ts`, `pm-charges.ts`, `purchases.service.ts`, `parts-catalog.service.ts`, `cost-ledger.ts`).
  - **Modelo:** `apps/api/prisma/schema.prisma`:
    - `PartCategory` 655 y `Part` 673: un solo catálogo, con `kind` pm / repair / tire;
    - `StockMovement` 722;
    - `PartPurchaseLine` 980, con `destination` truck / stock / shop_supplies;
    - `TruckCostEntry` 1048, `PmService` y `PmServicePart` 1094/1111, `JobTireChange` 1529.
  - **Historias y decisiones:**
    - `docs/USER_FLOWS.md`: J13, J14, J22–J26, HU-M12, HU-M13, HU-M19 y HU-PM1;
    - `docs/DECISIONS.md`: D32, D34, D37, D45 y P24–P31;
    - `docs/proposals/parts-stock-tires/README.md` y `docs/SYSTEM.md:359-497`.

## 3. Acceso a la app corriendo

- **Cómo arrancarla:** `.claude/launch.json` de este worktree, con `ia-api` (puerto 3211) e `ia-web` (puerto 3210). Usa los mismos `.env` que el checkout principal y la base local `ltl_shop`. Se eligieron puertos propios para no matar los 3000/3001 de otras sesiones (`start-local.sh` los libera a la fuerza).
  - Antes de arrancar: `npm ci`, `npm run build:shared`, `prisma:generate` y `prisma migrate deploy`. Este último aplicó en la base local el índice de PR 357, que faltaba.
- **URL local:** `http://127.0.0.1:3210`. Producción no se usó. La demo tampoco: está congelada.
- **Cómo entrar:** "Dev login (local bypass)" con el email de la cuenta seed del Manager (`apps/api/prisma/` seed, `manager@…`). No hay contraseña.
- **Roles:** Manager (recorrido) y System Admin (por código). El mecánico solo se miró para ver qué partes le llegan.
- **Datos locales:**
  - 126 partes, todas de las categorías del PM, más las categorías "Repair parts" y "Tires", que están vacías;
  - **0 movimientos de stock y 0 compras.** Sirve para el "primer día del stock";
  - 9 camiones y 9 Work Orders, uno de ellos con PM.
- **Verificado el 2026-10-18:**
  - entró como Manager;
  - cargan Stock, Parts, el formulario de New purchase y el menú del Job en `WO-009`;
  - un Count de 10 filtros LF3654 a $12.50 dejó "1 parts · $125.00 on the shelf".
- **Capturas:** el panel del navegador quedó angosto, de ancho de teléfono, así que las capturas de `evidencia/` son de teléfono. Lo de computadora se cita con texto de la página `(observado)` o con código `(inferido del código)`.

## 4. Flujos críticos (en orden)

1. **Primer día del stock:** contar lo que hay en el estante. Rol Manager, entrada en `/admin/parts/stock` → Count (P25).
2. **Compra → estante o camión → Job:** cargar la factura y decidir línea por línea (J22). Entrada en `/admin/parts/purchases` → New purchase.
3. **Parte del estante a un Job:** cobrarla al camión una vez (J24). En la WO, menú del Job → Parts from stock.
4. **PM que saca partes del estante** (ST-5, P29): el mecánico de PM elige las partes y el Manager completa la WO.
5. **Saber cuánto cuesta un camión y cerrar el mes** (J13, J14): Truck → Costs → Internal invoices.
6. **Encontrar cualquier destino del panel** (IA): Operación, Parts & costs, Setup y Auditoría, en computadora y teléfono.

## 5. Alcance

- **Incluido:**
  - todo el menú del panel, sus rutas y pestañas;
  - Parts & costs a fondo, con sus historias, nombres y textos;
  - el menú del Job en lo que toca a partes.
- **Excluido:**
  - accesibilidad (ya auditada en `responsive-color-a11y`);
  - el detalle visual de cada pantalla;
  - el PM del mecánico, salvo qué parte elige;
  - la demo (congelada).
- **Restricciones:**
  - solo la base local;
  - no se toca código de la app: la etapa es documentos y propuesta (regla "docs primero").

## 6. Lo que ya se sabe

- **Auditorías de IA anteriores:** `admin-setup/05` (2026-10-07), `admin-dashboard-yard/05`, `admin-truck-wo/05` y `admin-parts-costs/05` (2026-10-11, anterior a Stock).
- **Defecto encontrado durante esta auditoría:** **LTR-242**, clase **B**. Completar un PM cobra dos veces una parte que ya se compró directo al camión. Lo prueba la fila A133 de test:real (PR 360). El caso B también se confirmó: "Parts from stock" en el Job del PM más la parte elegida por el mecánico cobra $48 en vez de $24 (fila A134, mismo PR).
- **Decisiones que no se reportan como defecto:**
  - costo promedio (P27);
  - el PM saca del estante y cobra el cambio de aceite a precio fijo (P29);
  - el conteo inicial a mano (P25);
  - solo el Manager saca del stock (P28 abierta, recomendación vigente);
  - las facturas se cargan en la computadora (D37);
  - Finanzas no entra (D34).

  Cuando una de estas produce un hueco, el hallazgo lo dice y lo marca como **pregunta al dueño**.

## 7. Pendientes

- **P28** (¿el mecánico confirma lo que usó?) y **P26** (medidas de llanta) siguen abiertas, para Randy. Afectan la propuesta de stock y no se resuelven aquí.
- **Sin verificar en la app:**
  - el menú del teléfono con todos los grupos;
  - las llantas, porque no hay partes de tipo Tires en la base local;
  - el PDF de la factura, porque no hay Storage en local.
