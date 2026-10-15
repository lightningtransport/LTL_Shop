# 02 · Accesibilidad (color y tipografía) — Lightning Shop (web: Admin y espacios móviles)

**Fecha:** 2026-10-15 · **Alcance:** tokens de color (`globals.css`, claro y oscuro), componentes base (`ui.tsx`), chips de estado, avatares, formularios, foco y tipografía en todo `apps/web/src` · **Método:** solo código (sin navegador: otra sesión lo usa). Las relaciones de contraste se calcularon convirtiendo cada token OKLCH a sRGB y componiendo las mezclas `color-mix(... transparent)` sobre su fondo real, con la fórmula de luminancia relativa de WCAG 2.2 (script en el scratchpad de la sesión, `contrast.py`).
**Resumen:** 14 hallazgos, 1 de severidad 3. La base es buena: texto normal, texto secundario, errores, avisos, botones y deshabilitados pasan AA en los dos temas. Los fallos se concentran en tres patrones: (1) bordes de campos y controles casi invisibles (1,2:1), (2) azul primario sobre tintes azules por debajo de 4,5:1 (chip "In progress", chips seleccionados), y (3) estados que solo se distinguen por color (neumáticos de la inspección, barra de progreso del Work Order, enlaces dentro de texto).

## Tabla de contraste calculada (inferido del código)

Umbrales: texto 4,5:1 (todo el texto de la app es < 18,66 px negrita, así que no aplica el 3:1 de texto grande); componentes de interfaz y gráficos 3:1 (1.4.11). "Claro" usa `:root`; "Oscuro" usa `.dark`. Valores hex resultantes entre paréntesis.

### Texto

| Par (texto / fondo) | Dónde | Claro | Oscuro |
|---|---|---|---|
| `foreground` / `background` | Cuerpo | 16,88 ✅ | 17,06 ✅ |
| `foreground` / `card` · `muted` · `sunken` · `accent` | Tarjetas, hovers | 14,7–16,1 ✅ | 11,7–15,8 ✅ |
| `muted-foreground` / `background` | Texto secundario, placeholder | 5,99 ✅ | 6,96 ✅ |
| `muted-foreground` / `card` | Texto secundario en tarjeta | 5,73 ✅ | 5,71 ✅ |
| `muted-foreground` / `muted` | Botón deshabilitado, Badge secondary | 5,47 ✅ | 5,13 ✅ |
| `muted-foreground` / `accent` | Ghost en hover | 5,22 ✅ | 4,77 ✅ |
| `muted-foreground` / `muted/50` sobre card | Cabecera de `DataTable` | 5,60 ✅ | 5,42 ✅ |
| `primary` / `background` | Enlaces, acciones de texto | 5,14 ✅ | 8,33 ✅ |
| `primary` / `card` | Enlaces en tarjeta | 4,91 ✅ | 6,83 ✅ |
| `primary` / `accent` | Enlace con `hover:bg-accent` | **4,48 ❌** | 5,70 ✅ |
| `primary` / `primary/10` sobre background | `Badge default` ("In progress", "New", "Yours") | **4,47 ❌** | 7,02 ✅ |
| `primary` / `primary/10` sobre card | `Badge default` dentro de tarjeta | **4,28 ❌** | 5,65 ✅ |
| `primary` / `primary/15` sobre card | Chip seleccionado (Yard, Add work, QC) | **3,99 ❌** | 5,10 ✅ |
| `primary` / `primary/6` sobre card | `NextStepCallout tone="primary"` | 4,53 ✅ (justo) | 6,11 ✅ |
| `primary-foreground` / `primary` | `Button default` | 5,14 ✅ | 8,33 ✅ |
| `foreground` / `shop-accent` | Hover/foco de resultado en New Work Order | **2,83 ❌** | **2,05 ❌** |
| `destructive-foreground` / `destructive` | `Button destructive` | 5,14 ✅ | 9,58 ✅ |
| `destructive-text` / `background` · `card` | Errores | 6,62 / 6,33 ✅ | 8,49 / 6,96 ✅ |
| `destructive-text` / `destructive/10` | `InlineAlert` | 5,66 ✅ | 8,30 ✅ |
| `destructive-text` / `destructive/20` sobre card | `Badge destructive` (Critical, STOP) | 4,61 ✅ (justo) | 6,80 ✅ |
| `destructive` como texto | (no se usa; documentado como prohibido) | 5,38 | 1,78 ❌ |
| `success` / `background` · `card` | Texto de éxito | 6,15 / 5,88 ✅ | 7,62 / 6,24 ✅ |
| `success` / `success/10` sobre card | `Badge success` | 5,08 ✅ | 5,23 ✅ |
| `success` / `success/15` sobre card | Paso "done" del stepper | 4,71 ✅ | 4,76 ✅ |
| `warning-foreground` (claro) · `warning` (oscuro) / card | Texto de aviso | 9,73 ✅ | 8,37 ✅ |
| idem / `warning/10` sobre card | `Badge warning` | 9,00 ✅ | 6,79 ✅ |
| idem / `warning-surface` | Banners | 9,20 ✅ | 8,12 ✅ |
| `warning` como texto en claro | (no se usa sin par `dark:`) | 2,35 ❌ | 10,21 ✅ |
| `secondary-foreground` / `secondary` | Token definido, sin uso | 2,49 ❌ | 10,62 ✅ |
| Iniciales `sky`·`violet`·`rose`·`slate` -700/-300 sobre tinte /20 en card | `MechanicAvatar` | 4,63–7,75 ✅ | 6,35–7,97 ✅ |
| Iniciales `emerald` | idem | **4,37 ❌** | 6,84 ✅ |
| Iniciales `cyan` | idem | **4,29 ❌** | 7,09 ✅ |
| Iniciales `amber` | idem | **4,15 ❌** | 7,03 ✅ |
| `muted-foreground` con `opacity-60` sobre card | Job "ya planificado" en la lista de categoría | 2,52 ❌ | 3,00 ❌ |
| `global-error.tsx` `#57606a` / `#fff`; `#fff` / `#0a6cc2` | Pantalla de error global | 6,39 / 5,33 ✅ | — |

