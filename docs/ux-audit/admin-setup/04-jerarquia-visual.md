# 04 · Jerarquía y claridad visual — Lightning Shop Admin (Setup)

**Fecha:** 2026-10-07 · **Alcance:** Shop workflow (con Shop hours de pasada), Job Catalog
(lista y detalle de categoría, diálogos Add / Rename), Mechanics (lista y detalle), a 1440 px y
375 px, tema oscuro, inglés · **Método:** código + capturas de la demo local
`ltl_shop_setup_demo` como Manager (`evidencia/00-*.jpg`, `evidencia/observaciones-navegador.md`).
Esta corrida no usó el navegador: las capturas son las de la skill 0 y los tamaños salen de las
clases del código y de `docs/design-system/foundations.md`, no de `getComputedStyle`.

**Resumen:** 11 hallazgos, 2 de severidad 3. De 7 vistas, **2 fallan la prueba de los 5 segundos**
(Catálogo en teléfono, detalle de Mechanics) y **3 la pasan a medias** (Shop workflow, lista del
Catálogo, detalle de categoría). El patrón dominante: **estas pantallas muestran datos pero no
estado ni acción**. Hay conteos donde haría falta un estado, una lista plana con un botón igual
por fila y una pila de tarjetas del mismo peso. Además, cada pantalla repite su ayuda en dos
párrafos. **El problema es de aplicación, no de sistema:** el sistema de diseño de la Etapa 8 ya
tiene `SectionCard`, `CountChip`, `ResponsiveMenu` y chips de estado, y los rediseños de Truck y
Work Order los usan. Setup no usa ninguno.

Varias brechas **cambian por decisión del dueño** y no se reportan como defecto. Cuando un
hallazgo toca una de ellas, se marca "cambia por decisión" y la recomendación ya tiene en cuenta
lo decidido:

- equipo y cola por paso;
- el Manager como respaldo de QC;
- el paso se llama "PM";
- el Manager administra el catálogo;
- "Remove" para una persona;
- Partes y costos.

## Prueba de los 5 segundos

| Vista | Qué se ve primero (una línea) | Resultado |
|---|---|---|
| Shop workflow, escritorio (`00-shop-workflow-desktop.jpg`) | "Cuatro pasos, cada uno con un select de dueño". Los cuatro dicen "No default owner" y nada marca eso como un problema. Save parece desactivado | **Parcial** |
| Shop workflow, teléfono (`00-shop-workflow-movil.jpg`) | Título, subtítulo y los pasos en una columna, todo legible. QC queda al final y Save debajo del pliegue | **Pasa** |
| Catálogo, lista (`00-catalogo-lista.jpg`) | "Categorías con números y un botón Add Job". Dos párrafos casi iguales separan el título de la búsqueda. No se ve qué se hace con una categoría ni cuál está inactiva (en la demo no hay ninguna) | **Parcial** |
| Catálogo, teléfono (`00-catalogo-movil.jpg`) | Lo primero que se ve es texto: el subtítulo y el párrafo de ayuda ocupan media pantalla. En el primer pliegue entra una sola categoría, que es una tarjeta con tres números | **Falla** |
| Detalle de categoría (`00-catalogo-categoria.jpg`) | "Los Jobs de Fuel System, cada uno con Rename Job". No se ve qué Jobs están activos ni que "Fuel Lines" tiene dos aliases casi iguales | **Parcial** |
| Mechanics, lista (`00-mechanics-lista.jpg`) | "Personas con su tipo y sus Work Orders abiertas, y Add person". Se entiende | **Pasa** |
| Mechanics, detalle (`00-mechanics-detalle.jpg`) | "Un formulario con el nombre de Daniel y tres radios". No se ve si está activo, cuánto trabajo tiene ni qué se puede hacer con él. Las acciones de acceso quedan a media página | **Falla** |

## Hallazgos

### Shop workflow

