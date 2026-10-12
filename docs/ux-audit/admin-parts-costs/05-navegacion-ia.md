# 05 · Navegación y arquitectura de información — Parts & costs (Admin)

**Fecha:** 2026-10-11 · **Alcance:** las 6 pantallas de Parts & costs, sus detalles, Truck → Costs y el Job de la WO; computadora y teléfono; roles MS, AS y MG1 · **Método:** código + navegador (demo `ltl_shop_parts_demo` en `localhost:3044`)
**Resumen:** 9 hallazgos, 3 de severidad 3. La estructura grande es correcta (grupo propio, fuera de Setup, solo para quien ve dinero, Costs como pestaña del camión). Lo que falla es el **movimiento entre pantallas**: ninguna lista de este grupo recuerda sus filtros, "Volver" lleva siempre a la lista y no a donde se venía, y el camión al que se llega desde una compra se abre en Overview con el crumb "Yard Operations". El grupo mezcla trabajo semanal, catálogos, un ajuste y el cierre de mes en una lista plana de 6 ítems; Vendors y Labor rate son callejones sin salida.

## Mapa de navegación observado

Clics contados desde el Dashboard como MS. Todo el grupo exige el par Manager (`admin-shell.tsx:29`, `useCanShowManagerWrites`); la API exige lo mismo para leer (`parts-costs.controller.ts:19-21`).

| Ruta | Etiqueta EN / ES | Cómo se llega | Clics | Rol |
|---|---|---|---|---|
| `/admin/parts/purchases` | Purchases / Compras | Sidebar; "Back to Purchases" del detalle; Truck → Costs "Add purchase" (`?new=1&truckId=`) y la nota "Purchases" | 1 | MS, AS |
| *(diálogo)* New purchase | New purchase / Nueva compra | Botón de la lista; `?new=1` | 2 | MS, AS |
| `/admin/parts/purchases/[id]` | "{Vendor} · {Invoice #}" | Fila de la lista; después de guardar; movimiento de Truck → Costs; línea de factura interna; "Open it" del duplicado | 2 | MS, AS |
| `/admin/parts/outside-repairs` | Outside repairs / Reparaciones externas | Sidebar; back del detalle; Truck → Costs "Add outside repair"; menú "…" del Job (`?new=1&truckId=&jobId=`) | 1 | MS, AS |
| *(diálogo)* New outside repair | New outside repair | Botón; `?new=1` | 2 (desde el Job: 3) | MS, AS |
| `/admin/parts/outside-repairs/[id]` | "{Vendor} · {Invoice #}" | Fila; después de guardar; chip "Invoice $… · Vendor" del Job; movimiento; línea de factura interna | 2 | MS, AS |
| `/admin/parts/catalog` | Parts / Partes | Sidebar; `<a target=_blank>` desde una línea "Other" del formulario | 1 | MS, AS |
| `/admin/parts/vendors` | Vendors / Proveedores | **Solo sidebar** | 1 | MS, AS |
| `/admin/parts/labor-rate` | Labor rate / Tarifa de mano de obra | Sidebar; Truck → Costs "Set a labor rate" **solo si no hay tarifa** | 1 | MS, AS |
| `/admin/parts/internal-invoices` | Internal invoices / Facturas internas | Sidebar; tarjeta "Charge to Finance" de Truck → Costs; back del detalle | 1 | MS, AS |
| `/admin/parts/internal-invoices/[id]` | "SHOP-… · Truck · Month" o "Draft" | Fila; después de crear; "Open it" si ya hay borrador | 2 | MS, AS |
| `/admin/trucks/[id]?tab=costs` | Costs / Costos ("Costs of Truck 991") | Pestaña del camión; link del camión en la factura interna (único que pasa `?tab=costs`) | 3 (Trucks → camión → Costs) | MS, AS; los demás no ven pestañas |
| Job de la WO (sin ruta) | chip "Invoice $685.00 · Bay Area Body Shop"; menú "Add outside repair invoice" | `/admin/work-orders/[id]` | 2–3 | MS, AS |

**Tareas diarias y sus clics:** cargar una compra, 2; cargar la factura de un Job que está afuera, 3 desde la WO; ver los costos de un camión, 3 (o 1 desde una factura interna); corregir una compra, 3; cerrar el mes de un camión, 3 + 1 por acción (Send, PDF, Accepted). Ninguna pasa de 4: la profundidad no es el problema.

