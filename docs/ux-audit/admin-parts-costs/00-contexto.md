# 00 · Contexto y acceso — Lightning Shop, Parts & costs (facturas de piezas y repuestos)

**Fecha:** 2026-10-11 · **Auditor:** Claude (skills audit-ux-0 y audit-ux-5, más un recorrido de task flows) a pedido del dueño
**slug:** admin-parts-costs

## 1. Producto
- **Qué es:** el grupo **Parts & costs** del panel de administración de Lightning Shop, construido
  en main entre el 2026-10-09 y el 2026-10-10 (PRs 269–272, 275, 276, 277; decisiones D32 y D34):
  - **Purchases:** las facturas de compra de piezas, con sus líneas, impuesto, flete, archivo y el
    camión (o camiones) al que van.
  - **Outside repairs:** las facturas de talleres externos, atadas a un camión y, si salió desde la
    WO, al Job enviado (D24).
  - **Parts:** el catálogo de partes del PM con costo de referencia, proveedor habitual y "Fits".
  - **Vendors:** los proveedores (venden partes, hacen reparaciones, o las dos cosas).
  - **Labor rate:** la tarifa por hora del taller, con fecha desde la que vale.
  - **Internal invoices:** la factura interna por camión y mes que el taller le manda a Finanzas
    (partes al costo, reparaciones externas y mano de obra), con número `SHOP-AAAA-NNNN`.
  - **Truck → Costs:** la pestaña de costos de cada camión: totales por tipo y mes, y los
    movimientos con su origen.
  - **El Job de la WO** muestra la factura del taller externo ("Invoice $685.00 · Bay Area Body Shop")
    y ofrece "Add outside repair invoice".
- **Usuarios objetivo:**
  - El **Shop Manager** (rol `manager`, par `admin.access` + `work_orders.manage`). Es quien pide las
    partes (DECISIONS, cuestionario de operación) y quien carga las facturas.
  - El **System Admin** (rol `admin`), con lo mismo.
  - Nadie más ve costos (D-PC7): mecánicos y Safety reciben "Shop Admin access denied".
  - **Finanzas no entra a la app** (D34): recibe el PDF por fuera y el Manager marca la factura
    como aceptada.
- **Contexto de uso:**
  - Según la propuesta (`docs/proposals/parts-costs/README.md`, §2): "una o dos veces por semana,
    en la computadora, con las facturas en papel o en PDF al lado". Es decir, carga en lote,
    después del hecho, en el escritorio.
  - Según D32 y `USER_FLOWS.md` (§dispositivos): el Manager trabaja "en el teléfono (caminando por
    el taller) y en la computadora". La historia del teléfono (fotografiar la factura en el
    mostrador del proveedor o cuando el taller externo entrega el camión) **no está escrita** en
    ninguna HU. Ver Pendientes.
  - Es trabajo **semanal y repetitivo** (la demo trae 47 compras en 4 meses para 27 camiones),
    más un **cierre mensual** (una factura interna por camión con costos).
  - Los errores aquí se ven tarde: en el total del camión semanas después, o en la factura que
    Finanzas recibe.
- **Plataformas:** web; computadora primero. El teléfono es posible pero no está diseñado para
  esto (ver 05, UX-5-007).
- **Idioma(s) de la interfaz:** inglés y español (`apps/web/src/lib/admin-messages.ts`).

## 2. Repositorio
- **Ruta local:** `/Users/cristianperez/LTL SHOP : ADMIN : MECHANICS/LTL_Shop`
  (worktree `.claude/worktrees/shop-factura-arquitectura-e2ed13`, rama
  `claude/shop-factura-arquitectura-e2ed13`, al día con main en abe3fcd).
- **Estructura relevante:** `apps/web` (Next.js 15, React 19, Tailwind 3, SWR), `apps/api`
  (NestJS + Prisma), `packages/shared`.
- **Dónde viven:**
  - Menú: `apps/web/src/components/admin-shell.tsx:16-53` (`navigationGroups`; el grupo Parts & costs
    en 26–38, `managerOnly`).
  - Páginas: `apps/web/src/app/admin/parts/{purchases,outside-repairs,catalog,vendors,labor-rate,internal-invoices}/`.
  - Componentes: `admin-purchases.tsx`, `admin-purchase-form.tsx`, `admin-purchase-detail.tsx`,
    `admin-outside-repairs.tsx`, `admin-outside-repair-form.tsx`, `admin-outside-repair-detail.tsx`,
    `admin-parts-catalog.tsx`, `admin-vendors.tsx`, `admin-labor-rate.tsx`,
    `admin-internal-invoices.tsx`, `admin-internal-invoice-detail.tsx`, `admin-truck-costs.tsx`
    (dentro de `admin-truck-detail.tsx`), `admin-job-table.tsx` (chip y menú del Job).
  - API: `apps/api/src/parts-costs/*.service.ts`, `invoice-registry.ts`, `parts-costs.controller.ts`
    (montado en `admin/parts-costs`, guardias `AuthGuard` + `CapabilitiesGuard(ADMIN_ACCESS)` +
    `ManagerWritesGuard`, también para lecturas).
  - Modelo: `apps/api/prisma/schema.prisma` (`Vendor` 566, `PartPurchase` 591, `InternalInvoice` 634,
    `LaborRate` 693, `OutsideRepair` 710, `PartPurchaseLine` 747, `Attachment` 778,
    `TruckCostEntry` 809).
  - Pruebas reales (`npm run test:real`): `apps/api/test-real/rows/parts-*.real.spec.ts`,
    `labor-rate.real.spec.ts`, `internal-invoice.real.spec.ts` (escenarios A53–A75).
  - Textos: `admin-messages.ts` (`navGroupPartsCosts`, `pc*`).
