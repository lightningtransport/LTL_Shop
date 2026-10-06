# 04 · Jerarquía y claridad visual — Lightning Shop Admin (Truck Detail)

**Fecha:** 2026-10-05 · **Alcance:** `/admin/trucks/[id]` en escritorio (1440 px) y teléfono
(375 px), tema oscuro · **Método:** código + navegador (producción en solo lectura: Truck 601,
WO-004 en progreso; Truck 282, Ready to Go).

**Resumen:** 7 hallazgos, 3 de severidad 3. La pantalla **falla la prueba de los 5 segundos** en
los dos casos revisados: la vista va al título y a los dos botones de arriba, pero no responde
"¿puede salir y qué lo frena?". Lo que frena (PM y Detailing pendientes) está escrito en
14 px dentro de un párrafo y repartido en seis cajas de igual peso. **El problema es de
aplicación, no de sistema:** los tokens y la escala tipográfica existen (LTR-166), pero los pasos
del Work Plan y sus Jobs usan el mismo tamaño y peso, y cada nivel lleva su propio badge.

## Prueba de los 5 segundos

- **Truck 601, escritorio** (`evidencia/05-truck-601-en-progreso.jpg`): "Camión 601, Not Ready,
  botones Open Work Order y Add work". No se ve **qué** lo frena: hay que leer "Readiness" y
  bajar por seis cajas. **Falla.**