**Rutas huérfanas:** ninguna. **Solo por sidebar:** Vendors siempre; Labor rate una vez fijada la tarifa.

**Menú observado (sidebar, un nivel, sin submenús; `admin-shell.tsx:16-53`):**
```
Operations     Dashboard · Yard Operations · Work Orders · Trucks
Parts & costs  Purchases · Outside repairs · Parts · Vendors · Labor rate · Internal invoices
Setup          People · Job Catalog · Shop workflow
Audit          History
```

## Estructura propuesta

El problema no es la ubicación del grupo (está bien antes de Setup, D32 y UX-5-004 de `admin-setup`) sino que sus 6 ítems responden a cuatro ritmos distintos. Propuesta mínima, sin cambiar rutas ni inventar un patrón nuevo (el sidebar ya usa títulos de grupo):

```
Parts & costs
  Purchases                 ← semanal
  Outside repairs           ← semanal
  Internal invoices         ← mensual (sube: es el cierre del job J14, hoy está último)
  Parts                     ← catálogo
  Vendors                   ← catálogo
Setup
  People · Job Catalog · Shop workflow · Labor rate   ← ajuste que se toca una vez al año
```

Qué se mueve y por qué:
- **Labor rate → Setup.** Se fija una vez y vale hasta nueva orden (D34); es un parámetro del
  taller como las horas o los pasos del workflow, no trabajo de la semana. Truck → Costs ya enlaza
  "Set a labor rate" cuando no hay tarifa, y ese enlace sigue valiendo.
- **Internal invoices sube** a tercero: es el final del flujo J13 → J14 (comprar → asignar → cobrar).
  Hoy está último, después de dos catálogos.
- **Parts y Vendors** quedan al final del grupo: son datos maestros que se consultan desde las
  compras más que por sí mismos.

Alternativa si el dueño prefiere no tocar Setup: dejar los 6 en el grupo pero en este orden
(Purchases, Outside repairs, Internal invoices, Parts, Vendors, Labor rate). Cualquiera de las dos
es un cambio de `navigationGroups` y de la auditoría `demo-mode` que lista el menú.

## Hallazgos

### ¿Cómo vuelvo?

### UX-5-001 · Volver desde un detalle pierde los filtros de la lista
- **Dónde:** Purchases (`/admin/parts/purchases`), Outside repairs, Parts y el período de Truck → Costs · `apps/web/src/components/admin-purchases.tsx:31` (`useState({ q, vendorId, truckId, from, to, noFile })`), `admin-outside-repairs.tsx`, `admin-parts-catalog.tsx:77-79`, `admin-truck-costs.tsx:40` (`useState<Period>('3months')`)
- **Evidencia:** (observado) Purchases con Vendor = FleetPride muestra "21 purchases · $3,796.29"; abrir FP-48840 y tocar "Back to Purchases" vuelve a "47 purchases · $16,943.48", sin filtro. El botón Atrás del navegador hace lo mismo. `evidencia/05-menu-y-purchases.jpg`, `evidencia/05-purchase-detail.jpg`. Compárese con Trucks, Work Orders e History, que guardan los filtros en la URL (`admin-trucks-list.tsx:16-23`).
- **Criterio:** Nielsen H3 (control y libertad del usuario) · IA §5 "Volver lleva a donde estaba el usuario, con los filtros y la página que tenía" · consistencia interna (H4).
- **Severidad:** 3 · Frecuencia alta (revisar las facturas de un proveedor o de un camión es la tarea semanal: se abren varias seguidas), impacto medio (rehacer el filtro cada vez), persistente.
- **Recomendación:** Llevar los filtros a `URLSearchParams` como hacen las otras listas del Admin (`?vendorId=&truckId=&q=&from=&to=&noFile=1`), y el período de Costs a `?tab=costs&period=3months`. De paso, las filas pasan a ser enlaces compartibles ("mirá las compras de FleetPride de septiembre").
- **Esfuerzo:** M

