# Propuesta: rediseño de Truck Detail (Admin)

**Clasificación:** PROPUESTA — no es el estado actual de la app.
**Fecha:** 2026-10-05 · **Rama:** `claude/ui-screen-improvement-baa9cf` · **Sin PR todavía.**
**Pantalla:** `/admin/trucks/[id]` → `apps/web/src/components/admin-truck-detail.tsx`
**Base:** auditoría [`docs/ux-audit/admin-truck-wo/`](../../ux-audit/admin-truck-wo/) (05
navegación e IA, 04 jerarquía visual) y la propuesta hermana
[`wo-detail-redesign/`](../wo-detail-redesign/README.md).

El dueño confirmó el **reparto Truck ↔ Work Order** (§2) el 2026-10-05. Faltan las decisiones de
§6 y después implementar (§7). Nada de esto está construido.

## 1. Cómo verla

```bash
python3 -m http.server 4456 --bind 127.0.0.1 --directory docs/proposals/truck-detail-redesign
```

Abrir `http://127.0.0.1:4456/mockup.html`. Es HTML estático con Tailwind por CDN y datos de
prueba en memoria; necesita internet. El botón **Demo** tiene un estado por cada Next step:

- Sin WO
- Issues found → Add work
- Falta inspección
- Blocker
- Pausada
- Trabajando
- Job sin dueño
- Faltan pasos
- Taller externo
- Solo QC
- Lista para cerrar
- Ready to Go
- In Service

También tiene **Solo lectura**, **Simular error** y **Reiniciar**. Se revisó en escritorio y a
375 px, en claro y en oscuro.

## 2. El reparto (decidido)

| | **Truck** | **Work Order** |
|---|---|---|
| Responde | ¿Puede salir este camión y, si no, qué lo frena? | ¿Qué hacemos, quién, cuánto falta y qué pasó? |
| Vive | Todas las visitas del camión | Una visita |
| Solo aquí | Inspección (D14), **Add work** (D6), Return to Service, datos e historial | Reasignar, completar, ayudante (D23), taller externo y Returned (D24), Pause, notas, prioridad, tiempos, cancelar/reabrir |
| Compartido | **Next step**: la misma regla (LTR-159) y el mismo componente, que **actúa donde estás** | Igual |

Reglas que salen de ahí:

1. **El Next step actúa en la pantalla.** Resolve, Resume, Assign, Add missing steps, Mark QC
   complete, Close y Return to Service no navegan. Solo navega lo que vive en la otra pantalla:
   - en el Truck, `external` → **Open in Work Order** (Returned está allá);
   - en la WO, `inspect` → **Go to the inspection** (Truck).
2. **Los Jobs del Truck son de lectura.** Se ven por paso de readiness, con dueño y estado. Solo
   los Jobs **sin dueño** tienen **Assign** (el paso `assign`). Cada fila tiene **↗ Manage in
   Work Order**, que abre la WO en esa fila (`#job-<id>`, resaltada).
3. **La WO vuelve al Truck.** Si llegas a la WO desde el Truck, su back link dice "Back to
   Truck 601" (`?from=`, como ya hace el Truck).

## 3. Por qué (lo que estaba mal)

Hallazgos de [`05-navegacion-ia.md`](../../ux-audit/admin-truck-wo/05-navegacion-ia.md) y
[`04-jerarquia-visual.md`](../../ux-audit/admin-truck-wo/04-jerarquia-visual.md):

- **UX-5-001:** el Truck 282 dice "Open Work Order: WO-002" y "No open Work Orders" a la vez.
- **UX-5-003:** la lista de Jobs está en las dos pantallas con poderes distintos y sin enlace
  entre ellas.
- **UX-5-004:** el Next step de la WO manda al Truck para hacer lo que la WO ya tiene.
- **UX-5-005:** el Truck dice "esperando taller externo" y no ofrece cómo marcar que regresó.
- **UX-5-006, UX-4-006:** Add work se abre al final del Work Plan, lejos del botón.
- **UX-4-001:** lo que frena al camión no se ve primero; el estado está repartido en cuatro
  lugares.
- **UX-4-002:** un textarea vacío domina Ready to Go.
- **UX-4-003:** "Issues found" registrado se ve como botón primario.
- **UX-4-004:** pasos y Jobs pesan lo mismo; hay 12 badges.
- **UX-4-007:** Current Work repite el encabezado.

## 4. Qué cambia

