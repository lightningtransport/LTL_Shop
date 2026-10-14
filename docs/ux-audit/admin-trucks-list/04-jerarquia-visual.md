# 04 · Jerarquía y claridad visual — Admin → Trucks

**Fecha:** 2026-10-14 · **Pantalla:** `/admin/trucks` · **Componente:** `apps/web/src/components/admin-trucks-list.tsx`

## Prueba de los 5 segundos

- **Escritorio (producción):** se entiende que es la lista de camiones. Pero lo primero que salta son las insignias
  "Warning" y las direcciones largas, no el trabajo del taller. Para saber qué le falta a un camión hay que llegar
  a la columna 5 (Next step).
  **Falla a medias:** se sabe qué pantalla es, no qué hacer con cada camión.
- **Móvil:** cada tarjeta muestra Faults antes que el Work Order. "Next step —" ocupa una fila vacía. La ubicación
  no aparece.

## Hallazgos

### UX-4-001 · El trabajo del taller quedó en el medio de la tabla
- **Dónde:** Admin → Trucks (`/admin/trucks`) · `admin-trucks-list.tsx:72-108` (orden de `columns`)
- **Evidencia:** `evidencia/04-trucks-produccion-escritorio.png` (observado). El orden es Trucks · Faults ·
  Last location · Open Work Order · Next step · Operational status · Make · Company. Las dos columnas de Samsara
  se insertaron en las posiciones 2 y 3.
