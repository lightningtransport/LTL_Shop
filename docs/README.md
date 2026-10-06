# Documentación de Lightning Shop

**Actualizado:** 2026-09-29

Esta carpeta tiene **una sola fuente de verdad por tema**. Si algo no está
aquí, no es una regla vigente. Lo que está en `archive/` es historia: sirve
para entender por qué se decidió algo, nunca para saber cómo funciona hoy.

## Qué leer

| Documento | Para qué sirve |
|---|---|
| [`SYSTEM.md`](SYSTEM.md) | **Cómo funciona el sistema hoy**: roles, flujos, estados, pantallas y reglas. Empieza aquí. |
| [`USER_FLOWS.md`](USER_FLOWS.md) | **Historias de usuario, jobs to be done, flujos paso a paso y casos límite** por rol, con el estado comprobado de cada uno. |
| [`DECISIONS.md`](DECISIONS.md) | Registro único de decisiones de producto (D1–D18), con su estado. |
| [`OPEN_ISSUES.md`](OPEN_ISSUES.md) | **Plan de cierre** (§0: por qué salen defectos, reglas, matriz de 28 flujos, fases A–D), defectos conocidos, limpieza, salida en vivo, fuera de alcance. |
| [`GO_LIVE_CHECKLIST_ES.md`](GO_LIVE_CHECKLIST_ES.md) | Lista para abrir el Shop a usuarios reales. |
| [`design-system/`](design-system/README.md) | Tokens, componentes, patrones y glosario EN/ES. |
| [`proposals/`](proposals/wo-detail-redesign/README.md) | Propuestas de diseño **no construidas**, con maqueta: [Work Order Detail](proposals/wo-detail-redesign/README.md) y [Truck Detail](proposals/truck-detail-redesign/README.md). |
| [`ux-audit/`](ux-audit/admin-truck-wo/00-contexto.md) | Auditorías UX con las skills `audit-ux-*` (hoy: Truck ↔ Work Order). |

### Referencia técnica (`reference/`)

| Documento | Para qué sirve |
|---|---|
| [`ENGINEERING_PRACTICES.md`](reference/ENGINEERING_PRACTICES.md) | Reglas de datos, caché, mutaciones y rendimiento. |
| [`AGENT_WORKFLOW.md`](reference/AGENT_WORKFLOW.md) | Cómo se trabaja una tarea (humano o agente) de principio a fin. |
| [`DEPLOY.md`](reference/DEPLOY.md) | Deploy en Vercel y migraciones por el workflow de Release safety. |
| [`PERFORMANCE.md`](reference/PERFORMANCE.md) | Mediciones y metas de rendimiento. |
| [`NINOX_SHOP_MAPPING.md`](reference/NINOX_SHOP_MAPPING.md) | IDs de Ninox verificados. |
| [`NINOX_TRUCK_SEED.md`](reference/NINOX_TRUCK_SEED.md) | Carga única de camiones desde Ninox. |
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
3. **Un defecto conocido va a `OPEN_ISSUES.md`** (o a Linear, con el enlace
   ahí). Se borra de la lista cuando se arregla.
4. **No se crean documentos nuevos en la raíz de `docs/`.** Análisis,
   propuestas y auditorías se escriben, se usan y, cuando se ejecutan, sus
   conclusiones pasan a `SYSTEM.md` / `DECISIONS.md` y el archivo se mueve a
   `archive/`.
5. **El código manda.** Si `SYSTEM.md` y el código no coinciden, es un
   defecto de uno de los dos: se anota en `OPEN_ISSUES.md` y se corrige.
6. El esquema de base de datos vive en `apps/api/prisma/schema.prisma` y sus
   migraciones. `supabase/migrations/` es una copia vieja congelada; no se usa.
