# 05 · Navegación y arquitectura de información — Lightning Shop, modo demo

**Fecha:** 2026-10-10 · **Alcance:** cómo el presentador llega a cada pantalla de la demo (panel, selector de historia, Back/Next/Go to screen, botón Demo), cómo sabe dónde está y cómo vuelve; la navegación del producto solo en lo que la demo expone (el menú del Admin y las pestañas del mecánico ya están auditados en `admin-setup`, `admin-dashboard-yard`, `mecanico-general`, `mecanico-pm`, `safety-qc`) · **Método:** código (`demo-panel.tsx`, `demo-context.tsx`, `resolve-target.ts`, `middleware.ts`, rutas en `apps/web/src/app/**`) + navegador.
**Resumen:** 6 hallazgos, 1 de severidad 3. El panel resuelve bien "a dónde voy" (cada paso navega solo) pero responde mal "dónde estoy" (no dice si la pantalla actual es la del paso) y "cómo vuelvo" (el botón Atrás del navegador aterriza en pantallas de otra cuenta). La organización de las historias es por job to be done, que nadie del taller conoce: se rehace en PR C.

## Mapa de navegación observado

Rutas que recorre la demo, cómo se llega y cuántos toques cuesta desde el panel (con una historia activa, cada paso = 1 toque en Next). Rol = cuenta que la ve.

| Ruta | Etiqueta en pantalla | Cómo se llega en la demo | Toques desde el panel | Rol |
|---|---|---|---|---|
| `/login` | Sign in · "Enter demo mode" | escribir la URL con sesión cerrada | — | presentador |
| `/admin` | Dashboard | paso de historia / cuenta MS | 1 | Manager, Admin |
| `/admin/yard-operations` (`?tab=movement`) | Yard Operations · Shop / Dispatch | paso | 1 | Manager |
| `/admin/work-orders`, `/admin/work-orders/[id]` | Work Orders / Truck N | paso (camión → WO abierto) | 1 | Manager |
| `/admin/trucks`, `/admin/trucks/[id]` (`?tab=costs`) | Trucks / Truck N · Overview, Costs | paso | 1 | Manager |
| `/admin/history` (`?status=cancelled`) | History | paso | 1 | Manager |
| `/admin/parts/{catalog,vendors,purchases,outside-repairs,labor-rate,internal-invoices}` | Parts & costs | paso | 1 | Manager |
| `/admin/mechanics`, `/admin/catalog`, `/admin/catalog/review`, `/admin/setup/workflow`, `/admin/setup/workflow/hours` | People, Job Catalog, Shop workflow | paso | 1 | Manager, Admin |
| `/mechanic/standard` (+ `/trucks`, `/completed`) | My work · Trucks · Completed | paso / cuenta MG, MA, MD | 1 | mecánico |
| `/work-orders/[id]` (`?view=pm`) | Truck N | paso (camión → WO abierto) | 1 | mecánico, PM |
| `/mechanic/pm` (+ `/trucks`, `/new`) | PM Mechanic | paso / cuenta MPM | 1 | PM |
| `/qc` (`?tab=returned`, `?tab=done`) | Quality Check · To review / Returned / Done | paso / cuenta QC | 1 | Safety, Manager (respaldo) |

Rutas huérfanas desde la demo: ninguna (todas las que usa el guion se alcanzan desde el panel). Rutas de la app que la demo no recorre: `/mechanic/standard/new`, `/admin/work-orders/new`, `/trucks/[id]/history`, `/admin/mechanics/[id]`, `/admin/catalog/categories/[id]`, detalles de compra/factura; quedan fuera del flujo por decisión del guion, no por estar escondidas.

## Hallazgos

### ¿Dónde estoy?

### UX-5-001 · El paso no dice si la pantalla que se ve es la del paso
- **Dónde:** Tarjeta de paso · `demo-panel.tsx:187` (chip con la ruta del paso) frente a `usePathname()` de la página, que no se compara
- **Evidencia:** `evidencia/05-atras-tras-cambio-de-cuenta.jpg` (observado): la tarjeta dice "Step 1 of 5 · Operations · /admin" mientras la página es `/mechanic/pm` con "This mechanic workspace is not available for your account". Nada marca la diferencia.
- **Criterio:** ¿Dónde estoy? El sistema señala la ubicación actual frente a la esperada
- **Severidad:** 2 · Pasa después de Atrás, de un enlace tocado por curiosidad o de un paso con auto-follow apagado.
- **Recomendación:** Comparar la ruta resuelta del paso con `pathname + search`; si no coinciden, el chip pasa a ámbar y "Go to screen" se vuelve primario con el texto "Back to this step's screen".
- **Esfuerzo:** S

### UX-5-002 · Sin contexto de capítulo ni de historia en la tarjeta
- **Dónde:** `demo-panel.tsx:179-182`
- **Evidencia:** (observado) "Step 1 of 5 · Manager · Operations": el nombre de la historia solo está en el `select` de arriba; con el flujo largo de PR C (≈ 49 pasos) "Step 23 of 49" no orienta.
- **Criterio:** ¿Dónde estoy? Breadcrumb en jerarquías de dos niveles
- **Severidad:** 2
- **Recomendación:** Cabecera "Chapter 5 of 14 · A blocker" + "Step 2 of 4"; lista de capítulos clicable bajo el selector (PR C).
- **Esfuerzo:** S · con PR C

