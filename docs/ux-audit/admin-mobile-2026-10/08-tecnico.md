# 08 · Técnico y móvil — panel del Manager en el teléfono (2026-10)

**Fecha:** 2026-10-19 · **Alcance:** las 19 pantallas del panel (`/admin/**`) en un teléfono, más su menú · **Método:** recorrido `apps/web/e2e/mobile-walk.spec.ts` (skill `mobile-ui-check`) en **WebKit iPhone 13**, que es el motor de Chrome y Safari en iOS, y en **Chromium móvil**, contra la API de pruebas. Más la lectura del código. Linear: **LTR-250**.

**Resumen:**
- Hay 6 hallazgos: 1 de severidad 4, 2 de severidad 3 y 3 de severidad 2.
- **El que explica el pedido del dueño** ("en el navegador del teléfono se ve cortado y no sale el menú; en la PWA se ve mejor") es UX-8-001: el documento medía más que la pantalla.
- Todos están corregidos en el mismo PR. Después del arreglo el recorrido no encuentra nada, salvo un campo de 42 px cuyo `label` sí mide 44 px.

**Límite:** la emulación no tiene las barras del navegador del iPhone. UX-8-001 se midió en la emulación (el documento era más alto), pero el efecto en un teléfono real tiene que confirmarlo el dueño, con el preview de Vercel.

## Hallazgos

### UX-8-001 · El documento medía más que la pantalla, y en el navegador del iPhone el menú se iba para arriba
- **Dónde:**
  - `apps/web/src/components/admin-shell.tsx`: `main` sin `position: relative`;
  - `apps/web/src/app/globals.css`: `body` con `min-h-screen`;
  - `apps/web/src/components/app-frame.tsx`: el panel con `h-dvh overflow-hidden`.
- **Evidencia (medido):**
  - Yard medía 772 px, Truck 1153 px y el detalle de compra 735 px, todos en una pantalla de 664 px.
  - Los elementos que lo estiraban eran etiquetas `sr-only` con `offsetParent = BODY`: "Alejandro 1" a 771 px, "Last reported location:" a 1136 px y el `caption` "Lines" a 734 px.
  - Con eso, en el navegador del teléfono se desplaza la página entera, no solo `main`. El encabezado con el botón ☰ sale de la vista y abajo se ve cortado.
  - En la PWA instalada no hay barras, y el `body` ya usaba 100dvh, así que se notaba menos.
- **Criterio:** Nielsen H3 (control: el menú tiene que estar siempre a mano) · WCAG 2.4.3.
- **Severidad:** 4 · En el teléfono, el Manager pierde el menú en las pantallas que más usa.
- **Arreglo:**
  - `main` pasa a ser `relative`, así lo absoluto queda dentro de su scroll;
  - el `body` usa `min-height: 100dvh`, con 100vh de respaldo;
  - la e2e `mobile-frame.spec.ts` comprueba que el documento nunca mida más que la pantalla, en WebKit y en Chromium.

### UX-8-002 · En Parts, "Count stock" quedaba cortado a la derecha
- **Dónde:** `PageHeader` en `apps/web/src/components/ui.tsx`: las acciones iban en `flex shrink-0 flex-wrap`, sin límite de ancho.
- **Evidencia:**
  - antes: `evidencia/08-parts-count-stock-cortado-antes.png` (el botón llega a 404 px en una pantalla de 390);
  - después: `evidencia/08-parts-count-stock-despues.png`.
- **Criterio:** WCAG 1.4.10 (Reflow).
- **Severidad:** 3 · Es el botón principal de la pantalla.
- **Arreglo:** `max-w-full` en el contenedor de acciones, para que bajen de renglón. Vale para todas las pantallas que usan `PageHeader`.

### UX-8-003 · Plurales rotos: "1 Jobs", "1 jobs", "1 purchases", "Tied 1 Jobs"
- **Dónde:** `admin-messages-catalog.ts`, más de 20 textos con `{count} Jobs` o `{count} purchases`, en inglés y en español. Se ven en el Dashboard, en el Next step de la WO, en Purchases y en Vendors.
- **Criterio:** Nielsen H4 (consistencia y estándares).
- **Severidad:** 2.
- **Arreglo:**
  - `fillPlaceholders` entiende `{count:Job|Jobs}`, y una rama también puede llevar `{count}` adentro;
  - los textos se reescribieron así;
  - "jobs" pasa a "Job/Jobs", el término del producto;
  - prueba unitaria en `admin-next-step.spec.ts`.

### UX-8-004 · Objetivos táctiles de menos de 44 px
- **Dónde (medido):**
  - pestañas Overview, Costs y Faults del camión: 38 px;
  - prioridad Low, Normal y High de la WO: 36 px;
  - "Open" del camión en la WO: 36 px;
  - botones "…" de los menús: 40 px;
  - copiar VIN: 32 px;
  - enlaces WO-xxxx: 20 px.
- **Criterio:** WCAG 2.5.8 · Apple HIG 44 pt.
- **Severidad:** 2.
- **Arreglo:** con la regla del proyecto, 44 px en pantallas táctiles y compacto en la computadora:
  - `[@media(pointer:coarse)]:h-11` o `size-11 lg:size-8`;
  - `tap-inline` en los enlaces dentro de texto.

### UX-8-005 · People: "Manager or System Admin. Open a person…" quedaba como una frase suelta
- **Dónde:** `mechanicRosterTip`. Ese aviso solo lo ven el Manager y el System Admin.
- **Criterio:** Nielsen H2.
- **Severidad:** 2.
- **Arreglo:** el texto queda "Open a person to rename them, change their type, deactivate them or reset their password.", en inglés y en español.

### UX-8-006 · Count stock: el campo vacío mostraba "—" junto al botón "−"
- **Dónde:** `admin-count-stock.tsx`, el `placeholder="—"`.
- **Criterio:** Nielsen H4 (se confunde con un signo menos).
- **Severidad:** 3 en la pantalla del primer día del stock.
- **Arreglo:** sin placeholder. Debajo, el texto "Not counted" ya lo explica.

## No es un problema (revisado)
- **El menú abre en las 19 pantallas,** en WebKit y en Chromium (`evidencia/08-menu-abierto-webkit.png`). Una captura tomada durante la animación de entrada se ve transparente, y eso no es un defecto.
- **Los filtros rápidos del Yard** ("High priority" cortado) están en una franja que se desplaza de lado, a propósito.
- **Los "textos truncados" del primer recorrido** eran etiquetas `sr-only`, que miden 1 px por diseño. El recorrido ahora las ignora.
- **La búsqueda del Yard** mide 42 px, pero se toca en su `label`, que mide 44 px.

## Lo que funciona bien
- El menú del teléfono es una hoja con todos los grupos, y el breadcrumb se vuelve "‹ parent".
- Las tarjetas en lugar de tablas en el teléfono, en Purchases, People y Parts.
- Count stock en el teléfono, con tarjetas y botones − / + de 44 px.

## Fuera de alcance / no verificado
- El iPhone real con las barras de Chrome: la emulación no las tiene. **El dueño verifica UX-8-001 en el preview.**
- Las pantallas del mecánico, de Safety y el login (el dueño señaló el panel del Manager).
- Los diálogos uno por uno: solo se abrió el menú.
