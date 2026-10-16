# Propuesta: ajustes de Safety en el Quality Check (D46)

**Clasificación:** PROPUESTA aprobada por el dueño el 2026-10-16. Se construye por etapas: SQ-1, SQ-2 y SQ-3. **SQ-4 (fotos y videos) queda declarada y no se construye** hasta que el dueño la pida.
**Origen:** cinco ajustes que el equipo le pasó al dueño para Safety, que es quien hace el QC (D19).
**Linear:** Epic LTR-229. Etapas: SQ-1 LTR-230, SQ-2 LTR-231, SQ-3 LTR-232, SQ-4 LTR-233 (Gated).

## 1. Lo que pidió el equipo y lo que hay hoy

| # | Pedido | Hoy (origin/main `3cf7298`) |
|---|---|---|
| 1 | Safety sube fotos y videos como evidencia | ❌ Solo existen los archivos de factura. D-QC7: "sin fotos por ahora" |
| 2 | Hallazgos que el Manager agrega como Job, o que suma a un Job que ya existe | ❌ Al devolver hay una sola nota libre; el Job que falló va como texto (`quality-check.service.ts`) |
| 3 | Safety ve la inspección (hoja D41) de esa WO, además de los Jobs hechos | ❌ Ve una línea ("Issues found"); el API de inspección no lo deja entrar |
| 4 | La cola es compartida y el primero que toma el camión hace el QC | ✅ Ya existe (Take, `QC_TAKEN`). El API todavía deja que el Manager asigne el QC (USER_FLOWS E9b) |
| 5 | El Manager no ve quién de Safety hizo el QC | ❌ El nombre sale en 8 lugares; D29 decía "queda registrado quién lo hizo" |

## 2. Lo que decidió el dueño (2026-10-16)

- **Nombre:** el Manager ve solo **"Safety"**, nunca la persona.
  - Los de Safety se ven entre ellos en `/qc`.
  - El registro interno guarda quién fue, pero ninguna pantalla del shop lo muestra, ni siquiera al System Admin.
- **Hallazgos:**
  - Al **devolver** son lo que falta arreglar y **frenan la salida**.
  - Al **aprobar** son observaciones que **no la frenan**; el Manager decide si las agrega como Job.
- **Asignación:** **se quita** que el Manager asigne el QC a alguien de Safety. El QC solo se toma desde la cola. El Manager sigue pudiendo hacerlo él mismo como respaldo desde `/qc` (D29).
- **Evidencia:** fotos y videos cortos, varios por hallazgo. **Se hace más adelante** (SQ-4).

## 3. Historias de usuario

**Safety, en el teléfono:**
- **HU-QC2: tomar un camión de la cola** (ya existe). La lista muestra los camiones listos para QC. El primero que toca **Take** lo hace; a los demás les dice "Ana already took this truck". El Manager no reparte.
- **HU-QC3: ver la inspección** (SQ-2). En la revisión, además de los Jobs hechos, la sección **Inspection** muestra la hoja que se llenó al llegar el camión:
  - los defectos con su nota;
  - las llantas en watch o en fix;
  - los Jobs que creó.

  Si no hubo hoja, dice "No inspection sheet".
- **HU-QC4: dejar hallazgos** (SQ-3).
  - Al **Return**, escribe uno o más hallazgos ("Luz de placa no prende"), cada uno con un Job sugerido del catálogo si lo sabe ("Lights"). El camión vuelve al shop.
  - Al **Approve**, puede dejar hallazgos que no frenan ("Calcomanía DOT despegada, revisar en la próxima visita").
- **HU-QC5: subir fotos y videos** (SQ-4, más adelante).

**Manager, en la Work Order:**
- **HU-M20: atender los hallazgos de Safety** (SQ-3).
  - La tarjeta **Safety findings** muestra cada hallazgo, firmado solo como "Safety", con tres acciones:
    - **Add as Job:** abre Add work con el Job sugerido.
    - **Add to <Job>:** lo suma a un Job abierto.
    - **Not now:** pide motivo.
  - Atender un hallazgo de devolución resuelve la devolución, igual que hoy (LTR-217).
  - Un hallazgo que no frena queda en **Needs attention** del Dashboard hasta que se atienda.
- **HU-M21: no saber quién de Safety hizo el QC** (SQ-1). La WO, el historial, la devolución, el Dashboard y el work plan dicen "Safety".

**Mecánico:** en su Job ve "From Safety QC: Luz de placa no prende", sin nombre.

## 4. Reglas (D46)

1. **Enmascarar en el API.** Cuando quien mira no es de Safety, toda persona con rol Safety sale como `{ id: 'safety', name: 'Safety' }`. Las pantallas no cambian de lógica y el dato nunca llega al navegador del shop.
2. **Asignar el Job de QC desde el Admin** → 400 `QC_ASSIGN_NOT_ALLOWED`.
3. **Un hallazgo** tiene texto, un Job sugerido opcional, el tipo (`blocking` o `note`) y su resolución (`job_added`, `added_to_job` o `dismissed` con motivo). Queda ligado al Job con `WorkOrderJobSource` kind `qc_finding`.
4. **D-QC3 sigue:** al devolver se puede marcar el Job que falló.
5. **D-QC7 sigue vigente** hasta SQ-4: sin fotos.

## 5. Etapas

| Etapa | Qué | Migración |
|---|---|---|
| **SQ-1** | Nombre oculto para el Manager; el QC no se asigna | No |
| **SQ-2** | Safety ve la inspección de la WO (solo lectura) | No |
| **SQ-3** | Hallazgos al devolver y al aprobar → el Manager los agrega como Job | Sí |
| **SQ-4** | Fotos y videos (**declarada, no se construye todavía**) | Sí |

### SQ-4 · Fotos y videos (diseño para cuando se pida)
- **Almacenamiento:** bucket privado `qc-evidence`.
  - Fotos JPEG, PNG y HEIC, achicadas en el teléfono a 1600 px.
  - Videos MP4 y MOV de hasta 50 MB (el límite por archivo de Supabase), de unos 30 s.
  - Varios archivos por hallazgo.
- **API:** se generaliza `InvoiceFiles` a `PrivateFiles` con bucket por uso. `AttachmentOwnerType` suma `qc_finding`. Hay una URL firmada para subir y un link de 5 minutos para ver.
- **Teléfono:** "Add photo / video" abre la cámara y muestra el progreso de la subida.
- **Manager:** ve miniaturas sin el nombre de quien las subió.
- **Sin almacenamiento configurado**, el hallazgo se guarda sin archivos.

## 6. Qué no cambia
- La cola, Take, Let go, el orden por urgencia y las pestañas Returned/Done (D-QC1, D-QC2, D-QC5, D-QC6).
- El Manager como respaldo en `/qc` (D29).
- La inspección (D41): Safety solo la lee.
- La demo: no se toca hasta que el dueño avise.