### UX-4-001 · Nada en la pantalla avisa que hay cambios sin guardar
- **Dónde:** Shop workflow (`/admin/setup/workflow`) · `apps/web/src/components/admin-shop-workflow.tsx:115` · `apps/web/src/components/ui.tsx:29`
- **Evidencia:**
  - **Corrección (2026-10-07, observado en el DOM):** Save **sí** pasa a azul (`bg-primary`) cuando hay un cambio. La lectura "gris" de la primera versión fue un error de medición: con el panel del navegador oculto, la transición de color no avanzaba. La captura `00-shop-workflow-cambio-sin-guardar.jpg` se tomó en ese instante.
  - Aunque se ponga azul, el botón queda solo, debajo de la tarjeta y separado de ella. La fila cambiada no se marca y no aparece ningún texto del tipo "cambios sin guardar".
- **Criterio:** Acción principal (CTA) · Color y énfasis (estados distinguibles) · Nielsen H1
- **Severidad:** 2 · Corregida desde 3: el botón sí cambia de color. Lo que queda es que ni la fila cambiada ni la página avisan que falta guardar (ver UX-6-016 para salir sin guardar).
- **Recomendación:**
  - Pie de la tarjeta de pasos que aparece solo con cambios: "1 change not saved · Discard · **Save**". Save en `variant="default"`, a la derecha.
  - Marcar la fila cambiada, por ejemplo con un punto o un chip "Changed".
  - Sin cambios, no mostrar el botón, o mostrar "Saved" en `text-muted-foreground`, en vez de un botón apagado.
- **Esfuerzo:** S

### UX-4-002 · Dos formularios y dos botones de guardar en la misma página
- **Dónde:** Shop workflow · `admin-shop-workflow.tsx:115` (Save) y `:210` (Save shop hours), con Shop hours como `<section>` propia en `:162-212`
- **Evidencia:** (observado) debajo de los pasos hay un "Save" y, más abajo, un "Save shop hours". Los dos usan el mismo estilo y el mismo ancho, y los dos quedan sueltos fuera de su tarjeta (`00-shop-workflow-desktop.jpg`). No queda claro si el primer Save guarda también el horario.
- **Criterio:** Agrupación y proximidad · Acción principal (más de un CTA primario por vista)
- **Severidad:** 2 · El Manager completa la tarea, pero duda qué guarda cada botón.
- **Recomendación:**
  - Convertir cada bloque en `SectionCard`: "Mandatory steps" y "Shop hours", cada uno con su pie de guardado dentro de la tarjeta (ver UX-4-001), visible solo con cambios en ese bloque. Así nunca hay dos Save activos a la vez sin explicación.
  - Otra opción: llevar Shop hours a su propia sección de Setup.
- **Esfuerzo:** S

### UX-4-003 · La fila destaca el nombre del Job del catálogo, no el paso, y "sin dueño" no se ve como riesgo (cambia por decisión)
- **Dónde:** Shop workflow · `admin-shop-workflow.tsx:82-107` (fila), `:85-86` (título = Job del catálogo, subtítulo = categoría), `:106` (QC sin control)
- **Evidencia:**
  - (observado) El título de la fila es "PM A Service" y el subtítulo "PM". En Detailing y Quality Check, título y subtítulo repiten lo mismo (`00-shop-workflow-desktop.jpg`).
  - "No default owner" se ve igual que un nombre elegido. Los cuatro pasos sin dueño, que es el estado de riesgo, no tienen color ni chip.
  - En QC, el control se reemplaza por un texto gris de dos líneas alineado con los selects, así que parece un control vacío.
- **Criterio:** Escaneabilidad (etiquetas y datos clave) · Color y énfasis (semántico para "aviso")
- **Severidad:** 2 · Se entiende leyendo, pero no de un vistazo.
- **Recomendación (según lo decidido):** cada fila con:
  - el **paso** como título: "PM", "Alignment", "Detailing", "Quality Check";
  - el Job del catálogo como línea secundaria, solo si es distinto del paso;
  - a la derecha, el **equipo** (chip) y la **cola o dueño por defecto** (control);
  - un chip `warning` "No owner · goes to queue" o "No team" cuando corresponda.

  En QC, el mismo control de equipo (Safety), con "Manager as backup" como línea secundaria, en vez de un párrafo en la columna del control.