- **Criterio:** Escaneabilidad (columnas por importancia, izquierda = más importante) · Punto de entrada
- **Severidad:** 3 · Frecuencia alta (la pantalla de todos los días), impacto: la pregunta principal ("¿qué le
  falta?") se responde en la columna 5, persistente.
- **Recomendación:** Camión · Trabajo (Work Order, estado y siguiente paso juntos) · Fallas · Ubicación. Lo de
  Samsara informa; el trabajo del taller manda (subtítulo de la página: "Shop trucks and their open Work Order").
- **Esfuerzo:** S

### UX-4-002 · El vehículo se repite y se contradice
- **Dónde:** columna Trucks (subtítulo `year model`, `admin-trucks-list.tsx:66`) y columna Make (`:107`)
- **Evidencia:** producción (observado). 277 dice "2022 Freightliner" debajo del número y "CASCADIA" en Make.
  600 dice "2024 Mack Anthem" y "Mack Anthem". La marca y el modelo aparecen dos veces, y en el 277 los datos
  de Ninox los traen cruzados.
- **Criterio:** Densidad y ruido (cada dato una vez) · Consistencia
- **Severidad:** 2 · Confunde al leer, no impide la tarea.
- **Recomendación:** Una sola línea bajo el número: año, marca y modelo ("2022 Freightliner Cascadia"). Quitar la
  columna Make. Los datos cruzados de Ninox se corrigen en el camión cuando exista su pantalla (P13).
- **Esfuerzo:** S

### UX-4-003 · Columnas que no distinguen un camión de otro
- **Dónde:** Company (`:108`) y Operational status (`:91-106`)
- **Evidencia:** producción (observado). Company dice "CDT" en todas las filas visibles. Operational status dice
  "Not recorded" en 6 de 8, y contradice al siguiente paso: 602 dice "Ready to Go. Return it to service…" y a la
  vez "Not recorded".
- **Criterio:** Densidad y ruido (si lo quito, ¿alguien lo echa de menos?)
- **Severidad:** 2 · Ocupa ancho y obliga a leer columnas que no aportan.
- **Recomendación:** Quitar las dos columnas de la lista; siguen en la ficha del camión. Mostrar "In Service"
  como insignia pequeña en la columna Trabajo solo cuando el camión está en servicio y sin Work Order abierto.
- **Esfuerzo:** S

### UX-4-004 · El ancho se reparte mal y las filas cambian de alto
- **Dónde:** `DataTable` con tabla de ancho automático (`ui.tsx:949`)
- **Evidencia:** local a 1440 px (observado, `getBoundingClientRect`):
  - Next step mide 384 px y Trucks 115 px, así que "2025 VNL 860" se parte en 3 líneas.
  - Las filas miden entre 65 y 97 px.
  - En producción, direcciones como "Pennsylvania Turnpike, Napier Township, PA, 15550" se parten en dos líneas.
- **Criterio:** Escaneabilidad (filas de alto constante) · Alineación y retícula
- **Severidad:** 2 · Cuesta seguir una fila con la vista.
- **Recomendación:**
  - Anchos mínimos por columna: Camión ≥ 160 px.
  - Ubicación corta: ciudad y estado, más la antigüedad ("Napier Township, PA · 2 min"). La dirección completa
    va en el título y en la ficha.
  - Siguiente paso en máximo 2 líneas.
- **Esfuerzo:** S

### UX-4-005 · La celda del Work Order apila tres cosas que se leen como estados
- **Dónde:** columna Open Work Order (`:70-83`)
- **Evidencia:** producción (observado). Cada celda trae "WO-001", "Inspection" e "In Progress". "Inspection" es
  la categoría principal, pero se lee como un estado al lado de "In Progress". Son 3 líneas por fila.
- **Criterio:** Agrupación · Jerarquía tipográfica
- **Severidad:** 2
- **Recomendación:** Una línea, "WO-001 · In progress" (enlace e insignia), y debajo el siguiente paso. La categoría
  ya se ve en el siguiente paso o en la ficha.
- **Esfuerzo:** S

### UX-4-006 · Tres formas de decir "nada urgente" en Faults
- **Dónde:** columna Faults (`:72-95`)
- **Evidencia:** producción (observado). Aparecen "None" (en color de texto normal), "2 codes" sin insignia y
  "—" (no emparejado), mezclados.
- **Criterio:** Color y énfasis · Consistencia
- **Severidad:** 1 · Ruido visual; no cambia la tarea.
- **Recomendación:**
  - Sin luces ni check engine: celda en gris, "2 codes", o vacía si no hay códigos.
  - No emparejado: "—" con el título "Not in Samsara".
  - Solo las insignias (STOP, Warning, Check engine) tienen color.
- **Esfuerzo:** S

### UX-4-007 · Una ubicación vieja se ve igual que una de hace un minuto
- **Dónde:** columna Last location
- **Evidencia:** producción (observado). 277 dice "5 days ago" con el mismo estilo que "2 min. ago".
- **Criterio:** Color y énfasis (estado que importa sin destacar)
- **Severidad:** 2 · Un camión sin señal hace días puede leerse como ubicado.
- **Recomendación:** Más de 24 h: texto ámbar con "No signal · 5 days". Así se distingue sin agregar columnas.
- **Esfuerzo:** S

### UX-4-008 · En el teléfono el orden cambia y aparecen filas vacías
- **Dónde:** tarjetas móviles de `DataTable` (`max-md:` en `ui.tsx:949-1000`)
- **Evidencia:** `evidencia/04-trucks-local-movil.png` (observado):
  - Faults va antes que el Work Order.
  - "Next step —" ocupa una fila vacía.
  - La ubicación está oculta (`hideOnMobile`).
- **Criterio:** Móvil (la jerarquía se mantiene al reducir)
- **Severidad:** 2 · El Manager usa el teléfono caminando por el taller.
- **Recomendación:** Mismo orden que en escritorio. No mostrar filas sin valor. La ubicación corta sí cabe en el
  teléfono.
- **Esfuerzo:** S

## Fuera de esta skill (para las otras)
- **Skill 3 (contenido):** "1 Jobs left" (`truckNextStepWork`) no concuerda en número.
- **Skill 5 (navegación):** no hay filtro "With faults" ni orden por severidad, aunque estaban en la maqueta de
  D42. La lista de Work Orders tiene encabezado fijo y la de Trucks no.

## Propuesta de tabla (escritorio, 4 columnas)

| Camión | Trabajo | Fallas | Ubicación |
|---|---|---|---|
| **277**<br>2022 Freightliner Cascadia | **WO-001** · In progress<br>2 Jobs left · next: Coolant Service | `Warning` 3 codes | Baltimore, MD<br>*No signal · 5 days* (ámbar) |
| **602**<br>2024 Volvo VNL 860 | Ready to Go<br>Return it to service when it leaves | — | Orient Park, FL · 7 min |

## Inventario visual (lista de Trucks)
- **Tamaños de fuente en la tabla:** 2 (14 px y 12 px). Bien.
- **Colores de énfasis:** azul de enlace, más las insignias ámbar, rojo y gris. Correcto en sí; el problema es
  la cantidad de cosas en la misma fila.
- **Componentes:** la lista de Trucks usa `DataTable` (`ui.tsx`). La de Work Orders arma su propia `<table>` con
  encabezado fijo (`admin-work-orders-list.tsx:148`). Son dos tablas distintas para el mismo tipo de pantalla.

**Diagnóstico:** el problema es de aplicación, no de sistema. Hay `DataTable` y tokens, pero las columnas se
fueron sumando sin ordenar por la tarea.

## Estado (2026-10-14)
Los ocho hallazgos se resolvieron en la rama `claude/trucks-list-columns` (OPEN_ISSUES §1z, TL-1 a TL-8).
Capturas del después: `evidencia/04-trucks-despues-1440.png` y `evidencia/04-trucks-despues-movil.png`.
