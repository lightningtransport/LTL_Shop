# 04b · Color semántico — Lightning Shop (web: Admin y espacios móviles)

**Fecha:** 2026-10-15 · **Alcance:** roles de color del sistema de diseño (`globals.css`, `tailwind.config.js`, `foundations.md`) y cómo se pintan los estados del taller en todas las pantallas de `apps/web/src` · **Método:** solo código (sin navegador).
**Resumen:** 10 hallazgos, ninguno de severidad 3-4. La disciplina es alta: fuera de los avatares no hay ni una clase de la paleta cruda de Tailwind (`text-red-*`, `bg-amber-*`…), y casi todos los estados pasan por `Badge` y `status-chips.ts`. Los problemas son de significado, no de implementación: el azul primario y el ámbar `warning` cargan demasiados significados, "Ready to close" sale en ámbar y en azul en la misma pantalla, faltan los roles `info` y `-foreground`/`-text` simétricos, y sigue viva una segunda familia de tokens (`--shop-*`) con valores que ya no coinciden.

## Roles definidos hoy frente a un estándar

Referencia: shadcn/ui y Radix Themes (cada rol con su par `-foreground`), Material 3 (`primary`, `secondary`, `error` + `on-*`, `*-container`) y la convención habitual de estados (neutral, info, success, warning, danger).

| Rol estándar | ¿Existe? | Token(s) actual(es) | Observación |
|---|---|---|---|
| background / foreground | Sí | `--background`, `--foreground` | Bien |
| card, popover | Sí | `--card`, `--popover` (+ `-foreground`) | `popover` no se usa (Stage 8 usa `card` para menús) |
| primary (+ fg) | Sí | `--primary`, `--primary-foreground` | Además es enlace, "en curso", "info" y "seleccionado" (UX-4-101) |
| secondary (+ fg) | Definido, sin uso | `--secondary` verde (`globals.css:15`) | Documentado como "success-leaning"; blanco sobre él da 2,49:1; 0 usos |
| muted (+ fg) | Sí | `--muted`, `--muted-foreground` | Bien |
| accent (+ fg) | Sí | `--accent`, `--accent-foreground` | Rol de hover/selección, como en shadcn; `accent-foreground` sin uso |
| destructive / danger | Sí | `--destructive` (relleno), `--destructive-foreground`, `--destructive-text` | Tres nombres; el par "texto sobre tinte" se llama `-text` |
| success | Parcial | `--success` | Sin `-foreground`, sin `-surface`, sin `-text` |
| warning | Sí | `--warning`, `--warning-foreground`, `--warning-surface` | `-foreground` aquí significa "texto sobre tinte claro", no "texto sobre relleno" (al revés que `destructive-foreground`) |
| info | **No** | — | Se usa `primary` o `shop-accent` en su lugar |
| neutral | Implícito | `muted` / `outline` | Bien como "neutral" |
| border, input, ring | Sí | `--border`, `--input`, `--ring` | `--input` sin uso e igual a `--border` (ver UX-2-001) |
| Familia paralela | Sí (no debería) | `--shop-bg`, `--shop-panel`, `--shop-border`, `--shop-accent`, `--shop-accent-dark`, `--shop-muted`, `--shop-danger`, `--shop-success` | Ver UX-4-107 |

## Mapa: estado → token → dónde → ¿consistente?