- **Esfuerzo:** M (sigue al cambio de modelo de equipos)

### Job Catalog — lista

### UX-4-004 · La tabla muestra conteos en vez de estado y acciones (cambia por decisión)
- **Dónde:** Job Catalog (`/admin/catalog`) · `apps/web/src/components/admin-catalog-list.tsx:55-70`
- **Evidencia:**
  - (observado) Las columnas son Category | Jobs | Inactive Jobs | Aliases (`00-catalogo-lista.jpg`). "Inactive Jobs" vale 0 en las 17 filas visibles. "Aliases" es un número (18, 10, 20…) que no lleva a ninguna decisión.
  - Los números van alineados a la izquierda: `DataTable` usa `text-left` (`ui.tsx:953`) y las columnas no pasan `className`.
  - El estado de la categoría solo aparece como badge "Inactive" junto al nombre (`:63`). No hay columna de estado ni acción por fila.
- **Criterio:** Densidad y ruido (columnas que nadie echa de menos) · Alineación (números a la derecha) · Escaneabilidad
- **Severidad:** 2 · Hoy el Manager solo puede entrar a la categoría, así que no le falta nada para actuar. Con la decisión de que el Manager administra el catálogo, la tabla tendrá que mostrar estado y acciones.
- **Recomendación:**
  - Columnas: Category (con el chip de estado Active / Inactive) | Jobs ("6", con "· 1 inactive" en `text-muted-foreground` solo si hay inactivos) | "…" (`ResponsiveMenu`: Rename, Activate / Deactivate según las protecciones decididas).
  - Quitar Aliases de la lista: se ve en el detalle.
  - Números con `tnum text-right`.
- **Esfuerzo:** M

### UX-4-005 · En el teléfono cada categoría es una tarjeta de tres números y la lista no se puede recorrer
- **Dónde:** Job Catalog en 375 px · `admin-catalog-list.tsx:67-69` (ninguna columna con `hideOnMobile`) · `ui.tsx:960-990`
- **Evidencia:** (observado) cada categoría ocupa unos 165 px con "Jobs / Inactive Jobs / Aliases" en filas con borde (`00-catalogo-movil.jpg`). Con 17 categorías son unas 9 pantallas de scroll. Antes de la primera categoría van el subtítulo, el párrafo de ayuda y la búsqueda dentro de su propia tarjeta (`:36-40`).
- **Criterio:** Móvil · Densidad · `docs/design-system/components.md:83` ("put secondary data last with `hideOnMobile`")
- **Severidad:** 2 · El teléfono es secundario para este rol, pero la pantalla en teléfono no sirve para buscar una categoría a ojo.
- **Recomendación:**
  - `hideOnMobile` en Inactive Jobs y Aliases.
  - En el teléfono, cada categoría como una fila de una línea: nombre, chip de estado y "6 Jobs" a la derecha.
  - La búsqueda sin tarjeta propia, igual que `AdminFilterToolbar`.
- **Esfuerzo:** S

### UX-4-006 · Dos párrafos de ayuda dicen lo mismo bajo el título, y se repiten en cada diálogo
- **Dónde:** `AdminWriteTip`, 8 usos:
  - `admin-catalog-list.tsx:32` (subtítulo) + `:35` (tip);
  - `admin-catalog-category-detail.tsx:27` + `:38`;
  - `admin-catalog-write.tsx:163` (Add Job) y `:240` (Rename Job);
  - `admin-mechanics-list.tsx:41` + `:46`;
  - `admin-mechanic-detail.tsx:31`.

  Textos: `apps/web/src/lib/admin-messages.ts:88`, `:97`, `:372`, `:373`.