### Componentes de interfaz y gráficos (≥ 3:1)

| Par | Dónde | Claro | Oscuro |
|---|---|---|---|
| Borde de campo `--border` / `background` | `.field` (Input, Select, Textarea) | **1,23 ❌** | **1,72 ❌** |
| Borde de campo `--border` / `card` | Campo dentro de tarjeta | **1,18 ❌** | **1,41 ❌** |
| Casilla sin marcar `border-border` / `background` | `MultiSelect` | **1,23 ❌** | **1,72 ❌** |
| Interruptor apagado `muted-foreground/30` / card | "Part changed" en PM | **1,53 ❌** | **1,73 ❌** |
| Interruptor encendido `success` / card | idem | 5,88 ✅ | 6,24 ✅ |
| Anillo de foco `ring` / `background` · `card` · `muted` | `:focus-visible` global | 5,14 / 4,91 / 4,69 ✅ | 8,33 / 6,83 / 6,14 ✅ |
| Foco de 1 px `border-ring` frente al borde sin foco | Buscadores con `focus-within:border-ring` | 4,17 ✅ | 4,83 ✅ |
| Barra `success` / pista `muted-foreground/20` | Progreso Yard y WO | 4,46 ✅ | 4,37 ✅ |
| Segmento `warning` / pista | Bloqueados en la barra del WO | **1,70 ❌** | 5,87 ✅ |
| Punto `warning` / card | Leyenda "Watch", punto de bloqueo del mecánico | **2,24 ❌** | 8,37 ✅ |
| Punto `destructive` / card | Leyenda "Fix", fila de neumático | 5,14 ✅ | **1,46 ❌** |
| Borde de tile `destructive/50` / card | Neumático "Fix" | **2,31 ❌** | **1,12 ❌** |
| Borde de tile `warning/50` / card | Neumático "Watch" | **1,49 ❌** | 3,17 ✅ |
| Borde de tile `success/40` / card | Neumático "OK" | **1,88 ❌** | **2,16 ❌** |
| Enlace `primary` frente a texto `muted-foreground` | Enlace dentro de una línea secundaria | **1,17 ❌** | **1,20 ❌** |
| Enlace `primary` frente a texto `foreground` | Enlace dentro de texto normal | 3,29 ✅ | **2,05 ❌** |

