# 05 · Navegación y arquitectura de información — panel del Manager (2026-10)

**Fecha:** 2026-10-18 · **Alcance:** las 21 entradas del menú, sus detalles, pestañas y diálogos; los roles Manager, System Admin y Shop Admin sin escritura; el teléfono · **Método:** mapa desde el código (`apps/web/src/app/admin/**`, `admin-shell.tsx`) y recorrido en local como Manager

**Resumen:**
- Hay 11 hallazgos: 3 de severidad 3, 6 de severidad 2 y 2 de severidad 1.
- **La organización del menú se retoca, no se rehace.** Los 4 grupos (Operations, Parts & costs, Setup, Audit) siguen un criterio claro: el trabajo del día, el dinero, la configuración y lo cerrado. Casi todo lo que pidieron las auditorías de octubre se cerró (§ Estado de auditorías anteriores).
- **Lo que pesa ahora es nuevo:**
  1. Parts & costs creció a 6 ítems con un objeto duplicado (Stock y Parts).
  2. Hay dos "catálogos" con nombres casi iguales en grupos distintos.
  3. Volver desde un detalle pierde los filtros en las dos listas que más se usan, Trucks y Work Orders.
  4. Hay un rol (Shop Admin de solo lectura) al que el panel nombra mal y le ofrece un enlace que lo rebota.

## Mapa de navegación observado

"Clics" cuenta desde el menú lateral. En el teléfono se suma 1, porque el menú se abre en una hoja (`evidencia/05-menu-telefono-21-items.jpg`).

| Grupo | Etiqueta | Ruta | Pestañas / hijos | Cómo se llega además del menú | Clics | Rol |
|---|---|---|---|---|---|---|
| Operations | Dashboard | `/admin` | Contadores (no en la URL), Leaving soon, Needs you, QC findings, Work requests | Logo; banner de `/qc` | 0 | Todos |
| | Yard Operations | `/admin/yard-operations` | Shop · Dispatch (`?tab=dispatch`; sigue saliendo `?tab=movement`) · `?display=board` en otra pestaña | Dashboard | 1 | Todos |
| | Work Orders | `/admin/work-orders` → `/[id]` | Detalle con `#job-`, `?action=pause` | Dashboard, Truck, Yard, History, People, Parts, Stock | 1 / 2 | Todos |
| | Trucks | `/admin/trucks` → `/[id]` → `/inspection` | Overview · Costs · Faults (`?tab=`; Costs y Faults solo para MS/AS) | Dashboard, Yard, Samsara, QC findings, WO | 1 / 2 / 3 | Todos |
| Parts & costs | Purchases | `/admin/parts/purchases` → `/[id]` | `?new=1&forTruck=&jobId=` | Menú del Job, Truck → Costs, Vendors | 1 / 2 | MS, AS |
| | Outside repairs | `/admin/parts/outside-repairs` → `/[id]` | igual | Menú del Job, Truck → Costs, Vendors | 1 / 2 | MS, AS |
| | Internal invoices | `/admin/parts/internal-invoices` → `/[id]` | `?status=&month=` | Truck → Costs | 1 / 2 | MS, AS |
| | Stock | `/admin/parts/stock` | Movements (diálogo), Count (diálogo) | Línea "To stock" de una compra (`?q=`) | 1 | MS, AS |
| | Parts | `/admin/parts/catalog` | Add category, Add part, Edit part (diálogos) | "Add to catalog" en una compra; enlace en otra pestaña | 1 | MS, AS |
| | Vendors | `/admin/parts/vendors` | — | Formulario de compra ("+ Add vendor…") | 1 | MS, AS |
| Setup | People | `/admin/mechanics` → `/[id]` | — | Solo la lista | 1 / 2 | Todos (escribe MS/AS) |
| | Job Catalog | `/admin/catalog` → `/categories/[id]`, `/review` | Custom Jobs: To review · Reviewed (no en la URL) | Banner en el catálogo | 1 / 2 | Todos |
| | Shop workflow | `/admin/setup/workflow`, `/hours` | Steps · Shop hours | Job del catálogo, perfil | 1 | Todos |
| | Inspection checklist | `/admin/setup/inspection` | — | — | 1 | Todos |
| | Samsara | `/admin/setup/samsara` | — | Faults del camión | 1 | Todos |
| | Labor rate | `/admin/parts/labor-rate` | Labor rate + **PM oil change** | Truck → Costs | 1 | MS, AS |
| Audit | History | `/admin/history` | — | — | 1 | Todos |
| (fuera del shell) | Quality Check | `/qc` | review · returned · done | Dashboard, Shop workflow, Next step del camión | 1 | MS/AS como respaldo; Safety |