| Estado / significado | Token(s) usado(s) | Dónde (archivo:línea) | ¿Consistente? |
|---|---|---|---|
| WO Created | `outline` (neutral) | `lib/status-chips.ts:14` | Sí |
| WO In progress | `default` = primary azul | `status-chips.ts:15`; `text-primary` en `admin-truck-detail.tsx:474`; Job "In progress" `default` en `app/work-orders/[id]/detail-client.tsx:795` | Sí entre sí; pero azul también = acción, enlace, info (UX-4-101) |
| Reloj corriendo / labor running | `success` verde | `mechanic-home.tsx:221`, `mechanic-clock-strip.tsx:58-61`, `detail-client.tsx:302` | No: "en curso" es azul en el WO y verde en el reloj (UX-4-104) |
| WO Paused (waiting_paused) | `warning` | `status-chips.ts:16`; `admin-truck-detail.tsx:475`; Yard `admin-yard-operations.tsx:366` | Sí |
| Blocked (Job o paso) | `warning` + `OctagonPause` | `admin-job-table.tsx:254`, `admin-truck-work-plan.tsx:247`, `admin-dashboard.tsx:31`, `truck-stepper.tsx:38`, `mechanic-home.tsx:163,170`, `detail-client.tsx:793` | Sí; igual color que Paused y High (UX-4-103) |
| Completed (WO / Job) | `success` | `status-chips.ts:17,23` | Sí |
| Cancelled | `secondary` (neutral gris) | `status-chips.ts:18,24` | Sí |
| Job To do | `outline` (admin) / `secondary` "Pending" (mecánico) | `status-chips.ts:22`, `admin-job-table.tsx:256`; `detail-client.tsx:796` | No (UX-4-106) |
| Priority Low / Normal | `secondary` / `outline` | `status-chips.ts:28-29` | Sí |
| Priority High | `warning` | `status-chips.ts:30` | Sí; mismo color que Paused/Blocked |
| Priority Critical | `destructive` | `status-chips.ts:31` | Sí |
| Falla STOP (Samsara) | `destructive` + `OctagonAlert` | `lib/samsara-view.ts:19`, `admin-truck-faults.tsx:133`, `work-plan-fault-recommendations.tsx:47` | Sí |
| Falla Warning / Check engine | `warning` | `samsara-view.ts:19`, `work-plan-fault-recommendations.tsx:49-50`, `admin-new-work-order.tsx:313` | Sí |
| Pasos obligatorios faltantes | `destructive` | `truck-stepper.tsx:40`, `admin-dashboard.tsx:36` | Sí |
| Needs evaluation | `warning` | `status-chips.ts:35` | Sí, pero es "le toca al Manager", no un riesgo (UX-4-103) |
| Fases intermedias (Inspection, PM, Alignment, Detailing, QC) | `outline` | `status-chips.ts:36-41` | Sí |
| Waiting for Safety / QC | `muted-foreground` / `outline` / `waiting` gris | `admin-dashboard.tsx:37`, `status-chips.ts:41`, `truck-stepper.tsx:44` | Sí (neutral) |
| Ready for approval | `warning` | `status-chips.ts:42` | Sí, mismo comentario que Needs evaluation |
| **Ready to close** | `warning` (chip de fase y chip del Truck) / `primary` (stepper, Dashboard, callout del WO) / `shop-accent/10` (aviso en la tarjeta de WO) | `status-chips.ts:45`; `admin-truck-detail.tsx:162`; `truck-stepper.tsx:42`; `admin-dashboard.tsx:32`; `work-order-next-step.tsx:204`; `admin-work-order-item.tsx:83` | **No** (UX-4-102) |
| Not ready (Truck) | `warning` | `admin-truck-detail.tsx:163` | Sí |
| Ready to Go / In service | `success` | `status-chips.ts:43`; `admin-truck-detail.tsx:161,164`; `admin-dashboard.tsx:33`; `admin-trucks-list.tsx:178` | Sí |
| External (taller de afuera) | `primary` | `truck-stepper.tsx:39`, `admin-job-table.tsx:252`, `work-order-metrics.tsx:27` | Sí entre sí; azul como "info" |
| Out of shop (Yard) | `primary` (texto de alerta) | `admin-yard-operations.tsx:366,391` | Azul como "info"; sin token propio |
| Nadie asignado (Yard) / Unassigned (Dashboard) | `primary` | `admin-yard-operations.tsx:391`; `admin-dashboard.tsx:34` | Sí; azul como "info/acción" |
| Leaving soon con trabajo pendiente | `warning` | `admin-dashboard.tsx:123-125,260`, `admin-yard-operations.tsx:366`, `quality-check-page.tsx:462` | Sí |
| Inactive (Truck, mecánico, parte, catálogo) | `secondary` (neutral) en listas / `warning-surface` en el banner del Truck / `text-warning-foreground` en Shop workflow | `admin-trucks-list.tsx:110`, `admin-mechanics-list.tsx:115`, `admin-catalog-manage.tsx:218`; `admin-truck-admin.tsx:602`; `admin-shop-workflow.tsx:161` | Parcial (UX-4-105) |
| Neumático OK / Watch / Fix | `success` / `warning` / `destructive` (`bg-destructive` en puntos) | `inspection-sheet.tsx:86-101` | Sí en tono; los puntos usan el relleno `destructive` que en oscuro es casi negro (UX-2-003) |
| GPS desactualizado | `text-warning-foreground` | `admin-trucks-list.tsx:211` | Sí |
| Seleccionado (chip, filtro) | `border-primary bg-primary/15 text-primary` | `admin-yard-operations.tsx:265`, `work-plan-add-work.tsx:333`, `category-job-list.tsx:90`, `quality-check-page.tsx:261` | Sí; contraste justo (UX-2-002) |
| "New" / "Yours" / "Proposed" | `Badge default` (primary) | `inspection-sheet.tsx:870`, `quality-check-page.tsx:343`, `admin-trucks-list.tsx:112` | Mismo aspecto que "In progress" (UX-4-101) |
| En vivo (Yard, Dashboard) | punto `success` animado | `admin-yard-operations.tsx:155-156`, `admin-dashboard.tsx:82-83` | Verde = "completado" y "vivo" (UX-4-104) |
| Error de formulario / carga | `destructive-text` sobre `destructive/10` | `ui.tsx:162-178` (`InlineAlert`), `ui.tsx:1132` (`LoadFailure`) | Sí |
| Next step (callout) | `warning` · `primary` · `success` · `muted` · `danger` | `next-step-callout.tsx:9-15` | Sí como componente; el tono lo elige cada pantalla sin tabla común |