Nota: los bordes de chips (`Badge`) y tarjetas tampoco llegan a 3:1, pero no lo necesitan: el chip se identifica por su texto y la tarjeta no es un control. Solo se reportan bordes de controles y de indicadores que portan el estado.

## Hallazgos

### Perceptible

### UX-2-001 · Los campos de texto casi no se ven en el teléfono
- **Dónde:** Todos los formularios (New Work Order, Add work, PM, inspección, Setup) · `apps/web/src/app/globals.css:224` (`.field` usa `border`, que toma `--border` de `globals.css:126`) · `--border`/`--input` en `globals.css:24-25` y `:101-102`
- **Evidencia:** (inferido del código) `.field { @apply ... border bg-background ... }` y `* { border-color: var(--border); }`. Borde frente al fondo: 1,23:1 (claro), 1,72:1 (oscuro); dentro de una tarjeta 1,18:1 y 1,41:1. El token `--input` existe pero ninguna clase lo usa (`border-input` tiene 0 usos) y además tiene el mismo valor que `--border`. Lo mismo pasa con la casilla de `MultiSelect` (`ui.tsx:334`).
- **Criterio:** WCAG 1.4.11 Contraste no textual (AA)
- **Severidad:** 2 · Frecuencia alta (cada campo), impacto medio: un mecánico de pie al sol en el teléfono no ve dónde tocar, aunque la etiqueta le orienta; persistente.
- **Recomendación:** Dar a `--input` un valor propio que llegue a 3:1 (calculado: claro `oklch(0.64 0.02 256)` = 3,2:1 sobre `card` y más sobre blanco; oscuro `oklch(0.55 0.035 257)` = 3,0:1 sobre `card` y 3,7:1 sobre el fondo), cambiar `.field` a `border-input` y dejar `--border` para separadores. Aplicar el mismo `border-input` a la casilla de `MultiSelect` y a las etiquetas de búsqueda con `focus-within:border-ring` (`admin-yard-operations.tsx:191`, `:240`, `mechanic-picker.tsx:51`, `category-job-list.tsx:65`).
- **Esfuerzo:** S

### UX-2-002 · "In progress" y los chips seleccionados no llegan a 4,5:1 en tema claro
- **Dónde:** `Badge default` · `apps/web/src/components/ui.tsx:188` (estado "In progress" del WO por `status-chips.ts:15`, chips "New", "Yours", "Proposed"); patrón de chip seleccionado `border-primary bg-primary/15 text-primary` en `admin-yard-operations.tsx:265` (filtros rápidos del Yard), `work-plan-add-work.tsx:333`, `category-job-list.tsx:90`, `quality-check-page.tsx:261`; `primary` sobre `hover:bg-accent` en `mechanic-trucks-page.tsx:62`
- **Evidencia:** (inferido del código) Texto 12 px medium `#0071bc` sobre `#e5f1f8` = 4,47:1 (sobre página) y sobre `#dfecf6` = 4,28:1 (dentro de tarjeta); chip seleccionado 14 px sobre `primary/15` = 3,99:1; `primary` sobre `accent` = 4,48:1. En oscuro todos pasan (5,1–7,0). La herramienta `npm run ui-audit` toma "el fondo sólido más cercano" (`e2e/ui-audit/audit.mjs:71`), así que no ve los tintes `color-mix(..., transparent)` y por eso no lo detectó.
- **Criterio:** WCAG 1.4.3 Contraste mínimo (AA)
- **Severidad:** 2 · Frecuencia alta (el estado más común de un WO y el filtro activo del Yard), impacto bajo-medio (queda cerca del umbral), persistente.
- **Recomendación:** Añadir un token de texto sobre tintes primarios (`--primary-text`: claro `oklch(0.48 0.14 248)` = 5,0:1 sobre `primary/15` en tarjeta; oscuro = `--primary`) y usarlo en `Badge default`, en los chips seleccionados y en `text-primary` sobre `accent`. Alternativa mínima: bajar el tinte a `bg-primary/5` (4,59:1 en tarjeta, 4,79:1 en página), que sigue justo.
- **Esfuerzo:** S

