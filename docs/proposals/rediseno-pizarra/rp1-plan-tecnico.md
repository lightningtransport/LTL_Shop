# RP-1 · Plan técnico: Work Order con lo que aplica y QC con estado propio

**Estado:** plan, sin código. Sirve para empezar apenas el dueño cierre las decisiones de abajo.
Leído de `origin/main` `0e2f46a`.
**Historias:** HU-RD2, HU-RD3, HU-RD12 ([README](README.md) §5).
**Riesgos que resuelve:** R-1 a R-5 ([inventario](ia-inventario.md) §5).

**Marcas:**
- ✅ = leído en el código, con archivo y línea.
- ⚠️ = depende de una decisión abierta.

---

## 1. Qué tiene que ser cierto antes de empezar

| # | Condición | Fuente | Estado |
|---|---|---|---|
| C1 | Qué trae cada tipo de visita (plantillas) | Shop Manager 7–8, Carlos 2 | ⚠️ abierta |
| C2 | Quién decide "QC not required" (P46) | Safety 2, Carlos 1 | ⚠️ abierta |
| C3 | Si un paso quitado de la plantilla pide motivo | Shop Manager 9, Carlos 3 | ⚠️ abierta |
| C4 | Se queda "Work Order" (P45) | Dueño | ⚠️ recomendado, sin confirmar |
| C5 | Qué nace con "Create PM service" sin WO (P53) | Shop Manager 17 | ⚠️ abierta |
| C6 | Si la devolución de Safety crea el correctivo (P54) | Safety 3 | ⚠️ abierta; puede ir en un PR aparte |
| C7 | La decisión escrita como D58 en `DECISIONS.md` (cambia D13 y D55 R9) | Dueño | ⚠️ después de C1–C5 |
| C8 | Issue en Linear | Dueño (OK para crear) | ⚠️ |

**Sin C1, C2, C3, C5 y C7 no se escribe código.**

---

## 2. Cambios, archivo por archivo

### 2.1 Datos (migración pequeña, aditiva)

- `work_orders.visit_type`: enum nullable (`end_of_contract`, `passing_through`, `other`). Las WOs
  viejas quedan `null`, y `null` se lee como hoy.
- `work_orders.qc_decision`: enum nullable (`to_decide`, `required`, `not_required`), más
  `qc_decided_by_id`, `qc_decided_at` y `qc_decision_reason`. `null` = WO de antes del cambio: el QC
  sigue obligatorio como hoy.
- **Por qué hacen falta columnas:** sin ellas no se distingue "QC por decidir" de "WO vieja a la que
  le falta el QC" (R-2, R-4). Por eso el "sin migración" de antes estaba mal.
- **Release safety después del merge.** No borra ni cambia datos.

### 2.2 API

| Cambio | Archivo hoy ✅ | Qué cambia |
|---|---|---|
| Crear WO con tipo de visita y pasos que no aplican | `packages/shared/src/schemas.ts:431` (`createWorkOrderSchema`), `apps/api/src/work-orders/work-orders.service.ts:202` (`create`), `:310` (`resolveMandatoryJobs`) | Acepta `visitType`, `notRequired: [{ stepKey, reason }]` y `qcDecision`. Los pasos que no aplican nacen **cancelados con motivo**, a nombre de quien crea ("cancelado = no aplica" ya existe en `mandatoryPhase`, `yard-work-plan-derivation.ts`). El QC nace solo si `qcDecision = required` |
| Plantillas | Nuevo, en `packages/shared` (código, no Setup) | Una constante por tipo de visita, según C1 |
| "Add missing steps" | `packages/shared/src/truck-next-step.ts:113-114`; `work-orders.service.ts:1032` | No pide los pasos cancelados, ni el QC mientras `qc_decision` no sea `required`. Solo aplica a WOs con `visit_type` `null` |
| Nuevo siguiente paso `decide_qc` | `truck-next-step.ts`, `apps/api/src/admin/work-order-next-step.ts` | Antes de `close`: el QC está en `to_decide` y lo demás está hecho o no aplica |
| Decidir el QC | `apps/api/src/admin/admin.service.ts` (nuevo endpoint `POST /admin/work-orders/:id/qc-decision`) | `required` crea el Job de QC (como `resolveMandatoryJobs` hoy). `not_required` pide motivo y queda en el Activity Log. Solo `work_orders.manage`, o lo que decida C2 |
| QC no se cancela | `admin.service.ts:1710` (`QC_NOT_CANCELLABLE`) | Sigue igual para el Job de QC. "Not required" va por el endpoint de arriba, no por cancelar |
| Cierre sin inspección | `admin.service.ts:1136-1138` (`INSPECTION_NOT_DONE`, `inspectionSkipReason`) | Si la inspección se marcó "not required" con motivo al crear, ese motivo cuenta como `inspectionSkipReason` (R-1) |
| Cierre con QC por decidir | `admin.service.ts` (Close) | Nuevo error `QC_NOT_DECIDED` mientras `qc_decision = to_decide` |
| Fase del Yard | `apps/api/src/admin/yard-work-plan-derivation.ts` (`deriveWorkPlan`) | QC `not_required` = resuelto; `to_decide` = no listo, "QC to decide" |
| Cola de Safety | `apps/api/src/quality-check/quality-check.service.ts:89` (`qcJobOf`) | Sin cambio: sin Job de QC, no aparece |
| Create PM service sin WO | `work-orders.service.ts` (`createOrJoinPm`, ~1383) | Según C5: WO `other`, solo con el PM y QC `to_decide` |