### ¿Qué hay aquí?

### UX-5-003 · Las historias están organizadas por "job to be done", un criterio que el presentador no usa
- **Dónde:** Selector · `demo-panel.tsx:160-175` (optgroups J1–J14 del `DEMO_JTBD`)
- **Evidencia:** (observado) 14 grupos con una o dos historias cada uno; "J7 · While working…" contiene HU-ME2, HU-ME4, HU-ME5, HU-ME6; el presentador piensa en "qué hace el mecánico", no en J7.
- **Criterio:** Agrupación por rol/tarea del usuario; prueba de nomenclatura del menú
- **Severidad:** 3 · Es el primer nivel del "menú" del panel.
- **Recomendación:** Reorganizar por quién lo hace (5 grupos) con el flujo continuo arriba; estructura propuesta abajo. (PR C.)
- **Esfuerzo:** M · con PR C

### ¿A dónde puedo ir?

### UX-5-004 · "Enter demo mode" solo se alcanza desde `/login` con sesión cerrada
- **Dónde:** `apps/web/src/app/login/page.tsx:40-53,188-196`
- **Evidencia:** (observado) con sesión abierta, `/login` redirige al inicio del usuario. Detalle en UX-1-001.
- **Criterio:** ¿A dónde puedo ir? Función crítica solo alcanzable por un camino indirecto (sign out)
- **Severidad:** 3 · (contado en UX-1-001; aquí solo se referencia para el mapa)
- **Recomendación:** Entrada desde el menú de perfil en builds locales.
- **Esfuerzo:** S

### ¿Cómo vuelvo?

### UX-5-005 · El botón Atrás del navegador aterriza en pantallas de otra cuenta
- **Dónde:** Cambio de cuenta por `window.location.assign` (`demo-context.tsx:106`), que deja el historial de la cuenta anterior
- **Evidencia:** `evidencia/05-atras-tras-cambio-de-cuenta.jpg` (observado): tras pasar de MPM (`/mechanic/pm`) a MS (`/admin`), Atrás abre `/mechanic/pm` como Shop Manager: "This mechanic workspace is not available for your account · Go to your Shop home".
- **Criterio:** ¿Cómo vuelvo? Volver no debe llevar a un callejón
- **Severidad:** 2 · El presentador usa Atrás por reflejo; la página de salida existe y tiene enlace, así que no se pierde.
- **Recomendación:** Cambiar de cuenta con `location.replace` en lugar de `assign` (no deja la página de la cuenta anterior en el historial) y, en el panel, "Back" del paso como el "atrás" de la demo. En la página "not available", además, un enlace "Back to the demo step" cuando el modo está activo.
- **Esfuerzo:** S

### UX-5-006 · Al volver a `/login` por sesión vencida se pierde el estado del panel (otro host)
- **Dónde:** `middleware.ts:38-42`
- **Evidencia:** (observado) redirección a `localhost` en vez de `127.0.0.1`; detalle y severidad en UX-1-003.
- **Criterio:** ¿Cómo vuelvo? Conservar estado al volver
- **Severidad:** 4 · (contado en UX-1-003)
- **Recomendación:** Conservar el host en el redirect; renovar la cookie de Admin mientras el modo demo está encendido.
- **Esfuerzo:** S

### Búsqueda
- El selector nativo con 24 opciones no tiene búsqueda; en laptop se recorre con el teclado (escribir "Un" salta a "Unblock…"). Con el flujo arriba y cinco grupos por rol basta; no se reporta como hallazgo.

## Estructura propuesta (selector de historias, PR C)

```
Demo flow
  A day at the shop (14 chapters, ~49 steps)
Manager Shop (MS)
  A truck arrives (973) · Inspect and add work (601, 602) · Split the work (602) · Unblock a truck (605, 609) ·
  Review, close, Return to Service (931, 607, 606) · Cancel and reopen (613, 615) · See the whole shop ·
  Configure the shop workflow (957) · Add staff · A helper on a Job (612) · Send work to an outside shop (610, 611) ·
  What each truck costs (611) · Charge Finance (603)
Mecánicos (MG, MA, MD)
  See my work (604, 957) · Work and finish (603) · Report a blocker (605) · Notes and Request Work (613) ·
  The day closes by itself (944) · One clock across trucks (604, 612)
PM (MPM)
  Record a PM (968)
Quality Check (QC)
  Approve or return a truck (616, 922, 905)
Admin (AS)
  Correct a mechanic's time (617) · Catalog and people
```

## Lo que funciona bien
- Cada paso navega solo a la pantalla correcta, resolviendo el camión por número de unidad; en el ensayo no hubo un solo destino equivocado.
- Los filtros se conservan al volver desde un detalle (Yard: "filters stay when you open a truck and come back"; Trucks y Work Orders usan `?from=`).
- Las rutas de otro rol no se rompen: el Admin con cuenta de mecánico muestra "not available for your account" con salida; el mecánico en `/admin` recibe la página de acceso denegado.
- La tarjeta muestra la ruta del paso en un chip legible.

## Fuera de alcance / no verificado
- Teclado dentro del `select` en Safari.
- El menú del Admin y las pestañas del mecánico: auditados antes, sin cambios desde entonces.