### UX-2-003 · El estado de cada neumático solo se ve por color
- **Dónde:** Inspección (`/qc`, Safety y mecánico) y tarjeta de neumáticos del Truck · `apps/web/src/components/inspection-sheet.tsx:724-731` (`TireButton`), `:823-826` (`MiniTires`), `:699` (punto de la fila), `:711-713` (leyenda), tonos en `:86-101`
- **Evidencia:** (inferido del código) `TireButton` muestra posición, PSI y huella; OK / Watch / Fix solo cambia el color del borde, el fondo y el número (`TIRE_TONE`, `TIRE_TEXT`). Su `aria-label={position}` reemplaza el contenido, así que el lector de pantalla tampoco oye el estado ni el PSI. `MiniTires` igual, con `title={position}`. Los bordes de los tiles llegan a 1,1–2,3:1; el punto "Fix" usa `bg-destructive`, que en oscuro es un rojo de relleno (`globals.css:98`) y queda a 1,46:1 sobre la tarjeta; el punto "Watch" queda a 2,24:1 en claro. Rojo/ámbar/verde es justo la combinación que confunde la deuteranopia y la protanopia.
- **Criterio:** WCAG 1.4.1 Uso del color (A) · 1.4.11 Contraste no textual (AA) · 4.1.2 Nombre, función, valor (A) para el `aria-label`
- **Severidad:** 3 · Frecuencia media (cada inspección), impacto alto: un neumático para cambiar puede pasar como "a vigilar" para quien no distingue rojo/ámbar, y es un dato de seguridad; persistente.
- **Recomendación:** Añadir un segundo signo en cada tile: icono (`Check`, `Eye`, `OctagonAlert`) o la palabra corta ("OK", "Vigilar", "Cambiar") bajo el PSI; `aria-label={`${position}: ${psi} PSI, ${estado}`}`. Usar `bg-destructive-text` para los puntos (no `bg-destructive`) y `bg-warning-foreground dark:bg-warning` para el punto "Watch".
- **Esfuerzo:** S

### UX-2-004 · La barra de progreso del Work Order separa "bloqueados" y "externos" solo por color
- **Dónde:** Work Order, franja de métricas · `apps/web/src/components/work-order-metrics.tsx:19-29`
- **Evidencia:** (inferido del código) Tres segmentos `bg-success`, `bg-warning`, `bg-primary/70`. El texto visible solo dice "3 of 5"; los bloqueados y los externos están únicamente en el `aria-label`. En claro el segmento ámbar queda a 1,70:1 sobre la pista.
- **Criterio:** WCAG 1.4.1 Uso del color (A) · 1.4.11 Contraste no textual (AA)
- **Severidad:** 2 · Frecuencia alta (cada WO), impacto bajo porque la tabla de Jobs repite "Blocked" con icono y texto; persistente.
- **Recomendación:** Mostrar la cuenta junto a "3 of 5": "· 1 blocked · 1 external" con el icono `OctagonPause`/`Building2` (solo cuando > 0), y oscurecer el segmento ámbar en claro (`bg-warning-foreground/70` o un borde de 1 px).
- **Esfuerzo:** S