### 2.3 Web

| Cambio | Archivo hoy ✅ |
|---|---|
| New Work Order con Visit type, pasos y QC (como el boceto) | `apps/web/src/components/admin-new-work-order.tsx` |
| Paso `decide_qc` en el aviso del camión y la WO | `apps/web/src/components/next-step-action.tsx`, `work-order-next-step.tsx`, `admin-truck-next-step.tsx`, `lib/truck-next-step.ts` |
| Diálogo de cierre: no pedir el motivo si ya hay "inspection not required" | `apps/web/src/components/close-work-order-dialog.tsx` |
| Grupo del Dashboard "QC to decide" | `apps/web/src/lib/dashboard-queue.ts`, `admin-dashboard.tsx` |
| Textos EN y ES | `apps/web/src/lib/admin-messages-catalog.ts`, `lib/api-error-copy.ts` (`QC_NOT_DECIDED`) |

---

## 3. Pruebas

**Filas de `test:real` que cambian** (se cambian con la regla, no se saltan):
- `journey-rules.real.spec.ts`: QC_NOT_CANCELLABLE sigue; se agrega "not required" por decisión.
- `manager-plan.real.spec.ts` y `cancel-reopen.real.spec.ts`: Add missing steps.
- `overview.real.spec.ts` A19 / A19b: el test de contrato del siguiente paso suma `decide_qc`.

**Filas nuevas:**
- Los tres ejemplos del prompt: 901 End of contract con QC Passed, 705 Passing through con QC Not
  required que se cierra, 804 QC Failed.
- Un mecánico o Safety no pueden decidir el QC (403), salvo que C2 diga otra cosa.
- Una WO vieja (`visit_type` `null`) se comporta igual que hoy.

**Además:** unitarias de `truck-next-step.spec.ts` (shared y web), `yard-work-plan-derivation.spec.ts`
y `work-orders.add-job-assignee.spec.ts`. Las e2e de Playwright de New Work Order se actualizan.

---

## 4. Estimación (probable, con supuestos)

| Parte | Horas |
|---|---|
| Migración y tipos | 1–2 |
| API (crear, decidir QC, siguiente paso, cierre, fase, PM) | 5–7 |
| Web (New WO, decide_qc, cierre, Dashboard, textos) | 4–6 |
| Pruebas (filas que cambian y nuevas, unitarias) | 3–4 |
| SYSTEM.md, USER_FLOWS.md, DECISIONS (D58) | 1–2 |
| **Total** | **14–21 h** (sin P54) |

P54 (el correctivo nace de la devolución) va en un PR aparte: +3–4 h.

El README decía 15 h para RP-1 con P54 incluido; este desglose da un poco más.

## 5. Orden de los commits (un PR)

1. Migración y tipos compartidos.
2. API con sus filas de `test:real`.
3. Web.
4. Docs.

Validar con `test:real` y las unitarias antes de empujar. Avisar al dueño que corre **Release safety**
justo después del merge.
