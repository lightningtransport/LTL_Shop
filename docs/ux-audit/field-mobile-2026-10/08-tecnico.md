# 08 · Técnico y móvil — mecánicos (General y PM) y Safety en el teléfono (2026-10)

**Fecha:** 2026-10-19 · **Alcance:** las pantallas del mecánico General (`/mechanic/standard`, Trucks, Completed, la Work Order, Repair history), del mecánico de Alignment, del PM (`/mechanic/pm`, la Work Order con el PM) y de Safety (`/qc`: To review, la hoja de revisión, Returned y Done), más el login y los diálogos de Report Blocker · **Método:** recorrido `apps/web/e2e/mobile-walk.spec.ts` con `MOBILE_WALK=field` (skill `mobile-ui-check`) en **WebKit iPhone 13** y **Chromium móvil**, contra una build de producción cuya API lee `ltl_shop_test` con datos sembrados (un camión trabajando con un bloqueo, un PM en curso, camiones por revisar, uno devuelto y uno aprobado). Más la lectura del código. Linear: **LTR-251** (sigue a LTR-250, el panel del Manager).

**Resumen:**
- Hay 5 hallazgos: 1 de severidad 3, 2 de severidad 2 y 2 de severidad 1. Más un plural roto del panel del Manager que LTR-250 no vio.
- **El marco de las apps de campo está bien:** desplazan la ventana a propósito, el encabezado es sticky y las pestañas de abajo quedan fijas y visibles. El corte que tenía el panel del Manager (UX-8-001 en `admin-mobile-2026-10`) no pasa aquí.
- Todos están corregidos en el mismo PR. Después del arreglo el recorrido no encuentra nada en ninguno de los dos motores.

**Límite:** la emulación no tiene las barras del navegador del iPhone. El dueño confirma en el teléfono con el preview de Vercel.

## Hallazgos

### UX-F-001 · PM: los interruptores de "Parts used" medían 28 px
- **Dónde:** `apps/web/src/components/pm-service-card.tsx`, el `button role="switch"` con `h-7`. Solo el interruptor se toca, no la fila.
- **Evidencia (medido):** los 9 interruptores de un PM A miden 28 px de alto (`evidencia/08-pm-partes-28px-antes.png`).
- **Criterio:** WCAG 2.5.8 · Apple HIG 44 pt. El mecánico los toca con guantes, varias veces por PM.
- **Severidad:** 3.
- **Arreglo:** el botón mide 44 px en el teléfono y adentro queda el mismo dibujo de 28 px. Vuelve a 28 px en la computadora (`lg:h-7`). El nombre y el rol del interruptor no cambian.

### UX-F-002 · Trucks: "Open WO-xxx" medía 36 px
- **Dónde:** `apps/web/src/components/mechanic-trucks-page.tsx`, `min-h-9`. Se ve en Trucks del mecánico General y del PM (`evidencia/08-trucks-open-wo.png`).
- **Criterio:** WCAG 2.5.8.
- **Severidad:** 2. Es el camino corto a la Work Order propia.
- **Arreglo:** `[@media(pointer:coarse)]:min-h-11`, la regla del proyecto.

### UX-F-003 · Report Blocker: el mismo diálogo, dos formas
- **Dónde:**
  - en la Work Order General (`apps/web/src/app/work-orders/[id]/detail-client.tsx`), Complete job y Report Blocker ponen Cancel y la acción lado a lado (`grid grid-cols-2`);
  - en el PM (`pm-job-detail.tsx`) y en Safety (`quality-check-page.tsx`) se usa `DialogActions`: en el teléfono la acción va arriba y Cancel abajo.
- **Evidencia:** `evidencia/08-report-blocker-general-antes.png`.
- **Criterio:** Nielsen H4 (consistencia).
- **Severidad:** 2. Un mecánico que también hace PM ve los botones en otro orden según la pantalla.
- **Arreglo:** los dos diálogos de la Work Order General usan `DialogActions`, como el resto.

