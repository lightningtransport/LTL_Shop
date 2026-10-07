# Auditoría UX — Lightning Shop, pantallas de Setup del admin

**Fecha:** 2026-10-07 · **Alcance:** Shop workflow (con Shop hours), Job Catalog (lista, detalle y diálogos), Mechanics (lista, detalle y diálogos), y la ausencia de una pantalla de partes. Rol: Manager. · **Dimensiones auditadas:** 1, 3, 4, 5, 6, 7
**Dimensiones no auditadas:**
- 2 (accesibilidad) y 8 (técnico): no las pidió esta revisión. Son pantallas de oficina para 1–2 personas.
- Las skills 1–7 trabajaron sobre el código y sobre un único recorrido observado en la demo (`evidencia/observaciones-navegador.md`). Los textos en español solo se revisaron en el código.

## Resumen ejecutivo
Las tres pantallas de Setup funcionan para lo que se hace a diario, pero los cambios tienen efectos lejanos y silenciosos. El Manager guarda, la pantalla dice "guardado", y el problema aparece días después en el patio:
- un trabajo sin dueño;
- un paso obligatorio que deja de crearse;
- un trabajo que sale de su carril.

Lo más caro hoy:
1. **Cambiar el tipo de una persona rompe Shop workflow.** Si la persona era dueña de un paso, cambiarle el tipo no avisa nada. Después, la pantalla de Shop workflow no deja guardar ningún cambio y pide "refrescar", lo que no lo arregla. Lo reproducimos en la demo.
2. **Las cifras de personas no son confiables.** Un mecánico de PM con 9 trabajos pendientes figura con 0.
3. **El catálogo no se controla de verdad.** No se puede desactivar ni borrar un trabajo, ni manejar categorías o aliases. Además, cada publicación nueva deshace lo que cambió el Manager.

**Arreglos rápidos que se pueden hacer en días:**
- guardar solo lo que cambió;
- avisar antes de cambiar o desactivar a una persona;
- contar el trabajo real;
- avisar los cambios sin guardar.

Con eso, Setup deja de romper cosas sin decirlo. El resto llega con lo que ya decidió el dueño: equipos por paso con cola, QC del Manager, control del catálogo, "Remove" y la sección de partes y costos.

## Cifras
| Severidad | Hallazgos |
|-----------|-----------|
| 4 · Catastrófico | 1 |
| 3 · Mayor | 33 |
| 2 · Menor | 64 |
| 1 · Cosmético | 17 |
| **Total** | 115 |

De esos 115, 31 están marcados **"cambia por decisión"**: no son defectos del código actual, son brechas frente a lo que el dueño ya decidió el 2026-10-07.

**Por dimensión**

| Skill | Total | Sev 3-4 |
|---|---|---|
| 1 · Usabilidad | 20 | 6 |
| 3 · Contenido | 20 | 3 |
| 4 · Jerarquía visual | 11 | 2 |
| 5 · Navegación | 15 | 3 |
| 6 · Estados | 24 | 11 |
| 7 · Formularios | 25 | 9 |

**Por flujo crítico** (aproximado: los hallazgos se cuentan una vez, por su pantalla principal)

| Flujo | Total | Sev 3-4 |
|---|---|---|
| 1 · Quién hace cada paso (Shop workflow) | ~33 | ~13 |
| 2 · Mantener el catálogo | ~35 | ~10 |
| 3 · Alta, cambio y baja de personas | ~35 | ~11 |
| 4 · Partes del PM | 5 | 0 |
| Transversal (textos, navegación, guardado) | ~7 | ~0 |

## Patrones (insights)

### P1 · Lo que el Manager cambia en Setup rompe cosas lejos y en silencio
- **Qué pasa:** cambiar el tipo de una persona, desactivarla, renombrar un Job o desactivar una categoría guarda "bien". Pero:
  - el paso obligatorio queda sin dueño;
  - o deja de crearse;
  - o el Job sale de su carril en Yard.

  La pantalla que lo provoca no avisa, y la que lo sufre (Shop workflow, Yard) no lo explica.
- **Hallazgos:**
  - Usabilidad: UX-1-003, UX-1-004, UX-1-009.
  - Estados: UX-6-005 (sev 4), UX-6-007, UX-6-008, UX-6-009, UX-6-010.
  - Formularios: UX-7-005, UX-7-017.
