# 07 · Formularios e interacción — Lightning Shop, modo demo

**Fecha:** 2026-10-10 · **Alcance:** los controles propios del modo demo (`/login` con "Enter demo mode"; en el panel, el selector de historia, la casilla de auto-follow, los botones de cuenta y de paso) revisados completos; los formularios del producto que el guion hace rellenar (New Work Order, Add work, Resolve, Complete job, Request Work, Return to Service, Add to team / Save steps, Take/Approve) por muestreo durante el ensayo · **Método:** código (`login/page.tsx`, `demo-panel.tsx`, `demo-context.tsx`, `admin-shop-workflow.tsx`) + navegador.
**Resumen:** 5 hallazgos, 1 de severidad 3. El formulario con más fricción es la entrada: "Enter demo mode" con el correo vacío enciende el modo y después falla con un mensaje que habla de otra cosa. No hay riesgo de doble envío ni de pérdida de datos en los formularios del producto que recorre la demo: todos confirman, deshabilitan al enviar y conservan lo escrito.

## Inventario de formularios

| Formulario | Ruta | Flujo | Patrón | Revisado |
|---|---|---|---|---|
| Sign in + Dev login + Enter demo mode | `/login` | 1 | `<form onSubmit>` nativo, estado local, `InlineAlert` | completo |
| Selector de historia, auto-follow, cuentas, Back/Next | panel | 8 | controles nativos (`Select`, checkbox) + botones | completo |
| New Work Order (diálogo) | Truck → "New Work Order" | 2 | `Modal` + estado local | muestreo (ensayo) |
| Add work (hoja) | Truck → "Issues found" / "Add work" | 2 | hoja con categoría, buscador, custom job, "Who does it?" | muestreo (ensayo) |
| Resolve (nota opcional) | Truck / WO → Resolve | 3 | formulario en línea, "Confirm resolve" | muestreo (ensayo) |
| Complete job (nota) · Report blocker · Request Work · Add note | `/work-orders/[id]` | 3 | hojas con nota, borrador en el teléfono (`local-draft.ts`) | muestreo (ensayo) |
| PM: millaje, piezas, Finish | `/work-orders/[id]?view=pm` | 4 | guardado automático, barra fija con lo que falta | muestreo (ensayo) |
| Take / Approve (confirmación) / Return (nota) | `/qc` | 5 | hoja + `Modal` de confirmación | muestreo (ensayo) |
| Close Work Order · Return to Service | WO / Truck | 5 | `Modal` de confirmación | muestreo (ensayo) |
| Add to team + Save steps | `/admin/setup/workflow` | 7 | diálogo + botón Guardar con guard de cambios sin guardar | muestreo (ensayo) |
| Add person | `/admin/mechanics` | 7 | diálogo | no provocado (opcional en el guion) |

## Hallazgos

### Sistémicos
- El patrón de formulario del producto (confirmación en `Modal`, botón deshabilitado durante el envío, borradores en el teléfono, resumen de faltantes) está bien resuelto y ya fue auditado en `admin-setup/07-formularios.md` y `mecanico-general/07-formularios.md`. No hay hallazgo sistémico nuevo.

### `/login` · Enter demo mode

### UX-7-001 · "Enter demo mode" con el correo vacío enciende el modo y falla con un mensaje equivocado
- **Dónde:** `apps/web/src/app/login/page.tsx:80-83` (`writeDemoState({... enabled: true ...})` antes de `onDevLogin()`), `:76-86` (el error cae en `messages.accountNotConfigured`)
- **Evidencia:** (observado) correo vacío + "Enter demo mode" → `InlineAlert` "Your account is not configured for the Shop application." y `localStorage.ltl_shop_demo.enabled = true` aunque no se entró. Pasos: vaciar Email, tocar el botón.
- **Criterio:** Validación antes de enviar; el estado solo cambia cuando la acción tuvo éxito; el error dice la causa real
- **Severidad:** 3 · Es la puerta de la demo; el mensaje manda al presentador a buscar un problema de cuenta que no existe.
- **Recomendación:** Validar el correo en el cliente (vacío o sin "@": "Type the demo account email, for example ms@lightning.local", junto al campo) antes de llamar; escribir el estado de la demo **después** de que `loginDev` resuelva; si el correo no existe, "No account with this email in the demo database. Use one of the demo accounts."
- **Esfuerzo:** S