**Rutas huérfanas:** ninguna. **Rutas de un solo camino:**
- `/admin/mechanics/[id]` (solo desde People);
- `/admin/catalog/review` (solo desde el banner del catálogo);
- `/admin/trucks/[id]/inspection`, aunque tiene tres entradas contextuales.

**La tarea diaria más cara:** sacar una parte del estante a un Job son 4 clics desde el Job, más el cambio de contexto si no hay stock. El camino es: menú del Job → Parts from stock → elegir → Take from stock. Si no hay stock: ir a Stock → Count → volver a la WO.

## Hallazgos

### ¿Qué hay aquí? (nombres y agrupación)

#### UX-5-001 · Parts & costs tiene dos entradas para el mismo objeto (Stock y Parts)
- **Dónde:** `apps/web/src/components/admin-shell.tsx:33-39` · menú observado: "Purchases, Outside repairs, Internal invoices, **Stock, Parts**, Vendors"
- **Evidencia:** observado (`evidencia/05-menu-telefono-21-items.jpg`); detalle en `10-jtbd-parts-costs.md` UX-10-002. Stock y Parts listan las mismas filas de `Part`. Cada uno edita la mitad: el saldo en Stock, la parte y su mínimo en Parts.
- **Criterio:** un contenido, un lugar (criterio 3). Prueba de nomenclatura (criterio 2): "Stock" y "Parts" pueden contener lo mismo.
- **Severidad:** 3 · Es el grupo que el Manager usa cada semana, y el dueño lo señala como lo más confuso.
- **Recomendación:** fusionar en **Parts**, que es el inventario (ver Estructura propuesta). `/admin/parts/stock` redirige a `/admin/parts/catalog?view=stock`, con el filtro "On the shelf" activado.
- **Esfuerzo:** M

#### UX-5-002 · "Job Catalog" (Setup) y "Parts" (`/admin/parts/catalog`) son dos catálogos con nombres que se cruzan
- **Dónde:** `admin-shell.tsx:44-45` (Job Catalog → `/admin/catalog`) y :37 (Parts → `/admin/parts/catalog`)
- **Evidencia:**
  - El de Setup son los **trabajos** (Jobs y sus categorías); el de Parts & costs son las **partes**. Los dos tienen "Add category".
  - La URL `/admin/catalog` es de los Jobs, pero `/admin/parts/catalog` es de las partes (inferido del código).
  - El Job Catalog también abre "Custom Jobs to review", que es una bandeja de entrada y no configuración.
- **Criterio:** etiquetas que se distinguen (criterio 2). La URL refleja lo que hay (criterio 4).
- **Severidad:** 2 · Se aprende, pero cada conversación con el equipo sobre "el catálogo" necesita aclaración.
- **Recomendación:**
  - Etiqueta "**Jobs**" en Setup, con título de página "Jobs catalog".
  - "Parts" se queda en Parts & costs.
  - La URL `/admin/catalog` se queda (un cambio de ruta no paga). Basta el nombre.
- **Esfuerzo:** S