| Zona | Hoy | Propuesta |
|---|---|---|
| Encabezado | Número, badge Ready/Not Ready + badge de fase, "Open Work Order: WO-x", Add work, "N Jobs left · M mechanics" | "Truck 601", **un chip** ("Not Ready · PM", "Ready to close", "Ready to Go", "In Service", "No open Work Order"), vehículo y empresa, **chip de la WO** ("WO-004 · In progress ↗", "WO-002 · Completed ↗"), **Add work** (primario) y "…" (Open WO, Pause Work Order… → WO, New Work Order, Copy link) |
| Readiness | Párrafo "Not Ready — 3 remaining / PM is required…" dentro del Work Plan | **Stepper** de píldoras bajo el encabezado: Inspection → Shop Work → PM → Alignment → Detailing → Quality Check → Close Work Order, con estado (hecho, pendiente con número, bloqueado, externo, falta, no aplica, listo para cerrar). Cada píldora lleva a su paso. Al lado: Jobs pendientes y mecánicos (avatares) |
| Next step | Caja con el texto; Return to Service con textarea siempre abierto; "Go to the inspection" hace scroll | El callout de la WO (§5). Inspección **en el mismo aviso** (No issues / Issues found); Return to Service en un diálogo con motivo opcional |
| Work Plan | Seis cajas con badge por paso y otro por Job; iniciales | Un paso por sección: icono de estado + nombre + resumen ("1 pending", "Blocked", "Not applicable"). Los pasos completos van **plegados**. Las filas usan el estilo de la WO (avatar con nombre, punto de estado, ayudante bajo su Job, "Part out / Truck out"). Assign solo sin dueño; ↗ Manage en cada fila |
| Inspection | "No issues found / Issues found" siempre visibles, el registrado en primario | Pendiente: dos botones. Registrada: "Issues found · Oct 4, 9:12 AM" + **Change** (menú). No deja pasar a "No issues" con Shop Work pendiente (E13) |
| Add work | Formulario al final del Work Plan | **Panel lateral** (hoja en el teléfono) — ver §5 |
| Columna derecha | Current Work + Truck details (plegado) + Repair history (plegado, sin paginar) | **Truck** abierto (vehículo, millaje, VIN con copiar, empresa, estado operativo, ubicación) + **Repair history** con filtro por categoría y **Load more**. Current Work desaparece (está en el chip) |
| Feedback | Banner verde **y** toast; errores en tres estilos | Solo toast al éxito; error en línea bajo el encabezado + toast, con **Reload Truck** |

## 5. Comportamiento

### Next step (una regla, el primero que aplica)

| Paso | Texto | Acción en el Truck |
|---|---|---|
| Sin WO (`create_work_order`) | "No open Work Order", y la frase según la inspección: pendiente → "Record the arrival inspection below…"; Issues found → "Add the work: that opens the Work Order…"; No issues → "Open a Work Order for the required steps" | Issues found: **Add work** (primario) + New Work Order. Si no: **New Work Order** → diálogo (prioridad, nota) → la WO nace en "Created" y te quedas en el Truck |
| `return_to_service` | "Return it to service when it leaves the shop" + WO y fecha | **Return to Service** → diálogo con motivo opcional |
| `resolve_blocker` | "<Job> is blocked · <motivo>", quién y cuándo, notas del mecánico | **Resolve** → nota opcional en línea → Confirm resolve |
| `resume` | "You paused this Work Order: <motivo>." | **Resume** |
| `inspect` | "Record the inspection" | **No issues found** / **Issues found** ahí mismo |
| `add_missing_steps` | "This Work Order is missing: <pasos>." | **Add missing steps** (cada uno con su dueño por defecto) |
| `assign` | "Nobody is assigned to <Job>." | **Assign** → selector con búsqueda (PM solo mecánicos PM) |
| `external` | "At external shop: <Job>" + nota y desde cuándo | **Open in Work Order** (a la fila con Returned) |
| `qc` | "Everything else is done" · Safety lo revisa | **Mark QC complete** (respaldo, outline) |
| `close` | "All Jobs are done" | **Close Work Order** → diálogo de confirmación |
| `work` | "Mechanics are working" · "N jobs left · next: <Job>" | — |

### Add work (panel)

- Categorías como botones; las pistas de Detailing, Suspension & Steering y Quality Check se
  conservan.
- Búsqueda dentro de la categoría. Los Jobs del catálogo son chips: los que ya están en el plan
  salen deshabilitados con "· on plan".
- **Job custom:** se valida el duplicado (mismo nombre, sin importar mayúsculas ni espacios)
  con el texto "A Job with this name is already on the Work Plan or in this list." Hoy sale
  "Jobs in this Work Order".
- **To add (N):** cada borrador con **Who does it?**, un selector con búsqueda. PM, Alignment
  y Detailing proponen su dueño por defecto; QC dice "Safety".
- Pie fijo: Cancel y **Add to Work Plan (N)**, deshabilitado con "Add at least one Job.".
- **Sin WO,** el panel dice que abre la WO con los pasos obligatorios; al confirmar se crea con
  esos pasos más lo agregado (E12).
- Si se registra Issues found y no hay Shop Work, el panel se abre solo (como hoy).

### Solo lectura