- **Evidencia:**
  - (observado) En el Catálogo, bajo "Job Catalog" van dos párrafos con casi la misma información, separados por un hueco (`00-catalogo-lista.jpg`):
    - el subtítulo: "Add a Job to an active Category, or rename and activate an existing Job. The Job id stays the same.";
    - debajo: "Manager or System Admin. Add a Job to an active Category so the same work always has the same name. Rename or activate keeps the Job id. Categories do not change here."
  - En el teléfono los dos ocupan media pantalla (`00-catalogo-movil.jpg`).
  - El diálogo "Rename Job" abre con el párrafo de "Add a Job…" (`00-catalogo-renombrar.jpg`).
  - En el detalle de una categoría y en el de una persona, el párrafo de la lista se repite tal cual.
- **Criterio:** Densidad y ruido · Jerarquía (el texto de ayuda compite con el título) · `components.md:19` (descripción de una línea como máximo)
- **Severidad:** 2 · Empuja la lista y la acción hacia abajo en cada visita. El usuario aprende a saltarlo, y entonces tampoco lee el aviso que sí importa ("Categories do not change here").
- **Recomendación:**
  - Borrar `AdminWriteTip` de las 8 ubicaciones y dejar solo el subtítulo de `PageHeader`, en una línea.
  - Las reglas que importan van en el sitio donde aplican: "The Job id stays the same" como descripción del diálogo Rename (`Modal description`). La redacción le corresponde a la skill 3.
- **Esfuerzo:** S

### Job Catalog — detalle de categoría

### UX-4-007 · El detalle es una lista plana con un botón igual en cada Job (cambia por decisión)
- **Dónde:** `/admin/catalog/categories/[id]` · `admin-catalog-category-detail.tsx:39-75`, `:53` (aliases en texto corrido) · `admin-catalog-write.tsx:89-91` (Rename Job `outline` por fila)
- **Evidencia:**
  - (observado) "Fuel System" muestra una tarjeta "Jobs" sin conteo. Cada Job es un nombre en 14 px medium, la línea "Aliases: Fuel Lines, lineas de combustible, líneas de combustible" y un botón "Rename Job" (`00-catalogo-categoria.jpg`).
  - Cuatro botones idénticos forman una columna de botones que pesa más que los nombres.
  - Los aliases casi duplicados se pierden en el texto corrido.
  - Un Job activo no muestra estado. Solo el inactivo lleva badge (`:50`).
  - La cabecera repite el subtítulo genérico del catálogo (`:27`), sin datos de la categoría.
- **Criterio:** Acción principal (botones repetidos del mismo peso) · Escaneabilidad · Consistencia con `SectionCard` y `ResponsiveMenu` (`components.md:80`)
- **Severidad:** 2 · Hoy solo se puede renombrar, así que se completa. Con la gestión del catálogo ya decidida (desactivar, aliases, protecciones), este formato no da abasto.
- **Recomendación:**
  - Cabecera: nombre, chip de estado y meta "4 Jobs · 1 inactive".
  - `SectionCard` "Jobs" con `CountChip`.
  - Cada fila: nombre (`card-title`), chip de estado, aliases como chips pequeños `outline`, para que se vean los casi duplicados, y "…" con Rename, Edit aliases y Activate / Deactivate.
  - Add Job sigue como única acción primaria de la cabecera.
- **Esfuerzo:** M

### Mechanics — lista

### UX-4-008 · "Add person" queda suelto bajo el título y los chips mezclan rol y tipo
- **Dónde:** `/admin/mechanics` · `admin-mechanics-list.tsx:39-48` (botón fuera de `PageHeader`), `:105-108` (chips), `:111` (conteo)
- **Evidencia:**
  - (observado) En Mechanics, "Add person" va debajo del subtítulo, alineado a la izquierda y seguido de un párrafo (`00-mechanics-lista.jpg`). En Job Catalog, "Add Job" está arriba a la derecha, en `PageHeader actions` (`admin-catalog-list.tsx:33`). Son dos pantallas hermanas con la acción principal en dos sitios distintos.
  - Los chips "Shop Admin · Standard · PM" de Cristian Perez son todos `outline` iguales. El rol de la cuenta no se distingue del tipo de mecánico.
  - "Open Work Orders" va alineado a la izquierda.
