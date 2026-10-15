# Propuesta: inspección con hoja de chequeo y llantas (PSI y tread)

> **Estado (2026-10-14): construida y en producción** — PR 324 (IN-1 a IN-6) y 325 (IN-7, IN-8). Cómo funciona hoy: [`SYSTEM.md`](../../SYSTEM.md). Esta propuesta queda como referencia de diseño.

**Clasificación:** PROPUESTA, **ya construida** (2026-10-13, IN-1 a IN-8 en PR 324 y 325; ver [OPEN_ISSUES §1v](../../archive/OPEN_ISSUES_HISTORIAL_2026-10.md)). La app sigue esta maqueta; lo que quedó distinto o pendiente está en IN-7 e IN-8.
**Fecha:** 2026-10-13 (v1), con las respuestas del dueño el mismo día (v2) · **Rama:** `claude/inspection-form-tire-pressure-1e9e6c` · **Sin PR todavía.**
**Pantallas:**
- Paso Inspection del Truck (`/admin/trucks/[id]`, `InspectionControl` en `apps/web/src/components/admin-truck-work-plan.tsx`)
- Una pantalla nueva de inspección
- My work del Mechanic
- Setup → Inspection checklist
- People

**Origen:** la hoja en papel de Lightning Transport (Interior, Engine/Fluid, Exterior, 10 llantas con PSI y Tread /32, Notes, firma).
**Cómo encaja con lo que ya existe:** [`ENCAJE.md`](ENCAJE.md) (componentes, User Flows, JTBD, catálogo, choques con D14 / A26 / P3).

## Qué pasa hoy

- La inspección (D14, HU-M2) es solo **No issues found** o **Issues found**. En la base de datos es `ReadinessRequirement.outcome`.
- No queda qué se revisó, ni notas, ni presión ni tread. Lo encontrado se agrega a mano con Add work.

## 1. Cómo verla

```bash
python3 -m http.server 4458 --bind 127.0.0.1 --directory docs/proposals/inspection-checklist
```

Abrir `http://127.0.0.1:4458/mockup.html`. Es HTML estático con Tailwind por CDN y datos en memoria, y necesita internet. Funciona en teléfono y desktop, en claro y oscuro (botón del sol).

El botón **Demo** tiene tres grupos de estados:
- **Manager en el Truck:** sin empezar, en progreso, con defectos, revisar y guardar, guardada con issues, guardada sin issues.
- **Mechanic con permiso:** My work con "To inspect", inspeccionando, guardada, y lo que ve el Manager después.
- **Después de guardar:** agregar defectos, revisar lo agregado y reporte con agregados.
- **Setup:** Inspection checklist y People con "Can inspect trucks".

## 2. El flujo

1. **Truck 601 → Start inspection.** El botón está en el Next step y en el paso Inspection. Un Mechanic con permiso entra desde **My work → To inspect**.
2. **La hoja** tiene 53 puntos en Interior (15), Engine & fluids (12) y Exterior (26).
   - Cada punto se marca **OK · Defect · N/A**. Si se toca otra vez, se borra.
   - **Mark rest OK** marca de una vez lo que falta en cada sección.
   - Un **Defect** pide "What's wrong?" y muestra qué Job va a crear, o si va como nota a Detailing.
3. **Tires:** un diagrama con las 10 posiciones.
   - Al tocar una llanta se abre una hoja con PSI y tread, la lectura anterior y **Next tire**.
   - En desktop también hay una tabla.
   - Verde = OK. Ámbar = Watch, no crea Job. Rojo = Fix: crea **Flat Repair** si es por presión, o **Tires** si es por tread.
4. **Review** se activa cuando están los 53 puntos, las 10 llantas y la nota de cada defecto.
   - Muestra **Jobs to create**: los defectos del mismo Job se juntan en uno.
   - Muestra **Notes on steps**: la limpieza va a Detailing.
   - Muestra **To watch** (llantas en ámbar).
   - El Manager elige quién hace cada Job, o deja "Assign later".
   - Se firma con "I inspected Truck 601".
5. **Save · create N Jobs.**
   - Los Jobs quedan en Shop Work y la nota llega al paso Detailing.
   - El paso Inspection dice "Issues found · 4 Jobs · quién · cuándo · View report".
   - Si quedó un Job sin dueño, el Next step es el de hoy: "Nobody is assigned to Lights · Assign".
   - La tarjeta **Tires** muestra la lectura y cuánto bajó desde la anterior.