## Hallazgos

### UX-4-101 · El azul primario significa seis cosas distintas
- **Dónde:** `apps/web/src/lib/status-chips.ts:15` (In progress), `ui.tsx:188` (`Badge default`), `admin-yard-operations.tsx:391` (Out of shop, nadie asignado), `truck-stepper.tsx:39,42` (External, Ready), `admin-dashboard.tsx:32-35` (Close, Assign, Inspect), `inspection-sheet.tsx:870` ("New"), `quality-check-page.tsx:343` ("Yours"), además de todos los botones primarios y enlaces (`text-primary`, 94 usos)
- **Evidencia:** (inferido del código) El mismo azul es: acción principal, enlace, estado "en curso", aviso informativo ("Out of shop"), "seleccionado" y etiqueta de novedad. En una tarjeta del Yard, "Out of shop" (azul) se lee igual que un enlace; en el WO, el chip "In progress" se ve igual que "New" o "Yours". No hay rol `info`.
- **Criterio:** Nielsen H4 Consistencia y estándares · convención de roles semánticos (shadcn/Material: `primary` es acción, el estado informativo es `info`)
- **Severidad:** 2 · Frecuencia alta (todas las pantallas), impacto medio: el Manager no sabe si el azul es algo que tocar, algo que pasa o algo nuevo; persistente.
- **Recomendación:** Añadir `--info`, `--info-text`, `--info-surface` (puede ser el mismo tono que primary pero con nombre propio, o un azul-violeta distinto como `oklch(0.52 0.12 265)` para separarlo de las acciones) y moverle: In progress, External, Out of shop, "New/Yours/Proposed". `primary` queda para acciones, enlaces y "seleccionado".
- **Esfuerzo:** M

### UX-4-102 · "Ready to close" sale en ámbar y en azul en la misma pantalla
- **Dónde:** Truck: chip de estado `apps/web/src/components/admin-truck-detail.tsx:162` (`warning`) y pill del stepper `truck-stepper.tsx:42` (`primary`); fase `status-chips.ts:45` (`warning`); Dashboard `admin-dashboard.tsx:32` (`primary`); callout del WO `work-order-next-step.tsx:204` (`primary`); tarjeta de WO `admin-work-order-item.tsx:83` (`bg-shop-accent/10`, el azul antiguo)
- **Evidencia:** (inferido del código) Un mismo estado con tres tratamientos. En la página del Truck el chip de arriba es ámbar ("cuidado") y el paso del stepper debajo es azul ("siguiente acción"). El aviso de la tarjeta de WO usa `shop-accent`, el azul que la Stage 8 (F2) quitó de `Badge`.
- **Criterio:** Nielsen H4 Consistencia y estándares
- **Severidad:** 2 · Frecuencia media (cada WO que termina), impacto medio (el Manager duda si hay un problema o solo falta cerrar); persistente.
- **Recomendación:** Decidir un único rol para "listo para que el Manager cierre": es una acción pendiente, no un riesgo, así que `primary`/`info` en todos los sitios. Cambiar `status-chips.ts:45` y `admin-truck-detail.tsx:162` a `default` (o `info`), y `admin-work-order-item.tsx:83` a `bg-primary/5` (o `bg-info-surface`).
- **Esfuerzo:** S