- **Criterio:** Consistencia visual entre pantallas · Color y énfasis · Alineación
- **Severidad:** 2 · Una acción que salta de sitio entre pantallas hermanas y unos chips que obligan a leer.
- **Recomendación:**
  - Mover "Add person" a `PageHeader actions`.
  - Un solo chip de tipo por persona (Standard / PM / Safety), y el rol de admin como chip `secondary` separado, o fuera de esta lista si no es del taller.
  - Conteo con `tnum text-right`.
- **Esfuerzo:** S

### Mechanics — detalle

### UX-4-009 · El detalle de la persona es una pila de tarjetas iguales, sin cabecera de estado
- **Dónde:** `/admin/mechanics/[id]` · `admin-mechanic-detail.tsx:26-30` (cabecera: nombre y email), `:32-33` y `:34-84` (cinco `Card` seguidas) · `admin-mechanic-roster.tsx:253-256` ("Name and type"), `:389-403` ("Access"), `:498` (Save siempre primario)
- **Evidencia:**
  - (observado) Daniel tiene arriba solo su nombre y su email. Lo primero que domina es un formulario: un campo de nombre, tres radios y un Save azul (`00-mechanics-detalle.jpg`).
  - Debajo hay cuatro tarjetas más del mismo peso: Access, Capabilities, Open Work Orders y Recent closed.
  - Una persona activa no lleva ningún chip "Active". El badge solo aparece si está inactiva (`:29`).
  - El tipo aparece dos veces: en los radios y en la tarjeta Capabilities (`:37`).
  - "Open Work Orders" aparece dos veces: como línea "Open Work Orders: 0" (`:40`) y como título de tarjeta (`:46`).
  - Deactivate y Reset password son dos `outline` iguales, a media página. El Save del formulario es `variant="default"` aunque no haya cambios.
  - Para decidir si se puede desactivar o sacar a la persona hay que saber cuánto trabajo tiene, y eso aparece solo en el diálogo, después de confirmar (`00-mechanics-desactivar-bloqueado-vs-0.jpg`). Que la cifra no coincida es de las skills 1 y 6.
- **Criterio:** Punto de entrada · Agrupación (tarjetas del mismo peso) · Acción principal · Consistencia con los detalles rediseñados (Truck y WO: cabecera con chip de estado y "…")
- **Severidad:** 3 · Es la pantalla de alta, cambio y baja de personas. Lo que se necesita para decidir (estado y carga) no está arriba, y la acción de baja queda al mismo nivel que restablecer la contraseña.
- **Recomendación (con "Remove" decidido):**
  - Cabecera como la del Truck:
    - nombre;
    - chips de estado (`success` "Active" / `secondary` "Inactive") y de tipo ("PM");
    - meta "9 Jobs pending · 3 completed" con `tnum`;
    - a la derecha, "Edit" (nombre y tipo, en un diálogo) y "…" con Reset password, Deactivate y Remove. Remove en `destructive`, separado por un divisor.
  - Cuerpo con dos `SectionCard`: "Open work" (`CountChip`, filas con el WO como enlace) y "Recent closed".
  - Quitar la tarjeta Capabilities: ya la cubren los chips.
  - Si el formulario sigue en línea, Save solo con cambios, como en UX-4-001.
- **Esfuerzo:** M

### UX-4-010 · El número de camión va en azul y no es enlace; el enlace va en blanco
- **Dónde:** `admin-mechanic-detail.tsx:52` y `:72` (`<p className="font-display text-base font-semibold text-primary">`), frente a `:55` y `:75` (`Link` con `text-foreground`)
- **Evidencia:** (inferido del código) en "Open Work Orders" y "Recent closed", el número de camión usa el color de acción sin ser clicable, mientras el enlace real (WO-003) va en el color del texto. En la lista de Mechanics y en el Catálogo, azul significa enlace (`admin-mechanics-list.tsx:88`, `admin-catalog-list.tsx:62`). Daniel no tenía filas en la captura, así que no se observó.
- **Criterio:** Color y énfasis (el color de marca se reserva para lo accionable)
- **Severidad:** 1 · Un clic en falso; se aprende rápido.
- **Recomendación:** que la fila entera, o el número de camión, sea el enlace, o pasar el número a `text-foreground` y dejar el azul para el enlace.
- **Esfuerzo:** S