- **Causa probable:**
  - Las dependencias entre personas, pasos y catálogo no se consultan antes de escribir.
  - Los carriles reconocen los Jobs por su nombre (`yard-work-plan-derivation.ts:78-120`).
  - `mandatory-jobs.ts:70` omite un paso inactivo sin decir nada.
  - `save()` de Shop workflow envía todos los pasos.
- **Qué cambiaría si se arregla:** cada cambio en Setup dice antes qué afecta, y el patio deja de recibir sorpresas. Es la base para los equipos por paso.

### P2 · Las cifras de personas no cuentan el trabajo real
- **Qué pasa:** "Open Work Orders" sale de `mechanic_assignments` y no de los Jobs de cada persona. Por eso un mecánico de PM o de Safety siempre ve 0, y otros ven de más. El perfil dice "Completed Jobs: 3" junto a "No closed Work Orders", y el diálogo de desactivar lista 9 Jobs donde la página decía 0.
- **Hallazgos:** UX-1-014, UX-3-010, UX-3-012, UX-6-011, UX-6-012.
- **Causa probable:** `toMechanicSummary` (`admin.service.ts:2504-2525`) usa la tabla del equipo, que es una caché; el bloqueo de desactivar usa los Jobs.
- **Qué cambiaría si se arregla:** el Manager puede decidir con la lista de personas, y el bloqueo de desactivar deja de sorprender.

### P3 · Setup no dice qué falta guardar ni por qué falló
- **Qué pasa:**
  - Save se ve gris aun con cambios.
  - Hay dos botones de guardar en la misma página.
  - Salir de la página descarta los cambios sin aviso.
  - Un fallo dice "Refresh and try again".
  - Desactivar avisa del bloqueo recién después de confirmar.
  - Un conflicto de nombre no dice con qué Job choca.
- **Hallazgos:**
  - Usabilidad: UX-1-001, UX-1-002, UX-1-008, UX-1-015.
  - Contenido: UX-3-007, UX-3-013.
  - Jerarquía visual: UX-4-001, UX-4-002.
  - Navegación: UX-5-013.
  - Estados: UX-6-004, UX-6-013, UX-6-014, UX-6-016.
  - Formularios: UX-7-001, UX-7-002, UX-7-003, UX-7-004, UX-7-007, UX-7-011, UX-7-018.
- **Causa probable:**
  - Cada pantalla guarda a su manera.
  - No hay un aviso común de cambios pendientes ni de salida con cambios.
  - El `catch` descarta el código de error de la API.
- **Qué cambiaría si se arregla:** un solo patrón de guardado: una barra que aparece con cambios, errores junto al campo y diálogos que no se cierran perdiendo lo escrito. Se resuelven unos 20 hallazgos de una vez.

### P4 · Las pantallas de Setup no se conocen entre sí
- **Qué pasa:**
  - El paso no enlaza a su Job.
  - El Job no dice que es un paso obligatorio ni dónde se usa.
  - El perfil de una persona no muestra de qué pasos es dueña.
  - El buscador del catálogo solo encuentra categorías.
  - Los avisos de "pasos faltantes" no llevan a Shop workflow.
- **Hallazgos:**
  - Navegación: UX-5-001, UX-5-002, UX-5-010, UX-5-011, UX-5-012, UX-5-014.
  - Jerarquía visual: UX-4-003, UX-4-009.
  - Formularios: UX-7-006, UX-7-016.
- **Causa probable:** las tres pantallas se hicieron por separado (D15, D22, D25), cada una con su propio DTO y sin referencias cruzadas.
- **Qué cambiaría si se arregla:** se puede responder "¿qué pasa si toco esto?" sin adivinar. Es un requisito de las protecciones del catálogo.

### P5 · Los textos describen el producto anterior
- **Qué pasa:**
  - "Read-only" en un catálogo editable.
  - "Manager or System Admin…" repetido en 8 lugares.
  - "PM A Service" como nombre de paso.
  - "Mechanics" para una lista con Safety y admins.
  - "The Job id stays the same".
  - "Job labor time is not available" fijo.
  - Pasos en inglés dentro de la versión en español.
  - Aliases casi duplicados por una tilde.
