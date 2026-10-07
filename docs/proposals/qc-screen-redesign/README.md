# Propuesta: rediseño de la pantalla de Safety (Quality Check)

**Clasificación:** PROPUESTA — no es el estado actual de la app.
**Fecha:** 2026-10-07 · **Rama:** `claude/qc-screen-proposal` · **Aprobada (2026-10-07) y construida en la rama `claude/qc-redesign` (etapas QC-1 a QC-3).**
**Pantalla:** `/qc` → `apps/web/src/components/quality-check-page.tsx`
**Reglas que no cambian:** D19 (el QC lo hace Safety; toma, aprueba o devuelve con nota) y
[HU-QC1](../../USER_FLOWS.md) (quién ve qué y qué se rechaza). Hallazgos en
[`OPEN_ISSUES.md` §1j](../../OPEN_ISSUES.md) y en la auditoría
[`docs/ux-audit/safety-qc/`](../../ux-audit/safety-qc/00-contexto.md) (skills audit-ux 0, 1, 4 y 6).

## 1. Cómo verla

Abre [`mockup.html`](mockup.html) en el navegador (un solo archivo, sin instalar nada). Arriba a la
derecha: teléfono o computadora, claro u oscuro, y **Demo**, con un botón por situación:

- lista normal;
- el camión es mío;
- lo tomó la otra persona de Safety;
- lista vacía;
- un camión que sale pronto;
- cargando;
- error.

Todos los botones funcionan con datos de ejemplo.

## 2. Para qué sirve la pantalla

Safety (dos personas, en el patio, con el teléfono) revisa cada camión cuando **todo lo demás ya
está hecho**, y decide: **aprobar** (el Manager ya puede cerrar) o **devolver** con lo que encontró
(el Manager agrega el trabajo). La pregunta de la pantalla es: *¿qué camión reviso ahora y qué se le
hizo?*

## 3. Lo que está mal hoy (revisión del 2026-10-07 con la base demo)

| # | Qué pasa | Efecto |
|---|---|---|
| Q1 | **La lista no cambia al tocar Take, Approve o Return** (la API respondía la lista de antes del cambio). | Safety cree que no funcionó y toca otra vez. **Arreglado** en el PR #250. |
| Q2 | **No se ve qué se le hizo al camión**: solo los nombres de los Jobs y de los mecánicos. No están las notas de cierre, el millaje y las piezas del PM, la inspección, los bloqueos que hubo ni la ubicación. | Para revisar, Safety tiene que preguntar al mecánico o al Manager. |
| Q3 | **El orden es solo "el que lleva más tiempo listo".** No se ve la prioridad ni si Dispatch lo espera hoy. | Un camión que sale en una hora puede quedar abajo. |
| Q4 | **Aprobar es un toque, sin confirmar**, y no se puede deshacer desde Safety. | Un toque por error deja el camión listo para cerrar. |
| Q5 | **Un camión tomado no se puede soltar.** Si Safety 1 lo toma y se va, Safety 2 no puede hasta que el Manager lo reasigne. | El camión queda trabado. |
| Q6 | **Devolver pide solo texto libre.** No se puede decir qué Job falló. | El Manager tiene que adivinar dónde agregar el trabajo. |
| Q7 | **No hay historial propio** (qué aprobé o devolví hoy) ni búsqueda de camiones, a diferencia de los mecánicos (My work · Trucks · Completed). | Safety no puede responder "¿ya revisé el 606?". |
| Q9 | **Lo escrito al devolver se pierde** si se cierra la hoja (Esc o toque fuera) o si la sesión vence (UX-1-006, UX-6-003). | Safety vuelve a escribir el defecto, de pie en el patio. |
| Q10 | **Sin conexión salen dos avisos rojos** ("la lista no cargó" y "no se pudo llegar al Shop") encima de la lista, que sigue con "Take" activo (UX-6-002). | Safety no sabe si su acción se hizo. |
| Q11 | **Los Jobs y los mecánicos cambian de orden** entre una carga y otra (UX-1-009). | La tarjeta parece otra al volver a mirarla. |
| Q8 | **El estilo es el de antes de la Etapa 8**: tarjetas sin jerarquía, el camión tomado se marca solo con un borde, los botones no tienen icono. | No se parece al resto de la app. |

## 4. Qué cambia (la maqueta)

1. **Lista "To review"** ordenada por urgencia:
   - **Primero, lo que sale pronto según Dispatch** (con un chip ámbar "Leaves today 3:00 PM").
   - **Después, Critical y High.**
   - **Al final, el que lleva más tiempo listo.**

   Cada tarjeta muestra:
   - "Truck 606", el vehículo, el WO en letra mono y "Ready 18 h".
   - Los Jobs hechos como chips, con el avatar de quien los hizo.
   - El lugar en el patio, si Dispatch lo sabe.
   - Un estado claro: **Disponible** (botón "Take"), **Mío** (borde primario y "Continue review") o **Tomado por Safety 2** (atenuado, sin botón).
2. **Revisión del camión**: una hoja a pantalla completa en el teléfono y un panel a la derecha en la
   computadora. Muestra todo lo que Safety necesita para decidir, sin salir de la pantalla:
   - El camión: vehículo, VIN, millaje y ubicación.
   - **Qué se hizo**: cada Job con quién, cuándo y su nota de cierre; el PM con el millaje y las piezas.
   - La inspección de llegada, con su resultado y fecha.
   - Los bloqueos que tuvo y cómo se resolvieron.
   - Las devoluciones anteriores de Safety, si las hubo.

   Al pie, fijos: **Return** (con borde) y **Approve** (principal). En "…": **Let go** (soltarlo para la
   otra persona).
