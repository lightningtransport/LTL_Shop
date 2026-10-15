# Documentación de Lightning Shop

**Actualizado:** 2026-10-14 (PRD nuevo; lo pendiente pasa a Linear; índice completo)

Esta carpeta tiene **una sola fuente de verdad por tema**. Si algo no está
aquí, no es una regla vigente. Lo que está en `archive/` es historia: sirve
para entender por qué se decidió algo, nunca para saber cómo funciona hoy.

## Qué leer

| Documento | Para qué sirve |
|---|---|
| [`PRD.md`](PRD.md) | **Empieza aquí.** Qué es el producto, para quién, sus 11 módulos (los mismos proyectos de Linear), qué no hace, métricas y hacia dónde va. |
| [`SYSTEM.md`](SYSTEM.md) | **Cómo funciona el sistema hoy**: roles, flujos, estados, pantallas y reglas. |
| [`USER_FLOWS.md`](USER_FLOWS.md) | **Historias de usuario, jobs to be done, flujos paso a paso y casos límite** por rol, con el estado comprobado de cada uno. |
| [`DECISIONS.md`](DECISIONS.md) | Registro único de decisiones de producto (D1–D44, D-SET, D-PC, D-MG, D-PM, D-QC) y preguntas abiertas (P). |
| **Linear** (equipo LTR) | **Todo lo pendiente**: defectos, mejoras y tareas, un proyecto por módulo. |
| [`OPEN_ISSUES.md`](OPEN_ISSUES.md) | Resumen corto de lo abierto, con su issue de Linear. El historial de defectos hasta el 2026-10-14 está en [`archive/OPEN_ISSUES_HISTORIAL_2026-10.md`](archive/OPEN_ISSUES_HISTORIAL_2026-10.md). |
| [`GO_LIVE_CHECKLIST_ES.md`](GO_LIVE_CHECKLIST_ES.md) | Paso a paso para salir en vivo (fases 0–8, quién hace qué). |
| [`design-system/`](design-system/README.md) | Tokens, componentes, patrones y glosario EN/ES. |
| `proposals/` | Propuestas de diseño con maqueta (todas construidas; quedan como referencia de diseño): [Work Order Detail](proposals/wo-detail-redesign/README.md), [Truck Detail](proposals/truck-detail-redesign/README.md), [Dashboard y Yard](proposals/dashboard-yard-redesign/README.md), [Setup del Admin](proposals/admin-setup-redesign/README.md), [Mecánico General](proposals/mechanic-standard-redesign/README.md), [Mecánico PM](proposals/mechanic-pm-redesign/README.md), [Safety](proposals/qc-screen-redesign/README.md), [Parts & costs](proposals/parts-costs/README.md), [Modo demo](proposals/demo-mode/README.md), [Hoja de inspección](proposals/inspection-checklist/README.md) y [Samsara y camiones propios](proposals/samsara-trucks/README.md) (Pasos 1 y 3 pendientes). |
| [`ux-audit/`](ux-audit/admin-truck-wo/00-contexto.md) | Auditorías UX con las skills `audit-ux-*`: [Truck ↔ Work Order](ux-audit/admin-truck-wo/00-contexto.md), [Dashboard y Yard](ux-audit/admin-dashboard-yard/00-contexto.md), [Setup](ux-audit/admin-setup/00-contexto.md), [Parts & costs](ux-audit/admin-parts-costs/00-contexto.md), [mecánico general](ux-audit/mecanico-general/00-contexto.md), [PM](ux-audit/mecanico-pm/00-contexto.md), [Safety](ux-audit/safety-qc/00-contexto.md) el [modo demo](ux-audit/demo-mode/09-informe-final.md) y la [lista de Trucks](ux-audit/admin-trucks-list/04-jerarquia-visual.md). Resumen de los roles de campo: [`RESUMEN-roles-de-campo.md`](ux-audit/RESUMEN-roles-de-campo.md). |

### Referencia técnica (`reference/`)

| Documento | Para qué sirve |
|---|---|
| [`ENGINEERING_PRACTICES.md`](reference/ENGINEERING_PRACTICES.md) | Reglas de datos, caché, mutaciones y rendimiento. |
| [`AGENT_WORKFLOW.md`](reference/AGENT_WORKFLOW.md) | Cómo se trabaja una tarea (humano o agente) de principio a fin. |
| [`DEPLOY.md`](reference/DEPLOY.md) | Deploy en Vercel y migraciones por el workflow de Release safety. |
| [`PERFORMANCE.md`](reference/PERFORMANCE.md) | Mediciones y metas de rendimiento. |
| [`NINOX_SHOP_MAPPING.md`](reference/NINOX_SHOP_MAPPING.md) | IDs de Ninox verificados. |
| [`NINOX_TRUCK_SEED.md`](reference/NINOX_TRUCK_SEED.md) | Carga única de camiones desde Ninox. |
| [`DEMO.md`](reference/DEMO.md) | Demo local con toda la app en uso: cómo armarla y arrancarla, el Panel de demo (D36), cuentas y qué muestra cada camión. |
| [`YARD_DATA_BOUNDARY.md`](reference/YARD_DATA_BOUNDARY.md) | Tarjetas del Yard que vienen de agent-reporting. |
| [`TRUCK_IDENTITY_AND_MILEAGE_CURRENT.md`](reference/TRUCK_IDENTITY_AND_MILEAGE_CURRENT.md) | Identidad del camión y millaje. |

### Archivo (`archive/`)

Ver [`archive/README.md`](archive/README.md). Incluye el PRD maestro, los
PRDs viejos, contratos de migración, auditorías, planes y el runbook de
Flujo v3 ya ejecutado.

## Reglas para mantener esto en orden

1. **Un PR que cambia el comportamiento actualiza `SYSTEM.md` y
   `USER_FLOWS.md` en el mismo PR**, y la prueba de esa fila en
   `apps/api/test-real/`. Si no cambian, el revisor pregunta por qué.
2. **Una decisión nueva va a `DECISIONS.md`** con número, fecha y a qué
   reemplaza. No se deja solo en Linear, en un chat o en un documento de
   análisis.
3. **Lo pendiente vive en Linear.** Un defecto o una mejora es un issue en el
   proyecto de su módulo, con etiqueta de severidad (B bloquea, C confunde,
   E cosmético) si es defecto. `OPEN_ISSUES.md` es solo un resumen con el
   número del issue; se borra la línea cuando el issue pasa a Done.
4. **No se crean documentos nuevos en la raíz de `docs/`.** Análisis,
   propuestas y auditorías se escriben, se usan y, cuando se ejecutan, sus
   conclusiones pasan a `SYSTEM.md` / `DECISIONS.md`. Un plan ejecutado se
   mueve a `archive/`; una propuesta con maqueta se queda en `proposals/`
   marcada "construida" porque sigue siendo referencia de diseño. Un módulo
   nuevo se agrega a `PRD.md`.
5. **El código manda.** Si `SYSTEM.md` y el código no coinciden, es un
   defecto de uno de los dos: se abre un issue en Linear y se corrige.
6. El esquema de base de datos vive en `apps/api/prisma/schema.prisma` y sus
   migraciones. `supabase/migrations/` es una copia vieja congelada; no se usa.