### UX-4-103 · El ámbar mezcla "algo va mal" con "te toca a ti"
- **Dónde:** `apps/web/src/lib/status-chips.ts:16,30,35,42,45`; `admin-truck-detail.tsx:162-163`; `admin-truck-admin.tsx:602`; `truck-stepper.tsx:37-38`
- **Evidencia:** (inferido del código) `warning` pinta a la vez problemas (Blocked, Paused, Check engine, neumático Watch, GPS viejo, Leaving soon con trabajo) y pasos normales que esperan al Manager (Needs evaluation, Ready for approval, Ready to close, paso "pending"), más High priority y el banner de Truck inactivo. Blocked y Paused son idénticos salvo por el icono. Con tanto ámbar, el que importa (un Truck bloqueado que sale mañana) no destaca.
- **Criterio:** Nielsen H8 Diseño estético y minimalista (señal/ruido) · H4 Consistencia
- **Severidad:** 2 · Frecuencia alta en Dashboard, Yard y Truck; impacto medio (se pierde la prioridad visual); persistente.
- **Recomendación:** Reservar `warning` para riesgo o bloqueo (Blocked, Paused, High, Leaving soon, fallas, Watch). Pasar "le toca al Manager" (Needs evaluation, Ready for approval, Ready to close, pending) a `info`/`primary`. Mantener la diferencia Blocked/Paused con el icono, y documentarla.
- **Esfuerzo:** S (cambiar el mapa) + revisión con el dueño

### UX-4-104 · El verde significa "terminado" y también "corriendo ahora"
- **Dónde:** `apps/web/src/components/mechanic-clock-strip.tsx:58-61`, `mechanic-home.tsx:221`, `app/work-orders/[id]/detail-client.tsx:302`, puntos "en vivo" `admin-yard-operations.tsx:155-156` y `admin-dashboard.tsx:82-83`, frente a `status-chips.ts:17,23,43`
- **Evidencia:** (inferido del código) "Clock running" es un `Badge success` con punto, igual que "Completed". El mecánico ve en verde tanto su reloj activo como los Jobs ya cerrados.
- **Criterio:** Nielsen H4 Consistencia y estándares
- **Severidad:** 1 · El texto desambigua; impacto bajo.
- **Recomendación:** "Corriendo / en curso" a `info` (o un `--live` con el punto animado); `success` solo para resultados terminados (Completed, Ready to Go, In service, OK).
- **Esfuerzo:** S

### UX-4-105 · "Inactivo" es gris en las listas y ámbar en el Truck y en Shop workflow
- **Dónde:** Neutral en `apps/web/src/components/admin-trucks-list.tsx:110`, `admin-truck-detail.tsx:283`, `admin-mechanics-list.tsx:115`, `admin-catalog-manage.tsx:218`; ámbar en `admin-truck-admin.tsx:602` (banner) y `admin-shop-workflow.tsx:161` (paso con Job inactivo)
- **Evidencia:** (inferido del código) El mismo estado es `Badge secondary` en listas y `warning-surface`/`text-warning-foreground` en dos pantallas. En Shop workflow tiene sentido (un paso que apunta a un Job inactivo es un problema), en el banner del Truck no tanto (el Truck inactivo es un estado, no un riesgo).
- **Criterio:** Nielsen H4 Consistencia y estándares
- **Severidad:** 1 · Frecuencia baja, impacto bajo.
- **Recomendación:** Regla: "Inactivo" es neutral (`secondary`/`muted`); solo es `warning` cuando rompe algo (un paso del flujo que apunta a algo inactivo). Cambiar el banner del Truck a `bg-muted` con icono.
- **Esfuerzo:** S

