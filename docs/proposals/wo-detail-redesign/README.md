# Propuesta: rediseño de Work Order Detail (Admin)

**Clasificación:** PROPUESTA — no es el estado actual de la app.
**Fecha:** 2026-10-05 (actualizada el mismo día con LTR-186 y LTR-188) · **Rama:** `claude/ui-screen-improvement-baa9cf` · **Sin PR todavía.**
**Pantalla:** `/admin/work-orders/[id]` → `apps/web/src/components/admin-work-order-detail.tsx`

El dueño aprobó la dirección visual. **Construido** en la Etapa 5 (2026-10-06, rama
`claude/exciting-lehmann-09883c`): "…" de la WO y de cada Job como menús; el blocker dentro del aviso
del Next step (nota al pulsar Resolve, resueltos plegados); Jobs con bloqueados arriba, estado como
punto + texto, selector de mecánico con búsqueda y "Quitar asignación", hechos y cancelados plegados;
notas con campo en línea y "Publicar"; columna derecha sin datos repetidos (tarjeta Truck, tiempos con
barras por mecánico, prioridad); Historial con pestañas y "Corregir…" por tramo en un diálogo. Antes
(Etapas 2 y 4): el Next step actúa aquí, cerrar confirma, "Back to Truck" y la fila resaltada.
**Pendiente:** la franja de métricas del encabezado y el título "Truck 918" (decisión abierta),
Priority segmentado y los tokens del tema oscuro (Etapa 7).

## 1. Cómo verla

`mockup.html` es una maqueta estática (HTML + Tailwind por CDN + datos de
prueba en memoria). No llama a la API. Necesita internet para el CDN.

```bash
python3 -m http.server 4455 --bind 127.0.0.1 --directory docs/proposals/wo-detail-redesign
```

Abrir `http://127.0.0.1:4455/mockup.html`. También funciona abriendo el
archivo directo en el navegador.

- Botón **Demo** (arriba a la derecha): cambia el estado de la Work Order
  (en progreso con blocker, en progreso, pausada, esperando taller externo,
  lista para cerrar, completada, cancelada), activa **solo lectura** (sin `work_orders.manage`)
  y **simular error** en la próxima acción.
- Botón sol/luna: tema claro / oscuro. Revisada en 1440 px y 375 px.

## 2. Por qué (qué estaba mal)

Revisión de la pantalla en producción (WO-010, Truck 918) el 2026-10-03:

1. **Datos repetidos.** El Truck aparece 3 veces (título, tarjeta Truck,
   Truck details); los tiempos 2 (sidebar y History); los mecánicos 3
   (sidebar, Operational summary, tabla).
2. **Todo pesa lo mismo.** Cada bloque es una tarjeta con borde y título;
   no hay zona principal.
3. **"Mark complete" con borde en cada fila** compite con todo.
4. **Caja amarilla de blockers** con un textarea grande siempre abierto, y
   repite lo que ya dice "Next step".
5. **Activity Log plano y largo.**
6. **Corrección de tiempo** es un formulario completo siempre visible.
7. **"…" abre un modal** para 1–2 opciones.

## 3. Qué cambia