### UX-5-002 · "Volver" lleva siempre a la lista, no a donde se venía; el camión se abre en Overview con el crumb "Yard Operations"
- **Dónde:** `AdminBackLink` (`apps/web/src/components/ui.tsx:804-821`, destino fijo) en `admin-purchase-detail.tsx:35,56`, `admin-outside-repair-detail.tsx:31,47`, `admin-internal-invoice-detail.tsx:59,93` · enlaces al camión sin `?from=` en `admin-purchase-detail.tsx:86,133,147`, `admin-outside-repair-detail.tsx:70`, `admin-internal-invoice-detail.tsx:130` · `lib/admin-truck-origin.ts:18-23` (sin `from`, el origen es Yard Operations) · `admin-purchases.tsx:46-51` (`?new=1` se borra con `router.replace(pathname)`)
- **Evidencia:** (observado) Desde Truck 991 → Costs → movimiento FP-48840 → "Back to Purchases" lleva a la lista de compras, no al camión. Desde la compra, "Truck 991" abre el camión en **Overview** con el crumb "Yard Operations › 991" y el ítem "Trucks" marcado en el sidebar; para ver Costs hay que tocar la pestaña otra vez. Desde Costs, "Add purchase" abre el diálogo con el camión ya elegido ("All of it goes to Truck 991"), pero Cancel o Save dejan al usuario en la lista de Purchases, no en el camión. `evidencia/05-truck-costs.jpg`, `evidencia/10-new-purchase-desde-camion.jpg`.
- **Criterio:** IA §5 (movimiento: volver a donde estaba) · Nielsen H3 · orientación (§4: el crumb dice de dónde vengo).
- **Severidad:** 3 · Frecuencia alta (Truck → Costs es el centro del flujo "cuánto cuesta este camión" y cada movimiento sale de ahí), impacto medio (2 clics extra y desorientación), persistente.
- **Recomendación:** (1) Los enlaces al camión desde este grupo pasan `?from=<ruta actual>` y `&tab=costs` (`adminTruckHref` ya existe para esto). (2) `AdminBackLink` acepta un `from` leído de la URL, con la lista como fallback. (3) `?new=1&truckId=` guarda `from` y vuelve ahí al cerrar; después de guardar desde un camión, volver a Costs de ese camión (que es donde se ve el efecto) y no al detalle de la compra.
- **Esfuerzo:** M

### ¿Qué hay aquí? ¿A dónde puedo ir?

### UX-5-003 · El grupo mezcla cuatro ritmos de trabajo en una lista plana de 6 ítems
- **Dónde:** Sidebar, grupo Parts & costs · `apps/web/src/components/admin-shell.tsx:26-38`
- **Evidencia:** (observado) Purchases y Outside repairs son trabajo semanal; Parts y Vendors, catálogos; Labor rate, un ajuste anual; Internal invoices, el cierre de mes. El orden es el orden en que se construyeron (PC-1 a PC-4, luego LB-1 y LB-2): el cierre del job J14 queda último, detrás de los catálogos. La propuesta y la auditoría previa diseñaron 4 ítems; D34 agregó 2 sin revisar el orden. `evidencia/05-menu-y-purchases.jpg`.
- **Criterio:** IA §3 (un criterio de agrupación por nivel; lo más usado primero; lo administrativo abajo).
- **Severidad:** 2 · Frecuencia alta (el menú se ve siempre), impacto bajo (las etiquetas son claras y se aprende en una semana), persistente.
- **Recomendación:** La estructura propuesta arriba: Labor rate a Setup, Internal invoices a tercero. Si no se toca Setup, al menos reordenar.
- **Esfuerzo:** S

### UX-5-004 · Vendors es un callejón sin salida, y los filtros de proveedor no distinguen quién hace qué
- **Dónde:** `/admin/parts/vendors` · `apps/web/src/components/admin-vendors.tsx` (ningún `href`) · filtros Vendor en `admin-purchases.tsx` y `admin-outside-repairs.tsx`
- **Evidencia:** (observado) La fila de un proveedor solo tiene el lápiz de editar; "Usual vendor of · 3 parts" no es enlace; no hay forma de ver "todas las facturas de FleetPride" sin ir a Purchases y filtrar a mano, y luego a Outside repairs y filtrar otra vez. El filtro Vendor de Purchases lista a Bay Area Body Shop y Diesel Pro Repair (solo reparaciones) y a Old Supply Co (inactivo); el de Outside repairs lista a FleetPride y TruckPro (solo partes). El formulario de compra, en cambio, sí limita a proveedores activos que venden partes. `evidencia/05-vendors.jpg`, `evidencia/05-outside-repairs.jpg`.
- **Criterio:** IA §5 (desde un detalle se puede ir a lo relacionado sin pasar por el menú) · §6 (filtros con opciones que tienen sentido) · consistencia (H4).
- **Severidad:** 2 · Frecuencia media (conciliar con un proveedor, reclamar una factura), impacto medio (dos listas y dos filtros), persistente.
- **Recomendación:** El nombre del proveedor enlaza a `Purchases?vendorId=` y la fila muestra "N purchases · N repairs · last invoice {date}" como enlaces (requiere UX-5-001). Los filtros Vendor de cada lista muestran solo los proveedores que hacen ese tipo de trabajo, con los inactivos al final y marcados.
- **Esfuerzo:** S (filtros) + M (enlaces y conteos)