Sin Add work, sin "…", sin botones de inspección ni Assign. Se muestra "View only. Only a Shop
Manager can change this Truck." y en el Next step "Only a Shop Manager can take this step.". El
↗ Manage sigue (lleva a la WO de lectura).

## 6. Decisiones pendientes (las responde el dueño)

Decididas por el dueño el 2026-10-05:

- [x] **New Work Order → diálogo en el Truck** (prioridad, por defecto Normal, y nota opcional;
      texto de `createMandatoryStepsHelp`). Crea la WO con los cuatro pasos obligatorios y **te
      quedas en el Truck**. Está en el Next step `create_work_order` y en el "…". La pantalla
      `/admin/work-orders/new` sigue para la lista de Work Orders.
- [x] **Close Work Order pide confirmación:** un diálogo dice "WO-x closes as Completed and
      Truck 601 becomes Ready to Go… You can reopen it from the Work Order, with a reason.".
      Completar un **Job** sigue con un toque (sin confirmación), en las dos pantallas.
- [x] **Pause Work Order… en el "…" del Truck** es un atajo que **lleva a la WO** con el diálogo
      de pausa (solo con la WO en In progress). Pause sigue viviendo solo en la WO; Resume sale
      en el Next step.

Pendiente, fuera de esta propuesta:

- [ ] **Stepper:** ¿se repite en el Dashboard o en las tarjetas del Yard?

## 7. Plan de implementación

Antes de codificar: sincronizar la rama con `main`. Los defectos están en
`docs/OPEN_ISSUES.md` §1f.

1. **Next step compartido.**
   - Un componente que usen el Truck y la WO.
   - Base: `admin-truck-next-step.tsx`, que ya actúa en el sitio, y quitar el `Link` a
     `truckHref` de `admin-work-order-detail.tsx`.
   - Return to Service, New Work Order y Close Work Order en diálogo; inspección dentro del aviso.
   - New Work Order reutiliza la llamada de `admin-new-work-order.tsx` (truck, prioridad, nota).
2. **Encabezado.**
   - `admin-operational-header.tsx` (compartido): un chip de estado, chip de la WO
     (`displayId` + estado; con la WO completada dice "Completed") y el stepper desde
     `workPlan.steps` de la API (no se calcula en pantalla).
3. **Work Plan.**
   - `admin-readiness-tracker.tsx` y `admin-truck-work-plan.tsx`: secciones plegables por
     paso, una fila de Job compartida con `admin-job-table.tsx` en modo lectura, Assign solo
     sin dueño, enlace `/admin/work-orders/[id]#job-<id>`.
   - La WO lee el hash, abre la fila y la resalta.
4. **Add work.**
   - `work-plan-add-work.tsx` y `category-job-list.tsx` dentro de un **Sheet** de shadcn
     (`npx shadcn@2.3.0 add sheet`; además de los de la WO: dropdown-menu, popover, command).
   - El texto de duplicado correcto; `#add-work` abre el panel (lo usa "Add work in the Work
     Plan" desde la WO).
5. **Columna derecha.**
   - Quitar Current Work; tarjeta Truck abierta; Repair history con `nextCursor` (Load more).
6. **WO.**
   - Back link con `?from=` ("Back to Truck 601").
7. **Textos** en EN y ES (`admin-messages.ts`), incluidos:
   - Los de los errores sin nombres de permisos (T6).
   - "Unable to load Truck details." en lugar de "Unable to load Yard Operations." (T7).
8. **Verificar.**
   - `npm run lint` y `npm test`.
   - e2e `admin-truck-detail.spec.ts`, `admin-truck-work-plan.spec.ts`,
     `ownership-cutover.spec.ts`, `blocker-lifecycle.spec.ts`,
     `yard-work-plan-board-cutover.spec.ts`.
   - `npm run ui-audit` en claro, oscuro, teléfono y escritorio.
   - `npm run test:real`.

**Selectores que deben seguir:**
- `data-testid`: `truck-next-step` (+ `data-kind`), `truck-details`, `truck-history`,
  `operational-counts`, `admin-blocker`, `work-plan-job-external`.
- Ids: `truck-work-plan-title`, `work-plan-add-work`, `assign-job-<id>`.

**Textos que leen las pruebas:**
- Encabezados: "Current Work" (**se elimina: actualizar la prueba**), "Work Plan",
  "Readiness", "Repair history".
- Botones: "Issues found", "No issues found", "Add {job}", "Add to Work Plan", "Add custom
  job", "Close Work Order", "Return to Service".
- La lista "Jobs in this Work Order" y el enlace `/Open Work Order: WO-…/` (cambia al chip:
  actualizar la prueba).

## 8. Notas de la maqueta

- Los datos son de demostración: VIN, dueño y ubicación inventados. No hay datos de producción.
- En el tema claro, el ámbar de texto usa `--warning-foreground` (`--warning` no se lee sobre
  claro). La maqueta de la WO se corrigió igual.