#### UX-5-003 · "Labor rate" ya guarda también el precio del cambio de aceite del PM
- **Dónde:** Setup → Labor rate (`/admin/parts/labor-rate`) · `admin-labor-rate.tsx:155,164-197` ("PM oil change")
- **Evidencia:** inferido del código. El menú dice "Labor rate", pero la pantalla tiene dos precios. Un Manager que busca "¿cuánto cobra el PM por el aceite?" no lo buscaría ahí. La ruta vive bajo `/parts` y el ítem bajo Setup.
- **Criterio:** etiqueta que dice lo que hay (criterio 2).
- **Severidad:** 2 · Se usa poco (cambia una o dos veces al año), pero cuando se necesita no se encuentra.
- **Recomendación:** renombrar el ítem y el título a "**Shop rates**" ("Labor rate · PM oil change"). Dejarlo en Setup.
- **Esfuerzo:** S

#### UX-5-004 · "History" en un grupo "Audit" de un solo ítem, mientras Work Orders ya dice "open and closed"
- **Dónde:** `admin-shell.tsx:56-59` (grupo Audit, un ítem) · `admin-messages-catalog.ts:1185` ("Completed and cancelled Work Orders") · :912 (Work Orders, "open and closed")
- **Evidencia:** inferido del código. History lista Work Orders cerrados, y Work Orders también filtra por estado. Son dos lugares para buscar "la WO de la semana pasada".
- **Criterio:** grupo de un ítem (criterio 3); un contenido, un lugar.
- **Severidad:** 2
- **Recomendación:**
  - Llevar History como el filtro "**Closed**" de Work Orders. `/admin/history` redirige a `/admin/work-orders?status=completed,cancelled`.
  - Retirar el grupo Audit.
  - Si el dueño quiere History como bitácora de actividad (quién cambió qué), es otra pantalla; ver pregunta P34 en la propuesta.
- **Esfuerzo:** S–M

#### UX-5-005 · En español, "Operaciones" (Dashboard) y "Operaciones del patio" (Yard) dentro del grupo "Operación"
- **Dónde:** `admin-messages-catalog.ts:1920-1923, 2761`
- **Criterio:** etiquetas que se distinguen (criterio 2). Los textos se desarrollan en la skill 3.
- **Severidad:** 1 · La interfaz del taller está en inglés.
- **Recomendación:** "Panel" (Dashboard) y "Patio" (Yard Operations).
- **Esfuerzo:** S

### ¿Dónde estoy? (orientación)

#### UX-5-006 · El camión abierto desde Samsara, QC findings o Dispatch dice "Yard Operations › 601"
- **Dónde:** `admin-truck-detail.tsx:580-590` · `lib/admin-truck-origin.ts:29-56` · enlaces sin un `from` conocido en `admin-samsara-pairing.tsx:69,142`, `admin-qc-findings-card.tsx:86` y `admin-yard-data-boundary-cards.tsx:219` (`?tab=movement`)
- **Evidencia:** inferido del código. El breadcrumb vuelve a un lugar donde el Manager no estaba, mientras el menú marca "Trucks".
- **Criterio:** el breadcrumb y el ítem marcado coinciden con el camino real (criterio 4).
- **Severidad:** 2
- **Recomendación:** que esos tres enlaces pasen `from`. En `admin-truck-origin.ts`, un origen desconocido cae a "Trucks" (que es lo que marca el menú), no a "Yard Operations".
- **Esfuerzo:** S
- **Estado:** hecho en LTR-245 (2026-10-18). Samsara pairing y el hallazgo de QC pasan `from`; los chips de Dispatch usan `?tab=dispatch`; un origen desconocido o ausente cae a "Trucks".