### UX-5-005 · Desde una Work Order no se llega a los costos del camión ni se ve lo que costó
- **Dónde:** `/admin/work-orders/[id]` · `admin-work-order-detail.tsx` (enlaza al camión sin `tab=costs`); `admin-truck-costs.tsx:27-32` (el movimiento de mano de obra enlaza a la WO, pero no al revés)
- **Evidencia:** (observado) En WO-041 (Transmission, volvió del taller externo con factura de $3,850) no aparece ninguna cifra ni enlace a Costs; solo el Job afuera (WO-067) muestra el chip "Invoice $685.00 · Bay Area Body Shop". La pregunta "¿cuánto va esta WO?" se responde yendo a Trucks → camión → Costs y sumando a mano los movimientos de esa fecha.
- **Criterio:** IA §5 (ir a lo relacionado) · "un contenido, un lugar" (§3) se cumple, pero sin enlace de ida.
- **Severidad:** 2 · Frecuencia media (al cerrar una WO cara o cuando el dueño pregunta), impacto medio, persistente.
- **Recomendación:** En el encabezado de la WO (solo MS/AS), una línea "Costs so far: $X labor · $Y outside repairs · Open truck costs" que lleve a `?tab=costs&period=…` del camión. Las partes quedan fuera hasta decidir UX-10-007.
- **Esfuerzo:** S

### ¿Dónde estoy?

### UX-5-006 · Los detalles no tienen migas ni título de pestaña propio
- **Dónde:** `/admin/parts/purchases/[id]`, `/admin/parts/outside-repairs/[id]`, `/admin/parts/internal-invoices/[id]` · `useAdminBreadcrumb` solo lo llaman `admin-truck-detail.tsx` y `admin-work-order-detail.tsx`; `app/admin/layout.tsx:7-10` fija "Lightning Shop — Admin" para todo
- **Evidencia:** (observado) En el detalle de FP-48840 la barra superior dice solo "Purchases" (sin enlace); el título del documento es "Lightning Shop — Admin" en las 13 pantallas visitadas, así que dos pestañas del navegador con dos compras se ven iguales. `evidencia/05-purchase-detail.jpg`.
- **Criterio:** IA §4 (breadcrumb en jerarquías de 2 niveles; cada vista con título de documento).
- **Severidad:** 2 · Frecuencia alta, impacto bajo (el título grande "FleetPride · FP-48840" orienta), persistente. Sube a 3 si el Manager trabaja con varias pestañas al conciliar.
- **Recomendación:** Llamar `useAdminBreadcrumb` en los tres detalles ("Purchases › FleetPride · FP-48840") y fijar `document.title` por pantalla ("FP-48840 · FleetPride — Purchases").
- **Esfuerzo:** S

### Roles

### UX-5-007 · Un admin sin el par Manager entra por URL y ve un error de carga, no "sin acceso"
- **Dónde:** cualquier `/admin/parts/*` · las páginas no comprueban el rol; `admin-purchases.tsx:100` muestra el `LoadFailure` genérico cuando la API devuelve 403 (`parts-costs.controller.ts:19-21`)
- **Evidencia:** (inferido del código) El middleware solo exige `admin.access`; el sidebar oculta el grupo (`admin-shell.tsx:29`), pero un enlace pegado o un favorito llega a la página, la API responde 403 y la pantalla dice que no pudo cargar, como si fuera un fallo. (observado) Un mecánico (MG1) sí recibe "Shop Admin access denied" con "Return to your Home", que es el patrón correcto.
- **Criterio:** IA §7 (roles: explicar por qué no aparece) · Nielsen H9.
- **Severidad:** 2 · Frecuencia baja (hoy los admins tienen el par), impacto medio (parece un bug), persistente.
- **Recomendación:** Reutilizar la pantalla "access denied" del layout cuando `useCanShowManagerWrites()` es falso en estas páginas, con el texto "Costs are only for the Shop Manager and the System Admin".
- **Esfuerzo:** S