### UX-4-106 · "To do" cambia de color y de nombre entre el Admin y el mecánico
- **Dónde:** Admin `apps/web/src/lib/status-chips.ts:22` y `admin-job-table.tsx:256` (`outline`, círculo vacío, "To do"); mecánico `app/work-orders/[id]/detail-client.tsx:796` (`secondary`, relleno gris, "Pending")
- **Evidencia:** (inferido del código) `tone: 'secondary'` con `messages.jobStatusPending` frente a `JOB_STATUS_VARIANT[TO_DO] = 'outline'`.
- **Criterio:** Nielsen H4 Consistencia y estándares
- **Severidad:** 1 · El Manager y el mecánico rara vez comparan pantallas; impacto bajo.
- **Recomendación:** Usar `jobStatusVariant(job.status)` y la misma etiqueta del catálogo en `detail-client.tsx` (o documentar que "Pending" es deliberado en la vista del mecánico).
- **Esfuerzo:** S

### UX-4-107 · Sigue viva una segunda familia de tokens con valores distintos
- **Dónde:** `apps/web/src/app/globals.css:45-54` y `:116-123`; `tailwind.config.js` (`shop.*`); usos: `text-shop-muted` 18, `shop-accent` 6 (`app/page.tsx:236,241,277`, `work-orders/new/page.tsx:334`, `admin-work-order-item.tsx:83`), `shop-border`/`shop-panel` en esqueletos y `EmptyState` (`ui.tsx:1082,1111,1149`), `text-shop-success` 2
- **Evidencia:** (inferido del código) `foundations.md` dice "Do not add a second token set", pero `--shop-*` sigue ahí y ya no coincide: `--shop-accent` claro es `0.5` y `--primary` `0.5358` (dos azules distintos); `--shop-danger` oscuro es `0.7106` (rojo claro) y `--destructive` oscuro `0.3958` (rojo oscuro). `shop-muted` y `shop-success` duplican a `muted-foreground` y `success`.
- **Criterio:** Nielsen H4 Consistencia y estándares (sistema de diseño)
- **Severidad:** 1 · El usuario ve dos azules casi iguales; el riesgo real es que una pantalla nueva elija el token equivocado (ya pasó en UX-2-007).
- **Recomendación:** Migrar los ~30 usos: `text-shop-muted` → `text-muted-foreground`, `shop-accent` → `primary`/`info`, `shop-border`/`shop-panel` → `border`/`card`, `shop-success` → `success`; borrar `--shop-*` y `shop.*` de Tailwind; una prueba de lint que falle si reaparecen.
- **Esfuerzo:** S

### UX-4-108 · Los pares de texto de cada rol no siguen una regla, y eso provoca usos equivocados
- **Dónde:** `apps/web/src/app/globals.css:15-28`, `:91-106`; `tailwind.config.js` (colores)
- **Evidencia:** (inferido del código) `destructive-foreground` es "texto sobre el relleno"; `warning-foreground` es "texto sobre el tinte claro" (y en oscuro es un amarillo claro, por eso 33 sitios añaden `dark:text-warning` y 4 no: `admin-shop-workflow.tsx:161`, `work-plan-fault-recommendations.tsx:88`, `admin-truck-faults.tsx:133`, `admin-trucks-list.tsx:211`, que funcionan por casualidad); `destructive-text` es "texto sobre tinte" con otro sufijo; `success` no tiene ninguno. `--destructive` oscuro es un color de relleno (0.3958) y se usa como punto indicador (`inspection-sheet.tsx:101,713`), donde queda a 1,46:1. `--secondary` verde está definido, documentado como "success-leaning" y sin uso.
- **Criterio:** Convención de roles con pares `-foreground` (shadcn/Radix/Material `on-*`) · WCAG 1.4.11 en el caso del punto
- **Severidad:** 2 · Es la causa de varios hallazgos de contraste; impacto medio a medida que crecen las pantallas.
- **Recomendación:** Un esquema fijo de cuatro tokens por estado: `--{rol}` (relleno sólido / punto / barra), `--{rol}-foreground` (texto sobre el relleno), `--{rol}-surface` (tinte de fondo), `--{rol}-text` (texto o icono sobre página, tarjeta o surface; AA en los dos temas). Ver la tabla recomendada abajo. Renombrar `warning-foreground` → `warning-text` y añadir el `dark:` dentro del token, para no repetir `dark:text-warning`. Borrar `--secondary` o darle un uso neutro.
- **Esfuerzo:** M