| # | Zona | Hoy | Propuesta |
|---|---|---|---|
| 1 | Encabezado | Número del Truck como link azul, badges, "Updated" suelto, conteos en texto | "Truck 918" como título, WO en mono, una línea de meta. Franja de métricas: progreso (barra hecho/bloqueado), labor, espera, edad, mecánicos (avatares). En teléfono, una tarjeta compacta |
| 2 | Acciones | Pause / Resume + "…" que abre un modal | Igual, pero "…" es un **DropdownMenu** (hoja inferior en teléfono) |
| 3 | Next step + blockers | Caja "Next step" + caja amarilla aparte con textarea | **Un solo aviso** según el estado (ver §4). El blocker abierto vive ahí; la nota se abre al pulsar Resolve; los resueltos van plegados |
| 4 | Jobs | Botón con borde por fila; todos en una lista | Bloqueados arriba (borde lateral ámbar). Estado como punto + texto. Mecánico con avatar y **selector con búsqueda**. "Complete" discreto (primario solo en Quality Check). Hechos y cancelados agrupados y plegables. En teléfono cada fila ocupa 2 líneas |
| 5 | Notes | Lista con fondo `bg-muted` + botón "Add note" que abre el formulario | Hilo con avatar; campo en línea con Post; work requests con "Mark handled" |
| 6 | Columna derecha | Tarjeta de contexto + Operational summary + Truck details + Repair history | Una tarjeta **Truck** (sin repetir), **Priority** segmentado + Update, **Labor by mechanic** con barras, **Repair history** con filtro |
| 7 | History | Una sección plegada con todo adentro | **Tabs**: Activity (línea de tiempo por día, "Show all"), Times (tiempos + segmentos), Pauses |
| 8 | Corrección de tiempo | Formulario fijo | "Correct…" en cada segmento → diálogo con validación |

### 3b. Lo que llegó a `main` después de la primera versión