- **Hallazgos:**
  - Contenido: UX-3-001, UX-3-002, UX-3-003, UX-3-004, UX-3-008, UX-3-009, UX-3-011, UX-3-015, UX-3-017, UX-3-018.
  - Usabilidad: UX-1-007, UX-1-012, UX-1-018.
  - Jerarquía visual: UX-4-006, UX-4-008.
  - Navegación: UX-5-003.
- **Causa probable:** cada capacidad nueva agregó un párrafo de ayuda en vez de reescribir los existentes. El normalizador de aliases descarta las letras con tilde en lugar de quitarles la tilde (`job-catalog.service.ts:4-5`).
- **Qué cambiaría si se arregla:** pantallas más cortas y un vocabulario único. El glosario en `03-contenido.md` ya trae los términos nuevos (Equipo, Cola del equipo, Tomar, Job del sistema, Quitar del Shop).

### P6 · Lo decidido por el dueño todavía no tiene pantalla
- **Qué pasa:** faltan:
  - el equipo con cola por paso;
  - el QC del Manager (`/qc` lo redirige sin mensaje);
  - el paso "PM";
  - activar y desactivar categorías, Jobs y aliases;
  - "Remove";
  - partes y costos.
- **Hallazgos (31 "cambia por decisión"):**
  - Usabilidad: UX-1-005, 006, 007, 011, 016, 020.
  - Contenido: UX-3-001, 003, 005, 006, 014, 016, 020.
  - Jerarquía visual: UX-4-003, 004, 007.
  - Navegación: UX-5-004, 009.
  - Estados: UX-6-019 a 024.
  - Formularios: UX-7-019 a 025.
- **Causa probable:** las decisiones D11, D19, D22, D24 y D25 limitaban esto a propósito; el dueño las cambió el 2026-10-07.
- **Qué cambiaría si se arregla:** son los bloques S1–S4 del plan. Este informe les aporta los criterios de diseño.

## Top 10 priorizado
| # | ID | Hallazgo | Sev | Esfuerzo | Flujo | Por qué está aquí |
|---|----|----------|-----|----------|-------|-------------------|
| 1 | [UX-6-005](06-estados.md) | Un dueño que dejó de ser elegible bloquea guardar cualquier paso | 4 | S | 1 | Reproducido; deja la pantalla inutilizable y el mensaje engaña. Es el mismo que [UX-7-005](07-formularios.md) |
| 2 | [UX-7-017](07-formularios.md) | Cambiar el tipo de una persona con trabajo o que es dueña de un paso no avisa | 3 | M | 3 | Es la puerta de entrada del #1 y deja pasos sin dueño (= [UX-1-003](01-usabilidad.md), [UX-6-009](06-estados.md)) |
| 3 | [UX-6-008](06-estados.md) | Un paso con Job o categoría inactiva desaparece de las WOs nuevas sin aviso | 3 | S | 1 | Falla silenciosa de un paso **obligatorio** (= [UX-1-004](01-usabilidad.md)) |
| 4 | [UX-1-014](01-usabilidad.md) | "Open Work Orders" no coincide con el trabajo real | 3 | M | 3 | Cifra falsa en la pantalla de decisión: 0 contra 9 (= [UX-3-010](03-contenido.md), [UX-6-011](06-estados.md)) |
| 5 | [UX-1-009](01-usabilidad.md) | Renombrar un Job que es paso lo saca de su carril sin avisar | 3 | S | 2 | Rompe Yard; pasa a ser más probable cuando el Manager gane control del catálogo |
| 6 | [UX-1-010](01-usabilidad.md) | La recarga del catálogo en cada publicación deshace los cambios del Manager | 3 | M | 2 | Pérdida de datos silenciosa en cada release; bloquea S2 |
| 7 | [UX-6-016](06-estados.md) | Salir de Shop workflow con cambios los pierde sin aviso | 3 | S | 1 | Barato, y es parte del patrón P3 (= [UX-7-004](07-formularios.md), [UX-5-013](05-navegacion-ia.md)) |
| 8 | [UX-4-001](04-jerarquia-visual.md) | El botón Save se ve apagado aun con cambios | 3 | S | 1 | Confirmado en el DOM: está habilitado pero con el estilo neutro |
| 9 | [UX-6-013](06-estados.md) | Desactivar muestra el bloqueo recién después de confirmar | 3 | M | 3 | La salida de una persona es frecuente y hoy es de prueba y error (= [UX-1-015](01-usabilidad.md), [UX-7-018](07-formularios.md)) |
| 10 | [UX-5-014](05-navegacion-ia.md) | El buscador del catálogo no encuentra Jobs ni aliases | 3 | M | 2 | Hasta 17 categorías abiertas para encontrar un Job, y riesgo de duplicados |