### UX-2-005 · El interruptor "Part changed" del PM apagado no se distingue del fondo
- **Dónde:** PM, servicio por categoría (`/mechanic/pm`) · `apps/web/src/components/pm-service-card.tsx:447-449`
- **Evidencia:** (inferido del código) Pista apagada `bg-muted-foreground/30` = 1,53:1 (claro) y 1,73:1 (oscuro) frente a la tarjeta; el pomo es `bg-white` fijo, que en claro casi no contrasta con la tarjeta `#f8fafc`.
- **Criterio:** WCAG 1.4.11 Contraste no textual (AA)
- **Severidad:** 2 · Frecuencia alta para el mecánico PM (varias categorías por servicio), impacto medio (no ve que hay un control hasta tocarlo); persistente.
- **Recomendación:** Pista apagada `bg-muted-foreground/75` (3,4:1 en claro; `/60` no basta: 2,5:1) o un borde `border-input`; pomo `bg-background` con `ring-1 ring-border`.
- **Esfuerzo:** S

### UX-2-006 · Enlaces dentro de texto que solo se reconocen por el color
- **Dónde:** Banner de fallas del Truck `apps/web/src/components/admin-truck-faults.tsx:138` (enlace "See codes" del mismo color que el banner); Dashboard, línea de QC `admin-dashboard.tsx:274` (enlace en texto secundario); patrón general `text-primary hover:underline` dentro de líneas de texto
- **Evidencia:** (inferido del código) En el banner, el enlace hereda `text-destructive-text`/`text-warning-foreground` y solo cambia a `font-medium`. Un enlace `primary` dentro de texto `muted-foreground` contrasta 1,17:1 con el texto que lo rodea (oscuro 1,20:1); dentro de texto normal en oscuro, 2,05:1. El subrayado aparece solo con hover, que no existe en el teléfono.
- **Criterio:** WCAG 1.4.1 Uso del color (A)
- **Severidad:** 2 · Frecuencia media, impacto medio (no sabe que puede tocar para ver los códigos); persistente.
- **Recomendación:** Los enlaces dentro de una frase llevan `underline underline-offset-2` siempre. Los enlaces sueltos (número de Truck en una lista, columna propia) pueden seguir sin subrayado.
- **Esfuerzo:** S

### UX-2-007 · El resultado resaltado al buscar un Truck en New Work Order se vuelve ilegible
- **Dónde:** New Work Order, resultados de búsqueda de Truck · `apps/web/src/app/work-orders/new/page.tsx:334`
- **Evidencia:** (inferido del código) `variant="ghost"` + `hover:bg-shop-accent focus:bg-shop-accent` pinta el fondo azul sólido sin cambiar el texto: `foreground` sobre `shop-accent` = 2,83:1 (claro) y 2,05:1 (oscuro, texto claro sobre azul claro). Es un resto del azul `shop-accent` que la Stage 8 quitó de los chips.
- **Criterio:** WCAG 1.4.3 Contraste mínimo (AA), en estado hover/foco
- **Severidad:** 2 · Frecuencia media (cada WO nuevo con ratón o teclado), impacto medio (no lee la fila que va a elegir); persistente.
- **Recomendación:** `hover:bg-accent focus:bg-accent` y `aria-selected:bg-accent` (como `ResponsiveMenu`), o mantener `bg-primary` y añadir `hover:text-primary-foreground`.
- **Esfuerzo:** S

### UX-2-008 · Tres colores de avatar no llegan a 4,5:1 en tema claro
- **Dónde:** `MechanicAvatar` (Truck, WO, Yard, Shop workflow) · `apps/web/src/lib/mechanic-tone.ts:17-21`, `apps/web/src/components/mechanic-avatar.tsx:14`
- **Evidencia:** (inferido del código) Iniciales 12 px semibold sobre tinte `-500/20` en tarjeta: emerald 4,37:1, cyan 4,29:1, amber 4,15:1. El comentario del archivo y `foundations.md` dicen "AA in both themes". En oscuro todos pasan (≥ 6,3).
- **Criterio:** WCAG 1.4.3 Contraste mínimo (AA)
- **Severidad:** 1 · El avatar es decorativo (el nombre siempre está al lado o en una etiqueta), así que el impacto es bajo.
- **Recomendación:** Usar `-800` en claro para esos tres tonos (`text-emerald-800` 6,1:1, `text-cyan-800` 5,8:1, `text-amber-800` 5,9:1) o para todos, por uniformidad, y corregir la frase en `foundations.md`.
- **Esfuerzo:** S