- **Diseño y decisiones:** `docs/DECISIONS.md` D32, D34, D-PC1…D-PC10, D24;
  `docs/proposals/parts-costs/README.md`; `docs/USER_FLOWS.md` J13, J14, HU-M11, HU-M12, HU-M13.

## 3. Acceso a la app corriendo
- **Local con datos demo (usado en esta auditoría):** base propia `ltl_shop_parts_demo`, para no
  pisar `ltl_shop_demo` que usan otras sesiones. Se arma con
  `DEMO_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ltl_shop_parts_demo npm run prisma:demo-local --workspace=@ltl-shop/api`
  (antes, `npm run build:shared` y `npm run prisma:generate --workspace=@ltl-shop/api` en un worktree nuevo).
  - Servidor en `.claude/launch.json` de este worktree: `parts-demo` (`start-demo.sh` con
    `DEMO_API_PORT=3143`, `DEMO_WEB_PORT=3044`). Se abre en `http://localhost:3044/login`.
  - Para entrar: escribir el email de una cuenta demo (`packages/shared/src/demo-roster.ts`, MS o AS)
    y "Enter demo mode". Sin contraseña. El Panel de demo cambia de cuenta.
  - Verificado el 2026-10-11: Purchases, Outside repairs, Parts, Vendors, Labor rate, Internal
    invoices y Truck → Costs cargan como MS. Como MG1, `/admin/parts/purchases` da
    "Shop Admin access denied".
  - **Archivos de factura:** la demo no tiene Storage configurado; el formulario dice "Invoice files
    are not set up in this environment" y oculta el campo. El flujo del archivo se audita solo por
    código.
- **Producción:** `https://ltl-shop-web.vercel.app`. No se usó.
- **Roles para probar:** MS (Manager), AS (System Admin), MG1 (debe quedar fuera).
- **Datos de prueba (demo):** 6 proveedores (1 inactivo), 91 partes con costo, 48 compras (una
  partida en dos camiones, una sin camión, una corregida, una anulada), 4 reparaciones externas
  (dos atadas a un Job: WO-067 afuera ahora y WO-041 ya volvió; dos sin Job), 2 tarifas ($95 y
  $105 desde el 1 de octubre), 5 facturas internas (aceptadas, enviada, anulada, borrador).

## 4. Flujos críticos (en orden de importancia)
1. **Cargar una factura de compra** (J13, HU-M12). Ruta `/admin/parts/purchases` → New purchase,
   rol Manager. Con camión, sin camión (stock), partida entre camiones, con número repetido.