### UX-7-002 · Enter en el campo de correo intenta el login con contraseña, no la demo
- **Dónde:** `login/page.tsx:103` (`<form onSubmit={onSubmit}>`; "Enter demo mode" es `type="button"`)
- **Evidencia:** (observado) con el correo escrito y la contraseña vacía, Enter dispara la validación nativa de `required` en Password; el presentador tiene que bajar al cuarto botón.
- **Criterio:** Enter envía la acción principal del contexto
- **Severidad:** 1 · Sucede una vez por demo.
- **Recomendación:** En builds locales, cuando el campo de contraseña está vacío y hay correo, Enter ejecuta Dev login; o un enlace `/login?demo=1` que preseleccione la cuenta MS y muestre un solo botón grande "Start the demo as MS · Manager Shop".
- **Esfuerzo:** S

### Panel · controles

### UX-7-003 · El selector de historia cambia de cuenta y de pantalla al instante, sin paso intermedio
- **Dónde:** `demo-panel.tsx:154-158` (`onChange` → `selectStory` → `openStep` → `switchTo`)
- **Evidencia:** (observado) elegir una historia cuyo primer paso es de otra cuenta recarga la página en el acto; con el teclado, recorrer las opciones con las flechas en Safari/Firefox dispara `change` en cada una.
- **Criterio:** Las acciones con efecto grande (recarga, cambio de identidad) se confirman o se separan de la selección
- **Severidad:** 2 · En Chrome con ratón no molesta; con teclado o en el teléfono (picker nativo) puede saltar a la cuenta equivocada.
- **Recomendación:** Elegir la historia muestra la tarjeta del paso 1 sin navegar; un botón "Start" (primario) ejecuta el cambio. Con el flujo de capítulos (PR C) este "Start" es el mismo que el de cada capítulo.
- **Esfuerzo:** S

### UX-7-004 · La casilla de auto-follow afecta a Next pero está debajo y lejos de él
- **Dónde:** `demo-panel.tsx:209-217`
- **Evidencia:** (observado) la casilla queda fuera de la tarjeta, bajo el aviso de las 5 PM; su efecto solo se nota al tocar Next.
- **Criterio:** Los controles que cambian el comportamiento de un botón están junto a él
- **Severidad:** 1
- **Recomendación:** Dentro de la tarjeta, bajo Back/Next: "☑ Follow each step (switch account and open the screen)".
- **Esfuerzo:** S

### Producto · Shop workflow

### UX-7-005 · "Add to team" aplica el cambio en pantalla pero no lo guarda hasta "Save steps"
- **Dónde:** `admin-shop-workflow.tsx:236-237` (Save deshabilitado si no hay cambios; aviso `shopWorkflowUnsaved`), `:97-98` (`useUnsavedChangesGuard`)
- **Evidencia:** (observado en el ensayo) tras "Add to team" la fila dice "New PM Jobs are assigned to Daniel" antes de guardar; el botón "Save steps" está al final de la página. El guard de cambios sin guardar existe (pregunta antes de salir). En una demo, con el panel navegando solo al siguiente paso, el `beforeunload` corta el flujo con un diálogo del navegador.
- **Criterio:** El estado "aplicado pero no guardado" debe verse donde se hizo el cambio
- **Severidad:** 2 · En el taller el Manager lo guarda; en la demo el presentador puede olvidar y el guard lo frena con un diálogo nativo.
- **Recomendación:** Tras "Add to team", el aviso "Not saved yet · Save steps" en la misma fila; el guion de HU-M8 recuerda "Save steps" si se agregó a alguien.
- **Esfuerzo:** S

## Lo que funciona bien
- Confirmaciones con contenido en las acciones que cambian estado: "Close WO-076?", "Approve Truck 616?", "Return Truck 607 to service", "Complete Alignment? This is your last Job here: your clock stops."
- Las notas que se escriben y no se envían quedan en el teléfono (Complete job, Request Work, Return) y el PM guarda millaje y piezas solos con "Saved automatically".
- Add work resume lo que falta ("Add at least one Job") y "Who does it?" solo lista a quien puede hacer ese Job.
- Los botones del panel se deshabilitan mientras hay una acción en curso (`busy`): no hay doble envío.

## Fuera de alcance / no verificado
- Add person (opcional en el guion) y los formularios de Parts & costs: auditados en `admin-setup`.
- Teclado completo en el panel (Tab/Esc): no se probó con lector de pantalla; el panel usa controles nativos.