### UX-2-009 · Información de estado a 12 px en las pantallas del teléfono
- **Dónde:** Tarjeta del Yard, línea de alerta (Blocked, Paused, Out of shop, Leaves) `apps/web/src/components/admin-yard-operations.tsx:389-397`; línea de bloqueo del Job del mecánico `mechanic-home.tsx:170`; códigos de falla en Add work `work-plan-add-work.tsx:427`; todas las insignias (`Badge`, `ui.tsx:183-186`)
- **Evidencia:** (inferido del código) 385 usos de `text-xs` (12 px) frente a 350 de `text-sm`; 271 de ellos con `text-muted-foreground`. La escala define 12 px para "meta (fechas, cuentas)", pero también lleva el estado que decide la acción: por qué está parado el Truck, qué Job está bloqueado, el estado del WO. Line-height de Tailwind para 12 px: 16 px (1,33).
- **Criterio:** Buena práctica de legibilidad (WCAG 2.2 AA no fija tamaño mínimo; relacionado con 1.4.4 Cambio de tamaño del texto) · Nielsen H1 Visibilidad del estado
- **Severidad:** 2 · Frecuencia alta para mecánicos y Safety de pie con el teléfono, impacto medio (lectura más lenta, errores de lectura); persistente.
- **Recomendación:** Regla en `foundations.md`: "el estado que decide una acción va a 14 px" (`text-sm`). Pasar a `text-sm` la línea de alerta del Yard, la línea de bloqueo del mecánico y las insignias de estado en las pantallas `/mechanic/*` y `/qc` (`Badge` con `size="md"` = `text-sm`). Mantener 12 px para fechas, cuentas y metadatos.
- **Esfuerzo:** M

### UX-2-010 · Texto importante cortado sin forma de leerlo completo
- **Dónde:** Número de Truck en la tarjeta del Yard `apps/web/src/components/admin-yard-operations.tsx:381`; nota de cierre en Completed del mecánico `mechanic-completed-page.tsx:86`; códigos de falla "From: …" `work-plan-add-work.tsx:427`; números de Truck en Dispatch `admin-yard-data-boundary-cards.tsx:302-303` (`w-16 truncate`); nombre del miembro en Shop workflow `admin-shop-workflow.tsx:290`
- **Evidencia:** (inferido del código) `truncate` sin `title` ni otra vía de ver el texto completo (51 `truncate` en total; los citados llevan el dato principal de la fila). Con zoom de texto al 200 % (1.4.4) el corte crece. El dueño ya reportó placeholders cortados ("Truck, Work Order or mechani…"), que se tratan en el archivo de responsive.
- **Criterio:** WCAG 1.4.4 Cambio de tamaño del texto (AA) · 1.4.10 Reflow (AA)
- **Severidad:** 2 · Frecuencia media (nombres y notas largas, números de Truck con prefijo), impacto medio; persistente.
- **Recomendación:** El dato principal de una fila no se trunca: `break-words` o `line-clamp-2` para notas y códigos; el número de Truck con `min-w-fit`; donde el corte sea inevitable, `title` y el texto completo al abrir el detalle.
- **Esfuerzo:** M

### UX-2-011 · Las iniciales "MPM" no caben en el avatar
- **Dónde:** Shop workflow y listas con `MechanicAvatar size="sm"` · `apps/web/src/components/mechanic-avatar.tsx:9,14`
- **Evidencia:** (inferido del código) Círculo de 24 px (`size-6`) con texto 12 px semibold; tres letras ocupan ≈ 25–27 px. Coincide con el reporte del dueño (00-contexto §6).
- **Criterio:** Legibilidad tipográfica · WCAG 1.4.12 Espaciado del texto (AA) (sin margen para ajustes de espaciado)
- **Severidad:** 1 · El nombre está al lado; es un defecto visual.
- **Recomendación:** Que el avatar muestre 2 letras como máximo (por ejemplo "MP"); bajar la letra a 11 px rompería la regla de 12 px de `foundations.md`.
- **Esfuerzo:** S

