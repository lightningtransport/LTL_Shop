# Observaciones en el navegador (2026-10-07)

Demo local `ltl_shop_setup_demo`, como Manager, a 1440×900 y 375×812. Todas son **observadas**. Las capturas están en esta carpeta.

## Shop workflow (`/admin/setup/workflow`)
- **Pasos:** "PM A Service" (subtítulo PM), Alignment (Suspension & Steering), Detailing (Detailing) y Quality Check (Quality Check). Junto a QC va el texto "Safety (Quality Check) takes it from the queue".
  - Captura: `00-shop-workflow-desktop.jpg`.
- **Personas en cada lista:**
  - PM: solo Daniel.
  - Alignment y Detailing: los mismos 6 Standard (Alejandro 1 y 2, Anthony, Cristian, Elliot, John).
  - No hay ninguna pista de quién está ocupado, de la carga de trabajo ni de si la persona está activa.
- **Guardar:**
  - ~~El botón Save se ve igual, gris y apagado, antes y después de cambiar un dueño.~~ **Corregido:** Save pasa a azul con un cambio. La captura `00-shop-workflow-cambio-sin-guardar.jpg` se tomó durante la transición de color (ver el punto 5 de la reproducción).
  - Al guardar aparece el aviso "Shop workflow saved." abajo a la derecha (`00-shop-workflow-guardado.jpg`).
  - Shop hours tiene su propio "Save shop hours": dos botones de guardar en la misma página.
- **Teléfono:** se lee bien, todo en una columna (`00-shop-workflow-movil.jpg`).
- **Manager en `/qc`:** lo manda a `/admin` (Dashboard) sin ningún mensaje. En el Dashboard aparece "Waiting for Safety · Mark it here only if Safety cannot · Mark QC complete".
- **Dashboard:** "Missing required steps: This Work Order is missing: Detailing. Every Work Order needs PM, Alignment, Detailing and Quality Check. Each is added with its default owner." Muestra el botón "Add missing steps".

## Job Catalog (`/admin/catalog`)
- **Tabla:** Category | Jobs | Inactive Jobs | Aliases, con 17 categorías activas.
  - En la demo no aparecen Alignment ni Air System (el seed nuevo no los crea). En producción sí aparecen, con la etiqueta "Inactive" (captura del dueño).
  - En la demo PM tiene 6 Jobs; en producción, 7.
  - Captura: `00-catalogo-lista.jpg`.
- **Textos de arriba:**
  - El subtítulo dice "Add a Job to an active Category, or rename and activate an existing Job. The Job id stays the same."
  - Debajo hay un párrafo casi igual: "Manager or System Admin. Add a Job to an active Category so the same work always has the same name. Rename or activate keeps the Job id. Categories do not change here."
  - En el teléfono los dos ocupan media pantalla (`00-catalogo-movil.jpg`).
- **Clic en el nombre de la categoría:** el primer clic en "Fuel System" no navegó, solo hizo scroll. Navegando directo a la URL, el detalle sí carga.
- **Detalle de Fuel System:**
  - Cada Job es un nombre, una línea "Aliases: …" y un solo botón, "Rename Job".
  - No hay estado, desactivar, borrar ni editar aliases.
  - "Fuel Lines" muestra los aliases "lineas de combustible" y "líneas de combustible", casi duplicados (`00-catalogo-categoria.jpg`).
- **Diálogos:**
  - "Rename Job" repite el párrafo "Manager or System Admin. Add a Job to an active Category…", que no tiene que ver con renombrar (`00-catalogo-renombrar.jpg`).
  - "Add Job" dentro de una categoría pide solo "Job name" y repite el mismo párrafo (`00-catalogo-agregar.jpg`).
- **Teléfono:** la tabla se vuelve tarjetas con Jobs, Inactive Jobs y Aliases. Hay que hacer mucho scroll para 17 categorías.

## Mechanics (`/admin/mechanics`)
- **Lista:**
  - Columnas: Mechanics | Capabilities | Open Work Orders.
  - Arriba de la lista: buscador, "Show inactive", Clear y "Apply filters". El filtro necesita un clic en el botón.
  - El párrafo "Manager or System Admin. Open a person to…" va otra vez debajo de "Add person".
  - Captura: `00-mechanics-lista.jpg`.
- **Usuarios admin en la lista:** aparecen con etiquetas "Shop Admin · Standard · PM" (Cristian Perez, iBrain Admin).
- **Open Work Orders no coincide con la base.** En la demo, contando Work Orders abiertas con algún Job pendiente de esa persona:

  | Persona | Base | Pantalla |
  |---|---|---|
  | Alejandro 1 | 7 | 10 |
  | Alejandro 2 | 8 | 10 |
  | Anthony | 4 | 4 |
  | Daniel (PM) | 9 | 0 |

- **Detalle de Daniel** (`00-mechanics-detalle.jpg`):
  - Dice "Open Work Orders: 0", "Completed Jobs: 3" y "Job labor time is not available.".
  - Más abajo dice "No open Work Orders assigned." y "No closed Work Orders assigned to this mechanic.", aunque tiene 3 Jobs completados.
- **Desactivar a Daniel:**
  - El primer diálogo no avisa de nada: "This person will stop signing in… Nothing is deleted; their history stays." (`00-mechanics-desactivar-dialogo.jpg`).
  - Al confirmar, recién ahí aparece "Reassign first" con 9 Jobs "PM A Service" en WO-003…WO-016 y "Their labor time is running". Detrás, la misma página sigue diciendo "Open Work Orders: 0" (`00-mechanics-desactivar-bloqueado-vs-0.jpg`).
  - No hay forma de reasignar desde ahí, solo enlaces a cada WO.
- **Faltantes:** no hay botón para borrar ni para sacar a la persona. Los tipos son radios: Standard, PM, Safety (Quality Check).

## Partes
- No hay ninguna entrada de menú ni pantalla de partes en Setup. El menú tiene solo Mechanics, Job Catalog y Shop workflow.

## Reproducción del bloqueo de Shop workflow (2026-10-07, observado)

1. En Shop workflow se guardó Anthony como dueño de Alignment. Salió el aviso "Shop workflow saved."
2. En el perfil de Anthony se cambió Type de Standard a PM y se pulsó Save.
   - No hubo ninguna advertencia, aunque es el dueño por defecto de Alignment y tiene 4 Work Orders abiertas con Jobs de Inspection.
   - La pantalla pasa a decir "Capabilities: PM".
3. Se volvió a Shop workflow:
   - Alignment sigue mostrando "Anthony", sin marca de que ya no puede hacer ese paso.
   - Se cambió Detailing a John y se pulsó Save. El botón estaba habilitado.
4. Resultado: el mensaje "Could not save the shop workflow. Refresh and try again."
   - Refrescar no lo arregla.
   - Desde ese momento no se puede guardar ningún paso hasta quitar a Anthony de Alignment a mano, y la pantalla no lo dice.
5. **Botón Save, revisado en el DOM.** Con cambios está habilitado y es azul (`oklch(0.75 0.14 233)`, `bg-primary`). Las lecturas "grises" anteriores se tomaron con el panel del navegador oculto (`document.hidden = true`): así la transición de color no avanza, y al quitar la transición se ve el azul. No es un defecto.