3. **Aprobar confirma** en una hoja corta: "Approve Truck 606? The Manager can then close WO-006."
4. **Devolver**:
   - La nota sigue siendo obligatoria.
   - Además, se puede marcar **qué Job falló** (chips con los Jobs hechos) u **"Other"**.
   - El Manager lo ve en el bloqueo "Devuelto por Safety", con la nota y el Job.
5. **Pestañas abajo**, como los mecánicos:
   - **To review**.
   - **Returned**: los que esperan al Manager, con la nota y desde cuándo.
   - **Done**: lo que aprobé o devolví, hoy y en los últimos 7 días.
6. **Estados**:
   - Vacío: "Nothing to review. Trucks appear here when every other step is done."
   - Cargando, con esqueletos.
   - Error, con "Retry".
   - "Lo tomó otra persona mientras mirabas": aviso y la lista se actualiza.
   - Sin conexión: una sola franja "Offline · showing the list from 10:42", con las acciones desactivadas
     (Q10).
   - El borrador de la nota de devolución se guarda por camión hasta que se devuelve (Q9).
7. **Estilo de la Etapa 8**:
   - Las mismas primitivas: tarjetas, chips con punto, botones con icono y hojas inferiores.
   - Avatares de color por mecánico.
   - Claro y oscuro.
   - Toques de 44 px y textos de 16 px en los campos.

## 5. Qué necesita la API (todo aditivo)

| Cambio | Para qué |
|---|---|
| `GET /qc/:workOrderId` (solo Safety, solo si el camión está en su lista o es suyo) | La revisión: Jobs con quién, cuándo y nota de cierre; servicio PM; inspección; bloqueos resueltos; devoluciones anteriores; datos del camión y ubicación. |
| `POST /qc/:workOrderId/release` | "Let go" (Q5): el QC vuelve a estar libre. Queda en el Activity Log. |
| `jobId` opcional en `POST /qc/:workOrderId/return` | El Job que falló (Q6). Se guarda en el bloqueo. |
| En la lista: `priority`, `leavesOn` (Dispatch) y `location` | El orden y los chips (Q3). |
| `GET /qc/history?days=7` | La pestaña Done (Q7). |

Ningún campo existente cambia. Safety sigue sin poder hacer nada fuera de `/qc` (QC4).

## 6. Decisiones del dueño

**Decididas el 2026-10-07: todas como la recomendación.** Las siete se construyen como dice la columna de la derecha.

| # | Pregunta | Decisión |
|---|---|---|
| D-QC1 | **¿Aprobar pide confirmar?** | **Sí, una hoja corta** (como D27 para cerrar). Aprobar deja el camión listo para cerrar y Safety no lo puede deshacer. |
| D-QC2 | **¿Safety puede soltar un camión tomado ("Let go")?** | **Sí.** Si no, el camión queda trabado hasta que el Manager lo reasigne. |
| D-QC3 | **¿Al devolver se marca qué Job falló?** | **Sí, opcional** (chips + "Other"); la nota sigue obligatoria. |
| D-QC4 | **¿Una lista de cosas a revisar (checklist: luces, llantas, frenos, fluidos…)?** | **No por ahora.** No sabemos qué revisa Safety en el taller. Si se quiere, la armamos con ellos después: es una decisión de proceso, no de pantalla. |
| D-QC5 | **¿Orden por urgencia (sale pronto → prioridad → más tiempo listo)?** | **Sí.** Usa los mismos datos de Dispatch que "Leaving soon" (P1: confiables). |
| D-QC6 | **¿Pestañas Returned y Done (historial de Safety)?** | **Sí**, como My work · Completed de los mecánicos. |
| D-QC7 | **¿Fotos al devolver?** | **No por ahora** (necesita almacenamiento y permisos de cámara). Queda anotado para después. |

## 7. Plan de implementación (cuando el dueño apruebe)

Un commit por etapa, cada una con sus pruebas: unitarias, e2e de la pantalla de Safety y `test:real`
para la API. Cada etapa se compara con la maqueta usando capturas en teléfono y computadora, claro y
oscuro.

1. **API:**
   - El detalle `GET /qc/:id`.
   - Los campos nuevos de la lista (prioridad, salida y ubicación).
   - "Let go".
   - El `jobId` opcional al devolver.
   - El historial.
2. **Lista** con el orden por urgencia, las tarjetas nuevas y los estados.
3. **Revisión** (hoja o panel) con Approve, Return y "Let go".
4. **Pestañas** Returned y Done.
5. **Verificación final:**
   - `ui-audit` con la cuenta de Safety, en inglés y español, claro y oscuro, teléfono y computadora.
   - Docs: `SYSTEM.md`, `USER_FLOWS` HU-QC1 y `design-system`.

## 8. Notas de la maqueta

- Los datos son de ejemplo: camiones 606, 918 y 602; mecánicos MG, MA, MD y MPM.
- "Hoy" es el 7 de octubre de 2026.
- Las acciones cambian la maqueta sin guardar nada. "Reset" la vuelve al principio.
- Usa los mismos colores (tokens) que las maquetas del Admin y que `globals.css`.