2. **Cargar la factura del taller externo** (HU-M11 → HU-M12). Desde el Job de la WO ("Add outside
   repair invoice") y desde `/admin/parts/outside-repairs` → New outside repair.
3. **Saber cuánto lleva gastado un camión** y abrir el origen de un movimiento (HU-M12).
   Ruta `/admin/trucks/[id]?tab=costs`.
4. **Corregir:** editar una compra, anularla, agregarle el archivo después.
5. **Cerrar el mes y cobrarle a Finanzas** (J14, HU-M13). `/admin/parts/labor-rate` →
   `/admin/parts/internal-invoices` → New invoice → Send → Download PDF → Mark accepted.

## 5. Alcance
- **Incluido:** las 6 pantallas del grupo, sus detalles y diálogos; Truck → Costs; el chip y el menú
  del Job en la WO; computadora y teléfono; inglés (el español solo por lectura de textos).
- **Excluido:** el formulario de compra en detalle (ya auditado y corregido en PR 275, skill 7
  corrida 2 de `admin-setup`); accesibilidad (skill 2); el PM del mecánico; el resto del Admin.
- **Restricciones:** escrituras solo en `ltl_shop_parts_demo`. No se cargó ninguna compra real.

## 6. Lo que ya se sabe
- **Auditoría previa de IA** (`docs/ux-audit/admin-setup/05-navegacion-ia.md`, UX-5-004, 2026-10-07):
  se hizo **antes** de construir, desde el código. Pidió un grupo propio (no dentro de Setup), la
  pestaña Costs en Truck y rutas bajo `/admin/parts/*`. Las tres cosas se hicieron. Diseñó 4 ítems;
  el grupo construido tiene 6 (D34 agregó Labor rate e Internal invoices).
- **Formularios** (`07-formularios.md` corrida 2, UX-7-026…029) y **detalle** (UX-4-012): hechos en
  PR 275 (OPEN_ISSUES §1o).
- **Abierto en OPEN_ISSUES:** DM3 (plurales "1 lines", "1 parts").
- **Decisiones que no se reportan como defecto:** USD solo (D-PC1); impuesto y flete repartidos
  (D-PC2); el catálogo es solo el del PM (D-PC3); las partes del PM no se cobran solas (D-PC4);
  una compra sin camión no cuenta en ningún camión (D-PC5); la factura repetida se bloquea (D-PC8);
  el camión se guarda por línea (D-PC9); el archivo es opcional (D-PC10); sin stock (D32); una
  tarifa para todo el taller, partes al costo, factura por camión y mes, Finanzas no entra (D34).
  Cuando una de estas decisiones produce un hueco de flujo, el hallazgo lo dice y lo clasifica
  como **P** (pregunta al dueño), no como defecto.

## 7. JTBD e historias: evaluación

| Job / historia | Lo que promete | ¿Las pantallas lo cumplen? | Hueco |
|---|---|---|---|
| **J13** "compro partes o pago una reparación afuera → cargarla con su factura y asignarla al camión → saber cuánto cuesta cada camión" | Cargar, asignar, consultar | **Sí.** Purchases y Outside repairs cargan y asignan; Truck → Costs responde "cuánto". El número repetido, la idempotencia y las reversas protegen el dato. | El job termina en "y después cobrarle a Finanzas": falta el eslabón "¿este gasto ya se cobró?" (UX-10-002). |
| **J14** "cierro el mes → mandarle a Finanzas lo que el taller hizo por cada camión → que el taller cobre sin armar la cuenta a mano" | Cierre mensual sin trabajo manual | **A medias.** La factura por camión se arma sola. Pero "cierro el mes" es una acción sobre el mes, y la app solo ofrece un camión a la vez, sin vista del mes (UX-10-006). | Y la factura de "Sep" trae junio y agosto sin decirlo (UX-10-003). |
| **HU-M11** Mandar trabajo a un taller externo | Enviar, esperar, "Regresó" | Sí, hasta "Regresó". | La historia no dice qué pasa cuando llega la factura, que casi siempre es **después** de "Regresó"; y en ese momento el Job ya no ofrece "Add outside repair invoice" (UX-10-001). |
| **HU-M12** Saber cuánto cuesta cada camión | Catálogo, compras, reparaciones, Truck → Costs | Sí. | El título y el "Quién" todavía dicen que el cobro a Finanzas está "diseñado" y que Finanzas entrará "más adelante": contradicen D34 (corregido en esta PR). La fila A58 está dos veces. |
| **HU-M13** Cobrarle a Finanzas lo que hizo el taller | Tarifa → factura → enviar → aceptar | Sí, paso a paso. | "Me equivoqué de tarifa" no tiene salida (UX-10-005). Nada avisa cuando se corrige algo ya facturado (UX-10-002). |
| **Historia no escrita:** el Manager con el teléfono en el mostrador | — | — | Ni la propuesta ni USER_FLOWS la contemplan; la pantalla funciona en el teléfono pero no está pensada para eso (UX-5-007, UX-10-008). Decisión del dueño. |
| **Historia no escrita:** "¿cuánto costó esta WO?" | — | — | Las compras no se atan a la WO; Truck → Costs ordena por fecha, no por visita (UX-10-007). Decisión del dueño (D-PC4, D32). |

**Veredicto corto:** los jobs principales (J13 y la primera mitad de J14) están bien pensados y
bien protegidos en datos. Lo que falta no es una pantalla sino **los eslabones entre pantallas**:
volver a donde estaba, el Job que ya regresó, saber si algo ya se cobró, y el mes como unidad.

## 8. Pendientes
- **Supuesto:** el Manager carga facturas sentado, con la computadora. **Preguntar al dueño** si
  también quiere cargarlas desde el teléfono (foto de la factura en el mostrador). Cambia la
  severidad de UX-5-007 y decide UX-10-008.
- **Preguntar al dueño:** cuántos camiones se facturan por mes a Finanzas (decide UX-10-006) y si
  Finanzas acepta que una factura de septiembre traiga costos de junio (UX-10-003).
- **Preguntar al dueño:** si "¿cuánto costó esta WO?" es una pregunta que se hace (UX-10-007).
- **No verificado:** el flujo del archivo adjunto (sin Storage en la demo); el Job que **ya volvió**
  sin factura (la demo no trae uno; se infiere del código).