### UX-2-012 · Texto por debajo de 12 px en la inspección
- **Dónde:** Posición del neumático en `TireButton` `apps/web/src/components/inspection-sheet.tsx:727` (`text-[11px]`); panel de demo `demo-panel.tsx:170,196,274,401` (`text-[10px]`/`[11px]`, mayúsculas)
- **Evidencia:** (inferido del código) `foundations.md` dice "Nothing under 12px. No `text-[10px]` / `text-[11px]`". La etiqueta de posición (p. ej. "LF", "R2O") es la que identifica el neumático.
- **Criterio:** Regla propia del sistema de diseño (LTR-166) · legibilidad
- **Severidad:** 1 · Etiquetas cortas y en negrita; el panel de demo no lo ve el usuario final.
- **Recomendación:** `text-xs` en `TireButton`; en el panel de demo, `text-xs` sin `uppercase`.
- **Esfuerzo:** S

### Operable

### UX-2-013 · Al elegir un archivo de factura con teclado no se ve dónde está el foco
- **Dónde:** Outside repair, Purchase y diálogo de factura · `apps/web/src/components/admin-outside-repair-form.tsx:277-280`, `admin-purchase-form.tsx:528`, `admin-invoice-file-dialog.tsx:80`; mismo patrón en `MultiSelect` `ui.tsx:316-328` (hoy sin uso)
- **Evidencia:** (inferido del código) `<input type="file" className="sr-only">` dentro de un `<label>` que no tiene `focus-within:`. El anillo global de `:focus-visible` (`globals.css:153`) se dibuja alrededor de un input de 1 px recortado, así que no se ve. Además el buscador de mecánicos anula el anillo con `focus-visible:outline-none` (`mechanic-picker.tsx:59`) y solo cambia el borde de 1 px (4,17:1, visible pero débil).
- **Criterio:** WCAG 2.4.7 Foco visible (AA)
- **Severidad:** 2 · Frecuencia baja (flujos de compras del Manager con teclado), impacto alto para quien usa teclado (no sabe qué va a activar); persistente.
- **Recomendación:** En la etiqueta: `has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring has-[:focus-visible]:outline-offset-2` (o `focus-within:ring-2 focus-within:ring-ring`). En `mechanic-picker.tsx:51` usar `focus-within:ring-2 focus-within:ring-ring` en vez de solo el borde.
- **Esfuerzo:** S

### Comprensible

### UX-2-014 · La escala tipográfica documentada no coincide con la CSS
- **Dónde:** `docs/design-system/foundations.md` (tabla "Type scale") frente a `apps/web/src/app/globals.css:234-239`
- **Evidencia:** (inferido del código) El documento dice `.page-title` "24px bold, 30px from md" y `.section-title` "18px semibold"; la CSS aplica `text-2xl font-semibold md:text-[28px]` y `text-base` (16 px). La sección "Stage 8" del mismo archivo sí dice 24/28 semibold y 16 px.
- **Criterio:** Consistencia del sistema de diseño (Nielsen H4)
- **Severidad:** 1 · Afecta a quien construye pantallas nuevas, no al usuario.
- **Recomendación:** Actualizar la tabla a los valores reales (24/28 px semibold, 16 px, 16 px, 14 px) y añadir la regla de UX-2-009.
- **Esfuerzo:** S