La rama se actualizó con `main` (#240 LTR-186, #241 LTR-188) y la maqueta
ya lo incluye:

| Novedad | Regla | Cómo queda en la propuesta |
|---|---|---|
| **Ayudante** (D23) | "Add helper" en el `…` de un Job Standard pendiente (no PM, no QC, no otro ayudante, no en taller externo). Crea un Job aparte "<Job> · helper" con su dueño. Un blocker del principal no bloquea al ayudante | Opción en el menú de la fila → diálogo con el mecánico (sin el dueño ni quien ya ayuda). La fila del ayudante va **debajo de su Job**, con ↳ y "Helps <dueño>" |
| **Taller externo** (D24) | "Send to external shop" en el `…` (no QC). Sale la pieza o el camión + nota obligatoria. Sin dueño ni reloj, no cuenta como "sin asignar". "Returned" lo completa o lo asigna | Estado "At external shop", en la columna Mecánico "Part out / Truck out · nota". Acción **Returned** → diálogo Complete / Assign to. Van después del trabajo del taller y antes de QC. Segmento azul en la barra de progreso |
| **Siguiente paso "external"** | Si lo único pendiente (además de QC) está afuera, el siguiente paso es esperar | Aviso "At external shop: <Job>" con la nota y **Returned**. Si salió el camión: "Yard shows the truck as Out of shop" |
| **Cierre del día y cambio de camión** (D20, D21) | A las 5:00 PM la app cierra los relojes; al empezar en otro camión se cierra el anterior | History › Times: **una sola lista** de tramos (antes eran dos: "Labor segments" y el select de corrección) con chip "Day close" / "Switched truck", el tramo en curso en verde y "Correct…" solo en tramos cerrados. El diálogo explica por qué se cerró. Activity muestra ambos eventos |

### 3c. Reparto Truck ↔ Work Order (decidido el 2026-10-05)

Viene de la auditoría [`ux-audit/admin-truck-wo/05-navegacion-ia.md`](../../ux-audit/admin-truck-wo/05-navegacion-ia.md)
y de la propuesta [`truck-detail-redesign/`](../truck-detail-redesign/README.md) §2. Para esta
pantalla significa:

- La WO es **el único lugar con acciones de Job** (dueño, Complete, helper, taller externo,
  Returned, cancelar o reabrir). El Truck solo asigna los Jobs sin dueño y enlaza aquí con
  `#job-<id>`: la WO abre esa fila y la resalta.
- **El Next step actúa aquí.** Hoy la app lleva al Truck para Resolve, Assign, Close y Return to
  Service (T2). La maqueta ya lo hace en el sitio. La única salida es `inspect` → "Go to the
  inspection" (Truck).
- **El back link sabe de dónde vienes:** "Back to Truck 918" si llegaste desde el Truck (`?from=`).

## 4. Comportamiento de cada acción

Los textos de diálogos y ayudas son los de `admin-messages.ts`. Ninguna
regla de negocio cambia; solo dónde y cómo se muestra.

| Acción | Qué pasa |
|---|---|
| **Pause** | Diálogo con motivo obligatorio, sin preselección (los 11 `PauseReason`). Solo en In progress. Después: badge "Paused", botón **Resume**, aviso "Paused · motivo", fila en History › Pauses |
| **Resume** | Directo (en el encabezado y en el aviso) |
| **"…" de la WO** | Abierta: Correct time (lleva a History › Times), Cancel Work Order. Completada: Reopen. Cancelada: Reopen. Cada una abre su diálogo con motivo (Cancel y Reopen obligatorio) |
| **Resolve blocker** | Nota opcional en línea → Confirm resolve. El Next step se recalcula |
| **Mecánico del Job** | Selector con búsqueda; "Unassign" desasigna. Job PM: solo mecánicos PM. Quality Check: sin selector ("Safety") |
| **Complete (Job)** | Sin confirmación, como hoy. La fila pasa a "Done" |
| **"…" del Job** | Pendiente: Add helper (D23), Send to external shop (D24), Cancel job. Cancelado: Reopen job. Cancel / Reopen con motivo obligatorio. Los hechos no tienen menú (como hoy) |
| **Returned** (Job afuera) | Diálogo: Complete el Job, o Assign to (mecánico obligatorio; propone al dueño anterior) |
| **PM A / PM B** | Menú; el Job PM se completa desde el PM service |
| **Todos los Jobs hechos** | Aviso "All jobs are done" con **Confirm completion** → diálogo de confirmación; barra fija abajo cuando el aviso sale de pantalla |
| **Completada** | Next step "Return the truck to service" → diálogo (motivo opcional). Después, la tarjeta Truck dice "Returned to service" |
| **Priority** | Elegir nivel → aparecen Update priority / Reset (como hoy) |
| **Notes** | Post; work request → Mark handled |
| **Correct time** | Diálogo: inicio, fin, motivo. Valida ambos tiempos, fin > inicio y motivo |
| **Errores** | Aviso rojo bajo el encabezado (mensaje `assignmentConflict`) + toast. Éxito: solo toast |
| **Solo lectura** | Sin botones de cambio; "View only…", candado en Jobs, "Only a Shop Manager can resolve blockers." |

Teléfono: menús, selector de mecánico y diálogos como **hoja inferior**;
controles de 44 px; sin scroll horizontal a 375 px.

### Estados del aviso "Next step" (en orden de prioridad)

1. Cancelada → "This Work Order was cancelled" + motivo.
2. Completada sin devolver → "Return the truck to service" (primario).
3. Completada y devuelta → "Truck returned to service".
4. Pausada → "Paused · motivo" + Resume.
5. Blocker abierto en un Job pendiente → el blocker + Resolve.
6. Solo queda trabajo en taller externo (y QC) → "At external shop: <Job>" + Returned.
7. Sin Jobs pendientes → "All jobs are done" + Confirm completion.
8. Si no → "Assign N jobs" o "Work in progress" (cuenta solo Jobs del taller).

En la app esto debe salir de `data.nextStep` (la regla única de la API,
LTR-159), no recalcularse en el cliente. La maqueta lo imita.

## 5. Decisiones pendientes (las responde el dueño)

- [ ] **Título:** "Truck 918" (propuesta) o el número de WO.
- [x] **Confirmación (decidido 2026-10-05):** **Confirm completion** abre un diálogo ("WO-010
      closes as Completed and Truck 918 becomes Ready to Go… You can reopen it later from '…',
      with a reason."), desde el aviso y desde la barra fija. **Complete del Job sigue con un
      toque**: es frecuente, afecta solo a ese Job y se reabre fácil.
- [ ] **Copiar VIN:** botón nuevo en la tarjeta Truck. ¿Se queda?
- [ ] **Tokens del tema oscuro (§7):** ¿en esta rama o en un PR aparte?
      Afecta todas las pantallas.

Ya decidido: Priority mantiene elegir + **Update** (no guarda al tocar).

## 6. Plan de implementación

Seguir `docs/reference/AGENT_WORKFLOW.md`. Antes de codificar: sincronizar la
rama con `main` y anotar los defectos en `OPEN_ISSUES.md` §1e (ya están).

1. **shadcn** (solo lo que falta, ver `design-system/components.md`):
   `npx shadcn@2.3.0 add dropdown-menu tabs popover command` desde
   `apps/web`. Cambiar imports `@radix-ui/react-*` → `radix-ui`; aplicar la
   escala tipográfica (nada bajo 12 px, sin mayúsculas). Actualizar
   `components.md` (Tabs y Dropdown dejan de ser TARGET).
2. **Encabezado y métricas:** `admin-operational-header.tsx` (también lo usa
   Truck Detail: mantenerlo compatible).
3. **Aviso Next step + blockers:** unir la caja de `nextStep` y
   `AdminBlockerResolve` (este último también se usa en Dashboard y Truck).
4. **Jobs:** `admin-job-table.tsx` — orden, estado, selector de mecánico
   (Popover + Command), menú de fila (DropdownMenu), grupo de cerrados.
5. **Notes:** hilo + composer; revisar `work-order-notes-thread.tsx`.
6. **Columna derecha:** quitar Operational summary y Truck details;
   una tarjeta Truck; Priority segmentado.
7. **History:** Tabs; corrección de tiempo a diálogo por segmento.
8. **Textos nuevos** en los dos catálogos (EN/ES) de `admin-messages.ts`.
9. **Verificar:** `npm run lint`, `npm test`, e2e de detalle de WO
   (`admin-work-order-detail.spec.ts`, `notes-and-history`,
   `blocker-lifecycle`, `pause-until-in-progress`), `npm run ui-audit`
   (contraste, 44 px, 12 px) en claro/oscuro y teléfono/escritorio, y
   `npm run test:real`.

Selectores `data-testid` que usan las pruebas y deben seguir existiendo:
`admin-wo-next-step`, `admin-wo-more-actions`, `admin-wo-job-row`,
`admin-wo-history`, `admin-wo-next-action`, `admin-blocker`,
`operational-counts`; y los de LTR-186/188: `admin-wo-job-add-helper`,
`admin-wo-add-helper-dialog`, `admin-wo-job-send-external`,
`admin-wo-send-external-dialog`, `admin-wo-job-external`,
`admin-wo-job-external-where`, `admin-wo-job-returned`,
`admin-wo-return-external-dialog`, `labor-segments`, `labor-end-reason`.

Detalles del código nuevo que el rediseño corrige de paso (R7, R8 en
`OPEN_ISSUES.md`): el título "Labor segments" usa `uppercase tracking-wide`
(la regla es sentence case) y el error de "Send to external shop" usa
`text-destructive` (la regla es `text-destructive-text`).

## 7. Hallazgo: tokens del tema oscuro

En `apps/web/src/app/globals.css` (`.dark`), `--card`, `--muted` y
`--accent` valen lo mismo: `oklch(0.2795 0.0368 260.031)`. Efecto en oscuro:

- `bg-muted` dentro de una tarjeta no se ve (p. ej. las notas actuales).
- `hover:bg-accent` de botones `outline` / `ghost` / `secondary` sobre una
  tarjeta no cambia nada.

En claro los tres son distintos. La maqueta usa (solo en oscuro):
`--muted: oklch(0.31 0.037 259)`, `--accent: oklch(0.33 0.04 258)` y un
token nuevo `--sunken` (cabeceras de tabla y grupos plegados:
claro `oklch(0.965 0.006 247.9)`, oscuro `oklch(0.24 0.038 263)`).
Medir contraste con `npm run ui-audit` antes de aplicarlo.

Nota: los bordes blancos que se vieron en una versión de la maqueta eran
del preflight del CDN de Tailwind, **no** de la app (la app pone
`* { border-color: var(--border) }` después de `@tailwind base`).
