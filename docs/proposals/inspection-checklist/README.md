# Propuesta: inspección con hoja de chequeo y llantas (PSI y tread)

**Clasificación:** PROPUESTA — no es el estado actual de la app. Solo maqueta, sin código del producto.
**Fecha:** 2026-10-13 · **Rama:** `claude/inspection-form-tire-pressure-1e9e6c` · **Sin PR todavía.**
**Pantallas:** el paso Inspection del Truck (`/admin/trucks/[id]`, `apps/web/src/components/admin-truck-work-plan.tsx` → `InspectionControl`) y una pantalla nueva de inspección.
**Origen:** la hoja en papel de Lightning Transport que usaban el Manager y los Mechanics: Interior Checks, Engine/Fluid Level, Exterior Checks, 10 llantas con PSI y Tread /32, Notes e Inspector Signature.

## Qué pasa hoy

- La inspección (D14, HU-M2) es un sí o un no: **No issues found** o **Issues found**. En la base de datos es solo `ReadinessRequirement.outcome`.
- No queda qué se revisó, notas, fotos, presión ni tread. Lo encontrado se vuelve Jobs que el Manager agrega a mano con Add work.
- No hay ningún campo de llantas, posiciones ni ejes en `schema.prisma`.

## 1. Cómo verla

```bash
python3 -m http.server 4458 --bind 127.0.0.1 --directory docs/proposals/inspection-checklist
```

Abrir `http://127.0.0.1:4458/mockup.html`. Es HTML estático con Tailwind por CDN y datos de prueba en memoria; necesita internet. Se puede ver en teléfono y en desktop, en claro y en oscuro (botón del sol).

El botón **Demo** tiene seis estados:

- Sin empezar
- En progreso
- Con defectos
- Terminar (resumen)
- Guardada · issues
- Guardada · sin issues

También cambia quién inspecciona: Manager o Mechanic.

## 2. El flujo

1. **Truck 601 → Start inspection.** El botón aparece en el Next step y en el paso Inspection del Work Plan. "No issues found (skip sheet)" sigue como un link chico, para no romper el camino rápido de hoy.
2. **La hoja.** Tiene 53 puntos en tres tarjetas que se pueden plegar (Interior 15, Engine & fluids 12, Exterior 26).
   - Cada punto tiene **OK · Defect · N/A**. Si se toca otra vez, se borra.
   - En el teléfono solo se ven los íconos, salvo en el que está elegido.
   - **Mark rest OK** marca como OK lo que falta en esa sección.
3. **Defect** abre en la misma fila:
   - "What's wrong?" (obligatorio)
   - **Must fix / Can wait**
   - **Add photo**
   - el **Job sugerido** del catálogo real (ej. Brakes → Brake Inspection · Air & Brake System)
4. **Tires.** Es un diagrama del truck visto desde arriba, con las 10 posiciones de la hoja: LF y RF; LFO, LFI, RFI y RFO; LRO, LRI, RRI y RRO.
   - Al tocar una llanta se abre una hoja con PSI y tread, botones − / +, la lectura anterior y **Next tire**, que da la vuelta en orden.
   - En desktop también hay una **Table** para escribir rápido con Tab.
   - Colores: verde si está en rango. Ámbar si está a ±10 % del objetivo o el tread está cerca del mínimo. Rojo si está a ±20 % o el tread está bajo el mínimo.
5. **Notes** y una barra fija abajo con el avance ("41 of 53 items · 7 of 10 tires") y **Review**.
6. **Review inspection.**
   - El resultado sale solo: con un Must fix o una llanta en rojo es **Issues found**; si no, **No issues found**.
   - Debajo va la lista de hallazgos. Si inspecciona el Manager, cada hallazgo tiene **Add Job** y **Who does it?**: los Must fix vienen marcados y los Can wait / Watch no.
   - Avisa si quedan puntos sin revisar, llantas sin lectura o defectos sin nota.
   - Se firma con "I inspected Truck 601", con el usuario de la sesión, en lugar de la firma en papel.
7. **Truck después.**
   - El paso Inspection dice "Issues found · 3 · Crixcrox · Oct 13, 8:47 AM", con **View report** y **Edit inspection**.
   - Shop Work ya trae los Jobs que salieron de la inspección.
   - Hay una tarjeta **Tires** en la columna derecha con la última lectura y cuánto cambió desde la anterior (ej. LFO ↓ 22 PSI desde Sep 12).

**Si inspecciona un Mechanic:** ve la misma hoja, sin la barra lateral del Admin. Sus hallazgos le llegan al Manager como **Request Work** (como en HU-ME4). El Mechanic no crea Jobs ni elige quién los hace.

## 3. Cambios a la hoja en papel

- Ortografía: Winshield → Windshield, Grase → Grease, Gladhand → Gladhand seals.
- "Air Leaks" aparecía dos veces; queda una.
- "Tire condition/air pressure" se divide: la condición queda en Exterior y la presión pasa a Tires.
- "Brake lights/running lights" y "Tail lights/running lights" repetían "running lights"; quedan "Tail / running lights" y "Brake lights".

## 4. Reglas que no cambian

- D14: la inspección se registra en el Truck, y el resultado sigue siendo No issues found o Issues found. Lo nuevo es que sale de la hoja.
- Los Jobs se crean con el mismo Add work y el mismo catálogo (`apps/api/prisma/job-catalog.ts`). La hoja solo los sugiere.
- Request Work (HU-ME4) sigue siendo la forma en que un Mechanic pide trabajo.

## 5. Preguntas abiertas (para el dueño, todavía sin número D)

1. ¿Inspeccionan el Manager y el Mechanic, o solo el Manager, como dice D14 hoy?
2. ¿Los defectos **crean** Jobs solos, o solo los **sugieren**, como en la maqueta?
3. ¿La lista de puntos queda fija, o el dueño la edita en Admin Setup?
4. ¿Todos los trucks tienen 10 llantas (steer + 2 drive), o hay que definir los ejes por truck (2 ejes, trailers, super singles)?
5. ¿Qué umbrales de PSI y tread usa el taller? En la maqueta: 110 PSI steer, 95 PSI drive y tread mínimo 4/32 steer y 2/32 drive (los mínimos DOT).
6. ¿La foto es obligatoria en un defecto Must fix?
7. ¿Se puede guardar con puntos sin revisar, o hay que terminar todo?

## 6. Qué haría falta construir (si se aprueba)

Es solo para dimensionar; no está hecho.

- **Base de datos:**
  - una inspección con sus puntos (estado, nota, severidad)
  - lecturas de llantas por posición (PSI, tread, fecha)
  - fotos (`AttachmentOwnerType` hoy no permite inspección)
- **API:** guardar el avance de la hoja, terminarla (calcula el resultado y lo pasa al requirement de hoy) y leer la última lectura de llantas por Truck.
- **Web:** la pantalla de la hoja, la hoja de llantas, el resumen y la tarjeta Tires del Truck.
- **Docs:**
  - D41 con las respuestas
  - ajustar HU-M2 y HU-ME4 en `USER_FLOWS.md`
  - prueba real en `test:real` del flujo completo