### Consistencia entre pantallas de Setup

### UX-4-011 · Setup no usa el lenguaje visual de los rediseños y cada pantalla guarda distinto
- **Dónde:** los 7 componentes de Setup (`admin-shop-workflow.tsx`, `admin-catalog-*.tsx`, `admin-mechanic*.tsx`) frente a `docs/design-system/components.md:39`, `:78-80` y a `admin-truck-detail.tsx` / `admin-work-order-detail.tsx`
- **Evidencia:**
  - (inferido del código, ver el inventario) Setup usa 9 `Card` genéricas y 8 `AdminWriteTip`, y ningún `SectionCard`, `CountChip`, `ResponsiveMenu` ni chip de estado activo.
  - Los títulos de sección cambian según la pantalla:
    - `CardTitle` usa `.section-title` (18 px);
    - "Shop hours" usa `text-lg font-semibold` (`admin-shop-workflow.tsx:164`);
    - el `SectionCard` de los rediseños usa 16 px.
  - El botón de guardar se comporta distinto:
    - en Shop workflow está gris hasta que hay cambios (`:115`);
    - en el detalle de Mechanics es azul siempre (`admin-mechanic-roster.tsx:498`).
  - (observado) Comparando `00-catalogo-categoria.jpg` y `00-mechanics-detalle.jpg` con el Truck y la WO rediseñados, Setup se ve como una generación anterior: cabecera sin chips, sin "…" y con párrafos de ayuda.
- **Criterio:** Consistencia visual entre pantallas · Sistema de diseño aplicado
- **Severidad:** 2 · Cada pantalla se entiende sola, pero el Manager pasa de la WO a Setup y cambia de idioma visual. Y lo que en un sitio dice "guardado" en otro no.
- **Recomendación:** aplicar a Setup las reglas de la Etapa 8, aprovechando la revisión ya aprobada:
  - en los detalles, cabecera con chips de estado y "…";
  - secciones en `SectionCard` con `CountChip`;
  - acciones de fila en `ResponsiveMenu`;
  - un patrón único de guardado: pie con cambios pendientes y Save primario solo cuando hay cambios;
  - sin `AdminWriteTip`.
- **Esfuerzo:** M

## Inventario visual

Medido sobre `admin-shop-workflow.tsx`, `admin-catalog-list.tsx`, `admin-catalog-category-detail.tsx`, `admin-catalog-write.tsx`, `admin-mechanics-list.tsx`, `admin-mechanic-detail.tsx`, `admin-mechanic-roster.tsx` y `admin-write-tip.tsx`.

- **Tamaños de texto en las clases:**
  - 4 tamaños: `text-xs` (3), `text-sm` (27), `text-base` (3), `text-lg` (1);
  - a eso se suman `.page-title` y `.section-title` (vía `CardTitle`);
  - en total, 5 tamaños efectivos (12, 14, 16, 18 y 24/30 px). Encajan en la escala de `foundations.md:73-79`; no hay tamaños fuera de escala.
- **Botones:**
  - 28 `<Button>`: 16 `outline`, 5 `secondary`, 1 `destructive` y el resto `default`.
  - En las vistas de detalle hay hasta 2 primarios a la vez: Add Job en la cabecera más Activate en un Job inactivo; en Mechanics, Save del formulario y, si está inactiva, Reactivate.
- **Énfasis de color:**
  - azul para enlaces de lista y para el número de camión no clicable (UX-4-010);
  - `warning-foreground` para el dueño inactivo y el horario inválido;
  - no hay chips de estado positivos (Active) en ninguna pantalla.
