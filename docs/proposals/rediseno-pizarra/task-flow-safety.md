# Task flow: un día de Safety (Quality Check) con la pizarra

**Estado:** propuesta, parte de [`README.md`](README.md). Describe cómo **sería**, no cómo funciona
hoy. Safety son dos personas, en teléfono o iPad (`/qc`, LTR-272).
**Resumen:** la pantalla de Safety casi no cambia, porque ya se rediseñó y probó (QC1–QC13, D19,
D46). Lo que cambia es **cuándo le llega un camión**: solo si el QC se requiere. Y su devolución ahora
**crea el trabajo correctivo**, sin esperar al Manager.

---

## 1. El QC en el modelo nuevo

El QC deja de ser un paso fijo de todos los camiones y pasa a tener **su propio estado**, separado
de los trabajos (prompt §8.1 E):

| Estado del QC | Quién lo pone | Qué significa | ¿Safety lo ve? | ¿Se puede liberar el camión? |
|---|---|---|---|---|
| **To decide** | La plantilla (Passing through, Other) | Nadie decidió todavía | No | No |
| **Not required** | El Manager, con motivo (P46) | Este camión no necesita QC | No | Sí, si lo demás está hecho |
| **Required** | La plantilla (End of contract) o el Manager | Necesita QC; espera que termine el trabajo | En "Coming" | No |
| **Ready for Safety** | La app, cuando todo lo demás está hecho o no requerido | Listo para revisar | **En "To review"** | No |
| **In review** | Safety, al tomarlo | Alguien de Safety lo está revisando | Sí, "Taken" | No |
| **Passed** | Safety (o el Manager como respaldo, D29) | Aprobado | En "Done" | Sí |
| **Failed** | Safety | Devuelto con nota; trabajo correctivo abierto | En "Returned" | No |

**Cómo se guarda sin migración:**
- **To decide:** la visita todavía no tiene Job de QC.
- **Required:** el Job de QC existe en `to_do`, como hoy.
- **Not required:** el Job de QC queda cancelado con motivo.

La cola de Safety ya ignora un QC cancelado (`qcJobOf`, `quality-check.service.ts:89`), así que
`/qc` no cambia para eso. Lo que sí cambia: hoy un paso sin Job pide "Add missing steps" y el QC no
se puede cancelar (D55 R9). Eso es parte de RP-1.

---

## 2. Un día de Safety

| Hora | Qué pasa | Pantalla | Qué hace | Toques |
|---|---|---|---|---|
| 7:30 | Empieza | `/qc` → To review | Ve la lista ordenada por urgencia: sale pronto → ★ → más tiempo esperando (D-QC5) | 0 |
| 7:35 | El 901 está listo y sale el jueves | To review → 901 | **Take**. La otra persona de Safety lo ve tomado | 1 |
| 7:40 | Revisa el 901 | Revisión del camión | Ve qué se hizo, quién y cuándo, las notas, el PM y la hoja de inspección (solo lectura, D46) | — |
| 8:00 | Encuentra un espejo flojo | Return | Escribe la nota, marca el hallazgo "Mirror loose" con el Job sugerido "Mirror" y devuelve | 4–5 |
| 8:00 | **(nuevo)** El correctivo aparece solo | — | "901 · Mirror · Available" en la columna Repairs de la pizarra; un mecánico general lo toma | 0 |
| 9:15 | El 804 vuelve (su correctivo de ayer está hecho) | To review → 804 | Take → revisa → **Approve** (con la hoja de confirmación, D-QC1) | 3 |
| 9:16 | El 804 pasa a "Ready to release" en la pizarra del Manager | — | Nada | 0 |
| 10:30 | Mira qué viene | **Coming** (nuevo) | Ve el 927 y el 918 con su trabajo pendiente, para planear la tarde | 0 |
| 11:45 | Tiene que salir | 927 tomado | **Let go**: vuelve a la lista para la otra persona (D-QC2) | 1 |
| 1:40 | El 901 vuelve con el espejo arreglado | To review → 901 | Take → revisa solo lo que devolvió → Approve | 3 |
| 4:30 | Cierre | Done | Lo que aprobó y devolvió hoy, con la nota completa (LTR-273) | 0 |

**Lo que Safety no ve:** el 705 (Passing through, QC no requerido) y el 918 mientras su QC esté en
"To decide". **Lo que Safety no hace:** inspeccionar, asignar, liberar ni decidir si un camión
necesita QC (eso es del Manager, P46). El mecánico nunca puede aprobar un QC (`quality_check.perform`).

---

## 3. Qué cambia, comparado con hoy

| Tema | Hoy | Propuesta | Cambio en código | Horas |
|---|---|---|---|---|
| Qué camiones le llegan | Todos (el QC es obligatorio y no se cancela) | Solo los de QC Required | RP-1 (QC no requerido como Job cancelado; quitar R9 solo para "Not required" del Manager) | incluido en RP-1 |
| Pantalla `/qc` | Review · Returned · Done | Igual, más **Coming** (solo lectura: camiones Required con trabajo pendiente) | Una consulta más en `getQueue` | 1–2 |
| Al devolver | Queda un bloqueo "Returned by Safety"; los hallazgos esperan a que el Manager los agregue como Job (D46 / SQ-3) | **El hallazgo con Job sugerido crea el Job Available** en su columna; el bloqueo se resuelve con ese Job como respuesta (como LTR-217). El hallazgo sin Job sugerido sigue esperando al Manager | `returnTruck` usa el mismo camino que "Add to Work Plan" con `qcFindingIds` (`qc-findings.service.ts`) | 3–4 |
| Repetir el QC | Siempre vuelve a To review cuando el correctivo está hecho | Igual (P55) | 0 | 0 |
| Quién de Safety lo hizo | El Manager ve "Safety" (D46) | Igual; la pizarra dice "Safety", nunca el nombre | 0 | 0 |
| El Manager como respaldo | `/qc` (D29) | Igual; se llega desde la columna QC de la pizarra | Un enlace | 0.5 |
| Gerencia | — | "Shop today" puede sumar "QC passed / returned today" | Una consulta | 1 (P1) |

**Total para Safety:** 5–7 h, sin migración. RP-1 sube de 10 h a 15–17 h si se incluye la
creación del correctivo.

---

## 4. Ejemplos del prompt (§8.1 C), con el modelo nuevo

| Camión | Trabajos | QC | Resultado |
|---|---|---|---|
| **901** End of contract | PM, Alignment, Detailing, Repairs: Done | Required → Ready for Safety → Passed | Ready to release |
| **705** Passing through | Fuel filter: Done | Not required · "Filter only" · Cristian | Ready to release, sin pasar por Safety |
| **804** End of contract | PM y Alignment Done; Air leak (correctivo) Blocked · Waiting for parts | Failed · corrective work open | Not ready. Cuando el correctivo se completa, vuelve a To review |

---

## 5. Preguntas para Safety y el dueño

1. **P46:** ¿solo el Manager decide "QC not required", o Safety también puede?
2. **P54:** al devolver, ¿el hallazgo con Job sugerido crea el trabajo solo? Recomendación: sí; el
   Manager lo puede cancelar con motivo si no aplica.
3. **P55:** ¿Safety puede decir al devolver "no hace falta repetir el QC, apruébalo cuando esté
   hecho"? Recomendación: no por ahora; siempre vuelve a revisarse (lo más seguro).
4. ¿Safety quiere ver "Coming", o solo le interesa lo que ya está listo?
5. ¿Qué reglas usa Safety para decidir si un camión necesita QC? Primero se validan con Safety y
   gerencia; después se automatizan (prompt §8.1 A).