### UX-4-109 · Colores sueltos fuera de los tokens
- **Dónde:** `apps/web/src/components/theme-provider.tsx:10` (`'#18243b'`), `apps/web/src/components/login-loader.tsx:61` (`bg-[#0f1a33]`), `pm-service-card.tsx:449` (`bg-white`), `lib/mechanic-tone.ts:16-22` (paleta Tailwind), `app/global-error.tsx:38-51` (hex)
- **Evidencia:** (inferido del código) El `theme-color` oscuro del navegador/PWA es `#18243b`, pero el fondo oscuro real es `#0f172a` y `foundations.md` dice `#0f172a`: la barra de estado del iPhone queda de otro azul que la página. El cargador de login usa un azul propio. Los avatares usan la paleta de Tailwind a propósito (documentado). `global-error.tsx` necesita hex porque puede pintarse sin CSS (justificado).
- **Criterio:** Consistencia del sistema de diseño
- **Severidad:** 1 · Cosmético.
- **Recomendación:** `theme-provider.tsx:10` → `'#0f172a'`; `login-loader` → `bg-background` del tema oscuro o un token `--brand-night` documentado; `pm-service-card` → `bg-background`. Dejar `global-error` y `mechanic-tone` como excepciones documentadas.
- **Esfuerzo:** S

### UX-4-110 · `foundations.md` no dice qué estado va con qué color
- **Dónde:** `docs/design-system/foundations.md` (sección "Color tokens") y `docs/design-system/components.md:29-32`
- **Evidencia:** (inferido del código) La tabla de tokens describe roles en general ("`--warning` … Caution banners (Yard Phase 1)", un uso antiguo). `components.md` lista el mapa de `status-chips.ts`, pero no los demás estados (Ready to close, Out of shop, External, Inactive, fallas, reloj, neumáticos), que cada pantalla decide sola: así aparecieron UX-4-102 a 106.
- **Criterio:** Nielsen H4 Consistencia y estándares (fuente única de verdad)
- **Severidad:** 2 · Es la causa raíz de las inconsistencias; afecta a cada pantalla nueva.
- **Recomendación:** Añadir a `foundations.md` la tabla "Estado → rol" de abajo y centralizar los estados que faltan en `status-chips.ts` (`truckStatusVariant`, `stepVariant`, `faultSeverityVariant`, `tireVariant`), para que `admin-truck-detail.tsx`, `truck-stepper.tsx`, `admin-dashboard.tsx` y `inspection-sheet.tsx` los importen en vez de definir sus propios mapas.
- **Esfuerzo:** S (documento) + M (centralizar)

## Recomendación: tokens a adoptar

Cuatro tokens por rol de estado, más los de superficie que ya existen. Valores de partida en OKLCH, ya medidos con el script de contraste (las cifras entre paréntesis), a comprobar renderizados (objetivo: `-text` ≥ 4,5:1 sobre `background`, `card` y su `-surface`; `{rol}` ≥ 3:1 sobre `card` para puntos y barras; `-foreground` ≥ 4,5:1 sobre `{rol}`). Regla de uso: puntos, barras e iconos sueltos toman `{rol}` solo si llega a 3:1 en los dos temas; si no, `-text`.

| Rol | `--{rol}` (relleno, punto, barra) | `--{rol}-foreground` (texto sobre relleno) | `--{rol}-surface` (tinte) | `--{rol}-text` (texto/icono sobre página o tinte) |
|---|---|---|---|---|
| primary (acción, enlace, seleccionado) | igual que hoy | igual que hoy | `primary/10` | claro `oklch(0.48 0.14 248)` (5,0:1 sobre `primary/15`) · oscuro = `--primary` |
| info (en curso, externo, fuera del taller, "te toca") | claro `oklch(0.52 0.12 265)` (5,4:1 sobre card) · oscuro `oklch(0.72 0.12 265)` | blanco (5,6:1) · `--background` (7,1:1) | claro `oklch(0.96 0.02 265)` · oscuro `oklch(0.28 0.05 265)` | claro `oklch(0.45 0.13 265)` (6,8:1 sobre surface) · oscuro `oklch(0.80 0.10 265)` (7,8:1) |
| success (terminado, listo, OK) | `--success` actual | blanco (6,2:1) · `--background` | claro `oklch(0.96 0.03 151)` · oscuro `oklch(0.27 0.05 151)` | = `--success` actual (5,5:1 / 6,3:1 sobre surface) |
| warning (riesgo, bloqueado, pausado, alta prioridad) | claro `oklch(0.64 0.15 72)` (3,3:1 sobre card, para puntos y barras) · oscuro = `--warning` | `oklch(0.25 0.06 72)` (4,7:1) | `--warning-surface` actual | = `--warning-foreground` claro actual · `--warning` oscuro (renombrar a `-text`) |
| danger / destructive (crítico, STOP, falta, error) | `--destructive` actual (relleno de botón); los puntos y barras usan `-text`, porque el relleno oscuro queda a 1,46:1 | `--destructive-foreground` | claro `destructive/10` · oscuro `oklch(0.28 0.06 25)` | = `--destructive-text` actual (7,1:1 sobre esa surface oscura) |
| neutral (creado, to do, cancelado, inactivo, esperando) | `--muted-foreground` | `--background` | `--muted` | `--muted-foreground` |