#### UX-5-007 · Tres pantallas de Setup de nivel 2 sin breadcrumb
- **Dónde:** `admin-catalog-category-detail.tsx`, `admin-custom-jobs-review.tsx`, `admin-mechanic-detail.tsx` (se ve solo "Job Catalog" o "People" como texto)
- **Evidencia:** inferido del código. Es el mismo UX-5-007 de `admin-setup/05`, y sigue abierto.
- **Criterio:** breadcrumb en jerarquías de 2+ niveles (criterio 4).
- **Severidad:** 1
- **Recomendación:** `useAdminCrumbs`: "Jobs › {categoría}", "Jobs › Custom Jobs to review", "People › {nombre}".
- **Esfuerzo:** S
- **Estado:** hecho en LTR-245 (2026-10-18). "Job Catalog › {categoría}", "Job Catalog › Custom Jobs to review" y "People › {nombre}" (con los nombres actuales del menú; "Jobs" llega con LTR-248).

### ¿Cómo vuelvo?

#### UX-5-008 · Volver desde un camión o una WO pierde los filtros de la lista
- **Dónde:** `admin-trucks-list.tsx:106` y `admin-work-orders-list.tsx:151` (`from` sin la consulta) · el breadcrumb de la WO siempre apunta a la lista sin filtrar (`admin-work-order-detail.tsx:151-156`)
- **Evidencia:** observado. En `/admin/trucks?q=9` el enlace del primer camión es `…?from=%2Fadmin%2Ftrucks`, sin `?q=9`. La WO abierta desde Dashboard, History o un perfil vuelve a "Work Orders" sin filtro.
- **Criterio:** "volver" lleva a donde estaba, con sus filtros (criterio 5).
- **Severidad:** 3 · Trucks y Work Orders son listas de uso diario, y el Yard ya lo resuelve bien (pasa la consulta entera).
- **Recomendación:** usar el mismo patrón del Yard (`admin-yard-operations.tsx:82`): `from` con `pathname + search`. En la WO, el breadcrumb usa `from` cuando existe.
- **Esfuerzo:** S
- **Estado:** hecho en LTR-245 (2026-10-18). Trucks, Work Orders y History pasan `from` con la consulta; el Dashboard pasa `/admin`. El breadcrumb de la WO usa `from` (Work Orders, Trucks, Dashboard, History o Parts & costs).

### ¿A dónde puedo ir? (roles)

#### UX-5-009 · Un Shop Admin de solo lectura aparece como "Shop Manager" y el Dashboard le ofrece "Open Quality Check", que lo rebota
- **Dónde:** `admin-shell.tsx:178` (todo rol que no es admin se muestra como "Shop Manager") · `admin-dashboard.tsx:297` · `quality-check-page.tsx:83` (vuelve a `/admin` en silencio)
- **Evidencia:** inferido del código.
- **Criterio:** cada rol ve solo lo que puede usar; nada de enlaces que rebotan (criterio 7).
- **Severidad:** 2 · Hoy casi no existe ese rol, pero LTR-161 (matriz de perfiles, con "Solo lectura") lo va a crear.
- **Recomendación:**
  - Mostrar el perfil real.
  - Ocultar "Open Quality Check" si el rol no puede usar `/qc`.
  - Hacerlo junto con LTR-161.
- **Esfuerzo:** S

#### UX-5-010 · Las partes de un Job se ponen desde tres puertas y se buscan desde otras dos
- **Dónde:** menú del Job (`admin-job-table.tsx:193-206`), Truck → Costs (`admin-truck-costs.tsx:84-85`), las listas de Purchases y Outside repairs
- **Evidencia:** observado en WO-009 (ver `10-jtbd-parts-costs.md` UX-10-004). New purchase se abre desde tres lugares con distintos datos ya puestos.
- **Criterio:** agrupar por tarea (criterio 3).
- **Severidad:** 3 · Lo hace el Manager varias veces al día cuando hay reparaciones.
- **Recomendación:** un solo "Parts…" en el menú del Job (ver UX-10-004). Truck → Costs se queda como lectura, con "New purchase for this truck".
- **Esfuerzo:** M

### Búsqueda

