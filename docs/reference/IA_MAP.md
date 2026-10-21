# Mapa de la app (arquitectura de información)

**Actualizado:** 2026-10-21 (LTR-273). **Fuente:** el código —
`apps/web/src/components/admin-shell.tsx` (menú del Admin),
`apps/web/src/components/mechanic-tabs.tsx` (pestañas de mecánico),
`apps/web/src/lib/admin-routing.ts` (a dónde entra cada rol) y
`apps/web/src/app/**/page.tsx` (rutas). Si el menú cambia, se cambia aquí en el
mismo PR. Qué hace cada pantalla: [`SYSTEM.md`](../SYSTEM.md) §6.

## A dónde entra cada persona

Después del login, `defaultWorkspacePath` manda a la primera que aplique:

| Persona | Entra en | Dispositivo |
|---|---|---|
| Shop Manager, System Admin (y solo lectura) | `/admin` (Dashboard) | Computadora, iPad, teléfono |
| Mecánico General (Standard) | `/mechanic/standard` | Teléfono o tablet, app instalada (PWA) |
| Mecánico PM | `/mechanic/pm` | Teléfono o tablet, app instalada (PWA) |
| Safety (QC) | `/qc` | Teléfono o tablet (PWA) |
| Sin permiso | `/access-denied` | — |

La app es una sola PWA para todos (D54, LTR-171): tiene que verse bien en
teléfono y tablet, vertical y horizontal, sin scroll de lado.

## Admin (`/admin`)

Menú lateral (en el teléfono, botón ☰). Nombres en inglés · español.

**Operations · Operación**

| Menú | Ruta | Dentro |
|---|---|---|
| Dashboard · Panel | `/admin` | Cola "Needs you" por acción: Arrived · Needs a Work Order (LTR-261), Blocked or paused, Ready to close, Return to Service (primero los que salieron o volvieron a la yard, D52), Unassigned, pedidos de mecánicos |
| Yard Operations · Patio | `/admin/yard-operations` | Pestaña **Shop** (tablero Kanban por paso, D33, con contadores In shop / In yard without a Work Order); pestaña **Dispatch** (`?tab=dispatch`, la semana: Incoming y Departures por día, D51); botón **Full screen** (`?display=board`, otra pestaña para la TV, D53) |
| Work Orders | `/admin/work-orders`, `/[id]`, `/new` | Lista con filtros (incluye Closed, antes History); detalle con Jobs, Add work, notas |
| Trucks | `/admin/trucks`, `/[id]`, `/[id]/inspection` | Lista; ficha del camión (lugar de trabajo del Manager); hoja de inspección; Add truck (D44) |

**Parts & costs · Partes y costos** — solo Shop Manager y System Admin (D-PC7)

| Menú | Ruta |
|---|---|
| Purchases · Compras | `/admin/parts/purchases`, `/[id]` |
| Outside repairs · Reparaciones externas | `/admin/parts/outside-repairs`, `/[id]` |
| Parts · Partes (el inventario, D47) | `/admin/parts/catalog`; Count stock en `/admin/parts/count` |
| Vendors · Proveedores | `/admin/parts/vendors` |
| Internal invoices · Facturas internas | `/admin/parts/internal-invoices`, `/[id]` |

**Setup · Configuración**

| Menú | Ruta | Quién |
|---|---|---|
| People · Personas | `/admin/mechanics`, `/[id]` | Todos los del Admin; Managers y System Admins los maneja solo un System Admin (D48) |
| Jobs | `/admin/catalog`, `/categories/[id]`, `/review` (Custom Jobs to review) | Admin |
| Shop workflow · Flujo del taller | `/admin/setup/workflow`, `/hours` | Admin |
| Inspection checklist · Lista de inspección | `/admin/setup/inspection` | Admin |
| Samsara | `/admin/setup/samsara` | Admin |
| Shop rates · Tarifas del taller | `/admin/parts/labor-rate` | Solo Shop Manager y System Admin |

**Workspaces · Espacios de trabajo** — al final del menú, solo si la persona
también es mecánico (P4): Standard Mechanic → `/mechanic/standard`, PM mechanic
→ `/mechanic/pm`.

**Rutas sin menú:** `/admin/history` (WOs cerrados; en el menú es el filtro
Closed de Work Orders), `/admin/parts/stock` (redirige a Parts con "In stock",
D47).

## Mecánicos

Pestañas abajo, iguales en General y PM:

| Pestaña | General | PM |
|---|---|---|
| My work | `/mechanic/standard` | `/mechanic/pm` |
| Trucks | `/mechanic/standard/trucks` | `/mechanic/pm/trucks` |
| Completed | `/mechanic/standard/completed` | `/mechanic/pm/completed` |

Además: inspeccionar (`/inspect/[truckId]`, con permiso), pedir trabajo
(`/new`), el Work Order (`/work-orders/[id]`) y el historial del camión
(`/trucks/[id]/history`). En teléfono es una columna; desde 768 px usa el ancho
(D54). Sin tiempo a la vista (D54).

## Safety

`/qc`: la cola del Quality Check (tomar, aprobar, devolver con nota; D46). Pestañas To review · Returned · Done
(abajo en el teléfono). Como los mecánicos, una columna en el teléfono y a lo ancho desde 768 px, tarjetas de a
dos (LTR-272); en Done la nota de un devuelto se lee completa.

## Otras

`/login`, `/reset-password`, `/access-denied`.