### UX-2-015 · En "Add to team" cada casillero se anuncia como "on", sin el nombre de la persona
- **Dónde:** Setup → Shop workflow → Add to team · `apps/web/src/components/admin-shop-workflow.tsx` (`AddMemberDialog`, `<label>` que envuelve `input type="checkbox"`, avatar, nombre y conteo)
- **Evidencia:** el árbol de accesibilidad muestra `checkbox "on"` para las 4 personas (observado, `read_page` en http://127.0.0.1:3041/admin/setup/workflow).
- **Criterio:** WCAG 4.1.2 (nombre, función y valor) · 1.3.1 (información y relaciones)
- **Severidad:** 2 · Con lector de pantalla o control por voz no se sabe a quién se agrega.
- **Recomendación:** `aria-label={person.name}` en el checkbox, o `id` en el checkbox y `htmlFor` en el label con el texto del nombre. Revisar el mismo patrón en los otros selectores con checkbox.
- **Esfuerzo:** S

## Tabla de cobertura (criterios revisados)

| Criterio WCAG 2.2 | Nivel | Resultado |
|---|---|---|
| 1.4.1 Uso del color | A | No cumple (UX-2-003, 004, 006) |
| 1.4.3 Contraste mínimo | AA | No cumple en casos puntuales (UX-2-002, 007, 008); texto base, secundario, errores, avisos y deshabilitados cumplen |
| 1.4.4 Cambio de tamaño del texto | AA | No verificado en navegador; riesgo por truncado (UX-2-010) |
| 1.4.10 Reflow | AA | No verificado aquí (archivo de responsive) |
| 1.4.11 Contraste no textual | AA | No cumple (UX-2-001, 003, 004, 005); anillo de foco cumple |
| 1.4.12 Espaciado del texto | AA | No verificado; riesgo en avatares y chips de altura fija |
| 2.4.7 Foco visible | AA | Cumple en general (anillo global 2 px, ≥ 4,7:1); no cumple en selectores de archivo (UX-2-013) |
| 2.4.11 Foco no oculto (mínimo) | AA | No verificado (requiere navegador: cabeceras fijas y barra inferior) |
| 2.3.3 / animaciones | AAA (referencia) | Cumple: todas las animaciones respetan `prefers-reduced-motion` |

## Lo que funciona bien
- Los pares de texto principales pasan AA con margen en los dos temas: cuerpo 16,9:1, texto secundario 5,1–7,0:1, errores con `destructive-text` 5,7–8,5:1, avisos 6,8–10,2:1. El token `--destructive-text` resolvió el 1,78:1 de `text-destructive` en oscuro y nadie usa ya `text-destructive` como texto.
- El aspecto deshabilitado único (`bg-muted text-muted-foreground`, 5,5:1 / 5,1:1) se lee en los dos temas, en vez de un botón "lavado" con opacidad (LTR-169).
- El anillo de foco global (`:focus-visible`, 2 px `--ring`, offset 2 px) contrasta ≥ 4,7:1 sobre todas las superficies y gana a los `outline-none` de utilidades por orden de cascada; los campos lo muestran.
- Los campos son de 16 px en todas las pantallas (sin zoom en iOS) y la regla "nada bajo 12 px, sin mayúsculas" se cumple en casi toda la app de producción.
- Los chips de estado combinan punto, texto y a menudo icono (`OctagonPause` para bloqueado, `OctagonAlert` para STOP): el estado no depende solo del color en chips y filas de Jobs. Todas las animaciones se apagan con movimiento reducido.

## Fuera de alcance / no verificado
- Todo el archivo está **(inferido del código)**: no se usó el navegador. Las relaciones se calcularon desde los tokens; el render real (antialiasing de Inter, mezcla de `color-mix` por el navegador, imágenes) debe comprobarse en el navegador en claro y oscuro, en especial los casos justos (4,47; 4,53; 4,61) y los tintes que `npm run ui-audit` no mide.
- No se recorrió la app con teclado ni lector de pantalla; solo se revisaron foco, color y tipografía (resto de WCAG en otras auditorías).
- 2.4.11 Foco no oculto, 1.4.10 Reflow y 1.4.12 Espaciado del texto requieren el navegador.
- Landing y demo publicada quedan fuera (00-contexto §5); el panel de demo local se menciona solo por la regla de 12 px.