**Por qué quedaron fuera** [UX-7-011](07-formularios.md) (conflicto de nombre sin salida) y [UX-6-003](06-estados.md) (listas vacías al cargar): son de severidad 3 pero tocan a menos usuarios y no rompen datos.

## Quick wins
Esfuerzo S y severidad ≥ 2, agrupados.
- **Guardado de Shop workflow:**
  - UX-6-005 / UX-7-005: enviar solo lo que cambió y mostrar el error real.
  - UX-4-001: Save como botón primario cuando hay cambios.
  - UX-6-016 / UX-7-004 / UX-1-001: avisar al salir con cambios.
  - UX-1-008 / UX-3-007 / UX-4-002 / UX-7-007: dos botones de guardar con nombre propio.
  - UX-6-004 / UX-1-002: mensaje de error junto al botón.
- **Avisos de dependencias:**
  - UX-6-008 / UX-1-004: un paso inactivo se marca.
  - UX-6-007: el dueño que perdió la capacidad se marca.
  - UX-1-009: aviso al renombrar un Job que es paso.
  - UX-6-001: qué pasa si un paso queda sin dueño.
- **Textos:**
  - UX-3-001, UX-3-002 / UX-4-006 / UX-1-012: quitar los párrafos duplicados y desactualizados.
  - UX-3-004: los pasos en español.
  - UX-3-008 / UX-5-003: "People / Personas".
  - UX-3-012.
  - UX-3-013: avisar en el primer diálogo.
  - UX-3-015.
  - UX-3-018.
- **Navegación:**
  - UX-1-013 / UX-5-008: el enlace de categoría al primer clic, usando `AdminNavLink`.
  - UX-5-010: el aviso de pasos faltantes enlaza a Shop workflow.
  - UX-5-012: conservar la búsqueda al volver.
  - UX-5-015 / UX-1-017: un solo modo de filtrar.
  - UX-5-005: Shop hours visible.
- **Formularios:**
  - UX-7-002: diálogos que no se cierran perdiendo lo escrito.
  - UX-7-001: errores junto al campo.
  - UX-7-012: avisar que el nombre anterior queda como alias o deja de servir.
  - UX-7-014: la casilla "Also add to catalog" muestra qué crea.
  - UX-6-002.
  - UX-6-017.
- **Teléfono:** UX-4-005: la lista del catálogo, una línea por categoría.

## Matriz impacto × esfuerzo
|              | Esfuerzo S | Esfuerzo M | Esfuerzo L |
|--------------|-----------|-----------|-----------|
| Sev 4        | UX-6-005 | — | — |
| Sev 3        | UX-1-003, UX-1-004, UX-1-009, UX-3-008, UX-3-010, UX-3-013, UX-4-001, UX-6-003, UX-6-004, UX-6-007, UX-6-008, UX-6-009, UX-6-010, UX-6-016, UX-7-004, UX-7-005, UX-7-014 | UX-1-010, UX-1-014, UX-1-015, UX-4-009, UX-5-001, UX-5-002, UX-5-014, UX-6-011, UX-6-013, UX-7-003, UX-7-011, UX-7-017, UX-7-018, UX-7-020 (dec), UX-7-022 (dec) | UX-6-019 (dec) |
| Sev 2        | 47 hallazgos (ver los archivos fuente) | 13 hallazgos | UX-1-020, UX-5-004, UX-6-024, UX-7-024 (todos dec: partes y costos) |

## Plan sugerido
- **Ahora (1–2 semanas, antes de S1):** un PR de arreglos sin rediseño.
  - Guardado de Shop workflow: el #1, P3 parcial.
  - Avisos de dependencias en tipo, desactivar y renombrar: P1.
  - Cifra real de trabajo abierto: P2.
  - Textos duplicados y desactualizados: P5.
  - El primer clic en categoría.

  Son los quick wins más el #1 a #4.