#### UX-5-011 · Elegir una parte entre 91 (y creciendo) en un select sin búsqueda
- **Dónde:** Stock → Count → Part (`admin-stock.tsx:147-226`), y el "Part" de cada línea de compra (`admin-purchase-form.tsx`)
- **Evidencia:** observado: 91 opciones agrupadas por categoría y sin campo de búsqueda. Con D45 se suman las de Repair y Tires.
- **Criterio:** con más de ~50 ítems, búsqueda o filtro (criterio 6).
- **Severidad:** 2 hoy, 3 cuando el catálogo tenga los repuestos.
- **Recomendación:** un combobox con búsqueda por nombre y número de parte, como el buscador de la lista de Parts. El que tiene la compra para el "Other" sirve de base.
- **Esfuerzo:** S–M

## Estructura propuesta

Se mueve poco, y cada cambio dice por qué.

```
Operations
  Dashboard
  Yard Operations
  Work Orders            ← absorbe History como filtro "Closed" (UX-5-004)
  Trucks
Parts & costs            (MS, AS)
  Purchases              semanal
  Outside repairs        semanal
  Parts                  ← absorbe Stock: es el inventario del taller (UX-5-001, UX-10-002)
  Vendors
  Internal invoices      mensual (cierre)
Setup
  People
  Jobs                   ← antes "Job Catalog" (UX-5-002)
  Shop workflow
  Inspection checklist
  Samsara
  Shop rates             ← antes "Labor rate": labor + PM oil change (UX-5-003)
```

De 21 entradas pasa a 19, y de 4 grupos a 3. Ninguna tarea diaria se aleja.

## Estado de auditorías anteriores

| Auditoría | Cerrados | Siguen abiertos |
|---|---|---|
| `admin-setup/05` (2026-10-07) | 002, 003, 004, 005, 008, 013, 014 | 001 a medias (el workflow no enlaza a People), 006 (rutas de Setup mezcladas), 007 (sin breadcrumb, aquí UX-5-007), 011, 012 (búsqueda del catálogo sin URL; perfil pierde la consulta), 015 (People con Apply, catálogo en vivo). 009 cambió: MS/AS usan `/qc` como respaldo |
| `admin-dashboard-yard/05` | 001, 002, 003, 004, 006, 007, 008; 009 reemplazado por filtros rápidos | 005: "Add work" todavía navega al camión |
| `admin-truck-wo/05` | 001–006 | 007 sin cambio, a propósito |
| `admin-parts-costs/05` (2026-10-11) | 001, 003, 004, 005, 007, 008, 009 | 002 (el menú marca "Trucks" en Truck → Costs), 006 (detalles de Setup sin breadcrumb). Esa auditoría no tenía Stock |

## Lo que funciona bien
- **El orden de los grupos sigue el trabajo:** el día (Operations), la semana y el mes (Parts & costs), la configuración (Setup). Está documentado en el código (`admin-shell.tsx:15`, LTR-122).
- **El Yard es el modelo a copiar para "volver":** pasa la consulta completa como `from` y el breadcrumb la respeta.
- **Las pestañas importantes tienen URL** (`?tab=costs|faults`, `?tab=dispatch`, `/setup/workflow/hours`). Abrir en otra pestaña y compartir un enlace funciona.
- **Parts & costs está cerrado por rol con una explicación** (`admin-parts-gate.tsx`), no con un 403 mudo.
- **En el teléfono el menú es el mismo** (una hoja) y el breadcrumb se vuelve "‹ parent". No hay una navegación distinta que aprender.

## Fuera de alcance / no verificado
- **Roles:** solo se recorrió el Manager. System Admin y Shop Admin de solo lectura se revisaron por código.
- **Búsqueda con tildes y mayúsculas** en las listas: no se probó en esta corrida.
- **Escritorio:** las capturas son de teléfono, porque el panel del navegador estaba angosto.