### Móvil

### UX-5-008 · En el teléfono, seis filtros apilados empujan la lista fuera de la pantalla
- **Dónde:** `/admin/parts/purchases`, `/admin/parts/outside-repairs` · las barras de filtros son `flex-wrap` propias, no el `AdminFilterToolbar` compartido con su hoja "Filters" (`ui.tsx:823+`)
- **Evidencia:** (observado, 375 × 812) Search, Vendor, Truck, From, To y "Without invoice file" ocupan toda la primera pantalla; la primera compra aparece recién al bajar. En Truck → Costs las 5 tarjetas se apilan y los movimientos quedan dos pantallas abajo. `evidencia/05-purchases-movil-filtros.jpg`, `evidencia/05-truck-costs-movil.jpg`.
- **Criterio:** IA §8 (móvil: el contenido primero; la navegación de nivel 2 no tapa).
- **Severidad:** 2 con el supuesto de uso en escritorio; **3 si el dueño quiere cargar facturas desde el teléfono** (Pendientes del contexto).
- **Recomendación:** Usar `AdminFilterToolbar` (búsqueda visible, el resto en la hoja "Filters" con contador), como Trucks y Work Orders. En Costs, una fila de dos tarjetas (Total y Labor) y el resto plegado.
- **Esfuerzo:** S

### Búsqueda y listas

### UX-5-009 · Internal invoices no tiene filtros ni totales y la lista crece un renglón por camión y mes
- **Dónde:** `/admin/parts/internal-invoices` · `admin-internal-invoices.tsx:43` (sin filtros); `internal-invoices.service.ts:52-61` (solo `status` y `truckId`)
- **Evidencia:** (observado) 5 filas hoy; con 27 camiones serán ~27 por mes y más de 300 al año, sin filtro de mes, sin "cuánto enviamos en septiembre" y sin saber qué camiones faltan. El borrador se lista como "Draft" (enlace sin número ni camión en el texto del enlace) y la anulada SHOP-2026-0003 dice "0 lines" junto a un total tachado. `evidencia/10-factura-interna-sep-con-junio.jpg` (lista en el paso previo).
- **Criterio:** IA §6 (con más de ~50 ítems, hay filtro; filtros en la URL) · §5 (callejón sin salida: no dice qué falta por facturar).
- **Severidad:** 2 hoy; 3 en seis meses.
- **Recomendación:** Agrupar por mes con subtotal y estado ("September 2026 · 12 sent · 3 drafts · 12 trucks without invoice"), filtros de mes y estado en la URL, y el enlace del borrador con su camión y mes. Esto es la mitad de UX-10-006.
- **Esfuerzo:** M

**Vocabulario (skill 3, en una línea):** las etiquetas del menú son claras y coinciden con los títulos; "Parts" (catálogo) y "Parts & costs" (grupo) comparten palabra, y en español "Operaciones" (Dashboard) convive con "Operación" (grupo). DM3 ("1 lines", "1 parts") sigue abierto.

## Lo que funciona bien
- **El grupo existe, está fuera de Setup y solo lo ve quien ve dinero** (D-PC7). Un mecánico que pega la URL recibe "Shop Admin access denied" con un camino de salida.
- **Todo movimiento de Truck → Costs lleva a su origen:** compra, reparación o WO; las reversas se ven como "Voided"/"Corrected" en negativo. La factura interna enlaza cada línea a su compra y al camión **en la pestaña Costs** (el único enlace que lo hace bien).
- **La búsqueda perdona:** "fp 48840" (minúsculas, espacio en vez de guion) encuentra FP-48840 (`invoiceNorm`).
- **Las entradas en contexto funcionan:** "Add purchase" desde Costs abre el diálogo con el camión elegido y lo dice ("All of it goes to Truck 991"); desde el Job afuera, el chip "Invoice $685.00 · Bay Area Body Shop" lleva a la reparación y el menú ofrece cargar otra.
- **La factura repetida se detecta al salir del campo**, dice cuál es y la abre ("Open it"), en compras y en reparaciones por igual.

## Fuera de alcance / no verificado
- El archivo adjunto (la demo no tiene Storage: el campo se oculta).
- El Job que **ya volvió** del taller externo sin factura: la demo no trae ese caso; va como inferido en 10-task-flows (UX-10-001).
- Español: solo por lectura de `admin-messages.ts`.
- Accesibilidad por teclado y contraste (skill 2).