- **Siguiente (bloques del plan, en orden):**
  - **S1 Shop workflow:** equipos con cola, QC del Manager, paso "PM". Resuelve P6 y parte de P4, con los criterios de UX-7-020, UX-7-025 y UX-6-019.
  - **S2 Catálogo:**
    - `system_key` y carriles por clave, en lugar de por nombre (UX-1-009).
    - Recarga que no pise al Manager (UX-1-010).
    - Búsqueda por Job y alias (UX-5-014).
    - "Dónde se usa" (UX-5-002).
    - Aliases, desactivar y borrar.
    - El normalizador de tildes (UX-3-017).
  - **S3 Personas:**
    - Cabecera de estado (UX-4-009).
    - Remove.
    - Bloqueo previo en el primer diálogo con reasignación o cola (UX-6-013, UX-7-025).
    - Pasos de los que es dueña (UX-5-011).
- **Después:** S4 Partes y costos (UX-1-020, UX-5-004, UX-6-024, UX-7-024), con la estructura de navegación de `05-navegacion-ia.md` (grupo "Parts & costs" y pestaña "Costs" en el Truck), y los cosméticos.

## Lo que funciona bien
- **Carga, fallo y 404:** primitivas comunes (`PageSkeleton`, `LoadFailure` con Retry, 404 con salida) en todas las pantallas.
- **Errores de la API:** traducidos a frases EN/ES (`api-error-copy.ts`); no llegan códigos crudos al Manager.
- **Doble envío:** cubierto en todos los formularios. Los diálogos son `<form>` con etiquetas asociadas.
- **Contraseña temporal:** se muestra una sola vez, con Copy y una alternativa si el portapapeles falla, y el texto dice qué hacer.
- **Desactivar es seguro:** la API se niega con trabajo abierto y lista cada Job con enlace. El problema es solo el momento en que lo dice.
- **Dueño inactivo visible:** el dueño que se volvió inactivo sigue visible con un aviso en Shop workflow. Es el modelo para marcar a los no elegibles.
- **Teléfono:**
  - Shop workflow en una columna con controles de 44 px.
  - Tablas que pasan a tarjetas sin scroll horizontal.
  - Menú en hoja con los mismos grupos.
- **Navegación:**
  - Menú agrupado por frecuencia, y cada pantalla con URL propia.
  - Mechanics guarda su búsqueda en la URL.
  - "Also add to catalog" elige el Job existente cuando el nombre coincide.
- **Textos bien escritos:** la ayuda de Shop hours y la de acceso ("Their history stays") explican el efecto real. Son el modelo para Remove.

## Hallazgos completos por dimensión
- [01-usabilidad.md](01-usabilidad.md): 20 hallazgos (6 de sev 3).
- [03-contenido.md](03-contenido.md): 20 hallazgos (3 de sev 3). Trae un glosario de 20 términos.
- [04-jerarquia-visual.md](04-jerarquia-visual.md): 11 hallazgos (2 de sev 3). Trae la prueba de los 5 segundos.
- [05-navegacion-ia.md](05-navegacion-ia.md): 15 hallazgos (3 de sev 3). Trae el mapa actual y la estructura de navegación propuesta.
- [06-estados.md](06-estados.md): 24 hallazgos (1 de sev 4 y 10 de sev 3). Trae la matriz pantalla × estado.
- [07-formularios.md](07-formularios.md): 25 hallazgos (9 de sev 3).

Cada archivo tiene el detalle completo de sus hallazgos (dónde, evidencia, criterio, recomendación).

## Anexos
- **Contexto:** `00-contexto.md`.
- **Evidencia:** `evidencia/`:
  - 13 capturas `00-*.jpg`;
  - `observaciones-navegador.md`, con la reproducción del bloqueo de Shop workflow y la revisión del botón Save en el DOM.
- **Fuera de alcance y no verificado:**
  - Accesibilidad y técnico no se auditaron.
  - La versión en español solo se revisó en el código.
  - No se observaron en vivo:
    - la recarga del catálogo al publicar (UX-1-010, inferido de `job-catalog.ts:332-427`);
    - el carril de Yard tras renombrar (UX-1-009);
    - la sesión vencida ni la falta de conexión.
  - La demo no trae las categorías inactivas Alignment y Air System; se vieron en las capturas de producción del dueño.