- **Truck 601, teléfono** (`evidencia/04-truck-601-movil-arriba.jpg`):
  - Arriba se ven el título, dos botones y un Next step que repite el conteo ("3 Jobs left ·
    next: PM A Service").
  - El primer paso pendiente (PM) está debajo del pliegue.
  - El Work Order actual y sus mecánicos quedan al final, después de todo el Work Plan
    (`04-truck-601-movil-abajo.jpg`).
  - **Falla.**
- **Truck 282, Ready to Go** (`evidencia/05-truck-282-ready-to-go-contradiccion.jpg`): lo
  primero es un textarea vacío enorme dentro de "Next step"; la acción "Return to Service" queda
  a la derecha, abajo. "Ready to Go" aparece dos veces en badges. **Falla parcial:** se entiende
  la acción, pero tarda.

## Hallazgos

### Truck Detail — encabezado y Next step

### UX-4-001 · Lo que frena al camión no es lo que se ve primero
- **Dónde:** encabezado + "Next step" + "Readiness" · `admin-truck-detail.tsx`, `admin-readiness-tracker.tsx`
- **Evidencia:** (observado) en el 601:
  - El estado se reparte en cuatro lugares: el badge "Not Ready" y el badge de fase "PM" en el
    encabezado, el Next step "3 Jobs left · next: PM A Service", y Readiness "Not Ready — 3
    remaining / PM is required and not complete."
  - Medido: Next step `p` 14 px/600 como etiqueta y el texto en 14 px/400, igual que el cuerpo.
- **Criterio:** Punto de entrada; escaneabilidad.
- **Severidad:** 3 · Es la pregunta que la pantalla existe para responder (`SYSTEM.md` §6),
  en cada visita del Manager.
- **Recomendación:** Un **stepper de readiness** bajo el título:
  `Inspection ✓ · Shop Work ✓ · PM ● · Alignment ✓ · Detailing ● · QC ○ · Close ○`, con los
  pasos pendientes en color de aviso y clicables (llevan a su sección). Un solo chip de estado
  ("Not Ready · PM"). El Next step como callout con su acción, del mismo componente que la WO.
- **Esfuerzo:** M

### UX-4-002 · Un textarea vacío domina el estado Ready to Go
- **Dónde:** Next step `return_to_service` · `admin-truck-next-step.tsx`
- **Evidencia:** `evidencia/05-truck-282-ready-to-go-contradiccion.jpg` (observado). El textarea
  "Reason (optional)" ocupa todo el ancho y unos 80 px de alto. Es lo más grande de la pantalla
  y es opcional.
- **Criterio:** Acción principal; densidad.
- **Severidad:** 2 · La acción es clara, pero lo opcional pesa más que lo importante.
- **Recomendación:** Botón primario "Return to Service" en el callout. El motivo opcional va en el
  diálogo de confirmación, el mismo patrón que la propuesta de la WO.
- **Esfuerzo:** S

### UX-4-003 · Dos acciones primarias compiten en la primera vista
- **Dónde:** encabezado ("Add work") e Inspection ("Issues found" registrado) · `admin-truck-work-plan.tsx`
- **Evidencia:** (observado, medido) dos botones con fondo `primary` visibles a la vez en el 601.
  "Issues found" está en `primary` porque es el valor registrado (estado `aria-pressed`), no
  porque sea una acción a tomar.
- **Criterio:** Acción principal (una por vista); color reservado para lo accionable.
- **Severidad:** 2 · Confunde estado con acción: parece que hay que pulsar "Issues found".
- **Recomendación:** La inspección registrada se muestra como resultado ("Issues found ·
  Oct 4") con un "Change" discreto. Solo hay un primario por vista.
- **Esfuerzo:** S

### Truck Detail — Work Plan

### UX-4-004 · Pasos y Jobs pesan lo mismo, y cada nivel lleva su badge
- **Dónde:** Work Plan · `admin-readiness-tracker.tsx`
- **Evidencia:** (medido) los nombres de paso ("Inspection", "Shop Work") son `span` de 14 px/500;
  los nombres de Job ("Air Leak") son `p` de 14 px/500, **el mismo estilo**. Cada paso lleva un
  badge ("Complete", "Pending · 1") y cada Job otro ("Completed", "Pending"). En el teléfono
  sale "Complete" encima de "Completed" en la misma esquina (`04-truck-601-movil-abajo.jpg`).
- **Criterio:** Jerarquía tipográfica; agrupación; ruido.
- **Severidad:** 3 · Doce badges en una pantalla; hay que leer cada fila para saber qué falta.
- **Recomendación:**
  - El paso como encabezado de grupo (`group-title` + icono de estado); los Jobs como filas.
  - Los pasos completos van plegados en una línea ("Shop Work ✓ 1 job · Air Leak").
  - Estado del Job como punto + texto (el mismo patrón que la WO); sin badge del paso cuando
    el icono ya lo dice.
- **Esfuerzo:** M

### UX-4-005 · El mecánico se ve como iniciales ("MG", "MPM")
- **Dónde:** filas del Work Plan ("Assigned to: MG") y Current Work ("MA, MD, MG, MPM")
- **Evidencia:** (observado) `04-truck-601-work-plan.jpg`; medido 12 px/400.
- **Criterio:** Escaneabilidad (valores sin significado claro).
- **Severidad:** 2 · Con más mecánicos, las iniciales se repiten y no dicen quién.
- **Recomendación:** Avatar con iniciales **y** nombre, el mismo componente que la WO.
  (Nota: en producción los nombres de los usuarios de prueba **son** iniciales; confirmar
  con datos reales.)
- **Esfuerzo:** S

### UX-4-006 · Add work se abre lejos de su botón
- **Dónde:** encabezado → formulario al final de la tarjeta Work Plan · `work-plan-add-work.tsx`
- **Evidencia:** (observado) en el 601, "Add work" está arriba a la derecha y el formulario
  aparece debajo de "Close Work Order", fuera de la vista; el botón cambia a "Hide add work".
- **Criterio:** Proximidad (acción y resultado juntos); visibilidad del estado.
- **Severidad:** 3 · El usuario pulsa y "no pasa nada" a la vista; es la tarea central (D6).
- **Recomendación:** Panel lateral en escritorio / hoja inferior en el teléfono (decidido) con
  pie fijo "Add to Work Plan (N)".
- **Esfuerzo:** M

### Truck Detail — columna de contexto

### UX-4-007 · "Current Work" repite el encabezado y, en el teléfono, queda al final
- **Dónde:** `admin-truck-detail.tsx` (Current Work)
- **Evidencia:** (observado) en escritorio repite la WO, el estado y los mecánicos que ya dicen
  el encabezado ("Open Work Order: WO-004", "4 mechanics"). En el teléfono va después de todo el
  Work Plan (`04-truck-601-movil-abajo.jpg`).
- **Criterio:** Densidad; móvil (lo importante arriba).
- **Severidad:** 2
- **Recomendación:** Chip de la WO actual en el encabezado (estado · prioridad · pausa) con
  enlace, y una franja de métricas como en la WO. La columna lateral queda para el Truck
  (datos) y el historial.
- **Esfuerzo:** S

## Inventario visual

Medido con `getComputedStyle` en `main`, Truck 601, escritorio:

| Medida | Valor |
|---|---|
| Combinaciones tamaño/peso | 7: 30/700 (título), 18/600 (Work Plan, secciones plegadas), 16/400 ("Truck details" del summary), 14/600, 14/500, 14/400, 12/600, 12/400 |
| Tamaño menor | 12 px (cumple LTR-166) |
| Botones primarios visibles a la vez | 2 ("Add work", "Issues found") |
| Badges en la primera pantalla | 12 (2 en el encabezado + 1 de Inspection + 1 por paso + 1 por Job) |
| Cajas con borde dentro de otra caja | Hay: Next step dentro de su caja + bloque de blocker; borradores de Add work dentro de la tarjeta; `CategoryJobList` con `Card` dentro de la tarjeta (`category-job-list.tsx:46`) |
| Títulos | h1 → **h3** "Work Plan" (no hay h2) → h3 "Readiness", "Current Work" → summary h2 de las secciones plegadas (orden roto) |
| Componentes propios de la pantalla | El banner de error del Work Plan reimplementa `InlineAlert` a mano (`admin-truck-work-plan.tsx:235`) |

Conclusión: **sistema sí, aplicación no.** La escala, los tokens y `Badge` existen y se usan;
lo que falta es una jerarquía entre "paso" y "Job" y un componente de fila de Job compartido con
la WO (`admin-job-table.tsx`). El rediseño reutiliza el de la WO.

## Lo que funciona bien
- Nada baja de 12 px y el teléfono no tiene scroll horizontal (`scrollWidth` 375 = viewport).
- El orden de los pasos del Work Plan sigue el flujo real del taller (`SYSTEM.md` §5).
- Datos del camión e historial plegados: no compiten con la tarea.
- El color semántico es coherente: verde = completo, ámbar = aviso, azul = acción.

## Fuera de alcance / no verificado
- Contraste numérico: es de la skill 2 (el hallazgo de tokens del tema oscuro ya está en
  `docs/OPEN_ISSUES.md` R6).
- Estados `external`, `qc`, `add_missing_steps` y el formulario Add work con borradores: no
  había datos en producción; se juzgan en la maqueta.
- Tema claro: no se revisó en producción.