6. **Después de guardar (opción 2):** lo guardado no se edita.
   - **Add defects** (en el paso Inspection, en el reporte y en My work del Mechanic) reabre la hoja solo para marcar defectos nuevos. Lo ya marcado queda bloqueado y las llantas quedan como se anotaron.
   - Los defectos nuevos crean su Job. Si el Job ya está en la WO, solo se suma la nota.
   - Para quitar un defecto, se cancela su Job en la WO.

## 3. Cambios a la hoja en papel

- Ortografía: Winshield → Windshield, Grase → Grease, Gladhand → Gladhand seals.
- "Air Leaks" estaba dos veces; queda una.
- La presión de las llantas pasa a Tires; "Tire condition" sigue en Exterior.
- "running lights" estaba repetido; quedan "Tail / running lights" y "Brake lights".

## 4. Reglas que no cambian

- El resultado sigue siendo No issues found / Issues found y se guarda en el mismo requirement. Lo nuevo es que sale de la hoja.
- Los Jobs se crean con el mismo catálogo y el mismo Add work (`addJobs`). Asignar es el mismo Assign.
- Request Work (HU-ME4) sigue igual para lo que el Mechanic encuentra mientras trabaja.
- Safety solo hace QC (QC4).

## 5. Respuestas del dueño (2026-10-13)

| Pregunta | Respuesta | En la maqueta |
|---|---|---|
| ¿Quién inspecciona? | Los Managers. También los Mechanics que tengan el permiso activado en People | People → **Can inspect trucks**; My work → **To inspect** |
| ¿Los defectos crean Jobs o los sugieren? | **Los crean** al guardar. Cada defecto debe tener su categoría y su Job; si no existe, se agrega al catálogo | Todos los puntos apuntan a un Job. Faltan 7 Jobs en el catálogo ([ENCAJE §4](ENCAJE.md#4-catálogo-de-jobs-que-cada-punto-tenga-su-job)) |
| ¿Ejes por truck? | Por ahora todos los trucks tienen 10 llantas; los trailers vienen después | Fijo: steer + 2 drive |
| ¿Umbrales? | Dejar 110 / 95 PSI y tread mínimo 4/32 steer, 2/32 drive; se cambian después | Se editan en Setup → Inspection checklist → Tires |
| ¿Foto obligatoria? ¿Guardar incompleta? | Sin fotos en esta versión. **No se guarda** con puntos sin revisar | Se quitaron las fotos. Review queda apagado hasta completar todo |
| ¿Lista fija o editable? | Editable por el Admin y por el Manager | **Setup → Inspection checklist**: agregar, renombrar, cambiar el Job, desactivar, reordenar |

**Cambios en la maqueta por las respuestas:**
- Se quitaron *Must fix / Can wait*: si todo defecto crea su Job, no servían.
- Se quitó "No issues found (skip sheet)".
- La inspección guardada ya no tiene "Edit inspection".

## 6. Decisiones del dueño sobre los choques (2026-10-13, segunda ronda)

Ver [ENCAJE §6](ENCAJE.md#6-lo-que-choca-y-hay-que-decidir-antes-de-d41).

| # | Tema | Respuesta |
|---|---|---|
| a | D14 se reemplaza: inspecciona el Manager, o un Mechanic con *Can inspect trucks* | **Sí** |
| b | Excepción a A26: ese Mechanic crea Jobs, pero solo desde la inspección y sin dueño; el Manager los asigna | **Sí** |
| c | Qué pasa si hay que corregir una inspección ya guardada | **Opción 2: agregar sí, quitar no.** Se puede volver a abrir la hoja (**Add defects**) para marcar más defectos, que crean sus Jobs o suman su nota al Job que ya está. Lo guardado no cambia; para quitar un defecto se cancela su Job en la WO. El reporte muestra "Added later · quién · hora" |
| d | Dashboard (P3): los dos botones pasan a ser **Start inspection** | **Sí**: siempre se empieza la hoja |
| — | Nombres de los 7 Jobs nuevos del catálogo | **Sí**, son los que usa el taller |

Están todas respondidas y escritas como **D41** en [`docs/DECISIONS.md`](../../DECISIONS.md). Las historias son HU-M16, HU-ME7 y HU-M17 (y J20–J21) en [`docs/USER_FLOWS.md`](../../USER_FLOWS.md).