### UX-F-004 · PM: "Truck Information" con el triángulo nativo
- **Dónde:** `pm-job-detail.tsx` usaba `<details>`/`<summary>` (▶). La Work Order General usa un botón de 48 px con chevron.
- **Evidencia:** `evidencia/08-pm-truck-information-antes.png` → `08-pm-truck-information-despues.png`.
- **Criterio:** Nielsen H4.
- **Severidad:** 1.
- **Arreglo:** el PM usa el mismo plegable que la Work Order General (`aria-expanded`, chevron).

### UX-F-005 · Repair history: "Volvo | VNL 760 | 2022" y "ALL"
- **Dónde:**
  - `apps/web/src/app/trucks/[id]/history/page.tsx`: marca, modelo y año separados con barras, y millas, empresa y dueño también con barras;
  - `allCategoriesChip` decía "ALL" / "TODOS" en mayúsculas, junto a "PM" e "Inspection".
- **Evidencia:** `evidencia/08-historial-antes.png` → `08-historial-despues.png`.
- **Criterio:** Nielsen H4. En el resto de la app el vehículo se lee "2022 Volvo VNL 760" y los datos van con "·".
- **Severidad:** 1.
- **Arreglo:** "2022 Volvo VNL 760", "309,100 mi · Lightning · Ana" (lo que falta no se muestra) y el chip "All" / "Todos".

### Extra · Month close decía "1 trucks to charge"
- **Dónde:** `pcCloseSummary` en `admin-messages-catalog.ts` (panel del Manager). La e2e `admin-internal-invoices.spec.ts` esperaba ese texto, así que lo dejaba fijo.
- **Arreglo:** `{trucks} {trucks:truck|trucks}` y `{trucks:camión|camiones}`, con la regla de plurales de LTR-250. La e2e ahora espera "1 truck to charge".

## No es un problema (revisado)
- **El documento más alto que la pantalla** en la Work Order, el inicio del mecánico y el PM: las apps de campo desplazan la ventana a propósito (`app-shell`). El encabezado es sticky y las pestañas de abajo son fijas, así que siguen a mano.
- **Safety:** la cola, la hoja de revisión (Return / Approve fijos abajo), Returned y Done no tienen toques chicos ni textos cortados (`evidencia/08-safety-revision.png`).
- **El diálogo Report Blocker** pide desplazar un poco para llegar a los botones (7 motivos y la nota). La hoja se desplaza bien y los botones se alcanzan.
- **El login** mide 28 px más que la pantalla solo por los botones de desarrollo (Dev login, demo), que no salen en producción.
- **La barra fija del PM** (Report Blocker / Finish PM) es translúcida con desenfoque. En la captura sin desenfoque se adivina el texto de atrás; en el teléfono se ve desenfocado.
- **Los números de WO** en letra monoespaciada en unas tarjetas y normal en otras: es la mezcla que ya tiene el panel del Manager. No se toca sin una regla.

## Para decidir el dueño
- **Mayúsculas en los botones:** conviven "Add note" y "Add Note", "Complete job" y "Report Blocker", "View Work" y "Continue review". El panel del Manager usa la primera palabra con mayúscula ("Count stock"). Unificarlo toca muchos textos y pruebas, así que se pregunta antes.

## Lo que funciona bien
- Las tres pestañas de abajo siempre a la vista, con el número de pendientes en Safety ("To review · 2", "Returned · 1").
- La franja verde del reloj ("Truck 922 · since 8:51 AM") lleva a la Work Order abierta desde cualquier pantalla.
- Los motivos del bloqueo son filas de 44 px o más, fáciles de tocar.

## Cómo repetirlo
1. Sembrar `ltl_shop_test` con un escenario (en esta revisión, una fila temporal de test:real con los helpers de `apps/api/test-real/harness.ts`, que no se guardó).
2. Levantar la API contra `ltl_shop_test` (`AUTH_DEV_BYPASS=true`, puerto 3211) y una build de producción del web con `NEXT_PUBLIC_E2E_DEV_LOGIN=1` en el puerto 3010.
3. `MOBILE_WALK=field PLAYWRIGHT_SKIP_WEBSERVER=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:3010 playwright test e2e/mobile-walk.spec.ts -g field`, en `mobile-webkit` y `mobile-chromium`.
