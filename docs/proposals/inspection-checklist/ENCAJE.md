# Cómo encaja la hoja de inspección con lo que ya existe

**Clasificación:** PROPUESTA — análisis, sin código del producto.
**Fecha:** 2026-10-13 · **Rama:** `claude/inspection-form-tire-pressure-1e9e6c`
**Base:** respuestas del dueño del 2026-10-13 (ver [README §5](README.md#5-respuestas-del-dueño-2026-10-13)), `origin/main` en a7a79e2.

**Resumen:** encaja. Es la misma inspección de hoy (D14, HU-M2), pero con contenido, y usa piezas que ya existen. Hay cuatro puntos donde choca con reglas vigentes. Hay que decidirlos antes de programar (§6).

## 1. Dónde vive cada cosa

| Pieza nueva | Dónde va | Ya existe algo igual |
|---|---|---|
| Botón **Start inspection** | Next step y paso Inspection del Truck. Reemplaza los dos botones de hoy (`InspectionButtons`, `admin-truck-work-plan.tsx:470`) | Sí: el mismo lugar y el mismo NextStepCallout |
| La hoja | Pantalla propia: `/admin/trucks/[id]/inspection` para el Manager y `/mechanic/standard/inspect/[truckId]` para el Mechanic | No; es nueva |
| Llantas | Dentro de la hoja; última lectura en una tarjeta **Tires** en la columna derecha del Truck | La columna derecha ya tiene Truck details y Repair history |
| Revisar y guardar | Paso final de la hoja | El patrón de barra fija abajo de la WO ("Lista para cerrar") |
| Jobs creados | Shop Work del Work Plan, como cualquier Job | Sí: `addJobs` (`yard-work-plan.service.ts:173`) |
| Permiso del Mechanic | People → la persona → **Extra permissions** | Parecido a `quality_check.perform`, pero People hoy solo tiene el radio de tipo |
| Editar la lista | **Setup → Inspection checklist** (nuevo, entre Shop workflow y Job Catalog) | Mismo patrón de edición que Job Catalog |

## 2. Componentes: qué se reutiliza y qué es nuevo

**Se reutiliza tal cual** (`apps/web/src/components/ui.tsx` y vecinos):
- `SectionCard`: Interior, Engine & fluids, Exterior, Tires, Notes, Jobs to create, Checklist, Signature.
- `Badge`: success, warning y destructive con punto. `chip` para los contadores ("12/15").
- `Button`: default, outline, ghost y sm, con 44 px en el teléfono.
- `NextStepCallout`, con los tonos warning y success, para "Inspect the truck", el resultado y "Nobody is assigned to…".
- Bottom sheet / Dialog (`DialogContent`) para la hoja de cada llanta y para "Add check".
- La barra fija abajo, igual que la barra de cerrar la WO.
- La edición en Setup: los menús "…" (`ResponsiveMenu`) para Rename / Change Job / Deactivate, y la barra "Unsaved changes" del rediseño de Admin Setup.
- `useLocalDraft`, que ya guarda los borradores de notas y Request Work, para guardar el avance en el teléfono.

**Nuevo, pero derivado de algo que existe:**
- **OK · Defect · N/A por fila.** Es el control segmentado de Priority (`grid … rounded-lg bg-sunken p-1 ring-1 ring-border`) con tres opciones y color por estado. En el teléfono muestra solo íconos, salvo la opción elegida.
- **Chips para saltar de sección** en el teléfono: el mismo estilo que el chip de WO del Truck (`h-8 rounded-md border bg-card`).

**Nuevo de verdad:**
- **El diagrama de llantas.** Es el único componente sin antecedente. Son 10 botones de 60×78 px y caben en 375 px sin scroll horizontal (revisado).

**Conclusión:** no desorganiza. No agrega estilos ni tokens. Lo único nuevo es la grilla de llantas y una variante de tres opciones del control segmentado.

## 3. Flujos (USER_FLOWS)

### Historias que cambian

**HU-M2 · Inspeccionar y registrar lo encontrado (J1).** Se reescribe; el ID se mantiene, porque la demo lo usa como llave.
1. Admin → Trucks → el truck → **Start inspection**.
2. Revisa los 53 puntos con OK / Defect / N/A. Cada Defect pide "What's wrong?".
3. Anota PSI y tread de las 10 llantas.
4. **Review.** Ve qué Jobs se van a crear y elige quién hace cada uno, o "Assign later".
5. Firma y guarda. Los Jobs quedan en Shop Work. El resultado (Issues found / No issues found) sale solo.

| ¿Qué pasa si…? | Respuesta |
|---|---|
| Quedan puntos sin revisar o llantas sin lectura | **Review** está apagado y la barra dice cuántos faltan |
| Un Defect no tiene nota | No deja avanzar ("1 defect without a note") |
| Dos defectos apuntan al mismo Job (ej. Fog lamps + Brake lights → Lights) | Se crea **un** Job **Lights** con las dos notas. El catálogo no acepta Jobs duplicados (A24) |
| El Job ya está en la WO | No se duplica: la nota se agrega a ese Job |
| El defecto es de limpieza (Windows / Interior / Exterior clean) | No crea Job: va como nota al paso **Detailing**, que la WO ya trae (D13) |
| Una llanta queda en rojo | Crea **Flat Repair** si es por presión, o **Tires** si es por tread |
| Una llanta queda en ámbar | No crea Job; sale en "To watch" y en la tarjeta Tires |
| No elige quién hace un Job | Queda sin dueño, y el Next step de hoy dice "Nobody is assigned to Lights" (A3) |
| El truck no tiene WO abierta | Hoy el Next step sin WO es "New Work Order", así que la hoja se abre con la WO ya creada. Si en el futuro se inspecciona antes, guardar con defectos crea la WO (E12) |
| Cierra la app a mitad de la hoja | El avance sigue en el teléfono (`useLocalDraft`) |
| Encontró algo después de guardar | **Add defects** reabre la hoja solo para agregar. Cada defecto nuevo crea su Job, o suma su nota si el Job ya está en la WO. El reporte lo marca "Added later" (§6-c, opción 2) |
| Marcó un defecto que no era | Lo guardado no cambia. Se cancela ese Job en la WO, con las reglas de hoy |
| Cancela la visita y abre otra | La nueva WO empieza con la inspección pendiente, como hoy (A15c) |

**HU-M8 / HU-A2 · Setup.** Se agrega **Inspection checklist**:
- La editan el Admin y el Manager.
- Se puede agregar un punto, renombrarlo, cambiar el Job al que apunta, desactivarlo y reordenarlo.
- Cada punto debe apuntar a un Job del catálogo o a un paso (Detailing).
- Una inspección guardada no cambia si la lista cambia después.
- Los objetivos de PSI y tread también se editan ahí.

**HU-M9 · Agregar personal.** En People, cada Mechanic Standard o PM tiene **Can inspect trucks**. Safety no lo tiene, porque solo hace QC (QC4).

### Historia nueva

**HU-ME7 · Inspeccionar un truck (J1, Mechanic con permiso).**
1. En My work aparece **To inspect** con los trucks que esperan inspección.
2. **Start** abre la misma hoja que usa el Manager.
3. Al guardar, los Jobs se crean **sin dueño**.
4. El Manager los ve en el Truck ("Nobody is assigned to…") y en el Dashboard (Unassigned).

| ¿Qué pasa si…? | Respuesta |
|---|---|
| Le quitan el permiso | Desaparece "To inspect"; si la hoja está a medias, no la puede guardar |
| Dos personas abren la misma inspección | La segunda que guarda recibe "Already inspected by …" |
| El Mechanic quiere ver los Jobs que creó | Solo los ve si el Manager se los asigna (A5); el reporte queda en Repair history |

### Historias que no cambian
- HU-M3 (repartir el trabajo), HU-M4, HU-ME1–ME6 y HU-QC1.
- HU-ME4 (Request Work) sigue igual para lo que el Mechanic encuentra **mientras trabaja**. La inspección no lo reemplaza.

## 4. Catálogo de Jobs: que cada punto tenga su Job

El dueño pidió que todo defecto ya tenga su categoría y su Job. Hoy, de los 53 puntos:

**Ya tienen Job** (41 puntos): Lights, Wiring, Battery, Body Work, Doors, Mirrors, Wipers, Windshield, Brake Inspection, Air Leak, Air Lines, Air Dryer, Inspect Air System, Tires, Wheel Seals, Differential, Lubrication, Transmission, Steering, Coolant Service, Cooling Hoses, Engine Leak Repair, Derate Diagnose, EGR Service, DPF/DEF Service, Oil Change, Filter Service, Blower Motor y Climate System. Tres más van al paso Detailing.

**Faltan 7 Jobs** (cubren 9 puntos):

| Job nuevo | Categoría | Puntos que lo usan |
|---|---|---|
| Horn | Electrical & Starting | Horn |
| Radio & Phone | Electrical & Starting | Radio / cellphone |
| Parking Brake | Air & Brake System | Parking brake |
| Seats & Belts | Cab, Body & Glass | Driver seat & belts, Passenger seats |
| Safety Equipment | Cab, Body & Glass | Fire extinguisher |
| Fluid Top-Off | Preventive Maintenance (PM) | Fuel level, Washer fluid |
| Belts & Tensioners | Engine & Emissions | Belts / tensioners |

**Alias para que la búsqueda encuentre el Job** (D30):
- "warning lights" y "check engine" → Derate Diagnose
- "fuses" → Wiring
- "deer guard" → Body Work
- "breathers" → Differential

Se agregan como datos desde Job Catalog, igual que hoy. Un re-release no los borra (`applyJobCatalog` solo crea lo que falta). Antes de terminar la propuesta, revisar contigo si esos nombres son los que usa el taller.

## 5. Jobs to be done

- **J1** (Manager: llega un truck → saber qué hacer) queda **más fuerte**. Antes el Manager escribía a mano qué encontró; ahora sale del recorrido.
- **J2** (repartir el trabajo) queda igual. Asignar es el mismo Assign de hoy.
- **J6** (Mechanic: ver solo lo mío) queda casi igual. La excepción es "To inspect", que solo ve quien tiene el permiso, y solo son trucks esperando inspección.
- **J12** (agregar trucks y personal) gana el permiso en People.
- **Nuevo, sin número todavía:** "Manager: saber cómo están las llantas de un truck y si empeoran". Lo cubre la tarjeta Tires y la comparación con la lectura anterior.

## 6. Lo que choca y hay que decidir (antes de D41)

a. **D14 dice "la inspección la hace el Manager"**, y el cuestionario también ("Inspección de llegada: Siempre el Manager", DECISIONS:117). Con tu respuesta pasa a ser: "el Manager, o un Mechanic con *Can inspect trucks*". Esto **reemplaza** D14, no lo borra.

b. **A26: "el Mechanic no agrega Jobs".** Con tu respuesta, un Mechanic con permiso **sí crea Jobs**, pero solo desde la inspección y sin elegir dueño. La propuesta mantiene A26 para todo lo demás.

c. **Editar después de guardar.** *(Decidido el 2026-10-13: **opción 2**.)*
   - **El problema:** al guardar, cada defecto ya se volvió un Job de la WO, y un mecánico puede haberlo empezado. Si después alguien cambia un Defect a OK, ¿qué pasa con su Job? ¿Se cancela solo, aunque el mecánico ya le haya cargado tiempo? Y si el Job junta dos defectos (Lights = hazard + brake light) y solo uno pasa a OK, ¿qué se hace?
   - **Opción 1, solo lectura:** el reporte queda como se vio ese día. Lo que haya que corregir se hace en la WO: cancelar un Job o agregar uno con Add work. El error se atrapa antes de guardar, en Review.
   - **Opción 2, agregar sí, quitar no:** se puede reabrir la hoja para marcar **más** defectos, que crean más Jobs. No se puede pasar un Defect a OK; eso se hace cancelando el Job en la WO. El reporte muestra "Added later by X · hora".
   - **Opción 3, editable mientras el Job no haya empezado:** pasar un Defect a OK cancela su Job, si sigue en To do y sin tiempo. Si ya empezó, la app no deja y manda a la WO. Pasar OK a Defect crea el Job. En un Job compartido solo se quita esa nota. El reporte guarda quién cambió qué y cuándo.

d. **Dashboard (PENDIENTES_UI P3).** Hoy la fila de inspección del Dashboard tiene "No issues found" e "Issues found" juntos. Como ahora no se guarda sin revisar todo, esos botones se cambian por **Start inspection**, que abre la hoja.

**Otras notas:**
- **Se quitó Must fix / Can wait.** Con "todo defecto crea su Job" ya no cambiaba nada. La urgencia del truck sigue en Priority, en la WO.
- **Hueco que ya existe hoy** (no lo crea la propuesta). Si el Manager marca "Issues found" sin agregar Jobs, la fase dice Shop Work, pero el Next step no dice "agrega el trabajo" (`truck-next-step.ts` no tiene un tipo `add_work`). Con la hoja desaparece, porque los Jobs se crean solos. Si la hoja no se aprueba, hay que anotarlo en OPEN_ISSUES.

## 7. Qué tocaría construir (para dimensionar)

| Capa | Qué |
|---|---|
| Datos | Lista de inspección editable (sección, nombre, orden, Job o paso, activo) · inspección guardada con sus puntos (estado, nota) y una copia de la lista usada · lecturas de llantas por posición · `AppCapability` nueva `inspection.perform` · objetivos de PSI/tread por taller |
| API | Leer la lista · guardar la hoja: valida que esté completa, crea los Jobs (juntando los que se repiten, sin duplicar los que ya están, notas a Detailing) y deja el requirement en COMPLETED/REQUIRED como hoy · leer la última lectura de llantas · CRUD de la lista para Manager/Admin (`ManagerWritesGuard`) · el permiso en PATCH People |
| Web | La hoja · la hoja de cada llanta · Review · tarjeta Tires · "To inspect" en My work · Setup → Inspection checklist · el checkbox en People · Dashboard P3 |
| Catálogo | Los 7 Jobs y 4 alias de §4 |
| Docs | D41 (reemplaza D14) · HU-M2, HU-ME7, HU-M8/A2, HU-M9 en `USER_FLOWS.md` · `SYSTEM.md` (capability) · demo (`scripts.ts` mantiene HU-M2) |
| Pruebas | `test:real` del recorrido completo: Manager con defectos, Mechanic con permiso, sin permiso y lista editada |