- **Contenedores:** 9 `Card` genéricas, 2 `DataTable`, 0 `SectionCard`, 0 `CountChip`, 0 `ResponsiveMenu`, 0 `NextStepCallout`. La búsqueda del Catálogo va en su propia `Card` (`admin-catalog-list.tsx:36`), en vez de `AdminFilterToolbar` como en Mechanics.
- **Texto de ayuda:** 8 `AdminWriteTip`, además de los subtítulos de `PageHeader`.
- **Componentes duplicados:** no hay tablas ni modales duplicados. Todo pasa por `DataTable` y `Modal`.
- **Conclusión:** el sistema existe y se respeta en la escala tipográfica y en los componentes base. Lo que falta es aplicar las piezas de la Etapa 8 (secciones, menús de fila, chips de estado, guardado con cambios pendientes). Es un problema de aplicación, no de sistema.

## Corrida 2 · Parts & costs (2026-10-09)

### UX-4-012 · El detalle de la compra no responde primero "¿qué compré, a quién, cuánto y para qué camión?"
- **Dónde:** detalle de la compra (`/admin/parts/purchases/[id]`) · `apps/web/src/components/admin-purchase-detail.tsx`
- **Evidencia:** (observado) captura del dueño ("me parece un poco confusa o desorganizada"):
  - El total solo aparece al final de la tabla, en un bloque suelto a la derecha.
  - "Per truck" repite el mismo camión y el mismo total cuando hay un solo camión.
  - El archivo, las notas y "Loaded by" van juntos en una tarjeta "Invoice file".
  - El encabezado dice "Prueba · 123123", proveedor y número sin rótulo.
- **Criterio:** jerarquía visual (lo importante primero), agrupación por proximidad, Nielsen H8 (diseño minimalista)
- **Severidad:** 2 · Se entiende con esfuerzo; cada consulta obliga a recorrer la página
- **Recomendación:**
  - Una tarjeta de resumen arriba: Vendor, Invoice #, Invoice date, Truck(s), **Total** grande, Invoice file (Open) y "Loaded by …".
  - Debajo, Lines con Subtotal / Tax / Freight / Total como pie de la misma tabla.
  - "Per truck" solo cuando hay más de un camión o una parte sin camión.
  - Las notas, en su propia sección corta.
- **Esfuerzo:** S

## Lo que funciona bien
- **Las dos listas usan el mismo `DataTable`**, con la columna principal como enlace en negrita, y en el teléfono se vuelven tarjetas sin scroll horizontal. Hay que conservar esa base y ajustar solo qué columnas se muestran.
- **Shop workflow en el teléfono se lee bien:** una columna, el número de paso, el nombre y el select a ancho completo, con controles de 44 px.
- **La escala tipográfica se respeta.** No hay tamaños fuera de escala, ni mayúsculas, ni texto bajo 12 px en Setup.
- **El diálogo de desactivar distingue bien la acción:** Deactivate en `destructive`, Cancel en `outline`, y el bloqueo "Reassign first" en una caja tintada con la lista de WOs enlazadas.
- **Add Job en el Catálogo** está donde debe: arriba a la derecha, como única acción primaria de la cabecera.

## Fuera de alcance / no verificado
- **Medidas de estilo.** Sin navegador en esta corrida: no se midió con `getComputedStyle`. Los tamaños salen de las clases y de `foundations.md`. No hay capturas nuevas `04-*`; la evidencia son las capturas `00-*` de la skill 0.
- **Save gris después de un cambio (UX-4-001).** Se observó, pero el código dice que debería ponerse azul. Hay que reproducirlo con un clic real en la skill 7.
- **Producción con categorías inactivas** (Alignment, Air System): solo están en la captura del dueño. No se vio cómo pesa el badge "Inactive" en la tabla real.
- **Tema claro y español.** No se revisaron.
- **Partes y costos (decidido, etapa 1).** No hay pantalla que evaluar. Cuando se diseñe, debe nacer con `DataTable` y `SectionCard` y con la cabecera de estado de los rediseños, no con el formato actual de Setup.
- **Fuera de esta skill:**
  - el número de Open Work Orders que no coincide (Daniel 0 frente a 9) y el primer clic en la categoría que no navega: skills 1, 6 y 8;
  - la redacción de los textos: skill 3;
  - el back link frente al breadcrumb: skill 5.