Además: `--input` con valor propio ≥ 3:1 (claro `oklch(0.64 0.02 256)`, oscuro `oklch(0.55 0.035 257)`; UX-2-001); borrar `--secondary`, `--popover` si sigue sin uso, `--accent-foreground` si sigue sin uso, y toda la familia `--shop-*`.

## Recomendación: tabla Estado → rol para `foundations.md`

| Estado | Rol | Signo además del color |
|---|---|---|
| Created, To do, Cancelled, fases intermedias, Waiting for Safety, Inactive, Low/Normal | neutral | Texto; círculo vacío para To do |
| In progress, reloj corriendo, External, Out of shop, Nadie asignado, Needs evaluation, Ready for approval, Ready to close, "New", "Yours", "Proposed" | info | Texto + icono (`Flag`, `Building2`, `UserPlus`…) |
| Completed, Ready to Go, In service, neumático OK, Active | success | Texto; `Check` |
| Paused, Blocked, High priority, Leaving soon con trabajo, Check engine / Warning, neumático Watch, GPS viejo | warning | Texto + `OctagonPause` (Blocked), `Pause` (Paused), `CalendarClock` (Leaves), `TriangleAlert` (fallas) |
| Critical, STOP, Pasos obligatorios faltantes, neumático Fix, errores | danger | Texto + `OctagonAlert` / `CircleAlert` |
| Acción principal, enlace, filtro/chip seleccionado, foco | primary | Subrayado en enlaces dentro de texto; `aria-pressed` en chips |

Regla que acompaña la tabla: ningún estado se comunica solo con color (texto o icono siempre), y cada pantalla toma el rol de `status-chips.ts`, no de un mapa local.

## Lo que funciona bien
- Fuera de `mechanic-tone.ts` no hay ni una clase de la paleta cruda de Tailwind en `apps/web/src`: todo pasa por tokens semánticos. Es una base excelente para cambiar significados de una vez.
- `status-chips.ts` tipa los mapas con `satisfies Record<Estado, ChipVariant>`: un estado nuevo sin color no compila. `Badge` es el único chip y lleva punto + texto.
- Lo grave es coherente en todas partes: Critical, STOP y pasos faltantes siempre en `destructive` con icono; Blocked siempre ámbar con `OctagonPause`; Ready to Go siempre verde.
- La corrección F2 (aviso en ámbar y no en el azul `shop-accent`) se aplicó en `Badge`, el stepper y los callouts; los tintes (`border-x/40 bg-x/10`) son uniformes en todo el sistema.
- `color-mix` en `tailwind.config.js` hace que `bg-primary/10` y similares funcionen con tokens OKLCH, y `destructive-text` resolvió el contraste del rojo en oscuro.

## Fuera de alcance / no verificado
- Todo el archivo está **(inferido del código)**. Falta ver en el navegador, en claro y oscuro, cómo conviven los colores en Dashboard, Yard y Truck (por ejemplo, si el chip ámbar "Ready to close" y la pill azul se ven juntos en el mismo pliegue).
- Los valores OKLCH propuestos se midieron con el script, pero falta comprobarlos renderizados y con el dueño (tono del azul `info`) antes de adoptarlos.
- La decisión de qué es "riesgo" y qué es "te toca" (UX-4-103) conviene validarla con el dueño; es una decisión de producto, no solo visual.
- No se revisaron gráficos de costos (`admin-truck-costs.tsx`) ni la factura impresa, que usa negro fijo a propósito.
